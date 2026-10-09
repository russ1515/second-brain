'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { LessonService } = require('../dist/lessons/lesson.service.js');

function fixture(options = {}) {
  const lesson = {
    id: 'lesson-1', userId: 'user-1', tutorSessionId: null, conceptId: null,
    languageProfileId: options.languageMastery ? 'profile-1' : null,
    language: options.languageMastery ? 'German' : null,
    level: 'beginner', topic: 'Philosophy',
    objective: 'Explain the argument.', intro: 'Introduction', explanation: 'Explanation',
    examples: ['Example'], questions: ['Q1', 'Q2', 'Q3'],
    exercises: options.languageMastery ? [
      'recognition-mcq',
      'contextual-discrimination',
      'fill-blank-no-hint',
      'sentence-reconstruction',
      'register-matching',
      'error-correction',
      'listening-discrimination',
      'guided-writing',
      'voice-pronunciation',
      'mini-dialogue',
    ].map((languageFormat, index) => ({
      type: languageFormat === 'recognition-mcq' ? 'qcm' : 'open',
      question: `Language activity ${index + 1}`,
      answer: `Answer ${index + 1}`,
      languageFormat,
      ...(languageFormat === 'recognition-mcq' ? { options: [`Answer ${index + 1}`, 'B', 'C'] } : {}),
    })) : [
      { type: 'qcm', question: 'QCM', answer: 'A', options: ['A', 'B', 'C'] },
      { type: 'open', question: 'Open', answer: 'Answer' },
      { type: 'exercise', question: 'Apply', answer: 'Application' },
      { type: 'case', question: 'Case', answer: 'Reasoning' },
    ],
    homework: '', summary: 'Summary', keyPoints: ['One', 'Two', 'Three'],
    revisionSheet: 'Revision', sourceDocumentId: 'document-1', contentVersion: 1,
    createdAt: new Date('2026-10-08T08:00:00.000Z'),
    updatedAt: new Date('2026-10-08T08:00:00.000Z'),
  };
  const attempts = [];
  const completions = [];
  let session = null;
  const experiences = {
    ensureLessonSession: async (_userId, request) => {
      if (!session) {
        session = {
          id: 'experience-1', userId: 'user-1', status: 'active', version: 1,
          startedAt: '2026-10-08T08:00:00.000Z', currentStep: request.currentStep,
        };
      }
      return session;
    },
    updateState: async (_userId, _id, update) => {
      session = { ...session, ...update, version: session.version + 1 };
      return session;
    },
    complete: async () => {
      session = { ...session, status: 'completed', completedAt: '2026-10-08T09:00:00.000Z' };
      return session;
    },
  };
  const prisma = {
    lesson: { findUnique: async ({ where }) => where.id === lesson.id ? lesson : null },
    exerciseAttempt: {
      findMany: async () => {
        const seen = new Set();
        return attempts.filter((attempt) => {
          if (seen.has(attempt.exerciseIndex)) return false;
          seen.add(attempt.exerciseIndex);
          return true;
        }).map(({ exerciseIndex }) => ({ exerciseIndex }));
      },
      findFirst: async () => attempts.at(-1) ?? null,
    },
  };
  const service = new LessonService(
    prisma,
    { generate: async () => { throw new Error('unused'); } },
    { search: async () => ({ results: [] }) },
    {},
    {},
    {},
    experiences,
    {},
    {
      finalizeLesson: async (_userId, input) => {
        completions.push(input);
        return { id: 'completion-1' };
      },
    },
  );
  return { service, lesson, attempts, completions, session: () => session };
}

test('lesson flow persists its active lock and only advances after explicit validation', async () => {
  const { service } = fixture();
  let flow = await service.flow('user-1', 'lesson-1');
  assert.equal(flow.activeStepKey, 'intro');
  await assert.rejects(
    () => service.enterFlowStep('user-1', 'lesson-1', 'explanation'),
    /validate the active/i,
  );
  flow = await service.validateFlowStep('user-1', 'lesson-1', 'intro');
  assert.deepEqual(flow.validatedStepKeys, ['intro']);
  flow = await service.enterFlowStep('user-1', 'lesson-1', 'explanation');
  assert.equal(flow.activeStepKey, 'explanation');
  const restored = await service.flow('user-1', 'lesson-1');
  assert.equal(restored.activeStepKey, 'explanation');
  assert.equal(restored.validatedStepKeys.includes('explanation'), false);
});

test('lesson finalization requires all evaluated exercises and occurs only after the full path', async () => {
  const { service, attempts, completions, session } = fixture();
  let flow = await service.flow('user-1', 'lesson-1');
  while (flow.activeStepKey !== 'exercises') {
    flow = await service.validateFlowStep('user-1', 'lesson-1', flow.activeStepKey);
    flow = await service.enterFlowStep('user-1', 'lesson-1', flow.stepKeys[flow.activeIndex + 1]);
  }
  await assert.rejects(
    () => service.validateFlowStep('user-1', 'lesson-1', 'exercises'),
    /every lesson exercise/i,
  );
  assert.equal(completions.length, 0);
  for (let index = 0; index < 4; index += 1) {
    attempts.push({ id: `attempt-${index}`, exerciseIndex: index });
  }
  while (!flow.completed) {
    flow = await service.validateFlowStep('user-1', 'lesson-1', flow.activeStepKey);
    if (!flow.completed) {
      flow = await service.enterFlowStep('user-1', 'lesson-1', flow.stepKeys[flow.activeIndex + 1]);
    }
  }
  assert.equal(completions.length, 1);
  assert.equal(completions[0].evidence.id, 'attempt-3');
  assert.equal(session().status, 'completed');
});

test('language-mastery Lesson flow excludes voice from generic coverage and never bypasses RLLE completion', async () => {
  const { service, attempts, completions, lesson, session } = fixture({ languageMastery: true });
  let flow = await service.flow('user-1', lesson.id);
  while (flow.activeStepKey !== 'exercises') {
    flow = await service.validateFlowStep('user-1', lesson.id, flow.activeStepKey);
    flow = await service.enterFlowStep('user-1', lesson.id, flow.stepKeys[flow.activeIndex + 1]);
  }
  for (let index = 0; index < lesson.exercises.length; index += 1) {
    if (lesson.exercises[index].languageFormat !== 'voice-pronunciation') {
      attempts.push({ id: `attempt-${index}`, exerciseIndex: index });
    }
  }
  while (!flow.completed) {
    flow = await service.validateFlowStep('user-1', lesson.id, flow.activeStepKey);
    if (!flow.completed) {
      flow = await service.enterFlowStep('user-1', lesson.id, flow.stepKeys[flow.activeIndex + 1]);
    }
  }
  assert.equal(completions.length, 0);
  assert.equal(session().status, 'completed');
});

test('lesson parser rejects an invalid QCM instead of silently downgrading it', () => {
  const { service } = fixture();
  const raw = JSON.stringify({
    objective: 'Objective', intro: 'Intro', explanation: 'Definition and progression',
    examples: ['Example'], commonMisconceptions: ['A common error and correction'],
    questions: ['Q1', 'Q2', 'Q3'], keyPoints: ['K1', 'K2', 'K3'],
    summary: 'Summary', revisionSheet: 'Revision', homework: '',
    exercises: [
      { type: 'qcm', question: 'QCM', answer: 'Missing', options: ['A', 'B', 'C'] },
      { type: 'open', question: 'Open', answer: 'A' },
      { type: 'exercise', question: 'Apply', answer: 'A' },
      { type: 'case', question: 'Case', answer: 'A' },
    ],
  });
  assert.throws(() => service.parseLesson(raw), /complete, usable lesson/i);
});
