import type {
  SpeechProviderName,
  SynthesisResult,
  TranscriptionResult,
} from '@second-brain/shared';

export interface TranscribeOptions {
  /** MIME type of the supplied audio (e.g. audio/wav, audio/mpeg). */
  mimeType: string;
  /** Hint of the expected spoken language (BCP-47); providers may ignore it. */
  language?: string;
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
  /** The analysis instruction — the DOMAIN owns the prompt/schema; the provider
   *  only forwards the audio + this text to an audio-native model. */
  instruction: string;
}

/** Result of an audio-native analysis: the model's raw text answer (the caller
 *  parses it — e.g. as JSON). */
export interface AudioAnalysisResult {
  text: string;
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
