import { Injectable } from '@nestjs/common';
import type {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMImagePart,
  LLMMessage,
} from '@second-brain/shared';
import type { LLMProvider } from './llm-provider.interface';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { MetricsService } from '../monitoring/metrics.service';

/**
 * The single entry point business code uses to talk to an LLM.
 * It is provider-agnostic: the AI orchestrator (Sprint 10.6) picks the concrete
 * provider per the active strategy (quality / cost / speed), among the backends
 * that are actually usable. Every call is timed and recorded (Sprint 10.4) so the
 * monitoring dashboard and Prometheus see AI volume, latency and errors per model.
 */
@Injectable()
export class LlmService {
  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly metrics: MetricsService,
  ) {}

  get activeProvider(): string {
    return this.orchestrator.pickProvider().name;
  }

  /** Whether a vision-capable provider is usable. Check before offering scan. */
  get supportsVision(): boolean {
    return this.orchestrator.supportsVision;
  }

  generate(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    const provider = this.orchestrator.pickProvider();
    return this.instrument(provider, () => provider.generate(messages, options));
  }

  /** Only call when `supportsVision` is true. */
  readImages(
    images: LLMImagePart[],
    prompt: string,
    options?: LLMGenerateOptions,
  ): Promise<LLMGenerateResult> {
    const provider = this.orchestrator.pickProvider({ needsVision: true });
    if (!provider.readImages) {
      throw new Error(`LLM provider "${provider.name}" cannot read images.`);
    }
    const call = provider.readImages;
    return this.instrument(provider, () => call.call(provider, images, prompt, options));
  }

  /** Time a provider call and record it against the provider that served it. */
  private async instrument(
    provider: LLMProvider,
    call: () => Promise<LLMGenerateResult>,
  ): Promise<LLMGenerateResult> {
    const start = Date.now();
    try {
      const result = await call();
      this.metrics.recordAiCall(provider.name, Date.now() - start, true);
      return result;
    } catch (err) {
      this.metrics.recordAiCall(provider.name, Date.now() - start, false);
      this.metrics.captureError(err, 'ai');
      throw err;
    }
  }
}
