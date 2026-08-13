import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMBEDDINGS_PROVIDER } from './embeddings.constants';
import type { EmbeddingsProvider } from './embeddings-provider.interface';
import { GeminiEmbeddingsProvider } from './providers/gemini-embeddings.provider';
import { FakeEmbeddingsProvider } from './providers/fake-embeddings.provider';
import { EmbeddingsService } from './embeddings.service';

/**
 * Binds the embeddings provider selected by EMBEDDINGS_PROVIDER. This factory is
 * the ONLY place that knows about concrete providers. `fake` needs no API key
 * and is deterministic — handy for offline dev and tests.
 */
const embeddingsProviderFactory: Provider = {
  provide: EMBEDDINGS_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmbeddingsProvider => {
    const provider = config.getOrThrow<string>('embeddings.provider');
    const model = config.getOrThrow<string>('embeddings.model');

    switch (provider) {
      case 'gemini':
        return new GeminiEmbeddingsProvider(
          config.get<string>('embeddings.geminiApiKey') ?? '',
          model,
        );
      case 'fake':
        return new FakeEmbeddingsProvider();
      default:
        throw new Error(
          `Embeddings provider "${provider}" is not wired yet. ` +
            `Implement EmbeddingsProvider and add a case in embeddings.module.ts.`,
        );
    }
  },
};

@Global()
@Module({
  providers: [embeddingsProviderFactory, EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
