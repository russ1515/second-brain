import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Reviewable } from '@prisma/client';
import type {
  RegisterReviewableRequest,
  ReviewableKind,
  ReviewableView,
  ReviewPriority,
  RevisionForecast,
  RevisionForecastView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { FsrsEngine, type MemoryPhase, type MemoryState } from './fsrs-engine';

const PRIORITY_RANK: Record<ReviewPriority, number> = {
  urgent: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/**
 * The FSRS Revision Engine's persistence + queue (task 5.1).
 *
 * Registers any pedagogical activity as a {@link Reviewable}, applies grades via
 * the independent {@link FsrsEngine}, and produces the unified review queue —
 * across lessons, exercises, quizzes, homework and the rest — each item carrying
 * its next date, priority, urgency and memory score.
 */
@Injectable()
export class RevisionEngineService {
  private readonly logger = new Logger(RevisionEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: FsrsEngine,
  ) {}

  /** Register an activity for spaced repetition (idempotent per kind+ref). */
  async register(
    userId: string,
    dto: RegisterReviewableRequest,
  ): Promise<ReviewableView> {
    const item = await this.prisma.reviewable.upsert({
      where: { userId_kind_refId: { userId, kind: dto.kind, refId: dto.refId } },
      create: { userId, kind: dto.kind, refId: dto.refId, title: dto.title.slice(0, 200) },
      update: { title: dto.title.slice(0, 200) },
    });
    return this.toView(item);
  }

  /** Best-effort registration, for activities to call without fear of failing. */
  async track(
    userId: string,
    kind: ReviewableKind,
    refId: string,
    title: string,
  ): Promise<void> {
    try {
      await this.register(userId, { kind, refId, title });
    } catch (e) {
      this.logger.warn(`track(${kind}) failed: ${(e as Error).message}`);
    }
  }

  /** Register-and-grade an activity in one call (idempotent per kind+ref).
   *  Best-effort: activities call this after producing a result and never fail
   *  over it. This is how quiz/exercise results feed the engine. */
  async gradeActivity(
    userId: string,
    kind: ReviewableKind,
    refId: string,
    title: string,
    input: { rating?: 1 | 2 | 3 | 4; score?: number },
  ): Promise<void> {
    try {
      const item = await this.prisma.reviewable.upsert({
        where: { userId_kind_refId: { userId, kind, refId } },
        create: { userId, kind, refId, title: title.slice(0, 200) },
        update: {},
      });
      await this.review(userId, item.id, input);
    } catch (e) {
      this.logger.warn(`gradeActivity(${kind}) failed: ${(e as Error).message}`);
    }
  }

  /** Apply a grade (or a 0..1 score) and reschedule via FSRS. */
  async review(
    userId: string,
    id: string,
    input: { rating?: 1 | 2 | 3 | 4; score?: number },
  ): Promise<ReviewableView> {
    const item = await this.prisma.reviewable.findUnique({ where: { id } });
    if (!item || item.userId !== userId) {
      throw new NotFoundException('Reviewable not found.');
    }
    const grade =
      input.rating ??
      (input.score !== undefined ? this.engine.gradeFromScore(input.score) : 3);

    const now = new Date();
    const next = this.engine.review(this.toState(item), grade, now);
    const saved = await this.prisma.reviewable.update({
      where: { id },
      data: {
        state: next.phase,
        stability: next.stability,
        difficulty: next.difficulty,
        due: next.due,
        elapsedDays: next.elapsedDays,
        scheduledDays: next.scheduledDays,
        reps: next.reps,
        lapses: next.lapses,
        lastReview: next.lastReview,
      },
    });
    return this.toView(saved, now);
  }

  /** The whole review queue, most urgent first. */
  async queue(userId: string): Promise<ReviewableView[]> {
    const items = await this.prisma.reviewable.findMany({ where: { userId } });
    const now = new Date();
    return items
      .map((i) => this.toView(i, now))
      .sort(
        (a, b) =>
          Number(b.due) - Number(a.due) ||
          PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
          a.memoryScore - b.memoryScore,
      );
  }

  /**
   * Predictive Revision (task 5.5): anticipate WHEN each reviewed item's recall
   * will fall below the risk floor. Only items not yet risky (recall still above
   * the floor) appear — those are the ones the AI can get ahead of. Soonest
   * crossings first.
   */
  async forecasts(userId: string): Promise<RevisionForecastView> {
    const RECALL_FLOOR = 0.5; // act before recall drops under 50%
    const HORIZON_DAYS = 60;
    const now = new Date();
    const items = await this.prisma.reviewable.findMany({
      where: { userId, reps: { gt: 0 } },
    });

    const forecasts: RevisionForecast[] = [];
    for (const item of items) {
      const state = this.toState(item);
      const currentR = this.engine.retrievability(state, now);
      if (currentR < RECALL_FLOOR) continue; // already risky — that's FSRS's job
      const crossing = this.engine.forecastCrossing(state, RECALL_FLOOR, HORIZON_DAYS, now);
      if (!crossing) continue; // stays safe within the horizon
      forecasts.push({
        reviewableId: item.id,
        kind: item.kind as ReviewableKind,
        title: item.title,
        currentMemory: Math.round(currentR * 100),
        daysUntil: crossing.daysUntil,
        forgettingAt: Math.round((1 - RECALL_FLOOR) * 100),
        date: crossing.date.toISOString(),
      });
    }
    forecasts.sort((a, b) => a.daysUntil - b.daysUntil);
    return { threshold: Math.round((1 - RECALL_FLOOR) * 100), forecasts };
  }

  /** Only the items due now, most urgent first. */
  async due(userId: string): Promise<ReviewableView[]> {
    const now = new Date();
    const items = await this.prisma.reviewable.findMany({
      where: { userId, due: { lte: now } },
    });
    return items
      .map((i) => this.toView(i, now))
      .sort(
        (a, b) =>
          PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
          a.memoryScore - b.memoryScore,
      );
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private toState(item: Reviewable): MemoryState {
    return {
      stability: item.stability,
      difficulty: item.difficulty,
      due: item.due,
      elapsedDays: item.elapsedDays,
      scheduledDays: item.scheduledDays,
      reps: item.reps,
      lapses: item.lapses,
      phase: item.state as MemoryPhase,
      lastReview: item.lastReview,
    };
  }

  private toView(item: Reviewable, now: Date = new Date()): ReviewableView {
    const signals = this.engine.signals(this.toState(item), now);
    return {
      id: item.id,
      kind: item.kind as ReviewableKind,
      refId: item.refId,
      title: item.title,
      reps: item.reps,
      lapses: item.lapses,
      due: item.due.getTime() <= now.getTime(),
      ...signals,
    };
  }
}
