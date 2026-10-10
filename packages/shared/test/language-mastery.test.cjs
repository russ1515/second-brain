'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

const training = () => shared.LANGUAGE_TRAINING_FORMATS.map((format, index) => ({
  id: `training-${index}`,
  format,
  state: 'completed',
  helpUsed: index === 0,
}));

const autonomy = (awardedPoints, maximumPoints = 1000, overrides = {}) => ({
  id: 'autonomy-1',
  completed: true,
  helpUsed: false,
  answerLeak: false,
  items: [{
    id: 'answer-1', responseMode: 'open', state: 'evaluated',
    awardedPoints, maximumPoints,
  }],
  ...overrides,
});

test('the policy exposes five distinct pillars and all ten mandatory training formats', () => {
  assert.equal(shared.LANGUAGE_MASTERY_PILLARS.length, 5);
  assert.equal(new Set(shared.LANGUAGE_MASTERY_PILLARS).size, 5);
  assert.equal(shared.LANGUAGE_TRAINING_FORMATS.length, 10);
  assert.equal(new Set(shared.LANGUAGE_TRAINING_FORMATS).size, 10);
});

test('89.9 percent fails while exactly 90 percent passes before display rounding', () => {
  const below = shared.decideLanguageMilestoneMastery({ training: training(), autonomy: autonomy(899) });
  assert.equal(below.rawScore, 0.899);
  assert.equal(below.verdict, 'not-mastered');
  assert.equal(below.reason, 'below-threshold');

  const threshold = shared.decideLanguageMilestoneMastery({ training: training(), autonomy: autonomy(900) });
  assert.equal(threshold.rawScore, 0.9);
  assert.equal(threshold.verdict, 'mastered');
  assert.equal(threshold.reason, 'threshold-met');
});

test('ten repeated QCMs do not replace coverage of the ten formats', () => {
  const repeated = Array.from({ length: 10 }, (_, index) => ({
    id: `qcm-${index}`, format: 'recognition-mcq', state: 'completed', helpUsed: false,
  }));
  const decision = shared.decideLanguageMilestoneMastery({ training: repeated, autonomy: autonomy(1000) });
  assert.equal(decision.verdict, 'not-evaluable');
  assert.equal(decision.reason, 'training-incomplete');
  assert.equal(decision.missingTrainingFormats.length, 9);
});

test('assistance or an answer leak prevents the same autonomy attempt from mastering', () => {
  const assisted = shared.decideLanguageMilestoneMastery({
    training: training(), autonomy: autonomy(1000, 1000, { helpUsed: true }),
  });
  assert.equal(assisted.verdict, 'not-mastered');
  assert.equal(assisted.reason, 'autonomy-assisted');

  const leaked = shared.decideLanguageMilestoneMastery({
    training: training(), autonomy: autonomy(1000, 1000, { answerLeak: true }),
  });
  assert.equal(leaked.verdict, 'not-mastered');
  assert.equal(leaked.reason, 'autonomy-answer-leak');
});

test('incomplete, technically failed or invalid-rubric attempts are not evaluable, never zero', () => {
  const incomplete = shared.decideLanguageMilestoneMastery({
    training: training(), autonomy: autonomy(null, null, { completed: false }),
  });
  assert.equal(incomplete.verdict, 'not-evaluable');
  assert.equal(incomplete.rawScore, null);

  const technical = shared.decideLanguageMilestoneMastery({
    training: training(),
    autonomy: autonomy(null, null, { items: [{
      id: 'voice-1', responseMode: 'voice', state: 'technical-error', awardedPoints: null, maximumPoints: null,
    }] }),
  });
  assert.equal(technical.verdict, 'not-evaluable');
  assert.equal(technical.reason, 'autonomy-item-not-evaluable');
  assert.equal(technical.rawScore, null);

  const invalid = shared.decideLanguageMilestoneMastery({ training: training(), autonomy: autonomy(1, 0) });
  assert.equal(invalid.verdict, 'not-evaluable');
  assert.equal(invalid.reason, 'invalid-rubric');
});

test('pillar remediation requires at least ten newly completed activities', () => {
  assert.equal(shared.languageRemediationReady({ evidence: training().slice(0, 9) }), false);
  assert.equal(shared.languageRemediationReady({ evidence: training() }), true);
  assert.equal(shared.languageRemediationReady({ requiredExerciseCount: 9, evidence: training() }), false);
});

test('mapping v2 keeps every one of the 18 RLLE units exactly once and preserves its curriculum strands', () => {
  assert.equal(shared.RLLE_LANGUAGE_MASTERY_MAPPING_VERSION, 'rlle-language-mastery-map-v2');
  assert.equal(shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.length, 18);
  assert.equal(new Set(shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.map((unit) => unit.unitId)).size, 18);

  const mappedIds = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.map((unit) => unit.unitId).sort();
  const curriculumIds = shared.RLLE_CURRICULUM.map((unit) => unit.id).sort();
  assert.deepEqual(mappedIds, curriculumIds);

  for (const mapped of shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP) {
    const source = shared.RLLE_CURRICULUM.find((unit) => unit.id === mapped.unitId);
    assert.ok(source);
    assert.equal(mapped.level, source.level);
    assert.equal(mapped.unitOrder, source.order);
    assert.deepEqual(
      mapped.milestones.filter((item) => item.origin === 'curriculum').map((item) => item.sourceStrand),
      source.strands,
    );
  }
});

test('the four authorised gap supplements resolve by unit with all ten formats and deterministic evaluation', () => {
  assert.equal(shared.RLLE_LANGUAGE_MASTERY_CONTENT_VERSION, 'rlle-language-mastery-content-v1');
  assert.deepEqual(
    shared.RLLE_LANGUAGE_MASTERY_CONTENT_SUPPLEMENTS.map((item) => `${item.level}:${item.competencyId}`),
    ['A1:graphy-writing', 'A2:phonetic-production', 'C1:verbal-system', 'C2:verbal-system'],
  );

  for (const supplement of shared.RLLE_LANGUAGE_MASTERY_CONTENT_SUPPLEMENTS) {
    assert.ok(supplement.objective.trim().length > 0);
    assert.ok(supplement.explanation.trim().length > 0);
    assert.equal(supplement.activities.length, shared.LANGUAGE_TRAINING_FORMATS.length);
    assert.equal(new Set(supplement.activities.map((item) => item.format)).size, supplement.activities.length);
    assert.deepEqual(
      [...supplement.activities.map((item) => item.format)].sort(),
      [...shared.LANGUAGE_TRAINING_FORMATS].sort(),
    );
    assert.ok(supplement.activities.every((item) => item.guidance.trim().length > 0));
    assert.ok(supplement.evaluation.criteria.length >= 3);
    assert.equal(
      new Set(supplement.evaluation.criteria.map((item) => item.id)).size,
      supplement.evaluation.criteria.length,
    );
    assert.ok(supplement.evaluation.criteria.every((item) => item.mandatory && item.guidance.trim().length > 0));
    assert.equal(supplement.evaluation.rawThreshold, 0.9);
    assert.equal(supplement.evaluation.independentWithoutHelp, true);
    assert.ok(supplement.evaluation.notEvaluableWhen.length > 0);

    const mappedUnit = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find((unit) => unit.unitId === supplement.unitId);
    const milestone = mappedUnit?.milestones.find((item) => item.contentDefinitionId === supplement.id);
    assert.ok(milestone);
    assert.equal(milestone.origin, 'authorized-content-supplement');
    assert.equal(milestone.level, supplement.level);
    assert.equal(milestone.pillar, supplement.pillar);
    assert.equal(milestone.criterionId, supplement.criterionId);
    assert.equal(milestone.contentVersion, supplement.contentVersion);
    assert.match(
      shared.rlleMilestoneEvidenceScopeKey({ languageCode: 'fr', milestone }),
      /:rlle-language-mastery-content-v1$/,
    );
    assert.deepEqual(
      shared.getRlleLanguageMasteryContentSupplementsForUnit(supplement.unitId)
        .map((item) => item.id),
      [supplement.id],
    );
  }

  assert.deepEqual(shared.getRlleLanguageMasteryContentSupplementsForUnit('b1-opinions'), []);
  const phonetics = shared.getRlleLanguageMasteryContentSupplementsForUnit('a2-routines')[0];
  assert.equal(phonetics.evaluation.acousticAssessment.required, true);
  assert.equal(phonetics.evaluation.acousticAssessment.transcriptionSufficient, false);
  assert.deepEqual(phonetics.evaluation.acousticAssessment.modes, ['scripted-reference', 'spontaneous']);
  assert.deepEqual(phonetics.evaluation.acousticAssessment.requiredDimensions, ['accuracy', 'fluency']);
  assert.deepEqual(phonetics.evaluation.acousticAssessment.optionalDimensions, ['prosody']);
});

test('each source criterion has its own milestone and evidence scope', () => {
  const milestones = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.flatMap((unit) => unit.milestones);
  assert.equal(new Set(milestones.map((item) => item.id)).size, milestones.length);
  assert.equal(new Set(milestones.map((item) => shared.rlleMilestoneEvidenceScopeKey({
    languageCode: 'fr', milestone: item,
  }))).size, milestones.length);

  const first = milestones[0];
  assert.notEqual(
    shared.rlleMilestoneEvidenceScopeKey({ languageCode: 'fr', milestone: first }),
    shared.rlleMilestoneEvidenceScopeKey({ languageCode: 'de', milestone: first }),
  );
  assert.ok(milestones.filter((item) => item.sourceStrand === 'pronunciation').every((item) =>
    item.evidenceModality === 'audio-native-pronunciation-assessment'
    && item.oralRole === 'audio-native-assessment'));
  assert.ok(milestones.filter((item) => item.sourceStrand === 'listening').every((item) =>
    item.evidenceModality === 'audio-input-comprehension'
    && item.oralRole === 'audio-input'));
  assert.ok(milestones.filter((item) => ['conversation', 'interaction', 'mediation'].includes(item.sourceStrand)).every((item) =>
    item.oralRole === 'oral-capable'));
  assert.ok(milestones.filter((item) => item.sourceStrand === 'writing').every((item) =>
    item.evidenceModality === 'written-production'
    && item.oralRole === 'none'));
  assert.ok(milestones.filter((item) => item.origin === 'curriculum').every((item) =>
    item.contentDefinitionId === null && item.contentVersion === null));
});

test('exam planning creates exactly five pillar exams per CEFR level, never five per unit', () => {
  assert.equal(shared.RLLE_PILLAR_EXAMS_PER_LEVEL, 5);
  assert.equal(shared.RLLE_LEVEL_PILLAR_PLANS.length, 30);
  assert.equal(new Set(shared.RLLE_LEVEL_PILLAR_PLANS.map((plan) => plan.examId)).size, 30);
  for (const level of shared.CEFR_LEVELS) {
    const plans = shared.getRlleLevelPillarPlans(level);
    assert.equal(plans.length, 5);
    assert.deepEqual(plans.map((plan) => plan.pillar), shared.LANGUAGE_MASTERY_PILLARS);
  }
});

test('mapping audit confirms the four mandatory competency gaps are closed by full content', () => {
  const contentGaps = shared.RLLE_LANGUAGE_MASTERY_MAPPING_ISSUES
    .filter((issue) => issue.kind === 'missing-required-competency-content')
    .map((issue) => `${issue.level}:${issue.pillar}:${issue.competencyId}`)
    .sort();
  assert.deepEqual(contentGaps, []);
  assert.deepEqual(shared.RLLE_LANGUAGE_MASTERY_MAPPING_ISSUES, []);
  assert.equal(shared.RLLE_LANGUAGE_MASTERY_MAPPING_AUDIT.activationReady, true);
  assert.ok(shared.RLLE_LEVEL_PILLAR_PLANS.every((plan) => plan.contentReady));
});

test('level gate requires all milestones and five independent exams with raw scores at 90 percent', () => {
  const plans = shared.getRlleLevelPillarPlans('B1');
  const milestones = plans.flatMap((plan) => plan.requiredMilestoneIds).map((milestoneId) => ({
    milestoneId, verdict: 'mastered',
  }));
  const exams = plans.map((plan) => ({
    examId: plan.examId, pillar: plan.pillar, verdict: 'mastered', rawScore: 0.9,
  }));

  const passed = shared.decideRlleLevelPillarGate({ level: 'B1', milestones, exams });
  assert.equal(passed.unlocked, true);
  assert.equal(passed.requiredExamCount, 5);

  const below = exams.map((exam, index) => index === 0 ? { ...exam, rawScore: 0.899 } : exam);
  const failed = shared.decideRlleLevelPillarGate({ level: 'B1', milestones, exams: below });
  assert.equal(failed.unlocked, false);
  assert.deepEqual(failed.failedExamPillars, [plans[0].pillar]);

  const nonEvaluable = exams.map((exam, index) => index === 4
    ? { ...exam, verdict: 'not-evaluable', rawScore: null }
    : exam);
  const blocked = shared.decideRlleLevelPillarGate({ level: 'B1', milestones, exams: nonEvaluable });
  assert.equal(blocked.unlocked, false);
  assert.deepEqual(blocked.notEvaluableExamPillars, [plans[4].pillar]);
});

test('the completed C1 verbal-system pillar can unlock only with every mapped proof and exam', () => {
  const plans = shared.getRlleLevelPillarPlans('C1');
  const milestones = plans.flatMap((plan) => plan.requiredMilestoneIds).map((milestoneId) => ({
    milestoneId, verdict: 'mastered',
  }));
  const exams = plans.map((plan) => ({
    examId: plan.examId, pillar: plan.pillar, verdict: 'mastered', rawScore: 1,
  }));
  const decision = shared.decideRlleLevelPillarGate({ level: 'C1', milestones, exams });
  assert.equal(decision.unlocked, true);
  assert.deepEqual(decision.blockedContentPillars, []);
});
