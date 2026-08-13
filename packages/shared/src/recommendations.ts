/** Proactive Recommendations (Sprint 4, task 4.7).
 *
 * The AI stops merely analysing and starts acting like a mentor: it recommends
 * concrete, timed actions ("a 12-min revision on DNA"), strategic advice
 * ("consolidate before learning something new") and progression ("you can move
 * up a level"). Each is derived from the learner's real state and carries an
 * action the app can launch. */

export type ProactiveRecommendationKind =
  /** A timed revision of a concept that's due / slipping. */
  | 'review'
  /** Consolidate weak spots before taking on anything new. */
  | 'consolidate'
  /** A concept mastered — ready for the next level. */
  | 'levelUp'
  /** Everything solid — ready to learn something new. */
  | 'advance';

export interface ProactiveRecommendation {
  kind: ProactiveRecommendationKind;
  /** Concept or language the recommendation is about. */
  subject?: string;
  /** Concept to act on, when the action targets one. */
  conceptId?: string;
  /** Suggested minutes (review). */
  minutes?: number;
}

export interface ProactivePlan {
  recommendations: ProactiveRecommendation[];
}
