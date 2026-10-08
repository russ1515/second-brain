/**
 * Canonical learning-completion evidence shared by Home, Calendar, Review,
 * Brain and learning reports.
 *
 * A completion says that a versioned learning unit reached its required final
 * evaluated activity. It does not say that the learner mastered the material.
 * Every score remains nullable: `null` means "not evaluated", never zero.
 */

export const LEARNING_EVIDENCE_DIMENSIONS = [
  'knowledge',
  'understanding',
  'application',
  'reasoning',
  'critical_reflection',
  'perspective',
] as const;

export type LearningEvidenceDimension = (typeof LEARNING_EVIDENCE_DIMENSIONS)[number];
export type LearningCompletionKind = 'lesson' | 'language_unit';
export type LearningEvidenceSourceKind =
  | 'exercise_attempt'
  | 'assessment_submission'
  | 'language_capability';

const LANGUAGE_UNIT_REF_PREFIX = 'language-unit:';

/** A curriculum unit id is reused across target languages. Its canonical
 * completion identity must therefore include the owned language profile. */
export function languageUnitLearningRef(languageProfileId: string, unitId: string): string {
  return `${LANGUAGE_UNIT_REF_PREFIX}${languageProfileId}:${unitId}`;
}

/** Read both the canonical profile-scoped identity and the pre-release plain
 * unit form so projections remain tolerant during a rolling deployment. */
export function languageUnitIdFromLearningRef(learningRefId: string): string {
  if (!learningRefId.startsWith(LANGUAGE_UNIT_REF_PREFIX)) return learningRefId;
  const separator = learningRefId.indexOf(':', LANGUAGE_UNIT_REF_PREFIX.length);
  return separator < 0 ? learningRefId : learningRefId.slice(separator + 1);
}

export interface LearningCriterionResult {
  id: string;
  label: string;
  /** Null when the criterion was observed but has no binary success rule. */
  met: boolean | null;
  /** Normalised only when the underlying evaluator supplied a score. */
  score: number | null;
}

export interface LearningDimensionResult {
  dimension: LearningEvidenceDimension;
  score: number | null;
  criterionIds: string[];
  evidenceRefIds: string[];
}

export type LearningDimensionScores = Record<
  LearningEvidenceDimension,
  LearningDimensionResult
>;

export interface LearningCompletionResult {
  /** `evaluated` is neutral: completion is not mastery or automatic success. */
  outcome: 'evaluated' | 'demonstrated' | 'not_demonstrated';
  score: number | null;
  passed: boolean | null;
  feedback: string | null;
}

export interface LearningCompletionProvenance {
  schemaVersion: 1;
  contentVersion: number;
  evidenceSource: LearningEvidenceSourceKind;
  evidenceRefIds: string[];
  experienceSessionId: string | null;
  evaluatedAt: string;
}

export interface LearningCompletionView {
  id: string;
  kind: LearningCompletionKind;
  learningRefId: string;
  title: string;
  contentVersion: number;
  status: 'verified' | 'revoked';
  goalIds: string[];
  startedAt: string | null;
  finalizedAt: string;
  criteria: LearningCriterionResult[];
  result: LearningCompletionResult;
  dimensions: LearningDimensionScores;
  provenance: LearningCompletionProvenance;
}

export interface FinalizeLessonCompletionInput {
  lessonId: string;
  evidence:
    | { kind: 'exercise_attempt'; id: string }
    | { kind: 'assessment_submission'; id: string };
  experienceSessionId?: string;
  startedAt?: string;
  goalIds?: string[];
  /** Optional explicit rubric output from the trusted server-side evaluator. */
  dimensions?: Partial<Record<LearningEvidenceDimension, number | null>>;
}

export interface FinalizeLanguageUnitCompletionInput {
  languageProfileId: string;
  unitId: string;
  experienceSessionId: string;
  /** Controlled evidence ids already persisted in the owned RLLE session. */
  evidenceIds: string[];
  startedAt?: string;
  goalIds?: string[];
  dimensions?: Partial<Record<LearningEvidenceDimension, number | null>>;
}

export interface LearningDimensionProgress {
  dimension: LearningEvidenceDimension;
  /** Arithmetic mean of explicit normalised observations, expressed 0..100. */
  percent: number | null;
  evaluatedEvidenceCount: number;
  latestEvidenceAt: string | null;
  completionIds: string[];
}

export interface EvidenceBasedLearningProgress {
  completedCount: number;
  dimensions: LearningDimensionProgress[];
  generatedAt: string;
}

export interface LearningHistoryEntry {
  completionId: string;
  kind: LearningCompletionKind;
  learningRefId: string;
  title: string;
  objective: string | null;
  startedAt: string | null;
  finalizedAt: string;
  result: LearningCompletionResult;
  dimensions: LearningDimensionScores;
  provenance: LearningCompletionProvenance;
  goalIds: string[];
}

export interface LearningHistoryView {
  items: LearningHistoryEntry[];
  generatedAt: string;
}

export function emptyLearningDimensionScores(): LearningDimensionScores {
  return Object.fromEntries(
    LEARNING_EVIDENCE_DIMENSIONS.map((dimension) => [
      dimension,
      { dimension, score: null, criterionIds: [], evidenceRefIds: [] },
    ]),
  ) as unknown as LearningDimensionScores;
}

export function isNormalisedLearningScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
