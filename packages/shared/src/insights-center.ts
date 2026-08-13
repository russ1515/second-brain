/**
 * AI Insights Center (Sprint 9.7).
 *
 * A single intelligence hub where the learner discovers their strengths,
 * weaknesses, progress, habits, performance and areas to improve — every finding
 * explained in plain language ("the AI always explains why"). It COMPOSES the
 * existing engines (strengths/weaknesses, the twin, the 4.6 insights, the streak,
 * and raw study signals); it computes no new scores. A read-only, derived view,
 * like Analytics — nothing here is a decision to persist.
 */

/** The six facets of the intelligence center. */
export type InsightCategoryKey =
  | 'strengths'
  | 'weaknesses'
  | 'progress'
  | 'habits'
  | 'performance'
  | 'improvement';

/** One explained finding within a category. */
export interface InsightItem {
  title: string;
  /** The "why" — what in the data supports this. */
  detail: string;
}

/** A facet of the learner's intelligence, with its findings. */
export interface InsightCategory {
  key: InsightCategoryKey;
  headline: string;
  items: InsightItem[];
}

/** The full AI Insights Center. */
export interface InsightsCenter {
  categories: InsightCategory[];
  generatedAt: string;
}
