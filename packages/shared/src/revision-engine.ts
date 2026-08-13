/** FSRS Revision Engine (Sprint 5, task 5.1).
 *
 * A spaced-repetition engine that is TOTALLY INDEPENDENT of flashcards. Any
 * pedagogical activity — a lesson, exercise, quiz, language drill, practical,
 * homework or report — can be registered as a "reviewable" and scheduled by
 * FSRS. Activities feed it grades (from quiz/exercise results, corrections,
 * evaluations…); it produces a next date, priority, urgency and memory score. */

export type ReviewableKind =
  | 'lesson'
  | 'exercise'
  | 'quiz'
  | 'language'
  | 'practical'
  | 'homework'
  | 'report'
  | 'flashcard'
  | 'concept';

export type ReviewPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ReviewUrgency = 'new' | 'scheduled' | 'soon' | 'overdue';

/** The engine's outputs for one reviewable at a moment in time. */
export interface ReviewSignals {
  /** Probability of recall right now (0..1) via the FSRS forgetting curve. */
  retrievability: number;
  /** 1 − retrievability. */
  forgettingProbability: number;
  /** Memory score 0..100 (retrievability as a percentage). */
  memoryScore: number;
  /** When the item is next due (ISO-8601). */
  nextReview: string;
  priority: ReviewPriority;
  urgency: ReviewUrgency;
}

/** A schedulable pedagogical item + its current FSRS signals. */
export interface ReviewableView extends ReviewSignals {
  id: string;
  kind: ReviewableKind;
  /** The underlying entity id (lessonId, homeworkId, conceptId…). */
  refId: string;
  title: string;
  reps: number;
  lapses: number;
  /** Whether it is due now. */
  due: boolean;
}

export interface RegisterReviewableRequest {
  kind: ReviewableKind;
  refId: string;
  title: string;
}

/** A predicted forgetting event (task 5.5): the AI anticipates when an item's
 *  recall will fall below the risk floor, so it can act BEFORE it's forgotten. */
export interface RevisionForecast {
  reviewableId: string;
  kind: ReviewableKind;
  title: string;
  /** Recall now, 0..100. */
  currentMemory: number;
  /** Days until forgetting crosses the risk threshold. */
  daysUntil: number;
  /** Projected forgetting % at the crossing (i.e. 100 − recall floor). */
  forgettingAt: number;
  /** The projected crossing date (ISO). */
  date: string;
}

export interface RevisionForecastView {
  /** The forgetting threshold (%) these predictions anticipate. */
  threshold: number;
  forecasts: RevisionForecast[];
}

/** A review = a grade (1 Again · 2 Hard · 3 Good · 4 Easy), plus an optional
 *  score (0..1 from a quiz/exercise) the engine can convert to a grade. */
export interface ReviewReviewableRequest {
  rating?: 1 | 2 | 3 | 4;
  /** 0..1 result; used when `rating` is absent (quiz/exercise auto-grading). */
  score?: number;
}
