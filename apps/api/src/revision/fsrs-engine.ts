import { Injectable } from '@nestjs/common';
import { fsrs, type FSRS, type Grade } from 'ts-fsrs';
import type {
  ReviewPriority,
  ReviewSignals,
  ReviewUrgency,
} from '@second-brain/shared';

/** The four scheduling states, matching ts-fsrs's numeric enum order. */
export type MemoryPhase = 'new' | 'learning' | 'review' | 'relearning';

const PHASE_TO_NUM: Record<MemoryPhase, number> = {
  new: 0,
  learning: 1,
  review: 2,
  relearning: 3,
};
const NUM_TO_PHASE: MemoryPhase[] = ['new', 'learning', 'review', 'relearning'];

const DAY_MS = 86_400_000;
const STRONG = 0.9;
const WEAK = 0.7;

/**
 * A generic memory state — the ONLY thing the engine knows about. It is not a
 * flashcard, a lesson or anything specific: any activity that carries these
 * fields can be scheduled by FSRS.
 */
export interface MemoryState {
  stability: number;
  difficulty: number;
  due: Date;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  phase: MemoryPhase;
  lastReview: Date | null;
}

/**
 * The independent FSRS Revision Engine (task 5.1).
 *
 * A pure wrapper around the reference FSRS scheduler that operates on a generic
 * {@link MemoryState}. It computes stability, difficulty, retrievability,
 * forgetting probability and the next review — and derives a memory score,
 * priority and urgency — WITHOUT any knowledge of flashcards or the database.
 * Every pedagogical activity reuses this one engine.
 */
@Injectable()
export class FsrsEngine {
  private readonly scheduler: FSRS = fsrs();

  /** A brand-new memory state (nothing learned yet). */
  fresh(now: Date = new Date()): MemoryState {
    return {
      stability: 0,
      difficulty: 0,
      due: now,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      phase: 'new',
      lastReview: null,
    };
  }

  /** Apply a grade (1 Again · 2 Hard · 3 Good · 4 Easy); returns the next state. */
  review(state: MemoryState, grade: 1 | 2 | 3 | 4, now: Date = new Date()): MemoryState {
    const { card: next } = this.scheduler.next(this.toCard(state), now, grade as Grade);
    return {
      stability: next.stability,
      difficulty: next.difficulty,
      due: next.due,
      elapsedDays: next.elapsed_days,
      scheduledDays: next.scheduled_days,
      reps: next.reps,
      lapses: next.lapses,
      phase: NUM_TO_PHASE[next.state],
      lastReview: next.last_review ?? now,
    };
  }

  /** Probability of recall now (0..1). 0 until first reviewed. */
  retrievability(state: MemoryState, now: Date = new Date()): number {
    if (state.reps === 0 || !state.lastReview) return 0;
    return this.scheduler.get_retrievability(this.toCard(state), now, false) as number;
  }

  /**
   * Predictive layer (task 5.5): project the FSRS forgetting curve FORWARD and
   * find the day recall will drop below `recallFloor`. FSRS tells you what's due
   * now; this anticipates — "in N days your recall of X will fall under 70%" —
   * so the teacher can act before. Returns null if it stays safe within
   * `horizonDays`, or the day it crosses (0 if already below).
   */
  forecastCrossing(
    state: MemoryState,
    recallFloor: number,
    horizonDays: number,
    now: Date = new Date(),
  ): { daysUntil: number; date: Date; recallAtCrossing: number } | null {
    if (state.reps === 0 || !state.lastReview) return null; // nothing learned to forget
    for (let day = 0; day <= horizonDays; day++) {
      const at = new Date(now.getTime() + day * DAY_MS);
      const r = this.retrievability(state, at);
      if (r < recallFloor) {
        return { daysUntil: day, date: at, recallAtCrossing: r };
      }
    }
    return null;
  }

  /** Convert a 0..1 activity result (quiz/exercise score) into an FSRS grade. */
  gradeFromScore(score: number): 1 | 2 | 3 | 4 {
    if (score >= 0.9) return 4; // Easy
    if (score >= 0.7) return 3; // Good
    if (score >= 0.4) return 2; // Hard
    return 1; // Again
  }

  /** All engine outputs for a state at `now`: next date, priority, urgency,
   *  memory score, retrievability and forgetting probability. */
  signals(state: MemoryState, now: Date = new Date()): ReviewSignals {
    const retrievability = this.retrievability(state, now);
    const overdueDays = (now.getTime() - state.due.getTime()) / DAY_MS;
    const isOverdue = state.reps > 0 && overdueDays >= 0;

    const urgency: ReviewUrgency =
      state.reps === 0
        ? 'new'
        : isOverdue
          ? 'overdue'
          : overdueDays >= -1
            ? 'soon'
            : 'scheduled';

    const priority: ReviewPriority = this.priority(retrievability, isOverdue, state.reps);

    return {
      retrievability,
      forgettingProbability: state.reps === 0 ? 1 : 1 - retrievability,
      memoryScore: Math.round(retrievability * 100),
      nextReview: state.due.toISOString(),
      priority,
      urgency,
    };
  }

  private priority(retrievability: number, overdue: boolean, reps: number): ReviewPriority {
    if (reps === 0) return 'medium'; // never reviewed — worth doing, not urgent
    if (overdue && retrievability < WEAK) return 'urgent';
    if (overdue || retrievability < WEAK) return 'high';
    if (retrievability < STRONG) return 'medium';
    return 'low';
  }

  private toCard(state: MemoryState) {
    return {
      due: state.due,
      stability: state.stability,
      difficulty: state.difficulty,
      elapsed_days: state.elapsedDays,
      scheduled_days: state.scheduledDays,
      reps: state.reps,
      lapses: state.lapses,
      state: PHASE_TO_NUM[state.phase],
      last_review: state.lastReview ?? undefined,
    };
  }
}
