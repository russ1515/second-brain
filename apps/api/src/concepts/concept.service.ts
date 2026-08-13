import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Concept } from '@prisma/client';
import type {
  ConceptDetail,
  ConceptEdgeView,
  ConceptSummary,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateConceptDto } from './dto/create-concept.dto';
import type { UpdateConceptDto } from './dto/update-concept.dto';
import type { CreateConceptEdgeDto } from './dto/create-concept-edge.dto';

const edgeWithNames = {
  include: {
    source: { select: { id: true, name: true } },
    target: { select: { id: true, name: true } },
  },
} satisfies Prisma.ConceptEdgeDefaultArgs;

type EdgeWithNames = Prisma.ConceptEdgeGetPayload<typeof edgeWithNames>;

/** Full concept graph payload: edges + linked cards/documents. */
const conceptDetailInclude = {
  outgoingEdges: edgeWithNames,
  incomingEdges: edgeWithNames,
  cards: { include: { card: { select: { id: true, front: true } } } },
  documents: { include: { document: { select: { id: true, title: true } } } },
} satisfies Prisma.ConceptInclude;

type ConceptWithGraph = Prisma.ConceptGetPayload<{
  include: typeof conceptDetailInclude;
}>;

@Injectable()
export class ConceptService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateConceptDto): Promise<ConceptDetail> {
    try {
      const concept = await this.prisma.concept.create({
        data: {
          userId,
          name: dto.name.trim(),
          normalizedName: this.normalize(dto.name),
          description: dto.description?.trim() || null,
        },
      });
      return this.get(userId, concept.id);
    } catch (error) {
      throw this.rethrowDuplicate(error);
    }
  }

  async list(userId: string): Promise<ConceptSummary[]> {
    const concepts = await this.prisma.concept.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            outgoingEdges: true,
            incomingEdges: true,
            cards: true,
            documents: true,
          },
        },
      },
    });
    return concepts.map((c) =>
      this.toSummary(c, {
        edgeCount: c._count.outgoingEdges + c._count.incomingEdges,
        cardCount: c._count.cards,
        documentCount: c._count.documents,
      }),
    );
  }

  /** Summaries of every concept linked to a given document. */
  async listForDocument(
    userId: string,
    documentId: string,
  ): Promise<ConceptSummary[]> {
    const concepts = await this.prisma.concept.findMany({
      where: { userId, documents: { some: { documentId } } },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            outgoingEdges: true,
            incomingEdges: true,
            cards: true,
            documents: true,
          },
        },
      },
    });
    return concepts.map((c) =>
      this.toSummary(c, {
        edgeCount: c._count.outgoingEdges + c._count.incomingEdges,
        cardCount: c._count.cards,
        documentCount: c._count.documents,
      }),
    );
  }

  async get(userId: string, id: string): Promise<ConceptDetail> {
    const concept = await this.prisma.concept.findUnique({
      where: { id },
      include: conceptDetailInclude,
    });
    if (!concept || concept.userId !== userId) {
      throw new NotFoundException('Concept not found.');
    }
    return this.toDetail(concept);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateConceptDto,
  ): Promise<ConceptDetail> {
    await this.requireOwned(userId, id);
    try {
      await this.prisma.concept.update({
        where: { id },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name.trim(), normalizedName: this.normalize(dto.name) }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
        },
      });
    } catch (error) {
      throw this.rethrowDuplicate(error);
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await this.prisma.concept.delete({ where: { id } });
  }

  async addEdge(
    userId: string,
    sourceId: string,
    dto: CreateConceptEdgeDto,
  ): Promise<ConceptDetail> {
    if (sourceId === dto.targetConceptId) {
      throw new ConflictException('A concept cannot link to itself.');
    }
    await this.requireOwned(userId, sourceId);
    await this.requireOwned(userId, dto.targetConceptId);
    try {
      await this.prisma.conceptEdge.create({
        data: {
          userId,
          sourceId,
          targetId: dto.targetConceptId,
          relation: dto.relation,
        },
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('That edge already exists.');
      }
      throw error;
    }
    return this.get(userId, sourceId);
  }

  async removeEdge(
    userId: string,
    sourceId: string,
    edgeId: string,
  ): Promise<void> {
    const edge = await this.prisma.conceptEdge.findUnique({
      where: { id: edgeId },
    });
    if (!edge || edge.userId !== userId || edge.sourceId !== sourceId) {
      throw new NotFoundException('Edge not found.');
    }
    await this.prisma.conceptEdge.delete({ where: { id: edgeId } });
  }

  /** Link a flashcard to a concept (idempotent). */
  async linkCard(
    userId: string,
    conceptId: string,
    cardId: string,
  ): Promise<ConceptDetail> {
    await this.requireOwned(userId, conceptId);
    await this.requireOwnedCard(userId, cardId);
    await this.prisma.conceptCard
      .create({ data: { conceptId, cardId } })
      .catch((error) => {
        if (!this.isUniqueViolation(error)) throw error; // already linked → ok
      });
    return this.get(userId, conceptId);
  }

  async unlinkCard(
    userId: string,
    conceptId: string,
    cardId: string,
  ): Promise<void> {
    await this.requireOwned(userId, conceptId);
    await this.prisma.conceptCard.deleteMany({ where: { conceptId, cardId } });
  }

  /** Link a document to a concept (idempotent). */
  async linkDocument(
    userId: string,
    conceptId: string,
    documentId: string,
  ): Promise<ConceptDetail> {
    await this.requireOwned(userId, conceptId);
    await this.requireOwnedDocument(userId, documentId);
    await this.prisma.conceptDocument
      .create({ data: { conceptId, documentId } })
      .catch((error) => {
        if (!this.isUniqueViolation(error)) throw error;
      });
    return this.get(userId, conceptId);
  }

  async unlinkDocument(
    userId: string,
    conceptId: string,
    documentId: string,
  ): Promise<void> {
    await this.requireOwned(userId, conceptId);
    await this.prisma.conceptDocument.deleteMany({
      where: { conceptId, documentId },
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async requireOwned(userId: string, id: string): Promise<Concept> {
    const concept = await this.prisma.concept.findUnique({ where: { id } });
    if (!concept || concept.userId !== userId) {
      throw new NotFoundException('Concept not found.');
    }
    return concept;
  }

  private async requireOwnedCard(userId: string, cardId: string): Promise<void> {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Card not found.');
    }
  }

  private async requireOwnedDocument(
    userId: string,
    documentId: string,
  ): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
  }

  private normalize(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private rethrowDuplicate(error: unknown): Error {
    if (this.isUniqueViolation(error)) {
      return new ConflictException('A concept with this name already exists.');
    }
    return error as Error;
  }

  private toSummary(
    concept: Concept,
    counts: { edgeCount: number; cardCount: number; documentCount: number },
  ): ConceptSummary {
    return {
      id: concept.id,
      name: concept.name,
      description: concept.description ?? undefined,
      edgeCount: counts.edgeCount,
      cardCount: counts.cardCount,
      documentCount: counts.documentCount,
      createdAt: concept.createdAt.toISOString(),
      updatedAt: concept.updatedAt.toISOString(),
    };
  }

  private toDetail(concept: ConceptWithGraph): ConceptDetail {
    return {
      ...this.toSummary(concept, {
        edgeCount: concept.outgoingEdges.length + concept.incomingEdges.length,
        cardCount: concept.cards.length,
        documentCount: concept.documents.length,
      }),
      outgoingEdges: concept.outgoingEdges.map((e) => this.toEdgeView(e)),
      incomingEdges: concept.incomingEdges.map((e) => this.toEdgeView(e)),
      cards: concept.cards.map((cc) => ({
        id: cc.card.id,
        front: cc.card.front,
      })),
      documents: concept.documents.map((cd) => ({
        id: cd.document.id,
        title: cd.document.title,
      })),
    };
  }

  private toEdgeView(edge: EdgeWithNames): ConceptEdgeView {
    return {
      id: edge.id,
      relation: edge.relation,
      sourceId: edge.source.id,
      sourceName: edge.source.name,
      targetId: edge.target.id,
      targetName: edge.target.name,
      createdAt: edge.createdAt.toISOString(),
    };
  }
}
