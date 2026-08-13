import type { ExamPriority } from './goals';

/**
 * Academic Success Predictor (Sprint 9.6).
 *
 * For each upcoming exam the system estimates three things: the preparation
 * level, the probability of success, and — crucially — its OWN confidence in
 * that estimate (how much evidence backs it). The goal is not to foretell the
 * result but to help the learner prepare better, so every estimate travels with
 * the factors behind it and concrete advice. It reuses the exams' derived
 * preparation and the twin's per-concept evidence; it invents no new mastery
 * arithmetic.
 */

/** How much evidence backs the estimate. */
export type ConfidenceBand = 'low' | 'medium' | 'high';

/** The predictor's read on a single exam. */
export interface ExamPrediction {
  examId: string;
  subject: string;
  /** YYYY-MM-DD. */
  date: string;
  daysUntil: number;
  priority: ExamPriority;
  /** Preparation 0..100 (from mastery of the matching concept), null if untracked. */
  preparation: number | null;
  /** Estimated probability of success 0..100, null when preparation is unknown. */
  successProbability: number | null;
  /** Model confidence 0..100 — how much evidence backs the estimate. */
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** The factors the estimate rests on (traceability + explainability). */
  factors: string[];
  /** How to prepare better — the actual point of the prediction. */
  advice: string;
}

/** The learner's success forecast across upcoming exams (soonest first). */
export interface SuccessForecast {
  exams: ExamPrediction[];
  generatedAt: string;
}
