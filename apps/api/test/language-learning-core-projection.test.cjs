'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const shared = require('@second-brain/shared');

// Exercise the current pure read boundary without rebuilding the whole API.
// API typecheck/build independently verifies its production compilation.
const sourcePath = path.resolve(__dirname, '../src/languages/language-learning-core-projection.ts');
const source = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const compiled = new Module(sourcePath, module);
compiled.filename = sourcePath;
compiled.paths = module.paths;
compiled._compile(source, sourcePath);
const { loadLanguageLearningCoreEvidence, loadLanguageLearningCoreProjection, applyLanguageLearningCorePosition } = compiled.exports;

const userId = 'technical-owner';
const profileId = 'technical-language';
const context = { sessionId: 'technical-core-session', productLevel: 'BEGINNER', cefrLevel: 'A1' };
const catalogue = shared.buildLanguageLearningCatalogue({ languageCode: 'en', ...context });
const target = catalogue.modules[0].lessons[0];
const when = new Date('2026-10-20T14:00:00.000Z');

function fixture() {
  const lesson = { id: 'source-lesson', userId, languageProfileId: profileId, contentVersion: 1,
    masteryRemediationGenerationKey: `language-core:${profileId}:BEGINNER:${target.id}:0` };
  const question = { id: `${target.id}:0`, prompt: 'Choose the written first letter.',
    format: 'mcq', options: ['A', 'B', 'C'], answerKey: 'A', points: 1, rubric: 'A is the first letter.' };
  const metadata = { version: 1, profileId, sessionId: context.sessionId,
    catalogueVersion: shared.LANGUAGE_LEARNING_CORE_VERSION, productLevel: 'BEGINNER',
    scope: 'lesson', targetId: target.id, variant: 0,
    sourceLessonIds: [lesson.id], sourceContentVersions: [1], questionLessonIds: [target.id], supportLanguage: 'fr' };
  const assessment = { id: 'canonical-assessment', userId, lessonId: lesson.id, contentVersion: 1,
    masteryCreationKey: `language-core:${profileId}:BEGINNER:lesson:${target.id}:0`,
    masteryGenerationStatus: 'ready', questions: { version: 2, languageLearningCore: metadata, questions: [question] },
    createdAt: when, submissions: [] };
  const submission = { id: 'canonical-submission', userId, assessmentId: assessment.id,
    masteryGenerationStatus: 'ready', masterySubmissionKey: `language-core:${assessment.id}`,
    answers: ['A'], score: 100,
    results: [{ questionId: question.id, prompt: question.prompt, learnerAnswer: 'A',
      awarded: 1, max: 1, verdict: 'correct', why: question.rubric, how: question.rubric }],
    createdAt: when };
  submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
    id: assessment.id, answers: submission.answers,
  })).digest('hex');
  assessment.submissions.push(submission);
  const completion = { id: 'canonical-completion', userId, lessonId: lesson.id, learningRefId: lesson.id,
    contentVersion: 1, status: 'verified', evidenceRefId: submission.id, assessmentSubmissionId: submission.id };
  const session = { id: context.sessionId, userId, languageProfileId: profileId,
    currentStep: { metadata: { languageLearningCore: { version: 1, profileId,
      productLevel: 'BEGINNER', cefrLevel: 'A1', activeScope: 'lesson', activeTargetId: target.id } } } };
  const data = { lesson, question, metadata, assessment, submission, completion, session,
    assessments: [assessment], sources: [lesson], completions: [completion], presentProfile: true, presentSession: true };
  const queries = [];
  const ownedQuery = (table, request) => {
    queries.push([table, request]);
    assert.equal(request.where.userId, userId, `${table} query must be owner scoped`);
  };
  const prisma = {
    languageProfile: { findFirst: async (request) => {
      ownedQuery('languageProfile', request);
      assert.equal(request.where.id, profileId);
      return data.presentProfile ? { language: 'English', normalizedLanguage: 'en' } : null;
    } },
    experienceSession: { findFirst: async (request) => {
      ownedQuery('experienceSession', request);
      assert.equal(request.where.languageProfileId, profileId);
      assert.equal(request.where.intent, 'language-learning-core');
      return data.presentSession ? data.session : null;
    } },
    assessment: { findMany: async (request) => {
      ownedQuery('assessment', request);
      assert.equal(request.include.submissions.where.userId, userId);
      assert.equal(request.include.submissions.where.masteryGenerationStatus, 'ready');
      assert.equal(request.where.masteryGenerationStatus, 'ready');
      return data.assessments;
    } },
    lesson: { findMany: async (request) => {
      ownedQuery('lesson', request);
      assert.equal(request.where.languageProfileId, profileId);
      return data.sources;
    } },
    learningCompletion: { findMany: async (request) => {
      ownedQuery('completion', request);
      assert.equal(request.where.status, 'verified');
      assert.equal(request.where.kind, 'lesson');
      assert.equal(request.where.evidenceSource, 'assessment_submission');
      return data.completions;
    } },
  };
  return { ...data, data, prisma, queries };
}

// Ten distinct closed written items exercise canonical reconstruction, not
// provider generation or the pedagogical quality of any generated curriculum.
const CLOSED_WRITTEN_ITEMS = [
  ['Choose the first letter in the English alphabet.', ['A', 'B', 'C'], 'A'],
  ['Choose the written number for two.', ['2', '3', '4'], '2'],
  ['Choose the subject pronoun for the speaker.', ['I', 'you', 'they'], 'I'],
  ['Choose the plural of book.', ['books', 'booked', 'booking'], 'books'],
  ['Complete: She ___ a teacher.', ['is', 'are', 'am'], 'is'],
  ['Complete: They ___ a house.', ['have', 'has', 'having'], 'have'],
  ['Choose the question asking for a name.', ['What is your name?', 'Where is your name?', 'When is your name?'], 'What is your name?'],
  ['Choose the negative of I like tea.', ['I do not like tea.', 'I does not like tea.', 'I not tea like.'], 'I do not like tea.'],
  ['Complete: Yesterday I ___ home.', ['went', 'go', 'going'], 'went'],
  ['Complete: Tomorrow I ___ study.', ['will', 'was', 'did'], 'will'],
];

function seedTenClosedWrittenItems(f, definitions) {
  const selected = CLOSED_WRITTEN_ITEMS.map((_, index) => definitions[index % definitions.length]);
  f.metadata.questionLessonIds = selected.map((definition) => definition.id);
  f.assessment.questions.questions = CLOSED_WRITTEN_ITEMS.map(([prompt, options, answerKey], index) => ({
    id: `${selected[index].id}:${index}`, prompt, format: 'mcq', options: [...options],
    answerKey, points: 1, rubric: `The expected written answer is ${answerKey}.`,
  }));
  f.submission.answers = f.assessment.questions.questions.map((question) => question.answerKey);
  f.submission.results = f.assessment.questions.questions.map((question) => ({ questionId: question.id,
    prompt: question.prompt, learnerAnswer: question.answerKey, awarded: 1, max: 1,
    verdict: 'correct', why: question.rubric, how: question.rubric }));
  f.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
    id: f.assessment.id, answers: f.submission.answers,
  })).digest('hex');
}

function aggregateFixture(scope, targetId, definitions, stage) {
  const f = fixture();
  f.data.sources = definitions.map((definition, index) => ({
    id: `aggregate-source-${index}`, userId, languageProfileId: profileId, contentVersion: 1,
    masteryRemediationGenerationKey: `language-core:${profileId}:BEGINNER:${definition.id}:0`,
  }));
  Object.assign(f.metadata, { scope, targetId, sourceLessonIds: f.data.sources.map((source) => source.id),
    sourceContentVersions: definitions.map(() => 1), questionLessonIds: definitions.slice(0, 10).map((definition) => definition.id) });
  if (stage) f.metadata.cefrLevel = stage;
  Object.assign(f.assessment, { lessonId: null, contentVersion: null,
    masteryCreationKey: `language-core:${profileId}:BEGINNER:${scope}:${targetId}:0` });
  f.assessment.questions.questions = definitions.slice(0, 10).map((definition) => ({ ...f.question, id: `${definition.id}:0` }));
  f.submission.answers = f.assessment.questions.questions.map(() => 'A');
  f.submission.results = f.assessment.questions.questions.map((question) => ({ ...f.submission.results[0], questionId: question.id }));
  f.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({ id: f.assessment.id, answers: f.submission.answers })).digest('hex');
  if (stage) seedTenClosedWrittenItems(f, definitions);
  f.data.completions = [];
  return f;
}

test('stage-scoped module and stage submissions reload only their exact CEFR source set', async () => {
  for (const scope of ['module', 'stage']) {
    const definitions = (scope === 'module' ? catalogue.modules[0].lessons : catalogue.modules.flatMap((module) => module.lessons))
      .filter((lesson) => lesson.cefrLevel === 'A1');
    const targetId = scope === 'module' ? 'A1:basics' : 'A1';
    const f = aggregateFixture(scope, targetId, definitions, 'A1');
    const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].scope, scope);
    assert.equal(evidence[0].cefrLevel, 'A1');
    assert.equal(evidence[0].targetId, targetId);
    assert.equal(evidence[0].awardedPoints, f.submission.answers.length);
    const missing = aggregateFixture(scope, targetId, definitions.slice(1), 'A1');
    assert.deepEqual(await loadLanguageLearningCoreEvidence(missing.prisma, userId, profileId, context), []);
    const extra = aggregateFixture(scope, targetId, [...definitions, catalogue.modules[0].lessons.find((lesson) => lesson.cefrLevel === 'A2')], 'A1');
    assert.deepEqual(await loadLanguageLearningCoreEvidence(extra.prisma, userId, profileId, context), []);
  }
});

test('new stage-scoped module and stage evidence require at least ten real closed items, never nine', async () => {
  for (const scope of ['module', 'stage']) {
    const definitions = (scope === 'module' ? catalogue.modules[0].lessons : catalogue.modules.flatMap((module) => module.lessons))
      .filter((lesson) => lesson.cefrLevel === 'A1');
    const targetId = scope === 'module' ? 'A1:basics' : 'A1';
    const complete = aggregateFixture(scope, targetId, definitions, 'A1');
    assert.equal(complete.assessment.questions.questions.length, 10);
    assert.equal(new Set(complete.assessment.questions.questions.map((question) => question.id)).size, 10);
    assert.equal(new Set(complete.assessment.questions.questions.map((question) => question.prompt)).size, 10);
    assert.equal((await loadLanguageLearningCoreEvidence(complete.prisma, userId, profileId, context)).length, 1);
    const short = aggregateFixture(scope, targetId, definitions, 'A1');
    short.assessment.questions.questions.pop();
    short.metadata.questionLessonIds.pop();
    short.submission.answers.pop();
    short.submission.results.pop();
    short.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
      id: short.assessment.id, answers: short.submission.answers,
    })).digest('hex');
    assert.equal(short.submission.answers.length, 9);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(short.prisma, userId, profileId, context), [], scope);
  }
});

test('aggregate metadata rejects absent, mismatched, unsupported and out-of-product CEFR stages', async () => {
  const definitions = catalogue.modules[0].lessons.filter((lesson) => lesson.cefrLevel === 'A1');
  for (const stage of [undefined, 'A2', 'B1', 'PRE_A1', 'invented']) {
    const f = aggregateFixture('module', 'A1:basics', definitions, stage);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), [], String(stage));
  }
  for (const [targetId, stage] of [['A1', 'A2'], ['B1', 'B1'], ['unknown', 'A1']]) {
    const f = aggregateFixture('stage', targetId, definitions, stage);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
  }
});

test('old lesson metadata derives CEFR from its preserved definition and refuses an inconsistent explicit stage', async () => {
  const f = fixture();
  const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
  assert.equal(evidence[0].cefrLevel, target.cefrLevel);
  f.metadata.cefrLevel = target.cefrLevel === 'A1' ? 'A2' : 'A1';
  assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
});

test('legacy module and level evidence retain precisely their frozen English source universe without certifying new stages', async () => {
  const byId = new Map(catalogue.modules.flatMap((module) => module.lessons).map((lesson) => [lesson.id, lesson]));
  for (const scope of ['module', 'level']) {
    const targetId = scope === 'module' ? 'basics' : 'BEGINNER';
    const ids = shared.getLegacyEnglishBeginnerLessonIds(scope === 'module' ? 'basics' : undefined);
    const definitions = ids.map((id) => byId.get(id));
    assert.ok(definitions.every(Boolean));
    if (scope === 'level') assert.equal(ids.length, 230);
    const f = aggregateFixture(scope, targetId, definitions);
    const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].cefrLevel, undefined);
    const projected = shared.projectLanguageLearningCore({ languageCode: 'en', ...context, evidence });
    assert.ok(projected.stages.every((stage) => stage.status !== 'MASTERED'));
    const newDefinition = catalogue.modules.flatMap((module) => module.lessons).find((lesson) => !ids.includes(lesson.id));
    const expanded = aggregateFixture(scope, targetId, [...definitions, newDefinition]);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(expanded.prisma, userId, profileId, context), []);
    f.metadata.cefrLevel = 'A1';
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
  }
});

test('an explicit language-contract correction is not remediation, while legacy positive variants remain compatible', async () => {
  for (const explicit of [false, undefined]) {
    const f = fixture();
    f.metadata.variant = 1;
    if (explicit !== undefined) f.metadata.remediation = explicit;
    f.lesson.masteryRemediationGenerationKey = `language-core:${profileId}:BEGINNER:${target.id}:1`;
    f.assessment.masteryCreationKey = `language-core:${profileId}:BEGINNER:lesson:${target.id}:1`;
    const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0].remediation, explicit === undefined);
  }
  const malformed = fixture(); malformed.metadata.remediation = 'false';
  assert.deepEqual(await loadLanguageLearningCoreEvidence(malformed.prisma, userId, profileId, context), []);
});

test('canonical source, immutable question/rubric and exact completion produce the same Passport and core mastery', async () => {
  const f = fixture();
  const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].completionId, f.completion.id);
  assert.equal(evidence[0].awardedPoints, 1);
  assert.equal(evidence[0].maximumPoints, 1);
  const passport = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.equal(passport.modules[0].lessons[0].status, 'MASTERED');
  assert.equal(passport.modules[0].lessons[1].status, 'AVAILABLE');
  assert.equal(passport.currentLessonId, target.id, 'navigation remains on the actual current lesson');
  assert.equal(passport.nextAction.lessonId, catalogue.modules[0].lessons[1].id);
  assert.ok(f.queries.length > 0);
});

test('missing or foreign profile/session cannot expose a projection or accept evidence', async () => {
  for (const field of ['presentProfile', 'presentSession']) {
    const f = fixture();
    f.data[field] = false;
    assert.equal(await loadLanguageLearningCoreProjection(f.prisma, userId, profileId), null);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
  }
  for (const patch of [{ userId: 'foreign-owner' }, { languageProfileId: 'foreign-profile' }]) {
    const f = fixture();
    Object.assign(f.session, patch);
    assert.equal(await loadLanguageLearningCoreProjection(f.prisma, userId, profileId), null);
  }
});

test('stale catalogue/scope/session versions and misattributed source lessons are rejected', async () => {
  for (const patch of [
    { version: 0 }, { catalogueVersion: 'stale' }, { profileId: 'foreign-profile' },
    { sessionId: 'foreign-session' }, { productLevel: 'ADVANCED' }, { scope: 'invented' },
    { targetId: 'invented-lesson' }, { variant: -1 }, { variant: 1.5 },
    { sourceContentVersions: [2] }, { sourceLessonIds: ['missing-source'] },
    { questionLessonIds: ['foreign-notion'] },
  ]) {
    const f = fixture();
    Object.assign(f.metadata, patch);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), [], JSON.stringify(patch));
  }
  for (const patch of [
    { userId: 'foreign-owner' }, { languageProfileId: 'foreign-profile' }, { contentVersion: 2 },
    { masteryRemediationGenerationKey: `language-core:${profileId}:BEGINNER:other-notion:0` },
  ]) {
    const f = fixture();
    Object.assign(f.lesson, patch);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
  }
});

test('wrong answer hash, rubric max, score, question identity, answer attribution and unknown options never become evidence', async () => {
  for (const mutate of [
    (f) => { f.submission.masterySubmissionHash = 'wrong'; },
    (f) => { f.submission.score = 99; },
    (f) => { f.submission.results[0].max = 2; },
    (f) => { f.submission.results[0].questionId = 'other-question'; },
    (f) => { f.submission.results[0].learnerAnswer = 'B'; },
    (f) => { f.submission.results[0].awarded = 100; },
    (f) => { f.submission.results[0].verdict = 'partial'; },
    (f) => { f.question.id = 'other-notion:0'; },
    (f) => { f.submission.answers = ['']; },
    (f) => { f.submission.answers = ['not-an-option']; },
    (f) => { f.assessment.masteryCreationKey = 'unrelated-key'; },
    (f) => { f.submission.masterySubmissionKey = 'unrelated-key'; },
  ]) {
    const f = fixture();
    mutate(f);
    assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
  }
});

test('a missing/revoked/foreign/stale or wrong-source completion cannot turn a high score into lesson mastery', async () => {
  for (const patch of [
    null, { status: 'revoked' }, { userId: 'foreign-user' }, { lessonId: 'foreign-lesson' },
    { learningRefId: 'foreign-lesson' }, { contentVersion: 2 }, { evidenceRefId: 'foreign-submission' },
  ]) {
    const f = fixture();
    if (patch === null) f.data.completions = [];
    else Object.assign(f.completion, patch);
    const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
    assert.equal(evidence.length, 1, 'the valid canonical score remains recorded');
    assert.equal(evidence[0].completionId, null);
    const projected = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
    assert.notEqual(projected.modules[0].lessons[0].status, 'MASTERED');
    assert.equal(projected.modules[0].lessons[1].status, 'LOCKED');
  }
});

test('a real failed closed answer remains 0 rather than unavailable, with its correct targeted weakness', async () => {
  const f = fixture();
  f.submission.answers = ['B'];
  f.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
    id: f.assessment.id, answers: f.submission.answers,
  })).digest('hex');
  f.submission.results[0] = { ...f.submission.results[0], learnerAnswer: 'B', awarded: 0, verdict: 'incorrect' };
  f.submission.score = 0;
  f.data.completions = [];
  const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
  assert.equal(evidence[0].awardedPoints, 0);
  assert.deepEqual(evidence[0].weakLessonIds, [target.id]);
  const projected = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.equal(projected.modules[0].lessons[0].status, 'NEEDS_REMEDIATION');
  assert.equal(projected.modules[0].lessons[0].score, 0);
});

test('module evidence cannot masquerade a single mastered lesson as complete module prerequisites', async () => {
  const f = fixture();
  f.metadata.scope = 'module';
  f.metadata.targetId = catalogue.modules[0].id;
  f.assessment.masteryCreationKey = `language-core:${profileId}:BEGINNER:module:${f.metadata.targetId}:0`;
  assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
  const projected = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.notEqual(projected.modules[0].status, 'MASTERED');
  assert.equal(projected.modules[1].assessmentAvailable, false);
  assert.equal(projected.stageAssessmentAvailable, false);
});

test('the transversal module test accepts all curriculum sources but cannot skip any prerequisite module', async () => {
  const f = fixture();
  const legacyIds = new Set(shared.getLegacyEnglishBeginnerLessonIds());
  const definitions = catalogue.modules.flatMap((module) => module.lessons).filter((lesson) => legacyIds.has(lesson.id));
  f.data.sources = definitions.map((definition, index) => ({
    id: `source-${index}`, userId, languageProfileId: profileId, contentVersion: 1,
    masteryRemediationGenerationKey: `language-core:${profileId}:BEGINNER:${definition.id}:0`,
  }));
  f.metadata.scope = 'module';
  f.metadata.targetId = 'practice-review-assessment';
  f.metadata.sourceLessonIds = f.data.sources.map((source) => source.id);
  f.metadata.sourceContentVersions = f.data.sources.map(() => 1);
  const selected = definitions.slice(0, 10);
  f.metadata.questionLessonIds = selected.map((definition) => definition.id);
  f.assessment.lessonId = null;
  f.assessment.contentVersion = null;
  f.assessment.masteryCreationKey = `language-core:${profileId}:BEGINNER:module:practice-review-assessment:0`;
  f.assessment.questions.questions = selected.map((definition) => ({
    ...f.question, id: `${definition.id}:0`,
  }));
  f.submission.answers = selected.map(() => 'A');
  f.submission.results = f.assessment.questions.questions.map((question) => ({
    ...f.submission.results[0], questionId: question.id,
  }));
  f.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
    id: f.assessment.id, answers: f.submission.answers,
  })).digest('hex');
  f.data.completions = [];
  const evidence = await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].scope, 'module');
  assert.equal(evidence[0].targetId, 'practice-review-assessment');
  const projected = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.equal(projected.modules[10].assessmentAvailable, false);
  assert.equal(projected.levelAssessmentAvailable, false);
  f.metadata.sourceLessonIds.pop();
  f.metadata.sourceContentVersions.pop();
  assert.deepEqual(await loadLanguageLearningCoreEvidence(f.prisma, userId, profileId, context), []);
});

test('persisted lesson position resumes teaching without granting mastery or overriding locks/remediation', () => {
  const core = shared.projectLanguageLearningCore({ languageCode: 'en', ...context, evidence: [] });
  const position = { activeScope: 'lesson', activeTargetId: target.id,
    lessonLinks: { [target.id]: { id: 'source-lesson', variant: 0 } } };
  const before = JSON.stringify(core);
  const opened = applyLanguageLearningCorePosition(core, position);
  assert.equal(opened.modules[0].status, 'IN_PROGRESS');
  assert.equal(opened.modules[0].lessons[0].status, 'IN_PROGRESS');
  assert.equal(opened.modules[0].lessons[0].score, null);
  assert.equal(opened.nextAction.kind, 'resume-lesson');
  assert.equal(opened.modules[0].lessons[1].status, 'LOCKED');
  assert.equal(JSON.stringify(core), before);
  const failed = structuredClone(core);
  failed.modules[0].lessons[0].status = 'NEEDS_REMEDIATION';
  failed.nextAction.kind = 'remediate-lesson';
  assert.equal(applyLanguageLearningCorePosition(failed, position).modules[0].lessons[0].status, 'NEEDS_REMEDIATION');
  assert.equal(applyLanguageLearningCorePosition(failed, position).nextAction.kind, 'remediate-lesson');
});

test('persisted CEFR module and stage assessment positions never masquerade as a selected lesson', () => {
  const core = shared.projectLanguageLearningCore({ languageCode: 'en', ...context, evidence: [] });
  const module = applyLanguageLearningCorePosition(core, { activeScope: 'module', activeTargetId: 'A1:basics' });
  assert.equal(module.currentModuleId, 'basics');
  assert.equal(module.currentLessonId, null);
  const stage = applyLanguageLearningCorePosition(core, { activeScope: 'stage', activeTargetId: 'A1' });
  assert.equal(stage.currentModuleId, null);
  assert.equal(stage.currentLessonId, null);
  assert.deepEqual(stage.modules, core.modules);
  assert.equal(stage.levelStatus, core.levelStatus);
  assert.equal(applyLanguageLearningCorePosition(core, { activeScope: 'module', activeTargetId: 'B2:basics' }), core);
});

test('read projection is repeatable and never writes state, calls a provider or rewrites the frozen placement', async () => {
  const f = fixture();
  const before = JSON.stringify({ session: f.session, rows: f.data.assessments, sources: f.data.sources });
  const one = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  const two = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.deepEqual(one, two);
  assert.equal(JSON.stringify({ session: f.session, rows: f.data.assessments, sources: f.data.sources }), before);
  assert.equal(one.pronunciationAcoustic, 'BLOCKED_CAPABILITY');
  assert.equal(one.levelAssessmentAvailable, false);
  assert.equal('placement' in one, false);
});

test('canonical written practice and its removal recalculate the shared Passport without certifying acoustics or blocking unrelated practice', async () => {
  const f = fixture();
  const sources = [];
  const assessments = [];
  const completions = [];
  const sourceByDefinition = new Map();
  for (const definition of catalogue.modules.slice(0, 7).flatMap(module => module.lessons).filter((lesson) => lesson.cefrLevel === context.cefrLevel)) {
    const row = fixture();
    const ordinal = sources.length;
    row.lesson.id = `source-written-${ordinal}`;
    row.lesson.masteryRemediationGenerationKey = `language-core:${profileId}:BEGINNER:${definition.id}:0`;
    row.question.id = `${definition.id}:0`;
    row.metadata.targetId = definition.id;
    row.metadata.sourceLessonIds = [row.lesson.id];
    row.metadata.questionLessonIds = [definition.id];
    row.assessment.id = `assessment-written-${ordinal}`;
    row.assessment.lessonId = row.lesson.id;
    row.assessment.masteryCreationKey = `language-core:${profileId}:BEGINNER:lesson:${definition.id}:0`;
    row.submission.id = `submission-written-${ordinal}`;
    row.submission.assessmentId = row.assessment.id;
    row.submission.masterySubmissionKey = `language-core:${row.assessment.id}`;
    row.submission.results[0].questionId = row.question.id;
    row.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
      id: row.assessment.id, answers: row.submission.answers,
    })).digest('hex');
    Object.assign(row.completion, { id: `completion-written-${ordinal}`, lessonId: row.lesson.id,
      learningRefId: row.lesson.id, evidenceRefId: row.submission.id, assessmentSubmissionId: row.submission.id });
    sources.push(row.lesson);
    assessments.push(row.assessment);
    completions.push(row.completion);
    sourceByDefinition.set(definition.id, row.lesson);
  }
  for (const module of catalogue.modules.slice(0, 6)) {
    const row = fixture();
    const definitions = module.lessons.filter((lesson) => lesson.cefrLevel === context.cefrLevel);
    row.metadata.scope = 'module';
    row.metadata.cefrLevel = context.cefrLevel;
    row.metadata.targetId = `${context.cefrLevel}:${module.id}`;
    row.metadata.sourceLessonIds = definitions.map(definition => sourceByDefinition.get(definition.id).id);
    row.metadata.sourceContentVersions = definitions.map(() => 1);
    row.metadata.questionLessonIds = definitions.map(definition => definition.id);
    row.assessment.id = `assessment-module-${module.id}`;
    row.assessment.lessonId = null;
    row.assessment.contentVersion = null;
    row.assessment.masteryCreationKey = `language-core:${profileId}:BEGINNER:module:${row.metadata.targetId}:0`;
    row.assessment.questions.questions = definitions.map(definition => ({ ...row.question, id: `${definition.id}:0` }));
    row.submission.id = `submission-module-${module.id}`;
    row.submission.assessmentId = row.assessment.id;
    row.submission.masterySubmissionKey = `language-core:${row.assessment.id}`;
    row.submission.answers = definitions.map(() => 'A');
    row.submission.results = row.assessment.questions.questions.map(question => ({
      ...row.submission.results[0], questionId: question.id,
    }));
    row.submission.masterySubmissionHash = createHash('sha256').update(JSON.stringify({
      id: row.assessment.id, answers: row.submission.answers,
    })).digest('hex');
    seedTenClosedWrittenItems(row, definitions);
    assessments.push(row.assessment);
  }
  f.data.sources = sources;
  f.data.assessments = assessments;
  f.data.completions = completions;
  f.session.currentStep.metadata.languageLearningCore.activeScope = null;
  f.session.currentStep.metadata.languageLearningCore.activeTargetId = null;
  const before = JSON.stringify({ session: f.session, sources, assessments, completions });
  const projected = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.equal(projected.modules[6].status, 'NOT_EVALUABLE');
  assert.equal(projected.modules[6].practiceOnlyProgression, true);
  assert.equal(projected.modules[6].score, null);
  assert.equal(projected.modules[6].assessmentAvailable, false);
  assert.equal(projected.modules[7].lessons.find((lesson) => lesson.cefrLevel === context.cefrLevel).status, 'AVAILABLE');
  assert.equal(projected.levelAssessmentAvailable, false);
  assert.equal(projected.nextProductLevel, null);
  assert.equal(projected.pronunciationAcoustic, 'BLOCKED_CAPABILITY');
  assert.deepEqual(await loadLanguageLearningCoreProjection(f.prisma, userId, profileId), projected);
  assert.equal(JSON.stringify({ session: f.session, sources, assessments, completions }), before);
  // Removing one real written completion recalculates that module's practice
  // state; interleaved speaking practice remains accessible, not certified.
  const lastPronunciationSource = sourceByDefinition.get(catalogue.modules[6].lessons.filter((lesson) => lesson.cefrLevel === context.cefrLevel).at(-1).id).id;
  f.data.completions = completions.filter(completion => completion.lessonId !== lastPronunciationSource);
  const recalculated = await loadLanguageLearningCoreProjection(f.prisma, userId, profileId);
  assert.equal(recalculated.modules[6].practiceOnlyProgression, false);
  assert.equal(recalculated.modules[6].masteredLessons, projected.modules[6].masteredLessons - 1);
  assert.equal(recalculated.modules[6].score, null);
  assert.equal(recalculated.stageAssessmentAvailable, false);
  assert.equal(recalculated.nextCefrLevel, null);
  assert.equal(recalculated.levelAssessmentAvailable, false);
});
