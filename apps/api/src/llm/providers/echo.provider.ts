import type {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMMessage,
  LLMProviderName,
} from '@second-brain/shared';
import type { LLMProvider } from '../llm-provider.interface';

/**
 * Echo provider (Sprint 10.6). A real, always-available, zero-cost, offline LLM
 * backend: it produces a deterministic response from the prompt (no network, no
 * key). It stands in for a local model and, crucially, gives the orchestrator a
 * SECOND executable provider so multi-model routing is genuine and testable
 * without external API keys. Low quality by design — the orchestrator only
 * routes here under the cost/speed strategies (or as a fallback), never for
 * quality-first work.
 */
export class EchoProvider implements LLMProvider {
  readonly name: LLMProviderName = 'echo';

  generate(
    messages: LLMMessage[],
    _options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const prompt = (lastUser?.content ?? '').trim();
    const text = prompt
      ? `[echo] I received your request (${prompt.length} chars). A full model would answer here.`
      : '[echo] No prompt provided.';
    return Promise.resolve({ text, provider: this.name, model: 'echo-1' });
  }
}
