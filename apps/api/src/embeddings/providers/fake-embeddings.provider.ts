import type { EmbeddingsProvider } from '../embeddings-provider.interface';

const FAKE_DIMENSIONS = 768;

/**
 * Deterministic, dependency-free embeddings for local development and tests —
 * no API key, no network. It hashes tokens into a fixed-size vector (a hashing
 * bag-of-words) and L2-normalises, so identical text yields identical vectors
 * and texts sharing words land closer together. Not semantically meaningful;
 * good enough to exercise the ingestion + Qdrant + retrieval pipeline offline.
 */
export class FakeEmbeddingsProvider implements EmbeddingsProvider {
  readonly name = 'fake';
  readonly model = 'fake-hashing-bow';
  readonly dimensions = FAKE_DIMENSIONS;

  embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map((t) => this.embed(t)));
  }

  embedQuery(text: string): Promise<number[]> {
    return Promise.resolve(this.embed(text));
  }

  private embed(text: string): number[] {
    const vector = new Array<number>(FAKE_DIMENSIONS).fill(0);
    const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    for (const token of tokens) {
      const h = this.hash(token);
      const index = h % FAKE_DIMENSIONS;
      const sign = (h >>> 16) % 2 === 0 ? 1 : -1;
      vector[index] += sign;
    }
    return this.normalize(vector);
  }

  private hash(str: string): number {
    let h = 2166136261; // FNV-1a
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private normalize(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) {
      // Avoid a zero vector (Qdrant cosine distance is undefined for it).
      vector[0] = 1;
      return vector;
    }
    return vector.map((v) => v / norm);
  }
}
