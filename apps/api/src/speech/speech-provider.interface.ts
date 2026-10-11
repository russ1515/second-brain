import type {
  AcousticAssessmentDimension,
  AcousticAssessmentDimensionKind,
  AcousticAssessmentMode,
  AcousticAssessmentOutcome,
  AcousticAssessmentReason,
  SpeechProviderName,
  SynthesisResult,
  TranscriptionResult,
} from '@second-brain/shared';

export interface TranscribeOptions {
  /** MIME type of the supplied audio (e.g. audio/wav, audio/mpeg). */
  mimeType: string;
  /** Hint of the expected spoken language (BCP-47); providers may ignore it. */
  language?: string;
  /** Bounded client observation used only when the container cannot be decoded
   * server-side. WAV duration remains authoritative when available. */
  durationSeconds?: number;
}

export interface SynthesizeOptions {
  /** Target language (BCP-47); providers may ignore it. */
  language?: string;
}

export interface AnalyzeOptions {
  /** MIME type of the supplied audio. */
  mimeType: string;
  /** Hint of the spoken language; providers may ignore it. */
  language?: string;
  durationSeconds?: number;
  /** The analysis instruction — the DOMAIN owns the prompt/schema; the provider
   *  only forwards the audio + this text to an audio-native model. */
  instruction: string;
}

/** Result of an audio-native analysis: the model's raw text answer (the caller
 *  parses it — e.g. as JSON). */
export interface AudioAnalysisResult {
  text: string;
}

/** Domain-owned request for a dedicated native pronunciation assessment.
 * Reference text is sent only to the configured provider in scripted mode and
 * must never be logged or copied into the normalized result. */
export interface AcousticAssessmentOptions {
  mimeType: string;
  locale: string;
  mode: AcousticAssessmentMode;
  rubricVersion: string;
  requiredDimensions: readonly AcousticAssessmentDimensionKind[];
  referenceText?: string;
  durationSeconds?: number;
}

/** Normalized adapter output before the speech seam applies fail-closed
 * validation. No vendor response body, transcript or reference text belongs
 * here. */
export interface ProviderAcousticAssessmentResult {
  providerLocale: string | null;
  providerRequestId: string | null;
  audioSeconds: number | null;
  outcome: AcousticAssessmentOutcome;
  dimensions: AcousticAssessmentDimension[];
  reason: AcousticAssessmentReason | null;
}

/**
 * Separate provider slot for phonetic assessment. It is intentionally not the
 * active STT/TTS provider: Azure can later be attached here without replacing
 * the existing OpenAI/Gemini transport.
 */
export interface AcousticAssessmentProvider {
  readonly name: string;
  readonly model: string | null;
  readonly adapterVersion: string;

  supports(input: {
    locale: string;
    mode: AcousticAssessmentMode;
    requiredDimensions: readonly AcousticAssessmentDimensionKind[];
  }): boolean;

  assess(
    audio: Buffer,
    options: AcousticAssessmentOptions,
  ): Promise<ProviderAcousticAssessmentResult>;
}

/**
 * Contract every speech provider must satisfy. Business code depends on this
 * interface only — never on a concrete SDK. Adding Whisper/ElevenLabs/Azure
 * means writing a new class here and wiring it in speech.module.ts.
 *
 * `synthesize` is intentionally OPTIONAL: text-to-speech is not universally
 * available (the dev transport has no honest way to produce speech), so callers
 * must check `supportsSynthesis` rather than assume. See SpeechService.
 */
export interface SpeechProvider {
  readonly name: SpeechProviderName;

  /** Speech-to-text. */
  transcribe(
    audio: Buffer,
    options: TranscribeOptions,
  ): Promise<TranscriptionResult>;

  /** Text-to-speech. Absent when the provider cannot synthesize speech. */
  synthesize?(text: string, options?: SynthesizeOptions): Promise<SynthesisResult>;

  /** Audio-native analysis: hand the model the AUDIO (not a transcript) plus an
   *  instruction, and get its answer back. Optional — only providers whose model
   *  genuinely hears prosody (pace, intonation, hesitation) can honestly offer
   *  this. Callers must check `SpeechService.supportsAnalysis`. */
  analyze?(audio: Buffer, options: AnalyzeOptions): Promise<AudioAnalysisResult>;
}
