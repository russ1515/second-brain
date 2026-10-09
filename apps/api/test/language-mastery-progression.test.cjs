'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../../../packages/shared/dist/index.js');
const progression = require('../dist/languages/language-mastery-progression.js');

function decision(verdict, rawScore) {
  return {
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    verdict,
    reason: verdict === 'mastered'
      ? 'threshold-met'
      : verdict === 'not-mastered'
        ? 'below-threshold'
        : 'autonomy-item-not-evaluable',
    trainingComplete: true,
    missingTrainingFormats: [],
    rawScore,
    threshold: shared.LANGUAGE_MASTERY_THRESHOLD,
    helpUsed: false,
  };
}

function a1State(legacyCompletedUnitIds = []) {
  return progression.createRlleStrictProgression({
    languageCode: 'en',
    curriculumUnitIds: shared.RLLE_CURRICULUM
      .filter((unit) => unit.level === 'A1')
      .map((unit) => unit.id),
    legacyCompletedUnitIds,
  });
}

function levelState(level, legacyCompletedUnitIds = []) {
  return progression.createRlleStrictProgression({
    languageCode: 'en',
    curriculumUnitIds: shared.RLLE_CURRICULUM
      .filter((unit) => unit.level === level)
      .map((unit) => unit.id),
    legacyCompletedUnitIds,
  });
}

function masterMilestone(state, milestone, suffix = 'proof') {
  return progression.recordRlleMilestoneDecision(state, {
    languageCode: 'en',
    level: milestone.level,
    pillar: milestone.pillar,
    milestoneId: milestone.milestoneId,
    scopeKey: milestone.scopeKey,
    evidenceId: `${suffix}:${milestone.milestoneId}`,
    decision: decision('mastered', 0.9),
    evaluatedAt: '2026-10-09T12:00:00.000Z',
  });
}

function masterAllMilestones(state) {
  for (const milestone of Object.values(state.milestones)) state = masterMilestone(state, milestone);
  return state;
}

function passExam(state, exam, index) {
  const attemptId = `exam-attempt-${index}`;
  state = progression.startRllePillarExam(state, { examId: exam.examId, attemptId });
  return progression.recordRllePillarExamDecision(state, {
    examId: exam.examId,
    attemptId,
    evidenceId: `submission-${index}`,
    decision: decision('mastered', 0.9),
    evaluatedAt: `2026-10-09T12:0${index}:00.000Z`,
    baselineExerciseIds: [`exam-question-${index}`],
  });
}

function remediationEvidence(exam, sourceAttemptId, index, overrides = {}) {
  const id = `targeted-proof-${index}`;
  return {
    mappingVersion: shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: shared.LANGUAGE_MASTERY_POLICY_VERSION,
    languageCode: 'en',
    level: exam.level,
    pillar: exam.pillar,
    examId: exam.examId,
    sourceAttemptId,
    id,
    format: shared.LANGUAGE_TRAINING_FORMATS[index % shared.LANGUAGE_TRAINING_FORMATS.length],
    state: 'completed',
    helpUsed: false,
    lessonId: `targeted-lesson-${sourceAttemptId}`,
    contentVersion: 1,
    exerciseIndex: index,
    source: 'exercise-attempt',
    sourceId: `exercise-attempt-row-${index}`,
    recordedAt: `2026-10-09T13:${String(index).padStart(2, '0')}:00.000Z`,
    ...overrides,
  };
}

test('strict proof is scoped by language, level, pillar, milestone and mapping version', () => {
  const state = a1State(['a1-first-contact']);
  const milestone = Object.values(state.milestones)[0];
  assert.equal(milestone.status, 'legacy-unverified');
  assert.match(milestone.scopeKey, /^rlle-language-mastery-map-v1:en:A1:/);
  assert.throws(
    () => progression.recordRlleMilestoneDecision(state, {
      languageCode: 'fr',
      level: milestone.level,
      pillar: milestone.pillar,
      milestoneId: milestone.milestoneId,
      scopeKey: milestone.scopeKey,
      evidenceId: 'foreign-proof',
      decision: decision('mastered', 1),
      evaluatedAt: '2026-10-09T12:00:00.000Z',
    }),
    /scope is invalid/i,
  );
  assert.equal(state.legacyUnitIds.includes('a1-first-contact'), true);
  assert.equal(Object.values(state.milestones).some((item) => item.status === 'mastered'), false);
});

test('milestone decisions retain append-only evidence history', () => {
  let state = levelState('B1');
  const milestone = Object.values(state.milestones)[0];
  state = progression.recordRlleMilestoneDecision(state, {
    languageCode: 'en',
    level: milestone.level,
    pillar: milestone.pillar,
    milestoneId: milestone.milestoneId,
    scopeKey: milestone.scopeKey,
    evidenceId: 'neutral-proof',
    decision: decision('not-evaluable', null),
    evaluatedAt: '2026-10-09T12:00:00.000Z',
  });
  state = progression.recordRlleMilestoneDecision(state, {
    languageCode: 'en',
    level: milestone.level,
    pillar: milestone.pillar,
    milestoneId: milestone.milestoneId,
    scopeKey: milestone.scopeKey,
    evidenceId: 'mastery-proof',
    decision: decision('mastered', 0.9),
    evaluatedAt: '2026-10-09T12:01:00.000Z',
  });
  assert.equal(state.milestones[milestone.milestoneId].status, 'mastered');
  assert.deepEqual(
    state.milestones[milestone.milestoneId].evidenceHistory.map((item) => item.evidenceId),
    ['neutral-proof', 'mastery-proof'],
  );
  assert.throws(
    () => progression.recordRlleMilestoneDecision(state, {
      languageCode: 'en',
      level: milestone.level,
      pillar: milestone.pillar,
      milestoneId: milestone.milestoneId,
      scopeKey: milestone.scopeKey,
      evidenceId: 'mastery-proof',
      decision: decision('mastered', 1),
      evaluatedAt: '2026-10-09T12:02:00.000Z',
    }),
    /append-only and unique/i,
  );
});

test('a content-complete level has five ordered pillar exams and no exam opens before its milestones', () => {
  let state = levelState('B1');
  const plans = shared.getRlleLevelPillarPlans('B1');
  assert.equal(plans.length, 5);
  assert.deepEqual(plans.map((plan) => plan.pillar), [...shared.LANGUAGE_MASTERY_PILLARS]);
  assert.equal(Object.values(state.pillarExams).every((exam) => exam.status === 'locked'), true);
  assert.throws(
    () => progression.startRllePillarExam(state, { examId: plans[0].examId, attemptId: 'too-early' }),
    /mandatory milestones/i,
  );
  state = masterAllMilestones(state);
  assert.equal(state.pillarExams[plans[0].examId].status, 'ready');
  assert.equal(state.pillarExams[plans[1].examId].status, 'locked');
  for (const [index, plan] of plans.entries()) {
    assert.equal(state.pillarExams[plan.examId].status, 'ready');
    state = passExam(state, state.pillarExams[plan.examId], index + 1);
  }
  assert.equal(progression.rlleLevelGate(state, 'B1').unlocked, true);
  assert.deepEqual(progression.rlleStrictProgressionAggregate(state), {
    masteredMilestones: Object.keys(state.milestones).length,
    totalMilestones: Object.keys(state.milestones).length,
    masteredPillarExams: 5,
    totalPillarExams: 5,
    masteredLevels: 1,
  });
});

test('a real mapping content gap remains locked and blocks the level denominator', () => {
  let state = masterAllMilestones(a1State());
  const graphy = shared.getRlleLevelPillarPlans('A1')
    .find((plan) => plan.pillar === 'orthography-graphy-phonetics');
  assert.ok(graphy);
  assert.equal(graphy.contentReady, false);
  assert.equal(state.pillarExams[graphy.examId].status, 'locked');
  const gate = progression.rlleLevelGate(state, 'A1');
  assert.equal(gate.unlocked, false);
  assert.deepEqual(gate.blockedContentPillars, ['orthography-graphy-phonetics']);
});

test('89.9 percent fails before rounding and requires ten genuinely new exercises', () => {
  let state = masterAllMilestones(levelState('B1'));
  const examId = shared.getRlleLevelPillarPlans('B1')[0].examId;
  state = progression.startRllePillarExam(state, { examId, attemptId: 'failed-attempt' });
  state = progression.recordRllePillarExamDecision(state, {
    examId,
    attemptId: 'failed-attempt',
    evidenceId: 'failed-submission',
    decision: decision('not-mastered', 0.899),
    evaluatedAt: '2026-10-09T12:00:00.000Z',
    baselineExerciseIds: ['old-1', 'old-2'],
  });
  assert.equal(state.pillarExams[examId].status, 'remediation');
  assert.equal(state.pillarExams[examId].remediation.requiredExerciseCount, 10);
  assert.throws(
    () => progression.recordRllePillarRemediationExercises(state, { examId, exerciseIds: ['new-1'] }),
    /canonical targeted remediation evidence/i,
  );
  const exam = state.pillarExams[examId];
  assert.throws(
    () => progression.recordRllePillarRemediationExercises(state, {
      examId,
      evidence: [remediationEvidence(exam, 'another-attempt', 0)],
    }),
    /scope or provenance is invalid/i,
  );
  assert.throws(
    () => progression.recordRllePillarRemediationExercises(state, {
      examId,
      evidence: [remediationEvidence(exam, 'failed-attempt', 0, { sourceId: 'old-1' })],
    }),
    /genuinely new and distinct/i,
  );
  state = progression.recordRllePillarRemediationExercises(state, {
    examId,
    evidence: [
      ...Array.from({ length: 9 }, (_, index) => remediationEvidence(exam, 'failed-attempt', index)),
      remediationEvidence(exam, 'failed-attempt', 9, { state: 'not-evaluable' }),
    ],
  });
  assert.equal(state.pillarExams[examId].status, 'remediation');
  assert.equal(state.pillarExams[examId].remediation.completedExerciseIds.length, 9);
  assert.equal(state.pillarExams[examId].remediation.evidenceHistory.length, 10);
  assert.equal(state.pillarExams[examId].remediation.evidenceHistory[9].state, 'not-evaluable');
  assert.throws(
    () => progression.recordRllePillarRemediationExercises(state, {
      examId,
      evidence: [remediationEvidence(exam, 'failed-attempt', 0)],
    }),
    /genuinely new and distinct/i,
  );
  state = progression.recordRllePillarRemediationExercises(state, {
    examId,
    evidence: [remediationEvidence(exam, 'failed-attempt', 10)],
  });
  assert.equal(state.pillarExams[examId].status, 'ready');
  assert.equal(state.pillarExams[examId].remediation.completedExerciseIds.length, 10);
});

test('pillar exam attempts are append-only and never truncated', () => {
  let state = masterAllMilestones(levelState('B1'));
  const examId = shared.getRlleLevelPillarPlans('B1')[0].examId;
  for (let index = 0; index < 13; index += 1) {
    const attemptId = `neutral-attempt-${index}`;
    state = progression.startRllePillarExam(state, { examId, attemptId });
    state = progression.recordRllePillarExamDecision(state, {
      examId,
      attemptId,
      evidenceId: `neutral-submission-${index}`,
      decision: decision('not-evaluable', null),
      evaluatedAt: `2026-10-09T14:${String(index).padStart(2, '0')}:00.000Z`,
      baselineExerciseIds: [],
    });
  }
  assert.equal(state.pillarExams[examId].attempts.length, 13);
  assert.equal(state.pillarExams[examId].attempts[0].id, 'neutral-attempt-0');
  assert.equal(state.pillarExams[examId].attempts[12].id, 'neutral-attempt-12');
  assert.throws(
    () => progression.startRllePillarExam(state, { examId, attemptId: 'neutral-attempt-0' }),
    /append-only and require a fresh id/i,
  );
});

test('NOT_EVALUABLE is not zero, remediation or unlock and permits one later fresh evaluation', () => {
  let state = masterAllMilestones(levelState('B1'));
  const examId = shared.getRlleLevelPillarPlans('B1')[0].examId;
  state = progression.startRllePillarExam(state, { examId, attemptId: 'technical-attempt' });
  state = progression.recordRllePillarExamDecision(state, {
    examId,
    attemptId: 'technical-attempt',
    evidenceId: 'technical-submission',
    decision: decision('not-evaluable', null),
    evaluatedAt: '2026-10-09T12:00:00.000Z',
    baselineExerciseIds: [],
  });
  assert.equal(state.pillarExams[examId].status, 'not-evaluable');
  assert.equal(state.pillarExams[examId].attempts[0].rawScore, null);
  assert.equal(state.pillarExams[examId].remediation, null);
  assert.equal(progression.rlleLevelGate(state, 'B1').unlocked, false);
  assert.deepEqual(progression.rlleLevelGate(state, 'B1').notEvaluableExamPillars, [
    'communication-situations',
  ]);
  state = progression.startRllePillarExam(state, { examId, attemptId: 'fresh-attempt' });
  assert.equal(state.pillarExams[examId].status, 'active');
});

test('reset clears strict proof and aggregate progress without preserving legacy promotion', () => {
  let state = masterAllMilestones(a1State(['a1-first-contact']));
  const reset = progression.resetRlleStrictProgression(state);
  assert.deepEqual(reset.legacyUnitIds, []);
  assert.equal(Object.values(reset.milestones).every((item) => item.status === 'training'), true);
  assert.deepEqual(progression.rlleStrictProgressionAggregate(reset), {
    masteredMilestones: 0,
    totalMilestones: Object.keys(reset.milestones).length,
    masteredPillarExams: 0,
    totalPillarExams: 5,
    masteredLevels: 0,
  });
});
