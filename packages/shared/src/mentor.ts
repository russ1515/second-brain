/** Mentor role (Phase 5, Educational Engine) wire contracts:
 *  "tracks motivation, encourages consistency, celebrates wins, recommends
 *  strategies, keeps streaks." */

export type AchievementKind =
  | 'streak_days'
  | 'cards_reviewed'
  | 'concepts_mastered'
  | 'lessons_completed'
  | 'exercises_correct';

export interface StreakView {
  /** Consecutive active days up to today. Survives until the day is over: a
   *  streak is not broken just because today's work is still ahead. */
  current: number;
  longest: number;
  studiedToday: boolean;
  /** Most recent active LOCAL day (`YYYY-MM-DD`), or null. */
  lastActiveDate: string | null;
  totalActiveDays: number;
}

export interface AchievementView {
  kind: AchievementKind;
  threshold: number;
  /** Human-readable celebration, e.g. "7-day streak". */
  label: string;
  achievedAt: string;
}

/** The numbers the Mentor's encouragement is grounded in — all real, none
 *  invented. */
export interface MentorStats {
  /** Share of all reviews graded ≥ Hard. Null until the first review. */
  retention: number | null;
  cardsReviewed: number;
  conceptsMastered: number;
  lessonsCompleted: number;
  exercisesCorrect: number;
  /** Concepts the twin currently flags as slipping. */
  atRiskConcepts: number;
  dueNow: number;
}

export interface MentorOverview {
  streak: StreakView;
  stats: MentorStats;
  achievements: AchievementView[];
  /** Milestones crossed on THIS request — the client celebrates these. Empty on
   *  every subsequent call: a win is celebrated once. */
  newlyEarned: AchievementView[];
}

/** Coaching from the Mentor, grounded in the stats above. */
export interface MentorBriefing {
  /** 1-2 sentences on where the learner stands. */
  encouragement: string;
  /** Concrete strategies, tied to this learner's actual numbers. */
  strategies: string[];
}
