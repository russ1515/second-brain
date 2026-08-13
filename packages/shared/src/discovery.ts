/**
 * Recommendation Engine (Sprint 9.4).
 *
 * A personalized, multi-type feed of resources the AI proposes automatically:
 * new lessons, exercises, readings, reviews, practicals and documents. Each
 * recommendation is explicable (carries its reason) and its lifecycle keeps the
 * AI's automatic SUGGESTION distinct from the learner's DECISION (accept /
 * dismiss). It composes the twin, the learning path, the FSRS queue and the
 * library — no ranking logic is duplicated. (Videos are a later addition.)
 */

/** The kinds of resource the engine can recommend. */
export type ResourceKind =
  | 'lesson'
  | 'exercise'
  | 'reading'
  | 'review'
  | 'practical'
  | 'document';

/** Whether a recommendation is still offered, or the learner has acted on it. */
export type RecommendationStatus = 'suggested' | 'accepted' | 'dismissed';

/** Where acting on a recommendation leads. */
export interface RecommendationTarget {
  kind: 'concept' | 'document' | 'route';
  id: string;
}

/** One personalized resource recommendation. */
export interface ResourceRecommendation {
  id: string;
  kind: ResourceKind;
  title: string;
  reason: string;
  status: RecommendationStatus;
  target: RecommendationTarget | null;
  createdAt: string;
}

/** The learner's recommendation feed (highest priority first). */
export interface RecommendationFeed {
  recommendations: ResourceRecommendation[];
}
