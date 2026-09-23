import { randomUUID } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { EmbeddingsService } from '../../embeddings/embeddings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QdrantService, type VectorPoint } from '../../qdrant/qdrant.service';
import { DOCUMENT_CHUNKS_COLLECTION } from '../../qdrant/qdrant.constants';
import { ConceptExtractionService } from '../../concepts/concept-extraction.service';
import { KnowledgeIntegrationService } from '../integration/knowledge-integration.service';
import { ChunkingService } from './chunking.service';
import { CleaningService } from './cleaning.service';

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
      // ── Cleaning ──
      const started = await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'processing', stage: 'cleaning', error: null },
      });
      const cleaned = this.cleaning.clean(started.content);
      const doc =
        cleaned === started.content
          ? started
          : await this.prisma.document.update({
              where: { id: documentId },
              data: { content: cleaned, charCount: cleaned.length },
            });

      await this.qdrant.ensureCollection(
        DOCUMENT_CHUNKS_COLLECTION,
        this.embeddings.dimensions,
      );
      await this.purgeVectors(documentId); // idempotent re-ingest

      // ── Segmentation ──
      await this.setStage(documentId, 'segmenting');
      const chunks = this.chunking.chunk(doc.content);

      if (chunks.length > 0) {
        // ── Embeddings ──
        await this.setStage(documentId, 'embedding');
        const vectors = await this.embeddings.embedDocuments(chunks);

        // ── Qdrant (Learning Memory) ──
        await this.setStage(documentId, 'indexing');
        const points: VectorPoint[] = chunks.map((content, index) => ({
          id: randomUUID(),
          vector: vectors[index],
          payload: { userId: doc.userId, documentId, chunkIndex: index, content },
        }));
        await this.qdrant.upsert(DOCUMENT_CHUNKS_COLLECTION, points);
        await this.prisma.documentChunk.createMany({
          data: points.map((point, index) => ({
            documentId,
            userId: doc.userId,
            chunkIndex: index,
            content: chunks[index],
            vectorId: point.id,
          })),
        });
      }

      // ── Knowledge Graph ── (automatic, best-effort: a doc with no extractable
      // concepts, or a transient LLM outage, must still finish as `ready`).
      await this.setStage(documentId, 'graphing');
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

      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'ready', stage: null, error: null },
      });
      this.logger.log('Document-ingestion pipeline completed.');
    } catch {
      this.logger.error('Document-ingestion pipeline failed.');
      await this.prisma.document
        .update({
          where: { id: documentId },
          data: { status: 'failed', stage: null, error: 'PROCESSING_FAILED' },
        })
        .catch(() => undefined);
    }
  }

  /** Record the current pipeline stage so the library can show live progress. */
  private async setStage(documentId: string, stage: string): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { stage },
    });
  }

  /** Remove a document's chunks from both Qdrant and Postgres. */
  async purgeVectors(documentId: string): Promise<void> {
    await this.qdrant.deleteByDocument(
      DOCUMENT_CHUNKS_COLLECTION,
      documentId,
    );
    await this.prisma.documentChunk.deleteMany({ where: { documentId } });
  }
}
