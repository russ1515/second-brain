/** AI Insights (Sprint 4, task 4.6).
 *
 * The AI explains its recommendations in plain language — "you progress fast in
 * X", "you forget Y after N days", "you focus best mid-morning". Each insight is
 * DERIVED from real data and shipped as a structured record (kind + params) so
 * the app can render it in the learner's language. We only ever claim what the
 * data supports — no fabricated effects. */

import type { FocusWindow, LearningStyle, WorkRhythm } from './learner-profile';

export type InsightKind =
  | 'strength'
  | 'forgetting'
  | 'atRisk'
  | 'focusWindow'
  | 'accuracy'
  | 'rhythm'
  | 'style';

/** One insight. The fields set depend on `kind`; the client picks a template. */
export interface Insight {
  kind: InsightKind;
  /** Concept name (strength / forgetting / atRisk). */
  concept?: string;
  /** A percentage (strength mastery, accuracy). */
  percent?: number;
  /** Retention in days (forgetting). */
  days?: number;
  /** A count (rhythm interactions). */
  count?: number;
  /** Peak activity hour range (focusWindow), 0..23. */
  fromHour?: number;
  toHour?: number;
  window?: FocusWindow;
  style?: LearningStyle;
  rhythm?: WorkRhythm;
}

export interface LearnerInsights {
  insights: Insight[];
}
