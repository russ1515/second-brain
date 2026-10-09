/**
 * Language mastery policy shared by the learner UI and the API.
 *
 * This module deliberately contains only versioned, deterministic rules. It
 * does not define a curriculum, generate exercises or award mastery by itself:
 * the API remains the authority that binds these rules to persisted evidence.
 */

export const LANGUAGE_MASTERY_POLICY_VERSION = 'language-mastery-v1' as const;

export const LANGUAGE_MASTERY_THRESHOLD = 0.9;
export const LANGUAGE_REMEDIATION_MINIMUM_EXERCISES = 10;

export const LANGUAGE_MASTERY_PILLARS = [
  'communication-situations',
  'grammar-structures',
  'verbal-system-conjugation',
  'vocabulary-target-lexicon',
  'orthography-graphy-phonetics',
] as const;
export type LanguageMasteryPillar = (typeof LANGUAGE_MASTERY_PILLARS)[number];

export const LANGUAGE_TRAINING_FORMATS = [
  'recognition-mcq',
  'contextual-discrimination',
  'fill-blank-no-hint',
  'sentence-reconstruction',
  'register-matching',
  'error-correction',
  'listening-discrimination',
  'guided-writing',
  'voice-pronunciation',
  'mini-dialogue',
] as const;
export type LanguageTrainingFormat = (typeof LANGUAGE_TRAINING_FORMATS)[number];

export type LanguageTrainingEvidenceState =
  | 'completed'
  | 'incomplete'
  | 'technical-error'
  | 'not-evaluable';

export interface LanguageTrainingEvidence {
  id: string;
  format: LanguageTrainingFormat;
  state: LanguageTrainingEvidenceState;
  /** Whether an in-product hint, model answer or correction was shown before
   * the learner submitted this activity. Training may be assisted, but the
   * fact remains part of the evidence. */
  helpUsed: boolean;
  /** Immutable provenance for the generated lesson content that produced this
   * evidence. Old-version attempts never satisfy a regenerated lesson. */
  lessonId?: string;
  contentVersion?: number;
  exerciseIndex?: number;
  source?: 'exercise-attempt' | 'audio-native-coaching';
  sourceId?: string;
  recordedAt?: string;
  /** Bounded learner-visible feedback retained only when no canonical attempt
   * row exists (currently audio-native coaching). */
  feedbackSummary?: string;
}

export type LanguageAutonomyResponseMode = 'open' | 'voice' | 'dialogue';

export interface LanguageAutonomyItemEvidence {
  id: string;
  responseMode: LanguageAutonomyResponseMode;
  state: 'evaluated' | 'incomplete' | 'technical-error' | 'not-evaluable';
  /** Raw rubric points. The backend compares their ratio before any display
   * rounding. */
  awardedPoints: number | null;
  maximumPoints: number | null;
}

export interface LanguageAutonomyEvidence {
  id: string;
  completed: boolean;
  /** Any controlled in-product help invalidates autonomy for this attempt. */
  helpUsed: boolean;
  /** True when an answer, translation of the expected answer, copyable model
   * or correction was exposed before final submission. */
  answerLeak: boolean;
  items: readonly LanguageAutonomyItemEvidence[];
}

export type LanguageMasteryVerdict = 'mastered' | 'not-mastered' | 'not-evaluable';

export type LanguageMasteryReason =
  | 'training-incomplete'
  | 'autonomy-missing'
  | 'autonomy-incomplete'
  | 'autonomy-assisted'
  | 'autonomy-answer-leak'
  | 'autonomy-item-not-evaluable'
  | 'invalid-rubric'
  | 'below-threshold'
  | 'threshold-met';

export interface LanguageMasteryDecision {
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  verdict: LanguageMasteryVerdict;
  reason: LanguageMasteryReason;
  trainingComplete: boolean;
  missingTrainingFormats: LanguageTrainingFormat[];
  rawScore: number | null;
  threshold: typeof LANGUAGE_MASTERY_THRESHOLD;
  helpUsed: boolean;
}

export function missingLanguageTrainingFormats(
  evidence: readonly LanguageTrainingEvidence[],
): LanguageTrainingFormat[] {
  const completed = new Set(
    evidence.filter((item) => item.state === 'completed').map((item) => item.format),
  );
  return LANGUAGE_TRAINING_FORMATS.filter((format) => !completed.has(format));
}

/**
 * Apply the product gate to persisted evidence. This function never rounds a
 * score and never treats a technical failure as a pedagogical zero.
 */
export function decideLanguageMilestoneMastery(input: {
  training: readonly LanguageTrainingEvidence[];
  autonomy: LanguageAutonomyEvidence | null;
}): LanguageMasteryDecision {
  const missingTrainingFormats = missingLanguageTrainingFormats(input.training);
  const base = {
    policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
    trainingComplete: missingTrainingFormats.length === 0,
    missingTrainingFormats,
    threshold: LANGUAGE_MASTERY_THRESHOLD,
  } as const;

  if (missingTrainingFormats.length > 0) {
    return { ...base, verdict: 'not-evaluable', reason: 'training-incomplete', rawScore: null, helpUsed: false };
  }
  const autonomy = input.autonomy;
  if (!autonomy) {
    return { ...base, verdict: 'not-evaluable', reason: 'autonomy-missing', rawScore: null, helpUsed: false };
  }
  if (autonomy.helpUsed) {
    return { ...base, verdict: 'not-mastered', reason: 'autonomy-assisted', rawScore: null, helpUsed: true };
  }
  if (autonomy.answerLeak) {
    return { ...base, verdict: 'not-mastered', reason: 'autonomy-answer-leak', rawScore: null, helpUsed: false };
  }
  if (!autonomy.completed || autonomy.items.length === 0 || autonomy.items.some((item) => item.state === 'incomplete')) {
    return { ...base, verdict: 'not-evaluable', reason: 'autonomy-incomplete', rawScore: null, helpUsed: false };
  }
  if (autonomy.items.some((item) => item.state === 'technical-error' || item.state === 'not-evaluable')) {
    return { ...base, verdict: 'not-evaluable', reason: 'autonomy-item-not-evaluable', rawScore: null, helpUsed: false };
  }

  let awarded = 0;
  let maximum = 0;
  for (const item of autonomy.items) {
    const itemAwarded = item.awardedPoints;
    const itemMaximum = item.maximumPoints;
    if (
      item.state !== 'evaluated'
      || itemAwarded === null
      || itemMaximum === null
      || !Number.isFinite(itemAwarded)
      || !Number.isFinite(itemMaximum)
      || itemMaximum <= 0
      || itemAwarded < 0
      || itemAwarded > itemMaximum
    ) {
      return { ...base, verdict: 'not-evaluable', reason: 'invalid-rubric', rawScore: null, helpUsed: false };
    }
    awarded += itemAwarded;
    maximum += itemMaximum;
  }
  if (!Number.isFinite(maximum) || maximum <= 0) {
    return { ...base, verdict: 'not-evaluable', reason: 'invalid-rubric', rawScore: null, helpUsed: false };
  }

  const rawScore = awarded / maximum;
  return rawScore >= LANGUAGE_MASTERY_THRESHOLD
    ? { ...base, verdict: 'mastered', reason: 'threshold-met', rawScore, helpUsed: false }
    : { ...base, verdict: 'not-mastered', reason: 'below-threshold', rawScore, helpUsed: false };
}

export function languageRemediationReady(input: {
  requiredExerciseCount?: number;
  evidence: readonly LanguageTrainingEvidence[];
}): boolean {
  const required = input.requiredExerciseCount ?? LANGUAGE_REMEDIATION_MINIMUM_EXERCISES;
  if (!Number.isInteger(required) || required < LANGUAGE_REMEDIATION_MINIMUM_EXERCISES) return false;
  return input.evidence.filter((item) => item.state === 'completed').length >= required;
}
