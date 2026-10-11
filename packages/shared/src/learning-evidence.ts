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
export type LearningCompletionKind =
  | 'lesson'
  | 'language_unit'
  | 'language_milestone'
  | 'language_pillar_exam';
export type LearningEvidenceSourceKind =
  | 'exercise_attempt'
  | 'assessment_submission'
  | 'language_capability'
  | 'language_mastery_attempt';

const LANGUAGE_UNIT_REF_PREFIX = 'language-unit:';
const LANGUAGE_MASTERY_REF_PREFIX = 'language-mastery:';

export type LanguageMasteryCompletionScopeKind = 'milestone' | 'pillar_exam';

export interface LanguageMasteryCompletionIdentity {
  languageProfileId: string;
  scopeKind: LanguageMasteryCompletionScopeKind;
  scopeKey: string;
  policyVersion: string;
  masteryContentVersion: string | null;
  contentDefinitionId: string | null;
}

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

/** Canonical, profile-scoped identity for one publishable mastery target.
 * Attempt ids are deliberately excluded so retries cannot award the same
 * versioned scope twice. */
export function languageMasteryLearningRef(input: LanguageMasteryCompletionIdentity): string {
  const parts = [
    input.languageProfileId,
    input.scopeKind,
    input.scopeKey,
    input.policyVersion,
    input.masteryContentVersion ?? '-',
    input.contentDefinitionId ?? '-',
  ].map((part) => encodeURIComponent(part));
  return `${LANGUAGE_MASTERY_REF_PREFIX}${parts.join(':')}`;
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

export interface StandardLearningCompletionProvenance {
  schemaVersion: 1;
  contentVersion: number;
  evidenceSource: Exclude<LearningEvidenceSourceKind, 'language_mastery_attempt'>;
  evidenceRefIds: string[];
  experienceSessionId: string | null;
  evaluatedAt: string;
}

export interface LanguageMasteryCompletionProvenance {
  schemaVersion: 2;
  contentVersion: number;
  evidenceSource: 'language_mastery_attempt';
  /** Journal attempt first, then its immutable AssessmentSubmission. */
  evidenceRefIds: [string, string];
  experienceSessionId: string | null;
  evaluatedAt: string;
  languageMastery: {
    scopeKind: LanguageMasteryCompletionScopeKind;
    scopeKey: string;
    targetId: string;
    mappingVersion: string;
    policyVersion: string;
    masteryContentVersion: string | null;
    contentDefinitionId: string | null;
  };
}

export type LearningCompletionProvenance =
  | StandardLearningCompletionProvenance
  | LanguageMasteryCompletionProvenance;

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

/** Internal server contract. The caller supplies only the owned journal id;
 * verdict, score, provenance and identity are always reloaded server-side. */
export interface FinalizeLanguageMasteryCompletionInput {
  attemptId: string;
}

export interface FinalizeLegacyLanguageUnitCompletionInput {
  languageProfileId: string;
  unitId: string;
  experienceSessionId: string;
  /** Capability evidence used by the currently deployed RLLE path while the
   * stricter mastery policy remains behind its rollout gate. */
  evidenceIds: string[];
  startedAt?: string;
  goalIds?: string[];
  dimensions?: Partial<Record<LearningEvidenceDimension, number | null>>;
}

export interface FinalizeMasteryLanguageUnitCompletionInput {
  languageProfileId: string;
  unitId: string;
  experienceSessionId: string;
  /** The exact generated lesson revision assessed by the autonomy attempt. */
  lessonId: string;
  lessonContentVersion: number;
  /** Owned, fully graded autonomy proof. The API recomputes its raw score from
   * rubric points; callers cannot promote the rounded display score. */
  assessmentSubmissionId: string;
  policyVersion: import('./language-mastery').LanguageMasteryDecision['policyVersion'];
  /** Candidate server-side milestone proof. The completion gate validates it
   * against the owned lesson attempts and sealed assessment submission before
   * the RLLE course state is allowed to unlock. */
  mastery: import('./real-life-language').RlleMilestoneMasteryState;
  /** @deprecated Pre-mastery capability ids remain readable in historical
   * session state but cannot prove a new-policy completion. */
  evidenceIds?: string[];
  startedAt?: string;
  goalIds?: string[];
  dimensions?: Partial<Record<LearningEvidenceDimension, number | null>>;
}

export type FinalizeLanguageUnitCompletionInput =
  | FinalizeLegacyLanguageUnitCompletionInput
  | FinalizeMasteryLanguageUnitCompletionInput;

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
