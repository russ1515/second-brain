import { Injectable } from '@nestjs/common';
import type { RagScope, SearchResponse, SearchResultItem } from '@second-brain/shared';
import { EmbeddingsService } from '../../embeddings/embeddings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QdrantService } from '../../qdrant/qdrant.service';
import { CHUNK_COLLECTION } from '../ingestion/ingestion.service';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 50;

/** Semantic retrieval over a user's own document chunks. */
@Injectable()
export class RetrievalService {
  constructor(
    private readonly embeddings: EmbeddingsService,
    private readonly qdrant: QdrantService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve a RAG scope to the concrete document ids it covers (Sprint 6.4).
   * Returns `null` for "whole library" (no restriction), or a possibly-empty
   * array when a document / collection / subject was chosen. Trashed documents
   * are never in scope. Precedence: documentId > collectionId > subject.
   */
  async resolveScope(userId: string, scope?: RagScope): Promise<string[] | null> {
    if (!scope) return null;
    if (scope.documentId) return [scope.documentId];
    const where = scope.collectionId
      ? { userId, deletedAt: null, collectionId: scope.collectionId }
      : scope.subject
        ? { userId, deletedAt: null, subject: scope.subject }
        : null;
    if (!where) return null;
    const docs = await this.prisma.document.findMany({
      where,
      select: { id: true },
    });
    return docs.map((d) => d.id);
  }

  async search(
    userId: string,
    query: string,
    options: { limit?: number; minScore?: number; documentIds?: string[] } = {},
  ): Promise<SearchResponse> {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

    // A scope that resolved to no documents can't match anything — skip the
    // vector call and return empty (the RAG layer then refuses honestly).
    if (options.documentIds && options.documentIds.length === 0) {
      return { query, results: [] };
    }

    const vector = await this.embeddings.embedQuery(query);

    // Hard isolation: only ever match the caller's own vectors. When a scope is
    // given, also constrain to those documents.
    const must: Record<string, unknown>[] = [
      { key: 'userId', match: { value: userId } },
    ];
    if (options.documentIds) {
      must.push({ key: 'documentId', match: { any: options.documentIds } });
    }

    const hits = await this.qdrant.search(CHUNK_COLLECTION, vector, {
      limit,
      filter: { must },
      scoreThreshold: options.minScore,
    });

    // Resolve document titles in one query (also re-checks ownership in Postgres).
    const documentIds = [...new Set(hits.map((h) => String(h.payload.documentId)))];
    const docs = await this.prisma.document.findMany({
      where: { id: { in: documentIds }, userId },
      select: { id: true, title: true },
    });
    const titleById = new Map(docs.map((d) => [d.id, d.title]));

    const results: SearchResultItem[] = hits
      .filter((h) => titleById.has(String(h.payload.documentId)))
      .map((h) => ({
        documentId: String(h.payload.documentId),
        documentTitle: titleById.get(String(h.payload.documentId)) ?? '',
        chunkIndex: Number(h.payload.chunkIndex),
        content: String(h.payload.content),
        score: h.score,
      }));

    return { query, results };
  }
}
