import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AskResponse, Citation, RagScope } from '@second-brain/shared';
import { LlmService } from '../../llm/llm.service';
import { RetrievalService } from '../retrieval/retrieval.service';

/** How much of a source passage to echo back as a citation snippet. */
const CITATION_SNIPPET_CHARS = 320;

const DEFAULT_CONTEXT_LIMIT = 5;

const SYSTEM_PROMPT = [
  'You are Second Brain, a study assistant.',
  "Answer the user's question using ONLY the numbered context passages provided.",
  'If the answer is not contained in them, say you do not know — never use outside',
  'knowledge and never guess. Cite the passages you rely on inline using their [n]',
  'markers. Be concise and factual.',
].join(' ');

/** Retrieval-augmented generation: ground an LLM answer in the user's documents. */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly retrieval: RetrievalService,
    private readonly llm: LlmService,
  ) {}

  async ask(
    userId: string,
    question: string,
    options: { limit?: number; minScore?: number } & RagScope = {},
  ): Promise<AskResponse> {
    // Adaptive scope (Sprint 6.4): narrow retrieval to a document / collection /
    // subject, or the whole library when no scope is given.
    const documentIds = await this.retrieval.resolveScope(userId, {
      documentId: options.documentId,
      collectionId: options.collectionId,
      subject: options.subject,
    });

    const { results } = await this.retrieval.search(userId, question, {
      limit: options.limit ?? DEFAULT_CONTEXT_LIMIT,
      minScore: options.minScore,
      ...(documentIds ? { documentIds } : {}),
    });

    // No relevant context → refuse to answer rather than hallucinate.
    if (results.length === 0) {
      return {
        answer:
          "I couldn't find anything in your documents to answer that question.",
        citations: [],
        usedContext: false,
      };
    }

    const context = results
      .map((r, i) => `[${i + 1}] (from "${r.documentTitle}")\n${r.content}`)
      .join('\n\n');

    let result;
    try {
      result = await this.llm.generate(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` },
        ],
        { temperature: 0.2 },
      );
    } catch (error) {
      // Upstream LLM failure (rate limit, quota, outage) → clean 503, not a 500.
      this.logger.error(`LLM generation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }

    const citations: Citation[] = results.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkIndex: r.chunkIndex,
      score: r.score,
      content: r.content.slice(0, CITATION_SNIPPET_CHARS),
    }));

    return { answer: result.text.trim(), citations, usedContext: true };
  }
}
