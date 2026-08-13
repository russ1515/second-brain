import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Document, DocumentSource } from '@prisma/client';
import type { DocumentDetail, DocumentSummary, Page } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  TextExtractionService,
  type UploadedFileLike,
} from './extraction/text-extraction.service';
import { IngestionService } from './ingestion/ingestion.service';
import { DocumentEnrichmentService } from './enrichment/document-enrichment.service';

const MAX_CONTENT_CHARS = 1_000_000; // ~1 MB of extracted text

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: TextExtractionService,
    private readonly ingestion: IngestionService,
    private readonly enrichment: DocumentEnrichmentService,
  ) {}

  /** Ingest pasted text/markdown. */
  createFromText(
    userId: string,
    input: { title: string; content: string },
  ): Promise<DocumentDetail> {
    return this.persist(userId, {
      title: input.title.trim(),
      content: input.content,
      source: 'text',
      sourceRef: null,
    });
  }

  /** Ingest an uploaded PDF / .txt / .md file. */
  async createFromFile(
    userId: string,
    file: UploadedFileLike,
    title?: string,
  ): Promise<DocumentDetail> {
    const extracted = await this.extraction.extractFromFile(file);
    return this.persist(userId, {
      title: (title?.trim() || extracted.title || file.originalname).trim(),
      content: extracted.text,
      source: 'file',
      sourceRef: file.originalname,
    });
  }

  /** Ingest a web page by URL. */
  async createFromUrl(
    userId: string,
    url: string,
    title?: string,
  ): Promise<DocumentDetail> {
    const extracted = await this.extraction.extractFromUrl(url);
    return this.persist(userId, {
      title: (title?.trim() || extracted.title || url).trim(),
      content: extracted.text,
      source: 'url',
      sourceRef: url,
    });
  }

  /** List the caller's documents (newest first, no full content). Trashed
   *  documents are excluded — they live only in the Smart Library's Trash. */
  async list(userId: string): Promise<DocumentSummary[]> {
    const docs = await this.prisma.document.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return docs.map((doc) => this.toSummary(doc));
  }

  /**
   * One page of the caller's documents (Sprint 10.1). Cursor-based on id so it
   * stays correct as the library grows; `nextCursor` is null on the last page.
   */
  async listPaged(userId: string, limit = 20, cursor?: string): Promise<Page<DocumentSummary>> {
    const take = Math.min(Math.max(Math.trunc(limit) || 20, 1), 100);
    const docs = await this.prisma.document.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1, // one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = docs.length > take;
    const page = hasMore ? docs.slice(0, take) : docs;
    return {
      items: page.map((doc) => this.toSummary(doc)),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Fetch one of the caller's documents, including content. */
  async get(userId: string, id: string): Promise<DocumentDetail> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      // Same response whether it doesn't exist or isn't yours — no id probing.
      throw new NotFoundException('Document not found.');
    }
    return this.toDetail(doc);
  }

  /** Delete one of the caller's documents (and its vectors). */
  async remove(userId: string, id: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    // Remove vectors first; Postgres chunk rows cascade with the document.
    await this.ingestion.purgeVectors(id);
    await this.prisma.document.delete({ where: { id } });
  }

  /** Re-run the embedding pipeline for a document (e.g. after a failure). */
  async reindex(userId: string, id: string): Promise<DocumentDetail> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    void this.ingestion.ingest(id);
    return this.get(userId, id);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async persist(
    userId: string,
    data: {
      title: string;
      content: string;
      source: DocumentSource;
      sourceRef: string | null;
    },
  ): Promise<DocumentDetail> {
    const content = data.content.trim();
    if (!data.title) {
      throw new BadRequestException('A title is required.');
    }
    if (!content) {
      throw new BadRequestException('No text content could be ingested.');
    }
    if (content.length > MAX_CONTENT_CHARS) {
      throw new PayloadTooLargeException(
        `Document exceeds the ${MAX_CONTENT_CHARS.toLocaleString()}-character limit.`,
      );
    }

    const doc = await this.prisma.document.create({
      data: {
        userId,
        title: data.title,
        source: data.source,
        sourceRef: data.sourceRef,
        content,
        charCount: content.length,
        status: 'pending',
      },
    });

    // Fire-and-forget embedding pipeline; it advances status and records errors
    // on the row itself, so a failure never breaks the create response.
    void this.ingestion.ingest(doc.id);
    // Fire-and-forget Smart-Library enrichment (summary/subject/language/…);
    // best-effort and independent of indexing — a failure leaves fields null.
    void this.enrichment.enrich(doc.id);

    return this.toDetail(doc);
  }

  private toSummary(doc: Document): DocumentSummary {
    return {
      id: doc.id,
      title: doc.title,
      source: doc.source,
      sourceRef: doc.sourceRef ?? undefined,
      charCount: doc.charCount,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private toDetail(doc: Document): DocumentDetail {
    return {
      ...this.toSummary(doc),
      content: doc.content,
      error: doc.error ?? undefined,
    };
  }
}
