'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

const input = { languageCode: 'en', productLevel: 'BEGINNER', cefrLevel: 'A1' };
const catalogue = shared.buildLanguageLearningCatalogue(input);
let serial = 0;
function evidence(scope, targetId, score, patch = {}) {
  serial += 1;
  return {
    scope, targetId, contentVersion: 1,
    submissionId: `submission-${serial}`,
    completionId: scope === 'lesson' && score !== null && score >= 0.9 ? `completion-${serial}` : null,
    state: score === null ? 'not-evaluable' : 'evaluated',
    awardedPoints: score === null ? null : score * 1000,
    maximumPoints: score === null ? null : 1000,
    evaluatedAt: new Date(Date.UTC(2026, 9, 20, 12, 0, serial)).toISOString(),
    ...patch,
  };
}
function view(rows = [], patch = {}) {
  return shared.projectLanguageLearningCore({ ...input, ...patch, evidence: rows });
}
function moduleProof(module, score = 0.94) {
  return [
    ...module.lessons.map((lesson) => evidence('lesson', lesson.id, 0.95)),
    evidence('module', module.id, score),
  ];
}

test('English Beginner contains exactly the eleven official ordered modules and 230 distinct stable lessons', () => {
  assert.deepEqual(catalogue.modules.map((module) => module.id), shared.LANGUAGE_LEARNING_MODULE_IDS);
  assert.deepEqual(catalogue.modules.map((module) => module.order), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepEqual(catalogue.modules.map((module) => module.lessons.length), [15, 15, 25, 25, 25, 20, 25, 25, 30, 25, 0]);
  const lessons = catalogue.modules.flatMap((module) => module.lessons);
  assert.equal(lessons.length, 230);
  assert.equal(new Set(lessons.map((lesson) => lesson.id)).size, 230);
  assert.ok(lessons.every((lesson) => lesson.id && lesson.moduleId && lesson.contentVersion === 1));
  assert.equal(catalogue.curriculumStatus, 'COMPLETE');
  assert.equal(catalogue.modules[0].lessons[0].id, 'en-beginner:basics:english-alphabet');
  assert.deepEqual(shared.buildLanguageLearningCatalogue(input), catalogue);
});

test('every lesson defines a real objective, expected skills and versioned assessment criteria', () => {
  for (const module of catalogue.modules) {
    for (const lesson of module.lessons) {
      assert.ok(lesson.objective.length > 50);
      assert.ok(lesson.skills.length >= 3);
      assert.equal(lesson.criteria.length, lesson.skills.length);
      assert.ok(lesson.criteria.every((criterion) => criterion.id.startsWith(lesson.id) && criterion.description));
      assert.deepEqual(module.lessons.map((row) => row.order), module.lessons.map((_, i) => i + 1));
    }
  }
});

test('module 11 is the same 28-capability transversal toolkit, not an invented extra curriculum', () => {
  const toolkit = catalogue.modules[10];
  assert.equal(toolkit.kind, 'transversal');
  assert.equal(toolkit.lessons.length, 0);
  assert.equal(toolkit.toolkit.length, 28);
  assert.deepEqual(toolkit.toolkit, shared.LANGUAGE_LEARNING_TOOLKIT);
  assert.equal(new Set(toolkit.toolkit).size, 28);
  assert.ok(toolkit.toolkit.includes('lesson-quiz'));
  assert.ok(toolkit.toolkit.includes('module-test'));
  assert.ok(toolkit.toolkit.includes('spaced-repetition'));
});

test('the shared level catalogue distinguishes Beginner, Intermediate and Advanced without fabricating completed content', () => {
  for (const [productLevel, cefrLevels] of [
    ['BEGINNER', ['A1', 'A2']], ['INTERMEDIATE', ['B1', 'B2']], ['ADVANCED', ['C1', 'C2']],
  ]) {
    const current = shared.buildLanguageLearningCatalogue({ languageCode: 'en', productLevel });
    assert.deepEqual(current.cefrLevels, cefrLevels);
    assert.equal(current.modules.length, 11);
    if (productLevel !== 'BEGINNER') {
      assert.equal(current.curriculumStatus, 'PARTIAL');
      assert.ok(current.modules.every((module) => module.lessons.length === 0));
      const partial = view([], { productLevel });
      assert.equal(partial.levelStatus, 'LOCKED');
      assert.equal(partial.nextAction.kind, 'catalogue-unavailable');
      assert.equal(partial.levelAssessmentAvailable, false);
    }
  }
  const otherLanguage = shared.buildLanguageLearningCatalogue({ languageCode: 'ja', productLevel: 'BEGINNER' });
  assert.equal(otherLanguage.curriculumStatus, 'PARTIAL');
  assert.equal(otherLanguage.modules.length, 11);
  assert.ok(otherLanguage.modules.every((module) => !module.lessons.some((lesson) => /English/.test(lesson.title))));
});

test('catalogue objects are isolated per request and CEFR detail cannot escape its product-level range', () => {
  const mutated = shared.buildLanguageLearningCatalogue(input);
  mutated.modules[0].lessons[0].skills.push('client-mutation');
  mutated.modules[10].toolkit.length = 0;
  assert.deepEqual(shared.buildLanguageLearningCatalogue(input), catalogue);
  assert.equal(shared.buildLanguageLearningCatalogue({ ...input, cefrLevel: 'C2' }).cefrLevel, 'A1');
  assert.equal(shared.buildLanguageLearningCatalogue({ ...input, cefrLevel: 'A2' }).cefrLevel, 'A2');
});

test('all 34 existing language codes and three product levels retain one shared catalogue architecture', () => {
  assert.equal(shared.SUPPORTED_LANGUAGE_CODES.length, 34);
  for (const languageCode of shared.SUPPORTED_LANGUAGE_CODES) {
    for (const productLevel of ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) {
      const current = shared.buildLanguageLearningCatalogue({ languageCode, productLevel });
      assert.equal(current.languageCode, languageCode);
      assert.equal(current.productLevel, productLevel);
      assert.deepEqual(current.modules.map((module) => module.id), shared.LANGUAGE_LEARNING_MODULE_IDS);
      assert.equal(current.curriculumStatus, languageCode === 'en' && productLevel === 'BEGINNER' ? 'COMPLETE' : 'PARTIAL');
    }
  }
});

test('post-placement prepares only the first lesson and never infers mastery from reading or an absent assessment', () => {
  const current = view();
  assert.equal(current.modules[0].status, 'AVAILABLE');
  assert.equal(current.modules[0].lessons[0].status, 'AVAILABLE');
  assert.equal(current.modules[0].lessons[1].status, 'LOCKED');
  assert.equal(current.modules[1].status, 'LOCKED');
  assert.equal(current.currentLessonId, catalogue.modules[0].lessons[0].id);
  assert.equal(current.nextAction.kind, 'start-lesson');
  assert.equal(current.modules[0].lessons[0].score, null);
  assert.equal(current.modules[0].assessmentAvailable, false);
});

test('89, 89.9 fail while 90 and 91 pass only with canonical lesson completion, before rounding', () => {
  const lessonId = catalogue.modules[0].lessons[0].id;
  for (const [score, passed] of [[0.89, false], [0.899, false], [0.9, true], [0.91, true]]) {
    const current = view([evidence('lesson', lessonId, score)]);
    assert.equal(current.modules[0].lessons[0].status, passed ? 'MASTERED' : 'NEEDS_REMEDIATION');
    assert.equal(current.modules[0].lessons[1].status, passed ? 'AVAILABLE' : 'LOCKED');
    assert.equal(current.nextAction.kind, passed ? 'start-lesson' : 'remediate-lesson');
  }
  const noCompletion = view([evidence('lesson', lessonId, 0.99, { completionId: null })]);
  assert.notEqual(noCompletion.modules[0].lessons[0].status, 'MASTERED');
  assert.equal(noCompletion.modules[0].lessons[1].status, 'LOCKED');
});

test('failed lesson is the only remediation target and later success unlocks the next lesson without losing acquisitions', () => {
  const [one, two, three, four] = catalogue.modules[0].lessons;
  const rows = [
    evidence('lesson', one.id, 0.94), evidence('lesson', two.id, 0.91),
    evidence('lesson', three.id, 0.87, { weakConcepts: ['number-form'] }),
  ];
  const failed = view(rows);
  assert.deepEqual(failed.modules[0].lessons.slice(0, 4).map((lesson) => lesson.status),
    ['MASTERED', 'MASTERED', 'NEEDS_REMEDIATION', 'LOCKED']);
  assert.equal(failed.currentLessonId, three.id);
  assert.deepEqual(failed.modules[0].lessons[2].weakConcepts, ['number-form']);
  const passed = view([...rows, evidence('lesson', three.id, 0.93, { remediation: true })]);
  assert.deepEqual(passed.modules[0].lessons.slice(0, 4).map((lesson) => lesson.status),
    ['MASTERED', 'MASTERED', 'MASTERED', 'AVAILABLE']);
  assert.equal(passed.currentLessonId, four.id);
  assert.equal(passed.modules[0].lessons[2].remediationCount, 1);
  assert.deepEqual(passed.modules[0].lessons[2].weakConcepts, []);
});

test('verified mastery and best score survive a later failure or NOT_EVALUABLE observation', () => {
  const lessonId = catalogue.modules[0].lessons[0].id;
  const current = view([
    evidence('lesson', lessonId, 0.94), evidence('lesson', lessonId, 0.6),
    evidence('lesson', lessonId, null),
  ]).modules[0].lessons[0];
  assert.equal(current.status, 'MASTERED');
  assert.equal(current.bestScore, 0.94);
  assert.equal(current.score, 0.6);
  assert.ok(current.completionId);
});

test('NOT_EVALUABLE has a null score, grants no mastery, and cannot hide an evaluated failure', () => {
  const lessonId = catalogue.modules[0].lessons[0].id;
  const unavailable = view([evidence('lesson', lessonId, null)]);
  assert.equal(unavailable.modules[0].lessons[0].status, 'NOT_EVALUABLE');
  assert.equal(unavailable.modules[0].lessons[0].score, null);
  assert.equal(unavailable.modules[0].lessons[1].status, 'LOCKED');
  const failed = view([evidence('lesson', lessonId, 0.89), evidence('lesson', lessonId, null)]);
  assert.equal(failed.modules[0].lessons[0].status, 'NEEDS_REMEDIATION');
  assert.equal(failed.modules[0].lessons[0].score, 0.89);
});

test('a module test is separate, prerequisite-bound, and its 90 percent gate preserves all mastered lessons', () => {
  const first = catalogue.modules[0];
  assert.equal(view([evidence('module', first.id, 0.99)]).modules[0].status, 'AVAILABLE');
  const lessons = first.lessons.map((lesson) => evidence('lesson', lesson.id, 0.96));
  const ready = view(lessons);
  assert.equal(ready.modules[0].assessmentAvailable, true);
  assert.equal(ready.modules[0].status, 'IN_PROGRESS');
  assert.equal(ready.nextAction.kind, 'module-assessment');
  const failed = view([...lessons, evidence('module', first.id, 0.88, {
    weakLessonIds: [first.lessons[2].id, first.lessons[4].id, 'foreign-module-lesson'],
  })]);
  assert.equal(failed.modules[0].status, 'NEEDS_REMEDIATION');
  assert.equal(failed.modules[0].masteredLessons, 15);
  assert.deepEqual(failed.modules[0].weakLessonIds, [first.lessons[2].id, first.lessons[4].id]);
  assert.equal(failed.modules[1].status, 'LOCKED');
  assert.equal(failed.nextAction.kind, 'module-remediation');
  const passed = view([...lessons, evidence('module', first.id, 0.88), evidence('module', first.id, 0.92)]);
  assert.equal(passed.modules[0].status, 'MASTERED');
  assert.equal(passed.modules[1].status, 'AVAILABLE');
  assert.equal(passed.currentModuleId, catalogue.modules[1].id);
  assert.equal(passed.modules[0].bestScore, 0.92);
});

test('acoustic capability remains blocked and text/STT results can never manufacture pronunciation or level certification', () => {
  const rows = catalogue.modules.flatMap((module) => moduleProof(module));
  rows.push(evidence('level', 'BEGINNER', 1));
  const current = view(rows);
  assert.equal(current.modules[6].status, 'NOT_EVALUABLE');
  assert.equal(current.modules[6].assessmentAvailable, false);
  assert.equal(current.modules[6].assessmentBlockedReason, 'acoustic-unavailable');
  assert.equal(current.modules[7].status, 'MASTERED', 'independent written proofs remain usable after practice-only progression');
  assert.equal(current.modules[6].practiceOnlyProgression, true);
  assert.equal(current.modules[6].score, null);
  assert.equal(current.modules[6].bestScore, null);
  assert.equal(current.levelAssessmentAvailable, false);
  assert.notEqual(current.levelStatus, 'MASTERED');
  assert.equal(current.nextProductLevel, null);
  assert.equal(current.pronunciationAcoustic, 'BLOCKED_CAPABILITY');
  assert.equal(current.nextAction.kind, 'capability-blocked');
});

test('completed written pronunciation practice opens module 8 without certifying pronunciation or the level', () => {
  const preceding = catalogue.modules.slice(0, 6).flatMap((module) => moduleProof(module));
  const pronunciation = catalogue.modules[6];
  const writtenPractice = pronunciation.lessons.map((lesson) => evidence('lesson', lesson.id, 0.94));
  const current = view([...preceding, ...writtenPractice]);
  assert.equal(current.modules[6].status, 'NOT_EVALUABLE');
  assert.equal(current.modules[6].practiceOnlyProgression, true);
  assert.equal(current.modules[6].assessmentAvailable, false);
  assert.equal(current.modules[6].score, null);
  assert.equal(current.modules[7].status, 'AVAILABLE');
  assert.equal(current.modules[7].lessons[0].status, 'AVAILABLE');
  assert.equal(current.currentModuleId, catalogue.modules[7].id);
  assert.equal(current.currentLessonId, catalogue.modules[7].lessons[0].id);
  assert.equal(current.nextAction.kind, 'start-lesson');
  assert.equal(current.levelAssessmentAvailable, false);
  assert.equal(current.nextProductLevel, null);
  assert.equal(current.pronunciationAcoustic, 'BLOCKED_CAPABILITY');
  assert.deepEqual(view(JSON.parse(JSON.stringify([...preceding, ...writtenPractice]))), current,
    'F5/reconnection reconstruct exactly the same practice eligibility from canonical evidence');
});

test('failed written pronunciation practice requires targeted remediation and does not open module 8 early', () => {
  const preceding = catalogue.modules.slice(0, 6).flatMap((module) => moduleProof(module));
  const pronunciation = catalogue.modules[6];
  const practice = pronunciation.lessons.slice(0, -1).map((lesson) => evidence('lesson', lesson.id, 0.94));
  const last = pronunciation.lessons.at(-1);
  const failed = view([...preceding, ...practice, evidence('lesson', last.id, 0.899)]);
  assert.equal(failed.modules[6].practiceOnlyProgression, false);
  assert.equal(failed.modules[6].lessons.at(-1).status, 'NEEDS_REMEDIATION');
  assert.equal(failed.modules[6].masteredLessons, pronunciation.lessons.length - 1);
  assert.equal(failed.modules[7].status, 'LOCKED');
  assert.equal(failed.nextAction.kind, 'remediate-lesson');
  assert.equal(failed.nextAction.lessonId, last.id);
  const remediated = view([...preceding, ...practice,
    evidence('lesson', last.id, 0.899), evidence('lesson', last.id, 0.9, { remediation: true })]);
  assert.equal(remediated.modules[6].status, 'NOT_EVALUABLE');
  assert.equal(remediated.modules[6].practiceOnlyProgression, true);
  assert.equal(remediated.modules[7].status, 'AVAILABLE');
});

test('practice-only progression cannot skip ordinary prerequisites or count an unavailable/STT observation as mastery', () => {
  const preceding = catalogue.modules.slice(0, 5).flatMap((module) => moduleProof(module));
  const pronunciation = catalogue.modules[6];
  const writtenPractice = pronunciation.lessons.map((lesson) => evidence('lesson', lesson.id, 1));
  const missingSix = view([...preceding, ...writtenPractice]);
  assert.equal(missingSix.modules[5].status, 'AVAILABLE');
  assert.equal(missingSix.modules[6].status, 'LOCKED');
  assert.equal(missingSix.modules[6].practiceOnlyProgression, false);
  assert.equal(missingSix.modules[7].status, 'LOCKED');
  const fullPreceding = catalogue.modules.slice(0, 6).flatMap((module) => moduleProof(module));
  const neutralOnly = view([...fullPreceding,
    ...pronunciation.lessons.map((lesson) => evidence('lesson', lesson.id, null)),
    evidence('module', pronunciation.id, 1)]);
  assert.equal(neutralOnly.modules[6].practiceOnlyProgression, false);
  assert.equal(neutralOnly.modules[6].score, null);
  assert.equal(neutralOnly.modules[7].status, 'LOCKED');
  assert.equal(neutralOnly.levelAssessmentAvailable, false);
});

test('modules after pronunciation keep their normal 90 percent module gates and acquired lesson history', () => {
  const preceding = catalogue.modules.slice(0, 6).flatMap((module) => moduleProof(module));
  const writtenPractice = catalogue.modules[6].lessons.map((lesson) => evidence('lesson', lesson.id, 0.95));
  const speaking = catalogue.modules[7];
  const speakingLessons = speaking.lessons.map((lesson) => evidence('lesson', lesson.id, 0.94));
  const failed = view([...preceding, ...writtenPractice, ...speakingLessons,
    evidence('module', speaking.id, 0.89, { weakLessonIds: [speaking.lessons[2].id] })]);
  assert.equal(failed.modules[7].status, 'NEEDS_REMEDIATION');
  assert.equal(failed.modules[7].masteredLessons, speaking.lessons.length);
  assert.equal(failed.modules[8].status, 'LOCKED');
  assert.deepEqual(failed.modules[7].weakLessonIds, [speaking.lessons[2].id]);
  const passed = view([...preceding, ...writtenPractice, ...speakingLessons,
    evidence('module', speaking.id, 0.9)]);
  assert.equal(passed.modules[7].status, 'MASTERED');
  assert.equal(passed.modules[8].status, 'AVAILABLE');
  assert.equal(passed.modules[6].status, 'NOT_EVALUABLE');
  assert.equal(passed.levelAssessmentAvailable, false);
  assert.equal(passed.nextProductLevel, null);
});

test('level remediation keeps canonical weak targets scoped and preserves all prior lesson acquisitions', () => {
  const first = catalogue.modules[0].lessons[0];
  const weak = catalogue.modules[3].lessons[2];
  const rows = [evidence('lesson', first.id, 0.96), evidence('level', 'BEGINNER', 0.88, {
    weakLessonIds: [weak.id, weak.id, 'foreign-level-lesson'],
  })];
  const failed = view(rows);
  assert.deepEqual(failed.levelWeakLessonIds, [weak.id]);
  assert.equal(failed.modules[0].lessons[0].status, 'MASTERED');
  assert.equal(failed.modules[0].lessons[0].bestScore, 0.96);
  assert.notEqual(failed.levelStatus, 'MASTERED');
  assert.equal(failed.levelAssessmentAvailable, false, 'level failures do not bypass the existing mandatory module prerequisites');
  assert.equal(failed.currentLessonId, catalogue.modules[0].lessons[1].id);
  const stale = view([...rows, evidence('level', 'BEGINNER', 0.88, {
    contentVersion: 0, weakLessonIds: [first.id],
  })]);
  assert.deepEqual(stale.levelWeakLessonIds, [weak.id]);
  const unavailable = view([...rows, evidence('level', 'BEGINNER', null)]);
  assert.deepEqual(unavailable.levelWeakLessonIds, [weak.id], 'a technical inability to re-evaluate cannot erase known weaknesses');
});

test('stale versions, missing provenance, invalid rubrics and unrelated targets cannot unlock progress', () => {
  const lessonId = catalogue.modules[0].lessons[0].id;
  for (const patch of [
    { contentVersion: 0 }, { submissionId: '' }, { evaluatedAt: 'bad-date' },
    { maximumPoints: 0 }, { awardedPoints: -1 }, { awardedPoints: 1001 },
    { maximumPoints: Number.NaN }, { scope: 'module' }, { targetId: 'other-lesson' },
  ]) {
    const current = view([evidence('lesson', lessonId, 1, patch)]);
    assert.notEqual(current.modules[0].lessons[0].status, 'MASTERED');
    assert.equal(current.modules[0].lessons[1].status, 'LOCKED');
  }
});

test('replay/reconnection is deterministic and idempotent without mutation or duplicate remediation counts', () => {
  const lessonId = catalogue.modules[0].lessons[0].id;
  const row = evidence('lesson', lessonId, 0.94, { remediation: true });
  const rows = Object.freeze([Object.freeze(row)]);
  const before = JSON.stringify(rows);
  const current = view(rows);
  assert.deepEqual(view(JSON.parse(before)), current);
  assert.deepEqual(view([row, row]), current);
  assert.equal(JSON.stringify(rows), before);
  assert.equal(current.modules[0].lessons[0].remediationCount, 1);
  assert.equal(current.currentLessonId, catalogue.modules[0].lessons[1].id);
});

test('the post-placement core never changes the initial placement classifier or historic CEFR curriculum', () => {
  assert.equal(shared.LANGUAGE_MASTERY_THRESHOLD, 0.9);
  assert.equal(shared.RLLE_CURRICULUM.length, 18);
  assert.equal(shared.placementProductLevel('A1'), 'BEGINNER');
  assert.equal(shared.placementProductLevel('B2'), 'INTERMEDIATE');
  assert.equal(shared.placementProductLevel('C1'), 'ADVANCED');
  const projected = view();
  assert.equal('placementScore' in projected, false);
  assert.equal('completionId' in projected, false);
});
