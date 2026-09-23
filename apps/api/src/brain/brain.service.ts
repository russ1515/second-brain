import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BrainAnswer,
  BrainConceptInteraction,
  BrainConceptView,
  BrainDocumentReference,
  BrainGraphPage,
  BrainNextAction,
  BrainOverview,
  BrainOverviewSource,
  BrainSearchPage,
  BrainSearchResult,
  BrainSourceState,
  LearningPathItem,
  TwinGraphNode,
} from '@second-brain/shared';
import {
  BRAIN_OVERVIEW_SOURCES,
  classifyLearningStatus,
  resolveBrainMaturity,
} from '@second-brain/shared';
import { LearnerProfileService } from '../concepts/learner-profile.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { MasteryService, STRONG_MASTERY } from '../concepts/mastery.service';
import { LearningDnaService } from '../learning-dna/learning-dna.service';
import { MemoryService } from '../memory/memory.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { PredictionService } from '../prediction/prediction.service';
import { PrismaService } from '../prisma/prisma.service';

const GRAPH_LIMIT_MAX = 100;
const SEARCH_LIMIT_MAX = 20;
const SEARCH_OFFSET_MAX = 200;
const PANEL_ITEM_LIMIT = 20;

@Injectable()
export class BrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly paths: LearningPathService,
    private readonly learnerProfiles: LearnerProfileService,
    private readonly dna: LearningDnaService,
    private readonly memory: MemoryService,
    private readonly onboarding: OnboardingService,
    private readonly predictions: PredictionService,
  ) {}

  async overview(userId: string, now = new Date()): Promise<BrainOverview> {
    const results = await Promise.allSettled([
      this.knowledgeCounts(userId),
      this.mastery.strengthsWeaknesses(userId),
      this.dna.dna(userId),
      this.learnerProfiles.profile(userId),
      this.onboarding.get(userId),
      this.memory.page(userId, 8),
      this.paths.next(userId),
      this.predictions.forecast(userId, now),
      this.recentDocuments(userId),
    ] as const);
    const [knowledgeResult, strengthsResult, dnaResult, profileResult, declaredResult, memoryResult, pathResult, predictionResult, documentsResult] = results;
    const knowledge = fulfilled(knowledgeResult, { conceptCount: 0, edgeCount: 0 });
    const memory = fulfilled(memoryResult, null);
    const profile = fulfilled(profileResult, null);
    const path = fulfilled(pathResult, { items: [] as LearningPathItem[] });
    const prediction = fulfilled(predictionResult, null);
    const onboarding = fulfilled(declaredResult, null);
    const sources = this.sourceStates({
      knowledge: knowledgeResult,
      strengths: strengthsResult,
      learningDna: dnaResult,
      learnerProfile: profileResult,
      declaredProfile: declaredResult,
      memory: memoryResult,
      path: pathResult,
      foresight: predictionResult,
      documents: documentsResult,
    });

    const nextPathItems = path.items.filter((item) => item.status !== 'mastered').slice(0, 5);
    const topRisk = prediction?.topRisk;
    const foresight = profile && profile.interactions >= 5 && topRisk && topRisk.level !== 'low' && topRisk.reasons.length > 0
      ? { prediction: topRisk, generatedAt: prediction.generatedAt, isForecast: true as const }
      : null;

    return {
      generatedAt: now.toISOString(),
      maturity: {
        level: resolveBrainMaturity({
          conceptCount: knowledge.conceptCount,
          edgeCount: knowledge.edgeCount,
          historyCount: memory?.summary.total ?? 0,
        }),
        conceptCount: knowledge.conceptCount,
        edgeCount: knowledge.edgeCount,
        historyCount: memory?.summary.total ?? 0,
      },
      strengths: fulfilled(strengthsResult, null),
      learningDna: fulfilled(dnaResult, null),
      learnerProfile: profile,
      declaredProfile: onboarding ? {
        preferences: onboarding.answers.preferences ?? [],
        teacher: onboarding.answers.teacher ?? null,
        subjects: onboarding.answers.subjects ?? [],
        goals: onboarding.answers.goals ?? [],
      } : null,
      memory: memory ? { summary: memory.summary, recentEntries: memory.entries } : null,
      nextPathItems,
      foresight,
      recentDocuments: fulfilled(documentsResult, []),
      nextBestAction: this.nextAction(nextPathItems),
      sources,
      partial: Object.values(sources).some((state) => state === 'unavailable'),
    };
  }

  async graph(
    userId: string,
    options: { limit?: number; cursor?: string; query?: string; documentId?: string },
  ): Promise<BrainGraphPage> {
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 40), 1), GRAPH_LIMIT_MAX);
    const query = options.query?.trim().slice(0, 100) || undefined;
    const documentId = options.documentId?.trim() || undefined;
    const where = {
      userId,
      ...(query ? { name: { contains: query, mode: 'insensitive' as const } } : {}),
      ...(documentId ? { documents: { some: { documentId } } } : {}),
    };
    const [total, concepts] = await Promise.all([
      this.prisma.concept.count({ where }),
      this.prisma.concept.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        include: {
          cards: { include: { card: true } },
          incomingEdges: {
            where: { relation: 'prerequisite' },
            include: { source: { include: { cards: { include: { card: true } } } } },
          },
        },
      }),
    ]);
    const page = concepts.slice(0, limit);
    const ids = page.map((concept) => concept.id);
    const edges = ids.length === 0 ? [] : await this.prisma.conceptEdge.findMany({
      where: { userId, sourceId: { in: ids }, targetId: { in: ids } },
      orderBy: { createdAt: 'asc' },
    });
    const now = new Date();
    const nodes = page.map((concept): TwinGraphNode => {
      const value = this.mastery.computeMastery(concept, now);
      const hasUnmetPrerequisites = concept.incomingEdges.some((edge) => {
        const prerequisite = this.mastery.computeMastery(edge.source, now);
        return prerequisite.mastery === null || prerequisite.mastery < STRONG_MASTERY;
      });
      return {
        id: concept.id,
        name: concept.name,
        mastery: value.mastery,
        level: value.level,
        status: classifyLearningStatus({ ...value, hasUnmetPrerequisites }),
      };
    });
    return {
      nodes,
      edges: edges.map((edge) => ({ id: edge.id, sourceId: edge.sourceId, targetId: edge.targetId, relation: edge.relation })),
      nextCursor: concepts.length > limit ? page[page.length - 1]!.id : null,
      total,
      bounded: true,
      documentId: documentId ?? null,
    };
  }

  async concept(userId: string, conceptId: string): Promise<BrainConceptView> {
    const concept = await this.prisma.concept.findFirst({
      where: { id: conceptId, userId },
      include: {
        cards: { include: { card: true } },
        documents: {
          orderBy: { createdAt: 'desc' }, take: PANEL_ITEM_LIMIT + 1,
          include: { document: { select: { id: true, title: true, subject: true, status: true, updatedAt: true } } },
        },
        outgoingEdges: {
          orderBy: { createdAt: 'desc' }, take: PANEL_ITEM_LIMIT + 1,
          include: { target: { select: { id: true, name: true } } },
        },
        incomingEdges: {
          orderBy: { createdAt: 'desc' }, take: PANEL_ITEM_LIMIT + 1,
          include: { source: { include: { cards: { include: { card: true } } } } },
        },
      },
    });
    if (!concept) throw new NotFoundException('Concept not found.');
    const now = new Date();
    const value = this.mastery.computeMastery(concept, now);
    const hasUnmetPrerequisites = concept.incomingEdges
      .filter((edge) => edge.relation === 'prerequisite')
      .some((edge) => {
        const prerequisite = this.mastery.computeMastery(edge.source, now);
        return prerequisite.mastery === null || prerequisite.mastery < STRONG_MASTERY;
      });
    const [reviews, lessons, sessions] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where: { userId, card: { concepts: { some: { conceptId } } } },
        orderBy: { reviewedAt: 'desc' }, take: 5,
        select: { id: true, reviewedAt: true, card: { select: { front: true } } },
      }),
      this.prisma.lesson.findMany({
        where: { userId, conceptId }, orderBy: { createdAt: 'desc' }, take: 5,
        select: { id: true, topic: true, createdAt: true },
      }),
      this.prisma.tutorSession.findMany({
        where: { userId, focusConceptId: conceptId }, orderBy: { updatedAt: 'desc' }, take: 5,
        select: { id: true, title: true, subject: true, updatedAt: true },
      }),
    ]);
    const interactions: BrainConceptInteraction[] = [
      ...reviews.map((row) => ({ id: `review-${row.id}`, kind: 'review' as const, title: row.card.front, at: row.reviewedAt.toISOString() })),
      ...lessons.map((row) => ({ id: `lesson-${row.id}`, kind: 'lesson' as const, title: row.topic, at: row.createdAt.toISOString() })),
      ...sessions.map((row) => ({ id: `conversation-${row.id}`, kind: 'conversation' as const, title: row.title ?? row.subject ?? 'Discussion', at: row.updatedAt.toISOString() })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
    const nextReview = concept.cards
      .map((link) => link.card.due)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const measuredStabilities = concept.cards
      .map((link) => link.card)
      .filter((card) => card.reps > 0 && card.stability > 0)
      .map((card) => card.stability);
    const outgoing = concept.outgoingEdges.slice(0, PANEL_ITEM_LIMIT).map((edge) => ({
      id: edge.id, conceptId: edge.target.id, name: edge.target.name, relation: edge.relation, direction: 'outgoing' as const,
    }));
    const incoming = concept.incomingEdges.slice(0, PANEL_ITEM_LIMIT).map((edge) => ({
      id: edge.id, conceptId: edge.source.id, name: edge.source.name, relation: edge.relation, direction: 'incoming' as const,
    }));
    return {
      node: {
        id: concept.id,
        name: concept.name,
        mastery: value.mastery,
        level: value.level,
        status: classifyLearningStatus({ ...value, hasUnmetPrerequisites }),
      },
      description: concept.description,
      cardCount: value.cardCount,
      reviewedCount: value.reviewedCount,
      dueCount: value.dueCount,
      memoryStabilityDays: measuredStabilities.length > 0
        ? measuredStabilities.reduce((sum, value) => sum + value, 0) / measuredStabilities.length
        : null,
      nextReviewAt: nextReview?.toISOString() ?? null,
      sources: concept.documents.slice(0, PANEL_ITEM_LIMIT).map((link) => this.documentReference(link.document)),
      relations: [...incoming, ...outgoing].slice(0, PANEL_ITEM_LIMIT),
      recentInteractions: interactions,
      sourcesTruncated: concept.documents.length > PANEL_ITEM_LIMIT,
      relationsTruncated: concept.incomingEdges.length + concept.outgoingEdges.length > PANEL_ITEM_LIMIT,
    };
  }

  async search(userId: string, rawQuery: string, requestedLimit = 12, cursor?: string): Promise<BrainSearchPage> {
    const query = rawQuery.trim().slice(0, 100);
    if (query.length < 2) return { items: [], nextCursor: null };
    const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 12, 1), SEARCH_LIMIT_MAX);
    const offset = Math.min(Math.max(Number.parseInt(cursor ?? '0', 10) || 0, 0), SEARCH_OFFSET_MAX);
    const take = Math.min(offset + limit + 1, SEARCH_OFFSET_MAX + 1);
    const [concepts, documents, goals] = await Promise.all([
      this.prisma.concept.findMany({ where: { userId, name: { contains: query, mode: 'insensitive' } }, orderBy: { updatedAt: 'desc' }, take, select: { id: true, name: true, description: true, updatedAt: true } }),
      this.prisma.document.findMany({ where: { userId, deletedAt: null, OR: [{ title: { contains: query, mode: 'insensitive' } }, { subject: { contains: query, mode: 'insensitive' } }] }, orderBy: { updatedAt: 'desc' }, take, select: { id: true, title: true, subject: true, updatedAt: true } }),
      this.prisma.goal.findMany({ where: { userId, title: { contains: query, mode: 'insensitive' } }, orderBy: { createdAt: 'desc' }, take, select: { id: true, title: true, period: true, createdAt: true } }),
    ]);
    const items: BrainSearchResult[] = [
      ...concepts.map((row) => ({ id: row.id, kind: 'concept' as const, title: row.name, detail: row.description, updatedAt: row.updatedAt.toISOString(), destination: { kind: 'concept' as const, id: row.id, path: '/brain', params: { conceptId: row.id, view: 'knowledge' } } })),
      ...documents.map((row) => ({ id: row.id, kind: 'document' as const, title: row.title, detail: row.subject, updatedAt: row.updatedAt.toISOString(), destination: { kind: 'document' as const, id: row.id, path: `/library/${row.id}` } })),
      ...goals.map((row) => ({ id: row.id, kind: 'goal' as const, title: row.title, detail: row.period, updatedAt: row.createdAt.toISOString(), destination: { kind: 'route' as const, id: row.id, path: '/goals', params: { goalId: row.id } } })),
    ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const page = items.slice(offset, offset + limit);
    return { items: page, nextCursor: items.length > offset + limit && offset + limit < SEARCH_OFFSET_MAX ? String(offset + limit) : null };
  }

  async ask(userId: string, question: string): Promise<BrainAnswer> {
    const normalized = question.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const asksWeakest = /(maitris|fragil|faibl|least|weak)/.test(normalized);
    const asksNeglected = /(neglig|delaisse|oubli|neglect|overdue)/.test(normalized);
    const asksDocuments = /(document|source|fichier|file)/.test(normalized);
    if (asksWeakest || asksNeglected) {
      const path = await this.paths.next(userId);
      const candidates = path.items.filter((item) => asksNeglected ? item.dueCount > 0 : item.status === 'at_risk').slice(0, 5);
      const concepts = candidates.map((item) => this.pathNode(item));
      return { kind: asksNeglected ? 'neglected' : 'weakest', concepts, documents: [], evidenceCount: concepts.length, grounded: true };
    }
    const searchTerms = normalized
      .replace(/\b(que|quoi|sais|je|sur|le|la|les|de|des|du|un|une|what|do|know|about|the|a|an|mes|my|documents?|sources?|parlent|talk)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    const search = await this.search(userId, searchTerms || question, 10);
    const concepts = await Promise.all(search.items.filter((item) => item.kind === 'concept').slice(0, 5).map(async (item) => {
      const graph = await this.graph(userId, { query: item.title, limit: 1 });
      return graph.nodes[0] ?? null;
    }));
    const documentIds = search.items.filter((item) => item.kind === 'document').slice(0, 5).map((item) => item.id);
    const documents = documentIds.length === 0 ? [] : await this.prisma.document.findMany({
      where: { userId, id: { in: documentIds }, deletedAt: null },
      select: { id: true, title: true, subject: true, status: true, updatedAt: true },
    });
    const conceptResults = concepts.filter((value): value is TwinGraphNode => value !== null);
    const documentResults = documents.map((row) => this.documentReference(row));
    const evidenceCount = conceptResults.length + documentResults.length;
    return {
      kind: evidenceCount === 0 ? 'no-results' : asksDocuments ? 'documents' : 'knowledge',
      concepts: conceptResults,
      documents: documentResults,
      evidenceCount,
      grounded: true,
    };
  }

  private async knowledgeCounts(userId: string): Promise<{ conceptCount: number; edgeCount: number }> {
    const [conceptCount, edgeCount] = await Promise.all([
      this.prisma.concept.count({ where: { userId } }),
      this.prisma.conceptEdge.count({ where: { userId } }),
    ]);
    return { conceptCount, edgeCount };
  }

  private async recentDocuments(userId: string): Promise<BrainDocumentReference[]> {
    const rows = await this.prisma.document.findMany({
      where: { userId, deletedAt: null }, orderBy: { updatedAt: 'desc' }, take: 4,
      select: { id: true, title: true, subject: true, status: true, updatedAt: true },
    });
    return rows.map((row) => this.documentReference(row));
  }

  private documentReference(row: { id: string; title: string; subject: string | null; status: 'pending' | 'processing' | 'ready' | 'failed'; updatedAt: Date }): BrainDocumentReference {
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  }

  private nextAction(items: LearningPathItem[]): BrainNextAction | null {
    const item = items[0];
    if (!item) return null;
    const review = item.status === 'at_risk' || item.dueCount > 0;
    return {
      kind: review ? 'review' : 'learn',
      concept: { conceptId: item.conceptId, name: item.name, status: item.status, dueCount: item.dueCount },
      destination: review
        ? { kind: 'review', id: item.conceptId, path: '/revision', params: { conceptId: item.conceptId } }
        : { kind: 'concept', id: item.conceptId, path: '/tutor', params: { mode: 'explain', conceptId: item.conceptId, conceptName: item.name } },
      evidence: { status: item.status, dueCount: item.dueCount, masteryKnown: item.mastery !== null },
    };
  }

  private pathNode(item: LearningPathItem): TwinGraphNode {
    return { id: item.conceptId, name: item.name, mastery: item.mastery, level: item.level, status: item.status };
  }

  private sourceStates(results: Record<BrainOverviewSource, PromiseSettledResult<unknown>>): Record<BrainOverviewSource, BrainSourceState> {
    return Object.fromEntries(BRAIN_OVERVIEW_SOURCES.map((source) => [source, results[source].status === 'fulfilled' ? 'available' : 'unavailable'])) as Record<BrainOverviewSource, BrainSourceState>;
  }
}

function fulfilled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === 'fulfilled' ? result.value : fallback;
}
