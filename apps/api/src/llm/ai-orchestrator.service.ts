import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AiOrchestratorView,
  AiProviderInfo,
  AiStrategy,
  LLMProviderName,
} from '@second-brain/shared';
import { LLM_PROVIDER } from './llm.constants';
import type { LLMProvider } from './llm-provider.interface';
import { EchoProvider } from './providers/echo.provider';
import { MetricsService } from '../monitoring/metrics.service';

const STRATEGIES: AiStrategy[] = ['quality', 'cost', 'speed', 'balanced'];

/** Static catalog metadata. `available` is computed at runtime from keys. */
interface CatalogEntry extends Omit<AiProviderInfo, 'available' | 'unavailableReason'> {
  /** Env var that must be set for this provider to be usable. */
  keyEnv?: string;
  /** True when an adapter class exists (only then can it actually execute). */
  hasAdapter: boolean;
}

/**
 * AI Infrastructure Manager / Orchestrator (Sprint 10.6).
 *
 * Owns the catalog of AI backends and picks the right one per strategy — quality
 * (best model), cost (cheapest), speed (fastest) or balanced. It routes among the
 * providers that are actually usable now (have an adapter + key); the rest are
 * cataloged as "add a key/adapter to enable", proving the multi-model
 * architecture without pretending unconfigured models can run. Each provider is
 * interchangeable behind the same LLMProvider contract.
 */
@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);
  private strategy: AiStrategy = 'quality';

  private readonly catalog: CatalogEntry[];
  /** The executable provider instances, by name. */
  private readonly instances = new Map<LLMProviderName, LLMProvider>();

  constructor(
    @Inject(LLM_PROVIDER) private readonly primary: LLMProvider,
    private readonly echo: EchoProvider,
    config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    const geminiModel = config.get<string>('llm.model') ?? 'gemini';
    this.instances.set(this.primary.name, this.primary);
    this.instances.set(this.echo.name, this.echo);

    this.catalog = [
      { name: 'gemini', family: 'Google Gemini', model: geminiModel, costTier: 2, speedTier: 3, qualityTier: 2, vision: true, keyEnv: 'GEMINI_API_KEY', hasAdapter: true },
      { name: 'openai', family: 'OpenAI', model: 'gpt-4o', costTier: 3, speedTier: 2, qualityTier: 3, vision: true, keyEnv: 'OPENAI_API_KEY', hasAdapter: false },
      { name: 'claude', family: 'Anthropic Claude', model: 'claude-3.5-sonnet', costTier: 3, speedTier: 2, qualityTier: 3, vision: true, keyEnv: 'ANTHROPIC_API_KEY', hasAdapter: false },
      { name: 'mistral', family: 'Mistral', model: 'mistral-large', costTier: 1, speedTier: 3, qualityTier: 2, vision: false, keyEnv: 'MISTRAL_API_KEY', hasAdapter: false },
      { name: 'ollama', family: 'Local (Ollama)', model: 'llama3', costTier: 1, speedTier: 1, qualityTier: 1, vision: false, hasAdapter: false },
      { name: 'echo', family: 'Echo (offline)', model: 'echo-1', costTier: 1, speedTier: 3, qualityTier: 1, vision: false, hasAdapter: true },
    ];
  }

  getStrategy(): AiStrategy {
    return this.strategy;
  }

  setStrategy(strategy: AiStrategy): AiStrategy {
    if (!STRATEGIES.includes(strategy)) {
      throw new Error(`Unknown strategy "${strategy}".`);
    }
    this.strategy = strategy;
    this.logger.log(`orchestration strategy → ${strategy}`);
    return this.strategy;
  }

  /** The provider that should serve a call under the current strategy. Records
   *  the routing decision so the monitoring layer sees which model was chosen. */
  pickProvider(opts?: { needsVision?: boolean }): LLMProvider {
    const name = this.selectFor(this.strategy, opts?.needsVision ?? false);
    const instance = this.instances.get(name) ?? this.primary;
    return instance;
  }

  /** Whether a vision-capable provider is usable right now. */
  get supportsVision(): boolean {
    return this.availableInfos().some((p) => p.vision);
  }

  // ── selection policy ────────────────────────────────────────────────────────

  private selectFor(strategy: AiStrategy, needsVision: boolean): LLMProviderName {
    let pool = this.availableInfos().filter((p) => (needsVision ? p.vision : true));
    if (pool.length === 0) pool = this.availableInfos();
    if (pool.length === 0) return this.primary.name;

    const ranked = [...pool].sort((a, b) => {
      switch (strategy) {
        case 'quality':
          return b.qualityTier - a.qualityTier || a.costTier - b.costTier;
        case 'cost':
          return a.costTier - b.costTier || b.speedTier - a.speedTier;
        case 'speed':
          return b.speedTier - a.speedTier || a.costTier - b.costTier;
        case 'balanced':
        default:
          return score(b) - score(a);
      }
    });
    return ranked[0].name;
  }

  private availableInfos(): AiProviderInfo[] {
    return this.snapshotProviders().filter((p) => p.available);
  }

  // ── snapshot for the AI Provider Manager ────────────────────────────────────

  private snapshotProviders(): AiProviderInfo[] {
    return this.catalog.map((c) => {
      const hasInstance = this.instances.has(c.name);
      const keyOk = !c.keyEnv || !!process.env[c.keyEnv];
      const available = c.hasAdapter && hasInstance && keyOk;
      let unavailableReason: string | undefined;
      if (!available) {
        if (!c.hasAdapter) unavailableReason = 'No adapter yet — implement LLMProvider.';
        else if (!keyOk) unavailableReason = `Set ${c.keyEnv} to enable.`;
      }
      return {
        name: c.name,
        family: c.family,
        model: c.model,
        available,
        unavailableReason,
        costTier: c.costTier,
        speedTier: c.speedTier,
        qualityTier: c.qualityTier,
        vision: c.vision,
      };
    });
  }

  view(): AiOrchestratorView {
    const selection = STRATEGIES.reduce(
      (acc, s) => {
        acc[s] = this.selectFor(s, false);
        return acc;
      },
      {} as Record<AiStrategy, LLMProviderName>,
    );
    return {
      strategy: this.strategy,
      active: this.selectFor(this.strategy, false),
      providers: this.snapshotProviders(),
      selection,
      usage: this.metrics.snapshot().ai.byModel,
    };
  }
}

function score(p: AiProviderInfo): number {
  return p.qualityTier * 2 + p.speedTier - p.costTier;
}
