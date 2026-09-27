import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { EmbeddingsService } from '../../embeddings/embeddings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QdrantService, type VectorPoint } from '../../qdrant/qdrant.service';
import { DOCUMENT_CHUNKS_COLLECTION } from '../../qdrant/qdrant.constants';
import { ConceptExtractionService } from '../../concepts/concept-extraction.service';
import { KnowledgeIntegrationService } from '../integration/knowledge-integration.service';
import { ChunkingService } from './chunking.service';
import { CleaningService } from './cleaning.service';
import { accountDataLockKey } from '../../common/account-data-lock';

/**
 * The Smart Upload Pipeline (Sprint 6.2).
 *
 * One upload triggers the whole automatic chain, and the learner launches
 * nothing: cleaning → segmentation → embeddings → Qdrant (Learning Memory) →
 * Knowledge Graph (concept extraction). Each stage is written to the document
 * row so the library can show progress live. Runs in-process (fire-and-forget
 * from the ingestion endpoints); a queue can replace the trigger later without
 * touching this logic.
 */
@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly cleaning: CleaningService,
    private readonly embeddings: EmbeddingsService,
    private readonly qdrant: QdrantService,
    private readonly concepts: ConceptExtractionService,
    private readonly integration: KnowledgeIntegrationService,
  ) {}

  /** Ensure the vector collection exists (sized to the active provider). */
  async onModuleInit(): Promise<void> {
    try {
      await this.qdrant.ensureCollection(
        DOCUMENT_CHUNKS_COLLECTION,
        this.embeddings.dimensions,
      );
    } catch {
      // Don't crash boot if Qdrant is momentarily unavailable; ingest will retry.
      this.logger.warn('Could not ensure the Qdrant collection at boot.');
    }
  }

  /**
   * Run the full automatic pipeline for a document. Never throws — hard failures
   * are recorded on the row (status=failed); the Knowledge-Graph stage is
   * best-effort and its failure does not fail the document.
   */
  async ingest(documentId: string): Promise<void> {
    try {
      // ── Claim + cleaning ──
      // The durable status is the cross-replica ingestion lease. Taking both
      // advisory locks before claiming means concurrent reindex requests yield
      // without a second provider call, while account deletion/trash can commit
      // a barrier that a late worker is unable to overwrite.
      const doc = await this.prisma.$transaction(async (tx) => {
        const candidate = await tx.document.findUnique({ where: { id: documentId } });
        if (!candidate) return null;
        const accountLock = accountDataLockKey(candidate.userId);
        const documentLock = `document-ingestion:${documentId}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountLock}, 0))`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${documentLock}, 0))`;
        const writable = await tx.document.findFirst({
          where: {
            id: documentId,
            userId: candidate.userId,
            deletedAt: null,
            user: { accountStatus: 'active' },
          },
        });
        if (!writable || writable.stage === 'deleting') return null;
        if (writable.status === 'processing' && writable.stage) return null;
        const cleaned = this.cleaning.clean(writable.content);
        return tx.document.update({
          where: { id: documentId },
          data: {
            status: 'processing',
            stage: 'cleaning',
            error: null,
            content: cleaned,
            charCount: cleaned.length,
          },
        });
      }, { timeout: 60_000 });
      if (!doc) return;

      await this.qdrant.ensureCollection(
        DOCUMENT_CHUNKS_COLLECTION,
        this.embeddings.dimensions,
      );

      // ── Segmentation ──
      if (!await this.setStage(documentId, 'segmenting')) return;
      const chunks = this.chunking.chunk(doc.content);
      let points: VectorPoint[] = [];

      if (chunks.length > 0) {
        // ── Embeddings ──
        if (!await this.setStage(documentId, 'embedding')) return;
        const vectors = await this.embeddings.embedDocuments(chunks);

        // ── Qdrant (Learning Memory) ──
        if (!await this.setStage(documentId, 'indexing')) return;
        points = chunks.map((content, index) => ({
          id: randomUUID(),
          vector: vectors[index],
          payload: { userId: doc.userId, documentId, chunkIndex: index, content },
        }));
      }

      // Publish one complete generation under both writer locks. The purge and
      // compensation occur before the locks are released, so a failed run can
      // never erase a later successful run.
      await this.prisma.$transaction(async (tx) => {
        const accountLock = accountDataLockKey(doc.userId);
        const documentLock = `document-ingestion:${documentId}`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${accountLock}, 0))`;
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${documentLock}, 0))`;
        const writable = await tx.document.findFirst({
          where: {
            id: documentId,
            userId: doc.userId,
            deletedAt: null,
            status: 'processing',
            user: { accountStatus: 'active' },
          },
          select: { id: true },
        });
        if (!writable) throw new Error('DOCUMENT_OWNER_UNAVAILABLE');

        await this.qdrant.deleteByDocument(DOCUMENT_CHUNKS_COLLECTION, documentId);
        await tx.documentChunk.deleteMany({ where: { documentId } });
        try {
          if (points.length > 0) {
            await this.qdrant.upsert(DOCUMENT_CHUNKS_COLLECTION, points);
            await tx.documentChunk.createMany({
              data: points.map((point, index) => ({
                documentId,
                userId: doc.userId,
                chunkIndex: index,
                content: chunks[index],
                vectorId: point.id,
              })),
            });
          }
        } catch (error) {
          // Compensate while the generation lock is still held.
          await this.qdrant
            .deleteByDocument(DOCUMENT_CHUNKS_COLLECTION, documentId)
            .catch(() => undefined);
          throw error;
        }
      }, { timeout: 60_000 });

      // ── Knowledge Graph ── (automatic, best-effort: a doc with no extractable
      // concepts, or a transient LLM outage, must still finish as `ready`).
      if (!await this.setStage(documentId, 'graphing')) return;
      try {
        await this.concepts.extractFromDocument(
          doc.userId,
          documentId,
        );
        this.logger.log('Knowledge-Graph stage completed.');
        // Smart Knowledge Integration (Sprint 6.8): connect the new concepts to
        // the learner's existing knowledge so the graph is one connected brain.
        await this.integration.linkToExisting(doc.userId, documentId);
      } catch {
        this.logger.warn('Knowledge-Graph stage was skipped.');
      }

      await this.prisma.document.updateMany({
        where: {
          id: documentId,
          deletedAt: null,
          status: 'processing',
          stage: { not: 'deleting' },
          user: { accountStatus: 'active' },
        },
        data: { status: 'ready', stage: null, error: null },
      });
      this.logger.log('Document-ingestion pipeline completed.');
    } catch {
      this.logger.error('Document-ingestion pipeline failed.');
      await this.prisma.document
        .updateMany({
          where: {
            id: documentId,
            deletedAt: null,
            stage: { not: 'deleting' },
            user: { accountStatus: 'active' },
          },
          data: { status: 'failed', stage: null, error: 'PROCESSING_FAILED' },
        })
        .catch(() => undefined);
    }
  }

  /** Record the current pipeline stage so the library can show live progress. */
  private async setStage(documentId: string, stage: string): Promise<boolean> {
    const updated = await this.prisma.document.updateMany({
      where: {
        id: documentId,
        deletedAt: null,
        status: 'processing',
        stage: { not: 'deleting' },
        user: { accountStatus: 'active' },
      },
      data: { stage },
    });
    return updated.count === 1;
  }

  /** Remove a document's chunks from both Qdrant and Postgres. */
  async purgeVectors(
    documentId: string,
    transaction?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.qdrant.deleteByDocument(
      DOCUMENT_CHUNKS_COLLECTION,
      documentId,
    );
    await (transaction ?? this.prisma).documentChunk.deleteMany({
      where: { documentId },
    });
  }
}
