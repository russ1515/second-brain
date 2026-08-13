import { Logger } from '@nestjs/common';
import {
  GoogleGenerativeAI,
  TaskType,
  type EmbedContentRequest,
} from '@google/generative-ai';
import type { EmbeddingsProvider } from '../embeddings-provider.interface';

/** The API accepts `outputDimensionality`, but the 0.21 SDK type omits it. */
type EmbedRequest = EmbedContentRequest & { outputDimensionality?: number };

/** We request 768-dim vectors from gemini-embedding-001 (default is 3072) to keep
 *  the Qdrant collection compact and consistent across providers. */
const REQUESTED_DIMENSIONS = 768;
/** Max concurrent embedContent calls (this model has no sync batch endpoint). */
const CONCURRENCY = 8;

/** Google Gemini implementation of the embeddings contract. */
export class GeminiEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = 'gemini';
  readonly dimensions = REQUESTED_DIMENSIONS;

  private readonly logger = new Logger(GeminiEmbeddingsProvider.name);
  private readonly client: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not set; embedding calls will fail until it is.',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    // gemini-embedding-001 exposes only single embedContent (no sync batch), so
    // we fan out with a bounded concurrency to stay within rate limits.
    return this.mapWithConcurrency(texts, CONCURRENCY, (text) =>
      this.embed(text, TaskType.RETRIEVAL_DOCUMENT),
    );
  }

  embedQuery(text: string): Promise<number[]> {
    return this.embed(text, TaskType.RETRIEVAL_QUERY);
  }

  private async embed(text: string, taskType: TaskType): Promise<number[]> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const request: EmbedRequest = {
      content: { role: 'user', parts: [{ text }] },
      taskType,
      outputDimensionality: REQUESTED_DIMENSIONS,
    };
    const result = await model.embedContent(request);
    return result.embedding.values;
  }

  /** Run `fn` over `items` with at most `limit` in flight, preserving order. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
      (async () => {
        while (next < items.length) {
          const current = next++;
          results[current] = await fn(items[current]);
        }
      })(),
    );
    await Promise.all(workers);
    return results;
  }
}
