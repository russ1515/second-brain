import { Injectable } from '@nestjs/common';
import type { CardState } from '@prisma/client';
import type { ReviewQueue, ReviewStats } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toCardView } from './card.mapper';

const DEFAULT_NEW_LIMIT = 20;
const DEFAULT_REVIEW_LIMIT = 200;
const MAX_LIMIT = 1000;

/** Cross-deck study sessions and dashboard stats. */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** The day's queue across all decks: due review cards first (up to the daily
   *  review limit), then new cards (up to the daily new limit). Limits count
   *  what has already been studied today so the queue shrinks as you review. */
  async queue(
    userId: string,
    options: { newLimit?: number; reviewLimit?: number } = {},
  ): Promise<ReviewQueue> {
    const now = new Date();
    const startOfDay = this.startOfUtcDay(now);
    const newLimit = this.clampLimit(options.newLimit, DEFAULT_NEW_LIMIT);
    const reviewLimit = this.clampLimit(options.reviewLimit, DEFAULT_REVIEW_LIMIT);

    const [newIntroducedToday, reviewsDoneToday] = await Promise.all([
      this.prisma.reviewLog.count({
        where: { userId, state: 'new', reviewedAt: { gte: startOfDay } },
      }),
      this.prisma.reviewLog.count({
        where: { userId, state: { not: 'new' }, reviewedAt: { gte: startOfDay } },
      }),
    ]);

    const newRemaining = Math.max(0, newLimit - newIntroducedToday);
    const reviewRemaining = Math.max(0, reviewLimit - reviewsDoneToday);

    const reviewCards =
      reviewRemaining > 0
        ? await this.prisma.card.findMany({
            where: { userId, state: { not: 'new' }, due: { lte: now } },
            orderBy: { due: 'asc' },
            take: reviewRemaining,
          })
        : [];
    const newCards =
      newRemaining > 0
        ? await this.prisma.card.findMany({
            where: { userId, state: 'new', due: { lte: now } },
            orderBy: { createdAt: 'asc' },
            take: newRemaining,
          })
        : [];

    return {
      cards: [...reviewCards, ...newCards].map(toCardView),
      newRemaining,
      reviewRemaining,
    };
  }

  /** Dashboard counts for the current user. */
  async stats(userId: string): Promise<ReviewStats> {
    const now = new Date();
    const startOfDay = this.startOfUtcDay(now);

    const [due, byState, reviewsToday, totalReviews, goodReviews] =
      await Promise.all([
        this.prisma.card.count({ where: { userId, due: { lte: now } } }),
        this.prisma.card.groupBy({
          by: ['state'],
          where: { userId },
          _count: { _all: true },
        }),
        this.prisma.reviewLog.count({
          where: { userId, reviewedAt: { gte: startOfDay } },
        }),
        this.prisma.reviewLog.count({ where: { userId } }),
        this.prisma.reviewLog.count({ where: { userId, rating: { gte: 2 } } }),
      ]);

    const counts = new Map<CardState, number>(
      byState.map((g) => [g.state, g._count._all]),
    );

    return {
      due,
      new: counts.get('new') ?? 0,
      learning: counts.get('learning') ?? 0,
      review: counts.get('review') ?? 0,
      relearning: counts.get('relearning') ?? 0,
      reviewsToday,
      retention: totalReviews > 0 ? goodReviews / totalReviews : null,
    };
  }

  private startOfUtcDay(now: Date): Date {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }

  private clampLimit(value: number | undefined, fallback: number): number {
    if (value === undefined) {
      return fallback;
    }
    return Math.min(Math.max(value, 0), MAX_LIMIT);
  }
}
