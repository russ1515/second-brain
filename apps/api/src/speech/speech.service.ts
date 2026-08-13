import { Inject, Injectable } from '@nestjs/common';
import type { SynthesisResult, TranscriptionResult } from '@second-brain/shared';
import { SPEECH_PROVIDER } from './speech.constants';
import type {
  AnalyzeOptions,
  AudioAnalysisResult,
  SpeechProvider,
  SynthesizeOptions,
  TranscribeOptions,
} from './speech-provider.interface';

/**
 * The single entry point business code uses for speech.
 * Provider-agnostic: whatever is bound to SPEECH_PROVIDER handles the call.
 */
@Injectable()
export class SpeechService {
  constructor(
    @Inject(SPEECH_PROVIDER) private readonly provider: SpeechProvider,
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
  ): Promise<TranscriptionResult> {
    return this.provider.transcribe(audio, options);
  }

  /** Only call when `supportsSynthesis` is true. */
  synthesize(text: string, options?: SynthesizeOptions): Promise<SynthesisResult> {
    if (!this.provider.synthesize) {
      throw new Error(
        `Speech provider "${this.provider.name}" cannot synthesize speech.`,
      );
    }
    return this.provider.synthesize(text, options);
  }

  /** Only call when `supportsAnalysis` is true. */
  analyze(audio: Buffer, options: AnalyzeOptions): Promise<AudioAnalysisResult> {
    if (!this.provider.analyze) {
      throw new Error(
        `Speech provider "${this.provider.name}" cannot analyse audio.`,
      );
    }
    return this.provider.analyze(audio, options);
  }
}
