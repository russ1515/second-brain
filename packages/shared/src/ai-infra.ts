import type { LLMProviderName } from './llm';

/**
 * AI Infrastructure Manager (Sprint 10.6).
 *
 * A multi-model layer over the provider seam: several AI backends are cataloged
 * with cost/speed/quality metadata, and an orchestrator picks the right one per
 * strategy — the best, the cheapest or the fastest. Each provider stays
 * interchangeable behind the same LLMProvider contract; adding one is a new
 * adapter + a key, not a business-code change.
 */

/** How the orchestrator chooses among available providers. */
export type AiStrategy = 'quality' | 'cost' | 'speed' | 'balanced';

/** One AI backend in the catalog. Tiers are 1 (low) … 3 (high). */
export interface AiProviderInfo {
  name: LLMProviderName;
  /** Human family label, e.g. "Google Gemini". */
  family: string;
  model: string;
  /** True when it has an adapter AND its key is configured — i.e. usable now. */
  available: boolean;
  /** Why it's unavailable (missing key / no adapter yet), when applicable. */
  unavailableReason?: string;
  costTier: number; // 1 = cheapest … 3 = priciest
  speedTier: number; // 1 = slowest … 3 = fastest
  qualityTier: number; // 1 = basic … 3 = best
  vision: boolean;
}

/** The orchestrator's full state for the AI Provider Manager. */
export interface AiOrchestratorView {
  /** The active selection strategy. */
  strategy: AiStrategy;
  /** The provider that would serve a normal request right now. */
  active: LLMProviderName;
  providers: AiProviderInfo[];
  /** Which provider each strategy would pick, given current availability. */
  selection: Record<AiStrategy, LLMProviderName>;
  /** Per-provider usage so far (from the metrics registry). */
  usage: { model: string; calls: number; errors: number; avgMs: number }[];
}

/** Body for changing the orchestration strategy. */
export interface SetAiStrategyRequest {
  strategy: AiStrategy;
}
