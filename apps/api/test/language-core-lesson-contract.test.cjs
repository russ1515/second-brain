'use strict';
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { LessonService } = require('../dist/lessons/lesson.service.js');
const { LlmService } = require('../dist/llm/llm.service.js');
const { AssessmentService } = require('../dist/lessons/assessment.service.js');
const { ExperienceSessionService } = require('../dist/experience-sessions/experience-session.service.js');
const { LearningCompletionService } = require('../dist/learning-evidence/learning-completion.service.js');

function document() {
  return {
    objective: 'Recognise and use the alphabet.', intro: 'Purpose and prerequisites.',
    explanation: 'A progressive rule with a worked situation and a contrast. '.repeat(16),
    examples: ['A worked example', 'A different situation', 'A contrastive example'],
    commonMisconceptions: ['Explain a likely mistake.'],
    questions: ['Try together one', 'Try together two', 'Try together three'],
    exercises: Array.from({ length: 10 }, (_, i) => ({ type: 'qcm',
      question: `Independent situation ${i + 1}`, answer: `Correct ${i + 1}`,
      options: [`Wrong ${i + 1}`, `Correct ${i + 1}`, `Distractor ${i + 1}`],
      correction: `Rule ${i + 1}: why, correct form and another example.`,
    })),
    homework: 'Optional further practice.', summary: 'What was learned.',
    keyPoints: ['Rule one', 'Rule two', 'Rule three'], revisionSheet: 'Concise revision.',
  };
}

function service(raw, observed = []) {
  return new LessonService({}, { generate: async (messages, options) => {
    observed.push({ messages, options });
    return { text: JSON.stringify(raw) };
  } }, {}, {}, {}, {}, {}, {}, {}, {});
}

test('core reuses the lesson writer with a bounded, no-retry operation and strict schema', async () => {
  const observed = [];
  const result = await service(document(), observed).generateLesson(
    'Alphabet', '', { language: 'English', level: 'beginner' },
    'Support language: French. Target language: English.', false, undefined, undefined, true,
  );
  assert.equal(observed.length, 1);
  assert.equal(observed[0].options.operation, 'language-core-lesson');
  assert.equal(observed[0].options.jsonSchema.strict, true);
  assert.match(observed[0].messages[0].content, /replace the generic 4-6/);
  assert.match(observed[0].messages[0].content, /Support language: French/);
  assert.equal(result.exercises.length, 10);
  assert.ok(result.exercises.every(x => x.correction));
  const llm = new LlmService({}, {});
  assert.equal(llm.policy('language-core-lesson').retries, 0);
  assert.equal(llm.policy('language-core-help').retries, 0);
  assert.equal(llm.costFeatureFor('language-core-help'), 'LANGUAGE_TEXT');
});

test('core refuses a two-paragraph stub, missing worked examples or missing correction', () => {
  for (const change of [x => { x.explanation = 'Too short'; },
    x => { x.examples = ['Only one']; }, x => { delete x.exercises[2].correction; },
    x => { x.exercises[1].question = x.exercises[0].question; }]) {
    const raw = document(); change(raw);
    assert.throws(() => service(raw).parseLesson(JSON.stringify(raw), false, undefined, undefined, true), /complete, usable lesson/);
  }
});

test('core remediation refuses repeated exercise batteries and requires ten new items', () => {
  const raw = document();
  assert.throws(() => service(raw).parseLesson(JSON.stringify(raw), false, raw.exercises, undefined, true), /reused/);
  const changed = document();
  changed.exercises.forEach(x => { x.question = `New scenario: ${x.question}`; });
  assert.equal(service(changed).parseLesson(JSON.stringify(changed), false, raw.exercises, undefined, true).exercises.length, 10);
});

test('core persistence creates no pending document or background provider work, including after reboot', async () => {
  let generation = 0, documentWrites = 0;
  const tx = { $executeRaw: async () => {}, languageProfile: { findFirst: async () => ({ id: 'p' }) },
    lesson: { findFirst: async () => null, create: async ({data}) => ({ id: 'l', ...data, contentVersion: 1 }) } };
  const prisma = { lesson: tx.lesson, $transaction: async fn => fn(tx) };
  const lessons = new LessonService(prisma, {}, { search: () => { throw Error('Unrelated retrieval'); } },
    { createFromTextInTransaction: () => { documentWrites++; throw Error('Must not create recoverable paid work'); },
      queuePostCreateProcessing: () => { throw Error('Must not queue'); } }, {}, {},
    { ensureLessonSession: async (_user, request) => {
      assert.equal(request.resumeTarget.path, '/languages/p/course'); return { id: 'session' };
    } }, {}, {}, {});
  lessons.resolveTopic = async () => ({ topic: 'Alphabet' });
  lessons.loadTeacherPreferences = async () => null;
  lessons.generateLesson = async () => { generation++; return document(); };
  lessons.toView = row => row;
  const lesson = await lessons.generate('u', { topic: 'Alphabet', language: 'English', level: 'beginner' },
    { languageLearningCore: true, languageProfileId: 'p', languageGenerationKey: 'language-core:p:BEGINNER:alphabet:0' });
  assert.equal(generation, 1);
  assert.equal(documentWrites, 0);
  assert.equal(lesson.sourceDocumentId, null);
});

test('legacy mixed lesson contract and its operation remain unchanged', async () => {
  const raw = document(); raw.examples = ['One']; raw.explanation = 'Legacy content';
  raw.exercises = ['qcm', 'open', 'exercise', 'case'].map((type, index) => ({
    type, question: `Prompt ${index}`, answer: 'Correct',
    ...(type === 'qcm' ? { options: ['Correct', 'Wrong', 'Other'] } : {}),
  }));
  const observed = [];
  await service(raw, observed).generateLesson('Other subject', '', {});
  assert.equal(observed[0].options.operation, 'lesson');
  assert.equal(observed[0].options.jsonSchema, undefined);
});

test('legacy HTTP readers and manual validation cannot expose or master a core battery', async () => {
  const lessonService = service(document());
  lessonService.requireOwned = async () => ({ masteryRemediationGenerationKey: 'language-core:p:BEGINNER:alphabet:0' });
  lessonService.get = async () => ({ topic: 'Alphabet', exercises: document().exercises });
  assert.deepEqual((await lessonService.getPublic('u', 'l')).exercises, []);
  await assert.rejects(() => lessonService.validateFlowStep('u', 'l', 'revision'), /progresses automatically/);
  const examiner = new AssessmentService({}, {}, {}, {}, {});
  examiner.requireOwnedLesson = lessonService.requireOwned;
  await assert.rejects(() => examiner.submit('u', 'l', 0, 'A'), /autonomous language-course/);
  lessonService.requireOwned = async () => ({ masteryRemediationGenerationKey: null });
  assert.equal((await lessonService.getPublic('u', 'l')).exercises.length, 10);
});

test('generic JSON session writes cannot forge catalogue state or help claims', async () => {
  const sessions = new ExperienceSessionService({});
  for (const intent of ['language-learning-core', 'language-core-help']) {
    assert.throws(() => sessions.createFromClient('u', { type: 'learn', intent }), /teaching service/);
    sessions.requireOwned = async () => ({ intent, type: 'language' });
    await assert.rejects(() => sessions.updateFromClient('u', 'session', { currentStep: { id: 'forged' } }), /managed by the language service/);
  }
  assert.throws(() => sessions.createFromClient('u', { type: 'learn', idempotencyKey: 'language-core:v1:forged' }), /namespace is reserved/);
});

function completionFixture(ratio) {
  const questions = Array.from({length: 10}, (_, i) => ({ id: `q${i}`, prompt: `P${i}`, points: 100 }));
  const results = questions.map((q, i) => ({ questionId: q.id, max: 100, awarded: i ? 100 : ratio * 1000 - 900 }));
  // Construct exact 89.9/90 ratios with bounded rubric points.
  results.forEach((r, i) => { r.awarded = ratio * 100; });
  const lesson = { id: 'l', userId: 'u', contentVersion: 1, languageProfileId: 'p',
    sourceDocumentId: null, conceptId: null, topic: 'Alphabet',
    masteryRemediationGenerationKey: 'language-core:p:BEGINNER:alphabet:0' };
  const submission = { id: 's', assessmentId: 'a', answers: questions.map(() => 'Answer'), results,
    assessment: { lessonId: 'l', contentVersion: 1, questions: { version: 2,
      languageLearningCore: { version: 1, scope: 'lesson', profileId: 'p' }, questions } } };
  let written = 0, paidPublication = 0;
  const tx = { learningCompletion: { upsert: async () => { written++; return { id: 'completion' }; },
    findUniqueOrThrow: async () => ({ id: 'completion' }) },
    reviewable: { upsert: async () => ({ id: 'r' }) }, learningCompletionReviewable: { upsert: async () => ({}) } };
  const prisma = { lesson: { findFirst: async () => lesson }, assessmentSubmission: { findFirst: async () => submission },
    $transaction: async fn => fn(tx) };
  const completions = new LearningCompletionService(prisma, {});
  completions.lessonEvidence = async () => ({ source: 'assessment_submission', prismaSource: 'assessment_submission',
    refId: 's', evaluatedAt: new Date(), criteria: [{met: null}], result: { score: ratio, passed: null }, assessmentSubmissionId: 's' });
  completions.resolveGoalIds = async () => [];
  completions.dimensionScores = () => ({});
  completions.toView = row => row;
  completions.publishLessonCards = async () => { paidPublication++; };
  return { completions, written: () => written, paidPublication: () => paidPublication };
}

test('canonical completion boundary refuses 89.9 and single exercise shortcuts', async () => {
  const f = completionFixture(0.899);
  await assert.rejects(() => f.completions.finalizeLesson('u', { lessonId: 'l', evidence: {kind:'assessment_submission', id:'s'} }), /90 percent before rounding/);
  await assert.rejects(() => f.completions.finalizeLesson('u', { lessonId: 'l', evidence: {kind:'exercise_attempt', id:'x'} }), /full autonomous assessment/);
  assert.equal(f.written(), 0);
});

test('90 percent publishes canonical completion without hidden paid cards', async () => {
  const f = completionFixture(0.9);
  const result = await f.completions.finalizeLesson('u', { lessonId: 'l', evidence: {kind:'assessment_submission', id:'s'} }, {skipOptionalCards:true});
  assert.equal(result.id, 'completion');
  assert.equal(f.written(), 1);
  assert.equal(f.paidPublication(), 0);
});
