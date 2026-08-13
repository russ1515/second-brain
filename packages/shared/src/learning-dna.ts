/**
 * Learning DNA Engine (Sprint 9 ⭐, transversal).
 *
 * The deepest brick of the V1's intelligence. Where the Digital Twin captures
 * the learner's CURRENT state (what they know), the Learning DNA captures the
 * STABLE profile of HOW they learn best — built progressively as evidence
 * accumulates: how they memorize, when they perform best, which modality and
 * explanation depth suit them, and which formats retain best. It is transversal:
 * one shared profile the other engines can read. Each trait carries a confidence
 * that grows with data, and any trait without enough evidence says so rather
 * than guessing.
 */

/** The five traits of the learning fingerprint. */
export type DnaTraitKey =
  | 'memory'
  | 'peakTime'
  | 'modality'
  | 'explanation'
  | 'retentionFormat';

/** How settled a trait is — it strengthens as the engine sees more data. */
export type DnaConfidenceBand = 'emerging' | 'forming' | 'established';

/** One learned trait of the learner's DNA. */
export interface DnaTrait {
  key: DnaTraitKey;
  /** The learned value, short (e.g. "Hands-on practice", "Mornings"). */
  label: string;
  /** What it means and what the engine based it on (explainability). */
  summary: string;
  /** 0..100 — grows as evidence accumulates; low when still learning. */
  confidence: number;
  band: DnaConfidenceBand;
  /** Data points behind the trait. */
  evidence: number;
}

/** The learner's full Learning DNA. */
export interface LearningDna {
  traits: DnaTrait[];
  /** 0..100 — how completely the DNA is mapped so far (builds progressively). */
  maturity: number;
  /** Total interactions the engine has learned from. */
  interactions: number;
  updatedAt: string;
}
