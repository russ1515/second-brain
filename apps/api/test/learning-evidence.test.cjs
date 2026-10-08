'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvidenceProgressService } = require('../dist/learning-evidence/evidence-progress.service.js');
const { LearningCompletionService } = require('../dist/learning-evidence/learning-completion.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const AT = new Date('2026-10-08T10:00:00.000Z');

test('evidence progression averages explicit observations and leaves every absent dimension null', async () => {
  const prisma = {
    learningCompletion: {
      findMany: async ({ where }) => {
        assert.equal(where.userId, 'owner-1');
        assert.equal(where.status, 'verified');
        return [
          { id: 'c1', finalizedAt: AT, dimensionScores: { knowledge: { score: 0.5 } } },
          { id: 'c2', finalizedAt: new Date(AT.getTime() + 1000), dimensionScores: { knowledge: { score: 1 }, reasoning: { score: 0.25 } } },
          { id: 'c3', finalizedAt: new Date(AT.getTime() + 2000), dimensionScores: { knowledge: { score: null }, application: { score: 4 } } },
        ];
      },
    },
  };
  const view = await new EvidenceProgressService(prisma).progress('owner-1');
  assert.equal(view.completedCount, 3);
  assert.equal(view.dimensions.find((item) => item.dimension === 'knowledge').percent, 75);
  assert.equal(view.dimensions.find((item) => item.dimension === 'knowledge').evaluatedEvidenceCount, 2);
  assert.equal(view.dimensions.find((item) => item.dimension === 'reasoning').percent, 25);
  assert.equal(view.dimensions.find((item) => item.dimension === 'application').percent, null);
  assert.equal(view.dimensions.find((item) => item.dimension === 'critical_reflection').percent, null);
});

test('lesson finalization verifies owner/evidence, is versioned, and publishes revision only after proof', async () => {
  const calls = [];
  const completion = {
    id: 'completion-1',
    userId: 'owner-1',
    kind: 'lesson',
    learningRefId: 'lesson-1',
    contentVersion: 3,
    status: 'verified',
    criteria: [{ id: 'exercise:0', label: 'Question', met: true, score: 0.8 }],
    result: { outcome: 'demonstrated', score: 0.8, passed: true, feedback: 'Good' },
    provenance: { schemaVersion: 1, contentVersion: 3, evidenceSource: 'exercise_attempt', evidenceRefIds: ['attempt-1'], experienceSessionId: null, evaluatedAt: AT.toISOString() },
    dimensionScores: {
      knowledge: { dimension: 'knowledge', score: null, criterionIds: [], evidenceRefIds: [] },
      understanding: { dimension: 'understanding', score: null, criterionIds: [], evidenceRefIds: [] },
      application: { dimension: 'application', score: null, criterionIds: [], evidenceRefIds: [] },
      reasoning: { dimension: 'reasoning', score: null, criterionIds: [], evidenceRefIds: [] },
      critical_reflection: { dimension: 'critical_reflection', score: null, criterionIds: [], evidenceRefIds: [] },
      perspective: { dimension: 'perspective', score: null, criterionIds: [], evidenceRefIds: [] },
    },
    startedAt: null,
    finalizedAt: AT,
    goals: [],
    lesson: { topic: 'Networks' },
    languageProfile: null,
  };
  const prisma = {
    lesson: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { id: 'lesson-1', userId: 'owner-1' });
      return { id: 'lesson-1', topic: 'Networks', contentVersion: 3, sourceDocumentId: null, conceptId: null };
    } },
    exerciseAttempt: { findFirst: async ({ where }) => {
      assert.equal(where.userId, 'owner-1');
      assert.equal(where.lessonId, 'lesson-1');
      assert.equal(where.contentVersion, 3);
      return { id: 'attempt-1', contentVersion: 3, exerciseIndex: 0, question: 'Question', correct: true, score: 0.8, feedback: 'Good', correction: '', createdAt: AT };
    } },
    learningCompletion: {
      upsert: async (args) => { calls.push(['completion', args.create]); return completion; },
      findUniqueOrThrow: async () => completion,
    },
    reviewable: { upsert: async (args) => { calls.push(['reviewable', args]); return { id: 'reviewable-1' }; } },
    learningCompletionReviewable: { upsert: async (args) => { calls.push(['link', args]); return {}; } },
    $transaction: async (callback) => callback(prisma),
  };
  const cards = { generateFromDocument: async () => assert.fail('no document means no card generation') };
  const result = await new LearningCompletionService(prisma, cards).finalizeLesson('owner-1', {
    lessonId: 'lesson-1', evidence: { kind: 'exercise_attempt', id: 'attempt-1' },
  });
  assert.equal(result.id, 'completion-1');
  assert.equal(calls[0][0], 'completion');
  assert.equal(calls[0][1].contentVersion, 3);
  assert.equal(Object.hasOwn(calls[0][1], 'finalizedAt'), false);
  assert.equal(calls[0][1].provenance.evaluatedAt, AT.toISOString());
  assert.equal(calls[1][0], 'reviewable');
  assert.equal(calls[2][0], 'link');
  assert.equal(result.dimensions.knowledge.score, null);
});

test('the same curriculum unit has a distinct canonical identity in each language profile', async () => {
  const refs = [];
  const finalize = async (profileId, language) => {
    let persisted;
    const evidenceId = `evidence-${profileId}`;
    const prisma = {
      languageProfile: {
        findFirst: async () => ({ id: profileId, language }),
      },
      experienceSession: {
        findFirst: async () => ({
          id: `session-${profileId}`,
          userId: 'owner-1',
          languageProfileId: profileId,
          lessonId: null,
          startedAt: AT,
          currentStep: {
            metadata: {
              rlleCourse: {
                completedUnitIds: ['a1-first-contact'],
                evidence: [{
                  id: evidenceId,
                  canDoId: 'social-introduce',
                  source: 'controlled-activity',
                  sourceId: `activity-${profileId}`,
                  result: 'demonstrated',
                  observedAt: AT.toISOString(),
                  observation: 'Observed and evaluated.',
                }],
              },
            },
          },
        }),
        findUnique: async () => ({ goalId: null }),
      },
      learningGoalLink: { findMany: async () => [] },
      learningCompletion: {
        upsert: async (args) => {
          refs.push(args.create.learningRefId);
          assert.equal(Object.hasOwn(args.create, 'finalizedAt'), false);
          persisted = {
            id: `completion-${profileId}`,
            ...args.create,
            status: 'verified',
            startedAt: AT,
            finalizedAt: new Date(AT.getTime() + 1000),
            goals: [],
            lesson: null,
            languageProfile: { language },
          };
          return persisted;
        },
        findUniqueOrThrow: async () => persisted,
      },
      reviewable: { upsert: async () => ({ id: `reviewable-${profileId}` }) },
      learningCompletionReviewable: { upsert: async () => ({}) },
      $transaction: async (callback) => callback(prisma),
    };
    return new LearningCompletionService(prisma, {}).finalizeLanguageUnit('owner-1', {
      languageProfileId: profileId,
      unitId: 'a1-first-contact',
      experienceSessionId: `session-${profileId}`,
      evidenceIds: [evidenceId],
    });
  };

  const german = await finalize('profile-de', 'German');
  const japanese = await finalize('profile-ja', 'Japanese');
  assert.notEqual(refs[0], refs[1]);
  assert.match(refs[0], /profile-de/);
  assert.match(refs[1], /profile-ja/);
  assert.match(german.title, /German/);
  assert.match(japanese.title, /Japanese/);
});

test('a clicked/completed language unit without controlled evidence is not canonical completion', async () => {
  const prisma = {
    languageProfile: { findFirst: async () => ({ id: 'lp-1', language: 'German' }) },
    experienceSession: { findFirst: async () => ({
      id: 'session-1', userId: 'owner-1', languageProfileId: 'lp-1', lessonId: null,
      startedAt: AT,
      currentStep: { metadata: { rlleCourse: { completedUnitIds: ['a1-first-contact'], evidence: [] } } },
    }) },
  };
  const service = new LearningCompletionService(prisma, {});
  await assert.rejects(
    service.finalizeLanguageUnit('owner-1', {
      languageProfileId: 'lp-1', unitId: 'a1-first-contact', experienceSessionId: 'session-1', evidenceIds: [],
    }),
    /Final evaluated evidence is required/,
  );
});

test('review/calendar queues are hard-filtered by verified canonical completion links', () => {
  for (const file of [
    'apps/api/src/revision/revision-engine.service.ts',
    'apps/api/src/flashcards/session.service.ts',
    'apps/api/src/flashcards/review.service.ts',
    'apps/api/src/flashcards/review-experience.service.ts',
    'apps/api/src/calendar/calendar.service.ts',
  ]) {
    const source = read(file);
    assert.match(source, /completionLinks/);
    assert.match(source, /status:\s*'verified'/);
  }
});

test('migration preserves compatible goal links without fabricating legacy completion evidence', () => {
  const migration = read('apps/api/prisma/migrations/20261008120000_learning_completion_evidence/migration.sql');
  assert.match(migration, /CREATE TABLE "learning_completions"/);
  assert.match(migration, /CREATE TABLE "learning_goal_links"/);
  assert.doesNotMatch(migration, /INSERT INTO "learning_completions"/i);
  assert.match(migration, /INSERT INTO "learning_goal_links"/i);
  assert.match(migration, /es\."type" IN \('learning', 'language'\)/);
  assert.match(migration, /learning_goal_links_one_primary_per_session/);
  assert.match(migration, /WHERE "isPrimary" = true/);
  assert.match(migration, /ALTER TABLE "exercise_attempts"[\s\S]*"contentVersion" INTEGER NOT NULL DEFAULT 1/);
  assert.match(migration, /assessments_lessonId_fkey"[\s\S]*ON DELETE CASCADE/);
  assert.match(
    read('apps/api/src/lessons/assessment.service.ts'),
    /contentVersion:\s*lesson\.contentVersion/,
  );
  const lessonService = read('apps/api/src/lessons/lesson.service.ts');
  assert.match(
    lessonService,
    /exerciseAttempt\.findFirst\([\s\S]*?contentVersion:\s*lesson\.contentVersion/,
  );
  assert.match(
    lessonService,
    /exerciseAttempt\.findMany\([\s\S]*?contentVersion:\s*lesson\.contentVersion/,
  );
});
