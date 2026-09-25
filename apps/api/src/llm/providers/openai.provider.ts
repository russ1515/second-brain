import { Logger } from '@nestjs/common';
import type {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMMessage,
  LLMProviderName,
} from '@second-brain/shared';
import type { LLMProvider } from '../llm-provider.interface';

interface OpenAIFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type OpenAIFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<OpenAIFetchResponse>;

type JsonRecord = Record<string, unknown>;

/**
 * OpenAI Responses implementation of the provider contract.
 *
 * It intentionally has no SDK dependency: Node 22 supplies fetch and the
 * injectable transport keeps the request/usage mapping deterministic in tests.
 * No response body, provider error body, request header, or prompt is logged.
 */
export class OpenAIProvider implements LLMProvider {
  readonly name: LLMProviderName = 'openai';

  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly fetcher: OpenAIFetch;

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string,
    fetcher?: OpenAIFetch,
  ) {
    if (!apiKey) {
      // Fail at call time so health checks and offline staging can boot, just
      // like the existing Gemini seam. The log never contains a credential.
      this.logger.warn('OPENAI_API_KEY is not set; OpenAI calls will fail until it is.');
    }
    this.fetcher = fetcher ?? (globalThis.fetch as unknown as OpenAIFetch);
  }

  async generate(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    if (!this.apiKey) throw new OpenAIProviderError('OPENAI_CREDENTIAL_MISSING', 401);
    const model = (options?.model ?? this.defaultModel).trim();
    if (!model) throw new OpenAIProviderError('OPENAI_MODEL_MISSING', 400);

    const instructions = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .filter(Boolean)
      .join('\n\n');
    const input = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content: [{
          type: message.role === 'assistant' ? 'output_text' : 'input_text',
          text: message.content,
        }],
      }));
    if (input.length === 0) throw new OpenAIProviderError('OPENAI_INPUT_MISSING', 400);

    const request = {
      model,
      input,
      // Do not retain Second Brain user content in the provider response store.
      store: false,
      ...(instructions ? { instructions } : {}),
      ...(options?.maxOutputTokens !== undefined
        ? { max_output_tokens: options.maxOutputTokens }
        : {}),
      ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
    };

    let response: OpenAIFetchResponse;
    try {
      response = await this.fetcher('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw new OpenAIProviderError('OPENAI_NETWORK_ERROR', 503);
    }
    if (!response.ok) {
      // Deliberately do not parse the error payload: it can echo sensitive input.
      throw new OpenAIProviderError(`OPENAI_RESPONSE_HTTP_${response.status}`, response.status);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAIProviderError('OPENAI_RESPONSE_INVALID_JSON', 502);
    }
    const parsed = asRecord(payload);
    if (!parsed) throw new OpenAIProviderError('OPENAI_RESPONSE_INVALID', 502);
    const text = responseText(parsed);
    if (!text) throw new OpenAIProviderError('OPENAI_RESPONSE_TEXT_MISSING', 502);

    const usage = responseUsage(parsed);
    return {
      text,
      provider: this.name,
      model: stringValue(parsed.model) ?? model,
      providerRequestId: stringValue(parsed.id),
      ...(usage ? { usage } : {}),
    };
  }
}

/** Stable, sanitized error surface consumed by LlmService's retry policy. */
export class OpenAIProviderError extends Error {
  readonly code: string;

  constructor(code: string, readonly status: number) {
    super(code);
    this.name = 'OpenAIProviderError';
    this.code = code;
  }
}

function responseText(payload: JsonRecord): string | null {
  // `output_text` is convenient when returned, but parsing output messages is
  // the durable REST shape and avoids depending on an SDK convenience property.
  const convenience = stringValue(payload.output_text);
  if (convenience) return convenience;
  if (!Array.isArray(payload.output)) return null;
  const text = payload.output
    .map(asRecord)
    .flatMap((item) => Array.isArray(item?.content) ? item.content.map(asRecord) : [])
    .filter((item): item is JsonRecord => item?.type === 'output_text')
    .map((item) => stringValue(item.text))
    .filter((value): value is string => Boolean(value))
    .join('')
    .trim();
  return text || null;
}

function responseUsage(payload: JsonRecord): LLMGenerateResult['usage'] | undefined {
  const usage = asRecord(payload.usage);
  if (!usage) return undefined;
  const details = asRecord(usage.input_tokens_details);
  const rawInput = nonNegativeInteger(usage.input_tokens);
  const cachedTokens = nonNegativeInteger(details?.cached_tokens);
  const cacheWriteTokens = nonNegativeInteger(details?.cache_write_tokens);
  const outputTokens = nonNegativeInteger(usage.output_tokens);
  const totalTokens = nonNegativeInteger(usage.total_tokens);
  const reasoningTokens = nonNegativeInteger(asRecord(usage.output_tokens_details)?.reasoning_tokens);

  const categorizedInput = (cachedTokens ?? 0) + (cacheWriteTokens ?? 0);
  const inputTokens = rawInput === undefined
    ? undefined
    : rawInput >= categorizedInput ? rawInput - categorizedInput : undefined;
  const unpricedUsageReason = rawInput !== undefined && inputTokens === undefined
    ? 'OPENAI_USAGE_INCONSISTENT'
    : (cacheWriteTokens ?? 0) > 0
      ? 'OPENAI_CACHE_WRITE_UNPRICED'
      : undefined;

  if (
    rawInput === undefined && cachedTokens === undefined && cacheWriteTokens === undefined &&
    outputTokens === undefined && totalTokens === undefined && reasoningTokens === undefined
  ) {
    return undefined;
  }
  return {
    inputTokens,
    cachedTokens,
    outputTokens,
    totalTokens,
    cacheWriteTokens,
    // Responses output_tokens already includes reasoning tokens. This is kept
    // for observability only and must not be passed as a separately priced unit.
    reasoningTokens,
    unpricedUsageReason,
  };
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}
