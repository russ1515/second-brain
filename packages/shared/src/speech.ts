/** Provider-agnostic speech contracts (STT/TTS). Business code depends on these
 *  types only — never on a concrete SDK. Mirrors the LLM/embeddings seams. */

import type { LessonView } from './lesson';
import type { TutorMessageView } from './tutor';
import type { LanguageMasterySpeechCoverage } from './language-oral-capability';

export type SpeechProviderName = 'gemini' | 'openai' | 'fake';

export const ACOUSTIC_ASSESSMENT_CONTRACT_VERSION =
  'acoustic-assessment-v1' as const;

/**
 * Versioned, provider-independent contract for native pronunciation evidence.
 * It is deliberately separate from STT and generic audio coaching: neither a
 * transcript nor an LLM prose assessment is phonetic evidence.
 */
export const ACOUSTIC_ASSESSMENT_MODES = [
  'scripted-reference',
  'spontaneous',
] as const;
export type AcousticAssessmentMode =
  (typeof ACOUSTIC_ASSESSMENT_MODES)[number];

export const ACOUSTIC_ASSESSMENT_DIMENSIONS = [
  'accuracy',
  'fluency',
  'prosody',
] as const;
export type AcousticAssessmentDimensionKind =
  (typeof ACOUSTIC_ASSESSMENT_DIMENSIONS)[number];

export type AcousticAssessmentOutcome =
  | 'evaluated'
  | 'not-evaluable'
  | 'technical-error';

/** Stable, non-secret reasons. Provider payloads and error messages never cross
 * this boundary. */
export const ACOUSTIC_ASSESSMENT_REASONS = [
  'audio-missing',
  'assessment-request-invalid',
  'reference-text-required',
  'reference-text-not-allowed',
  'assessment-provider-unavailable',
  'locale-mode-not-verified',
  'provider-not-evaluable',
  'provider-request-failed',
  'provider-response-invalid',
  'provider-locale-mismatch',
  'required-dimension-missing',
] as const;
export type AcousticAssessmentReason =
  (typeof ACOUSTIC_ASSESSMENT_REASONS)[number];

export interface AcousticAssessmentDimension {
  kind: AcousticAssessmentDimensionKind;
  /** Unmodified provider value. No vendor aggregate is treated as mastery. */
  rawValue: number;
  range: {
    min: number;
    max: number;
  };
}

/**
 * Safe normalized evidence returned by the speech seam. It intentionally has
 * no transcript, reference text, raw audio, vendor response or mastery score.
 */
export interface AcousticAssessmentResult {
  contractVersion: typeof ACOUSTIC_ASSESSMENT_CONTRACT_VERSION;
  rubricVersion: string;
  provider: string | null;
  providerModel: string | null;
  providerAdapterVersion: string | null;
  requestedLocale: string;
  providerLocale: string | null;
  mode: AcousticAssessmentMode;
  /** SHA-256 fingerprint for scripted mode; never the reference answer. */
  referenceTextFingerprint: string | null;
  providerRequestId: string | null;
  audioSeconds: number | null;
  outcome: AcousticAssessmentOutcome;
  /** Empty for every neutral or technical outcome. */
  dimensions: AcousticAssessmentDimension[];
  reason: AcousticAssessmentReason | null;
}

export interface TranscriptionResult {
  text: string;
  /** BCP-47 tag when the provider reports one; null when it cannot tell. */
  language: string | null;
  provider: SpeechProviderName;
  model: string | null;
  /** Opaque provider request id used only for server-side cost correlation. */
  providerRequestId?: string | null;
  /** Provider-reported audio duration when available. */
  audioSeconds?: number | null;
}

export interface SpeechCapabilities {
  provider: string;
  transcription: boolean;
  synthesis: boolean;
  audioAnalysis: boolean;
  /** Dedicated normalized phonetic assessment. Generic audio analysis does not
   * satisfy this capability. */
  pronunciationAssessment: boolean;
  pronunciationAssessmentProvider: string | null;
  /** Strict mastery rollout and per-language coverage verified for the active
   * provider/model deployment. Missing lists mean no language is claimed. */
  languageMasteryV1: LanguageMasterySpeechCoverage;
}

export interface SynthesisResult {
  /** Raw audio bytes, base64-encoded for JSON transport. */
  audioBase64: string;
  mimeType: string;
  provider: SpeechProviderName;
  model: string | null;
  /** Opaque provider request id used only for server-side cost correlation. */
  providerRequestId?: string | null;
}

/** Ask the teacher to read something aloud.
 *
 * Distinct from a voice TURN: this does not teach, mark, or remember anything —
 * it only voices text the learner already has on screen. */
export interface SynthesizeRequest {
  text: string;
  /** BCP-47 or a plain language name; providers may ignore it. */
  language?: string;
}

/** One spoken turn: what the learner said, the tutor's grounded reply, and the
 *  written package the interaction produced (written-first: voice reinforces,
 *  writing preserves). `lesson` is null only when generation failed — the turn
 *  itself never fails over it. */
export interface VoiceTurnResponse {
  transcript: string;
  language: string | null;
  message: TutorMessageView;
  lesson: LessonView | null;
  /** Present only when `speak` was requested AND the provider supports TTS. */
  audio?: SynthesisResult;
  /** True only when speech was requested but TTS failed after the written turn
   * succeeded. Clients must surface this rather than pretending voice played. */
  audioUnavailable?: boolean;
}
