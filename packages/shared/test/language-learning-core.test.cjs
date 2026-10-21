'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const shared = require('../dist/index.js');
const input = { languageCode: 'en', productLevel: 'BEGINNER', cefrLevel: 'A1' };
const catalogue = shared.buildLanguageLearningCatalogue(input);
let serial = 0;
function evidence(scope, targetId, score, patch = {}) {
  serial += 1;
  return { scope, targetId, contentVersion: 1, submissionId: `submission-${serial}`,
    completionId: scope === 'lesson' && score !== null && score >= 0.9 ? `completion-${serial}` : null,
    state: score === null ? 'not-evaluable' : 'evaluated', awardedPoints: score === null ? null : score * 1000,
    maximumPoints: score === null ? null : 1000, evaluatedAt: new Date(Date.UTC(2026, 9, 20, 12, 0, serial)).toISOString(), ...patch };
}
function view(rows = [], patch = {}) { return shared.projectLanguageLearningCore({ ...input, ...patch, evidence: rows }); }
function stageProof(stage, currentCatalogue = catalogue) {
  return currentCatalogue.modules.flatMap((module) => [
    ...module.lessons.filter((lesson) => lesson.cefrLevel === stage).map((lesson) => evidence('lesson', lesson.id, 0.95, { cefrLevel: stage })),
    ...(module.acousticAssessmentRequired ? [] : [evidence('module', `${stage}:${module.id}`, 0.94, { cefrLevel: stage })]),
  ]);
}
const find = (current, id) => current.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === id);

test('English preserves the 230 immutable legacy identities and versions, eleven modules and all 28 toolkit capabilities', () => {
  assert.deepEqual(catalogue.modules.map((module) => module.id), shared.LANGUAGE_LEARNING_MODULE_IDS);
  assert.deepEqual(catalogue.modules.map((module) => module.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const legacy = shared.getLegacyEnglishBeginnerLessonIds();
  assert.equal(legacy.length, 230); assert.equal(new Set(legacy).size, 230);
  assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'),
    '9aad76fd07e2f287ffa916e68f42ad675d051f9c7814dff63af64d61f69811dc', 'frozen pre-expansion English ID order');
  assert.ok(legacy.every((id) => find(catalogue, id)?.contentVersion === 1));
  assert.equal(catalogue.modules.flatMap((module) => module.lessons).length, 236);
  assert.equal(catalogue.modules[0].lessons[0].id, 'en-beginner:basics:english-alphabet');
  assert.deepEqual(catalogue.modules[10].toolkit, shared.LANGUAGE_LEARNING_TOOLKIT);
  assert.equal(catalogue.modules[10].toolkit.length, 28);
  assert.equal(catalogue.modules[10].lessons.length, 6);
});

test('English A1 and A2 are explicitly differentiated without removing either stage from its product catalogue', () => {
  for (const stage of ['A1', 'A2']) assert.ok(catalogue.modules.every((module) => module.lessons.some((lesson) => lesson.cefrLevel === stage)));
  assert.equal(find(catalogue, 'en-beginner:conjugation:present-simple').cefrLevel, 'A1');
  assert.equal(find(catalogue, 'en-beginner:conjugation:past-simple').cefrLevel, 'A2');
  assert.equal(find(catalogue, 'en-beginner:conversation:past-experience').cefrLevel, 'A2');
  assert.equal(shared.buildLanguageLearningCatalogue({ ...input, cefrLevel: 'A2' }).modules.flatMap((module) => module.lessons).length, 236);
  assert.equal(shared.buildLanguageLearningCatalogue({ ...input, cefrLevel: 'C2' }).cefrLevel, 'A1');
});

test('all 34 languages cover six stages and eleven nonempty families with stable rich blueprints and no lint failures', () => {
  const ids = new Set(); let stages = 0;
  assert.equal(shared.SUPPORTED_LANGUAGE_CODES.length, 34);
  for (const languageCode of shared.SUPPORTED_LANGUAGE_CODES) for (const productLevel of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
    const current = shared.buildLanguageLearningCatalogue({ languageCode, productLevel });
    assert.equal(current.curriculumStatus, 'COMPLETE'); assert.equal(current.modules.length, 11);
    assert.deepEqual(shared.lintLanguageCurriculum(current), [], `${languageCode}/${productLevel}`);
    assert.deepEqual(shared.buildLanguageLearningCatalogue({ languageCode, productLevel }), current);
    for (const stage of current.cefrLevels) { stages += 1; assert.ok(current.modules.every((m) => m.lessons.some((l) => l.cefrLevel === stage))); }
    for (const lesson of current.modules.flatMap((module) => module.lessons)) {
      assert.equal(ids.has(lesson.id), false, lesson.id); ids.add(lesson.id);
      assert.equal(lesson.assessmentBlueprint.threshold, 0.9); assert.equal(lesson.assessmentBlueprint.minimumItems, 10);
      assert.equal(lesson.requiresAcousticAssessment, false);
    }
  }
  assert.equal(stages, 204); assert.equal(ids.size, 6902);
});

test('catalogues are isolated copies and representative scripts never inherit English lesson identities', () => {
  const mutated = shared.buildLanguageLearningCatalogue(input);
  mutated.modules[0].lessons[0].skills.push('mutation'); mutated.modules[0].lessons[0].prerequisites.push('mutation');
  mutated.modules[10].toolkit.length = 0;
  assert.deepEqual(shared.buildLanguageLearningCatalogue(input), catalogue);
  for (const languageCode of ['fr', 'ar', 'zh', 'ja', 'ln']) {
    const current = shared.buildLanguageLearningCatalogue({ languageCode, productLevel: 'BEGINNER' });
    assert.ok(current.modules.flatMap((module) => module.lessons).every((lesson) => !lesson.id.startsWith('en-beginner:')));
    assert.deepEqual(shared.lintLanguageCurriculum(current), []);
  }
  assert.equal(shared.getLanguageCurriculumProfile('ar').direction, 'rtl');
  assert.equal(shared.getLanguageCurriculumProfile('he').direction, 'rtl');
  assert.equal(shared.getLanguageCurriculumProfile('ja').direction, 'ltr');
});

test('six materially different CEFR expectations preserve initial placement and the historical five-pillar curriculum', () => {
  const spines = Object.values(shared.LANGUAGE_CEFR_COMPETENCY_SPINE);
  assert.equal(new Set(spines.map((s) => s.expectation)).size, 6);
  assert.equal(new Set(spines.map((s) => s.textComplexity)).size, 6);
  for (const productLevel of ['INTERMEDIATE', 'ADVANCED']) {
    const c = shared.buildLanguageLearningCatalogue({ languageCode: 'fr', productLevel });
    assert.notEqual(c.modules[8].lessons[0].objective, c.modules[8].lessons[3].objective);
  }
  assert.equal(shared.LANGUAGE_MASTERY_THRESHOLD, 0.9); assert.equal(shared.RLLE_CURRICULUM.length, 18);
  assert.equal(shared.placementProductLevel('A1'), 'BEGINNER'); assert.equal(shared.placementProductLevel('C1'), 'ADVANCED');
});

test('module entry points permit interleaving while dependent lessons require canonical prerequisites', () => {
  const c = view(); assert.equal(c.modules[0].lessons[0].status, 'AVAILABLE');
  assert.equal(c.modules[0].lessons[1].status, 'LOCKED');
  assert.equal(c.modules[7].lessons[0].status, 'AVAILABLE', 'no compulsory 25-grammar-lesson wall before speaking');
  assert.ok(c.modules.flatMap((m) => m.lessons).filter((l) => l.cefrLevel === 'A2').every((l) => l.status === 'LOCKED'));
  assert.equal(c.currentLessonId, catalogue.modules[0].lessons[0].id); assert.equal(c.stageAssessmentAvailable, false);
});

test('89 and 89.9 fail, 90 and 91 pass before rounding and only with canonical completion', () => {
  const id = catalogue.modules[0].lessons[0].id;
  for (const [score, passed] of [[0.89, false], [0.899, false], [0.9, true], [0.91, true]]) {
    const c = view([evidence('lesson', id, score)]);
    assert.equal(find(c, id).status, passed ? 'MASTERED' : 'NEEDS_REMEDIATION');
    assert.equal(c.modules[0].lessons[1].status, passed ? 'AVAILABLE' : 'LOCKED');
  }
  assert.notEqual(find(view([evidence('lesson', id, 0.99, { completionId: null })]), id).status, 'MASTERED');
});

test('targeted remediation retains acquisitions, best scores and the existing English next lesson after replay', () => {
  const [a, b, c] = catalogue.modules[0].lessons;
  const rows = [evidence('lesson', a.id, 0.94), evidence('lesson', b.id, 0.91), evidence('lesson', c.id, 0.899, { weakConcepts: ['number-form'] })];
  assert.equal(view(rows).nextAction.lessonId, c.id); assert.equal(view(rows).nextAction.kind, 'remediate-lesson');
  const retry = evidence('lesson', c.id, 0.9, { remediation: true });
  const passed = view([...rows, retry, retry, evidence('lesson', c.id, null), evidence('lesson', c.id, 0.4)]);
  assert.equal(find(passed, a.id).bestScore, 0.94); assert.equal(find(passed, c.id).status, 'MASTERED');
  assert.equal(find(passed, c.id).bestScore, 0.9); assert.equal(find(passed, c.id).remediationCount, 1);
  assert.deepEqual(find(passed, c.id).weakConcepts, []);
  assert.equal(passed.currentLessonId, 'en-beginner:basics:days-week');
  assert.deepEqual(view(JSON.parse(JSON.stringify([...rows, retry]))), view([...rows, retry]));
});

test('NOT_EVALUABLE has no zero score, never grants mastery and never erases a known evaluated weakness', () => {
  const id = catalogue.modules[0].lessons[0].id;
  const neutral = find(view([evidence('lesson', id, null)]), id);
  assert.equal(neutral.status, 'NOT_EVALUABLE'); assert.equal(neutral.score, null);
  const failed = find(view([evidence('lesson', id, 0.7), evidence('lesson', id, null)]), id);
  assert.equal(failed.status, 'NEEDS_REMEDIATION'); assert.equal(failed.score, 0.7);
});

test('stage-scoped module exams use 90 percent and do not borrow legacy or another-stage decisions', () => {
  const rows = catalogue.modules[0].lessons.filter((l) => l.cefrLevel === 'A1').map((l) => evidence('lesson', l.id, 0.95));
  assert.equal(view(rows).modules[0].assessmentAvailable, true);
  for (const [score, expected] of [[0.899, 'NEEDS_REMEDIATION'], [0.9, 'MASTERED']]) {
    assert.equal(view([...rows, evidence('module', 'A1:basics', score, { cefrLevel: 'A1' })]).modules[0].status, expected);
  }
  const old = view([...rows, evidence('module', 'basics', 0.99)]);
  assert.notEqual(old.modules[0].status, 'MASTERED'); assert.equal(old.modules[0].bestScore, 0.99);
  assert.notEqual(view([...rows, evidence('module', 'A1:basics', 1, { cefrLevel: 'A2' })]).modules[0].status, 'MASTERED');
});

test('written pronunciation practice permits the written stage exam without certifying acoustic mastery', () => {
  const c = view(stageProof('A1'));
  assert.equal(c.modules[6].status, 'NOT_EVALUABLE'); assert.equal(c.modules[6].practiceOnlyProgression, true);
  assert.equal(c.modules[6].score, null); assert.equal(c.modules[6].assessmentAvailable, false);
  assert.equal(c.stageAssessmentAvailable, true); assert.equal(c.nextAction.kind, 'stage-assessment');
  assert.equal(c.pronunciationAcoustic, 'BLOCKED_CAPABILITY'); assert.equal(c.levelStatus, 'IN_PROGRESS');
});

test('missing, failed or unavailable written pronunciation evidence prevents the stage decision', () => {
  const id = catalogue.modules[6].lessons.find((l) => l.cefrLevel === 'A1').id;
  const rows = stageProof('A1').filter((item) => item.targetId !== id);
  for (const score of [null, 0.899]) {
    const c = view([...rows, evidence('lesson', id, score), evidence('stage', 'A1', 1, { cefrLevel: 'A1' })]);
    assert.equal(c.stageAssessmentAvailable, false); assert.notEqual(c.stages[0].status, 'MASTERED'); assert.equal(c.nextCefrLevel, null);
  }
});

test('A1 exam rejects 89.9, accepts 90 only with all prerequisites and does not skip the product pair', () => {
  const rows = stageProof('A1');
  const failed = view([...rows, evidence('stage', 'A1', 0.899, { cefrLevel: 'A1', weakLessonIds: [catalogue.modules[0].lessons[0].id] })]);
  assert.equal(failed.stages[0].status, 'NEEDS_REMEDIATION'); assert.equal(failed.nextCefrLevel, null);
  assert.equal(failed.nextAction.kind, 'stage-remediation');
  const passed = view([...rows, evidence('stage', 'A1', 0.9, { cefrLevel: 'A1' })]);
  assert.equal(passed.stages[0].status, 'MASTERED'); assert.equal(passed.nextAction.kind, 'next-stage');
  assert.equal(passed.nextCefrLevel, 'A2'); assert.equal(passed.nextProductLevel, null);
  assert.notEqual(view([evidence('stage', 'A1', 1, { cefrLevel: 'A1' })]).stages[0].status, 'MASTERED');
});

test('A1 to A2 preserves acquired work; product completion requires both CEFR stage passes', () => {
  const rows = [...stageProof('A1'), evidence('stage', 'A1', 0.9, { cefrLevel: 'A1' })];
  const a2 = view(rows, { cefrLevel: 'A2' });
  assert.equal(a2.stages[0].status, 'MASTERED'); assert.equal(a2.stages[1].status, 'AVAILABLE');
  assert.equal(find(a2, catalogue.modules[0].lessons[0].id).status, 'MASTERED');
  assert.equal(a2.currentLessonId, 'en-beginner:basics:numbers-20-1000');
  const completed = view([...rows, ...stageProof('A2'), evidence('stage', 'A2', 0.95, { cefrLevel: 'A2' })], { cefrLevel: 'A2' });
  assert.equal(completed.levelStatus, 'MASTERED'); assert.equal(completed.nextProductLevel, 'INTERMEDIATE');
  assert.equal(completed.nextAction.kind, 'next-level'); assert.equal(completed.modules[6].status, 'NOT_EVALUABLE');
  assert.equal(completed.pronunciationAcoustic, 'BLOCKED_CAPABILITY');
  assert.equal(view([...stageProof('A2'), evidence('stage', 'A2', 1, { cefrLevel: 'A2' })], { cefrLevel: 'A2' }).nextProductLevel, null);
});

for (const [from, to] of [['A1', 'A2'], ['A2', 'B1'], ['B1', 'B2'], ['B2', 'C1'], ['C1', 'C2']]) {
  test(`explicit CEFR transition ${from} -> ${to}: every prerequisite and raw 90 percent are required`, () => {
    const productLevel = shared.curriculumProductLevel(from);
    const currentCatalogue = shared.buildLanguageLearningCatalogue({ languageCode: 'en', productLevel, cefrLevel: from });
    const priorStage = currentCatalogue.cefrLevels[0] === from ? null : currentCatalogue.cefrLevels[0];
    const priorRows = priorStage ? [...stageProof(priorStage, currentCatalogue),
      evidence('stage', priorStage, 0.9, { cefrLevel: priorStage })] : [];
    const rows = [...priorRows, ...stageProof(from, currentCatalogue)];
    const project = (proof) => view(proof, { productLevel, cefrLevel: from });
    const transition = (current) => current.nextCefrLevel ?? (current.nextProductLevel
      ? shared.LANGUAGE_CURRICULUM_PRODUCT_STAGES[current.nextProductLevel][0] : null);
    const stageDecision = (score) => evidence('stage', from, score, { cefrLevel: from });
    assert.equal(project(rows).stageAssessmentAvailable, true);
    assert.equal(transition(project(rows)), null, 'completing prerequisites alone never invents a stage-exam result');
    assert.equal(transition(project([...rows, stageDecision(0.899)])), null, '89.9 percent fails before display rounding');
    const accepted = project([...rows, stageDecision(0.9)]);
    assert.equal(transition(accepted), to);
    assert.equal(accepted.stages.find((stage) => stage.cefrLevel === from).status, 'MASTERED');
    assert.equal(accepted.nextAction.kind, shared.curriculumProductLevel(to) === productLevel ? 'next-stage' : 'next-level');
    const firstRequired = currentCatalogue.modules[0].lessons.find((lesson) => lesson.cefrLevel === from);
    const missingLesson = project([...rows.filter((row) => row.targetId !== firstRequired.id), stageDecision(0.9)]);
    assert.equal(transition(missingLesson), null, 'a missing canonical lesson completion blocks even a 90-percent stage claim');
    assert.equal(missingLesson.stageAssessmentAvailable, false);
    const failedModule = project([...rows.filter((row) => row.targetId !== `${from}:basics`),
      evidence('module', `${from}:basics`, 0.899, { cefrLevel: from }), stageDecision(0.9)]);
    assert.equal(transition(failedModule), null, 'an 89.9-percent required module cannot be bypassed by the stage score');
    assert.equal(failedModule.stageAssessmentAvailable, false);
    const unavailable = project([...rows, stageDecision(null)]);
    assert.equal(transition(unavailable), null, 'NOT_EVALUABLE is neither a zero nor a successful stage exam');
    assert.equal(unavailable.stages.find((stage) => stage.cefrLevel === from).score, null);
    assert.equal(accepted.pronunciationAcoustic, 'BLOCKED_CAPABILITY', 'pedagogical transition does not certify acoustics');
  });
}

test('future acquired lessons and scores remain visible without fabricating earlier-stage completion', () => {
  const future = catalogue.modules[4].lessons.find((l) => l.cefrLevel === 'A2');
  const c = view([evidence('lesson', future.id, 0.93)]);
  assert.equal(find(c, future.id).status, 'MASTERED'); assert.equal(find(c, future.id).bestScore, 0.93);
  assert.equal(c.stages[1].status, 'LOCKED'); assert.equal(c.stages[1].masteredLessons, 1); assert.equal(c.nextCefrLevel, null);
});

test('placement into the later CEFR stage permits its lessons without manufacturing a pass in the prior stage', () => {
  for (const [productLevel, cefrLevel] of [['BEGINNER', 'A2'], ['INTERMEDIATE', 'B2'], ['ADVANCED', 'C2']]) {
    const c = view([], { productLevel, cefrLevel });
    assert.equal(c.cefrLevel, cefrLevel);
    assert.equal(c.stages[0].status, 'AVAILABLE');
    assert.equal(c.stages[0].masteredLessons, 0);
    assert.equal(c.stages[1].status, 'AVAILABLE');
    assert.equal(c.modules[0].lessons.find((lesson) => lesson.cefrLevel === cefrLevel).status, 'AVAILABLE');
    assert.equal(c.nextProductLevel, null);
    assert.equal(c.reachableCefrLevels, undefined, 'only the API knows the authoritative placement');
  }
});

test('stale versions, absent provenance, invalid scores or wrong stage cannot unlock dependent lessons', () => {
  const id = catalogue.modules[0].lessons[0].id;
  for (const patch of [{ contentVersion: 0 }, { submissionId: '' }, { evaluatedAt: 'bad' }, { maximumPoints: 0 },
    { awardedPoints: -1 }, { awardedPoints: 1001 }, { maximumPoints: NaN }, { scope: 'module' }, { targetId: 'foreign' }, { cefrLevel: 'A2' }]) {
    const c = view([evidence('lesson', id, 1, patch)]);
    assert.notEqual(find(c, id).status, 'MASTERED'); assert.equal(c.modules[0].lessons[1].status, 'LOCKED');
  }
});

test('lint identifies duplicate IDs, invalid prerequisites, CEFR reversal, English leakage, empty modules and impossible assessments', () => {
  const checks = [
    ['DUPLICATE_ID', (c) => { c.modules[0].lessons[1].id = c.modules[0].lessons[0].id; }],
    ['MISSING_OBJECTIVE', (c) => { c.modules[0].lessons[0].objective = ''; }],
    ['MISSING_PREREQUISITE', (c) => { c.modules[0].lessons[0].prerequisites = ['missing']; }],
    ['CIRCULAR_PREREQUISITE', (c) => { c.modules[0].lessons[0].prerequisites = [c.modules[0].lessons[1].id]; }],
    ['CEFR_ORDER', (c) => { c.modules[0].lessons[0].prerequisites = [c.modules[0].lessons[3].id]; }],
    ['ENGLISH_GRAMMAR_LEAK', (c) => { c.modules[0].lessons[0].title = 'English alphabet'; }],
    ['EMPTY_STAGE_MODULE', (c) => { c.modules[0].lessons = []; }],
    ['UNTRANSLATED_METADATA_KEY', (c) => { c.modules[0].lessons[0].titleKey = 'not-loaded.title'; }],
    ['IMPOSSIBLE_ASSESSMENT', (c) => { c.modules[0].lessons[0].assessmentBlueprint.acousticCertificationRequired = true; }],
  ];
  for (const [code, mutate] of checks) {
    const c = shared.buildLanguageLearningCatalogue({ languageCode: 'ja', productLevel: 'BEGINNER' });
    mutate(c); assert.ok(shared.lintLanguageCurriculum(c).some((issue) => issue.code === code), code);
  }
});
