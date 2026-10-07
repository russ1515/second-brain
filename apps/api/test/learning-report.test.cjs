'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { LearningReportService } = require('../dist/privacy/learning-report.service.js');

const at = new Date('2026-10-06T09:30:00.000Z');

function count(value, expectedOwner) {
  return {
    count: async ({ where }) => {
      if (expectedOwner) assert.equal(where.userId, expectedOwner);
      return value;
    },
  };
}

test('learning report separates declared, observed and assessed evidence without private payloads', async () => {
  const prisma = {
    profile: { findUnique: async () => ({ preferredLanguage: 'fr', displayName: 'Amina' }) },
    lesson: { ...count(3, 'user-1'), findFirst: async ({ where }) => { assert.equal(where.userId, 'user-1'); return { createdAt: at }; } },
    tutorSession: { ...count(2, 'user-1'), findFirst: async ({ where }) => { assert.equal(where.userId, 'user-1'); return { updatedAt: new Date(at.getTime() - 1000) }; } },
    concept: count(5, 'user-1'),
    studySession: { ...count(1, 'user-1'), findFirst: async ({ where }) => { assert.equal(where.userId, 'user-1'); return { startedAt: new Date(at.getTime() - 2000) }; } },
    reviewLog: count(8, 'user-1'),
    assessmentSubmission: {
      aggregate: async ({ where }) => { assert.equal(where.userId, 'user-1'); return { _count: { _all: 2 }, _avg: { score: 84 } }; },
    },
    exerciseAttempt: {
      aggregate: async ({ where }) => { assert.equal(where.userId, 'user-1'); return { _count: { _all: 4 }, _avg: { score: 0.75 } }; },
      count: async ({ where }) => { assert.equal(where.userId, 'user-1'); return where.correct ? 3 : 4; },
    },
  };
  const passport = {
    get: async () => ({
      declared: {
        source: 'DECLARED', ageBand: '18to25', countryOfOrigin: 'CD', currentCountry: 'DE',
        interfaceLanguage: 'fr', nativeOrPrimaryLanguage: 'fr', explanationLanguage: 'fr',
        teachingLanguage: 'de', knownLanguages: [], education: { category: 'university', level: 'licence', system: null, field: 'économie', domain: null, specialty: null, year: '2' },
        subjects: ['Finance'], academicGoals: ['Comprendre les marchés'],
        languageGoals: { targetLanguage: 'de', currentLevel: 'A2', targetLevel: 'B2', mainGoal: 'Études', skills: [] },
        learningPreferences: ['guided'], teacher: null, timezone: 'Europe/Berlin',
      },
      observed: {
        learnerProfile: { level: { band: 'building', score: 52 }, interactions: 12 },
        learningDna: null,
      },
    }),
  };

  const report = await new LearningReportService(prisma, passport).get('user-1', 'fr-FR');

  assert.equal(report.locale, 'fr');
  assert.equal(report.declared.source, 'DECLARED');
  assert.equal(report.observed.source, 'OBSERVED');
  assert.equal(report.assessed.source, 'ASSESSED');
  assert.deepEqual(report.observed.totals, {
    lessons: 3, tutorSessions: 2, concepts: 5, completedStudySessions: 1, reviews: 8,
  });
  assert.equal(report.observed.lastLearningActivityAt, at.toISOString());
  assert.equal(report.assessed.averageAssessmentScore, 84);
  assert.equal(report.assessed.averageExerciseScore, 0.75);
  assert.equal(report.assessed.evidenceAvailable, true);
  const serialized = JSON.stringify(report);
  assert.equal(report.learnerName, 'Amina');
  assert.doesNotMatch(
    serialized,
    /"(?:password|token|invoice|payment|conversation|documentContent)"\s*:/i,
  );
  assert.deepEqual(report.exclusions, [
    'RAW_CONVERSATIONS', 'FULL_DOCUMENTS', 'AUTH_SECRETS', 'FINANCIAL_DETAILS',
  ]);
});

test('learning report remains honest when no assessed evidence exists', async () => {
  const zero = count(0, 'user-2');
  const prisma = {
    profile: { findUnique: async () => null },
    lesson: { ...zero, findFirst: async () => null },
    tutorSession: { ...zero, findFirst: async () => null },
    concept: zero,
    studySession: { ...zero, findFirst: async () => null },
    reviewLog: zero,
    assessmentSubmission: { aggregate: async () => ({ _count: { _all: 0 }, _avg: { score: null } }) },
    exerciseAttempt: {
      aggregate: async () => ({ _count: { _all: 0 }, _avg: { score: null } }),
      count: async () => 0,
    },
  };
  const passport = {
    get: async () => ({
      declared: {
        source: 'DECLARED', ageBand: null, countryOfOrigin: null, currentCountry: null,
        interfaceLanguage: null, nativeOrPrimaryLanguage: null, explanationLanguage: null,
        teachingLanguage: null, knownLanguages: [], education: { category: null, level: null, system: null, field: null, domain: null, specialty: null, year: null },
        subjects: [], academicGoals: [], languageGoals: { targetLanguage: null, currentLevel: null, targetLevel: null, mainGoal: null, skills: [] },
        learningPreferences: [], teacher: null, timezone: 'UTC',
      },
      observed: { learnerProfile: null, learningDna: null },
    }),
  };
  const report = await new LearningReportService(prisma, passport).get('user-2');
  assert.equal(report.assessed.evidenceAvailable, false);
  assert.equal(report.assessed.averageAssessmentScore, null);
  assert.equal(report.observed.lastLearningActivityAt, null);
});
