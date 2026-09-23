import { Inject, Injectable, Optional } from '@nestjs/common';
import { EMBEDDINGS_PROVIDER } from './embeddings.constants';
import type { EmbeddingsProvider } from './embeddings-provider.interface';
import { ProviderMeteringService } from '../usage/provider-metering.service';

/**
 * The single entry point business code uses to create embeddings.
 * Provider-agnostic: whatever is bound to EMBEDDINGS_PROVIDER handles the call.
 */
@Injectable()
export class EmbeddingsService {
  constructor(
    @Inject(EMBEDDINGS_PROVIDER) private readonly provider: EmbeddingsProvider,
    @Optional() private readonly metering?: ProviderMeteringService,
  ) {}

  get activeProvider(): string {
    return this.provider.name;
  }

  /** Vector dimensionality of the active provider. */
  get dimensions(): number {
    return this.provider.dimensions;
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.metering?.executeWithAttempts(
      {
        provider: this.provider.name, model: this.provider.model, feature: 'DOCUMENT_EMBEDDING',
        resource: 'EMBEDDING_UNITS', units: Math.max(1, texts.length),
        metadata: { embeddingInputs: texts.length, providerUsage: 'NOT_RETURNED_BY_CURRENT_CONTRACT' },
        // The current provider seam exposes vectors, not billable token usage.
        // We preserve the observed input count as an explicit ESTIMATED metric.
        measure: (result) => ({
          embeddingUnits: Array.isArray(result) ? result.length : texts.length,
          measurementSource: 'OBSERVED',
        }),
      },
      (attempts) => attempts.attempt(() => this.provider.embedDocuments(texts)),
    ) ?? this.provider.embedDocuments(texts);
  }

  embedQuery(text: string): Promise<number[]> {
    return this.metering?.executeWithAttempts(
      {
        provider: this.provider.name, model: this.provider.model, feature: 'DOCUMENT_RAG',
        resource: 'EMBEDDING_UNITS', units: 1,
        metadata: { providerUsage: 'NOT_RETURNED_BY_CURRENT_CONTRACT' },
        measure: () => ({ embeddingUnits: 1, measurementSource: 'OBSERVED' }),
      },
      (attempts) => attempts.attempt(() => this.provider.embedQuery(text)),
    ) ?? this.provider.embedQuery(text);
  }
}
