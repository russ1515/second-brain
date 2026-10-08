'use strict';

require('reflect-metadata');

const assert = require('node:assert/strict');
const test = require('node:test');

const { GoalsService } = require('../dist/goals/goals.service.js');
const {
  LearningDataDeletionService,
} = require('../dist/experience-sessions/learning-data-deletion.service.js');

const NOW = new Date('2026-10-08T10:00:00.000Z');

function goalView(id, links, overrides = {}) {
  return {
    id,
    userId: 'user-a',
    period: 'weekly',
    title: `Goal ${id}`,
    status: 'pending',
    createdAt: NOW,
    completedAt: null,
    ...overrides,
    learningLinks: links,
  };
}

function session(id, overrides = {}) {
  return {
    id,
    userId: 'user-a',
    title: `Session ${id}`,
    type: 'learning',
    status: 'active',
    goalId: null,
    ...overrides,
  };
}

function linkedSession(link, value) {
  return {
    ...link,
    experienceSession: {
      id: value.id,
      title: value.title,
      type: value.type,
      status: value.status,
    },
  };
}

test('goals list asks for linked learning only and does not expose legacy orphans', async () => {
  let query = null;
  const owned = session('session-a');
  const prisma = {
    goal: {
      async findMany(args) {
        query = args;
        // Prisma applies the relation predicate before returning this payload;
        // the legacy orphan deliberately stays outside the result.
        return [goalView('goal-linked', [linkedSession({ isPrimary: true }, owned)])];
      },
    },
  };
  const service = new GoalsService(prisma, {});

  const result = await service.list('user-a');

  assert.deepEqual(query.where, {
    userId: 'user-a',
    learningLinks: { some: { userId: 'user-a' } },
  });
  assert.deepEqual(result.map((goal) => goal.id), ['goal-linked']);
  assert.deepEqual(result[0].learningLinks, [{
    experienceSessionId: 'session-a',
    learningTitle: 'Session session-a',
    learningType: 'learning',
    learningStatus: 'active',
    isPrimary: true,
  }]);
});

test('goal creation requires an owned active learning or language session and links the first goal as primary', async () => {
  const sessions = new Map([
    ['learning-a', session('learning-a')],
    ['language-a', session('language-a', { type: 'language' })],
    ['foreign', session('foreign', { userId: 'user-b' })],
    ['failed', session('failed', { status: 'failed' })],
    ['review', session('review', { type: 'review' })],
  ]);
  const goals = [];
  const links = [];
  const sessionUpdates = [];
  const tx = {
    experienceSession: {
      async findFirst({ where }) {
        const value = sessions.get(where.id);
        return value && value.userId === where.userId &&
          where.type.in.includes(value.type) && !where.status.notIn.includes(value.status)
          ? { id: value.id }
          : null;
      },
      async update(args) {
        sessionUpdates.push(args);
        const value = sessions.get(args.where.id);
        value.goalId = args.data.goalId;
        return value;
      },
    },
    learningGoalLink: {
      async findFirst({ where }) {
        return links.find((link) => link.userId === where.userId &&
          link.experienceSessionId === where.experienceSessionId && link.isPrimary === where.isPrimary) ?? null;
      },
      async create({ data }) {
        const value = { id: `link-${links.length + 1}`, createdAt: NOW, ...data };
        links.push(value);
        return value;
      },
    },
    goal: {
      async create({ data }) {
        const value = goalView(`goal-${goals.length + 1}`, [], { ...data });
        goals.push(value);
        return value;
      },
      async findUniqueOrThrow({ where }) {
        const value = goals.find((goal) => goal.id === where.id);
        return goalView(value.id, links
          .filter((link) => link.goalId === value.id)
          .map((link) => linkedSession(link, sessions.get(link.experienceSessionId))), value);
      },
    },
  };
  const prisma = { async $transaction(fn) { return fn(tx); } };
  const service = new GoalsService(prisma, {});

  for (const experienceSessionId of ['missing', 'foreign', 'failed', 'review']) {
    await assert.rejects(
      () => service.create('user-a', { title: 'Rejected', period: 'weekly', experienceSessionId }),
      /started learning journey/i,
    );
  }

  const first = await service.create('user-a', {
    title: '  Master algebra  ', period: 'weekly', experienceSessionId: 'learning-a',
  });
  const second = await service.create('user-a', {
    title: 'Practice proofs', period: 'daily', experienceSessionId: 'learning-a',
  });
  const language = await service.create('user-a', {
    title: 'Speak every day', period: 'monthly', experienceSessionId: 'language-a',
  });

  assert.equal(first.title, 'Master algebra');
  assert.equal(first.learningLinks[0].isPrimary, true);
  assert.equal(second.learningLinks[0].isPrimary, false);
  assert.equal(language.learningLinks[0].learningType, 'language');
  assert.equal(language.learningLinks[0].isPrimary, true);
  assert.deepEqual(sessionUpdates.map((entry) => entry.where.id), ['learning-a', 'language-a']);
});

test('goal update and primary selection remain ownership-scoped and synchronized with the learning session', async () => {
  const ownedSession = session('session-a', { goalId: 'goal-1' });
  const goals = [
    goalView('goal-1', []),
    goalView('goal-2', [], { title: 'Old title' }),
  ];
  const links = [
    { id: 'link-1', userId: 'user-a', experienceSessionId: 'session-a', goalId: 'goal-1', isPrimary: true, createdAt: NOW },
    { id: 'link-2', userId: 'user-a', experienceSessionId: 'session-a', goalId: 'goal-2', isPrimary: false, createdAt: NOW },
  ];
  const asPayload = (value) => goalView(value.id, links
    .filter((link) => link.goalId === value.id)
    .map((link) => linkedSession(link, ownedSession)), value);
  const tx = {
    learningGoalLink: {
      async findFirst({ where }) {
        return links.find((link) => link.userId === where.userId && link.goalId === where.goalId &&
          link.experienceSessionId === where.experienceSessionId) ?? null;
      },
      async updateMany({ where, data }) {
        for (const link of links) {
          if (link.userId === where.userId && link.experienceSessionId === where.experienceSessionId && link.isPrimary) {
            Object.assign(link, data);
          }
        }
      },
      async update({ where, data }) {
        Object.assign(links.find((link) => link.id === where.id), data);
      },
    },
    experienceSession: {
      async update({ where, data }) {
        assert.equal(where.id, 'session-a');
        ownedSession.goalId = data.goalId;
      },
    },
    goal: {
      async findUniqueOrThrow({ where }) {
        return asPayload(goals.find((goal) => goal.id === where.id));
      },
    },
  };
  const deletionCalls = [];
  const prisma = {
    goal: {
      async findUnique({ where }) { return goals.find((goal) => goal.id === where.id) ?? null; },
      async update({ where, data }) {
        const value = goals.find((goal) => goal.id === where.id);
        Object.assign(value, data);
        return asPayload(value);
      },
    },
    async $transaction(fn) { return fn(tx); },
  };
  const service = new GoalsService(prisma, {
    async deleteGoal(userId, id) { deletionCalls.push([userId, id]); },
  });

  const updated = await service.update('user-a', 'goal-2', { title: '  New title  ', period: 'monthly' });
  assert.equal(updated.title, 'New title');
  assert.equal(updated.period, 'monthly');
  await assert.rejects(() => service.update('user-b', 'goal-2', { title: 'No' }), /not found/i);

  const selected = await service.setPrimary('user-a', 'goal-2', { experienceSessionId: 'session-a' });
  assert.equal(selected.learningLinks[0].isPrimary, true);
  assert.equal(links.filter((link) => link.isPrimary).length, 1);
  assert.equal(ownedSession.goalId, 'goal-2');

  await service.remove('user-a', 'goal-1');
  assert.deepEqual(deletionCalls, [['user-a', 'goal-1']]);
});

test('deleting a non-primary goal preserves exactly one existing primary link', async () => {
  const goals = new Map([
    ['goal-old', { id: 'goal-old', userId: 'user-a', title: 'Old' }],
    ['goal-primary', { id: 'goal-primary', userId: 'user-a', title: 'Primary' }],
    ['goal-delete', { id: 'goal-delete', userId: 'user-a', title: 'Delete' }],
  ]);
  const links = [
    { id: 'link-old', userId: 'user-a', experienceSessionId: 'session-a', goalId: 'goal-old', isPrimary: false, createdAt: new Date('2026-10-01') },
    { id: 'link-primary', userId: 'user-a', experienceSessionId: 'session-a', goalId: 'goal-primary', isPrimary: true, createdAt: new Date('2026-10-02') },
    { id: 'link-delete', userId: 'user-a', experienceSessionId: 'session-a', goalId: 'goal-delete', isPrimary: false, createdAt: new Date('2026-10-03') },
  ];
  const sessionState = { goalId: 'goal-primary' };
  const prisma = {
    goal: {
      async findFirst({ where }) {
        const value = goals.get(where.id);
        return value?.userId === where.userId ? value : null;
      },
      async deleteMany({ where }) {
        goals.delete(where.id);
        for (let index = links.length - 1; index >= 0; index -= 1) {
          if (links[index].goalId === where.id) links.splice(index, 1);
        }
        return { count: 1 };
      },
    },
    recommendation: {
      async count() { return 0; },
      async deleteMany() { return { count: 0 }; },
    },
    learningGoalLink: {
      async findMany({ where }) {
        return links.filter((link) => link.userId === where.userId && link.goalId === where.goalId)
          .map(({ experienceSessionId }) => ({ experienceSessionId }));
      },
      async findFirst({ where, orderBy }) {
        const candidates = links.filter((link) => link.userId === where.userId &&
          link.experienceSessionId === where.experienceSessionId &&
          (where.isPrimary === undefined || link.isPrimary === where.isPrimary));
        if (orderBy?.createdAt === 'asc') candidates.sort((a, b) => a.createdAt - b.createdAt);
        return candidates[0] ?? null;
      },
      async updateMany({ where, data }) {
        for (const link of links) {
          if (link.userId === where.userId && link.experienceSessionId === where.experienceSessionId &&
            (where.isPrimary === undefined || link.isPrimary === where.isPrimary)) Object.assign(link, data);
        }
        return { count: 1 };
      },
      async update({ where, data }) {
        Object.assign(links.find((link) => link.id === where.id), data);
      },
    },
    experienceSession: {
      async updateMany({ where, data }) {
        if (where.id === 'session-a' || where.goalId === 'goal-delete') sessionState.goalId = data.goalId;
        return { count: 1 };
      },
    },
    async $executeRaw() { return 1; },
    async $transaction(fn) { return fn(prisma); },
  };
  const service = new LearningDataDeletionService(
    prisma,
    {},
    { async invalidate() {}, async invalidatePrefix() {} },
  );

  await service.deleteGoal('user-a', 'goal-delete');

  assert.equal(links.filter((link) => link.isPrimary).length, 1);
  assert.equal(links.find((link) => link.isPrimary).goalId, 'goal-primary');
  assert.equal(sessionState.goalId, 'goal-primary');
});
