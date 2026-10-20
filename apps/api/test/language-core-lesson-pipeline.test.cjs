'use strict';
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildLanguageLearningCatalogue } = require('@second-brain/shared');
const { LessonService } = require('../dist/lessons/lesson.service');
const { ExaminerService } = require('../dist/examiner/examiner.service');
const { LearningCompletionService } = require('../dist/learning-evidence/learning-completion.service');
const { LanguageLearningCoreService } = require('../dist/languages/language-learning-core.service');
const { loadLanguageLearningCoreProjection } = require('../dist/languages/language-learning-core-projection');

// This is a database/transport fixture, not a second learning engine. All
// parsing, canonical grading, completion, projection and orchestration below
// run through the existing production services.
function lessonDocument(variant = 0) {
  return {
    objective: 'Reconnaître les lettres et les employer dans une présentation.',
    intro: `Nous allons reconnaître les lettres dans une situation ${variant}.`,
    explanation: `Situation ${variant} : pour se présenter, on emploie une lettre et on observe sa place. Une lettre écrite représente une forme stable ; compare les formes avant de choisir. ` .repeat(8),
    examples: [`A — exemple guidé ${variant}`, `B — autre situation ${variant}`, `C — contraste utile ${variant}`],
    commonMisconceptions: ['Confondre deux formes proches : comparer leur structure avant de répondre.'],
    questions: [`Repère ensemble la lettre ${variant}`, `Compare ensemble deux formes ${variant}`, `Explique ensemble un choix ${variant}`],
    exercises: Array.from({ length: 10 }, (_, i) => ({ type: 'qcm',
      question: `Situation ${variant}, item ${i + 1} : quelle lettre correspond à l’exemple ?`,
      options: [`Exact ${variant}-${i}`, `Autre ${variant}-${i}`, `Distracteur ${variant}-${i}`],
      answer: `Exact ${variant}-${i}`, correction: `La règle ${i} distingue la forme attendue ; autre exemple ${variant}.`,
    })),
    homework: 'Repérer trois formes dans une phrase.', summary: 'Les formes sont distinctes.',
    keyPoints: ['Observer la forme', 'Comparer', 'Choisir'], revisionSheet: 'Observer puis comparer les formes.',
  };
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((alternative) => matches(row, alternative));
    if (key === 'AND') return value.every((alternative) => matches(row, alternative));
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('startsWith' in value) return typeof row[key] === 'string' && row[key].startsWith(value.startsWith);
      if ('path' in value) return value.path.reduce((part, name) => part?.[name], row[key]) === value.equals;
      // Prisma compound unique filters are a tuple of actual row columns.
      return matches(row, value);
    }
    return value === null ? row[key] == null : row[key] === value;
  });
}

function fixture(options = {}) {
  const owner = 'technical-owner';
  const profile = { id: 'technical-profile', userId: owner, language: 'English', normalizedLanguage: 'en',
    nativeLanguage: 'ln', teachingLanguageSource: 'interface' };
  const placement = Object.freeze({ status: 'complete', productLevel: 'BEGINNER', globalLevel: 'A1' });
  const tables = Object.fromEntries(['lesson', 'assessment', 'assessmentSubmission', 'experienceSession',
    'learningCompletion', 'reviewable', 'learningCompletionReviewable'].map((name) => [name, []]));
  const requests = [];
  let tick = 0, providerIndex = 0, placementReads = 0;
  const now = () => new Date(Date.UTC(2026, 9, 20, 18, 0, tick++));
  const copy = (row) => row == null ? null : structuredClone(row);
  const failures = { lessonCreate: false, assessmentCreate: false, sessionBind: false, responseRead: false };
  const prisma = {
    $executeRaw: async () => 1,
    languageProfile: { findFirst: async ({ where }) => matches(profile, where) ? copy(profile) : null },
    onboardingProfile: { findUnique: async () => ({ extra: { interfaceLanguage: 'fr' }, languages: {} }) },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    card: { count: async () => 0 },
  };
  const decorate = (name, row, query = {}) => {
    const output = copy(row);
    if (!output) return null;
    if (name === 'assessment' && query.include?.submissions) {
      output.submissions = tables.assessmentSubmission.filter((item) => item.assessmentId === row.id
        && matches(item, query.include.submissions.where)).map(copy);
    }
    if (name === 'assessmentSubmission' && query.include?.assessment) {
      output.assessment = copy(tables.assessment.find((item) => item.id === row.assessmentId));
    }
    if (name === 'learningCompletion' && query.include) {
      output.goals = []; output.lesson = { topic: tables.lesson.find((item) => item.id === row.lessonId)?.topic };
      output.languageProfile = { language: profile.language }; output.languageMasteryAttempt = null;
    }
    return output;
  };
  for (const name of Object.keys(tables)) {
    const find = (query = {}) => {
      let rows = tables[name].filter((row) => matches(row, query.where));
      if (query.orderBy) {
        const orders = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
        rows = rows.slice().sort((a, b) => {
          for (const order of orders) for (const [key, direction] of Object.entries(order)) {
            if (a[key] < b[key]) return direction === 'desc' ? 1 : -1;
            if (a[key] > b[key]) return direction === 'desc' ? -1 : 1;
          }
          return 0;
        });
      }
      return rows;
    };
    const create = async ({ data }) => {
      if (name === 'lesson' && failures.lessonCreate) throw new Error('private-db-connection-details');
      if (name === 'assessment' && failures.assessmentCreate) throw new Error('private-assessment-db-details');
      const date = now();
      const row = { id: `${name}-${tables[name].length + 1}`, createdAt: date,
        contentVersion: 1, sourceDocumentId: null, status: name === 'learningCompletion' ? 'verified' : 'active',
        finalizedAt: date, startedAt: date, version: 1, ...copy(data) };
      tables[name].push(row);
      return decorate(name, row);
    };
    prisma[name] = {
      findFirst: async (query = {}) => decorate(name, find(query)[0], query),
      findUnique: async (query = {}) => {
        if (name === 'lesson' && failures.responseRead) throw Error('private-response-read-details');
        return decorate(name, find(query)[0], query);
      },
      findMany: async (query = {}) => find(query).map((row) => decorate(name, row, query)),
      findUniqueOrThrow: async (query = {}) => {
        const row = find(query)[0]; if (!row) throw Error('Fixture row not found'); return decorate(name, row, query);
      },
      create,
      upsert: async (query) => {
        const row = find(query)[0]; return row ? decorate(name, row, query) : create({ data: query.create });
      },
      updateMany: async ({ where, data }) => {
        if (name === 'experienceSession' && failures.sessionBind
          && data.currentStep?.metadata?.languageLearningCore?.generation === undefined
          && data.currentStep?.metadata?.languageLearningCore?.activeAssessmentId) {
          failures.sessionBind = false; throw new Error('private-session-db-details');
        }
        const rows = find({ where });
        for (const row of rows) for (const [key, value] of Object.entries(data)) {
          row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + value.increment : copy(value);
        }
        return { count: rows.length };
      },
    };
  }
  prisma.$transaction = async (fn) => {
    const snapshot = copy(tables);
    try { return await fn(prisma); }
    catch (error) { for (const name of Object.keys(tables)) tables[name] = snapshot[name]; throw error; }
  };
  const experiences = {
    create: async (userId, input) => {
      const old = tables.experienceSession.find((row) => row.userId === userId && row.idempotencyKey === input.idempotencyKey);
      return copy(old ?? await prisma.experienceSession.create({ data: { userId, ...input,
        languageProfileId: input.links?.languageProfileId, lessonId: input.links?.lessonId } }));
    },
    get: async (userId, id) => {
      const row = await prisma.experienceSession.findFirst({ where: { id, userId } });
      if (!row) throw Error('Session not found'); return row;
    },
    ensureLessonSession: async (userId, input) => experiences.create(userId, { ...input, type: 'learn',
      idempotencyKey: `lesson:${input.links.lessonId}` }),
    updateState: async (userId, id, update) => {
      await prisma.experienceSession.updateMany({ where: { id, userId }, data: update });
      return experiences.get(userId, id);
    },
  };
  const llm = { generate: async (messages, request) => {
    requests.push({ messages, request });
    if (request.operation === 'language-core-help') return { text: options.helpText ?? 'Compare les formes déjà étudiées, puis explique ton choix.' };
    const index = providerIndex++;
    return options.provider ? options.provider(index) : { text: JSON.stringify(lessonDocument(index)) };
  } };
  const forbidden = () => { throw Error('Unexpected unrelated/paid side effect'); };
  const completions = new LearningCompletionService(prisma, { generateFromDocument: forbidden });
  const lessons = new LessonService(prisma, llm, { search: forbidden },
    { createFromTextInTransaction: forbidden, queuePostCreateProcessing: forbidden },
    {}, {}, experiences, {}, completions, { create: forbidden });
  const examiner = new ExaminerService(prisma, { generate: forbidden });
  const languages = { requireOwned: async (userId, id) => {
    if (userId !== owner || id !== profile.id) throw Error('Profile not found'); return copy(profile);
  }, promptRoles: async () => ({ supportLanguage: 'French', targetLanguage: 'English' }) };
  const core = new LanguageLearningCoreService(prisma, experiences, languages,
    { requireCoursePlacement: async () => { placementReads++; return placement; } }, lessons, examiner, completions, llm);
  const logs = [];
  core.logger = { log: (value) => logs.push(value), error: (value) => logs.push(value) };
  lessons.logger = { log: (value) => logs.push(value), error: (value) => logs.push(value), warn: (value) => logs.push(value) };
  const catalogue = buildLanguageLearningCatalogue({ languageCode: 'en', productLevel: 'BEGINNER', cefrLevel: 'A1' });
  const definitions = catalogue.modules[0].lessons;
  const projection = () => loadLanguageLearningCoreProjection(prisma, owner, profile.id);
  const answers = (view, correct) => {
    const row = tables.assessment.find((item) => item.id === view.assessment.id);
    return row.questions.questions.map((question, index) => index < correct ? question.answerKey
      : question.options.find((option) => option !== question.answerKey));
  };
  return { owner, profile, placement, tables, prisma, experiences, llm, lessons, examiner, core,
    requests, definitions, failures, logs, projection, answers, placementReads: () => placementReads };
}

function lesson(view, id) { return view.core.modules.flatMap((module) => module.lessons).find((item) => item.id === id); }

function legacyWrongLanguage(row) {
  row.objective = 'Learn how to recognise the alphabet and use its letters in a personal introduction.';
  row.intro = 'In this lesson you will learn the English alphabet and practise recognising its letters. We will explore how letters are named, how their written forms differ, and how you can use them when introducing yourself to another person.';
  row.explanation = 'The alphabet is a set of letters used to write words. Each letter has a name and a shape. Look carefully at the written shape before choosing your answer. Compare the letters with the examples, then practise using them in a short introduction. '.repeat(5);
  return row;
}

test('real service pipeline parses, persists, fails below90, remediates, masters and restores one canonical lesson', async () => {
  const f = fixture(); const id = f.definitions[0].id; const nextId = f.definitions[1].id;
  const initial = await f.core.get(f.owner, f.profile.id);
  assert.equal(f.requests.length, 0); assert.equal(lesson(initial, id).status, 'AVAILABLE');
  const started = await f.core.startLesson(f.owner, f.profile.id, id, 'start-one');
  assert.equal(started.content.objective, lessonDocument().objective);
  assert.ok(started.content.explanation.length >= 600);
  assert.equal(started.content.examples.length, 3); assert.equal(started.content.questions.length, 3);
  assert.deepEqual(started.content.exercises, []); assert.equal(started.assessment.questions.length, 10);
  assert.ok(started.assessment.questions.every((item) => !('answerKey' in item)));
  assert.equal(f.tables.lesson.length, 1); assert.equal(f.tables.assessment.length, 1);
  await f.core.saveAnswers(f.owner, f.profile.id, id, Array(10).fill(''), 'teaching', 2);
  const restored = await f.core.get(f.owner, f.profile.id);
  assert.equal(restored.content.id, started.content.id); assert.equal(restored.teachingStep, 2);
  const resumed = await f.core.startLesson(f.owner, f.profile.id, id, 'start-again');
  assert.equal(resumed.assessment.id, started.assessment.id); assert.equal(f.requests.length, 1);
  const failed = await f.core.submit(f.owner, f.profile.id, id, f.answers(started, 8), 'fail-one');
  assert.equal(failed.latestSubmission.score, 80); assert.equal(lesson(failed, id).status, 'NEEDS_REMEDIATION');
  assert.equal(lesson(failed, nextId).status, 'LOCKED'); assert.equal(f.tables.learningCompletion.length, 0);
  assert.equal((await f.projection()).modules[0].lessons[0].status, 'NEEDS_REMEDIATION');
  const remediation = await f.core.startLesson(f.owner, f.profile.id, id, 'remediate-one', true);
  assert.notEqual(remediation.content.id, started.content.id);
  assert.notEqual(remediation.content.explanation, started.content.explanation);
  assert.notDeepEqual(remediation.content.examples, started.content.examples);
  assert.notEqual(remediation.assessment.id, started.assessment.id);
  assert.deepEqual(remediation.answers, Array(10).fill(''));
  const directive = f.requests[1].messages[0].content;
  assert.match(directive, /actual failed items/); assert.match(directive, /item 9/); assert.match(directive, /item 10/);
  const passed = await f.core.submit(f.owner, f.profile.id, id, f.answers(remediation, 9), 'pass-one');
  assert.equal(passed.latestSubmission.score, 90); assert.equal(lesson(passed, id).status, 'MASTERED');
  assert.equal(lesson(passed, nextId).status, 'AVAILABLE'); assert.equal(f.tables.learningCompletion.length, 1);
  const passport = await f.projection(); assert.deepEqual(passport, passed.core);
  const reloginService = new LanguageLearningCoreService(f.prisma, f.experiences,
    f.core.languages, f.core.placement, f.lessons, f.examiner, f.core.completions, f.llm);
  const relogin = await reloginService.get(f.owner, f.profile.id);
  assert.deepEqual(relogin.core, passed.core); assert.equal(relogin.content.id, remediation.content.id);
  assert.equal(relogin.latestSubmission.id, passed.latestSubmission.id);
  await f.core.submit(f.owner, f.profile.id, id, f.answers(remediation, 9), 'replay');
  assert.equal(f.tables.assessmentSubmission.length, 2); assert.equal(f.tables.learningCompletion.length, 1);
  assert.equal(f.requests.length, 2); assert.deepEqual(f.placement, { status: 'complete', productLevel: 'BEGINNER', globalLevel: 'A1' });
});

test('failure of the next lesson preserves previous canonical mastery', async () => {
  const f = fixture(); const [first, second] = f.definitions;
  const started = await f.core.startLesson(f.owner, f.profile.id, first.id, 'first');
  await f.core.submit(f.owner, f.profile.id, first.id, f.answers(started, 10), 'first-pass');
  const next = await f.core.startLesson(f.owner, f.profile.id, second.id, 'second');
  const failed = await f.core.submit(f.owner, f.profile.id, second.id, f.answers(next, 0), 'second-fail');
  assert.equal(lesson(failed, first.id).status, 'MASTERED'); assert.equal(lesson(failed, second.id).status, 'NEEDS_REMEDIATION');
  assert.equal(f.tables.learningCompletion.length, 1);
});

test('remediation targets its own failed submission even after reopening a different mastered lesson', async () => {
  const f = fixture(); const [first, second] = f.definitions;
  const one = await f.core.startLesson(f.owner, f.profile.id, first.id, 'one');
  await f.core.submit(f.owner, f.profile.id, first.id, f.answers(one, 10), 'one-pass');
  const two = await f.core.startLesson(f.owner, f.profile.id, second.id, 'two');
  await f.core.submit(f.owner, f.profile.id, second.id, f.answers(two, 8), 'two-fail');
  const reopened = await f.core.startLesson(f.owner, f.profile.id, first.id, 'reopen-one');
  assert.equal(reopened.latestSubmission.score, 100);
  await f.core.startLesson(f.owner, f.profile.id, second.id, 'remediate-two', true);
  const directive = f.requests.at(-1).messages[0].content;
  assert.match(directive, /Previous incorrect responses: \[\{/);
  assert.ok(directive.includes('Situation 1, item 9'));
  assert.ok(directive.includes('Situation 1, item 10'));
  assert.equal((await f.projection()).modules[0].lessons[0].status, 'MASTERED');
});

test('concurrent duplicate starts claim only one provider request and one source graph', async () => {
  const f = fixture(); const id = f.definitions[0].id;
  await f.core.get(f.owner, f.profile.id);
  const outcomes = await Promise.allSettled([
    f.core.startLesson(f.owner, f.profile.id, id, 'same-request'),
    f.core.startLesson(f.owner, f.profile.id, id, 'same-request'),
  ]);
  assert.ok(outcomes.some((item) => item.status === 'fulfilled'));
  assert.equal(f.requests.length, 1); assert.equal(f.tables.lesson.length, 1); assert.equal(f.tables.assessment.length, 1);
  const resumed = await f.core.get(f.owner, f.profile.id);
  assert.ok(resumed.content); assert.ok(resumed.assessment);
});

for (const [name, change] of [
  ['malformed JSON', () => 'not JSON'],
  ['missing objective', (raw) => { delete raw.objective; return JSON.stringify(raw); }],
  ['missing examples', (raw) => { raw.examples = []; return JSON.stringify(raw); }],
  ['missing exercises', (raw) => { raw.exercises = []; return JSON.stringify(raw); }],
]) test(`post-provider ${name} fails closed and the exact request cannot spend again`, async () => {
  const f = fixture({ provider: () => ({ text: change(lessonDocument()) }) });
  const id = f.definitions[0].id;
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'once'), (error) => {
    assert.ok([422, 503].includes(error.getStatus()));
    assert.match(error.getResponse().code, /^LESSON_/); return true;
  });
  const stored = f.tables.experienceSession.find((item) => item.intent === 'language-learning-core');
  assert.equal(stored.currentStep.metadata.languageLearningCore.generation.status, 'failed');
  assert.equal(f.tables.lesson.length, 0); assert.equal(f.tables.assessment.length, 0);
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'once'), /No automatic retry/);
  assert.equal(f.requests.length, 1);
  assert.doesNotMatch(JSON.stringify(f.logs), /not JSON|private-db|secret|Exact 0-/);
});

test('persistence failure rolls back the Lesson graph and returns only a bounded safe cause', async () => {
  const f = fixture(); f.failures.lessonCreate = true;
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, f.definitions[0].id, 'db-fail'), (error) => {
    assert.equal(error.getStatus(), 503); assert.equal(error.getResponse().code, 'LESSON_PERSISTENCE_FAILED');
    assert.doesNotMatch(JSON.stringify(error.getResponse()), /private-db/); return true;
  });
  assert.equal(f.tables.lesson.length, 0); assert.equal(f.tables.assessment.length, 0);
  assert.equal(f.tables.experienceSession.filter((row) => row.lessonId).length, 0);
});

for (const failure of ['assessmentCreate', 'sessionBind']) test(`${failure} preserves valid content and recovers without another fixture provider call`, async () => {
  const f = fixture(); const id = f.definitions[0].id; f.failures[failure] = true;
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'recover'), (error) => {
    assert.match(error.getResponse().code, /^LESSON_(ASSESSMENT|SESSION)_FAILED$/); return true;
  });
  assert.equal(f.tables.lesson.length, 1); assert.equal(f.requests.length, 1);
  const failedState = f.tables.experienceSession.find((row) => row.intent === 'language-learning-core').currentStep.metadata.languageLearningCore;
  assert.equal(failedState.generation.status, 'failed');
  f.failures[failure] = false;
  const recovered = await f.core.startLesson(f.owner, f.profile.id, id, 'recover');
  assert.ok(recovered.content); assert.ok(recovered.assessment); assert.equal(f.requests.length, 1);
  assert.equal(f.tables.lesson.length, 1); assert.equal(f.tables.assessment.length, 1);
});

test('contextual help receives selected context and cannot mutate canonical progress', async () => {
  const f = fixture(); const id = f.definitions[0].id;
  const started = await f.core.startLesson(f.owner, f.profile.id, id, 'start');
  await f.core.submit(f.owner, f.profile.id, id, f.answers(started, 8), 'fail');
  const before = await f.projection();
  const response = await f.core.help(f.owner, f.profile.id, id, 'Pourquoi ce choix ?', 'help-once');
  assert.match(response.answer, /formes/);
  const context = f.requests.at(-1).messages[0].content;
  for (const field of ['currentModule', 'currentConcepts', 'evaluatedErrors', 'remediationHistory', '"score":80']) assert.ok(context.includes(field), field);
  assert.match(context, /French/); assert.match(context, /English/);
  assert.deepEqual(await f.projection(), before);
  assert.equal(f.tables.learningCompletion.length, 0);
  assert.equal(f.tables.assessmentSubmission.length, 1);
  assert.deepEqual(await f.core.help(f.owner, f.profile.id, id, 'Pourquoi ce choix ?', 'help-once'), response);
  assert.equal(f.requests.filter((item) => item.request.operation === 'language-core-help').length, 1);
});

test('help in a fresh remediation keeps the selected lesson’s last canonical score and errors without granting mastery', async () => {
  const f = fixture(); const id = f.definitions[0].id;
  const started = await f.core.startLesson(f.owner, f.profile.id, id, 'start');
  await f.core.submit(f.owner, f.profile.id, id, f.answers(started, 8), 'fail');
  const remediated = await f.core.startLesson(f.owner, f.profile.id, id, 'remediation', true);
  assert.equal(remediated.latestSubmission, null);
  const before = await f.projection();
  await f.core.help(f.owner, f.profile.id, id, 'Quelle différence dois-je observer ?', 'remediation-help');
  const context = f.requests.at(-1).messages[0].content;
  assert.ok(context.includes('"score":80'));
  assert.ok(context.includes('"remediationActive":true'));
  assert.ok(context.includes('Situation 0, item 9'));
  assert.ok(context.includes('Situation 0, item 10'));
  assert.deepEqual(await f.projection(), before);
  assert.equal(f.tables.learningCompletion.length, 0);
  assert.equal(f.tables.assessmentSubmission.length, 1);
});

test('an incomplete post-bind response is never reported as LESSON_READY and recovers without generating again', async () => {
  const f = fixture(); const id = f.definitions[0].id; f.failures.responseRead = true;
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'response-fail'), (error) => {
    assert.equal(error.getResponse().code, 'LESSON_SESSION_FAILED');
    assert.equal(error.getResponse().stage, 'response'); return true;
  });
  assert.equal(f.tables.lesson.length, 1); assert.equal(f.tables.assessment.length, 1);
  assert.equal(f.requests.length, 1);
  assert.equal(f.logs.some((value) => JSON.parse(value).status === 'LESSON_READY'), false);
  f.failures.responseRead = false;
  const resumed = await f.core.startLesson(f.owner, f.profile.id, id, 'response-fail');
  assert.ok(resumed.content); assert.ok(resumed.assessment); assert.equal(f.requests.length, 1);
});

test('a confirmed invalid-language untouched cached source is preserved and explicitly replaced with a new non-remediation variant', async () => {
  const f = fixture(); const id = f.definitions[0].id;
  const first = await f.core.startLesson(f.owner, f.profile.id, id, 'legacy-start');
  legacyWrongLanguage(f.tables.lesson[0]);
  const originals = structuredClone({ lesson: f.tables.lesson[0], assessment: f.tables.assessment[0] });
  const oldSession = structuredClone(f.tables.experienceSession.find((row) => row.intent === 'language-learning-core'));
  const hidden = await f.core.get(f.owner, f.profile.id);
  assert.equal(hidden.content, null); assert.equal(hidden.assessment, null);
  assert.equal(hidden.activeTargetId, id); assert.deepEqual(hidden.answers, first.answers);
  assert.equal(f.requests.length, 1);
  assert.deepEqual(f.tables.experienceSession.find((row) => row.id === oldSession.id), oldSession);
  const corrected = await f.core.startLesson(f.owner, f.profile.id, id, 'correct-language');
  assert.notEqual(corrected.content.id, first.content.id); assert.notEqual(corrected.assessment.id, first.assessment.id);
  assert.equal(corrected.remediation, false);
  assert.equal(f.tables.assessment[1].questions.languageLearningCore.variant, 1);
  assert.equal(f.tables.assessment[1].questions.languageLearningCore.remediation, false);
  assert.deepEqual(f.tables.lesson[0], originals.lesson); assert.deepEqual(f.tables.assessment[0], originals.assessment);
  assert.equal(f.tables.assessmentSubmission.length, 0); assert.equal(f.tables.learningCompletion.length, 0);
  assert.equal(lesson(corrected, f.definitions[1].id).status, 'LOCKED');
  const replay = await f.core.startLesson(f.owner, f.profile.id, id, 'correct-language');
  assert.equal(replay.content.id, corrected.content.id); assert.equal(f.requests.length, 2);
  assert.equal((await f.core.get(f.owner, f.profile.id)).content.id, corrected.content.id);
  assert.deepEqual(f.placement, { status: 'complete', productLevel: 'BEGINNER', globalLevel: 'A1' });
  const failed = await f.core.submit(f.owner, f.profile.id, id, f.answers(corrected, 8), 'corrected-fail');
  assert.equal(lesson(failed, id).status, 'NEEDS_REMEDIATION');
  const remediation = await f.core.startLesson(f.owner, f.profile.id, id, 'actual-remediation', true);
  assert.equal(remediation.remediation, true);
  const mastered = await f.core.submit(f.owner, f.profile.id, id, f.answers(remediation, 9), 'corrected-pass');
  assert.equal(lesson(mastered, id).status, 'MASTERED');
  assert.equal(lesson(mastered, f.definitions[1].id).status, 'AVAILABLE');
  assert.deepEqual((await f.core.get(f.owner, f.profile.id)).core, mastered.core);
  assert.deepEqual(f.tables.lesson[0], originals.lesson); assert.deepEqual(f.tables.assessment[0], originals.assessment);
});

test('a paid language-invalid replacement fails before persistence and the same explicit request never retries', async () => {
  const f = fixture({ provider: (index) => ({ text: JSON.stringify(index === 0 ? lessonDocument() : legacyWrongLanguage(lessonDocument(index))) }) });
  const id = f.definitions[0].id;
  await f.core.startLesson(f.owner, f.profile.id, id, 'legacy-start'); legacyWrongLanguage(f.tables.lesson[0]);
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'invalid-replacement'), (error) => {
    assert.equal(error.getStatus(), 422);
    assert.equal(error.getResponse().code, 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION'); return true;
  });
  assert.equal(f.tables.lesson.length, 1); assert.equal(f.tables.assessment.length, 1);
  await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'invalid-replacement'), /No automatic retry/);
  assert.equal(f.requests.length, 2); assert.equal((await f.core.get(f.owner, f.profile.id)).content, null);
});

for (const protectedKind of ['sealed-evidence', 'draft-answer', 'autonomous-start']) {
  test(`language correction never overwrites a source protected by ${protectedKind}`, async () => {
    const f = fixture(); const id = f.definitions[0].id;
    const first = await f.core.startLesson(f.owner, f.profile.id, id, 'first');
    if (protectedKind === 'sealed-evidence') await f.core.submit(f.owner, f.profile.id, id, f.answers(first, 10), 'pass');
    else await f.core.saveAnswers(f.owner, f.profile.id, id,
      protectedKind === 'draft-answer' ? [first.assessment.questions[0].options[0], ...Array(9).fill('')] : Array(10).fill(''),
      protectedKind === 'draft-answer' ? 'teaching' : 'assessment');
    legacyWrongLanguage(f.tables.lesson[0]);
    const original = structuredClone(f.tables);
    const view = await f.core.get(f.owner, f.profile.id);
    assert.ok(view.content); assert.ok(view.assessment);
    await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'must-preserve'), (error) => {
      assert.equal(error.getResponse().code, 'LESSON_LANGUAGE_REGENERATION_BLOCKED'); return true;
    });
    assert.deepEqual(f.tables, original); assert.equal(f.requests.length, 1);
  });
}

test('Professor help reuses the language-role validator and a rejected answer never mutates mastery or retries', async () => {
  const f = fixture({ helpText: 'The alphabet is a set of letters that you can use to write words and introduce yourself. Compare each written letter with the examples from the lesson, then explain why the shapes are different before answering the practice question.' });
  const id = f.definitions[0].id;
  await f.core.startLesson(f.owner, f.profile.id, id, 'start'); const before = await f.projection();
  await assert.rejects(f.core.help(f.owner, f.profile.id, id, 'Comment les distinguer ?', 'language-help'), (error) => {
    assert.equal(error.getResponse().code, 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION'); return true;
  });
  await assert.rejects(f.core.help(f.owner, f.profile.id, id, 'Comment les distinguer ?', 'language-help'), /No automatic retry/);
  assert.deepEqual(await f.projection(), before); assert.equal(f.tables.learningCompletion.length, 0);
  assert.equal(f.requests.filter((item) => item.request.operation === 'language-core-help').length, 1);
});

for (const arrival of ['submission', 'draft']) {
  test(`a ${arrival} arriving during language repair prevents activation and preserves original work`, async () => {
    let f, first;
    f = fixture({ provider: async (index) => {
      if (index === 1) {
        if (arrival === 'submission') {
          await f.examiner.submitLanguageLearningCore(f.owner, first.assessment.id, {
            profileId: f.profile.id, sessionId: first.sessionId,
            answers: f.answers(first, 8), idempotencyKey: 'late-original-submission',
          });
        } else {
          await f.core.saveAnswers(f.owner, f.profile.id, f.definitions[0].id,
            [first.assessment.questions[0].options[0], ...Array(9).fill('')], 'teaching', 2);
        }
      }
      return { text: JSON.stringify(lessonDocument(index)) };
    } });
    const id = f.definitions[0].id;
    first = await f.core.startLesson(f.owner, f.profile.id, id, 'legacy-start'); legacyWrongLanguage(f.tables.lesson[0]);
    const originalSource = structuredClone(f.tables.lesson[0]); const originalAssessment = structuredClone(f.tables.assessment[0]);
    await assert.rejects(f.core.startLesson(f.owner, f.profile.id, id, 'race-correction'), (error) => {
      assert.equal(error.getResponse().code, 'LESSON_LANGUAGE_REGENERATION_BLOCKED'); return true;
    });
    const state = f.tables.experienceSession.find((row) => row.intent === 'language-learning-core').currentStep.metadata.languageLearningCore;
    assert.equal(state.lessonLinks[id].id, first.content.id); assert.equal(state.activeAssessmentId, first.assessment.id);
    assert.deepEqual(f.tables.lesson[0], originalSource); assert.deepEqual(f.tables.assessment[0], originalAssessment);
    assert.equal(f.tables.assessment.length, 1); assert.equal(f.requests.length, 2);
    if (arrival === 'submission') assert.equal(f.tables.assessmentSubmission.length, 1);
    else assert.ok(state.answers[0]);
  });
}
