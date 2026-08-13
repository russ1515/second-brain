import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDINGS_PROVIDER } from './embeddings.constants';
import type { EmbeddingsProvider } from './embeddings-provider.interface';

/**
 * The single entry point business code uses to create embeddings.
 * Provider-agnostic: whatever is bound to EMBEDDINGS_PROVIDER handles the call.
 */
@Injectable()
export class EmbeddingsService {
  constructor(
    @Inject(EMBEDDINGS_PROVIDER) private readonly provider: EmbeddingsProvider,
  ) {}

  get activeProvider(): string {
    return this.provider.name;
  }

  /** Vector dimensionality of the active provider. */
  get dimensions(): number {
    return this.provider.dimensions;
  }

  embedDocuments(texts: string[]): Promise<number[][]> {
    return this.provider.embedDocuments(texts);
  }

  embedQuery(text: string): Promise<number[]> {
    return this.provider.embedQuery(text);
  }
}
