import type { TranscriptionResult } from '@second-brain/shared';
import type {
  SpeechProvider,
  TranscribeOptions,
} from '../speech-provider.interface';

/**
 * Deterministic DEV TRANSPORT for speech — the STT counterpart of LogMailer.
 *
 * It does NOT pretend to recognise speech: there is no honest way to transcribe
 * real audio locally without a model. Instead it treats the uploaded payload as
 * UTF-8 text and returns it verbatim, which makes the whole written-first
 * pipeline (transcript → tutor → lesson → flashcards) exercisable offline and
 * deterministically, with no API key. Real audio goes through `gemini`.
 *
 * Binary payloads are rejected rather than silently mangled into mojibake.
 */
export class FakeSpeechProvider implements SpeechProvider {
  readonly name = 'fake' as const;

  // No `synthesize`: emitting a silent WAV and calling it speech would be a
  // placeholder. Callers get a clean "not supported" instead.

  async transcribe(
    audio: Buffer,
    _options: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    const text = audio.toString('utf8');
    if (!this.isPlainText(text)) {
      throw new Error(
        'The `fake` speech provider only accepts UTF-8 text payloads (it is a ' +
          'dev transport, not a recogniser). Set SPEECH_PROVIDER=gemini to ' +
          'transcribe real audio.',
      );
    }
    return {
      text: text.trim(),
      language: null,
      provider: this.name,
      model: null,
    };
  }

  /** Round-trip check: real audio bytes do not survive a UTF-8 decode/encode. */
  private isPlainText(decoded: string): boolean {
    return !decoded.includes('�');
  }
}
