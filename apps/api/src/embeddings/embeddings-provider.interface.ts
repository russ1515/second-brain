/**
 * Contract every embeddings provider must satisfy. Business code depends on this
 * interface only — never on a concrete SDK. Adding OpenAI/Ollama/etc. means
 * writing a new class and wiring it in embeddings.module.ts (mirrors the LLM
 * seam). Document and query embeddings are distinct calls because some providers
 * (e.g. Gemini) optimise them differently.
 */
export interface EmbeddingsProvider {
  readonly name: string;
  readonly model: string;
  /** Vector dimensionality — the Qdrant collection is created to match. */
  readonly dimensions: number;

  /** Embed passages for storage/retrieval. Returns one vector per input. */
  embedDocuments(texts: string[]): Promise<number[][]>;

  /** Embed a single search query. */
  embedQuery(text: string): Promise<number[]>;
}
