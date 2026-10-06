import { Inject, Injectable, Logger, Optional, ServiceUnavailableException } from '@nestjs/common';
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
import { RequestContextService } from '../common/request-context.service';

/**
 * The single entry point business code uses for speech.
 * Provider-agnostic: whatever is bound to SPEECH_PROVIDER handles the call.
 */
@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);
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
    @Optional() private readonly requestContext?: RequestContextService,
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
    const seconds = this.wavSeconds(audio, options.mimeType)
      ?? this.boundedDuration(options.durationSeconds);
    return this.deduplicate(key, () => this.metering?.executeWithAttempts(
      {
        provider: this.provider.name, feature, resource: 'VOICE_SECONDS', units: seconds ?? 1,
        metadata: { inputSeconds: seconds ?? null, audioDurationMeasurement: seconds === null ? 'NOT_INSTRUMENTED' : 'OBSERVED' },
        measure: (result) => ({
          model: (result as TranscriptionResult).model,
          providerRequestId: (result as TranscriptionResult).providerRequestId,
          ...(((result as TranscriptionResult).audioSeconds ?? seconds) === null
            ? {}
            : { audioInputSeconds: (result as TranscriptionResult).audioSeconds ?? seconds ?? undefined }),
          measurementSource: 'OBSERVED',
        }),
        quotaUnits: (result) => (result as TranscriptionResult).audioSeconds ?? seconds ?? 1,
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
      // Reserve a conservative upper bound before the billable call. WAV output
      // gives us exact duration afterwards and ProviderMetering releases the
      // unused part exactly once.
      // Three characters/second is deliberately conservative across Latin,
      // CJK and RTL scripts. The exact WAV duration finalizes the reservation
      // and releases the unused balance after success.
      const reservedSeconds = Math.max(1, Math.ceil(text.length / 3));
      const providerCall = () => synthesize.call(this.provider, text, options);
      const value = await (this.metering?.executeWithAttempts(
        {
          provider: this.provider.name, feature, resource: 'VOICE_SECONDS', units: reservedSeconds,
          metadata: { outputDurationMeasurement: 'OBSERVED_WHEN_WAV' },
          measure: (result) => {
            const speech = result as SynthesisResult;
            const duration = this.audioSeconds(speech.audioBase64, speech.mimeType);
            return {
              model: speech.model,
              providerRequestId: speech.providerRequestId,
              ...(duration === null ? {} : { audioOutputSeconds: duration }),
              measurementSource: 'OBSERVED' as const,
              metadata: { outputSeconds: duration ?? null, outputDurationMeasurement: duration === null ? 'NOT_INSTRUMENTED' : 'OBSERVED' },
            };
          },
          quotaUnits: (result) => {
            const speech = result as SynthesisResult;
            return this.audioSeconds(speech.audioBase64, speech.mimeType) ?? reservedSeconds;
          },
        },
        (attempts) => this.execute('SPEECH_SYNTHESIS_UNAVAILABLE', 60_000, providerCall, attempts),
      ) ?? this.execute('SPEECH_SYNTHESIS_UNAVAILABLE', 60_000, providerCall));
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
    const seconds = this.wavSeconds(audio, options.mimeType)
      ?? this.boundedDuration(options.durationSeconds);
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
    const providerCode = this.safeErrorCode(lastError);
    const requestId = this.requestContext?.current()?.requestId ?? 'REQUEST_CONTEXT_UNAVAILABLE';
    this.logger.error(
      `Speech provider failure category=${code} provider=${this.provider.name} ` +
        `providerCode=${providerCode} requestId=${requestId}`,
    );
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

  private boundedDuration(value: number | undefined): number | null {
    if (!Number.isFinite(value) || value === undefined) return null;
    const seconds = Math.ceil(value);
    return seconds >= 1 && seconds <= 600 ? seconds : null;
  }

  private safeErrorCode(error: unknown): string {
    const value = (error as { code?: unknown; status?: unknown; statusCode?: unknown } | null) ?? null;
    const candidate = value?.code ?? value?.status ?? value?.statusCode ?? 'UNKNOWN';
    const normalized = String(candidate).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 80);
    return normalized || 'UNKNOWN';
  }
}

class SpeechTimeoutError extends Error {
  constructor() {
    super('Speech request timed out');
    this.name = 'SpeechTimeoutError';
  }
}
