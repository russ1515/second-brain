import { Injectable } from '@nestjs/common';
import type { Card, CardState } from '@prisma/client';
import { type Prisma } from '@prisma/client';
import { fsrs, type FSRS, type Grade } from 'ts-fsrs';
import type { ReviewRating } from '@second-brain/shared';

/** ts-fsrs State is a numeric enum (New=0…Relearning=3); our Prisma enum uses the
 *  matching string names in the same order. */
const STATE_TO_NUM: Record<CardState, number> = {
  new: 0,
  learning: 1,
  review: 2,
  relearning: 3,
};
const NUM_TO_STATE: CardState[] = ['new', 'learning', 'review', 'relearning'];

/** The subset of card columns FSRS mutates on each review. */
export type FsrsUpdate = Pick<
  Prisma.CardUpdateInput,
  | 'state'
  | 'stability'
  | 'difficulty'
  | 'due'
  | 'elapsedDays'
  | 'scheduledDays'
  | 'reps'
  | 'lapses'
  | 'lastReview'
>;

export interface ReviewComputation {
  update: FsrsUpdate;
  /** Card state *before* this review (for the review log). */
  previousState: CardState;
  scheduledDays: number;
}

/** Wraps the reference FSRS scheduler (ts-fsrs) with default parameters. */
@Injectable()
export class FsrsService {
  private readonly scheduler: FSRS = fsrs();

  /** Apply a rating to a card and return the columns to persist. */
  review(card: Card, rating: ReviewRating, now: Date = new Date()): ReviewComputation {
    const { card: next } = this.scheduler.next(
      {
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsedDays,
        scheduled_days: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        state: STATE_TO_NUM[card.state],
        last_review: card.lastReview ?? undefined,
      },
      now,
      rating as Grade,
    );

    return {
      previousState: card.state,
      scheduledDays: next.scheduled_days,
      update: {
        state: NUM_TO_STATE[next.state],
        stability: next.stability,
        difficulty: next.difficulty,
        due: next.due,
        elapsedDays: next.elapsed_days,
        scheduledDays: next.scheduled_days,
        reps: next.reps,
        lapses: next.lapses,
        lastReview: next.last_review ?? now,
      },
    };
  }

  /** Current probability of recall (0..1) for a card, via the FSRS forgetting
   *  curve. A card that has never been reviewed returns 0 (not yet learned). */
  retrievability(card: Card, now: Date = new Date()): number {
    if (card.reps === 0 || !card.lastReview) {
      return 0;
    }
    return this.scheduler.get_retrievability(
      {
        due: card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsedDays,
        scheduled_days: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        state: STATE_TO_NUM[card.state],
        last_review: card.lastReview,
      },
      now,
      false,
    ) as number;
  }
}
