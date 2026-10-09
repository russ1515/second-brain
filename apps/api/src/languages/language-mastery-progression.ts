import {
  LANGUAGE_MASTERY_POLICY_VERSION,
  LANGUAGE_MASTERY_THRESHOLD,
  LANGUAGE_TRAINING_FORMATS,
  LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
  RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
  RLLE_LANGUAGE_MASTERY_UNIT_MAP,
  decideRlleLevelPillarGate,
  getRlleLevelPillarPlans,
  rlleMilestoneEvidenceScopeKey,
  type CefrLevel,
  type LanguageMasteryDecision,
  type LanguageMasteryPillar,
  type LanguageTrainingEvidence,
  type RlleLevelPillarGateDecision,
  type RllePillarExamResult,
  type SupportedLanguageCode,
} from '@second-brain/shared';

export const RLLE_STRICT_PROGRESSION_SCHEMA_VERSION = 2 as const;

export type StoredRlleStrictMilestoneStatus =
  | 'training'
  | 'mastered'
  | 'not-evaluable'
  | 'legacy-unverified';

export interface StoredRlleStrictMilestoneEvidence {
  evidenceId: string;
  decision: LanguageMasteryDecision;
  evaluatedAt: string;
}

export interface StoredRlleStrictMilestone {
  scopeKey: string;
  mappingVersion: typeof RLLE_LANGUAGE_MASTERY_MAPPING_VERSION;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  languageCode: SupportedLanguageCode;
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  milestoneId: string;
  unitId: string;
  status: StoredRlleStrictMilestoneStatus;
  decision: LanguageMasteryDecision | null;
  evidenceId: string | null;
  /** Immutable audit history. The summary fields above point at the latest decision. */
  evidenceHistory: StoredRlleStrictMilestoneEvidence[];
  masteredAt: string | null;
}

export interface StoredRllePillarExamAttempt {
  id: string;
  verdict: LanguageMasteryDecision['verdict'];
  rawScore: number | null;
  evidenceId: string;
  evaluatedAt: string;
}

export interface StoredRllePillarRemediation {
  sourceAttemptId: string;
  requiredExerciseCount: typeof LANGUAGE_REMEDIATION_MINIMUM_EXERCISES;
  baselineExerciseIds: string[];
  completedExerciseIds: string[];
  /** Append-only canonical targeted exercise evidence, including neutral NOT_EVALUABLE events. */
  evidenceHistory: StoredRlleTargetedRemediationEvidence[];
}

export interface StoredRlleTargetedRemediationEvidence
  extends Omit<
    LanguageTrainingEvidence,
    'lessonId' | 'contentVersion' | 'exerciseIndex' | 'source' | 'sourceId' | 'recordedAt'
  > {
  mappingVersion: typeof RLLE_LANGUAGE_MASTERY_MAPPING_VERSION;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  languageCode: SupportedLanguageCode;
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  examId: string;
  sourceAttemptId: string;
  lessonId: string;
  contentVersion: number;
  exerciseIndex: number;
  source: NonNullable<LanguageTrainingEvidence['source']>;
  sourceId: string;
  recordedAt: string;
}

export type StoredRllePillarExamStatus =
  | 'locked'
  | 'ready'
  | 'active'
  | 'mastered'
  | 'remediation'
  | 'not-evaluable';

export interface StoredRllePillarExam {
  mappingVersion: typeof RLLE_LANGUAGE_MASTERY_MAPPING_VERSION;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  languageCode: SupportedLanguageCode;
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  examId: string;
  status: StoredRllePillarExamStatus;
  attempts: StoredRllePillarExamAttempt[];
  activeAttemptId: string | null;
  remediation: StoredRllePillarRemediation | null;
  masteredAt: string | null;
}

export interface StoredRlleStrictProgression {
  schemaVersion: typeof RLLE_STRICT_PROGRESSION_SCHEMA_VERSION;
  mappingVersion: typeof RLLE_LANGUAGE_MASTERY_MAPPING_VERSION;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  languageCode: SupportedLanguageCode;
  /** Display-only history. Never seed strict mastery from these ids. */
  legacyUnitIds: string[];
  milestones: Record<string, StoredRlleStrictMilestone>;
  pillarExams: Record<string, StoredRllePillarExam>;
}

function expectedExamStatus(
  level: CefrLevel,
  pillar: LanguageMasteryPillar,
  milestones: Record<string, StoredRlleStrictMilestone>,
  pillarExams: Record<string, StoredRllePillarExam>,
): StoredRllePillarExamStatus {
  const plans = getRlleLevelPillarPlans(level);
  const plan = plans.find((candidate) => candidate.pillar === pillar);
  if (!plan?.contentReady) return 'locked';
  const previousMastered = plans
    .filter((candidate) => candidate.pillarOrder < plan.pillarOrder)
    .every((candidate) => pillarExams[candidate.examId]?.status === 'mastered');
  const milestonesMastered = plan.requiredMilestoneIds.every(
    (milestoneId) => milestones[milestoneId]?.status === 'mastered',
  );
  return previousMastered && milestonesMastered ? 'ready' : 'locked';
}

function refreshExamLocks(input: StoredRlleStrictProgression): StoredRlleStrictProgression {
  const exams = { ...input.pillarExams };
  for (const exam of Object.values(exams)) {
    if (['mastered', 'active', 'remediation', 'not-evaluable'].includes(exam.status)) continue;
    exams[exam.examId] = {
      ...exam,
      status: expectedExamStatus(exam.level, exam.pillar, input.milestones, exams),
    };
  }
  return { ...input, pillarExams: exams };
}

export function createRlleStrictProgression(input: {
  languageCode: SupportedLanguageCode;
  curriculumUnitIds: readonly string[];
  legacyCompletedUnitIds?: readonly string[];
}): StoredRlleStrictProgression {
  const acceptedUnits = new Set(input.curriculumUnitIds);
  const legacy = [...new Set(input.legacyCompletedUnitIds ?? [])]
    .filter((unitId) => acceptedUnits.has(unitId));
  const milestones: Record<string, StoredRlleStrictMilestone> = {};
  for (const mapped of RLLE_LANGUAGE_MASTERY_UNIT_MAP.filter((unit) => acceptedUnits.has(unit.unitId))) {
    for (const milestone of mapped.milestones) {
      milestones[milestone.id] = {
        scopeKey: rlleMilestoneEvidenceScopeKey({ languageCode: input.languageCode, milestone }),
        mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
        policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
        languageCode: input.languageCode,
        level: milestone.level,
        pillar: milestone.pillar,
        milestoneId: milestone.id,
        unitId: mapped.unitId,
        status: legacy.includes(mapped.unitId) ? 'legacy-unverified' : 'training',
        decision: null,
        evidenceId: null,
        evidenceHistory: [],
        masteredAt: null,
      };
    }
  }
  const levels = [...new Set(Object.values(milestones).map((milestone) => milestone.level))];
  const pillarExams: Record<string, StoredRllePillarExam> = {};
  for (const level of levels) {
    for (const plan of getRlleLevelPillarPlans(level)) {
      pillarExams[plan.examId] = {
        mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
        policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
        languageCode: input.languageCode,
        level,
        pillar: plan.pillar,
        examId: plan.examId,
        status: 'locked',
        attempts: [],
        activeAttemptId: null,
        remediation: null,
        masteredAt: null,
      };
    }
  }
  return refreshExamLocks({
    schemaVersion: RLLE_STRICT_PROGRESSION_SCHEMA_VERSION,
    mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
    languageCode: input.languageCode,
    legacyUnitIds: legacy,
    milestones,
    pillarExams,
  });
}

function requireMilestone(state: StoredRlleStrictProgression, id: string): StoredRlleStrictMilestone {
  const milestone = state.milestones[id];
  if (!milestone) throw new Error('Language mastery milestone is outside this course scope.');
  return milestone;
}

export function recordRlleMilestoneDecision(
  state: StoredRlleStrictProgression,
  input: {
    languageCode: SupportedLanguageCode;
    level: CefrLevel;
    pillar: LanguageMasteryPillar;
    milestoneId: string;
    scopeKey: string;
    evidenceId: string;
    decision: LanguageMasteryDecision;
    evaluatedAt: string;
  },
): StoredRlleStrictProgression {
  const milestone = requireMilestone(state, input.milestoneId);
  if (
    state.mappingVersion !== RLLE_LANGUAGE_MASTERY_MAPPING_VERSION
    || state.languageCode !== input.languageCode
    || milestone.scopeKey !== input.scopeKey
    || milestone.level !== input.level
    || milestone.pillar !== input.pillar
    || input.decision.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION
    || !input.evidenceId.trim()
  ) throw new Error('Language mastery milestone evidence scope is invalid.');
  if (milestone.evidenceHistory.some((item) => item.evidenceId === input.evidenceId)) {
    throw new Error('Language mastery milestone evidence must be append-only and unique.');
  }
  const status: StoredRlleStrictMilestoneStatus = input.decision.verdict === 'mastered'
    ? 'mastered'
    : input.decision.verdict === 'not-evaluable'
      ? 'not-evaluable'
      : 'training';
  return refreshExamLocks({
    ...state,
    milestones: {
      ...state.milestones,
      [milestone.milestoneId]: {
        ...milestone,
        status,
        decision: input.decision,
        evidenceId: input.evidenceId,
        evidenceHistory: [
          ...milestone.evidenceHistory,
          {
            evidenceId: input.evidenceId,
            decision: input.decision,
            evaluatedAt: input.evaluatedAt,
          },
        ],
        masteredAt: status === 'mastered' ? input.evaluatedAt : null,
      },
    },
  });
}

function requireExam(state: StoredRlleStrictProgression, id: string): StoredRllePillarExam {
  const exam = state.pillarExams[id];
  if (!exam) throw new Error('Language pillar exam is outside this course scope.');
  return exam;
}

export function startRllePillarExam(
  state: StoredRlleStrictProgression,
  input: { examId: string; attemptId: string },
): StoredRlleStrictProgression {
  const refreshed = refreshExamLocks(state);
  const exam = requireExam(refreshed, input.examId);
  const retryAfterNotEvaluable = exam.status === 'not-evaluable'
    && expectedExamStatus(exam.level, exam.pillar, refreshed.milestones, refreshed.pillarExams) === 'ready';
  if (exam.status !== 'ready' && !retryAfterNotEvaluable) {
    throw new Error('All mandatory milestones and previous pillar exams must be mastered first.');
  }
  if (!input.attemptId.trim()) throw new Error('A pillar exam attempt id is required.');
  if (exam.attempts.some((attempt) => attempt.id === input.attemptId)) {
    throw new Error('Pillar exam attempts are append-only and require a fresh id.');
  }
  return {
    ...refreshed,
    pillarExams: {
      ...refreshed.pillarExams,
      [exam.examId]: { ...exam, status: 'active', activeAttemptId: input.attemptId },
    },
  };
}

export function recordRllePillarExamDecision(
  state: StoredRlleStrictProgression,
  input: {
    examId: string;
    attemptId: string;
    evidenceId: string;
    decision: LanguageMasteryDecision;
    evaluatedAt: string;
    baselineExerciseIds: readonly string[];
  },
): StoredRlleStrictProgression {
  const exam = requireExam(state, input.examId);
  if (exam.status !== 'active' || exam.activeAttemptId !== input.attemptId) {
    throw new Error('That pillar exam attempt is not active.');
  }
  if (input.decision.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION || !input.evidenceId.trim()) {
    throw new Error('Pillar exam evidence is invalid.');
  }
  const rawScore = input.decision.rawScore;
  if (input.decision.verdict === 'mastered' && (rawScore === null || rawScore < LANGUAGE_MASTERY_THRESHOLD)) {
    throw new Error('Pillar exam mastery cannot bypass the raw 90 percent threshold.');
  }
  const attempt: StoredRllePillarExamAttempt = {
    id: input.attemptId,
    verdict: input.decision.verdict,
    rawScore,
    evidenceId: input.evidenceId,
    evaluatedAt: input.evaluatedAt,
  };
  if (exam.attempts.some((item) => item.id === attempt.id || item.evidenceId === attempt.evidenceId)) {
    throw new Error('Pillar exam attempts and evidence must be append-only and unique.');
  }
  const attempts = [...exam.attempts, attempt];
  const baselineExerciseIds = [...new Set(input.baselineExerciseIds.filter(Boolean))];
  const nextExam: StoredRllePillarExam = input.decision.verdict === 'mastered'
    ? {
        ...exam,
        status: 'mastered',
        attempts,
        activeAttemptId: null,
        remediation: null,
        masteredAt: input.evaluatedAt,
      }
    : input.decision.verdict === 'not-evaluable'
      ? {
          ...exam,
          status: 'not-evaluable',
          attempts,
          activeAttemptId: null,
          remediation: null,
          masteredAt: null,
        }
      : {
          ...exam,
          status: 'remediation',
          attempts,
          activeAttemptId: null,
          remediation: {
            sourceAttemptId: input.attemptId,
            requiredExerciseCount: LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
            baselineExerciseIds,
            completedExerciseIds: [],
            evidenceHistory: [],
          },
          masteredAt: null,
        };
  return refreshExamLocks({
    ...state,
    pillarExams: { ...state.pillarExams, [exam.examId]: nextExam },
  });
}

export function recordRllePillarRemediationExercises(
  state: StoredRlleStrictProgression,
  input: { examId: string; evidence: readonly StoredRlleTargetedRemediationEvidence[] },
): StoredRlleStrictProgression {
  const exam = requireExam(state, input.examId);
  if (exam.status !== 'remediation' || !exam.remediation) {
    throw new Error('This pillar exam does not require remediation.');
  }
  if (!Array.isArray(input.evidence) || input.evidence.length === 0) {
    throw new Error('Canonical targeted remediation evidence is required.');
  }
  const sourceAttempt = exam.attempts.find(
    (attempt) => attempt.id === exam.remediation?.sourceAttemptId,
  );
  if (!sourceAttempt || sourceAttempt.verdict !== 'not-mastered') {
    throw new Error('Targeted remediation must remain tied to its failed pillar exam attempt.');
  }
  const formats = new Set<string>(LANGUAGE_TRAINING_FORMATS);
  const baseline = new Set(exam.remediation.baselineExerciseIds);
  const knownIds = new Set([
    ...exam.remediation.baselineExerciseIds,
    ...exam.remediation.evidenceHistory.map((item) => item.id),
  ]);
  const knownSourceIds = new Set([
    ...exam.remediation.baselineExerciseIds,
    ...exam.remediation.evidenceHistory.map((item) => item.sourceId),
  ]);
  const knownProofKeys = new Set(
    exam.remediation.evidenceHistory.map(remediationProofKey),
  );
  const incomingIds = new Set<string>();
  const incomingSourceIds = new Set<string>();
  const incomingProofKeys = new Set<string>();

  for (const evidence of input.evidence) {
    if (
      evidence.mappingVersion !== state.mappingVersion
      || evidence.policyVersion !== state.policyVersion
      || evidence.languageCode !== state.languageCode
      || evidence.level !== exam.level
      || evidence.pillar !== exam.pillar
      || evidence.examId !== exam.examId
      || evidence.sourceAttemptId !== exam.remediation.sourceAttemptId
      || !evidence.id?.trim()
      || !evidence.lessonId?.trim()
      || !Number.isInteger(evidence.contentVersion)
      || evidence.contentVersion < 1
      || !Number.isInteger(evidence.exerciseIndex)
      || evidence.exerciseIndex < 0
      || !evidence.sourceId?.trim()
      || !evidence.recordedAt?.trim()
      || Number.isNaN(Date.parse(evidence.recordedAt))
      || typeof evidence.helpUsed !== 'boolean'
      || !formats.has(evidence.format)
      || !['exercise-attempt', 'audio-native-coaching'].includes(evidence.source)
      || !['completed', 'not-evaluable'].includes(evidence.state)
    ) {
      throw new Error('Targeted remediation evidence scope or provenance is invalid.');
    }
    const proofKey = remediationProofKey(evidence);
    if (
      baseline.has(evidence.id)
      || baseline.has(evidence.sourceId)
      || knownIds.has(evidence.id)
      || knownSourceIds.has(evidence.sourceId)
      || knownProofKeys.has(proofKey)
      || incomingIds.has(evidence.id)
      || incomingSourceIds.has(evidence.sourceId)
      || incomingProofKeys.has(proofKey)
    ) {
      throw new Error('Remediation evidence must be genuinely new and distinct.');
    }
    incomingIds.add(evidence.id);
    incomingSourceIds.add(evidence.sourceId);
    incomingProofKeys.add(proofKey);
  }

  const evidenceHistory = [...exam.remediation.evidenceHistory, ...input.evidence];
  const completedExerciseIds = evidenceHistory
    .filter((item) => item.state === 'completed')
    .map((item) => item.id);
  const nextExam: StoredRllePillarExam = {
    ...exam,
    status: completedExerciseIds.length >= exam.remediation.requiredExerciseCount
      ? 'ready'
      : 'remediation',
    remediation: { ...exam.remediation, completedExerciseIds, evidenceHistory },
  };
  return { ...state, pillarExams: { ...state.pillarExams, [exam.examId]: nextExam } };
}

function remediationProofKey(evidence: StoredRlleTargetedRemediationEvidence): string {
  return [
    evidence.lessonId,
    evidence.contentVersion,
    evidence.exerciseIndex,
    evidence.source,
    evidence.sourceId,
  ].join(':');
}

export function rlleLevelGate(
  state: StoredRlleStrictProgression,
  level: CefrLevel,
): RlleLevelPillarGateDecision {
  const milestones = Object.values(state.milestones)
    .filter((milestone) => milestone.level === level)
    .map((milestone) => ({
      milestoneId: milestone.milestoneId,
      verdict: milestone.status === 'mastered'
        ? 'mastered' as const
        : milestone.status === 'not-evaluable'
          ? 'not-evaluable' as const
          : 'not-mastered' as const,
    }));
  const exams: RllePillarExamResult[] = Object.values(state.pillarExams)
    .filter((exam) => exam.level === level && exam.attempts.length > 0)
    .map((exam) => {
      const latest = exam.attempts.at(-1)!;
      return {
        examId: exam.examId,
        pillar: exam.pillar,
        verdict: latest.verdict,
        rawScore: latest.rawScore,
      };
    });
  return decideRlleLevelPillarGate({ level, milestones, exams });
}

export function rlleStrictProgressionAggregate(state: StoredRlleStrictProgression): {
  masteredMilestones: number;
  totalMilestones: number;
  masteredPillarExams: number;
  totalPillarExams: number;
  masteredLevels: number;
} {
  const levels = [...new Set(Object.values(state.milestones).map((item) => item.level))];
  return {
    masteredMilestones: Object.values(state.milestones).filter((item) => item.status === 'mastered').length,
    totalMilestones: Object.values(state.milestones).length,
    masteredPillarExams: Object.values(state.pillarExams).filter((item) => item.status === 'mastered').length,
    totalPillarExams: Object.values(state.pillarExams).length,
    masteredLevels: levels.filter((level) => rlleLevelGate(state, level).unlocked).length,
  };
}

/** Reset/delete callers rebuild empty scoped proof. Old completions are not promoted. */
export function resetRlleStrictProgression(state: StoredRlleStrictProgression): StoredRlleStrictProgression {
  return createRlleStrictProgression({
    languageCode: state.languageCode,
    curriculumUnitIds: [...new Set(Object.values(state.milestones).map((item) => item.unitId))],
    legacyCompletedUnitIds: [],
  });
}
