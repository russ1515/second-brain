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

const remediationFormats = [
  'recognition-mcq', 'contextual-discrimination', 'fill-blank-no-hint',
  'sentence-reconstruction', 'register-matching', 'error-correction',
  'listening-discrimination', 'guided-writing', 'voice-pronunciation', 'mini-dialogue',
];
const generatedRemediationLesson = JSON.stringify({
  ...JSON.parse(generatedLesson),
  exercises: remediationFormats.map((languageFormat, index) => {
    const answer = `Remediation answer ${index}`;
    const qcm = [
      'recognition-mcq', 'contextual-discrimination', 'register-matching',
      'listening-discrimination',
    ].includes(languageFormat);
    return {
      type: qcm ? 'qcm' : 'open',
      question: `New remediation prompt ${index}`,
      answer,
      languageFormat,
      ...(qcm ? { options: [answer, `Distractor ${index}a`, `Distractor ${index}b`] } : {}),
      ...(languageFormat === 'sentence-reconstruction' ? { tokens: ['New', 'sentence'] } : {}),
      ...(['listening-discrimination', 'voice-pronunciation'].includes(languageFormat)
        ? { audioText: `New audio ${index}` }
        : {}),
      ...(languageFormat === 'mini-dialogue' ? { dialogueTurns: ['First turn', 'Second turn'] } : {}),
    };
  }),
});

function remediationConcurrencyHarness({
  failFirstPersistence = false,
} = {}) {
  const rows = new Map();
  const lockTails = new Map();
  let preflightReads = 0;
  let releasePreflights;
  const preflightsReady = new Promise((resolve) => { releasePreflights = resolve; });
  let providerCalls = 0;
  let createCalls = 0;
  let queuedDocuments = 0;

  const transaction = async (callback) => {
    const releases = [];
    const tx = {
      $executeRaw: async (_query, key) => {
        if (!String(key).startsWith('lesson-remediation-generation:')) return;
        const previous = lockTails.get(key) ?? Promise.resolve();
        let release;
        const held = new Promise((resolve) => { release = resolve; });
        lockTails.set(key, previous.then(() => held));
        await previous;
        releases.push(release);
      },
      languageProfile: { findFirst: async () => ({ id: 'profile-1' }) },
      lesson: {
        findFirst: async ({ where }) => rows.get(where.masteryRemediationGenerationKey) ?? null,
        create: async ({ data }) => {
          createCalls += 1;
          if (failFirstPersistence && createCalls === 1) {
            throw new Error('simulated crash after provider response');
          }
          const row = {
            id: 'remediation-lesson-1', ...data, sourceDocumentId: null,
            contentVersion: 1, createdAt: new Date('2026-10-11T08:00:00.000Z'),
          };
          rows.set(data.masteryRemediationGenerationKey, row);
          return row;
        },
        update: async ({ data }) => {
          const row = rows.get('remediation-generation-1');
          Object.assign(row, data);
          return row;
        },
      },
    };
    try {
      return await callback(tx);
    } finally {
      for (const release of releases.reverse()) release();
    }
  };
  const prisma = {
    onboardingProfile: { findUnique: async () => null },
    card: { count: async () => 0 },
    lesson: {
      findFirst: async () => {
        if (failFirstPersistence) return null;
        preflightReads += 1;
        if (preflightReads === 2) releasePreflights();
        await preflightsReady;
        return null;
      },
      findUnique: async ({ where }) =>
        [...rows.values()].find((row) => row.id === where.id) ?? null,
    },
    $transaction: transaction,
  };
  const service = new LessonService(
    prisma,
    {
      generate: async () => {
        providerCalls += 1;
        await new Promise((resolve) => setImmediate(resolve));
        return { text: generatedRemediationLesson };
      },
    },
    { search: async () => ({ results: [] }) },
    {
      createFromTextInTransaction: async () => ({ id: 'remediation-document-1' }),
      queuePostCreateProcessing: () => { queuedDocuments += 1; },
    },
    { linkDocument: async () => undefined },
    {},
    { ensureLessonSession: async () => ({ id: 'remediation-experience-1' }) },
    {},
    {},
    {},
  );
  return {
    service,
    providerCalls: () => providerCalls,
    createCalls: () => createCalls,
    queuedDocuments: () => queuedDocuments,
    rowCount: () => rows.size,
  };
}

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

test('concurrent remediation generation calls the provider and persists a lesson once', async () => {
  const runtime = remediationConcurrencyHarness();
  const generate = () => runtime.service.generate(
    'user-1',
    { topic: 'Targeted repair', language: 'French' },
    {
      languageMastery: true,
      languageProfileId: 'profile-1',
      masteryRemediationGenerationKey: 'remediation-generation-1',
    },
  );

  const [first, second] = await Promise.all([generate(), generate()]);
  assert.equal(first.id, 'remediation-lesson-1');
  assert.equal(second.id, first.id);
  assert.equal(runtime.providerCalls(), 1);
  assert.equal(runtime.createCalls(), 1);
  assert.equal(runtime.rowCount(), 1);
  assert.equal(runtime.queuedDocuments(), 1);
});

test('a post-provider remediation crash releases the lock and retry persists once', async () => {
  const runtime = remediationConcurrencyHarness({ failFirstPersistence: true });
  const generate = () => runtime.service.generate(
    'user-1',
    { topic: 'Targeted repair', language: 'French' },
    {
      languageMastery: true,
      languageProfileId: 'profile-1',
      masteryRemediationGenerationKey: 'remediation-generation-1',
    },
  );

  await assert.rejects(generate, /simulated crash after provider response/i);
  const recovered = await generate();
  assert.equal(recovered.id, 'remediation-lesson-1');
  assert.equal(runtime.providerCalls(), 2);
  assert.equal(runtime.createCalls(), 2);
  assert.equal(runtime.rowCount(), 1);
});
