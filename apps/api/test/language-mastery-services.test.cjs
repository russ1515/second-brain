'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { LessonService } = require('../dist/lessons/lesson.service.js');
const { ExaminerService } = require('../dist/examiner/examiner.service.js');
const {
  LANGUAGE_TRAINING_FORMATS,
  LANGUAGE_MASTERY_POLICY_VERSION,
} = require('../../../packages/shared/dist/index.js');

function lessonDocument(exercises) {
  return {
    objective: 'Communicate independently in this situation.',
    intro: 'Introduction',
    explanation: 'Progressive explanation',
    examples: ['Worked example'],
    commonMisconceptions: ['A concrete error and its correction'],
    questions: ['Q1', 'Q2', 'Q3'],
    exercises,
    homework: 'Optional practice',
    summary: 'Summary',
    keyPoints: ['K1', 'K2', 'K3'],
    revisionSheet: 'Revision',
  };
}

function languageExercises() {
  const qcm = (languageFormat) => ({
    type: 'qcm',
    languageFormat,
    question: `${languageFormat} question`,
    answer: 'Correct',
    options: ['Correct', 'Plausible A', 'Plausible B'],
  });
  return [
    qcm('recognition-mcq'),
    qcm('contextual-discrimination'),
    {
      type: 'open', languageFormat: 'fill-blank-no-hint',
      question: 'Complete the sentence.', answer: 'complete answer',
    },
    {
      type: 'exercise', languageFormat: 'sentence-reconstruction',
      question: 'Reconstruct or type the sentence.', answer: 'complete sentence',
      tokens: ['sentence', 'complete'],
    },
    qcm('register-matching'),
    {
      type: 'exercise', languageFormat: 'error-correction',
      question: 'Correct the error.', answer: 'corrected sentence',
    },
    {
      ...qcm('listening-discrimination'),
      audioText: 'Target-language audio text',
    },
    {
      type: 'open', languageFormat: 'guided-writing',
      question: 'Write a short response.', answer: 'rubric example',
    },
    {
      type: 'open', languageFormat: 'voice-pronunciation',
      question: 'Hear and repeat.', answer: 'target phrase',
      audioText: 'target phrase',
    },
    {
      type: 'case', languageFormat: 'mini-dialogue',
      question: 'Give the next reply.', answer: 'contextual reply',
      dialogueTurns: ['First turn', 'Second turn'],
    },
  ];
}

function lessonServiceWithLlm(text, observed) {
  return new LessonService(
    {},
    {
      generate: async (messages, options) => {
        observed.push({ messages, options });
        return { text };
      },
    },
    {}, {}, {}, {}, {}, {}, {}, {},
  );
}

test('language lesson generation enforces the exact ten official format identifiers', async () => {
  const observed = [];
  const exercises = languageExercises();
  const service = lessonServiceWithLlm(JSON.stringify(lessonDocument(exercises)), observed);

  const generated = await service.generateLesson(
    'Daily communication',
    '',
    { language: 'Japanese', level: 'beginner' },
    'Trusted language directive.',
    true,
  );

  assert.deepEqual(
    generated.exercises.map((exercise) => exercise.languageFormat).sort(),
    [...LANGUAGE_TRAINING_FORMATS].sort(),
  );
  assert.equal(new Set(generated.exercises.map((exercise) => exercise.languageFormat)).size, 10);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].options.operation, 'lesson');
  for (const format of LANGUAGE_TRAINING_FORMATS) {
    assert.match(observed[0].messages[0].content, new RegExp(format));
  }
  assert.match(observed[0].messages[0].content, /replace the generic exercise mix/i);
});

test('language parser fails closed when one official format is absent or unknown', () => {
  const service = lessonServiceWithLlm('', []);
  const missing = languageExercises().filter(
    (exercise) => exercise.languageFormat !== 'voice-pronunciation',
  );
  assert.throws(
    () => service.parseLesson(JSON.stringify(lessonDocument(missing)), true),
    /complete, usable lesson/i,
  );
  const unknown = languageExercises();
  unknown[0] = { ...unknown[0], languageFormat: 'invented-format' };
  assert.throws(
    () => service.parseLesson(JSON.stringify(lessonDocument(unknown)), true),
    /complete, usable lesson/i,
  );
});

test('remediation requires ten fingerprint-new exercises and rejects normalised duplicates', () => {
  const service = lessonServiceWithLlm('', []);
  const baseline = languageExercises();
  const fresh = baseline.map((exercise, index) => ({
    ...exercise,
    question: `New remediation situation ${index + 1}`,
    answer: `New remediation response ${index + 1}`,
    ...(exercise.options ? {
      options: [`New remediation response ${index + 1}`, `New distractor A ${index + 1}`, `New distractor B ${index + 1}`],
    } : {}),
    ...(exercise.tokens ? { tokens: [`New token ${index + 1}`, `New token ${index + 11}`] } : {}),
    ...(exercise.audioText ? { audioText: `New audio phrase ${index + 1}` } : {}),
    ...(exercise.dialogueTurns ? {
      dialogueTurns: [`New first turn ${index + 1}`, `New second turn ${index + 1}`],
    } : {}),
  }));
  const accepted = service.parseLesson(JSON.stringify(lessonDocument(fresh)), true, baseline);
  assert.equal(accepted.exercises.length, 10);

  const reused = fresh.map((exercise) => ({ ...exercise }));
  reused[0] = { ...baseline[0], question: `  ${baseline[0].question.toUpperCase()} !!! ` };
  assert.throws(
    () => service.parseLesson(JSON.stringify(lessonDocument(reused)), true, baseline),
    /reused an existing or duplicate exercise/i,
  );

  const duplicated = fresh.map((exercise) => ({ ...exercise }));
  duplicated[1] = { ...duplicated[0], languageFormat: baseline[1].languageFormat };
  assert.throws(
    () => service.parseLesson(JSON.stringify(lessonDocument(duplicated)), true, baseline),
    /reused an existing or duplicate exercise/i,
  );
});

test('generic lesson contract stays unchanged and does not require language metadata', () => {
  const service = lessonServiceWithLlm('', []);
  const generic = [
    { type: 'qcm', question: 'QCM', answer: 'A', options: ['A', 'B', 'C'] },
    { type: 'open', question: 'Open', answer: 'Answer' },
    { type: 'exercise', question: 'Apply', answer: 'Application' },
    { type: 'case', question: 'Case', answer: 'Reasoning' },
  ];
  const parsed = service.parseLesson(JSON.stringify(lessonDocument(generic)));
  assert.equal(parsed.exercises.length, 4);
  assert.equal(parsed.exercises.every((exercise) => exercise.languageFormat === undefined), true);
});

function assessmentFixture() {
  let assessment = null;
  const observed = [];
  let transactionTail = Promise.resolve();
  const prisma = {
    $executeRaw: async () => 0,
    lesson: {
      findFirst: async ({ where }) =>
        where.id === 'lesson-1' && where.userId === 'user-1'
          ? { id: 'lesson-1', contentVersion: 4 }
          : null,
    },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    onboardingProfile: { findUnique: async () => null },
    assessment: {
      create: async ({ data }) => {
        assessment = {
          id: 'assessment-1',
          userId: data.userId,
          type: data.type,
          topic: data.topic,
          title: data.title,
          level: data.level,
          conceptId: data.conceptId,
          lessonId: data.lessonId,
          contentVersion: data.contentVersion,
          questions: data.questions,
          createdAt: new Date('2026-10-09T10:00:00.000Z'),
        };
        return assessment;
      },
      findUnique: async ({ where }) => where.id === assessment?.id ? assessment : null,
      update: async ({ where, data }) => {
        if (where.id !== assessment?.id) throw new Error('assessment not found');
        assessment = { ...assessment, questions: data.questions };
        return assessment;
      },
    },
    assessmentSubmission: {
      findFirst: async () => ({ id: 'submission-1' }),
    },
  };
  prisma.$transaction = (callback) => {
    const run = transactionTail.then(() => callback(prisma));
    transactionTail = run.catch(() => undefined);
    return run;
  };
  const llm = {
    generate: async (messages, options) => {
      observed.push({ messages, options });
      return {
        text: JSON.stringify({
          questions: [
            {
              prompt: 'Forbidden choice', format: 'mcq',
              options: ['A', 'B', 'C'], points: 1,
              answerKey: 'A', rubric: 'Choose A',
            },
            {
              prompt: 'Produce answer one', format: 'open', points: 4,
              answerKey: 'Model one', rubric: 'Independent production one',
            },
            {
              prompt: 'Produce answer two', format: 'open', points: 6,
              answerKey: 'Model two', rubric: 'Independent production two',
            },
          ],
        }),
      };
    },
  };
  return {
    service: new ExaminerService(prisma, llm),
    observed,
    assessment: () => assessment,
  };
}

const masteryMetadata = {
  policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
  profileId: 'profile-1',
  courseSessionId: 'course-session-1',
  unitId: 'unit-1',
  lessonId: 'lesson-1',
  attemptId: 'attempt-1',
};

test('language mastery assessment rejects non-open type and keeps only open production questions', async () => {
  const { service, observed, assessment } = assessmentFixture();
  await assert.rejects(
    () => service.create('user-1', { type: 'mcq', topic: 'German cases' }, {
      languageMastery: masteryMetadata,
      lessonId: 'lesson-1',
      contentVersion: 4,
    }),
    /must use open production questions/i,
  );
  assert.equal(observed.length, 0);

  const view = await service.create('user-1', {
    type: 'open', topic: 'German cases', questionCount: 3,
  }, {
    directive: 'Assess independent school-exam production.',
    languageMastery: masteryMetadata,
    lessonId: 'lesson-1',
    contentVersion: 4,
  });
  assert.equal(view.questions.length, 2);
  assert.equal(view.questions.every((question) => question.format === 'open'), true);
  assert.equal(assessment().questions.questions.every((question) => question.format === 'open'), true);
  assert.equal(assessment().questions.languageMastery.helpUsed, false);
  assert.equal(assessment().questions.languageMastery.answerLeak, false);
  assert.equal(assessment().questions.languageMastery.sealedAt, null);
  assert.match(observed[0].messages[1].content, /No MCQ, options, hint/i);
});

test('language mastery help and answer-leak flags stay monotone under concurrent signals', async () => {
  const { service } = assessmentFixture();
  await service.create('user-1', { type: 'open', topic: 'Independent production' }, {
    languageMastery: masteryMetadata,
    lessonId: 'lesson-1',
    contentVersion: 4,
  });

  await Promise.all([
    service.markLanguageMasteryHelpUsed('user-1', 'assessment-1'),
    service.markLanguageMasteryAnswerLeak('user-1', 'assessment-1'),
  ]);
  const repeatedHelp = await service.markLanguageMasteryHelpUsed('user-1', 'assessment-1');
  assert.equal(repeatedHelp.helpUsed, true);
  const restored = await service.languageMasteryMetadata('user-1', 'assessment-1');
  assert.equal(restored.helpUsed, true);
  assert.equal(restored.answerLeak, true);
});

test('sealing serializes late help and keeps the accepted metadata immutable', async () => {
  const first = assessmentFixture();
  await first.service.create('user-1', { type: 'open', topic: 'Independent production' }, {
    languageMastery: masteryMetadata,
    lessonId: 'lesson-1',
    contentVersion: 4,
  });
  const sealed = await first.service.sealLanguageMasterySubmission('user-1', 'assessment-1');
  assert.equal(typeof sealed.sealedAt, 'string');
  await assert.rejects(
    () => first.service.markLanguageMasteryHelpUsed('user-1', 'assessment-1'),
    /already sealed/i,
  );
  const restored = await first.service.languageMasteryMetadata('user-1', 'assessment-1');
  assert.equal(restored.helpUsed, false);
  assert.equal(restored.sealedAt, sealed.sealedAt);

  const second = assessmentFixture();
  await second.service.create('user-1', { type: 'open', topic: 'Independent production' }, {
    languageMastery: masteryMetadata,
    lessonId: 'lesson-1',
    contentVersion: 4,
  });
  await second.service.markLanguageMasteryHelpUsed('user-1', 'assessment-1');
  const assisted = await second.service.sealLanguageMasterySubmission('user-1', 'assessment-1');
  assert.equal(assisted.helpUsed, true);
  assert.equal(typeof assisted.sealedAt, 'string');
});

test('raw mastery totals use awarded/max without display rounding and fail closed', () => {
  const { service } = assessmentFixture();
  const result = (awarded, max) => ({
    questionId: 'q', prompt: 'p', learnerAnswer: 'a', awarded, max,
    verdict: awarded === max ? 'correct' : 'partial', why: '', how: '',
    errorMade: null, howToAvoid: null,
  });

  assert.deepEqual(service.assessmentResultTotals([result(8.99, 10)]), {
    awarded: 8.99, maximum: 10, ratio: 0.899,
  });
  assert.deepEqual(service.assessmentResultTotals([result(4, 4), result(5, 6)]), {
    awarded: 9, maximum: 10, ratio: 0.9,
  });
  assert.equal(service.assessmentResultTotals([]), null);
  assert.equal(service.assessmentResultTotals([result(11, 10)]), null);
  assert.equal(service.assessmentResultTotals([result(Number.NaN, 10)]), null);
  assert.equal(service.assessmentResultTotals([result(1, 0)]), null);
});
