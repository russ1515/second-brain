import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Card, Reviewable } from '@prisma/client';
import type {
  ExperienceProduction,
  ExperienceSession,
  GradeReviewSessionItemRequest,
  GradeReviewSessionItemResponse,
  ReviewContextView,
  ReviewExperienceItem,
  ReviewHomeView,
  ReviewPriorityReason,
  ReviewRating,
  ReviewSessionSummary,
  ReviewSessionView,
  RlleFunctionalGap,
  RlleMistakeMemoryItem,
  RlleRepairLoop,
  StartReviewSessionRequest,
} from '@second-brain/shared';
import {
  parseReviewItemReference,
  reviewFeedbackCode,
  reviewItemReference,
  reviewPriorityRank,
} from '@second-brain/shared';
import { ExperienceSessionService } from '../experience-sessions/experience-session.service';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsEngine, type MemoryPhase } from '../revision/fsrs-engine';
import { RevisionEngineService } from '../revision/revision-engine.service';
import { ReviewService } from './review.service';
import { SessionService } from './session.service';

const DAY_MS = 86_400_000;
const MAX_SESSION_ITEMS = 50;
const HOME_PREVIEW_ITEMS = 8;

interface RequestedContext {
  conceptId?: string;
  documentId?: string;
  goalId?: string;
  examId?: string;
  sourceSessionId?: string;
  languageProfileId?: string;
}

interface ResolvedContext extends ReviewContextView {
  examConceptId: string | null;
}

type EnrichedCard = Card & {
  deck: { name: string; languageProfiles: Array<{ id: string; language: string }> };
  sourceDocument: { id: string; title: string } | null;
  concepts: Array<{ concept: { id: string; name: string } }>;
};

/**
 * Experience layer over the two existing FSRS engines. It does not schedule:
 * it selects a bounded queue, explains verifiable priority signals and persists
 * continuity through ExperienceSession.
 */
@Injectable()
export class ReviewExperienceService {
  private readonly logger = new Logger(ReviewExperienceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cardSessions: SessionService,
    private readonly cardReviews: ReviewService,
    private readonly revision: RevisionEngineService,
    private readonly fsrs: FsrsEngine,
    private readonly experiences: ExperienceSessionService,
  ) {}

  async home(userId: string, request: RequestedContext): Promise<ReviewHomeView> {
    const now = new Date();
    const context = await this.resolveContext(userId, request, now);
    const targetConceptId = context.concept?.id ?? context.examConceptId ?? undefined;
    const cardScope = {
      ...(context.language?.vocabDeckId ? { deckId: context.language.vocabDeckId } : {}),
      ...(context.document ? { sourceDocumentId: context.document.documentId } : {}),
      ...(targetConceptId ? { concepts: { some: { conceptId: targetConceptId } } } : {}),
    };
    const activityScope = context.document || context.language
      ? { id: '__document-scope-has-no-generic-reviewables__' }
      : targetConceptId
        ? { kind: 'concept', refId: targetConceptId }
        : {};
    const [stats, flashcardDueCount, activityDueCount, items, overdueCards, overdueActivities, tomorrowCards, tomorrowActivities, nextCard, nextActivity, nextExam] =
      await Promise.all([
        this.cardSessions.stats(userId),
        this.prisma.card.count({ where: { userId, due: { lte: now }, ...cardScope } }),
        this.prisma.reviewable.count({ where: { userId, due: { lte: now }, ...activityScope } }),
        this.candidates(userId, context, MAX_SESSION_ITEMS, now),
        this.prisma.card.count({ where: { userId, reps: { gt: 0 }, due: { lt: this.startOfUtcDay(now) }, ...cardScope } }),
        this.prisma.reviewable.count({ where: { userId, reps: { gt: 0 }, due: { lt: this.startOfUtcDay(now) }, ...activityScope } }),
        this.prisma.card.count({ where: { userId, due: { gte: this.addDays(this.startOfUtcDay(now), 1), lt: this.addDays(this.startOfUtcDay(now), 2) }, ...cardScope } }),
        this.prisma.reviewable.count({ where: { userId, due: { gte: this.addDays(this.startOfUtcDay(now), 1), lt: this.addDays(this.startOfUtcDay(now), 2) }, ...activityScope } }),
        this.prisma.card.findFirst({ where: { userId, due: { gt: now }, ...cardScope }, orderBy: { due: 'asc' }, select: { due: true } }),
        this.prisma.reviewable.findFirst({ where: { userId, due: { gt: now }, ...activityScope }, orderBy: { due: 'asc' }, select: { due: true } }),
        this.prisma.exam.findFirst({ where: { userId, date: { gte: this.startOfUtcDay(now) } }, orderBy: { date: 'asc' }, select: { id: true, subject: true, date: true } }),
      ]);

    let partial = false;
    let resumableSession: ExperienceSession | null = null;
    try {
      const resumable = await this.experiences.resumable(userId, 20);
      resumableSession = resumable.items.find((session) => session.type === 'review') ?? null;
    } catch {
      partial = true;
    }

    const nextDue = [nextCard?.due, nextActivity?.due]
      .filter((value): value is Date => value instanceof Date)
      .sort((a, b) => a.getTime() - b.getTime())[0];
    const dueCount = flashcardDueCount + activityDueCount;

    return {
      generatedAt: now.toISOString(),
      stats,
      dueCount,
      flashcardDueCount,
      activityDueCount,
      overdueCount: overdueCards + overdueActivities,
      priorityItems: items.slice(0, HOME_PREVIEW_ITEMS),
      context: this.publicContext(context),
      resumableSession,
      plan: {
        today: dueCount,
        tomorrow: tomorrowCards + tomorrowActivities,
        nextDueAt: nextDue?.toISOString() ?? null,
        nextExam: nextExam
          ? { id: nextExam.id, subject: nextExam.subject, daysUntil: this.daysBetween(now, nextExam.date) }
          : null,
      },
      partial,
    };
  }

  async start(userId: string, request: StartReviewSessionRequest): Promise<ReviewSessionView> {
    const now = new Date();
    const context = await this.resolveContext(userId, request, now);
    const limit = request.size === 'all' ? MAX_SESSION_ITEMS : request.size ?? 10;
    const items = await this.candidates(userId, context, limit, now);
    if (items.length === 0) throw new BadRequestException('Nothing is due in this review scope.');

    const activeContexts = this.contextItems(context, now);
    const sessionTitle = context.language?.language ?? context.concept?.name ?? context.exam?.subject ?? context.document?.title;
    const created = await this.experiences.create(userId, {
      type: 'review',
      ...(sessionTitle ? { title: sessionTitle } : {}),
      intent: 'memory-consolidation',
      inputModality: 'text',
      activeContexts,
      currentStep: { id: items[0].reference, label: items[0].prompt, index: 0, state: 'active' },
      progress: { completed: 0, total: items.length },
      sourceReferences: items.map((item) => ({ kind: 'review-item' as const, id: item.reference, title: item.title })),
      links: {
        documentId: context.document?.documentId ?? null,
        goalId: context.goal?.id ?? null,
        languageProfileId: context.language?.id ?? null,
      },
      idempotencyKey: request.idempotencyKey,
    });
    const session = await this.experiences.updateState(userId, created.id, {
      resumeTarget: { kind: 'review', path: '/revision', params: { sessionId: created.id } },
    });
    return this.snapshot(userId, session);
  }

  async session(userId: string, id: string): Promise<ReviewSessionView> {
    const session = await this.experiences.get(userId, id);
    if (session.type !== 'review') throw new NotFoundException('Review session not found.');
    const active = session.status === 'paused' ? await this.experiences.resume(userId, id) : session;
    return this.snapshot(userId, active);
  }

  async grade(
    userId: string,
    sessionId: string,
    request: GradeReviewSessionItemRequest,
  ): Promise<GradeReviewSessionItemResponse> {
    let session = await this.experiences.get(userId, sessionId);
    if (session.type !== 'review') throw new NotFoundException('Review session not found.');
    const references = session.sourceReferences.filter((source) => source.kind === 'review-item').map((source) => source.id);
    if (!references.includes(request.itemReference)) throw new BadRequestException('Item is not part of this review session.');

    const parsed = parseReviewItemReference(request.itemReference);
    if (!parsed) throw new BadRequestException('Invalid review item reference.');

    const existing = session.productions.find((production) => production.referenceId === request.itemReference && production.kind.startsWith('review-rating-'));
    if (existing) {
      const persistedRating = this.productionRating(existing);
      if (parsed.engine === 'flashcard') {
        await this.consolidateLanguageRepair(userId, session, parsed.id, persistedRating);
      }
      const review = await this.snapshot(userId, session);
      return { review, feedback: reviewFeedbackCode(persistedRating), nextReviewAt: review.items.find((item) => item.reference === request.itemReference)?.dueAt ?? null, persisted: true };
    }
    if (session.status === 'completed' || session.status === 'abandoned' || session.status === 'failed') {
      throw new BadRequestException('This review session is already closed.');
    }
    if (session.status === 'paused') session = await this.experiences.resume(userId, sessionId);

    let pending = session.productions.find((production) => production.referenceId === request.itemReference && production.kind.startsWith('review-pending-'));
    const hadPending = !!pending;
    if (!pending) {
      pending = {
        id: `review-pending:${request.itemReference}`,
        kind: `review-pending-${request.rating}`,
        referenceId: request.itemReference,
        createdAt: new Date().toISOString(),
      };
      session = await this.experiences.updateState(userId, sessionId, {
        productions: [...session.productions, pending],
      });
    }

    // A retry may arrive after FSRS committed but before ExperienceSession did.
    // Reconcile the persisted domain record instead of rating the item twice.
    let nextReviewAt = hadPending
      ? await this.persistedReviewSince(userId, parsed, request.rating, pending.createdAt)
      : null;
    if (!nextReviewAt) {
      if (parsed.engine === 'flashcard') {
        const result = await this.cardReviews.review(userId, parsed.id, request.rating);
        nextReviewAt = result.card.due;
      } else {
        const result = await this.revision.review(userId, parsed.id, { rating: request.rating });
        nextReviewAt = result.nextReview;
      }
    }

    const production: ExperienceProduction = {
      id: `review:${request.itemReference}`,
      kind: `review-rating-${request.rating}`,
      referenceId: request.itemReference,
      createdAt: new Date().toISOString(),
    };
    const productions = [
      ...session.productions.filter((item) => item.referenceId !== request.itemReference),
      production,
    ];
    const completed = new Set(productions.map((item) => item.referenceId).filter((value): value is string => !!value));
    const nextReference = references.find((reference) => !completed.has(reference));
    const nextIndex = nextReference ? references.indexOf(nextReference) : -1;
    const nextItems = nextReference ? await this.itemsByReferences(userId, [nextReference], new Date()) : [];

    session = await this.experiences.updateState(userId, sessionId, {
      productions,
      progress: { completed: Math.min(completed.size, references.length), total: references.length },
      currentStep: nextReference
        ? { id: nextReference, label: nextItems[0]?.prompt, index: nextIndex, state: 'active' }
        : null,
    });
    if (!nextReference) session = await this.experiences.complete(userId, sessionId);
    if (parsed.engine === 'flashcard') {
      await this.consolidateLanguageRepair(userId, session, parsed.id, request.rating);
    }

    return {
      review: await this.snapshot(userId, session),
      feedback: reviewFeedbackCode(request.rating),
      nextReviewAt,
      persisted: true,
    };
  }

  private async candidates(userId: string, context: ResolvedContext, limit: number, now: Date): Promise<ReviewExperienceItem[]> {
    const bounded = Math.min(Math.max(limit, 1), MAX_SESSION_ITEMS);
    const targetConceptId = context.concept?.id ?? context.examConceptId ?? undefined;
    const [queue, genericDue] = await Promise.all([
      this.cardSessions.queue(userId, {
        limit: bounded,
        newLimit: bounded,
        reviewLimit: bounded,
        conceptId: targetConceptId,
        documentId: context.document?.documentId,
        deckId: context.language?.vocabDeckId ?? undefined,
      }),
      context.document || context.language
        ? Promise.resolve([])
        : this.revision.due(userId, MAX_SESSION_ITEMS),
    ]);
    const generic = targetConceptId
      ? genericDue.filter((item) => item.kind === 'concept' && item.refId === targetConceptId)
      : genericDue;
    const items = [
      ...(await this.itemsByReferences(userId, queue.cards.map((card) => reviewItemReference('flashcard', card.id)), now)),
      ...(await this.itemsByReferences(userId, generic.map((item) => reviewItemReference('reviewable', item.id)), now)),
    ].map((item) => this.withContextReasons(item, context));
    return items.sort((a, b) => this.priorityScore(b) - this.priorityScore(a) || Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.reference.localeCompare(b.reference)).slice(0, bounded);
  }

  private async itemsByReferences(userId: string, references: readonly string[], now: Date): Promise<ReviewExperienceItem[]> {
    const parsed = references.map(parseReviewItemReference).filter((value): value is NonNullable<ReturnType<typeof parseReviewItemReference>> => !!value);
    const cardIds = parsed.filter((item) => item.engine === 'flashcard').map((item) => item.id);
    const reviewableIds = parsed.filter((item) => item.engine === 'reviewable').map((item) => item.id);
    const [cards, reviewables] = await Promise.all([
      cardIds.length === 0 ? Promise.resolve([] as EnrichedCard[]) : this.prisma.card.findMany({
        where: { userId, id: { in: cardIds } },
        include: {
          deck: {
            select: {
              name: true,
              languageProfiles: { select: { id: true, language: true }, take: 1 },
            },
          },
          sourceDocument: { select: { id: true, title: true } },
          concepts: { include: { concept: { select: { id: true, name: true } } } },
        },
      }),
      reviewableIds.length === 0 ? Promise.resolve([] as Reviewable[]) : this.prisma.reviewable.findMany({ where: { userId, id: { in: reviewableIds } } }),
    ]);
    const conceptIds = reviewables.filter((item) => item.kind === 'concept').map((item) => item.refId);
    const concepts = conceptIds.length === 0 ? [] : await this.prisma.concept.findMany({ where: { userId, id: { in: conceptIds } }, select: { id: true, name: true } });
    const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
    const byReference = new Map<string, ReviewExperienceItem>();

    for (const card of cards as EnrichedCard[]) {
      const signals = this.fsrs.signals({
        stability: card.stability,
        difficulty: card.difficulty,
        due: card.due,
        elapsedDays: card.elapsedDays,
        scheduledDays: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        phase: card.state as MemoryPhase,
        lastReview: card.lastReview,
      }, now);
      const item: ReviewExperienceItem = {
        reference: reviewItemReference('flashcard', card.id),
        id: card.id,
        engine: 'flashcard',
        kind: 'flashcard',
        format: 'flashcard',
        title: card.deck.name,
        prompt: card.front,
        answer: card.back,
        dueAt: card.due.toISOString(),
        priority: signals.priority,
        urgency: signals.urgency,
        state: card.state,
        reps: card.reps,
        lapses: card.lapses,
        concepts: card.concepts.map((link) => link.concept),
        source: card.sourceDocument ? { documentId: card.sourceDocument.id, title: card.sourceDocument.title } : null,
        ...(card.deck.languageProfiles?.[0]
          ? {
              languageProfileId: card.deck.languageProfiles[0].id,
              language: card.deck.languageProfiles[0].language,
            }
          : {}),
        reasons: this.baseReasons(card.due, card.reps, card.state, now),
      };
      byReference.set(item.reference, item);
    }
    for (const reviewable of reviewables) {
      const signals = this.fsrs.signals({
        stability: reviewable.stability,
        difficulty: reviewable.difficulty,
        due: reviewable.due,
        elapsedDays: reviewable.elapsedDays,
        scheduledDays: reviewable.scheduledDays,
        reps: reviewable.reps,
        lapses: reviewable.lapses,
        phase: reviewable.state as MemoryPhase,
        lastReview: reviewable.lastReview,
      }, now);
      const concept = reviewable.kind === 'concept' ? conceptById.get(reviewable.refId) : undefined;
      const item: ReviewExperienceItem = {
        reference: reviewItemReference('reviewable', reviewable.id),
        id: reviewable.id,
        engine: 'reviewable',
        kind: reviewable.kind as ReviewExperienceItem['kind'],
        format: 'free-recall',
        title: reviewable.title,
        prompt: reviewable.title,
        answer: null,
        dueAt: reviewable.due.toISOString(),
        priority: signals.priority,
        urgency: signals.urgency,
        state: reviewable.state,
        reps: reviewable.reps,
        lapses: reviewable.lapses,
        concepts: concept ? [concept] : [],
        source: null,
        reasons: this.baseReasons(reviewable.due, reviewable.reps, reviewable.state, now),
      };
      byReference.set(item.reference, item);
    }
    return references.map((reference) => byReference.get(reference)).filter((item): item is ReviewExperienceItem => !!item);
  }

  private async snapshot(userId: string, session: ExperienceSession): Promise<ReviewSessionView> {
    const references = session.sourceReferences.filter((source) => source.kind === 'review-item').map((source) => source.id);
    const items = await this.itemsByReferences(userId, references, new Date());
    const completedItemReferences = session.productions
      .filter((production) => production.kind.startsWith('review-rating-') && production.referenceId)
      .map((production) => production.referenceId as string);
    return {
      session,
      items,
      completedItemReferences,
      unavailableCount: Math.max(0, references.length - items.length),
      summary: this.summary(session.productions, items),
    };
  }

  private summary(productions: readonly ExperienceProduction[], items: readonly ReviewExperienceItem[]): ReviewSessionSummary {
    const completed = productions.filter((production) => production.kind.startsWith('review-rating-'));
    const ratings: Record<ReviewRating, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const production of completed) ratings[this.productionRating(production)] += 1;
    const completedRefs = new Set(completed.map((production) => production.referenceId));
    const completedItems = items.filter((item) => completedRefs.has(item.reference));
    const concepts = new Map<string, { id: string; name: string }>();
    for (const item of completedItems) for (const concept of item.concepts) concepts.set(concept.id, concept);
    const nextReviewAt = completedItems.map((item) => item.dueAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;
    return {
      reviewed: completed.length,
      ratings,
      difficult: ratings[1] + ratings[2],
      concepts: [...concepts.values()],
      nextReviewAt,
    };
  }

  private baseReasons(due: Date, reps: number, state: string, now: Date): ReviewPriorityReason[] {
    const reasons: ReviewPriorityReason[] = [{ code: 'due-now' }];
    const overdueDays = Math.floor((this.startOfUtcDay(now).getTime() - this.startOfUtcDay(due).getTime()) / DAY_MS);
    if (reps > 0 && overdueDays > 0) reasons.push({ code: 'overdue', value: overdueDays });
    if (state === 'relearning') reasons.push({ code: 'relearning' });
    return reasons;
  }

  private withContextReasons(item: ReviewExperienceItem, context: ResolvedContext): ReviewExperienceItem {
    const reasons = [...item.reasons];
    if (context.concept && item.concepts.some((concept) => concept.id === context.concept?.id)) reasons.push({ code: 'target-concept' });
    if (context.document && item.source?.documentId === context.document.documentId) reasons.push({ code: 'source-document' });
    if (context.exam && context.exam.daysUntil >= 0 && context.exam.daysUntil <= 14 && (!context.examConceptId || item.concepts.some((concept) => concept.id === context.examConceptId))) {
      reasons.push({ code: 'exam-soon', value: context.exam.daysUntil });
    }
    return { ...item, reasons };
  }

  private priorityScore(item: ReviewExperienceItem): number {
    const contextual = item.reasons.reduce((score, reason) => {
      if (reason.code === 'target-concept' || reason.code === 'source-document') return score + 100;
      if (reason.code === 'exam-soon') return score + 50;
      if (reason.code === 'relearning') return score + 25;
      if (reason.code === 'overdue') return score + Math.min(reason.value ?? 0, 20);
      return score;
    }, 0);
    return contextual + reviewPriorityRank(item.priority) * 10;
  }

  private async resolveContext(userId: string, request: RequestedContext, now: Date): Promise<ResolvedContext> {
    const [concept, document, goal, exam, sourceSession, language] = await Promise.all([
      request.conceptId ? this.prisma.concept.findFirst({ where: { id: request.conceptId, userId }, select: { id: true, name: true } }) : null,
      request.documentId ? this.prisma.document.findFirst({ where: { id: request.documentId, userId }, select: { id: true, title: true } }) : null,
      request.goalId ? this.prisma.goal.findFirst({ where: { id: request.goalId, userId }, select: { id: true, title: true } }) : null,
      request.examId ? this.prisma.exam.findFirst({ where: { id: request.examId, userId }, select: { id: true, subject: true, date: true, conceptId: true } }) : null,
      request.sourceSessionId ? this.prisma.experienceSession.findFirst({ where: { id: request.sourceSessionId, userId }, select: { id: true } }) : null,
      request.languageProfileId ? this.prisma.languageProfile.findFirst({
        where: { id: request.languageProfileId, userId },
        select: { id: true, language: true, vocabDeckId: true },
      }) : null,
    ]);
    return {
      concept,
      document: document ? { documentId: document.id, title: document.title } : null,
      goal,
      exam: exam ? { id: exam.id, subject: exam.subject, daysUntil: this.daysBetween(now, exam.date) } : null,
      sourceSessionId: sourceSession?.id ?? null,
      language,
      examConceptId: exam?.conceptId ?? null,
    };
  }

  private publicContext(context: ResolvedContext): ReviewContextView {
    const { examConceptId: _private, ...view } = context;
    return view;
  }

  private contextItems(context: ResolvedContext, now: Date) {
    const addedAt = now.toISOString();
    return [
      { id: 'review', kind: 'revision' as const, scope: 'space' as const, priority: 20, visibility: 'visible' as const, addedAt },
      ...(context.concept ? [{ id: `concept-${context.concept.id}`, kind: 'concept' as const, scope: 'active-object' as const, referenceId: context.concept.id, label: context.concept.name, priority: 90, visibility: 'visible' as const, addedAt }] : []),
      ...(context.document ? [{ id: `document-${context.document.documentId}`, kind: 'document' as const, scope: 'active-object' as const, referenceId: context.document.documentId, label: context.document.title, priority: 80, visibility: 'visible' as const, addedAt }] : []),
      ...(context.goal ? [{ id: `goal-${context.goal.id}`, kind: 'goal' as const, scope: 'experience-session' as const, referenceId: context.goal.id, label: context.goal.title, priority: 50, visibility: 'summary' as const, addedAt }] : []),
      ...(context.exam ? [{ id: `exam-${context.exam.id}`, kind: 'exam' as const, scope: 'experience-session' as const, referenceId: context.exam.id, label: context.exam.subject, priority: 60, visibility: 'visible' as const, addedAt }] : []),
      ...(context.sourceSessionId ? [{ id: `source-${context.sourceSessionId}`, kind: 'revision' as const, scope: 'experience-session' as const, referenceId: context.sourceSessionId, priority: 30, visibility: 'hidden' as const, addedAt }] : []),
      ...(context.language ? [{ id: `language-${context.language.id}`, kind: 'language' as const, scope: 'active-object' as const, referenceId: context.language.id, label: context.language.language, priority: 90, visibility: 'visible' as const, addedAt }] : []),
    ];
  }

  private productionRating(production: ExperienceProduction): ReviewRating {
    const rating = Number(production.kind.replace('review-rating-', ''));
    return rating >= 1 && rating <= 4 ? rating as ReviewRating : 3;
  }

  /**
   * Close the RLLE repair loop only when Review persisted a positive recall for
   * the exact FSRS card created from a repeated language mistake. Review remains
   * the scheduler; this bridge merely projects that real event into the bounded
   * course state. It is best-effort so an unavailable course can never roll back
   * a review that FSRS already committed.
   */
  private async consolidateLanguageRepair(
    userId: string,
    reviewSession: ExperienceSession,
    cardId: string,
    rating: ReviewRating,
  ): Promise<void> {
    if (rating < 3) return;

    try {
      let languageProfileId = reviewSession.links.languageProfileId;
      if (!languageProfileId) {
        const card = await this.prisma.card.findFirst({
          where: { id: cardId, userId },
          select: {
            deck: {
              select: {
                languageProfiles: {
                  where: { userId },
                  take: 2,
                  select: { id: true },
                },
              },
            },
          },
        });
        const profiles = card?.deck?.languageProfiles ?? [];
        // A shared/legacy deck is ambiguous: never guess which course to mutate.
        if (profiles.length !== 1) return;
        languageProfileId = profiles[0]?.id ?? null;
      }
      if (!languageProfileId) return;

      const row = await this.prisma.experienceSession.findFirst({
        where: {
          userId,
          languageProfileId,
          type: 'language',
          intent: 'language-course',
          status: { in: ['active', 'paused'] },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (!row) return;

      const course = await this.experiences.get(userId, row.id);
      const step = course.currentStep;
      if (!step) return;
      const rawState = step.metadata?.rlleCourse;
      if (!this.isRlleRepairState(rawState)) return;

      const matchingMistakeIds = new Set(
        rawState.repairLoops
          .filter((loop) =>
            loop.reviewCardIds.includes(cardId)
            && loop.currentStage === 'reuse-later'
            && Boolean(loop.retryEvidenceId),
          )
          .map((loop) => loop.mistakeId),
      );
      if (matchingMistakeIds.size === 0) return;

      const matchingGapIds = new Set(
        rawState.mistakeMemory
          .filter((mistake) => matchingMistakeIds.has(mistake.id))
          .map((mistake) => mistake.gapId),
      );
      const productionId = `language-repair-consolidated:${cardId}`;
      const alreadyRecorded = course.productions.some((item) => item.id === productionId);

      const nextState = {
        ...rawState,
        repairLoops: rawState.repairLoops.map((loop) => matchingMistakeIds.has(loop.mistakeId)
          ? {
              ...loop,
              currentStage: 'consolidate' as const,
              completedStages: [...new Set([...loop.completedStages, 'reuse-later' as const, 'consolidate' as const])],
            }
          : loop),
        mistakeMemory: rawState.mistakeMemory.map((mistake) => matchingMistakeIds.has(mistake.id)
          ? { ...mistake, repairStage: 'consolidate' as const }
          : mistake),
        gaps: rawState.gaps.map((gap) => matchingGapIds.has(gap.id)
          ? { ...gap, status: 'consolidated' as const }
          : gap),
      };
      const productions = alreadyRecorded
        ? course.productions
        : [...course.productions.slice(-49), {
            id: productionId,
            kind: 'language-repair-consolidated',
            referenceId: cardId,
            createdAt: new Date().toISOString(),
            metadata: {
              reviewSessionId: reviewSession.id,
              rating,
              mistakeIds: [...matchingMistakeIds],
            },
          }];

      const updatedCourse = await this.experiences.updateState(userId, course.id, {
        currentStep: {
          ...step,
          metadata: { ...step.metadata, rlleCourse: nextState },
        },
        productions,
      });
      if (this.isCompletedRlleCourse(nextState) && updatedCourse.status !== 'completed') {
        await this.experiences.complete(userId, updatedCourse.id);
      }
    } catch {
      this.logger.warn('Language repair consolidation was skipped.');
    }
  }

  private isRlleRepairState(value: unknown): value is Record<string, unknown> & {
    gaps: RlleFunctionalGap[];
    mistakeMemory: RlleMistakeMemoryItem[];
    repairLoops: RlleRepairLoop[];
  } {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    return Array.isArray(candidate.gaps)
      && Array.isArray(candidate.mistakeMemory)
      && Array.isArray(candidate.repairLoops);
  }

  private isCompletedRlleCourse(
    state: Record<string, unknown> & { repairLoops: RlleRepairLoop[] },
  ): boolean {
    if (!Array.isArray(state.curriculumIds) || state.curriculumIds.length === 0) return false;
    if (!Array.isArray(state.completedUnitIds)) return false;
    const completed = new Set(
      state.completedUnitIds.filter((value): value is string => typeof value === 'string'),
    );
    if (!state.curriculumIds.every((value) => typeof value === 'string' && completed.has(value))) {
      return false;
    }
    if (state.repairLoops.some((loop) => loop.currentStage !== 'consolidate')) return false;
    const mission = state.currentMission;
    if (mission && typeof mission === 'object') {
      const status = (mission as Record<string, unknown>).status;
      if (status === 'active' || status === 'paused' || status === 'needs-retry') return false;
    }
    return true;
  }

  private async persistedReviewSince(
    userId: string,
    item: { engine: 'flashcard' | 'reviewable'; id: string },
    rating: ReviewRating,
    pendingAt: string,
  ): Promise<string | null> {
    const since = new Date(pendingAt);
    if (Number.isNaN(since.getTime())) return null;
    if (item.engine === 'flashcard') {
      const log = await this.prisma.reviewLog.findFirst({
        where: { userId, cardId: item.id, rating, reviewedAt: { gte: since } },
        orderBy: { reviewedAt: 'desc' },
        select: { id: true },
      });
      if (!log) return null;
      const card = await this.prisma.card.findFirst({ where: { id: item.id, userId }, select: { due: true } });
      return card?.due.toISOString() ?? null;
    }
    const reviewable = await this.prisma.reviewable.findFirst({
      where: { id: item.id, userId, lastReview: { gte: since } },
      select: { due: true },
    });
    return reviewable?.due.toISOString() ?? null;
  }

  private startOfUtcDay(value: Date): Date {
    const date = new Date(value);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private addDays(value: Date, days: number): Date {
    return new Date(value.getTime() + days * DAY_MS);
  }

  private daysBetween(from: Date, to: Date): number {
    return Math.ceil((this.startOfUtcDay(to).getTime() - this.startOfUtcDay(from).getTime()) / DAY_MS);
  }
}
