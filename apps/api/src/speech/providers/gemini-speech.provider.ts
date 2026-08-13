import { Logger } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  type GenerationConfig,
  type Part,
} from '@google/generative-ai';
import type { SynthesisResult, TranscriptionResult } from '@second-brain/shared';
import type {
  AnalyzeOptions,
  AudioAnalysisResult,
  SpeechProvider,
  SynthesizeOptions,
  TranscribeOptions,
} from '../speech-provider.interface';
import { isRawPcm, parsePcmFormat, pcmToWav } from '../pcm-to-wav';

/** The API accepts AUDIO output, but the 0.21 SDK's GenerationConfig omits both
 *  `responseModalities` and `speechConfig` — same gap as `outputDimensionality`
 *  on the embeddings side. Widen the type rather than fork the SDK. */
type SpeechGenerationConfig = GenerationConfig & {
  responseModalities?: string[];
  speechConfig?: {
    voiceConfig: { prebuiltVoiceConfig: { voiceName: string } };
  };
};

const TRANSCRIBE_PROMPT = [
  'Transcribe this audio verbatim.',
  'Return ONLY the transcript text — no commentary, no quotes, no labels.',
  'If the audio contains no intelligible speech, return an empty response.',
].join(' ');

/** Google Gemini implementation of the speech contract: real STT (audio in via
 *  inline data) and real TTS (AUDIO response modality, headerless PCM wrapped
 *  into WAV before it leaves this class). */
export class GeminiSpeechProvider implements SpeechProvider {
  readonly name = 'gemini' as const;

  private readonly logger = new Logger(GeminiSpeechProvider.name);
  private readonly client: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    private readonly sttModel: string,
    private readonly ttsModel: string,
    private readonly voice: string,
  ) {
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set; speech calls will fail until it is.',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async transcribe(
    audio: Buffer,
    options: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    const model = this.client.getGenerativeModel({ model: this.sttModel });
    const language = options.language
      ? ` The speech is in ${options.language}.`
      : '';

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: TRANSCRIBE_PROMPT + language },
            {
              inlineData: {
                mimeType: options.mimeType,
                data: audio.toString('base64'),
              },
            },
          ],
        },
      ],
      // Transcription is not a creative task.
      generationConfig: { temperature: 0 },
    });

    return {
      text: result.response.text().trim(),
      language: options.language ?? null,
      provider: this.name,
      model: this.sttModel,
    };
  }

  /** Audio-native analysis: Gemini genuinely hears the clip, so it can report on
   *  pace, hesitation and intonation — things a transcript cannot show. The
   *  instruction (and any JSON schema) is owned by the caller. */
  async analyze(
    audio: Buffer,
    options: AnalyzeOptions,
  ): Promise<AudioAnalysisResult> {
    const model = this.client.getGenerativeModel({ model: this.sttModel });
    const language = options.language
      ? ` The learner is speaking ${options.language}.`
      : '';

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: options.instruction + language },
            {
              inlineData: {
                mimeType: options.mimeType,
                data: audio.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    });

    return { text: result.response.text().trim() };
  }

  async synthesize(
    text: string,
    _options?: SynthesizeOptions,
  ): Promise<SynthesisResult> {
    const model = this.client.getGenerativeModel({ model: this.ttsModel });
    const generationConfig: SpeechGenerationConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: this.voice } },
      },
    };

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig,
    });

    const inline = this.firstInlineData(
      result.response.candidates?.[0]?.content?.parts,
    );
    if (!inline) {
      throw new Error(
        `Gemini TTS model "${this.ttsModel}" returned no audio for this request.`,
      );
    }

    const raw = Buffer.from(inline.data, 'base64');
    // Gemini hands back headerless L16 PCM; give clients a playable container.
    if (isRawPcm(inline.mimeType)) {
      return {
        audioBase64: pcmToWav(raw, parsePcmFormat(inline.mimeType)).toString(
          'base64',
        ),
        mimeType: 'audio/wav',
        provider: this.name,
        model: this.ttsModel,
      };
    }
    return {
      audioBase64: inline.data,
      mimeType: inline.mimeType,
      provider: this.name,
      model: this.ttsModel,
    };
  }

  /** Narrow the Part union down to the first audio blob in the response. */
  private firstInlineData(
    parts: Part[] | undefined,
  ): { mimeType: string; data: string } | null {
    for (const part of parts ?? []) {
      if ('inlineData' in part && part.inlineData) {
        return part.inlineData;
      }
    }
    return null;
  }
}
