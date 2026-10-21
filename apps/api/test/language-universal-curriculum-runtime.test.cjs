'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LanguageLearningCoreService } = require('../dist/languages/language-learning-core.service');
const { buildLanguageLearningCatalogue, languageModuleAssessmentTarget } = require('@second-brain/shared');

// Deterministic method-boundary tests only. All records below are technical
// in-memory fixtures; no provider, database, account or network is contacted.
function fixture(patch = {}) {
  const core = Object.create(LanguageLearningCoreService.prototype);
  let state = { version: 1, profileId: 'technical-profile', productLevel: 'BEGINNER', cefrLevel: 'A1',
    lessonLinks: { 'prior-canonical-id': { id: 'prior-db-lesson', variant: 0 } },
    activeScope: 'lesson', activeTargetId: 'prior-canonical-id', activeAssessmentId: 'prior-assessment',
    answers: ['a persisted draft answer'], phase: 'result', teachingStep: 4, ...patch };
  let version = 3;
  const saved = [];
  const created = [];
  const profile = { id: 'technical-profile', language: 'English', normalizedLanguage: 'en',
    nativeLanguage: 'Lingala', teachingLanguageSource: 'interface' };
  const session = () => ({ id: 'technical-session', version,
    currentStep: { id: 'learning-core', state: 'active', metadata: { languageLearningCore: state } } });
  let view = { core: { nextCefrLevel: null, nextProductLevel: null, levelStatus: 'IN_PROGRESS',
    cefrLevels: ['A1', 'A2'], cefrLevel: state.cefrLevel,
    stages: [{ cefrLevel: 'A1', status: 'IN_PROGRESS' }, { cefrLevel: 'A2', status: 'LOCKED' }], modules: [] },
    reachableCefrLevels: ['A1'], supportLanguage: 'French', supportLanguageCode: 'fr', targetLanguage: 'English' };
  core.load = async () => ({ profile, session: session(), state, placement: { globalLevel: 'A1', productLevel: 'BEGINNER' },
    catalogue: buildLanguageLearningCatalogue({ languageCode: 'en', productLevel: state.productLevel, cefrLevel: state.cefrLevel }) });
  core.get = async () => view;
  core.save = async (_user, original, next) => {
    assert.equal(original.id, 'technical-session');
    saved.push(structuredClone(next)); state = next; version += 1; return session();
  };
  core.experiences = {
    create: async (_user, input) => { created.push(structuredClone(input)); return { id: 'next-technical-session' }; },
    get: async () => session(),
  };
  core.logger = { log() {}, error() {} };
  core.prisma = { profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) } };
  core.evidence = async () => [];
  core.llm = { generate: async () => { throw new Error('No provider call permitted in deterministic tests'); } };
  return { core, saved, created, profile, session, state: () => state,
    setView: (next) => { view = next; }, view: () => view };
}

test('A1 to A2 updates only the current CEFR position and preserves source links and previous session', async () => {
  const f = fixture();
  const linksBefore = structuredClone(f.state().lessonLinks);
  f.setView({ ...f.view(), core: { ...f.view().core, nextCefrLevel: 'A2',
    stages: [{ cefrLevel: 'A1', status: 'MASTERED' }, { cefrLevel: 'A2', status: 'AVAILABLE' }] } });
  await f.core.nextLevel('technical-user', 'technical-profile', 'advance-a2');
  assert.equal(f.saved.length, 1);
  assert.equal(f.state().cefrLevel, 'A2');
  assert.equal(f.state().productLevel, 'BEGINNER');
  assert.deepEqual(f.state().lessonLinks, linksBefore);
  assert.equal(f.state().activeAssessmentId, null);
  assert.equal(f.state().activeTargetId, null);
  assert.deepEqual(f.state().answers, []);
  assert.equal(f.created.length, 0);
});

test('A1 cannot advance from a projection whose current stage is not mastered', async () => {
  const f = fixture();
  f.setView({ ...f.view(), core: { ...f.view().core, nextCefrLevel: 'A2' } });
  await assert.rejects(f.core.nextLevel('technical-user', 'technical-profile', 'blocked-a2'), /Master the current CEFR stage/);
  assert.equal(f.saved.length, 0);
  assert.equal(f.created.length, 0);
});

test('A2 to B1 creates the existing next-product session without erasing old source links or answers', async () => {
  const f = fixture({ cefrLevel: 'A2' });
  const old = structuredClone(f.state());
  f.setView({ ...f.view(), core: { ...f.view().core, cefrLevel: 'A2', nextProductLevel: 'INTERMEDIATE', levelStatus: 'MASTERED' } });
  await f.core.nextLevel('technical-user', 'technical-profile', 'advance-b1');
  assert.equal(f.saved.length, 0, 'the old session must not be rewritten');
  assert.deepEqual(f.state(), old);
  assert.equal(f.created.length, 1);
  const created = f.created[0];
  assert.equal(created.idempotencyKey, 'language-core:v1:technical-profile:INTERMEDIATE');
  assert.equal(created.currentStep.metadata.languageLearningCore.cefrLevel, 'B1');
  assert.equal(created.currentStep.metadata.languageLearningCore.productLevel, 'INTERMEDIATE');
  assert.equal(created.currentStep.metadata.previousProductLevel, 'BEGINNER');
  assert.deepEqual(created.links, { languageProfileId: 'technical-profile' });
});

test('explicit revisit of an available earlier stage preserves mastery links and does not invoke providers', async () => {
  const f = fixture({ cefrLevel: 'A2' });
  const linksBefore = structuredClone(f.state().lessonLinks);
  f.setView({ ...f.view(), reachableCefrLevels: ['A1', 'A2'] });
  await f.core.nextLevel('technical-user', 'technical-profile', 'revisit-a1', 'A1');
  assert.equal(f.state().cefrLevel, 'A1');
  assert.deepEqual(f.state().lessonLinks, linksBefore);
  assert.equal(f.created.length, 0);
});

test('revisiting stages restores their own unfinished exam answers and preserves the other stage position', async () => {
  const a1Position = { activeScope: 'stage', activeTargetId: 'A1', activeAssessmentId: 'a1-unsealed-exam',
    answers: ['first A1 answer', ''], phase: 'assessment', teachingStep: 2 };
  const f = fixture({ cefrLevel: 'A2', activeScope: 'lesson', activeTargetId: 'a2-lesson',
    activeAssessmentId: 'a2-lesson-assessment', answers: ['unfinished A2 response'], phase: 'teaching', teachingStep: 3,
    stagePositions: { A1: a1Position } });
  f.setView({ ...f.view(), reachableCefrLevels: ['A1', 'A2'] });
  await f.core.nextLevel('technical-user', 'technical-profile', 'back-to-a1', 'A1');
  assert.equal(f.state().cefrLevel, 'A1');
  for (const [key, value] of Object.entries(a1Position)) assert.deepEqual(f.state()[key], value);
  assert.equal(f.state().stagePositions.A2.activeAssessmentId, 'a2-lesson-assessment');
  assert.deepEqual(f.state().stagePositions.A2.answers, ['unfinished A2 response']);
  await f.core.nextLevel('technical-user', 'technical-profile', 'return-to-a2', 'A2');
  assert.equal(f.state().cefrLevel, 'A2');
  assert.deepEqual(f.state().answers, ['unfinished A2 response']);
  assert.equal(f.state().activeAssessmentId, 'a2-lesson-assessment');
  assert.deepEqual(f.state().stagePositions.A1.answers, ['first A1 answer', '']);
});

test('future or foreign-product stage selection is rejected at the authoritative reachable-stage boundary', async () => {
  const f = fixture();
  await assert.rejects(f.core.nextLevel('technical-user', 'technical-profile', 'not-yet-a2', 'A2'), /not unlocked/);
  await assert.rejects(f.core.nextLevel('technical-user', 'technical-profile', 'foreign-b1', 'B1'), /not unlocked/);
  assert.equal(f.saved.length, 0);
  const stages = f.core.reachableStages({ cefrLevels: ['A1', 'A2'], cefrLevel: 'A1',
    stages: [{ status: 'IN_PROGRESS' }, { status: 'LOCKED' }] }, 'A1');
  assert.deepEqual(stages, ['A1']);
  assert.deepEqual(f.core.reachableStages({ cefrLevels: ['A1', 'A2'], cefrLevel: 'A1',
    stages: [{ status: 'IN_PROGRESS' }, { status: 'LOCKED' }] }, 'A2'), ['A1', 'A2']);
});

function authoredExercises(label, count = 5) {
  return Array.from({ length: count }, (_, index) => ({ type: 'qcm',
    question: `${label}: authentic persisted item ${index + 1}`,
    options: [`${label}-answer-${index}`, 'incorrect distractor'], answer: `${label}-answer-${index}`,
    correction: `Technical fixture correction tied to persisted item ${index + 1}.` }));
}

function assessmentFixture(exerciseCount = 5) {
  const f = fixture({ activeScope: null, activeTargetId: null, activeAssessmentId: null, answers: [] });
  const real = buildLanguageLearningCatalogue({ languageCode: 'en', productLevel: 'BEGINNER', cefrLevel: 'A1' });
  // Preserve real lesson metadata but keep the test fixture small. Two lessons
  // per module verify source-version mapping independently of question sampling.
  const modules = real.modules.slice(0, 2).map((module) => ({ ...module,
    lessons: [
      ...module.lessons.filter((lesson) => lesson.cefrLevel === 'A1').slice(0, 2),
      ...module.lessons.filter((lesson) => lesson.cefrLevel === 'A2').slice(0, 1),
    ] }));
  const contents = new Map();
  const sourceRows = [];
  let serial = 1;
  for (const module of modules) for (const definition of module.lessons) {
    const id = `db-source-${serial}`;
    f.state().lessonLinks[definition.id] = { id, variant: 0 };
    contents.set(id, { id, topic: definition.title, exercises: authoredExercises(id, exerciseCount) });
    sourceRows.push({ id, contentVersion: serial + 4 }); serial += 1;
  }
  let seeded = null;
  const reads = [];
  f.core.load = async () => ({ profile: f.profile, session: f.session(), state: f.state(),
    catalogue: { ...real, modules } });
  f.setView({ ...f.view(), core: { ...f.view().core, stageAssessmentAvailable: true,
    modules: modules.map((module) => ({ id: module.id, assessmentAvailable: true })) } });
  f.core.lessons = {
    get: async (_user, id) => { reads.push(id); assert.ok(contents.has(id)); return contents.get(id); },
    getLanguageRoleViolation: () => null,
  };
  f.core.prisma.lesson = { findMany: async ({ where }) => {
    assert.equal(where.userId, 'technical-user'); assert.equal(where.languageProfileId, 'technical-profile');
    return sourceRows.filter((row) => where.id.in.includes(row.id));
  } };
  f.core.examiner = { seedLanguageLearningCore: async (user, input) => {
    assert.equal(user, 'technical-user'); seeded = structuredClone(input); return { id: 'seeded-stage-assessment' };
  } };
  return { ...f, modules, sourceRows, reads, contents, seeded: () => seeded };
}

test('stage assessment samples at least ten persisted questions and preserves exact canonical source versions', async () => {
  const f = assessmentFixture();
  await f.core.startAssessment('technical-user', 'technical-profile', 'stage', 'A1', 'stage-assessment-one');
  const seeded = f.seeded();
  assert.equal(seeded.questions.length, 10);
  assert.equal(seeded.metadata.scope, 'stage');
  assert.equal(seeded.metadata.cefrLevel, 'A1');
  assert.equal(seeded.metadata.targetId, 'A1');
  const definitions = f.modules.flatMap((module) => module.lessons).filter((lesson) => lesson.cefrLevel === 'A1');
  const sourceIds = definitions.map((lesson) => f.state().lessonLinks[lesson.id].id);
  assert.deepEqual(seeded.metadata.sourceLessonIds, sourceIds);
  assert.deepEqual(f.reads, sourceIds);
  assert.deepEqual(seeded.metadata.sourceContentVersions,
    sourceIds.map((id) => f.sourceRows.find((row) => row.id === id).contentVersion));
  for (let index = 0; index < seeded.questions.length; index += 1) {
    const question = seeded.questions[index];
    const definitionId = seeded.metadata.questionLessonIds[index];
    const dbId = f.state().lessonLinks[definitionId].id;
    assert.ok(f.contents.get(dbId).exercises.some((exercise) => exercise.answer === question.answerKey
      && exercise.question === question.prompt && exercise.correction === question.correction));
    assert.ok(definitions.some((definition) => definition.id === definitionId));
  }
  assert.equal(f.state().activeScope, 'stage');
  assert.equal(f.state().activeAssessmentId, 'seeded-stage-assessment');
  assert.equal(f.state().answers.length, 10);
});

test('wrong CEFR stage is refused before source reading or assessment creation', async () => {
  const f = assessmentFixture();
  await assert.rejects(f.core.startAssessment('technical-user', 'technical-profile', 'stage', 'A2', 'wrong-stage'), /Master every required/);
  assert.equal(f.seeded(), null);
  assert.equal(f.reads.length, 0);
  assert.equal(f.saved.length, 0);
});

test('assessment requires ten genuinely authored items instead of manufacturing extra questions from titles', async () => {
  const f = assessmentFixture(4);
  await assert.rejects(f.core.startAssessment('technical-user', 'technical-profile', 'stage', 'A1', 'not-enough-authored'), /At least ten distinct authored/);
  assert.equal(f.seeded(), null);
  assert.equal(f.saved.length, 0);
});

test('a source whose canonical content version is unavailable cannot seed a stage assessment', async () => {
  const f = assessmentFixture();
  f.core.prisma.lesson.findMany = async () => [];
  await assert.rejects(f.core.startAssessment('technical-user', 'technical-profile', 'stage', 'A1', 'missing-source-version'), /source revision is unavailable/);
  assert.equal(f.seeded(), null);
  assert.equal(f.saved.length, 0);
});

test('module assessment IDs are stage-scoped and cannot be reused for another CEFR stage', async () => {
  const f = assessmentFixture();
  const moduleId = f.modules[0].id;
  await assert.rejects(f.core.startAssessment('technical-user', 'technical-profile', 'module',
    languageModuleAssessmentTarget('A2', moduleId), 'foreign-module-stage'), /Master every required/);
  await f.core.startAssessment('technical-user', 'technical-profile', 'module',
    languageModuleAssessmentTarget('A1', moduleId), 'matching-module-stage');
  assert.equal(f.seeded().metadata.cefrLevel, 'A1');
  assert.equal(f.seeded().metadata.scope, 'module');
  assert.equal(f.seeded().questions.length, 10);
});

test('runtime lesson generation receives the real immutable CEFR blueprint and support/target roles', async () => {
  const f = fixture({ productLevel: 'ADVANCED', cefrLevel: 'C1', lessonLinks: {},
    activeScope: null, activeTargetId: null, activeAssessmentId: null, answers: [] });
  const catalogue = buildLanguageLearningCatalogue({ languageCode: 'ja', productLevel: 'ADVANCED', cefrLevel: 'C1' });
  const definition = catalogue.modules.flatMap((module) => module.lessons).find((lesson) => lesson.cefrLevel === 'C1');
  assert.ok(definition);
  f.profile.language = 'Japanese'; f.profile.normalizedLanguage = 'ja';
  let generation;
  const content = { id: 'generated-technical-lesson', topic: definition.title, exercises: authoredExercises('generated', 10) };
  f.core.load = async () => ({ profile: f.profile, session: f.session(), state: f.state(), catalogue });
  f.core.get = async () => ({ ...f.view(),
    core: { ...f.view().core, modules: [{ lessons: [{ id: definition.id, status: 'AVAILABLE' }] }] },
    ...(f.state().activeAssessmentId ? { content, assessment: { id: 'seeded-lesson-assessment' },
      activeScope: 'lesson', activeTargetId: definition.id } : {}) });
  f.core.prisma.lesson = { findFirst: async () => null };
  f.core.lessons = { getLanguageRoleViolation: () => null,
    generate: async (user, request, options) => { generation = { user, request, options }; return content; } };
  f.core.seedLesson = async () => ({ id: 'seeded-lesson-assessment', questions: content.exercises,
    latestSubmission: null });
  await f.core.startLesson('technical-user', 'technical-profile', definition.id, 'generate-one-fixture');
  assert.equal(generation.user, 'technical-user');
  assert.equal(generation.options.languageRoleContext.supportLanguageCode, 'fr');
  assert.equal(generation.options.languageRoleContext.targetLanguageCode, 'ja');
  assert.match(generation.options.directive, /Support language: French/);
  assert.match(generation.options.directive, /Target language: Japanese/);
  const json = generation.options.directive.split('\n').map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).find((row) => row && row.lessonId === definition.id);
  assert.ok(json);
  assert.equal(json.cefrLevel, 'C1');
  assert.equal(json.language, 'ja');
  assert.deepEqual(json.linguisticTargets, definition.linguisticTargets);
  assert.deepEqual(json.prerequisites, definition.prerequisites);
  assert.deepEqual(json.assessmentBlueprint, definition.assessmentBlueprint);
  assert.deepEqual(json.masteryEvidence, definition.masteryEvidence);
  assert.deepEqual(json.runtimeGenerationConstraints, definition.runtimeGenerationConstraints);
  assert.match(generation.options.directive, /never change its lesson identity, CEFR, prerequisites, order or mastery criteria/);
  assert.equal(f.state().lessonLinks[definition.id].id, content.id);
  assert.equal(f.state().activeAssessmentId, 'seeded-lesson-assessment');
});
