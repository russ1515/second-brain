/** Provider-agnostic LLM contract. Business code depends on these types only —
 *  never on a concrete SDK (Gemini/OpenAI/Claude/Ollama). */

export type LLMProviderName =
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'mistral'
  | 'ollama'
  | 'echo';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMGenerateOptions {
  /** Overrides the provider's default model for this call. */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LLMGenerateResult {
  text: string;
  provider: LLMProviderName;
  model: string;
}

/** An image handed to a vision-capable provider. */
export interface LLMImagePart {
  mimeType: string;
  /** Base64-encoded bytes. */
  data: string;
}
