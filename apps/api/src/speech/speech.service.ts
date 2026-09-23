import { Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { SynthesisResult, TranscriptionResult } from '@second-brain/shared';
import { SPEECH_PROVIDER } from './speech.constants';
import type {
  AnalyzeOptions,
  AudioAnalysisResult,
  SpeechProvider,
  SynthesizeOptions,
  TranscribeOptions,
} from './speech-provider.interface';
import { ProviderMeteringService, type ProviderAttemptRunner } from '../usage/provider-metering.service';

/**
 * The single entry point business code uses for speech.
 * Provider-agnostic: whatever is bound to SPEECH_PROVIDER handles the call.
 */
@Injectable()
export class SpeechService {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly synthesisCache = new Map<
    string,
    { value: SynthesisResult; expiresAt: number }
  >();
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    @Inject(SPEECH_PROVIDER) private readonly provider: SpeechProvider,
    @Optional() private readonly metering?: ProviderMeteringService,
  ) {}

  get activeProvider(): string {
    return this.provider.name;
  }

  /** Whether the active provider can turn text into speech. Callers must check
   *  this before offering TTS — it is not universal (see SpeechProvider). */
  get supportsSynthesis(): boolean {
    return typeof this.provider.synthesize === 'function';
  }

  /** Whether the active provider can analyse raw audio (prosody, pace…). Callers
   *  MUST check this before offering acoustic coaching — only an audio-native
   *  model can do it honestly (see SpeechProvider.analyze). */
  get supportsAnalysis(): boolean {
    return typeof this.provider.analyze === 'function';
  }

  transcribe(
    audio: Buffer,
    options: TranscribeOptions,
    feature = 'TUTOR_VOICE',
  ): Promise<TranscriptionResult> {
    const key = this.key('stt', audio, options);
    const seconds = this.wavSeconds(audio, options.mimeType);
    return this.deduplicate(key, () => this.metering?.executeWithAttempts(
      {
        provider: this.provider.name, feature, resource: 'VOICE_SECONDS', units: seconds ?? 1,
        metadata: { inputSeconds: seconds ?? null, audioDurationMeasurement: seconds === null ? 'NOT_INSTRUMENTED' : 'OBSERVED' },
        measure: (result) => ({
          model: (result as TranscriptionResult).model,
          ...(seconds === null ? {} : { audioInputSeconds: seconds }),
          measurementSource: 'OBSERVED',
        }),
      },
      (attempts) => this.execute('SPEECH_TRANSCRIPTION_UNAVAILABLE', 45_000, () => this.provider.transcribe(audio, options), attempts),
    ) ?? this.execute('SPEECH_TRANSCRIPTION_UNAVAILABLE', 45_000, () => this.provider.transcribe(audio, options)));
  }

  /** Only call when `supportsSynthesis` is true. */
  synthesize(text: string, options?: SynthesizeOptions, feature = 'TUTOR_VOICE'): Promise<SynthesisResult> {
    if (!this.provider.synthesize) {
      throw new Error(
        `Speech provider "${this.provider.name}" cannot synthesize speech.`,
      );
    }
    const key = this.key('tts', text, options ?? {});
    const cached = this.synthesisCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    const synthesize = this.provider.synthesize;
    return this.deduplicate(key, async () => {
      const providerCall = () => this.execute('SPEECH_SYNTHESIS_UNAVAILABLE', 60_000, () => synthesize.call(this.provider, text, options));
      const value = await (this.metering?.executeWithAttempts(
        {
          provider: this.provider.name, feature, resource: 'VOICE_SECONDS', units: 1,
          metadata: { outputDurationMeasurement: 'OBSERVED_WHEN_WAV' },
          measure: (result) => {
            const speech = result as SynthesisResult;
            const duration = this.audioSeconds(speech.audioBase64, speech.mimeType);
            return {
              model: speech.model,
              ...(duration === null ? {} : { audioOutputSeconds: duration }),
              measurementSource: 'OBSERVED' as const,
              metadata: { outputSeconds: duration ?? null, outputDurationMeasurement: duration === null ? 'NOT_INSTRUMENTED' : 'OBSERVED' },
            };
          },
        },
        (attempts) => this.execute('SPEECH_SYNTHESIS_UNAVAILABLE', 60_000, providerCall, attempts),
      ) ?? providerCall());
      this.synthesisCache.set(key, { value, expiresAt: Date.now() + 10 * 60_000 });
      while (this.synthesisCache.size > 20) {
        const oldest = this.synthesisCache.keys().next().value as string | undefined;
        if (!oldest) break;
        this.synthesisCache.delete(oldest);
      }
      return value;
    });
  }

  /** Only call when `supportsAnalysis` is true. */
  analyze(audio: Buffer, options: AnalyzeOptions, feature = 'LANGUAGE_VOICE'): Promise<AudioAnalysisResult> {
    if (!this.provider.analyze) {
      throw new Error(
        `Speech provider "${this.provider.name}" cannot analyse audio.`,
      );
    }
    const analyze = this.provider.analyze;
    const key = this.key('analysis', audio, options);
    const seconds = this.wavSeconds(audio, options.mimeType);
    return this.deduplicate(key, () => this.metering?.executeWithAttempts(
      {
        provider: this.provider.name, feature, resource: 'VOICE_SECONDS', units: seconds ?? 1,
        metadata: { inputSeconds: seconds ?? null, audioDurationMeasurement: seconds === null ? 'NOT_INSTRUMENTED' : 'OBSERVED' },
        measure: () => ({
          ...(seconds === null ? {} : { audioInputSeconds: seconds }),
          measurementSource: 'OBSERVED',
        }),
      },
      (attempts) => this.execute('SPEECH_ANALYSIS_UNAVAILABLE', 60_000, () => analyze.call(this.provider, audio, options), attempts),
    ) ?? this.execute('SPEECH_ANALYSIS_UNAVAILABLE', 60_000, () => analyze.call(this.provider, audio, options)));
  }

  private deduplicate<T>(key: string, run: () => Promise<T>): Promise<T> {
    const current = this.inFlight.get(key) as Promise<T> | undefined;
    if (current) return current;
    const request = run().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private async execute<T>(
    code: string,
    timeoutMs: number,
    call: () => Promise<T>,
    attempts?: ProviderAttemptRunner,
  ): Promise<T> {
    if (this.circuitOpenUntil > Date.now()) {
      throw this.unavailable('SPEECH_CIRCUIT_OPEN');
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const invoke = () => this.withTimeout(call(), timeoutMs);
        const value = attempts
          ? await attempts.attempt(invoke, { provider: this.provider.name })
          : await invoke();
        this.consecutiveFailures = 0;
        this.circuitOpenUntil = 0;
        return value;
      } catch (error) {
        lastError = error;
        const failure = this.classify(error);
        if (failure.transient) this.consecutiveFailures += 1;
        if (failure.quota || this.consecutiveFailures >= 3) {
          this.circuitOpenUntil =
            Date.now() + (failure.quota ? 5 * 60_000 : 60_000);
        }
        if (!failure.retryable || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    void lastError;
    throw this.unavailable(code);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new SpeechTimeoutError()), timeoutMs);
      promise.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error); },
      );
    });
  }

  private classify(error: unknown): {
    transient: boolean;
    retryable: boolean;
    quota: boolean;
  } {
    if (error instanceof SpeechTimeoutError) {
      return { transient: true, retryable: false, quota: false };
    }
    const candidate = error as { status?: number; statusCode?: number; code?: string | number; message?: string };
    const status = Number(candidate?.status ?? candidate?.statusCode ?? candidate?.code);
    const message = String(candidate?.message ?? error ?? '');
    const quota = status === 429 && /quota|resource[_ -]?exhausted|daily|billing/i.test(message);
    const transient = status === 429 || status === 503 || status >= 500;
    return { transient, retryable: transient && !quota && status !== 429, quota };
  }

  private unavailable(code: string): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code,
      message: 'The speech provider is temporarily unavailable. Please retry shortly.',
      retryable: true,
    });
  }

  private key(kind: string, value: Buffer | string, options: object): string {
    return createHash('sha256')
      .update(kind)
      .update(value)
      .update(JSON.stringify(options))
      .digest('hex');
  }

  /** Exact server-side WAV duration. Compressed formats stay explicitly unknown
   * until a trusted decoder is introduced; their minimum reservation is 1s. */
  private wavSeconds(audio: Buffer, mimeType: string): number | null {
    if (!/wav/i.test(mimeType) || audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF') return null;
    const byteRate = audio.readUInt32LE(28);
    if (!byteRate) return null;
    return Math.max(1, Math.ceil(Math.max(0, audio.length - 44) / byteRate));
  }

  private audioSeconds(audioBase64: string, mimeType: string): number | null {
    try {
      return this.wavSeconds(Buffer.from(audioBase64, 'base64'), mimeType);
    } catch {
      return null;
    }
  }
}

class SpeechTimeoutError extends Error {
  constructor() {
    super('Speech request timed out');
    this.name = 'SpeechTimeoutError';
  }
}
