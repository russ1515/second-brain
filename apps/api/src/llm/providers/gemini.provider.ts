import { Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMImagePart,
  LLMMessage,
  LLMProviderName,
} from '@second-brain/shared';
import type { LLMProvider } from '../llm-provider.interface';

/** Google Gemini implementation of the provider contract. */
export class GeminiProvider implements LLMProvider {
  readonly name: LLMProviderName = 'gemini';

  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
  ) {
    if (!apiKey) {
      // Surfaced at call time, not at boot — the app can start without a key.
      this.logger.warn('GEMINI_API_KEY is not set; LLM calls will fail until it is.');
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    const model = options?.model ?? this.defaultModel;

    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const generativeModel = this.client.getGenerativeModel({
      model,
      ...(systemInstruction ? { systemInstruction } : {}),
    });

    const result = await generativeModel.generateContent({
      contents,
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      },
    });

    return {
      text: result.response.text(),
      provider: this.name,
      model,
    };
  }

  /** Gemini is multimodal: images ride in as inline data, exactly like the
   *  audio the speech provider sends. No OCR engine needed. */
  async readImages(
    images: LLMImagePart[],
    prompt: string,
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    const model = options?.model ?? this.defaultModel;
    const generativeModel = this.client.getGenerativeModel({ model });

    const result = await generativeModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            ...images.map((image) => ({
              inlineData: { mimeType: image.mimeType, data: image.data },
            })),
          ],
        },
      ],
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.maxOutputTokens,
      },
    });

    return { text: result.response.text(), provider: this.name, model };
  }
}
