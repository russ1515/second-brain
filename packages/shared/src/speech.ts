/** Provider-agnostic speech contracts (STT/TTS). Business code depends on these
 *  types only — never on a concrete SDK. Mirrors the LLM/embeddings seams. */

import type { LessonView } from './lesson';
import type { TutorMessageView } from './tutor';

export type SpeechProviderName = 'gemini' | 'fake';

export interface TranscriptionResult {
  text: string;
  /** BCP-47 tag when the provider reports one; null when it cannot tell. */
  language: string | null;
  provider: SpeechProviderName;
  model: string | null;
}

export interface SynthesisResult {
  /** Raw audio bytes, base64-encoded for JSON transport. */
  audioBase64: string;
  mimeType: string;
  provider: SpeechProviderName;
  model: string | null;
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
}
