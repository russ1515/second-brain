import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Document, Prisma } from '@prisma/client';
import type {
  Collection,
  DetectedConcept,
  DocumentDifficulty,
  LibraryDocument,
  LibraryDocumentDetail,
  LibraryFacets,
  LibraryFilter,
} from '@second-brain/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { DocumentEnrichmentService } from '../enrichment/document-enrichment.service';

/** A document created within this many days shows on the "Recent" shelf. */
const RECENT_DAYS = 7;
/** Preview excerpt length shown on a library card. */
const PREVIEW_CHARS = 200;

export interface LibraryQuery {
  filter?: LibraryFilter;
  subject?: string;
  language?: string;
  collectionId?: string;
  /** Free-text match on title / summary. */
  q?: string;
}

/**
 * The Smart Library query engine (Sprint 6.1) — the Evernote-style shelves.
 *
 * Every shelf is a filter over the caller's own documents; the automatically
 * derived metadata (summary/subject/language/author/difficulty) is produced by
 * DocumentEnrichmentService and only surfaced here. Trashing a document soft-
 * deletes it AND purges its vectors so it stops grounding the AI teacher;
 * restoring re-indexes it.
 */
@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
    private readonly enrichment: DocumentEnrichmentService,
  ) {}

  /** Documents for a shelf, newest first, with metadata + concepts. */
  async list(userId: string, query: LibraryQuery): Promise<LibraryDocument[]> {
    const filter = query.filter ?? 'all';
    if (filter === 'shared') return []; // sharing is a later brick — honestly empty.

    const where = this.whereFor(userId, filter, query);
    const docs = await this.prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    const conceptsByDoc = await this.conceptsFor(docs.map((d) => d.id));
    const collectionNames = await this.collectionNames(userId);
    return docs.map((doc) =>
      this.toLibraryDocument(doc, conceptsByDoc.get(doc.id) ?? [], collectionNames),
    );
  }

  /** One document with its full text + all derived metadata (detail view). */
  async getOne(userId: string, id: string): Promise<LibraryDocumentDetail> {
    const doc = await this.own(userId, id);
    const base = await this.hydrate(userId, doc);
    return { ...base, content: doc.content, error: doc.error ?? undefined };
  }

  /** Counts + facet values that drive the sidebar. */
  async facets(userId: string): Promise<LibraryFacets> {
    const recentSince = this.recentSince();
    const [all, favorites, recent, trash, subjectRows, languageRows, collections] =
      await Promise.all([
        this.prisma.document.count({ where: { userId, deletedAt: null } }),
        this.prisma.document.count({
          where: { userId, deletedAt: null, isFavorite: true },
        }),
        this.prisma.document.count({
          where: { userId, deletedAt: null, createdAt: { gte: recentSince } },
        }),
        this.prisma.document.count({ where: { userId, deletedAt: { not: null } } }),
        this.prisma.document.groupBy({
          by: ['subject'],
          where: { userId, deletedAt: null, subject: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.document.groupBy({
          by: ['language'],
          where: { userId, deletedAt: null, language: { not: null } },
          _count: { _all: true },
        }),
        this.listCollections(userId),
      ]);

    return {
      all,
      favorites,
      recent,
      shared: 0,
      trash,
      subjects: subjectRows
        .filter((r) => r.subject)
        .map((r) => ({ value: r.subject as string, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      languages: languageRows
        .filter((r) => r.language)
        .map((r) => ({ value: r.language as string, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      collections,
    };
  }

  async toggleFavorite(userId: string, id: string): Promise<LibraryDocument> {
    const doc = await this.own(userId, id);
    const updated = await this.prisma.document.update({
      where: { id },
      data: { isFavorite: !doc.isFavorite },
    });
    return this.hydrate(userId, updated);
  }

  /** Soft-delete into the Trash and stop it grounding the AI (purge vectors). */
  async trash(userId: string, id: string): Promise<LibraryDocument> {
    const doc = await this.own(userId, id);
    if (doc.deletedAt) return this.hydrate(userId, doc);
    await this.ingestion.purgeVectors(id);
    const updated = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.hydrate(userId, updated);
  }

  /** Restore from the Trash and re-index it so it can ground the AI again. */
  async restore(userId: string, id: string): Promise<LibraryDocument> {
    const doc = await this.own(userId, id);
    if (!doc.deletedAt) return this.hydrate(userId, doc);
    const updated = await this.prisma.document.update({
      where: { id },
      data: { deletedAt: null },
    });
    void this.ingestion.ingest(id); // re-embed in the background
    return this.hydrate(userId, updated);
  }

  /** (Re)run AI enrichment for one document — used to backfill older docs. */
  async enrichNow(userId: string, id: string): Promise<LibraryDocument> {
    await this.own(userId, id);
    await this.enrichment.enrich(id);
    const doc = await this.prisma.document.findUnique({ where: { id } });
    return this.hydrate(userId, doc as Document);
  }

  // ── collections ────────────────────────────────────────────────────────

  async listCollections(userId: string): Promise<Collection[]> {
    const rows = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { documents: { where: { deletedAt: null } } } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      documentCount: c._count.documents,
    }));
  }

  async createCollection(userId: string, name: string): Promise<Collection> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('A collection name is required.');
    const created = await this.prisma.collection.create({
      data: { userId, name: trimmed.slice(0, 120) },
    });
    return { id: created.id, name: created.name, documentCount: 0 };
  }

  async assignCollection(
    userId: string,
    documentId: string,
    collectionId: string | null,
  ): Promise<LibraryDocument> {
    await this.own(userId, documentId);
    if (collectionId) {
      const collection = await this.prisma.collection.findUnique({
        where: { id: collectionId },
      });
      if (!collection || collection.userId !== userId) {
        throw new NotFoundException('Collection not found.');
      }
    }
    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: { collectionId },
    });
    return this.hydrate(userId, updated);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private whereFor(
    userId: string,
    filter: LibraryFilter,
    query: LibraryQuery,
  ): Prisma.DocumentWhereInput {
    const where: Prisma.DocumentWhereInput = { userId };

    // Shelf.
    if (filter === 'trash') {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
      if (filter === 'favorites') where.isFavorite = true;
      if (filter === 'recent') where.createdAt = { gte: this.recentSince() };
    }

    // Cross-cutting facets (subject / language / collection).
    if (query.subject) where.subject = query.subject;
    if (query.language) where.language = query.language;
    if (query.collectionId) where.collectionId = query.collectionId;

    // Free-text.
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private async own(userId: string, id: string): Promise<Document> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    return doc;
  }

  /** Build a single LibraryDocument for one row (fetches its concepts). */
  private async hydrate(userId: string, doc: Document): Promise<LibraryDocument> {
    const conceptsByDoc = await this.conceptsFor([doc.id]);
    const collectionNames = await this.collectionNames(userId);
    return this.toLibraryDocument(
      doc,
      conceptsByDoc.get(doc.id) ?? [],
      collectionNames,
    );
  }

  private async conceptsFor(
    documentIds: string[],
  ): Promise<Map<string, DetectedConcept[]>> {
    const byDoc = new Map<string, DetectedConcept[]>();
    if (documentIds.length === 0) return byDoc;
    const links = await this.prisma.conceptDocument.findMany({
      where: { documentId: { in: documentIds } },
      include: { concept: { select: { id: true, name: true } } },
    });
    for (const link of links) {
      const list = byDoc.get(link.documentId) ?? [];
      list.push({ id: link.concept.id, name: link.concept.name });
      byDoc.set(link.documentId, list);
    }
    return byDoc;
  }

  private async collectionNames(userId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.collection.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  private toLibraryDocument(
    doc: Document,
    concepts: DetectedConcept[],
    collectionNames: Map<string, string>,
  ): LibraryDocument {
    return {
      id: doc.id,
      title: doc.title,
      source: doc.source,
      sourceRef: doc.sourceRef ?? undefined,
      charCount: doc.charCount,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      stage: (doc.stage as LibraryDocument['stage']) ?? null,
      preview: this.preview(doc.content),
      isFavorite: doc.isFavorite,
      deletedAt: doc.deletedAt?.toISOString() ?? null,
      collectionId: doc.collectionId,
      collectionName: doc.collectionId
        ? collectionNames.get(doc.collectionId) ?? null
        : null,
      summary: doc.summary,
      subject: doc.subject,
      language: doc.language,
      author: doc.author,
      difficulty: (doc.difficulty as DocumentDifficulty | null) ?? null,
      enriched: doc.enrichedAt !== null,
      concepts: concepts.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  private preview(content: string): string {
    return content.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_CHARS);
  }

  private recentSince(): Date {
    return new Date(Date.now() - RECENT_DAYS * 86_400_000);
  }
}
