'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');

const { LearningResetService } = require('../dist/privacy/learning-reset.service.js');

const PEDAGOGICAL_MODELS = [
  'learningGoalLink',
  'learningCompletion',
  'reviewLog',
  'documentChunk',
  'conceptEdge',
  'conceptCard',
  'conceptDocument',
  'exerciseAttempt',
  'homework',
  'assessmentSubmission',
  'studyResource',
  'experienceSession',
  'dailyPlan',
  'calendarEvent',
  'notification',
  'reviewable',
  'studySession',
  'academicWorkspace',
  'assessment',
  'writingSubmission',
  'readingExercise',
  'lesson',
  'tutorSession',
  'languageProfile',
  'successPrediction',
  'exam',
  'goal',
  'card',
  'deck',
  'concept',
  'document',
  'collection',
  'achievement',
  'aiInitiative',
  'coachProfile',
  'learningPrediction',
  'recommendation',
  'mentorGuidance',
  'learningDna',
  'onboardingProfile',
];

const PRESERVED_MODELS = [
  'profile',
  'session',
  'subscription',
  'payment',
  'invoice',
  'usageCounter',
  'quotaCycle',
  'quotaAccount',
  'quotaReservation',
  'usageLedger',
  'providerUsage',
  'providerUsageOperation',
  'entitlementOverride',
  'consent',
  'recoveryCode',
  'emailOtp',
  'emailVerificationToken',
];

async function fixture({ mfa = false, recentMfa = null } = {}) {
  const password = 'correct horse battery staple';
  const passwordHash = await argon2.hash(password);
  const events = [];
  const deletedOwners = new Map(PEDAGOGICAL_MODELS.map((model) => [model, new Set()]));

  const tx = {
    $executeRaw: async (_parts, lockKey) => { events.push(`lock:${lockKey}`); },
    user: {
      findUnique: async () => ({
        passwordHash,
        twoFactorEnabled: mfa,
        accountStatus: 'active',
      }),
    },
    session: {
      findFirst: async () => ({ mfaVerifiedAt: recentMfa }),
    },
    auditLog: {
      create: async ({ data }) => {
        events.push(`audit:${data.action}`);
        assert.equal(data.metadata.accountPreserved, true);
        assert.equal(data.metadata.consumedQuotaPreserved, true);
      },
    },
  };
  for (const model of PEDAGOGICAL_MODELS) {
    tx[model] = {
      deleteMany: async ({ where }) => {
        const owner = where.userId ?? where.concept?.userId;
        assert.equal(owner, 'owner-a', `${model} must be owner-scoped`);
        events.push(`delete:${model}:${owner}`);
        deletedOwners.get(model).add(owner);
        return { count: 1 };
      },
    };
  }
  for (const model of PRESERVED_MODELS) {
    if (tx[model]) continue;
    tx[model] = {
      deleteMany: async () => {
        throw new Error(`${model} must be preserved`);
      },
    };
  }

  const prisma = {
    user: {
      findUnique: async () => ({ twoFactorEnabled: mfa }),
    },
    $transaction: async (operation) => operation(tx),
  };
  const qdrant = {
    deleteByUser: async (_collection, owner) => {
      assert.equal(owner, 'owner-a');
      events.push(`qdrant:${owner}`);
    },
  };
  const media = {
    deleteLearningMediaAnd: async (owner, finalize) => {
      assert.equal(owner, 'owner-a');
      events.push(`media:${owner}`);
      return finalize();
    },
  };
  const config = { get: () => 600 };
  const cache = {
    invalidate: async (key) => { events.push(`cache:${key}`); },
    invalidatePrefix: async (prefix) => { events.push(`cache-prefix:${prefix}`); },
  };
  return {
    service: new LearningResetService(prisma, qdrant, media, config, cache),
    password,
    events,
    deletedOwners,
  };
}

test('learning reset clears every pedagogical owner scope and preserves account/commercial/security rows', async () => {
  const { service, password, events, deletedOwners } = await fixture();
  const result = await service.resetLearning('owner-a', 'session-a', {
    password,
    confirmation: 'RÉINITIALISER',
  });

  assert.equal(result.onboardingRequired, true);
  assert.ok(!Number.isNaN(Date.parse(result.resetAt)));
  assert.equal(events[0], 'lock:account-data:owner-a');
  assert.equal(events[1], 'qdrant:owner-a');
  assert.equal(events[2], 'media:owner-a');
  const auditIndex = events.indexOf('audit:USER_LEARNING_RESET');
  assert.ok(auditIndex > 0);
  assert.deepEqual(new Set(events.slice(auditIndex + 1)), new Set([
    'cache:ai-mentor:owner-a',
    'cache:success:owner-a',
    'cache:learning-dna:owner-a',
    'cache:foresight:owner-a',
    'cache:insights-center:owner-a',
    'cache-prefix:research:web:',
  ]));
  for (const model of PEDAGOGICAL_MODELS) {
    assert.deepEqual([...deletedOwners.get(model)], ['owner-a']);
  }
  assert.equal(events.some((event) => event.endsWith(':owner-b')), false);
});

test('learning reset is idempotent and repeats the same owner-scoped purge safely', async () => {
  const { service, password, events } = await fixture();
  const request = { password, confirmation: 'RÉINITIALISER' };
  await service.resetLearning('owner-a', 'session-a', request);
  await service.resetLearning('owner-a', 'session-a', request);
  assert.equal(events.filter((event) => event === 'audit:USER_LEARNING_RESET').length, 2);
  assert.equal(events.filter((event) => event === 'qdrant:owner-a').length, 2);
});

test('learning reset requires recent MFA before any destructive side effect', async () => {
  const { service, password, events } = await fixture({ mfa: true, recentMfa: null });
  await assert.rejects(
    () => service.resetLearning('owner-a', 'session-a', {
      password,
      confirmation: 'RÉINITIALISER',
    }),
    (error) => error?.response?.code === 'MFA_STEP_UP_REQUIRED',
  );
  assert.deepEqual(events, ['lock:account-data:owner-a']);
});

test('learning reset accepts a recent MFA step-up and preserves the strong confirmation', async () => {
  const { service, password } = await fixture({ mfa: true, recentMfa: new Date() });
  await service.resetLearning('owner-a', 'session-a', {
    password,
    confirmation: 'RÉINITIALISER',
  });
  await assert.rejects(
    () => service.resetLearning('owner-a', 'session-a', {
      password,
      confirmation: 'RESET',
    }),
    (error) => error?.response?.code === 'LEARNING_RESET_CONFIRMATION_REQUIRED',
  );
});

test('reset requirements expose only whether the authenticated owner needs MFA', async () => {
  const { service } = await fixture({ mfa: true });
  assert.deepEqual(await service.getRequirements('owner-a'), { mfaRequired: true });
});
