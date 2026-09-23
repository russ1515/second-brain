import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type {
  LLMGenerateOptions,
  LLMGenerateResult,
  LLMImagePart,
  LLMMessage,
} from '@second-brain/shared';
import type { LLMProvider } from './llm-provider.interface';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { MetricsService } from '../monitoring/metrics.service';
import { ProviderMeteringService, type ProviderAttemptRunner } from '../usage/provider-metering.service';
import type { QuotaResource } from '@prisma/client';

/**
 * The single entry point business code uses to talk to an LLM.
 * It is provider-agnostic: the AI orchestrator (Sprint 10.6) picks the concrete
 * provider per the active strategy (quality / cost / speed), among the backends
 * that are actually usable. Every call is timed and recorded (Sprint 10.4) so the
 * monitoring dashboard and Prometheus see AI volume, latency and errors per model.
 */
@Injectable()
export class LlmService {
  private readonly inFlight = new Map<string, Promise<LLMGenerateResult>>();
  private readonly circuits = new Map<
    string,
    { consecutiveFailures: number; openUntil: number }
  >();

  constructor(
    private readonly orchestrator: AiOrchestratorService,
    private readonly metrics: MetricsService,
    @Optional() private readonly metering?: ProviderMeteringService,
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
    const bounded = this.boundedOptions(options, false);
    const key = this.requestKey(provider, messages, bounded);
    const operation = bounded.operation ?? 'general';
    return this.deduplicate(key, () => this.metering?.executeWithAttempts(
      {
        provider: provider.name, model: bounded.model, feature: this.costFeatureFor(operation),
        resource: this.resourceFor(operation), units: 1, metadata: { operation },
        measure: (result) => this.llmMeasurement(result),
      },
      (attempts) => this.execute(provider, operation, () => provider.generate(messages, bounded), attempts),
    ) ?? this.execute(provider, operation, () => provider.generate(messages, bounded)));
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
    const bounded = this.boundedOptions(options, true);
    const key = this.requestKey(provider, [{ role: 'user', content: prompt }], bounded, images);
    const operation = bounded.operation ?? 'vision';
    return this.deduplicate(key, () => this.metering?.executeWithAttempts(
      {
        provider: provider.name, model: bounded.model, feature: this.costFeatureFor(operation),
        resource: this.resourceFor(operation), units: Math.max(1, images.length), metadata: { images: images.length, operation },
        measure: (result) => ({ ...this.llmMeasurement(result), ocrPages: images.length, visionCalls: 1, measurementSource: 'OBSERVED' }),
      },
      (attempts) => this.execute(provider, operation, () => call.call(provider, images, prompt, bounded), attempts),
    ) ?? this.execute(provider, operation, () => call.call(provider, images, prompt, bounded)));
  }

  /**
   * Execute one logical request under a small, explicit budget. Only short-lived
   * provider overloads are retried; timeouts and exhausted quotas are not, since
   * retrying those would multiply cost while the original request may still run.
   */
  private async execute(
    provider: LLMProvider,
    operation: string,
    call: () => Promise<LLMGenerateResult>,
    attempts?: ProviderAttemptRunner,
  ): Promise<LLMGenerateResult> {
    this.assertCircuitClosed(provider.name);
    const policy = this.policy(operation);
    let lastError: unknown;

    for (let attempt = 0; attempt <= policy.retries; attempt += 1) {
      try {
        const invoke = () => this.withTimeout(this.instrument(provider, call), policy.timeoutMs);
        const result = attempts
          ? await attempts.attempt(invoke, { provider: provider.name })
          : await invoke();
        this.circuits.delete(provider.name);
        return result;
      } catch (error) {
        lastError = error;
        const failure = this.classify(error);
        this.recordFailure(provider.name, failure);
        if (!failure.retryable || attempt >= policy.retries) break;
        await this.delay(policy.backoffMs * 2 ** attempt);
      }
    }

    const detail = this.classify(lastError);
    throw new ServiceUnavailableException({
      code: detail.code,
      message:
        'The AI provider is temporarily unavailable. Please retry in a moment.',
      retryable: true,
    });
  }

  private boundedOptions(
    options: LLMGenerateOptions | undefined,
    vision: boolean,
  ): LLMGenerateOptions {
    const operation = options?.operation ?? (vision ? 'vision' : 'general');
    const cap = this.policy(operation).maxOutputTokens;
    return {
      ...options,
      operation,
      maxOutputTokens: Math.min(options?.maxOutputTokens ?? cap, cap),
    };
  }

  private policy(operation: string): {
    timeoutMs: number;
    retries: number;
    backoffMs: number;
    maxOutputTokens: number;
  } {
    if (operation === 'classification') {
      return { timeoutMs: 8_000, retries: 0, backoffMs: 250, maxOutputTokens: 96 };
    }
    if (operation === 'document-metadata') {
      return { timeoutMs: 12_000, retries: 0, backoffMs: 250, maxOutputTokens: 600 };
    }
    if (operation === 'concept-extraction' || operation === 'knowledge-linking') {
      return { timeoutMs: 18_000, retries: 0, backoffMs: 250, maxOutputTokens: 1_500 };
    }
    if (operation === 'tutor') {
      return { timeoutMs: 30_000, retries: 1, backoffMs: 500, maxOutputTokens: 1_500 };
    }
    if (operation === 'research' || operation === 'workspace-assistant') {
      return { timeoutMs: 30_000, retries: 1, backoffMs: 500, maxOutputTokens: 2_000 };
    }
    if (operation === 'deep-research') {
      return { timeoutMs: 45_000, retries: 0, backoffMs: 750, maxOutputTokens: 3_000 };
    }
    if (operation === 'ocr') {
      return { timeoutMs: 60_000, retries: 0, backoffMs: 750, maxOutputTokens: 8_192 };
    }
    if (operation === 'vision') {
      return { timeoutMs: 45_000, retries: 1, backoffMs: 750, maxOutputTokens: 2_500 };
    }
    if (
      operation === 'lesson' ||
      operation === 'homework' ||
      operation === 'study-resource' ||
      operation === 'language-content'
    ) {
      return { timeoutMs: 35_000, retries: 1, backoffMs: 500, maxOutputTokens: 3_000 };
    }
    if (operation === 'assessment' || operation === 'grading') {
      return { timeoutMs: 25_000, retries: 1, backoffMs: 500, maxOutputTokens: 2_000 };
    }
    return { timeoutMs: 25_000, retries: 1, backoffMs: 500, maxOutputTokens: 2_000 };
  }

  private deduplicate(
    key: string,
    run: () => Promise<LLMGenerateResult>,
  ): Promise<LLMGenerateResult> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const request = run().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, request);
    return request;
  }

  private requestKey(
    provider: LLMProvider,
    messages: LLMMessage[],
    options: LLMGenerateOptions,
    images: LLMImagePart[] = [],
  ): string {
    const imageFingerprints = images.map((image) => ({
      mimeType: image.mimeType,
      digest: createHash('sha256').update(image.data).digest('hex'),
    }));
    return createHash('sha256')
      .update(JSON.stringify([provider.name, messages, options, imageFingerprints]))
      .digest('hex');
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new LlmTimeoutError()), timeoutMs);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private assertCircuitClosed(provider: string): void {
    const circuit = this.circuits.get(provider);
    if (!circuit || circuit.openUntil <= Date.now()) return;
    throw new ServiceUnavailableException({
      code: 'AI_CIRCUIT_OPEN',
      message: 'The AI provider is temporarily unavailable. Please retry shortly.',
      retryable: true,
      retryAfterSeconds: Math.ceil((circuit.openUntil - Date.now()) / 1_000),
    });
  }

  private recordFailure(
    provider: string,
    failure: { transient: boolean; quota: boolean },
  ): void {
    if (!failure.transient) return;
    const current = this.circuits.get(provider) ?? {
      consecutiveFailures: 0,
      openUntil: 0,
    };
    const consecutiveFailures = current.consecutiveFailures + 1;
    const shouldOpen = failure.quota || consecutiveFailures >= 3;
    this.circuits.set(provider, {
      consecutiveFailures,
      openUntil: shouldOpen
        ? Date.now() + (failure.quota ? 5 * 60_000 : 60_000)
        : 0,
    });
  }

  private classify(error: unknown): {
    code: string;
    transient: boolean;
    retryable: boolean;
    quota: boolean;
  } {
    if (error instanceof LlmTimeoutError) {
      return { code: 'AI_TIMEOUT', transient: true, retryable: false, quota: false };
    }
    const candidate = error as {
      status?: number;
      statusCode?: number;
      code?: number | string;
      message?: string;
    };
    const status = Number(candidate?.status ?? candidate?.statusCode ?? candidate?.code);
    const message = String(candidate?.message ?? error ?? '').toLowerCase();
    const quota =
      status === 429 &&
      /(quota|resource[_ -]?exhausted|daily|per day|billing)/i.test(message);
    const overload = status === 429 || status === 503 || status >= 500;
    return {
      code: quota
        ? 'AI_QUOTA_EXHAUSTED'
        : status === 429
          ? 'AI_RATE_LIMITED'
          : status === 503
            ? 'AI_PROVIDER_UNAVAILABLE'
            : 'AI_REQUEST_FAILED',
      transient: overload,
      retryable: overload && !quota,
      quota,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resourceFor(operation: string): QuotaResource {
    if (operation === 'ocr' || operation === 'vision') return 'OCR_PAGES';
    if (operation === 'deep-research') return 'DEEP_RESEARCH';
    if (operation === 'research') return 'WEB_SEARCH';
    if (operation === 'workspace-assistant') return 'ACADEMIC_AI';
    return 'AI_TEXT';
  }

  /** Stable Cost Center feature keys; raw operation names stay only in metadata. */
  private costFeatureFor(operation: string): string {
    if (operation === 'tutor') return 'TUTOR_TEXT';
    if (operation === 'language-content' || operation === 'language-writing' || operation === 'language-skills' || operation === 'language-grading' || operation === 'language-tutor' || operation === 'conversation') return 'LANGUAGE_TEXT';
    if (operation === 'research') return 'FREE_SEARCH';
    if (operation === 'deep-research') return 'DEEP_RESEARCH';
    if (operation === 'workspace-assistant') return 'ACADEMIC_WORKSPACE';
    if (operation === 'ocr' || operation === 'vision') return 'DOCUMENT_OCR';
    if (operation === 'study-resource' || operation === 'concept-extraction' || operation === 'knowledge-linking' || operation === 'rag' || operation === 'document-workspace-tutor') return 'DOCUMENT_RAG';
    if (operation === 'quiz') return 'QUIZ_GENERATION';
    if (operation === 'flashcards') return 'FLASHCARD_GENERATION';
    return `LLM_${operation.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 80)}`;
  }

  private llmMeasurement(result: unknown): {
    model?: string;
    inputTokens?: number;
    cachedInputTokens?: number;
    outputTokens?: number;
  } {
    const measured = result as LLMGenerateResult;
    return {
      model: measured?.model,
      inputTokens: measured?.usage?.inputTokens,
      cachedInputTokens: measured?.usage?.cachedTokens,
      outputTokens: measured?.usage?.outputTokens,
    };
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

class LlmTimeoutError extends Error {
  constructor() {
    super('LLM request timed out');
    this.name = 'LlmTimeoutError';
  }
}
