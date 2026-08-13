/**
 * Learning Prediction Engine (Sprint 9.3).
 *
 * A forward-looking engine: instead of reporting the present, it forecasts the
 * risks on the learner's trajectory — dropping out, hitting difficulty ahead,
 * being overloaded, losing motivation, or forgetting what they learned — each
 * as a probability with a probable CAUSE, a recommended ACTION, and the SIGNALS
 * it was computed from. It composes the twin, the mentor's streak and the FSRS
 * forecast; it recomputes none of their logic.
 */

/** The five trajectory risks the engine anticipates. */
export type PredictionKind =
  | 'dropout'
  | 'difficulty'
  | 'overload'
  | 'motivation'
  | 'forgetting';

/** Severity band derived from the probability. */
export type RiskLevel = 'low' | 'moderate' | 'high';

/** One predicted risk. `action` is an automatic RECOMMENDATION, not something
 *  the engine silently applies — the learner stays in control. */
export interface RiskPrediction {
  kind: PredictionKind;
  /** 0..100. */
  probability: number;
  level: RiskLevel;
  /** The most probable cause, in plain language. */
  cause: string;
  /** The recommended action to defuse the risk. */
  action: string;
  /** The raw signals behind the number (traceability + explainability). */
  reasons: string[];
}

/** The learner's full risk forecast, highest-probability first. */
export interface LearningPredictionView {
  predictions: RiskPrediction[];
  /** The single most pressing risk, or null when everything is calm. */
  topRisk: RiskPrediction | null;
  generatedAt: string;
}
