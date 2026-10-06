import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Document, DocumentSource } from '@prisma/client';
import type {
  DocumentContentType,
  DocumentDetail,
  DocumentPage,
  DocumentSummary,
  Page,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  TextExtractionService,
  type UploadedFileLike,
} from './extraction/text-extraction.service';
import { IngestionService } from './ingestion/ingestion.service';
import { DocumentEnrichmentService } from './enrichment/document-enrichment.service';
import { PrivateMediaService } from '../media/private-media.service';
import { accountDataLockKey } from '../common/account-data-lock';

const MAX_CONTENT_CHARS = 1_000_000; // ~1 MB of extracted text

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extraction: TextExtractionService,
    private readonly ingestion: IngestionService,
    private readonly enrichment: DocumentEnrichmentService,
    private readonly privateMedia: PrivateMediaService,
  ) {}

  /** Ingest pasted text/markdown. */
  createFromText(
    userId: string,
    input: {
      title: string;
      content: string;
      sourceRef?: string | null;
      contentType?: 'NOTE' | 'LESSON_AI';
    },
  ): Promise<DocumentDetail> {
    return this.persist(userId, {
      title: input.title.trim(),
      content: input.content,
      source: 'text',
      sourceRef: input.sourceRef ?? null,
      contentType: input.contentType ?? 'NOTE',
    });
  }

  /** Resolve a durable ingestion idempotency marker for this owner only. */
  async findBySourceRef(userId: string, sourceRef: string): Promise<DocumentDetail | null> {
    const doc = await this.prisma.document.findFirst({
      where: { userId, sourceRef, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return doc ? this.toDetail(doc) : null;
  }

  /** Create the durable shell before a potentially billable vision call. A
   * lost HTTP response can then be reconciled by sourceRef without a second
   * provider call. */
  async beginScan(
    userId: string,
    title: string | undefined,
    sourceRef: string,
    pageCount = 1,
    metadata: {
      subject?: string;
      language?: string;
      collectionId?: string;
      contentType?: 'PHOTO' | 'SCAN' | 'NOTEBOOK';
    } = {},
  ): Promise<{ document: DocumentDetail; created: boolean }> {
    // The in-process coalescer in ScanService only protects one replica. Keep
    // creation safe across API replicas without a schema migration by taking a
    // transaction-scoped PostgreSQL advisory lock on this owner/idempotency key.
    // The lock is released automatically on commit/rollback.
    return this.prisma.$transaction(async (tx) => {
      const lockKey = `document-scan:${userId}:${sourceRef}`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

      const existing = await tx.document.findFirst({
        where: { userId, sourceRef, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) return { document: this.toDetail(existing), created: false };

      let collectionId: string | null = null;
      if (metadata.collectionId) {
        const collection = await tx.collection.findFirst({
          where: { id: metadata.collectionId, userId }, select: { id: true },
        });
        if (!collection) throw new NotFoundException('Collection not found.');
        collectionId = collection.id;
      }
      const requestedSubject = metadata.subject?.trim().replace(/\s+/g, ' ').slice(0, 120) || null;
      const existingSubject = requestedSubject
        ? await tx.document.findFirst({
            where: {
              userId,
              deletedAt: null,
              subject: { equals: requestedSubject, mode: 'insensitive' },
            },
            select: { subject: true },
          })
        : null;

      const doc = await tx.document.create({
        data: {
          userId,
        title: (title?.trim() || new Date().toISOString().slice(0, 16).replace('T', ' ')).slice(0, 300),
          source: 'text',
          sourceRef,
          content: '',
          charCount: 0,
        status: 'processing',
        stage: 'capturing',
          contentType: metadata.contentType
            ?? (pageCount > 1 ? 'NOTEBOOK' : 'SCAN'),
          mimeType: 'image/jpeg',
          pageCount,
          subject: existingSubject?.subject ?? requestedSubject,
          language: metadata.language?.trim().slice(0, 80) || null,
          collectionId,
        },
      });
      return { document: this.toDetail(doc), created: true };
    });
  }

  async markScanCaptured(userId: string, id: string): Promise<DocumentDetail> {
    await this.prisma.document.updateMany({
      where: { id, userId, deletedAt: null, status: 'processing', charCount: 0 },
      data: { status: 'pending', stage: null, error: null },
    });
    return this.get(userId, id);
  }

  /** Atomically claim one captured scan for OCR. Only one replica wins. */
  async startScanReading(
    userId: string,
    id: string,
  ): Promise<{ document: DocumentDetail; started: boolean }> {
    const claimed = await this.prisma.document.updateMany({
      where: { id, userId, deletedAt: null, status: 'pending', charCount: 0 },
      data: { status: 'processing', stage: 'reading', error: null },
    });
    return {
      document: await this.get(userId, id),
      started: claimed.count === 1,
    };
  }

  /** Atomically claim a captured scan for an explicit OCR retry. This is
   * deliberately separate from reindex: the document has no text to embed yet. */
  async startScanRetry(
    userId: string,
    id: string,
  ): Promise<{ document: DocumentDetail; started: boolean }> {
    const claimed = await this.prisma.document.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
        status: { in: ['pending', 'partial', 'failed'] },
        sourceRef: { startsWith: 'scan:' },
      },
      data: { status: 'processing', stage: 'reading', error: null },
    });
    return {
      document: await this.get(userId, id),
      started: claimed.count === 1,
    };
  }

  /** Recover a worker that died after claiming OCR. Only genuinely stale,
   * empty scan reads are moved to failed; a live worker cannot be displaced. */
  async failStaleScanReading(
    userId: string,
    id: string,
    staleBefore: Date,
  ): Promise<boolean> {
    const failed = await this.prisma.document.updateMany({
      where: {
        id,
        userId,
        deletedAt: null,
        status: 'processing',
        stage: 'reading',
        charCount: 0,
        sourceRef: { startsWith: 'scan:' },
        updatedAt: { lte: staleBefore },
      },
      data: {
        status: 'failed',
        stage: null,
        error: 'SCAN_READING_INTERRUPTED',
      },
    });
    return failed.count === 1;
  }

  async completeScan(
    userId: string,
    id: string,
    input: { title: string; content: string },
  ): Promise<DocumentDetail> {
    const existing = await this.get(userId, id);
    if (existing.status !== 'processing') return existing;
    const content = input.content.trim();
    if (!input.title.trim()) throw new BadRequestException('A title is required.');
    if (!content) throw new BadRequestException('No text content could be ingested.');
    if (content.length > MAX_CONTENT_CHARS) {
      throw new PayloadTooLargeException(
        `Document exceeds the ${MAX_CONTENT_CHARS.toLocaleString()}-character limit.`,
      );
    }
    const doc = await this.prisma.document.update({
      where: { id },
      data: {
        title: input.title.trim().slice(0, 300),
        content,
        charCount: content.length,
        status: 'pending',
        stage: null,
        error: null,
      },
    });
    void this.ingestion.ingest(doc.id);
    void this.enrichment.enrich(doc.id);
    return this.toDetail(doc);
  }

  /** Persist page identity/order independently from private image bytes. */
  async recordScanPages(
    userId: string,
    documentId: string,
    pages: ReadonlyArray<{ originalName?: string; rotation?: number }>,
  ): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!document) throw new NotFoundException('Document not found.');
    await this.prisma.$transaction(async (tx) => {
      await tx.documentPage.deleteMany({ where: { documentId } });
      await tx.documentPage.createMany({
        data: pages.map((page, index) => ({
          documentId,
          pageNumber: index + 1,
          position: index,
          storageName: `${String(index + 1).padStart(3, '0')}.jpg`,
          originalName: page.originalName?.slice(0, 300) ?? null,
          rotation: page.rotation ?? 0,
          ocrStatus: 'PENDING',
        })),
      });
      await tx.document.update({
        where: { id: documentId },
        data: {
          pageCount: pages.length,
          // An explicit single-photo classification remains stable. Any
          // multi-page capture is a notebook regardless of its entry point.
          contentType: pages.length > 1 ? 'NOTEBOOK' : undefined,
        },
      });
    });
  }

  async scanPages(userId: string, documentId: string): Promise<DocumentPage[]> {
    await this.get(userId, documentId);
    const pages = await this.prisma.documentPage.findMany({
      where: { documentId },
      orderBy: [{ position: 'asc' }, { pageNumber: 'asc' }],
    });
    return pages.map((page) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      position: page.position,
      mimeType: page.mimeType,
      originalName: page.originalName,
      rotation: page.rotation,
      ocrStatus: page.ocrStatus as DocumentPage['ocrStatus'],
      ocrText: page.ocrText,
      ocrError: page.ocrError,
    }));
  }

  async updatePageOcr(
    documentId: string,
    pageNumber: number,
    input: { status: 'PROCESSING' | 'READY' | 'FAILED'; text?: string; error?: string },
  ): Promise<void> {
    await this.prisma.documentPage.update({
      where: { documentId_pageNumber: { documentId, pageNumber } },
      data: {
        ocrStatus: input.status,
        ocrText: input.text ?? (input.status === 'READY' ? '' : undefined),
        ocrError: input.error ?? null,
      },
    });
  }

  async reorderPages(userId: string, documentId: string, pageIds: string[]): Promise<DocumentPage[]> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!document) throw new NotFoundException('Document not found.');
    const existing = await this.prisma.documentPage.findMany({
      where: { documentId }, select: { id: true },
    });
    const unique = [...new Set(pageIds)];
    if (unique.length !== existing.length || existing.some((page) => !unique.includes(page.id))) {
      throw new BadRequestException('Page order must contain every page exactly once.');
    }
    await this.prisma.$transaction(unique.map((id, position) =>
      this.prisma.documentPage.update({ where: { id }, data: { position } }),
    ));
    return this.scanPages(userId, documentId);
  }

  async getOriginal(userId: string, id: string) {
    await this.get(userId, id);
    return this.privateMedia.getDocumentOriginal(userId, id);
  }

  async getPageMedia(userId: string, documentId: string, pageId: string) {
    const page = await this.prisma.documentPage.findFirst({
      where: { id: pageId, documentId, document: { userId } },
      select: { storageName: true },
    });
    if (!page) throw new NotFoundException('Scan page not found.');
    return this.privateMedia.getScanPage(userId, documentId, page.storageName);
  }

  async failScan(userId: string, id: string, error = 'SCAN_OCR_FAILED'): Promise<void> {
    const readyPages = await this.prisma.documentPage.count({
      where: { documentId: id, ocrStatus: 'READY' },
    });
    await this.prisma.document.updateMany({
      where: { id, userId, status: 'processing' },
      data: {
        status: readyPages > 0 ? 'partial' : 'failed',
        stage: null,
        error: readyPages > 0 ? 'OCR_PARTIAL' : error,
      },
    });
  }

  /** Ingest an uploaded PDF / .txt / .md file. */
  async createFromFile(
    userId: string,
    file: UploadedFileLike,
    title?: string,
    allowDuplicate = false,
  ): Promise<DocumentDetail> {
    const fingerprint = createHash('sha256').update(file.buffer).digest('hex');
    if (!allowDuplicate) {
      const duplicate = await this.prisma.document.findFirst({
        where: { userId, fingerprint, deletedAt: null },
        select: { id: true, title: true },
      });
      if (duplicate) {
        throw new ConflictException({
          code: 'DUPLICATE_DOCUMENT',
          message: 'This exact file is already in the Library.',
          existingDocumentId: duplicate.id,
        });
      }
    }
    // Create the durable shell and persist the original before parsing. A bad
    // PDF or an API restart can therefore never make the learner's upload
    // disappear; extraction is explicitly retryable from the saved bytes.
    const doc = await this.prisma.document.create({
      data: {
        userId,
        title: (title?.trim() || file.originalname).slice(0, 300),
        source: 'file',
        sourceRef: file.originalname,
        content: '',
        charCount: 0,
        status: 'processing',
        stage: 'reading',
        contentType: file.mimetype === 'application/pdf' ? 'PDF' : 'DOCUMENT',
        mimeType: file.mimetype,
        sizeBytes: file.size || file.buffer.length,
        fingerprint,
      },
    });
    try {
      await this.privateMedia.putDocumentOriginal(userId, doc.id, file.buffer);
    } catch {
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'failed', stage: null, error: 'ORIGINAL_STORAGE_FAILED' },
      });
      throw new ServiceUnavailableException({
        code: 'ORIGINAL_STORAGE_FAILED',
        message: 'The original file could not be saved safely.',
      });
    }
    return this.extractStoredFile(userId, doc.id, title);
  }

  /** Retry parsing from the private original without asking the learner to
   * upload it again. This does not duplicate the document or its storage. */
  async retryFileExtraction(userId: string, id: string): Promise<DocumentDetail> {
    const document = await this.prisma.document.findFirst({
      where: { id, userId, deletedAt: null, source: 'file' },
    });
    if (!document) throw new NotFoundException('Document not found.');
    await this.prisma.document.update({
      where: { id },
      data: { status: 'processing', stage: 'reading', error: null },
    });
    return this.extractStoredFile(userId, id, document.title);
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
    // Phase 1 commits the deletion barrier. Ingestion takes the same lock and
    // requires deletedAt=null, so no late worker can recreate vectors after
    // this transaction. A cleanup failure leaves a hidden row safe to retry.
    await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const owned = await tx.document.findFirst({
        where: { id, userId },
        select: { id: true, deletedAt: true },
      });
      if (!owned) {
        throw new NotFoundException('Document not found.');
      }
      await tx.document.update({
        where: { id },
        data: {
          deletedAt: owned.deletedAt ?? new Date(),
          status: 'processing',
          stage: 'deleting',
          error: null,
        },
      });
    }, { timeout: 60_000 });

    // Phase 2 keeps restore and ingestion serialized while destructive cleanup
    // runs. The SQL hard delete uses the regular client and commits before the
    // private-media tombstone is purged; this lock transaction holds no row
    // mutation that could roll that deletion back.
    await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const staged = await tx.document.findFirst({
        where: { id, userId, deletedAt: { not: null }, stage: 'deleting' },
        select: { id: true },
      });
      if (!staged) {
        throw new ConflictException('Document deletion is no longer staged.');
      }
      await this.ingestion.purgeVectors(id);
      await this.privateMedia.deleteScanPagesAnd(userId, id, async () => {
        await this.prisma.document.delete({ where: { id } });
      });
    }, { timeout: 60_000 });
  }

  /** Re-run the embedding pipeline for a document (e.g. after a failure). */
  async reindex(userId: string, id: string): Promise<DocumentDetail> {
    const doc = await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const owned = await tx.document.findFirst({
        where: {
          id,
          userId,
          deletedAt: null,
          user: { accountStatus: 'active' },
        },
      });
      if (!owned) throw new NotFoundException('Document not found.');
      return owned;
    });
    // Reindex only transforms existing text into chunks/vectors. A captured
    // scan whose OCR failed has no text and must use the explicit scan retry;
    // otherwise the ingestion pipeline could honestly process zero chunks but
    // incorrectly finish the empty shell as READY.
    if (doc.charCount <= 0 || !doc.content.trim()) {
      if (doc.sourceRef?.startsWith('scan:')) {
        throw new ConflictException({
          code: 'SCAN_OCR_RETRY_REQUIRED',
          message: 'This scan has no extracted text. Retry scan reading instead.',
        });
      }
      throw new ConflictException({
        code: 'DOCUMENT_CONTENT_REQUIRED',
        message: 'This document has no extracted text to reindex.',
      });
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
      contentType?: DocumentContentType;
      mimeType?: string | null;
      sizeBytes?: number | null;
      fingerprint?: string | null;
      original?: Buffer;
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
        contentType: data.contentType ?? (data.source === 'text' ? 'NOTE' : 'DOCUMENT'),
        mimeType: data.mimeType ?? null,
        sizeBytes: data.sizeBytes ?? null,
        fingerprint: data.fingerprint ?? null,
      },
    });

    if (data.original) {
      try {
        await this.privateMedia.putDocumentOriginal(userId, doc.id, data.original);
      } catch {
        await this.prisma.document.update({
          where: { id: doc.id },
          data: { status: 'failed', error: 'ORIGINAL_STORAGE_FAILED' },
        });
        throw new ServiceUnavailableException({
          code: 'ORIGINAL_STORAGE_FAILED',
          message: 'The original file could not be saved safely.',
        });
      }
    }

    // Fire-and-forget embedding pipeline; it advances status and records errors
    // on the row itself, so a failure never breaks the create response.
    void this.ingestion.ingest(doc.id);
    // Fire-and-forget Smart-Library enrichment (summary/subject/language/…);
    // best-effort and independent of indexing — a failure leaves fields null.
    void this.enrichment.enrich(doc.id);

    return this.toDetail(doc);
  }

  private async extractStoredFile(
    userId: string,
    id: string,
    preferredTitle?: string,
  ): Promise<DocumentDetail> {
    const document = await this.prisma.document.findFirst({
      where: { id, userId, deletedAt: null, source: 'file' },
    });
    if (!document) throw new NotFoundException('Document not found.');
    try {
      const original = await this.privateMedia.getDocumentOriginal(userId, id);
      const extracted = await this.extraction.extractFromFile({
        originalname: document.sourceRef || document.title,
        mimetype: document.mimeType ?? original.mimeType,
        size: document.sizeBytes ?? original.buffer.length,
        buffer: original.buffer,
      });
      const content = extracted.text.trim();
      if (!content) throw new BadRequestException('No text content could be ingested.');
      if (content.length > MAX_CONTENT_CHARS) {
        throw new PayloadTooLargeException(
          `Document exceeds the ${MAX_CONTENT_CHARS.toLocaleString()}-character limit.`,
        );
      }
      const updated = await this.prisma.document.update({
        where: { id },
        data: {
          title: (preferredTitle?.trim() || extracted.title || document.title).slice(0, 300),
          content,
          charCount: content.length,
          pageCount: extracted.pageCount ?? document.pageCount,
          status: 'pending',
          stage: null,
          error: null,
        },
      });
      void this.ingestion.ingest(id);
      void this.enrichment.enrich(id);
      return this.toDetail(updated);
    } catch {
      const failed = await this.prisma.document.update({
        where: { id },
        data: { status: 'failed', stage: null, error: 'FILE_EXTRACTION_FAILED' },
      });
      return this.toDetail(failed);
    }
  }

  private toSummary(doc: Document): DocumentSummary {
    return {
      id: doc.id,
      title: doc.title,
      source: doc.source,
      sourceRef: doc.sourceRef ?? undefined,
      charCount: doc.charCount,
      status: doc.status,
      contentType: doc.contentType as DocumentContentType,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      pageCount: doc.pageCount,
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
