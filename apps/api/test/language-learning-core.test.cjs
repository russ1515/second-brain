const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ExaminerService } = require('../dist/examiner/examiner.service');
const { LanguageLearningCoreService } = require('../dist/languages/language-learning-core.service');

function examinerFixture() {
  const assessments = new Map();
  const submissions = new Map();
  let calls = 0;
  const prisma = {
    languageProfile: { findFirst: async ({ where }) => where.userId === 'owner' ? { id: 'profile' } : null },
    experienceSession: { findFirst: async ({ where }) => where.userId === 'owner' ? { id: 'session' } : null },
    lesson: { findMany: async () => [{ id: 'lesson', contentVersion: 1 }] },
    onboardingProfile: { findUnique: async () => null },
    assessment: {
      upsert: async ({ where, create }) => {
        const key = where.userId_masteryCreationKey.masteryCreationKey;
        if (!assessments.has(key)) assessments.set(key, { ...create, id: `assessment-${assessments.size}`, createdAt: new Date() });
        return assessments.get(key);
      },
      findUnique: async ({ where }) => [...assessments.values()].find((row) => row.id === where.id) ?? null,
    },
    assessmentSubmission: {
      upsert: async ({ where, create }) => {
        const key = where.userId_masterySubmissionKey.masterySubmissionKey;
        if (!submissions.has(key)) submissions.set(key, { ...create, id: `submission-${submissions.size}`, createdAt: new Date() });
        return submissions.get(key);
      },
      findFirst: async ({ where }) => [...submissions.values()].filter((row) => row.assessmentId === where.assessmentId).at(-1) ?? null,
    },
  };
  const examiner = new ExaminerService(prisma, { generate: async () => { calls += 1; throw new Error('Provider must not be called'); } });
  const metadata = { version: 1, profileId: 'profile', sessionId: 'session', catalogueVersion: 'language-learning-core.v1',
    productLevel: 'BEGINNER', scope: 'lesson', targetId: 'stable-lesson', variant: 0,
    sourceLessonIds: ['lesson'], sourceContentVersions: [1], questionLessonIds: Array(10).fill('stable-lesson'), supportLanguage: 'fr' };
  const input = { metadata, lessonId: 'lesson', contentVersion: 1, topic: 'Alphabet', level: 'beginner',
    questions: Array.from({ length: 10 }, (_, index) => ({ id: `q${index}`, prompt: `Question ${index}`,
      options: ['right', 'wrong', 'other'], answerKey: 'right', correction: 'La forme attendue suit la règle ; autre exemple.' })) };
  return { examiner, prisma, metadata, input, assessments, submissions, calls: () => calls };
}

test('core assessment reuses the Examiner and canonical storage without provider calls', async () => {
  const f = examinerFixture();
  const view = await f.examiner.seedLanguageLearningCore('owner', f.input);
  assert.equal(view.questions.length, 10);
  assert.equal(f.calls(), 0);
  assert.ok(view.questions.every((question) => !('answerKey' in question) && !('rubric' in question)));
  const replay = await f.examiner.seedLanguageLearningCore('owner', f.input);
  assert.equal(replay.id, view.id);
  assert.equal(f.assessments.size, 1);
});

test('a 90 percent actual closed assessment persists a sealed submission with correction', async () => {
  const f = examinerFixture();
  const assessment = await f.examiner.seedLanguageLearningCore('owner', f.input);
  const submission = await f.examiner.submitLanguageLearningCore('owner', assessment.id, {
    profileId: 'profile', sessionId: 'session', idempotencyKey: 'first', answers: [...Array(9).fill('right'), 'wrong'],
  });
  assert.equal(submission.score, 90);
  assert.equal(submission.results[9].verdict, 'incorrect');
  assert.match(submission.results[9].why, /règle/);
  assert.equal(f.submissions.size, 1);
  assert.equal(f.calls(), 0);
});

test('same submission replays exactly and changed answers cannot rewrite score/history', async () => {
  const f = examinerFixture();
  const assessment = await f.examiner.seedLanguageLearningCore('owner', f.input);
  const request = { profileId: 'profile', sessionId: 'session', idempotencyKey: 'first', answers: Array(10).fill('wrong') };
  const first = await f.examiner.submitLanguageLearningCore('owner', assessment.id, request);
  const replay = await f.examiner.submitLanguageLearningCore('owner', assessment.id, { ...request, idempotencyKey: 'second' });
  assert.equal(first.id, replay.id);
  assert.equal(first.score, 0);
  await assert.rejects(f.examiner.submitLanguageLearningCore('owner', assessment.id, { ...request, answers: Array(10).fill('right') }), /already submitted/);
  assert.equal(f.submissions.size, 1);
  assert.equal([...f.submissions.values()][0].score, 0);
});

test('core grading rejects another profile/session and generic grading path', async () => {
  const f = examinerFixture();
  const assessment = await f.examiner.seedLanguageLearningCore('owner', f.input);
  await assert.rejects(f.examiner.submitLanguageLearningCore('owner', assessment.id, {
    profileId: 'other', sessionId: 'session', answers: Array(10).fill('right'), idempotencyKey: 'first',
  }), /not found/);
  await assert.rejects(f.examiner.submit('owner', assessment.id, Array(10).fill('right')), /scoped learning flow/);
  assert.equal(f.calls(), 0);
  assert.equal(f.submissions.size, 0);
});

test('assessment seed rejects keys changed for the same content identity and stale sources', async () => {
  const f = examinerFixture();
  await f.examiner.seedLanguageLearningCore('owner', f.input);
  await assert.rejects(f.examiner.seedLanguageLearningCore('owner', { ...f.input, topic: 'different' }), /source changed/);
  await assert.rejects(f.examiner.seedLanguageLearningCore('other', f.input), /sources not found/);
  await assert.rejects(f.examiner.seedLanguageLearningCore('owner', { ...f.input,
    metadata: { ...f.metadata, sourceContentVersions: [2] } }), /sources not found/);
});

test('server rejects non-closed answer keys instead of fabricating a score', async () => {
  const f = examinerFixture();
  await assert.rejects(f.examiner.seedLanguageLearningCore('owner', { ...f.input,
    questions: [{ ...f.input.questions[0], answerKey: 'not an option' }] }), /valid closed assessment/);
  assert.equal(f.calls(), 0);
});

function coreSubmitFixture(ratio) {
  let completions = 0;
  let saves = 0;
  const core = Object.create(LanguageLearningCoreService.prototype);
  const state = { version: 1, profileId: 'profile', productLevel: 'BEGINNER', cefrLevel: 'A1',
    lessonLinks: { target: { id: 'lesson', variant: 0 } }, activeScope: 'lesson', activeTargetId: 'target',
    activeAssessmentId: 'assessment', answers: [], phase: 'assessment' };
  core.load = async () => ({ session: { id: 'session' }, state });
  core.examiner = { submitLanguageLearningCore: async () => ({ id: 'submission',
    results: [{ awarded: ratio * 1000, max: 1000 }], score: ratio * 100 }),
    assessmentResultTotals: ExaminerService.prototype.assessmentResultTotals };
  core.completions = { finalizeLesson: async (_owner, _input, options) => {
    assert.equal(options.skipOptionalCards, true); completions += 1;
  } };
  core.save = async () => { saves += 1; };
  core.get = async () => ({ preserved: true });
  return { core, state, completions: () => completions, saves: () => saves };
}

for (const ratio of [0.89, 0.899, 0.9, 0.91]) {
  test(`lesson raw threshold ${ratio} publishes only at >= 0.9`, async () => {
    const f = coreSubmitFixture(ratio);
    assert.deepEqual(await f.core.submit('owner', 'profile', 'target', ['answer'], 'key'), { preserved: true });
    assert.equal(f.completions(), ratio >= 0.9 ? 1 : 0);
    assert.equal(f.saves(), 1);
  });
}

test('active assessment identity is server-authoritative and cannot submit another lesson', async () => {
  const f = coreSubmitFixture(1);
  await assert.rejects(f.core.submit('owner', 'profile', 'other-target', ['answer'], 'key'), /not active/);
  assert.equal(f.completions(), 0);
  assert.equal(f.saves(), 0);
});

test('autonomous exam forbids contextual help without calling the provider or mutating mastery', async () => {
  const f = coreSubmitFixture(1);
  let calls = 0;
  f.core.llm = { generate: async () => { calls += 1; } };
  await assert.rejects(f.core.help('owner', 'profile', 'target', 'Please explain', 'key'), /unavailable during/);
  assert.equal(calls, 0);
  assert.equal(f.completions(), 0);
  assert.equal(f.saves(), 0);
});

test('saving unfinished answers preserves exact answers and cannot reopen assisted teaching during exam', async () => {
  const f = coreSubmitFixture(0);
  f.core.examiner.get = async () => ({ latestSubmission: null, questions: [{ id: 'one' }, { id: 'two' }] });
  let saved;
  f.core.save = async (_owner, _session, next) => { saved = next; };
  await f.core.saveAnswers('owner', 'profile', 'target', ['right', '']);
  assert.deepEqual(saved.answers, ['right', '']);
  assert.equal(saved.phase, 'assessment');
  await assert.rejects(f.core.saveAnswers('owner', 'profile', 'target', ['right', ''], 'teaching'), /cannot return/);
});

test('invalid/NOT_EVALUABLE totals never publish completion', async () => {
  const f = coreSubmitFixture(1);
  f.core.examiner.assessmentResultTotals = () => null;
  await f.core.submit('owner', 'profile', 'target', ['answer'], 'key');
  assert.equal(f.completions(), 0);
});

test('help concurrent duplicate requests acquire exactly one paid-provider claim', async () => {
  const core = Object.create(LanguageLearningCoreService.prototype);
  const state = { activeScope: 'lesson', activeTargetId: 'target', phase: 'teaching',
    productLevel: 'BEGINNER', cefrLevel: 'A1' };
  core.load = async () => ({ session: { id: 'course' }, state });
  core.get = async () => ({ content: { id: 'lesson', topic: 'Alphabet', objective: 'Read letters',
    explanation: 'Lesson explanation', examples: ['A'], questions: ['Which letter?'] },
    core: { modules: [{ id: 'basics', title: 'Basics', lessons: [{ id: 'target', status: 'IN_PROGRESS', criteria: [] }] }] },
    supportLanguage: 'fr', targetLanguage: 'en', latestSubmission: null });
  core.evidence = async () => [];
  let claimed = false;
  let paid = 0;
  let writes = 0;
  core.prisma = { experienceSession: {
    findFirst: async () => null,
    updateMany: async () => {
      if (claimed) return { count: 0 };
      claimed = true;
      return { count: 1 };
    },
  } };
  core.experiences = { create: async () => ({ id: 'unique-help', version: 1 }),
    updateState: async () => { writes += 1; } };
  core.llm = { generate: async (_messages, options) => {
    paid += 1; assert.equal(options.operation, 'language-core-help'); return { text: 'Voici une explication ciblée.' };
  } };
  const results = await Promise.allSettled([
    core.help('owner', 'profile', 'target', 'Comment reconnaître cette lettre ?', 'same'),
    core.help('owner', 'profile', 'target', 'Comment reconnaître cette lettre ?', 'same'),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(paid, 1);
  assert.equal(writes, 1);
  assert.equal(state.phase, 'teaching');
});

test('unfinished module assessment start is an exact resume, not another exam', async () => {
  const core = Object.create(LanguageLearningCoreService.prototype);
  const state = { activeScope: 'module', activeTargetId: 'basics', activeAssessmentId: 'assessment' };
  const view = { core: { modules: [] }, preservedAnswers: ['one', ''] };
  core.load = async () => ({ session: { id: 'course' }, state, catalogue: { modules: [] } });
  core.get = async () => view;
  core.examiner = { get: async () => ({ latestSubmission: null }) };
  assert.equal(await core.startAssessment('owner', 'profile', 'module', 'basics', 'same'), view);
});

test('a failed module cannot reassess without fresh successful targeted remediation', async () => {
  const core = Object.create(LanguageLearningCoreService.prototype);
  const state = { activeScope: null, activeTargetId: null, activeAssessmentId: null,
    lessonLinks: { 'lesson-one': { id: 'db-one' } }, productLevel: 'BEGINNER' };
  core.load = async () => ({ session: { id: 'course' }, state,
    catalogue: { modules: [{ id: 'basics', lessons: [{ id: 'lesson-one', moduleId: 'basics' }] }] } });
  core.get = async () => ({ core: { modules: [{ id: 'basics', assessmentAvailable: true }] } });
  core.lessons = { get: async () => ({ id: 'db-one', exercises: [{ question: 'Question', type: 'qcm',
    options: ['one', 'two'], answer: 'one', correction: 'Explication' }] }) };
  core.evidence = async () => [{ scope: 'module', targetId: 'basics', awardedPoints: 8, maximumPoints: 10,
    evaluatedAt: '2026-10-20T10:00:00.000Z', weakLessonIds: ['lesson-one'] }];
  await assert.rejects(core.startAssessment('owner', 'profile', 'module', 'basics', 'new'), /new targeted remediation/);
});

test('a sealed passing submission survives a crash before completion publication without another provider call', async () => {
  const f = coreSubmitFixture(0.9);
  f.core.prisma = {
    assessment: { findFirst: async () => ({ lessonId: 'lesson', contentVersion: 1 }) },
    learningCompletion: { findFirst: async () => null },
  };
  const evidence = [{ scope: 'lesson', targetId: 'target', submissionId: 'submission', completionId: null,
    awardedPoints: 9, maximumPoints: 10 }];
  assert.equal(await f.core.recoverCompletion('owner', f.state, { id: 'assessment', latestSubmission: { id: 'submission' } }, evidence), true);
  assert.equal(f.completions(), 1);
  f.core.prisma.learningCompletion.findFirst = async () => ({ status: 'revoked' });
  assert.equal(await f.core.recoverCompletion('owner', f.state, { id: 'assessment', latestSubmission: { id: 'submission' } }, evidence), false);
  assert.equal(f.completions(), 1);
});
