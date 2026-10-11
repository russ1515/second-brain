'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../../../packages/shared/dist/index.js');
const {
  RealLifeLanguageService,
} = require('../dist/languages/real-life-language.service.js');

const EVALUATED_AT = '2026-10-11T08:30:00.000Z';
const STARTED_AT = '2026-10-11T08:00:00.000Z';
const A1_UNITS = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.filter((unit) => unit.level === 'A1');
const FIRST_A1_PLAN = shared.getRlleLevelPillarPlans('A1')[0];

function decision(verdict) {
  return {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict,
    reason: verdict === 'mastered' ? 'threshold-met' : 'below-threshold',
    trainingComplete: true,
    missingTrainingFormats: [],
    rawScore: verdict === 'mastered' ? 0.9 : 0.75,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    helpUsed: false,
  };
}

function milestoneAttempt(milestone, index, completionId) {
  return {
    id: 'row-milestone-' + index,
    attemptId: 'attempt-milestone-' + index,
    idempotencyKey: 'operation-milestone-' + index,
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
    lessonId: 'lesson-' + milestone.unitId,
    languageCode: 'en',
    cefrLevel: milestone.level,
    pillar: milestone.pillar,
    status: 'evaluated',
    verdict: 'mastered',
    rawScore: 0.9,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    decisionReason: 'threshold-met',
    helpUsed: false,
    decision: decision('mastered'),
    criteria: [{ id: milestone.criterionId, met: true, score: 0.9 }],
    assessmentId: 'assessment-milestone-' + index,
    assessmentSubmissionId: 'submission-milestone-' + index,
    completionId,
    remediation: null,
    startedAt: STARTED_AT,
    evaluatedAt: EVALUATED_AT,
  };
}

function failedPillarAttempt(index, remediation) {
  return {
    id: 'row-pillar-' + index,
    attemptId: 'attempt-pillar-' + index,
    idempotencyKey: 'operation-pillar-' + index,
    scopeKind: 'pillar_exam',
    scopeKey: [
      shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
      'en',
      'A1',
      FIRST_A1_PLAN.pillar,
      FIRST_A1_PLAN.examId,
      'pillar-exam',
    ].join(':'),
    targetId: FIRST_A1_PLAN.examId,
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    masteryContentVersion: null,
    contentDefinitionId: null,
    sourceContentVersion: 1,
    lessonId: 'lesson-a1-first-contact',
    languageCode: 'en',
    cefrLevel: 'A1',
    pillar: FIRST_A1_PLAN.pillar,
    status: 'evaluated',
    verdict: 'not-mastered',
    rawScore: 0.75,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    decisionReason: 'below-threshold',
    helpUsed: false,
    decision: decision('not-mastered'),
    criteria: FIRST_A1_PLAN.mandatoryCompetencies.map((item) => ({
      id: item.competencyId,
      met: false,
      score: 0.75,
    })),
    assessmentId: 'assessment-pillar-' + index,
    assessmentSubmissionId: 'submission-pillar-' + index,
    completionId: null,
    remediation,
    startedAt: STARTED_AT,
    evaluatedAt: EVALUATED_AT,
  };
}

function courseState(curriculumIds) {
  return {
    schemaVersion: 2,
    startLevel: 'A1',
    level: {
      declared: 'A1',
      estimated: null,
      evaluated: null,
      target: 'A1',
    },
    goal: null,
    goalDomain: 'general',
    curriculumIds,
    completedUnitIds: [],
    masteryPolicyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    legacyCompletedUnitIds: [],
    milestoneMastery: {},
    currentUnitId: curriculumIds[0] ?? null,
    unitLessonIds: Object.fromEntries(curriculumIds.map((id) => [id, []])),
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

function serviceWithJournal(attempts, overrides = {}) {
  const masteryAttempts = {
    projection: async () => attempts.map((attempt) => ({
      ...attempt,
      remediation: attempt.remediation
        ? {
            ...attempt.remediation,
            evidence: [...attempt.remediation.evidence],
          }
        : null,
    })),
    publishCompletion: overrides.publishCompletion ?? (async () => {
      throw new Error('unexpected publication');
    }),
    startRemediationPlan: overrides.startRemediationPlan ?? (async () => {
      throw new Error('unexpected remediation');
    }),
    reconcileRemediationExerciseAttempts: async (_userId, attemptId) =>
      attempts.find((attempt) => attempt.attemptId === attemptId),
  };
  const service = new RealLifeLanguageService(
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    {},
    { enabled: () => true },
    { get: () => null },
    {},
    masteryAttempts,
  );
  service.strictMasteryAvailable = () => true;
  service.logger.warn = () => {};
  return service;
}

const profile = {
  id: 'profile-1',
  userId: 'owner-1',
  language: 'English',
  normalizedLanguage: 'en',
};

test('reconnect republishes the appendOutcome crash window exactly once before granting milestone credit', async () => {
  const unit = A1_UNITS[0];
  const milestone = unit.milestones[0];
  const attempts = [milestoneAttempt(milestone, 1, null)];
  let publicationCalls = 0;
  const service = serviceWithJournal(attempts, {
    publishCompletion: async (_userId, attemptId) => {
      publicationCalls += 1;
      const attempt = attempts.find((item) => item.attemptId === attemptId);
      assert.ok(attempt);
      attempt.completionId = 'completion-milestone-1';
      return attempt;
    },
  });

  const first = await service.reconcileCanonicalMastery(
    'owner-1',
    profile,
    courseState([unit.unitId]),
  );
  assert.equal(publicationCalls, 1);
  assert.equal(first.progression.milestones[milestone.id].status, 'mastered');
  assert.equal(first.progression.milestones[milestone.id].evidenceId, 'completion-milestone-1');
  assert.equal(first.progression.milestones[milestone.id].evidenceHistory.length, 1);

  const replay = await service.reconcileCanonicalMastery(
    'owner-1',
    profile,
    first.state,
  );
  assert.equal(publicationCalls, 1);
  assert.equal(replay.progression.milestones[milestone.id].status, 'mastered');
  assert.equal(replay.progression.milestones[milestone.id].evidenceHistory.length, 1);
});

test('reconnect treats a later lesson-version attempt as covered by the canonical completion', async () => {
  const unit = A1_UNITS[0];
  const milestone = unit.milestones[0];
  const canonicalCompletionId = 'completion-canonical-milestone';
  const attempts = [
    milestoneAttempt(milestone, 1, canonicalCompletionId),
    {
      ...milestoneAttempt(milestone, 2, canonicalCompletionId),
      lessonId: 'lesson-regenerated-version',
      sourceContentVersion: 2,
    },
  ];
  let publicationCalls = 0;
  const service = serviceWithJournal(attempts, {
    publishCompletion: async () => {
      publicationCalls += 1;
      throw new Error('canonical credit must not be republished');
    },
  });

  const first = await service.reconcileCanonicalMastery(
    'owner-1',
    profile,
    courseState([unit.unitId]),
  );
  assert.equal(publicationCalls, 0);
  assert.equal(first.progression.milestones[milestone.id].status, 'mastered');
  assert.equal(first.progression.milestones[milestone.id].evidenceId, canonicalCompletionId);
  assert.equal(first.progression.milestones[milestone.id].evidenceHistory.length, 1);

  const replay = await service.reconcileCanonicalMastery('owner-1', profile, first.state);
  assert.equal(publicationCalls, 0);
  assert.equal(replay.progression.milestones[milestone.id].evidenceHistory.length, 1);
});

test('an unpublished mastered outcome remains non-crediting when canonical recovery is unavailable', async () => {
  const unit = A1_UNITS[0];
  const milestone = unit.milestones[0];
  const attempts = [milestoneAttempt(milestone, 1, null)];
  const service = serviceWithJournal(attempts, {
    publishCompletion: async () => {
      throw new Error('simulated publication outage');
    },
  });

  const reconciled = await service.reconcileCanonicalMastery(
    'owner-1',
    profile,
    courseState([unit.unitId]),
  );
  assert.notEqual(reconciled.progression.milestones[milestone.id].status, 'mastered');
  assert.equal(reconciled.progression.milestones[milestone.id].evidenceId, null);
  assert.equal(reconciled.progression.milestones[milestone.id].evidenceHistory.length, 0);
});

test('reconnect creates one missing pillar remediation plan and projects it idempotently', async () => {
  const milestones = A1_UNITS.flatMap((unit) => unit.milestones);
  const attempts = milestones.map((milestone, index) =>
    milestoneAttempt(milestone, index + 1, 'completion-milestone-' + (index + 1)));
  const failure = failedPillarAttempt(milestones.length + 1, {
    planId: null,
    status: null,
    lessonId: null,
    requiredExerciseCount: shared.LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
    completedExerciseCount: 0,
    evidenceCount: 0,
    evidence: [],
  });
  attempts.push(failure);
  let planCalls = 0;
  const service = serviceWithJournal(attempts, {
    startRemediationPlan: async (_userId, input) => {
      planCalls += 1;
      assert.equal(input.failedAttemptId, failure.attemptId);
      assert.equal(input.idempotencyKey, 'pillar-failure:' + failure.attemptId);
      failure.remediation = {
        ...failure.remediation,
        planId: 'remediation-plan-1',
        status: 'preparing',
      };
      return {
        id: 'remediation-plan-1',
        failedAttemptId: failure.attemptId,
      };
    },
  });
  const state = courseState(A1_UNITS.map((unit) => unit.unitId));

  const first = await service.reconcileCanonicalMastery('owner-1', profile, state);
  assert.equal(planCalls, 1);
  assert.equal(first.progression.pillarExams[FIRST_A1_PLAN.examId].status, 'remediation');
  assert.equal(first.nextMasteryTarget.targetId, FIRST_A1_PLAN.examId);
  assert.equal(first.nextMasteryTarget.remediationPlanId, 'remediation-plan-1');
  assert.equal(first.nextMasteryTarget.blockedReason, 'remediation-required');
  assert.equal(
    Object.values(first.state.milestoneMastery)
      .filter((item) => item.remediation?.planId === 'remediation-plan-1').length,
    1,
  );

  const replay = await service.reconcileCanonicalMastery('owner-1', profile, first.state);
  assert.equal(planCalls, 1);
  assert.equal(replay.nextMasteryTarget.remediationPlanId, 'remediation-plan-1');
  assert.equal(replay.nextMasteryTarget.blockedReason, 'remediation-required');
});
