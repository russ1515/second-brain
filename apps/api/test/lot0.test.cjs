'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} = require('@nestjs/common');
const shared = require('@second-brain/shared');
const {
  ExperienceSessionService,
} = require('../dist/experience-sessions/experience-session.service.js');
const {
  NextBestActionAdapter,
} = require('../dist/recommendation/next-best-action.adapter.js');
const {
  DisabledResearchProvider,
} = require('../dist/research/providers/disabled-research.provider.js');
const {
  UsageService,
} = require('../dist/usage/usage.service.js');

test('route metadata: core spaces, auth and non-user categories are coherent', () => {
  assert.deepEqual(shared.validateRouteMetadataRegistry(), []);
  const expectedSpaces = new Map([
    ['/', 'home'],
    ['/learn', 'learn'],
    ['/brain', 'brain'],
    ['/study', 'study'],
    ['/profile', 'profile'],
  ]);
  for (const [path, parentSpace] of expectedSpaces) {
    const metadata = shared.routeMetadataFor(path);
    assert.equal(metadata?.parentSpace, parentSpace);
    assert.equal(metadata?.shellMode, 'primary');
    assert.equal(metadata?.category, 'USER');
  }
  assert.equal(shared.routeMetadataFor('/sign-in').requiresAuth, false);
  assert.equal(shared.routeMetadataFor('/admin').category, 'ADMIN');
  assert.deepEqual(shared.routeMetadataFor('/admin').permissions, ['admin']);
  assert.equal(shared.routeMetadataFor('/revision-engine').category, 'LEGACY');
  assert.equal(shared.routeMetadataFor('/monitoring').category, 'TECH');
});

test('route metadata: every current Expo screen is registered without extras', () => {
  const appRoot = path.resolve(__dirname, '../../mobile/app');
  const actual = walk(appRoot)
    .filter((file) => file.endsWith('.tsx') && !file.endsWith('_layout.tsx'))
    .map((file) => expoRoute(appRoot, file))
    .sort();
  const registered = shared.ROUTE_METADATA.map((entry) => entry.path).sort();
  assert.deepEqual(registered, actual);
});

test('context: priority, add/remove, restoration, expiration and ownership', () => {
  const now = new Date('2026-09-05T10:00:00.000Z');
  let context = shared.createContext('u1', [
    {
      id: 'profile', kind: 'user-profile', scope: 'permanent-profile',
      priority: 100, visibility: 'summary', label: 'Profile',
    },
    {
      id: 'turn', kind: 'concept', scope: 'current-turn',
      priority: 0, visibility: 'visible', label: 'Current concept',
    },
    {
      id: 'expired', kind: 'goal', scope: 'active-object', priority: 50,
      visibility: 'visible', expiresAt: '2026-09-05T09:59:00.000Z',
    },
  ], now);
  assert.equal(shared.contextItemsForDisplay(context, 5, now)[0].id, 'turn');

  context = shared.upsertContextItem(context, {
    id: 'document', kind: 'document', scope: 'active-object', priority: 40,
    visibility: 'visible', referenceId: 'd1',
  }, now);
  assert.ok(context.items.some((item) => item.id === 'document'));
  context = shared.removeContextItem(context, 'profile', undefined, now);
  assert.equal(context.items.some((item) => item.id === 'profile'), false);

  const restored = shared.restoreContext(shared.serializeContext(context), 'u1', now);
  assert.equal(restored.ownerUserId, 'u1');
  assert.equal(restored.items.some((item) => item.id === 'expired'), false);
  assert.throws(
    () => shared.restoreContext(shared.serializeContext(context), 'other', now),
    /owner/i,
  );
  assert.throws(
    () => shared.createContext('u1', [{
      id: 'unsafe', kind: 'document', scope: 'active-object', priority: 1,
      visibility: 'visible', metadata: { access_token: 'never-store-this' },
    }], now),
    /sensitive/i,
  );
  assert.throws(
    () => shared.createContext('u1', [{
      id: 'bad-priority', kind: 'goal', scope: 'space', priority: 101,
      visibility: 'visible',
    }], now),
    /priority/i,
  );
});

test('experience sessions: create, persist, update, pause/resume/complete and isolate users', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);
  const created = await service.create('u1', {
    type: 'learning',
    title: 'Networks',
    intent: 'Understand OSI',
    inputModality: 'file',
    activeContexts: [{
      id: 'doc', kind: 'document', scope: 'active-object', referenceId: 'd1',
      priority: 80, visibility: 'visible',
    }],
    resumeTarget: { kind: 'route', path: '/session/s1' },
    idempotencyKey: 'create-networks',
  });
  assert.equal(created.status, 'active');
  assert.equal(created.version, 1);
  assert.equal(created.activeContexts.ownerUserId, 'u1');

  const duplicate = await service.create('u1', {
    type: 'learning', idempotencyKey: 'create-networks',
  });
  assert.equal(duplicate.id, created.id);
  assert.equal(prisma.rows.length, 1);

  const updated = await service.updateState('u1', created.id, {
    progress: { completed: 2, total: 4, percent: 99 },
  });
  assert.equal(updated.progress.percent, 50);
  assert.equal((await service.get('u1', created.id)).progress.completed, 2);

  assert.equal((await service.pause('u1', created.id)).status, 'paused');
  assert.equal((await service.resumable('u1', 20)).items.length, 1);
  assert.equal((await service.resume('u1', created.id)).status, 'active');
  assert.equal((await service.complete('u1', created.id)).status, 'completed');
  assert.equal((await service.complete('u1', created.id)).status, 'completed');
  assert.equal((await service.resumable('u1', 20)).items.length, 0);
  assert.equal((await service.recent('u1', 20)).items.length, 1);

  await assert.rejects(
    service.get('u2', created.id),
    (error) => error instanceof NotFoundException,
  );
  await assert.rejects(
    service.pause('u2', created.id),
    (error) => error instanceof NotFoundException,
  );
});

test('experience sessions: foreign domain links are rejected', async () => {
  const prisma = inMemoryPrisma();
  prisma.document = { findFirst: async () => null };
  const service = new ExperienceSessionService(prisma);
  await assert.rejects(
    service.create('u1', {
      type: 'document-processing',
      links: { documentId: 'owned-by-someone-else' },
    }),
    (error) => error instanceof BadRequestException,
  );
  assert.equal(prisma.rows.length, 0);
});

test('experience sessions: source updates lock, revalidate, and cannot race a purge', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);
  const session = await service.create('u1', { type: 'learning' });
  const availableDocuments = new Set(['doc-ok', 'doc-race']);
  const events = [];
  const updateMany = prisma.experienceSession.updateMany;
  let lockBarrier = null;
  let notifyLockWait = null;

  prisma.$transaction = async (operation) => {
    events.push('transaction:start');
    const tx = {
      ...prisma,
      experienceSession: {
        ...prisma.experienceSession,
        updateMany: async (args) => {
          events.push('session:write');
          return updateMany(args);
        },
      },
      document: {
        ...prisma.document,
        count: async ({ where }) => {
          const ids = where.id.in;
          events.push(`sources:validate:${ids.join(',')}`);
          return ids.filter((id) => availableDocuments.has(id)).length;
        },
      },
      async $executeRaw(_query, lockKey) {
        events.push(`lock:wait:${lockKey}`);
        if (lockBarrier) {
          notifyLockWait?.();
          await lockBarrier;
        }
        events.push(`lock:acquired:${lockKey}`);
        return 1;
      },
    };
    try {
      const result = await operation(tx);
      events.push('transaction:commit');
      return result;
    } catch (error) {
      events.push('transaction:rollback');
      throw error;
    }
  };

  const updated = await service.updateState('u1', session.id, {
    sourceReferences: [{ kind: 'document', id: 'doc-ok', title: 'Available source' }],
  });
  assert.deepEqual(updated.sourceReferences, [
    { kind: 'document', id: 'doc-ok', title: 'Available source' },
  ]);
  assert.deepEqual(events, [
    'transaction:start',
    'lock:wait:account-data:u1',
    'lock:acquired:account-data:u1',
    'sources:validate:doc-ok',
    'session:write',
    'transaction:commit',
  ]);

  events.length = 0;
  let releaseOwnerLock;
  lockBarrier = new Promise((resolve) => { releaseOwnerLock = resolve; });
  const lockWaited = new Promise((resolve) => { notifyLockWait = resolve; });
  const racedUpdate = service.updateState('u1', session.id, {
    sourceReferences: [{ kind: 'document', id: 'doc-race', title: 'Purged source' }],
  });
  const raceState = await Promise.race([
    lockWaited.then(() => 'waiting-for-owner-lock'),
    racedUpdate.then(() => 'updated-without-lock', () => 'rejected-before-lock'),
  ]);
  assert.equal(raceState, 'waiting-for-owner-lock');

  events.push('purge:commit');
  availableDocuments.delete('doc-race');
  releaseOwnerLock();
  await assert.rejects(
    racedUpdate,
    (error) => error instanceof BadRequestException,
  );
  assert.deepEqual(events, [
    'transaction:start',
    'lock:wait:account-data:u1',
    'purge:commit',
    'lock:acquired:account-data:u1',
    'sources:validate:doc-race',
    'transaction:rollback',
  ]);
  const unchanged = await service.get('u1', session.id);
  assert.equal(unchanged.version, updated.version);
  assert.deepEqual(unchanged.sourceReferences, updated.sourceReferences);

  events.length = 0;
  availableDocuments.add('doc-context-race');
  lockBarrier = new Promise((resolve) => { releaseOwnerLock = resolve; });
  const contextLockWaited = new Promise((resolve) => { notifyLockWait = resolve; });
  const racedContextUpdate = service.updateState('u1', session.id, {
    activeContexts: [{
      id: 'document:doc-context-race',
      kind: 'document',
      scope: 'active-object',
      referenceId: 'doc-context-race',
      priority: 90,
      visibility: 'visible',
    }],
  });
  assert.equal(await Promise.race([
    contextLockWaited.then(() => 'waiting-for-owner-lock'),
    racedContextUpdate.then(() => 'updated-without-lock', () => 'rejected-before-lock'),
  ]), 'waiting-for-owner-lock');
  events.push('purge:commit');
  availableDocuments.delete('doc-context-race');
  releaseOwnerLock();
  await assert.rejects(
    racedContextUpdate,
    (error) => error instanceof BadRequestException,
  );
  assert.deepEqual(events, [
    'transaction:start',
    'lock:wait:account-data:u1',
    'purge:commit',
    'lock:acquired:account-data:u1',
    'sources:validate:doc-context-race',
    'transaction:rollback',
  ]);
  const contextUnchanged = await service.get('u1', session.id);
  assert.equal(contextUnchanged.version, updated.version);
  assert.equal(contextUnchanged.activeContexts.items.length, 0);
});

test('experience sessions: public keys cannot claim server namespaces and collisions are strict', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);

  for (const idempotencyKey of [
    'server:v2:tutor:t1',
    'tutor:t1',
    'lesson:l1',
    'language-conversation:t1',
  ]) {
    assert.throws(
      () => service.createFromClient('u1', { type: 'learning', idempotencyKey }),
      (error) => error instanceof BadRequestException,
    );
  }

  await service.create('u1', {
    type: 'learning',
    links: { documentId: 'd1' },
    idempotencyKey: 'client-request-1',
  });
  await assert.rejects(
    service.create('u1', {
      type: 'research',
      links: { documentId: 'd1' },
      idempotencyKey: 'client-request-1',
    }),
    (error) => error instanceof ConflictException,
  );
  await assert.rejects(
    service.create('u1', {
      type: 'learning',
      links: { documentId: 'd2' },
      idempotencyKey: 'client-request-1',
    }),
    (error) => error instanceof ConflictException,
  );
});

test('experience sessions: legacy Tutor wrappers are terminalized without promoting client JSON', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);

  const legacyTutor = await service.create('u1', {
    type: 'tutor',
    title: 'Untrusted legacy title',
    currentStep: {
      id: 'client-step',
      metadata: {
        injectedByLegacyClient: true,
        teacherPolicy: { marker: 'client-controlled' },
        teacherPolicySource: shared.TEACHER_POLICY_METADATA_SOURCE,
      },
    },
    links: { tutorSessionId: 't1' },
    idempotencyKey: 'tutor:t1',
  });
  const legacyLanguage = await service.create('u1', {
    type: 'learning',
    title: 'Second untrusted wrapper',
    currentStep: { id: 'legacy-language', metadata: { injectedLanguage: true } },
    idempotencyKey: 'language-conversation:t1',
  });
  const trustedPolicy = { source: 'trusted-domain-request', mode: 'practice' };
  const language = await service.ensureLanguageSession('u1', {
    title: 'French conversation',
    intent: 'practice-language',
    currentStep: {
      id: 'conversation',
      metadata: {
        language: 'French',
        teacherPolicy: trustedPolicy,
        teacherPolicySource: shared.TEACHER_POLICY_METADATA_SOURCE,
      },
    },
    links: { tutorSessionId: 't1', languageProfileId: 'lp1' },
  });

  assert.notEqual(language.id, legacyTutor.id);
  assert.notEqual(language.id, legacyLanguage.id);
  assert.equal(language.type, 'language');
  assert.equal(language.title, 'French conversation');
  assert.deepEqual(language.currentStep.metadata.teacherPolicy, trustedPolicy);
  assert.equal(language.currentStep.metadata.injectedByLegacyClient, undefined);
  assert.equal(language.currentStep.metadata.injectedLanguage, undefined);
  assert.equal(
    prisma.rows.find((row) => row.id === language.id).idempotencyKey,
    'server:v2:tutor:t1',
  );
  assert.equal(prisma.rows.find((row) => row.id === legacyTutor.id).status, 'abandoned');
  assert.equal(prisma.rows.find((row) => row.id === legacyLanguage.id).status, 'abandoned');
  assert.deepEqual(
    (await service.resumable('u1', 20)).items.map((item) => item.id),
    [language.id],
  );
});

test('experience sessions: Language promotes an incomplete Tutor wrapper with CAS and cannot be downgraded', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);
  const genericPolicy = { source: 'tutor', mode: 'guided' };
  const languagePolicy = { source: 'language', mode: 'practice' };

  const tutor = await service.ensureTutorSession('u1', {
    title: 'Generic Tutor',
    intent: 'learn',
    currentStep: {
      id: 'conversation',
      metadata: {
        teacherPolicy: genericPolicy,
        teacherPolicySource: shared.TEACHER_POLICY_METADATA_SOURCE,
      },
    },
    links: { tutorSessionId: 't1' },
  });
  const language = await service.ensureLanguageSession('u1', {
    title: 'French · At the station',
    intent: 'practice-language',
    inputModality: 'voice',
    activeContexts: [
      {
        id: 'language:lp1', kind: 'language', scope: 'experience-session',
        referenceId: 'lp1', priority: 90, visibility: 'visible',
        metadata: { level: 'B1' },
      },
      {
        id: 'course:course1', kind: 'learning-path', scope: 'experience-session',
        referenceId: 'course1', priority: 95, visibility: 'visible',
        metadata: { unitId: 'unit1' },
      },
    ],
    currentStep: {
      id: 'conversation',
      metadata: {
        language: 'French',
        courseSessionId: 'course1',
        unitId: 'unit1',
        teacherPolicy: languagePolicy,
        teacherPolicySource: shared.TEACHER_POLICY_METADATA_SOURCE,
      },
    },
    sourceReferences: [
      { kind: 'language-course', id: 'course1', title: 'French B1' },
      { kind: 'lesson', id: 'lesson1', title: 'At the station' },
    ],
    resumeTarget: { kind: 'route', path: '/tutor/t1' },
    links: {
      tutorSessionId: 't1',
      languageProfileId: 'lp1',
      lessonId: 'lesson1',
    },
  });

  assert.equal(language.id, tutor.id);
  assert.equal(language.version, tutor.version + 1);
  assert.equal(language.type, 'language');
  assert.equal(language.title, 'French · At the station');
  assert.equal(language.intent, 'practice-language');
  assert.equal(language.inputModality, 'voice');
  assert.equal(language.links.languageProfileId, 'lp1');
  assert.equal(language.links.lessonId, 'lesson1');
  assert.ok(language.activeContexts.items.some((item) => item.referenceId === 'course1'));
  assert.equal(language.currentStep.metadata.courseSessionId, 'course1');
  assert.deepEqual(language.currentStep.metadata.teacherPolicy, languagePolicy);
  assert.deepEqual(
    language.sourceReferences.map((item) => `${item.kind}:${item.id}`),
    ['language-course:course1', 'lesson:lesson1'],
  );

  const noDowngrade = await service.ensureTutorSession('u1', {
    title: 'A later generic Tutor title',
    intent: 'learn',
    currentStep: { id: 'generic', metadata: { teacherPolicy: genericPolicy } },
    links: { tutorSessionId: 't1' },
  });
  assert.equal(noDowngrade.type, 'language');
  assert.equal(noDowngrade.title, 'French · At the station');
  assert.deepEqual(noDowngrade.currentStep.metadata.teacherPolicy, languagePolicy);
  assert.equal(noDowngrade.version, language.version);
});

test('experience sessions: concurrent Tutor and Language ensures converge on one enriched wrapper', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);
  const [tutorResult, languageResult] = await Promise.all([
    service.ensureTutorSession('u1', {
      title: 'Tutor',
      currentStep: { id: 'conversation' },
      links: { tutorSessionId: 'race-t1' },
    }),
    service.ensureLanguageSession('u1', {
      title: 'Wolof conversation',
      intent: 'practice-language',
      currentStep: {
        id: 'conversation',
        metadata: { language: 'Wolof', courseSessionId: 'course-race' },
      },
      links: { tutorSessionId: 'race-t1', languageProfileId: 'lp-race' },
    }),
  ]);

  const canonical = await service.findByTutorSession('u1', 'race-t1');
  assert.ok(canonical);
  assert.equal(canonical.id, tutorResult.id);
  assert.equal(canonical.id, languageResult.id);
  assert.equal(canonical.type, 'language');
  assert.equal(canonical.links.languageProfileId, 'lp-race');
  assert.equal(canonical.currentStep.metadata.language, 'Wolof');
  assert.equal(
    prisma.rows.filter((row) => row.idempotencyKey === 'server:v2:tutor:race-t1').length,
    1,
  );
});

test('experience sessions: concurrent Language promotions retry CAS and retain both trusted enrichments', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);
  const tutor = await service.ensureTutorSession('u1', {
    title: 'Incomplete Tutor wrapper',
    currentStep: { id: 'conversation' },
    links: { tutorSessionId: 'cas-t1' },
  });

  await Promise.all([
    service.ensureLanguageSession('u1', {
      title: 'Lingala conversation',
      intent: 'practice-language',
      activeContexts: [{
        id: 'course:cas-course', kind: 'learning-path', scope: 'experience-session',
        referenceId: 'cas-course', priority: 90, visibility: 'visible',
      }],
      currentStep: {
        id: 'conversation',
        metadata: { language: 'Lingala', courseSessionId: 'cas-course' },
      },
      links: { tutorSessionId: 'cas-t1', languageProfileId: 'cas-profile' },
    }),
    service.ensureLanguageSession('u1', {
      title: 'Lingala conversation',
      intent: 'practice-language',
      activeContexts: [{
        id: 'lesson:cas-lesson', kind: 'lesson', scope: 'active-object',
        referenceId: 'cas-lesson', priority: 95, visibility: 'visible',
      }],
      currentStep: {
        id: 'conversation',
        metadata: { language: 'Lingala', lessonId: 'cas-lesson' },
      },
      links: {
        tutorSessionId: 'cas-t1',
        languageProfileId: 'cas-profile',
        lessonId: 'cas-lesson',
      },
    }),
  ]);

  const canonical = await service.findByTutorSession('u1', 'cas-t1');
  assert.ok(canonical);
  assert.equal(canonical.id, tutor.id);
  assert.equal(canonical.type, 'language');
  assert.equal(canonical.links.languageProfileId, 'cas-profile');
  assert.equal(canonical.links.lessonId, 'cas-lesson');
  assert.equal(canonical.currentStep.metadata.courseSessionId, 'cas-course');
  assert.equal(canonical.currentStep.metadata.lessonId, 'cas-lesson');
  assert.deepEqual(
    new Set(canonical.activeContexts.items.map((item) => item.referenceId)),
    new Set(['cas-course', 'cas-lesson']),
  );
  assert.ok(canonical.version >= tutor.version + 2);
});

test('experience sessions: updates and transitions use optimistic CAS', async () => {
  const prisma = inMemoryPrisma();
  const service = new ExperienceSessionService(prisma);
  const updateTarget = await service.create('u1', { type: 'learning' });

  const updates = await Promise.allSettled([
    service.updateState('u1', updateTarget.id, { progress: { completed: 1 } }),
    service.updateState('u1', updateTarget.id, { progress: { completed: 2 } }),
  ]);
  assert.equal(updates.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(updates.filter((result) =>
    result.status === 'rejected' && result.reason instanceof ConflictException,
  ).length, 1);

  const transitionTarget = await service.create('u1', { type: 'review' });
  const transitions = await Promise.allSettled([
    service.pause('u1', transitionTarget.id),
    service.complete('u1', transitionTarget.id),
  ]);
  assert.equal(transitions.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(transitions.filter((result) =>
    result.status === 'rejected' && result.reason instanceof ConflictException,
  ).length, 1);
});

test('NBA adapter: preserves evidence and returns null instead of inventing', () => {
  const adapter = new NextBestActionAdapter();
  const recommendation = {
    id: 'r1', kind: 'review', title: 'Review 3 items',
    reason: 'Three items are due now.', status: 'suggested',
    target: { kind: 'route', id: '/revision' },
    createdAt: '2026-09-05T10:00:00.000Z',
  };
  const nba = adapter.fromRecommendations(
    [recommendation],
    new Date('2026-09-06T10:00:00.000Z'),
  );
  assert.equal(nba.destination.path, '/revision');
  assert.equal(nba.reason, recommendation.reason);
  assert.equal(nba.signalsUsed[0].evidence, recommendation.reason);
  assert.equal(adapter.fromRecommendations([]), null);
  assert.equal(adapter.fromRecommendations([{ ...recommendation, target: null }]), null);
});

test('quota errors: known/unknown reset and non-AI access are explicit', () => {
  const known = shared.createQuotaError({
    quotaType: 'ai_questions', used: 10, limit: 10,
    resetAt: '2026-10-01T00:00:00.000Z', feature: 'ai_questions',
    availableFeatures: ['library.read', 'profile'], retryAfter: 100,
  });
  assert.equal(known.remaining, 0);
  assert.equal(known.resetAt, '2026-10-01T00:00:00.000Z');
  assert.ok(known.availableFeatures.includes('library.read'));
  const unknown = shared.createQuotaError({
    quotaType: 'documents', used: 10, limit: 10, feature: 'documents',
  });
  assert.equal(unknown.resetAt, null);
  assert.equal(unknown.retryAfter, null);
});

test('usage snapshot exposes real counter resets and no reset for live gauges', async () => {
  let entitlementReads = 0;
  const service = new UsageService({
    usageCounter: { findUnique: async () => ({ used: 7 }) },
    document: {
      count: async () => 2,
      aggregate: async () => ({ _sum: { charCount: 2048 } }),
    },
  }, {
    forUser: async () => {
      entitlementReads += 1;
      return {
        planSlug: 'free', status: 'active', features: {},
        quotas: { documents: 10, storage: 4096, ai_questions: 20, voice_minutes: -1 },
      };
    },
  });
  const usage = await service.usage('u1');
  assert.equal(entitlementReads, 1);
  assert.equal(usage.items.find((item) => item.key === 'documents').resetAt, null);
  assert.match(usage.items.find((item) => item.key === 'ai_questions').resetAt, /T00:00:00\.000Z$/);
  assert.equal(usage.items.find((item) => item.key === 'voice_minutes').limit, null);
});

test('research provider: disabled contract is deterministic and performs no network work', async () => {
  const provider = new DisabledResearchProvider();
  const availability = await provider.availability();
  assert.equal(availability.status, 'unavailable');
  assert.equal(availability.capabilities.webSearch, false);
  assert.equal(await provider.fetchSourceMetadata('https://example.test'), null);
  await assert.rejects(
    provider.search({ query: 'test', maxResults: 5 }),
    (error) => error instanceof ServiceUnavailableException,
  );
});

test('UX state and feature flags: no fake percentage and rollout defaults off', () => {
  assert.deepEqual(shared.determinateAIWorkProgress(2, 4), {
    mode: 'determinate', completed: 2, total: 4, percent: 50,
  });
  assert.throws(() => shared.determinateAIWorkProgress(1, 0));
  assert.ok(Object.values(shared.DISABLED_UX_FEATURE_FLAGS).every((value) => value === false));
  assert.equal(shared.resolveUXFeatureFlags({ newAppShell: 'TRUE' }).newAppShell, false);
  assert.equal(shared.resolveUXFeatureFlags({ newAppShell: 'true' }).newAppShell, true);
  assert.equal(shared.languageTag({ code: 'fr', region: 'ca' }), 'fr-CA');
});

function inMemoryPrisma() {
  const rows = [];
  let sequence = 0;
  const experienceSession = {
    findUnique: async ({ where }) => {
      if (where.id) {
        const row = rows.find((candidate) => candidate.id === where.id);
        return row ? { ...row } : null;
      }
      const key = where.userId_idempotencyKey;
      const row = rows.find((candidate) =>
        candidate.userId === key.userId && candidate.idempotencyKey === key.idempotencyKey,
      );
      return row ? { ...row } : null;
    },
    findFirst: async ({ where }) => {
      const row = rows.find((candidate) =>
        (!where.id || candidate.id === where.id) &&
        (!where.userId || candidate.userId === where.userId),
      );
      return row ? { ...row } : null;
    },
    create: async ({ data }) => {
      if (data.idempotencyKey && rows.some((candidate) =>
        candidate.userId === data.userId && candidate.idempotencyKey === data.idempotencyKey,
      )) {
        // The real database reports P2002. For this behavioral harness the
        // service-level conflict is enough to exercise the reload/CAS path.
        throw new ConflictException('unique idempotency key');
      }
      const now = new Date(`2026-09-05T10:00:0${sequence}.000Z`);
      const row = {
        id: `xs${++sequence}`, status: 'active', version: 1,
        startedAt: now, updatedAt: now, pausedAt: null, completedAt: null,
        title: null, intent: null, inputModality: null, currentStep: null,
        progress: null, twinImpact: null, resumeTarget: null, nextBestAction: null,
        tutorSessionId: null, studySessionId: null, documentId: null, lessonId: null,
        goalId: null, languageProfileId: null, workspaceRef: null,
        ...data,
      };
      rows.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error('missing row');
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && Object.hasOwn(value, 'increment')) {
          row[key] += value.increment;
        } else {
          row[key] = value;
        }
      }
      row.updatedAt = new Date(row.updatedAt.getTime() + 1000);
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      const row = rows.find((candidate) =>
        (!where.id || candidate.id === where.id) &&
        (!where.userId || candidate.userId === where.userId) &&
        (where.version === undefined || candidate.version === where.version) &&
        (where.status === undefined || candidate.status === where.status),
      );
      if (!row) return { count: 0 };
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'object' && Object.hasOwn(value, 'increment')) {
          row[key] += value.increment;
        } else {
          row[key] = value;
        }
      }
      row.updatedAt = new Date(row.updatedAt.getTime() + 1000);
      return { count: 1 };
    },
    findMany: async ({ where, take, cursor, skip }) => {
      let found = rows.filter((row) => row.userId === where.userId);
      if (where.status?.in) found = found.filter((row) => where.status.in.includes(row.status));
      found.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
      if (cursor) found = found.slice(found.findIndex((row) => row.id === cursor.id) + (skip ?? 0));
      return found.slice(0, take);
    },
  };
  const ownedDelegate = {
    findFirst: async () => ({ id: 'owned' }),
    count: async () => 1,
  };
  const prisma = {
    rows,
    experienceSession,
    tutorSession: ownedDelegate,
    studySession: ownedDelegate,
    document: ownedDelegate,
    lesson: ownedDelegate,
    goal: ownedDelegate,
    languageProfile: ownedDelegate,
    async $executeRaw() { return 1; },
  };
  prisma.$transaction = async (operation) => operation(prisma);
  return prisma;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function expoRoute(appRoot, file) {
  let relative = path.relative(appRoot, file).replaceAll('\\', '/').replace(/\.tsx$/, '');
  relative = relative.replace(/^\(tabs\)\//, '');
  relative = relative.replace(/(^|\/)index$/, '');
  return `/${relative}`.replace(/\/$/, '') || '/';
}
