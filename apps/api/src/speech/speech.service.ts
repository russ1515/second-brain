import {
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  ACOUSTIC_ASSESSMENT_CONTRACT_VERSION,
  ACOUSTIC_ASSESSMENT_DIMENSIONS,
  ACOUSTIC_ASSESSMENT_MODES,
  ACOUSTIC_ASSESSMENT_REASONS,
  type AcousticAssessmentDimension,
  type AcousticAssessmentReason,
  type AcousticAssessmentResult,
  type SynthesisResult,
  type TranscriptionResult,
} from '@second-brain/shared';
import {
  ACOUSTIC_ASSESSMENT_PROVIDER,
  SPEECH_PROVIDER,
} from './speech.constants';
import type {
  AcousticAssessmentOptions,
  AcousticAssessmentProvider,
  AnalyzeOptions,
  AudioAnalysisResult,
  ProviderAcousticAssessmentResult,
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
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    @Inject(SPEECH_PROVIDER) private readonly provider: SpeechProvider,
    @Optional() private readonly metering?: ProviderMeteringService,
    @Optional() private readonly requestContext?: RequestContextService,
    @Optional()
    @Inject(ACOUSTIC_ASSESSMENT_PROVIDER)
    private readonly acousticProvider?: AcousticAssessmentProvider,
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

  /** A dedicated phonetic evaluator. Generic audio-native coaching does not
   * satisfy this capability. */
  get supportsPronunciationAssessment(): boolean {
    return this.acousticProvider !== undefined;
  }

  get activePronunciationAssessmentProvider(): string | null {
    return this.acousticProvider?.name ?? null;
  }

  /**
   * Native pronunciation assessment through a dedicated provider slot.
   *
   * The method never derives a phonetic score from STT or generic analysis.
   * Missing capability and malformed provider output are returned as scoreless
   * neutral/technical evidence so the language domain can persist NOT_EVALUABLE.
   */
  assessPronunciation(
    audio: Buffer,
    options: AcousticAssessmentOptions,
    feature = 'LANGUAGE_MASTERY_ACOUSTIC',
  ): Promise<AcousticAssessmentResult> {
    const normalized = this.normalizedAcousticOptions(options);
    const fingerprint = normalized.mode === 'scripted-reference'
      && normalized.referenceText
      ? createHash('sha256')
          .update(ACOUSTIC_ASSESSMENT_CONTRACT_VERSION)
          .update('\u0000')
          .update(normalized.locale)
          .update('\u0000')
          .update(normalized.referenceText)
          .digest('hex')
      : null;
    const provider = this.acousticProvider;

    const requestReason = this.invalidAcousticRequest(audio, normalized);
    if (requestReason) {
      return Promise.resolve(this.acousticFailure(
        normalized,
        fingerprint,
        provider,
        'not-evaluable',
        requestReason,
      ));
    }
    if (!provider) {
      return Promise.resolve(this.acousticFailure(
        normalized,
        fingerprint,
        undefined,
        'not-evaluable',
        'assessment-provider-unavailable',
      ));
    }

    let supported = false;
    try {
      supported = provider.supports({
        locale: normalized.locale,
        mode: normalized.mode,
        requiredDimensions: normalized.requiredDimensions,
      });
    } catch {
      supported = false;
    }
    if (!supported) {
      return Promise.resolve(this.acousticFailure(
        normalized,
        fingerprint,
        provider,
        'not-evaluable',
        'locale-mode-not-verified',
      ));
    }

    const seconds = this.wavSeconds(audio, normalized.mimeType)
      ?? this.boundedDuration(normalized.durationSeconds);
    // When compressed duration is unknown, reserve the full accepted duration
    // before a future billable call. ProviderMetering releases the unused part.
    const reservedSeconds = seconds ?? 600;
    const key = this.key('pronunciation-assessment', audio, normalized, feature);

    return this.deduplicate(key, async () => {
      try {
        const call = () => provider.assess(audio, normalized);
        const raw = await (this.metering?.executeWithAttempts(
          {
            provider: provider.name,
            model: provider.model ?? undefined,
            feature,
            resource: 'VOICE_SECONDS',
            units: reservedSeconds,
            metadata: {
              requestedLocale: normalized.locale,
              assessmentMode: normalized.mode,
              rubricVersion: normalized.rubricVersion,
              durationMeasurement: seconds === null
                ? 'NOT_INSTRUMENTED'
                : 'OBSERVED',
            },
            measure: (result) => {
              const assessment = result as ProviderAcousticAssessmentResult;
              const providerSeconds = this.validAcousticSeconds(
                assessment.audioSeconds,
              );
              return {
                providerRequestId: this.safeProviderRequestId(
                  assessment.providerRequestId,
                ),
                model: provider.model,
                audioInputSeconds: providerSeconds ?? seconds,
                measurementSource: providerSeconds === null
                  ? 'OBSERVED' as const
                  : 'PROVIDER' as const,
              };
            },
            quotaUnits: (result) => {
              const assessment = result as ProviderAcousticAssessmentResult;
              return Math.ceil(
                this.validAcousticSeconds(assessment.audioSeconds)
                  ?? seconds
                  ?? reservedSeconds,
              );
            },
          },
          (attempts) => this.execute(
            'SPEECH_ACOUSTIC_ASSESSMENT_UNAVAILABLE',
            60_000,
            call,
            attempts,
            provider.name,
            provider.model,
          ),
        ) ?? this.execute(
          'SPEECH_ACOUSTIC_ASSESSMENT_UNAVAILABLE',
          60_000,
          call,
          undefined,
          provider.name,
          provider.model,
        ));
        return this.normalizeAcousticResult(
          raw,
          normalized,
          fingerprint,
          provider,
          seconds,
        );
      } catch (error) {
        // Quota, entitlement and other application-policy failures are
        // authoritative. They must reach the client with their original code
        // instead of being disguised as neutral acoustic evidence.
        if (error instanceof HttpException && error.getStatus() < 500) throw error;
        return this.acousticFailure(
          normalized,
          fingerprint,
          provider,
          'technical-error',
          'provider-request-failed',
        );
      }
    });
  }

  transcribe(
    audio: Buffer,
    options: TranscribeOptions,
    feature = 'TUTOR_VOICE',
  ): Promise<TranscriptionResult> {
    const key = this.key('stt', audio, options, feature);
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
    const key = this.key('tts', text, options ?? {}, feature);
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
    const key = this.key('analysis', audio, options, feature);
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

  private normalizedAcousticOptions(
    options: AcousticAssessmentOptions,
  ): AcousticAssessmentOptions {
    const referenceText = typeof options.referenceText === 'string'
      ? options.referenceText.normalize('NFC').trim().replace(/\s+/g, ' ')
      : undefined;
    return {
      mimeType: typeof options.mimeType === 'string'
        ? options.mimeType.trim()
        : '',
      locale: typeof options.locale === 'string' ? options.locale.trim() : '',
      mode: options.mode,
      rubricVersion: typeof options.rubricVersion === 'string'
        ? options.rubricVersion.trim()
        : '',
      requiredDimensions: Array.isArray(options.requiredDimensions)
        ? [...options.requiredDimensions]
        : [],
      ...(referenceText ? { referenceText } : {}),
      ...(options.durationSeconds === undefined
        ? {}
        : { durationSeconds: options.durationSeconds }),
    };
  }

  private invalidAcousticRequest(
    audio: Buffer,
    options: AcousticAssessmentOptions,
  ): AcousticAssessmentReason | null {
    if (!Buffer.isBuffer(audio) || audio.length === 0) return 'audio-missing';
    if (
      !options.mimeType
      || !options.locale
      || options.locale.length > 80
      || !options.rubricVersion
      || options.rubricVersion.length > 200
      || !(ACOUSTIC_ASSESSMENT_MODES as readonly string[]).includes(options.mode)
    ) {
      return 'assessment-request-invalid';
    }
    if (
      options.durationSeconds !== undefined
      && this.boundedDuration(options.durationSeconds) === null
    ) {
      return 'assessment-request-invalid';
    }
    const required = options.requiredDimensions;
    if (
      required.length === 0
      || new Set(required).size !== required.length
      || !required.every((dimension) =>
        (ACOUSTIC_ASSESSMENT_DIMENSIONS as readonly string[]).includes(
          dimension,
        ))
      || !required.includes('accuracy')
      || !required.includes('fluency')
    ) {
      return 'assessment-request-invalid';
    }
    if (options.mode === 'scripted-reference' && !options.referenceText) {
      return 'reference-text-required';
    }
    if (options.mode === 'spontaneous' && options.referenceText) {
      return 'reference-text-not-allowed';
    }
    return null;
  }

  private normalizeAcousticResult(
    raw: unknown,
    options: AcousticAssessmentOptions,
    fingerprint: string | null,
    provider: AcousticAssessmentProvider,
    observedSeconds: number | null,
  ): AcousticAssessmentResult {
    if (
      !this.isRecord(raw)
      || !['evaluated', 'not-evaluable', 'technical-error'].includes(
        String(raw.outcome),
      )
      || !this.safeIdentifier(provider.name, 120)
      || !this.safeIdentifier(provider.adapterVersion, 120)
    ) {
      return this.acousticFailure(
        options,
        fingerprint,
        provider,
        'technical-error',
        'provider-response-invalid',
      );
    }

    const outcome = raw.outcome as ProviderAcousticAssessmentResult['outcome'];
    const providerLocale = this.safeIdentifier(raw.providerLocale, 80);
    const providerRequestId = this.safeProviderRequestId(raw.providerRequestId);
    const audioSeconds = this.validAcousticSeconds(raw.audioSeconds)
      ?? observedSeconds;

    if (outcome !== 'evaluated') {
      const reason = this.isAcousticReason(raw.reason)
        ? raw.reason
        : outcome === 'not-evaluable'
          ? 'provider-not-evaluable'
          : 'provider-response-invalid';
      return this.acousticFailure(
        options,
        fingerprint,
        provider,
        outcome,
        reason,
        { providerLocale, providerRequestId, audioSeconds },
      );
    }

    if (
      raw.reason !== null
      || !providerLocale
      || !providerRequestId
      || audioSeconds === null
      || !Array.isArray(raw.dimensions)
    ) {
      return this.acousticFailure(
        options,
        fingerprint,
        provider,
        'technical-error',
        'provider-response-invalid',
        { providerLocale, providerRequestId, audioSeconds },
      );
    }
    if (providerLocale.toLowerCase() !== options.locale.toLowerCase()) {
      return this.acousticFailure(
        options,
        fingerprint,
        provider,
        'not-evaluable',
        'provider-locale-mismatch',
        { providerLocale, providerRequestId, audioSeconds },
      );
    }

    const dimensions: AcousticAssessmentDimension[] = [];
    const seen = new Set<string>();
    for (const candidate of raw.dimensions) {
      if (!this.isRecord(candidate) || !this.isRecord(candidate.range)) {
        return this.acousticFailure(
          options,
          fingerprint,
          provider,
          'technical-error',
          'provider-response-invalid',
          { providerLocale, providerRequestId, audioSeconds },
        );
      }
      const kind = candidate.kind;
      const rawValue = candidate.rawValue;
      const min = candidate.range.min;
      const max = candidate.range.max;
      if (
        typeof kind !== 'string'
        || !(ACOUSTIC_ASSESSMENT_DIMENSIONS as readonly string[]).includes(kind)
        || seen.has(kind)
        || typeof rawValue !== 'number'
        || !Number.isFinite(rawValue)
        || typeof min !== 'number'
        || !Number.isFinite(min)
        || typeof max !== 'number'
        || !Number.isFinite(max)
        || min >= max
        || rawValue < min
        || rawValue > max
      ) {
        return this.acousticFailure(
          options,
          fingerprint,
          provider,
          'technical-error',
          'provider-response-invalid',
          { providerLocale, providerRequestId, audioSeconds },
        );
      }
      seen.add(kind);
      dimensions.push({
        kind: kind as AcousticAssessmentDimension['kind'],
        rawValue,
        range: { min, max },
      });
    }

    if (options.requiredDimensions.some((dimension) => !seen.has(dimension))) {
      return this.acousticFailure(
        options,
        fingerprint,
        provider,
        'technical-error',
        'required-dimension-missing',
        { providerLocale, providerRequestId, audioSeconds },
      );
    }

    return this.acousticResult(
      options,
      fingerprint,
      provider,
      'evaluated',
      null,
      { providerLocale, providerRequestId, audioSeconds, dimensions },
    );
  }

  private acousticFailure(
    options: AcousticAssessmentOptions,
    fingerprint: string | null,
    provider: AcousticAssessmentProvider | undefined,
    outcome: 'not-evaluable' | 'technical-error',
    reason: AcousticAssessmentReason,
    details: {
      providerLocale?: string | null;
      providerRequestId?: string | null;
      audioSeconds?: number | null;
    } = {},
  ): AcousticAssessmentResult {
    return this.acousticResult(
      options,
      fingerprint,
      provider,
      outcome,
      reason,
      details,
    );
  }

  private acousticResult(
    options: AcousticAssessmentOptions,
    fingerprint: string | null,
    provider: AcousticAssessmentProvider | undefined,
    outcome: AcousticAssessmentResult['outcome'],
    reason: AcousticAssessmentReason | null,
    details: {
      providerLocale?: string | null;
      providerRequestId?: string | null;
      audioSeconds?: number | null;
      dimensions?: AcousticAssessmentDimension[];
    } = {},
  ): AcousticAssessmentResult {
    return {
      contractVersion: ACOUSTIC_ASSESSMENT_CONTRACT_VERSION,
      rubricVersion: options.rubricVersion,
      provider: this.safeIdentifier(provider?.name, 120),
      providerModel: this.safeIdentifier(provider?.model, 200),
      providerAdapterVersion: this.safeIdentifier(
        provider?.adapterVersion,
        120,
      ),
      requestedLocale: options.locale,
      providerLocale: details.providerLocale ?? null,
      mode: options.mode,
      referenceTextFingerprint: fingerprint,
      providerRequestId: details.providerRequestId ?? null,
      audioSeconds: details.audioSeconds ?? null,
      outcome,
      dimensions: outcome === 'evaluated'
        ? details.dimensions ?? []
        : [],
      reason,
    };
  }

  private validAcousticSeconds(value: unknown): number | null {
    return typeof value === 'number'
      && Number.isFinite(value)
      && value > 0
      && value <= 600
      ? value
      : null;
  }

  private safeProviderRequestId(value: unknown): string | null {
    const candidate = this.safeIdentifier(value, 240);
    return candidate && /^[A-Za-z0-9_.:-]+$/.test(candidate)
      ? candidate
      : null;
  }

  private safeIdentifier(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null;
    const candidate = value.trim();
    return candidate && candidate.length <= maxLength
      ? candidate
      : null;
  }

  private isAcousticReason(value: unknown): value is AcousticAssessmentReason {
    return typeof value === 'string'
      && (ACOUSTIC_ASSESSMENT_REASONS as readonly string[]).includes(value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    attemptProvider: string = this.provider.name,
    attemptModel?: string | null,
  ): Promise<T> {
    if (this.circuitOpenUntil > Date.now()) {
      throw this.unavailable('SPEECH_CIRCUIT_OPEN');
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const invoke = () => this.withTimeout(call(), timeoutMs);
        const value = attempts
          ? await attempts.attempt(invoke, {
              provider: attemptProvider,
              ...(attemptModel === undefined
                ? {}
                : { model: attemptModel ?? undefined }),
            })
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
      `Speech provider failure category=${code} provider=${attemptProvider} ` +
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

  private key(
    kind: string,
    value: Buffer | string,
    options: object,
    feature: string,
  ): string {
    const context = this.requestContext?.current();
    return createHash('sha256')
      // Cache/in-flight work may never cross an authenticated account,
      // request operation or product feature. These values are hashed and are
      // never logged. Without an HTTP context, isolated unit/startup work keeps
      // a deterministic private scope.
      .update(context?.userId ?? 'NO_AUTHENTICATED_USER')
      .update('\u0000')
      .update(context?.requestId ?? 'NO_REQUEST_CONTEXT')
      .update('\u0000')
      .update(feature)
      .update('\u0000')
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
