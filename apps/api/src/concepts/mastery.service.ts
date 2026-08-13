import { Injectable, NotFoundException } from '@nestjs/common';
import type { Card } from '@prisma/client';
import type {
  ConceptMastery,
  ConceptMasteryDetail,
  ConceptScore,
  ErrorFrequency,
  MasteryConfidence,
  MasteryLevel,
  RevisionPriority,
  StrengthsWeaknesses,
  TwinOverview,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsService } from '../flashcards/fsrs.service';

const STRONG_THRESHOLD = 0.8;
const DEVELOPING_THRESHOLD = 0.5;

/** Sort weight for revision priority (higher = surfaced first). */
const PRIORITY_RANK: Record<RevisionPriority, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/** Concept with its linked cards loaded (extra fields are ignored). */
export type ConceptWithCards = {
  id: string;
  name: string;
  cards: { card: Card }[];
};

/** Strong-mastery cutoff, shared with the learning-path analysis. */
export const STRONG_MASTERY = STRONG_THRESHOLD;

/** Digital Twin: derives per-concept mastery from linked cards' FSRS state. */
@Injectable()
export class MasteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fsrs: FsrsService,
  ) {}

  /** Mastery for a single concept. */
  async conceptMastery(userId: string, conceptId: string): Promise<ConceptMastery> {
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
      include: { cards: { include: { card: true } } },
    });
    if (!concept || concept.userId !== userId) {
      throw new NotFoundException('Concept not found.');
    }
    return this.computeMastery(concept, new Date());
  }

  /** Whole-twin overview: every concept ranked weakest-first, plus a summary. */
  async twin(userId: string): Promise<TwinOverview> {
    const now = new Date();
    const concepts = await this.prisma.concept.findMany({
      where: { userId },
      include: { cards: { include: { card: true } } },
    });

    const masteries = concepts.map((c) => this.computeMastery(c, now));
    masteries.sort((a, b) => this.rank(a) - this.rank(b));

    const tracked = masteries.filter((m) => m.cardCount > 0);
    const trackedScores = tracked
      .map((m) => m.mastery)
      .filter((m): m is number => m !== null);

    return {
      concepts: masteries,
      summary: {
        totalConcepts: masteries.length,
        trackedConcepts: tracked.length,
        strongConcepts: masteries.filter((m) => m.level === 'strong').length,
        weakConcepts: masteries.filter((m) => m.level === 'weak').length,
        unlearnedConcepts: tracked.filter((m) => m.reviewedCount === 0).length,
        averageMastery:
          trackedScores.length > 0
            ? trackedScores.reduce((s, v) => s + v, 0) / trackedScores.length
            : null,
      },
    };
  }

  /**
   * Per-concept mastery enriched with the task-4.3 signals — a star rating plus
   * confidence, error frequency, estimated forgetting and revision priority.
   * Ranked most-urgent / weakest first. All derived from the same FSRS state.
   */
  async masteryDetails(userId: string): Promise<ConceptMasteryDetail[]> {
    const now = new Date();
    const concepts = await this.prisma.concept.findMany({
      where: { userId },
      include: { cards: { include: { card: true } } },
    });
    const details = concepts.map((c) => this.detail(c, now));
    return details.sort(
      (a, b) =>
        PRIORITY_RANK[b.revisionPriority] - PRIORITY_RANK[a.revisionPriority] ||
        (a.mastery ?? 2) - (b.mastery ?? 2),
    );
  }

  /**
   * Strengths & weaknesses (task 4.5): split the scored concepts into what the
   * learner is strong at vs what is slipping — the view the AI uses to
   * personalise the next sessions. Only tracked concepts appear.
   */
  async strengthsWeaknesses(userId: string): Promise<StrengthsWeaknesses> {
    const details = await this.masteryDetails(userId);
    const scored = details.filter(
      (d): d is ConceptMasteryDetail & { mastery: number } => d.mastery !== null,
    );
    const score = (d: (typeof scored)[number]): ConceptScore => ({
      conceptId: d.conceptId,
      name: d.name,
      mastery: d.mastery,
      stars: d.stars,
    });

    const strengths = scored
      .filter((d) => d.level === 'strong')
      .sort((a, b) => b.mastery - a.mastery)
      .map(score);
    // Weak, or decaying (has due cards and not yet strong).
    const weaknesses = scored
      .filter((d) => d.level === 'weak' || (d.dueCount > 0 && d.level !== 'strong'))
      .sort((a, b) => a.mastery - b.mastery)
      .map(score);

    return { strengths, weaknesses };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Enrich one concept's mastery with the five per-concept signals. */
  private detail(concept: ConceptWithCards, now: Date): ConceptMasteryDetail {
    const base = this.computeMastery(concept, now);
    const cards = concept.cards.map((cc) => cc.card);
    const reps = cards.reduce((sum, c) => sum + c.reps, 0);

    if (base.mastery === null) {
      // No cards yet — nothing to score.
      return {
        ...base,
        stars: 0,
        confidence: 'low',
        errorFrequency: 'none',
        forgettingRisk: null,
        revisionPriority: 'medium',
      };
    }

    const stars = Math.max(1, Math.min(5, Math.round(base.mastery * 5)));
    const forgettingRisk = Math.round((1 - base.mastery) * 100);

    // Confidence: how much review evidence backs the estimate.
    let confidence: MasteryConfidence = 'low';
    if (base.reviewedCount === base.cardCount && reps >= base.cardCount * 3) {
      confidence = 'high';
    } else if (base.reviewedCount > 0) {
      confidence = 'medium';
    }

    // Error frequency: FSRS lapses relative to attempts.
    const errorRate = reps > 0 ? base.lapses / reps : 0;
    const errorFrequency: ErrorFrequency =
      base.lapses === 0 ? 'none' : errorRate >= 0.25 ? 'high' : 'low';

    // Revision priority: due + weak = urgent; blends decay with actionability.
    const overdue = base.dueCount > 0;
    let revisionPriority: RevisionPriority;
    if (overdue && base.mastery < DEVELOPING_THRESHOLD) revisionPriority = 'urgent';
    else if (overdue || base.mastery < DEVELOPING_THRESHOLD) revisionPriority = 'high';
    else if (base.mastery < STRONG_THRESHOLD) revisionPriority = 'medium';
    else revisionPriority = 'low';

    return { ...base, stars, confidence, errorFrequency, forgettingRisk, revisionPriority };
  }

  /** Mastery for one concept given its linked cards. Public so the learning-path
   *  analysis can reuse it. */
  computeMastery(concept: ConceptWithCards, now: Date): ConceptMastery {
    const cards = concept.cards.map((cc) => cc.card);
    const base = {
      conceptId: concept.id,
      name: concept.name,
      cardCount: cards.length,
      reviewedCount: cards.filter((c) => c.reps > 0).length,
      dueCount: cards.filter((c) => c.due.getTime() <= now.getTime()).length,
      lapses: cards.reduce((sum, c) => sum + c.lapses, 0),
    };

    if (cards.length === 0) {
      return { ...base, mastery: null, level: 'unknown' };
    }

    const mastery =
      cards.reduce((sum, c) => sum + this.fsrs.retrievability(c, now), 0) /
      cards.length;

    return { ...base, mastery, level: this.level(mastery) };
  }

  private level(mastery: number): MasteryLevel {
    if (mastery >= STRONG_THRESHOLD) return 'strong';
    if (mastery >= DEVELOPING_THRESHOLD) return 'developing';
    return 'weak';
  }

  /** Sort key: tracked concepts by mastery ascending (weakest first), then
   *  untracked (unknown) concepts last. */
  private rank(m: ConceptMastery): number {
    return m.mastery === null ? Number.POSITIVE_INFINITY : m.mastery;
  }
}
