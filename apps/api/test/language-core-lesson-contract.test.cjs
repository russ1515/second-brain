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
      instruction: { key: 'choose', params: {} }, targetText: `Target situation ${i + 1}`,
      options: [`Wrong ${i + 1}`, `Correct ${i + 1}`, `Distractor ${i + 1}`],
      correction: `Rule ${i + 1}: why, correct form and another example.`,
    })),
    homework: 'Optional further practice.', summary: 'What was learned.',
    keyPoints: ['Rule one', 'Rule two', 'Rule three'], revisionSheet: 'Concise revision.',
  };
}

function service(raw, observed = [], traces = []) {
  const lessons = new LessonService({}, { generate: async (messages, options) => {
    observed.push({ messages, options });
    return { text: JSON.stringify(raw) };
  } }, {}, {}, {}, {}, {}, {}, {}, {});
  lessons.logger = { log: value => traces.push(value), error: value => traces.push(value), warn: () => {} };
  return lessons;
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

function expectedFailure(status, stage, reason) {
  return error => {
    assert.equal(error.getStatus(), status);
    const response = error.getResponse();
    assert.equal(response.stage, stage);
    assert.ok(response.reasons.includes(reason), JSON.stringify(response));
    assert.match(response.code, /^LESSON_[A-Z_]+$/);
    return true;
  };
}

test('core parser rejects malformed JSON and non-object roots without salvaging an array lesson', () => {
  const lessons = service(document());
  for (const raw of ['[', 'not-json', `untrusted prose ${JSON.stringify(document())}`]) {
    assert.throws(() => lessons.parseLesson(raw, false, undefined, undefined, true),
      expectedFailure(422, 'parser', 'INVALID_JSON'));
  }
  for (const raw of ['null', '[]', JSON.stringify([document()]), '42', '"text"']) {
    assert.throws(() => lessons.parseLesson(raw, false, undefined, undefined, true),
      expectedFailure(422, 'parser', 'JSON_OBJECT_REQUIRED'));
  }
  assert.equal(lessons.parseLesson(`\`\`\`json\n${JSON.stringify(document())}\n\`\`\``,
    false, undefined, undefined, true).exercises.length, 10);
});

test('provider output adapter rejects missing text and redacts upstream errors without retry', async () => {
  const observed = [], traces = [];
  const lessons = service(undefined, observed, traces);
  await assert.rejects(() => lessons.generateLesson('Private learner subject', '', {},
    undefined, false, undefined, undefined, true), expectedFailure(503, 'adapter', 'PROVIDER_TEXT_MISSING'));
  assert.equal(observed.length, 1);
  assert.throws(() => lessons.parseLesson(undefined, false, undefined, undefined, true),
    expectedFailure(503, 'adapter', 'PROVIDER_TEXT_MISSING'));
  const marker = 'PRIVATE_UPSTREAM_ERROR_MUST_NOT_BE_LOGGED';
  lessons.llm = { generate: async () => { throw new Error(marker); } };
  await assert.rejects(() => lessons.generateLesson(marker, '', {},
    undefined, false, undefined, undefined, true), error => {
    expectedFailure(503, 'provider', 'PROVIDER_REQUEST_FAILED')(error);
    assert(!JSON.stringify(error.getResponse()).includes(marker));
    return true;
  });
  assert(!traces.join('\n').includes(marker));
  assert(!traces.join('\n').includes('Private learner subject'));
});

test('core never silently discards malformed exercise items or QCM options', () => {
  const lessons = service(document());
  const raw = document();
  raw.exercises.push({ type: 'qcm', question: 'Invalid extra', answer: 'Absent',
    options: ['A', 'B', 'C'], correction: 'Explain' });
  assert.throws(() => lessons.parseLesson(JSON.stringify(raw), false, undefined, undefined, true),
    expectedFailure(422, 'content', 'INVALID_EXERCISE_ITEM'));
  for (const options of [
    ['Wrong 1', 'Correct 1', 'Distractor 1', 'Correct 1'],
    ['Wrong 1', 'Correct 1', 'Distractor 1', ''],
    ['Wrong 1', 'Correct 1', 'Distractor 1', 42],
  ]) {
    const duplicate = document(); duplicate.exercises[0].options = options;
    assert.throws(() => lessons.parseLesson(JSON.stringify(duplicate), false, undefined, undefined, true),
      expectedFailure(422, 'content', 'INVALID_QCM_OPTIONS'));
  }
});

test('core reports precise content defects and keeps teaching separate from independent scoring', () => {
  const cases = [
    ['OBJECTIVE_REQUIRED', raw => { delete raw.objective; }],
    ['WORKED_EXAMPLES_REQUIRED', raw => { raw.examples = []; }],
    ['GUIDED_PRACTICE_REQUIRED', raw => { raw.questions = []; }],
    ['EXERCISES_REQUIRED', raw => { raw.exercises = []; }],
    ['EXERCISE_CORRECTION_REQUIRED', raw => { delete raw.exercises[2].correction; }],
    ['INVALID_CONTENT_ARRAY_ITEM', raw => { raw.examples.push(null); }],
    ['DUPLICATE_WORKED_EXAMPLE', raw => { raw.examples[1] = raw.examples[0]; }],
    ['DUPLICATE_GUIDED_PROMPT', raw => { raw.questions[1] = raw.questions[0]; }],
  ];
  for (const [reason, mutate] of cases) {
    const raw = document(); mutate(raw);
    assert.throws(() => service(raw).parseLesson(JSON.stringify(raw), false, undefined, undefined, true),
      expectedFailure(422, 'content', reason));
  }
  const traces = [];
  const parsed = service(document(), [], traces).parseLesson(JSON.stringify(document()), false, undefined, undefined, true);
  assert.equal(parsed.questions.length, 3);
  assert.equal(parsed.exercises.length, 10);
  assert.equal(Object.hasOwn(parsed, 'score'), false);
  assert(!traces.join('\n').includes(document().objective));
  assert(!traces.join('\n').includes(document().exercises[0].answer));
});

test('core remediation rejects reused teaching content as well as exercises', () => {
  const original = document();
  const lessons = service(original);
  const baseline = lessons.parseLesson(JSON.stringify(original), false, undefined, undefined, true);
  const retry = document(); retry.exercises.forEach(item => { item.question = `New situation: ${item.question}`; });
  assert.throws(() => lessons.parseLesson(JSON.stringify(retry), false, original.exercises, undefined, true, baseline),
    expectedFailure(422, 'content', 'REMEDIATION_EXPLANATION_REUSED'));
  retry.explanation = 'A different explanation with another accessible situation and another rule contrast. '.repeat(12);
  assert.throws(() => lessons.parseLesson(JSON.stringify(retry), false, original.exercises, undefined, true, baseline),
    expectedFailure(422, 'content', 'REMEDIATION_EXAMPLES_REUSED'));
  retry.examples = ['New worked example', 'Another fresh situation', 'Fresh contrasting case'];
  assert.equal(lessons.parseLesson(JSON.stringify(retry), false, original.exercises, undefined, true, baseline).exercises.length, 10);
});

function generationFixture(failure) {
  const state = { lessons: [], sessions: [], providerCalls: 0 };
  const traces = [];
  const tx = { $executeRaw: async () => {}, languageProfile: { findFirst: async () => ({ id: 'p' }) },
    lesson: {
      findFirst: async ({ where }) => state.lessons.find(row => row.userId === where.userId
        && row.masteryRemediationGenerationKey === where.masteryRemediationGenerationKey) ?? null,
      create: async ({ data }) => {
        if (failure === 'write') throw new Error('PRIVATE_DATABASE_ERROR');
        const row = { ...data, id: 'lesson', contentVersion: 1, sourceDocumentId: null,
          createdAt: new Date(), updatedAt: new Date() };
        state.lessons.push(row); return row;
      },
    } };
  const prisma = { lesson: tx.lesson, $transaction: async operation => {
    const before = structuredClone(state);
    try {
      const result = await operation(tx);
      if (failure === 'commit') throw new Error('PRIVATE_TRANSACTION_ERROR');
      return result;
    } catch (error) {
      state.lessons = before.lessons; state.sessions = before.sessions;
      throw error;
    }
  } };
  const lessons = new LessonService(prisma, { generate: async () => {
    state.providerCalls++; return { text: JSON.stringify(document()) };
  } }, { search: () => { throw new Error('Must not retrieve'); } }, {}, {}, {}, {
    ensureLessonSession: async (_user, request) => {
      if (failure === 'session') throw new Error('PRIVATE_SESSION_ERROR');
      state.sessions.push(request); return { id: 'lesson-session' };
    },
  }, {}, {}, {});
  lessons.logger = { log: value => traces.push(value), error: value => traces.push(value), warn: () => {} };
  lessons.resolveTopic = async () => ({ topic: 'Alphabet' });
  lessons.loadTeacherPreferences = async () => null;
  lessons.toView = row => row;
  lessons.get = async (_owner, id) => state.lessons.find(row => row.id === id);
  const start = () => lessons.generate('u', { topic: 'Alphabet', language: 'English', level: 'beginner' },
    { languageLearningCore: true, languageProfileId: 'p', languageGenerationKey: 'language-core:p:BEGINNER:alphabet:0' });
  return { start, state, traces };
}

test('provider fixture → parser → persisted lesson and session is idempotent, without paid enrichment', async () => {
  const fixture = generationFixture();
  const lesson = await fixture.start();
  assert.equal(lesson.exercises.length, 10);
  assert.ok(lesson.exercises.every(item => item.correction));
  assert.equal(fixture.state.lessons.length, 1);
  assert.equal(fixture.state.sessions.length, 1);
  assert.equal(fixture.state.sessions[0].links.lessonId, lesson.id);
  assert.equal((await fixture.start()).id, lesson.id);
  assert.equal(fixture.state.providerCalls, 1);
  assert.equal(fixture.state.lessons.length, 1);
  assert.equal(fixture.state.sessions.length, 1);
  assert.ok(fixture.traces.some(value => JSON.parse(value).stage === 'lesson-session'));
});

test('write, session and commit failures roll back the graph and report only safe precise stages', async () => {
  for (const failure of ['write', 'session', 'commit']) {
    const fixture = generationFixture(failure);
    await assert.rejects(fixture.start, expectedFailure(503,
      failure === 'session' ? 'lesson-session' : 'persistence',
      failure === 'session' ? 'LESSON_SESSION_CREATE_FAILED' : 'LESSON_TRANSACTION_FAILED'));
    assert.equal(fixture.state.lessons.length, 0);
    assert.equal(fixture.state.sessions.length, 0);
    assert.equal(fixture.state.providerCalls, 1);
    assert(!fixture.traces.join('\n').includes('PRIVATE_'));
  }
});

// Pure fixture validator for the exact JSON Schema subset emitted here, not a
// second application contract/validator. No provider or dependency is needed.
function schemaAcceptsFixture(schema, value) {
  if (schema.anyOf) return schema.anyOf.some(child => schemaAcceptsFixture(child, value));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'string') return typeof value === 'string'
    && (!schema.pattern || new RegExp(schema.pattern, 'u').test(value));
  if (schema.type === 'array') return Array.isArray(value)
    && (schema.minItems === undefined || value.length >= schema.minItems)
    && (schema.maxItems === undefined || value.length <= schema.maxItems)
    && value.every(item => schemaAcceptsFixture(schema.items, item));
  if (schema.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (schema.required || []).every(key => Object.hasOwn(value, key))
    && (schema.additionalProperties !== false || Object.keys(value).every(key => Object.hasOwn(schema.properties, key)))
    && Object.entries(schema.properties).every(([key, child]) => !Object.hasOwn(value, key) || schemaAcceptsFixture(child, value[key]));
  throw new Error('Unsupported test schema keyword/type');
}

test('core schema closes the proven provider-envelope/parser cardinality gap', () => {
  const lessons = service(document());
  const schema = lessons.languageCoreLessonJsonSchema().schema;
  // Before this alignment every string/array below had only type/items; retain
  // the unchanged required fields, enums and additionalProperties semantics.
  const before = JSON.parse(JSON.stringify(schema), (key, value) =>
    ['pattern', 'minItems', 'maxItems'].includes(key) ? undefined : value);
  const changes = [
    raw => { raw.explanation = 'A two-line shell.'; },
    raw => { raw.examples = ['Only one worked example']; },
    raw => { raw.questions = ['Only one guided prompt']; },
    raw => { raw.exercises = raw.exercises.slice(0, 3); },
    raw => { raw.keyPoints = ['Only one takeaway']; },
    raw => { raw.exercises[0].options = raw.exercises[0].options.slice(0, 2); },
  ];
  for (const change of changes) {
    const raw = document(); change(raw);
    assert.equal(schemaAcceptsFixture(before, raw), true, 'old schema accepted the incomplete envelope');
    assert.throws(() => lessons.parseLesson(JSON.stringify(raw), false, undefined, undefined, true));
    assert.equal(schemaAcceptsFixture(schema, raw), false, 'same fixture must now be rejected at provider schema');
  }
  assert.equal(schemaAcceptsFixture(schema, document()), true);
  assert.equal(lessons.parseLesson(JSON.stringify(document()), false, undefined, undefined, true).exercises.length, 10);
});

test('core schema uses supported patterns and preserves existing exact parser bounds', () => {
  const lessons = service(document());
  const schema = lessons.languageCoreLessonJsonSchema().schema;
  assert.equal(schema.properties.objective.pattern, '\\S');
  assert.equal(schema.properties.explanation.pattern, '^[\\s\\S]{600,}$');
  assert.deepEqual([schema.properties.questions.minItems, schema.properties.questions.maxItems], [3, 5]);
  assert.deepEqual([schema.properties.exercises.minItems, schema.properties.exercises.maxItems], [10, 12]);
  assert.deepEqual([schema.properties.keyPoints.minItems, schema.properties.keyPoints.maxItems], [3, 5]);
  const optionSchema = schema.properties.exercises.items.properties.options;
  assert.deepEqual([optionSchema.minItems, optionSchema.maxItems], [3, 4]);
  assert.equal(schema.properties.examples.minItems, 3);
  assert.equal(schema.properties.commonMisconceptions.minItems, 1);
  assert.equal(Object.hasOwn(schema.properties.homework, 'pattern'), false, 'optional homework may remain blank');
  for (const count of [599, 600, 601]) {
    const raw = document(); raw.explanation = '語'.repeat(count);
    assert.equal(schemaAcceptsFixture(schema, raw), count >= 600);
    if (count >= 600) assert.ok(lessons.parseLesson(JSON.stringify(raw), false, undefined, undefined, true));
    else assert.throws(() => lessons.parseLesson(JSON.stringify(raw), false, undefined, undefined, true));
  }
  const blank = document(); blank.objective = ' \n\t';
  assert.equal(schemaAcceptsFixture(schema, blank), false);
  const emptyHomework = document(); emptyHomework.homework = '';
  assert.equal(schemaAcceptsFixture(schema, emptyHomework), true);
});

test('new core instructions are structural keys and operands, never provider-authored instruction prose', async () => {
  const raw = document(); const lessons = service(raw);
  const schema = lessons.languageCoreLessonJsonSchema().schema;
  const exerciseSchema = schema.properties.exercises.items;
  assert.ok(exerciseSchema.required.includes('instruction'));
  assert.ok(exerciseSchema.required.includes('targetText'));
  assert.ok(exerciseSchema.properties.instruction.anyOf.length > 0);
  for (const change of [
    x => { delete x.exercises[0].instruction; },
    x => { x.exercises[0].instruction = { key: 'unknown', params: {} }; },
    x => { x.exercises[0].instruction = { key: 'choose', params: { prose: 'Please answer in English.' } }; },
    x => { x.exercises[0].instruction = { key: 'letterName', params: {} }; },
    x => { x.exercises[0].instruction = { key: 'listen', params: {} }; },
  ]) {
    const wrong = document(); change(wrong);
    assert.equal(schemaAcceptsFixture(schema, wrong), false);
    assert.throws(() => lessons.parseLesson(JSON.stringify(wrong), false, undefined, undefined, true));
  }
  for (const count of [5, 20, 40, 60]) {
    const short = document(); short.exercises[0].targetText = 'X'.repeat(count);
    const parsed = lessons.parseLesson(JSON.stringify(short), false, undefined, undefined, true);
    assert.deepEqual(parsed.exercises[0].instruction, { key: 'choose', params: {} });
    assert.equal(parsed.exercises[0].targetText, short.exercises[0].targetText);
  }
  const hiddenInstruction = document();
  hiddenInstruction.exercises[0].targetText = "Which letter comes after 'M' in the English alphabet?";
  const observed = [];
  await assert.rejects(() => service(hiddenInstruction, observed).generateLesson('Alphabet', '', {},
    undefined, false, undefined, undefined, true, undefined,
    { supportLanguageCode: 'fr', targetLanguageCode: 'en', targetLanguage: 'English' }),
    expectedFailure(422, 'content', 'EXERCISE_INSTRUCTION_INVALID'));
  assert.equal(observed.length, 1, 'invalid provider output is rejected, never retried');
});
