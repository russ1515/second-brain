'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../../../packages/shared/dist/index.js');
const {
  RealLifeLanguageService,
} = require('../dist/languages/real-life-language.service.js');
const {
  createRlleStrictProgression,
  recordRlleMilestoneDecision,
} = require('../dist/languages/language-mastery-progression.js');

const PROFILE = {
  id: 'profile-runtime',
  userId: 'owner',
  language: 'English',
  normalizedLanguage: 'en',
};

function decision(verdict, rawScore) {
  return {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict,
    reason: verdict === 'mastered'
      ? 'threshold-met'
      : verdict === 'not-evaluable'
        ? 'missing-evaluation'
        : 'below-threshold',
    rawScore,
    threshold: 0.9,
    completed: true,
    helpUsed: false,
    missingTrainingFormats: [],
    unevaluatedAutonomyItemIds: verdict === 'not-evaluable' ? ['acoustic-proof'] : [],
  };
}

function milestoneProjection(milestone, index, overrides = {}) {
  return {
    id: `row-${index}`,
    attemptId: `attempt-${index}`,
    idempotencyKey: `operation-${index}`,
    scopeKind: 'milestone',
    scopeKey: shared.rlleMilestoneEvidenceScopeKey({
      languageCode: 'en',
      milestone,
    }),
    targetId: milestone.id,
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: milestone.contentVersion,
    contentDefinitionId: milestone.contentDefinitionId,
    sourceContentVersion: 1,
    lessonId: `lesson-${milestone.unitId}`,
    languageCode: 'en',
    cefrLevel: milestone.level,
    pillar: milestone.pillar,
    status: 'evaluated',
    verdict: 'mastered',
    rawScore: 1,
    threshold: 0.9,
    decisionReason: 'threshold-met',
    helpUsed: false,
    decision: decision('mastered', 1),
    criteria: [{ id: milestone.criterionId, met: true, score: 1 }],
    assessmentId: `assessment-${index}`,
    assessmentSubmissionId: `submission-${index}`,
    completionId: `completion-${index}`,
    remediation: null,
    startedAt: '2026-10-10T08:00:00.000Z',
    evaluatedAt: '2026-10-10T08:01:00.000Z',
    ...overrides,
  };
}

function harness(initialAttempts) {
  const attempts = [...initialAttempts];
  const masteryAttempts = {
    projection: async () => attempts.map((attempt) => ({ ...attempt })),
    reconcileRemediationExerciseAttempts: async (_userId, attemptId) =>
      attempts.find((attempt) => attempt.attemptId === attemptId),
  };
  const service = new RealLifeLanguageService(
    { exerciseAttempt: { findMany: async () => [] } },
    {}, {}, {}, {}, {}, {}, {}, {}, {}, {},
    { enabled: () => true },
    { get: () => null },
    {},
    masteryAttempts,
  );
  service.strictMasteryAvailable = () => true;
  return { service, attempts };
}

function courseState(service, curriculumIds) {
  return {
    schemaVersion: 2,
    startLevel: 'A1',
    level: { declared: 'A1', estimated: null, evaluated: null, target: 'A2' },
    goal: null,
    goalDomain: 'general',
    curriculumIds,
    completedUnitIds: [],
    masteryPolicyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    legacyCompletedUnitIds: [],
    milestoneMastery: Object.fromEntries(curriculumIds.map((unitId) => [
      unitId,
      service.emptyMilestoneMastery(unitId),
    ])),
    currentUnitId: curriculumIds[0] ?? null,
    unitLessonIds: {},
    unitLastActivityAt: {},
    currentLesson: null,
    currentMission: null,
    evidence: [],
    gaps: [],
    mistakeMemory: [],
    repairLoops: [],
    immersionIntensity: 'guided',
    correctionIntensity: 'balanced',
  };
}

test('reloaded milestone technical-error is terminal neutral and rotates only the next operation key', async () => {
  const unit = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find((candidate) => candidate.level === 'A1');
  const milestone = unit.milestones[0];
  const technical = milestoneProjection(milestone, 'technical', {
    id: 'row-technical',
    attemptId: 'attempt-technical',
    idempotencyKey: 'operation-technical',
    status: 'technical-error',
    verdict: 'not-evaluable',
    rawScore: null,
    decisionReason: 'missing-evaluation',
    decision: decision('not-evaluable', null),
    criteria: [{ id: milestone.criterionId, met: false, score: null }],
    completionId: null,
  });
  const { service, attempts } = harness([technical]);
  const state = courseState(service, [unit.unitId]);

  const neutral = await service.reconcileCanonicalMastery('owner', PROFILE, state);
  const projected = neutral.state.milestoneMastery[unit.unitId];
  assert.equal(projected.status, 'not-evaluable');
  assert.equal(projected.activeAttemptId, null);
  assert.equal(projected.remediation, null);
  assert.deepEqual(neutral.state.completedUnitIds, []);
  assert.equal(neutral.nextMasteryTarget.targetId, milestone.id);
  assert.notEqual(neutral.nextMasteryTarget.operationKey, technical.idempotencyKey);
  const nextOperationKey = neutral.nextMasteryTarget.operationKey;

  attempts.push(milestoneProjection(milestone, 'active', {
    id: 'row-active',
    attemptId: 'attempt-active',
    idempotencyKey: nextOperationKey,
    status: 'started',
    verdict: null,
    rawScore: null,
    decisionReason: null,
    decision: null,
    criteria: [],
    assessmentId: null,
    assessmentSubmissionId: null,
    completionId: null,
    evaluatedAt: null,
  }));
  const firstReplay = await service.reconcileCanonicalMastery('owner', PROFILE, neutral.state);
  const doubleClickReplay = await service.reconcileCanonicalMastery(
    'owner',
    PROFILE,
    firstReplay.state,
  );
  assert.equal(firstReplay.nextMasteryTarget.operationKey, nextOperationKey);
  assert.equal(firstReplay.nextMasteryTarget.activeAttemptId, 'attempt-active');
  assert.equal(firstReplay.nextMasteryTarget.blockedReason, 'assessment-active');
  assert.equal(doubleClickReplay.nextMasteryTarget.operationKey, nextOperationKey);
  assert.equal(doubleClickReplay.nextMasteryTarget.activeAttemptId, 'attempt-active');
});

test('all A1 milestone proofs project the first A1 pillar exam before any A2 target', async () => {
  const units = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .filter((unit) => unit.level === 'A1' || unit.level === 'A2');
  const a1Units = units.filter((unit) => unit.level === 'A1');
  const attempts = a1Units.flatMap((unit) => unit.milestones)
    .map((milestone, index) => milestoneProjection(milestone, index));
  const { service } = harness(attempts);
  const state = courseState(service, units.map((unit) => unit.unitId));

  const reconciled = await service.reconcileCanonicalMastery('owner', PROFILE, state);
  const firstA1Exam = shared.getRlleLevelPillarPlans('A1')[0];
  assert.equal(reconciled.nextMasteryTarget.scopeKind, 'pillar_exam');
  assert.equal(reconciled.nextMasteryTarget.targetId, firstA1Exam.examId);
  assert.equal(reconciled.nextMasteryTarget.eligible, true);
  assert.equal(reconciled.nextMasteryTarget.remediationPlanId, null);
  assert.equal(reconciled.nextMasteryTarget.targetId.includes(':A2:'), false);
});

test('native-acoustic target is explicit and eligible only with strict runtime plus complete training', async () => {
  const unit = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find(
    (candidate) => candidate.unitId === 'a2-routines',
  );
  const acoustic = unit.milestones.find(
    (milestone) => milestone.oralRole === 'audio-native-assessment',
  );
  assert.ok(acoustic);
  const formats = [...shared.LANGUAGE_TRAINING_FORMATS];
  const voiceIndex = formats.indexOf('voice-pronunciation');
  const exerciseAttempts = formats.map((format, index) => ({
        id: `exercise-${index}`, exerciseIndex: index,
        createdAt: new Date(`2026-10-12T10:${String(index).padStart(2, '0')}:00.000Z`),
        answer: format === 'voice-pronunciation' ? 'editable STT transcript' : 'answer',
      }));
  const lessons = {
    get: async () => ({
      exercises: formats.map((languageFormat) => ({ languageFormat })),
    }),
  };
  const prisma = {
    lesson: { findFirst: async () => ({ contentVersion: 1 }) },
    exerciseAttempt: { findMany: async () => exerciseAttempts },
  };
  const service = new RealLifeLanguageService(
    prisma,
    {}, lessons, {}, {}, {}, {}, {}, {}, {}, {},
    { enabled: () => true },
    { get: () => null },
    {},
    {},
  );
  const state = courseState(service, [unit.unitId]);
  state.currentLesson = {
    lessonId: 'lesson-a2',
    unitId: unit.unitId,
    status: 'active',
    lastActivityAt: '2026-10-12T10:00:00.000Z',
  };
  state.milestoneMastery[unit.unitId].trainingEvidence = [];
  let progression = createRlleStrictProgression({
    languageCode: 'en',
    curriculumUnitIds: [unit.unitId],
  });
  const masteryDecision = {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict: 'mastered',
    reason: 'threshold-met',
    trainingComplete: true,
    missingTrainingFormats: [],
    rawScore: 1,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    helpUsed: false,
  };
  unit.milestones.filter((milestone) => milestone.id !== acoustic.id).forEach((milestone, index) => {
    progression = recordRlleMilestoneDecision(progression, {
      languageCode: 'en',
      level: milestone.level,
      pillar: milestone.pillar,
      milestoneId: milestone.id,
      scopeKey: progression.milestones[milestone.id].scopeKey,
      evidenceId: `proof-${index}`,
      decision: masteryDecision,
      evaluatedAt: '2026-10-12T10:30:00.000Z',
    });
  });

  service.strictMasteryAvailable = () => true;
  const available = await service.projectNextMasteryTarget(
    'owner', PROFILE, state, progression, [],
  );
  assert.equal(available.targetId, acoustic.id);
  assert.equal(available.assessmentMode, 'acoustic');
  assert.equal(available.eligible, true);
  assert.equal(available.blockedReason, null);

  service.strictMasteryAvailable = () => false;
  const blocked = await service.projectNextMasteryTarget(
    'owner', PROFILE, state, progression, [],
  );
  assert.equal(blocked.targetId, acoustic.id);
  assert.equal(blocked.assessmentMode, 'acoustic');
  assert.equal(blocked.eligible, false);
  assert.equal(blocked.blockedReason, 'capability-unavailable');
  const voiceTraining = await service.trainingEvidenceForLesson(
    'owner', state.currentLesson, [],
  );
  const transcriptEvidence = voiceTraining.find((item) => item.exerciseIndex === voiceIndex);
  assert.equal(transcriptEvidence.state, 'completed');
  assert.equal(transcriptEvidence.source, 'exercise-attempt');
  assert.notEqual(transcriptEvidence.source, 'audio-native-coaching');
});
