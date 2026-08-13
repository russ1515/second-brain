import type {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMImagePart,
  LLMMessage,
  LLMProviderName,
} from '@second-brain/shared';

/**
 * Contract every LLM provider must satisfy. Business code depends on this
 * interface only — never on a concrete SDK. Adding OpenAI/Claude/Ollama means
 * writing a new class here and wiring it in llm.module.ts; nothing else changes.
 */
export interface LLMProvider {
  readonly name: LLMProviderName;

  /** Generate a completion for the given conversation. */
  generate(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult>;

  /**
   * Read images (photographed or scanned pages) and answer about them.
   *
   * OPTIONAL, like `synthesize` on the speech seam: not every model can see.
   * Callers must check `LlmService.supportsVision` rather than assume — this is
   * what lets the camera feature exist without bolting on an OCR engine.
   */
  readImages?(
    images: LLMImagePart[],
    prompt: string,
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult>;
}
