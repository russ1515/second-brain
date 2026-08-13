/** Proactive AI coach (sprint 2, task 8): the app opens and the teacher speaks
 *  first — a reasoned, time-boxed study plan with a real Learning Score. */

/** A real 0-100 score = the learner's average concept mastery. `null` until
 *  there is anything measurable. */
export interface LearningScore {
  score: number | null;
  band: 'new' | 'weak' | 'building' | 'strong';
}

export type RecommendationKind = 'review' | 'lesson' | 'vocabulary';

export interface StudyRecommendation {
  kind: RecommendationKind;
  /** What to work on, e.g. "Biology" or "Spanish". */
  activity: string;
  /** Suggested minutes — an estimate from the real due counts. */
  minutes: number;
  /** Why this, grounded in the learner's state. */
  reason: string;
  conceptId?: string;
  languageProfileId?: string;
}

export interface ProactiveBriefing {
  score: LearningScore;
  /** The score the learner would reach by doing the review (real projection:
   *  the recommended at-risk concepts restored to mastered). Null when there is
   *  nothing to project from. */
  projectedScore: number | null;
  /** Percentage-point gain (projectedScore − score), or null. */
  projectedGain: number | null;
  recommendations: StudyRecommendation[];
  /** "Today I suggest…" — the client prefixes the greeting with the name. */
  headline: string;
  /** "You're gradually forgetting…" */
  why: string;
}
