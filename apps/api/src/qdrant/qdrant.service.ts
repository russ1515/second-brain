import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

/** A vector point to upsert. */
export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/** A single scored search hit. */
export interface VectorSearchHit {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

@Injectable()
export class QdrantService {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;

  constructor(private readonly config: ConfigService) {
    this.client = new QdrantClient({
      url: this.config.getOrThrow<string>('qdrant.url'),
      apiKey: this.config.get<string>('qdrant.apiKey'),
    });
  }

  /** Raw Qdrant client for feature modules (embeddings, retrieval). */
  get connection(): QdrantClient {
    return this.client;
  }

  /** Lightweight round-trip used by the health check. */
  async listCollections(): Promise<string[]> {
    const result = await this.client.getCollections();
    return result.collections.map((c) => c.name);
  }

  /** Create the collection (cosine distance) if it does not already exist. */
  async ensureCollection(name: string, dimensions: number): Promise<void> {
    const { exists } = await this.client.collectionExists(name);
    if (exists) {
      return;
    }
    await this.client.createCollection(name, {
      vectors: { size: dimensions, distance: 'Cosine' },
    });
    this.logger.log(`Created Qdrant collection "${name}" (dim=${dimensions}).`);
  }

  /** Upsert points, waiting for the write to be applied. */
  async upsert(name: string, points: VectorPoint[]): Promise<void> {
    if (points.length === 0) {
      return;
    }
    await this.client.upsert(name, { wait: true, points });
  }

  /** Delete every point belonging to a document. */
  async deleteByDocument(name: string, documentId: string): Promise<void> {
    await this.client.delete(name, {
      wait: true,
      filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
    });
  }

  /** Vector search, optionally scoped by a payload filter (e.g. per user). */
  async search(
    name: string,
    vector: number[],
    options: {
      limit: number;
      filter?: Record<string, unknown>;
      scoreThreshold?: number;
    },
  ): Promise<VectorSearchHit[]> {
    const results = await this.client.search(name, {
      vector,
      limit: options.limit,
      filter: options.filter,
      score_threshold: options.scoreThreshold,
      with_payload: true,
    });
    return results.map((r) => ({
      id: String(r.id),
      score: r.score,
      payload: (r.payload ?? {}) as Record<string, unknown>,
    }));
  }
}
