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
  /** Stable internal operation name used to apply an explicit request budget. */
  operation?: string;
}

export interface LLMGenerateResult {
  text: string;
  provider: LLMProviderName;
  model: string;
  /** Opaque provider-side request/response identifier, when the provider returns one. */
  providerRequestId?: string;
  usage?: {
    /**
     * Independently-priced input units. Providers that report cached input as a
     * subset of their input total must subtract it before assigning this field.
     */
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    /** Provider-reported total units, retained as evidence rather than repriced. */
    totalTokens?: number;
    /**
     * Provider-reported cache-write units. The current pricing catalog has no
     * cache-write rate, so a positive value must keep the attempt UNKNOWN.
     */
    cacheWriteTokens?: number;
    /** Observability only when outputTokens already includes reasoning units. */
    reasoningTokens?: number;
    /** A stable, non-sensitive reason that forbids a fabricated measured cost. */
    unpricedUsageReason?: string;
  };
}

/** An image handed to a vision-capable provider. */
export interface LLMImagePart {
  mimeType: string;
  /** Base64-encoded bytes. */
  data: string;
}
