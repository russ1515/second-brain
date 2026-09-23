'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  BadRequestException,
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
      if (where.id) return rows.find((row) => row.id === where.id) ?? null;
      const key = where.userId_idempotencyKey;
      return rows.find((row) => row.userId === key.userId && row.idempotencyKey === key.idempotencyKey) ?? null;
    },
    findFirst: async ({ where }) => rows.find((row) =>
      (!where.id || row.id === where.id) && (!where.userId || row.userId === where.userId),
    ) ?? null,
    create: async ({ data }) => {
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
      return row;
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
      return row;
    },
    findMany: async ({ where, take, cursor, skip }) => {
      let found = rows.filter((row) => row.userId === where.userId);
      if (where.status?.in) found = found.filter((row) => where.status.in.includes(row.status));
      found.sort((a, b) => b.updatedAt - a.updatedAt || b.id.localeCompare(a.id));
      if (cursor) found = found.slice(found.findIndex((row) => row.id === cursor.id) + (skip ?? 0));
      return found.slice(0, take);
    },
  };
  const ownedDelegate = { findFirst: async () => ({ id: 'owned' }) };
  return {
    rows,
    experienceSession,
    tutorSession: ownedDelegate,
    studySession: ownedDelegate,
    document: ownedDelegate,
    lesson: ownedDelegate,
    goal: ownedDelegate,
    languageProfile: ownedDelegate,
  };
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
