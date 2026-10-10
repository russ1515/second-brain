'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { LessonService } = require('../dist/lessons/lesson.service.js');
const { LanguageService } = require('../dist/languages/language.service.js');

const generatedLesson = JSON.stringify({
  objective: 'Understand the topic.',
  intro: 'A progressive introduction.',
  explanation: 'A complete explanation with ordered reasoning.',
  examples: ['First concrete example.'],
  commonMisconceptions: ['A common error and its correction.'],
  questions: ['Question one?', 'Question two?', 'Question three?'],
  exercises: [
    { type: 'qcm', question: 'Choose.', answer: 'A', options: ['A', 'B', 'C'] },
    { type: 'open', question: 'Explain.', answer: 'Explanation.' },
    { type: 'exercise', question: 'Apply.', answer: 'Application.' },
    { type: 'case', question: 'Analyse.', answer: 'Analysis.' },
  ],
  homework: 'Review the examples.',
  summary: 'A useful summary.',
  keyPoints: ['First point.', 'Second point.', 'Third point.'],
  revisionSheet: 'Revision sheet.',
});

test('lesson generation persists lesson, experience and LESSON_AI document under one owner lock', async () => {
  const events = [];
  let transactionActive = false;
  const tx = {
    $executeRaw: async () => { events.push('lock'); },
    lesson: {
      create: async ({ data }) => {
        assert.equal(transactionActive, true);
        events.push('lesson:create');
        return {
          id: 'lesson-1',
          ...data,
          sourceDocumentId: null,
          contentVersion: 1,
          createdAt: new Date('2026-10-08T08:00:00.000Z'),
          updatedAt: new Date('2026-10-08T08:00:00.000Z'),
        };
      },
      update: async ({ data }) => {
        assert.equal(transactionActive, true);
        events.push('lesson:link-document');
        return {
          id: 'lesson-1', userId: 'user-1', tutorSessionId: null, conceptId: null,
          languageProfileId: null, language: 'French', level: null, topic: 'Algebra',
          objective: 'Understand the topic.', intro: 'A progressive introduction.',
          explanation: 'A complete explanation with ordered reasoning.',
          examples: ['First concrete example.'],
          questions: ['Question one?', 'Question two?', 'Question three?'],
          exercises: JSON.parse(generatedLesson).exercises,
          homework: 'Review the examples.', summary: 'A useful summary.',
          keyPoints: ['First point.', 'Second point.', 'Third point.'],
          revisionSheet: 'Revision sheet.', sourceDocumentId: data.sourceDocumentId,
          contentVersion: 1,
          createdAt: new Date('2026-10-08T08:00:00.000Z'),
          updatedAt: new Date('2026-10-08T08:00:00.000Z'),
        };
      },
    },
  };
  const prisma = {
    onboardingProfile: { findUnique: async () => null },
    $transaction: async (callback) => {
      transactionActive = true;
      events.push('transaction:start');
      try {
        return await callback(tx);
      } finally {
        transactionActive = false;
        events.push('transaction:commit');
      }
    },
  };
  const documents = {
    createFromTextInTransaction: async (_userId, input, transaction) => {
      assert.equal(transactionActive, true);
      assert.equal(transaction, tx);
      assert.equal(input.contentType, 'LESSON_AI');
      assert.equal(input.sourceRef, 'lesson:lesson-1');
      events.push('document:create');
      return { id: 'document-1' };
    },
    queuePostCreateProcessing: (id) => {
      assert.equal(transactionActive, false);
      assert.equal(id, 'document-1');
      events.push('document:queue');
    },
  };
  const experiences = {
    ensureLessonSession: async (_userId, request, transaction) => {
      assert.equal(transactionActive, true);
      assert.equal(transaction, tx);
      assert.equal(request.links.lessonId, 'lesson-1');
      events.push('experience:create');
      return { id: 'experience-1' };
    },
  };
  const service = new LessonService(
    prisma,
    { generate: async () => ({ text: generatedLesson }) },
    { search: async () => ({ results: [] }) },
    documents,
    { linkDocument: async () => undefined },
    {},
    experiences,
    {},
    {},
    {},
  );

  const result = await service.generate('user-1', { topic: 'Algebra', language: 'French' });
  assert.equal(result.sourceDocumentId, 'document-1');
  assert.deepEqual(events, [
    'transaction:start',
    'lock',
    'lesson:create',
    'experience:create',
    'document:create',
    'lesson:link-document',
    'transaction:commit',
    'document:queue',
  ]);
});

test('ensureVocabDeck re-reads and attaches the deck atomically under the owner lock', async () => {
  const events = [];
  const current = {
    id: 'profile-1', userId: 'user-1', language: 'German', vocabDeckId: null,
  };
  const tx = {
    $executeRaw: async () => { events.push('lock'); },
    languageProfile: {
      findFirst: async () => { events.push('profile:read'); return current; },
      update: async ({ where, data }) => {
        events.push('profile:attach');
        assert.deepEqual(where, { id: 'profile-1' });
        assert.deepEqual(data, { vocabDeckId: 'deck-1' });
      },
    },
    deck: {
      create: async () => { events.push('deck:create'); return { id: 'deck-1' }; },
    },
  };
  const service = new LanguageService(
    { $transaction: async (callback) => callback(tx) },
    {},
    {},
  );

  const id = await service.ensureVocabDeck({ ...current });
  assert.equal(id, 'deck-1');
  assert.deepEqual(events, ['lock', 'profile:read', 'deck:create', 'profile:attach']);
});

test('ensureVocabDeck refuses a stale deleted profile before creating a deck', async () => {
  let created = false;
  const tx = {
    $executeRaw: async () => undefined,
    languageProfile: { findFirst: async () => null },
    deck: { create: async () => { created = true; return { id: 'orphan' }; } },
  };
  const service = new LanguageService(
    { $transaction: async (callback) => callback(tx) },
    {},
    {},
  );

  await assert.rejects(
    () => service.ensureVocabDeck({ id: 'profile-1', userId: 'user-1', vocabDeckId: null }),
    /Language profile not found/,
  );
  assert.equal(created, false);
});
