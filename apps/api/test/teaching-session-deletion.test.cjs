'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');

const { TutorService } = require('../dist/tutor/tutor.service.js');
const { LessonService } = require('../dist/lessons/lesson.service.js');

function deletionFixture(modelName, linkKey, targetId, ownerExists = true) {
  const ownerId = 'owner-1';
  const events = [];
  const experiences = [
    {
      id: 'linked-active',
      userId: ownerId,
      [linkKey]: targetId,
      status: 'active',
      pausedAt: null,
      resumeTarget: { kind: 'route', path: '/dead-route' },
      nextBestAction: { action: 'resume' },
      version: 2,
    },
    {
      id: 'linked-paused',
      userId: ownerId,
      [linkKey]: targetId,
      status: 'paused',
      pausedAt: new Date('2026-01-01T00:00:00.000Z'),
      resumeTarget: { kind: 'route', path: '/dead-route' },
      nextBestAction: { action: 'resume' },
      version: 4,
    },
    {
      id: 'linked-completed',
      userId: ownerId,
      [linkKey]: targetId,
      status: 'completed',
      resumeTarget: { kind: 'route', path: '/history-only' },
      nextBestAction: null,
      version: 6,
    },
    {
      id: 'another-owner',
      userId: 'owner-2',
      [linkKey]: targetId,
      status: 'active',
      resumeTarget: { kind: 'route', path: '/still-valid-for-owner-2' },
      nextBestAction: { action: 'resume' },
      version: 8,
    },
    {
      id: 'another-link',
      userId: ownerId,
      [linkKey]: 'another-target',
      status: 'active',
      resumeTarget: { kind: 'route', path: '/still-valid' },
      nextBestAction: { action: 'resume' },
      version: 10,
    },
  ];

  const domain = {
    findFirst: async (args) => {
      events.push('owner-check');
      assert.deepEqual(args, {
        where: { id: targetId, userId: ownerId },
        select: { id: true },
      });
      return ownerExists ? { id: targetId } : null;
    },
    delete: async (args) => {
      events.push('domain-delete');
      assert.deepEqual(args, { where: { id: targetId } });
      return { id: targetId };
    },
  };

  const tx = {
    [modelName]: domain,
    experienceSession: {
      updateMany: async ({ where, data }) => {
        events.push('experience-terminalize');
        assert.deepEqual(where, {
          userId: ownerId,
          [linkKey]: targetId,
          status: { in: ['active', 'paused'] },
        });
        let count = 0;
        for (const row of experiences) {
          if (
            row.userId === where.userId &&
            row[linkKey] === where[linkKey] &&
            where.status.in.includes(row.status)
          ) {
            row.status = data.status;
            row.pausedAt = data.pausedAt;
            row.resumeTarget = data.resumeTarget;
            row.nextBestAction = data.nextBestAction;
            row.version += data.version.increment;
            count += 1;
          }
        }
        return { count };
      },
    },
  };

  return {
    ownerId,
    events,
    experiences,
    prisma: {
      $transaction: async (operation) => {
        events.push('transaction-start');
        try {
          const result = await operation(tx);
          events.push('transaction-commit');
          return result;
        } catch (error) {
          events.push('transaction-rollback');
          throw error;
        }
      },
    },
  };
}

function assertOnlyResumableLinkedRowsWereTerminalized(fixture) {
  const active = fixture.experiences.find((row) => row.id === 'linked-active');
  const paused = fixture.experiences.find((row) => row.id === 'linked-paused');
  assert.equal(active.status, 'abandoned');
  assert.equal(active.resumeTarget, Prisma.JsonNull);
  assert.equal(active.nextBestAction, Prisma.JsonNull);
  assert.equal(active.pausedAt, null);
  assert.equal(active.version, 3);
  assert.equal(paused.status, 'abandoned');
  assert.equal(paused.resumeTarget, Prisma.JsonNull);
  assert.equal(paused.nextBestAction, Prisma.JsonNull);
  assert.equal(paused.pausedAt, null);
  assert.equal(paused.version, 5);

  assert.deepEqual(
    fixture.experiences
      .filter((row) => !['linked-active', 'linked-paused'].includes(row.id))
      .map((row) => [row.id, row.status, row.version]),
    [
      ['linked-completed', 'completed', 6],
      ['another-owner', 'active', 8],
      ['another-link', 'active', 10],
    ],
  );
  assert.deepEqual(fixture.events, [
    'transaction-start',
    'owner-check',
    'experience-terminalize',
    'domain-delete',
    'transaction-commit',
  ]);
}

test('Tutor deletion delegates to the canonical permanent learning purge', async () => {
  const calls = [];
  const service = new TutorService({}, {}, {}, {}, {}, {}, {}, {}, {
    async deleteTutorSession(userId, id) {
      calls.push([userId, id]);
      return { deleted: true, alreadyDeleted: false, preview: null };
    },
  });

  await service.deleteSession('owner-1', 'tutor-1');

  assert.deepEqual(calls, [['owner-1', 'tutor-1']]);
});

test('Lesson deletion delegates to the canonical permanent learning purge', async () => {
  const calls = [];
  const service = new LessonService({}, {}, {}, {}, {}, {}, {}, {
    async deleteLesson(userId, id) {
      calls.push([userId, id]);
      return { deleted: true, alreadyDeleted: false, preview: null };
    },
  }, {}, {});

  await service.remove('owner-1', 'lesson-1');

  assert.deepEqual(calls, [['owner-1', 'lesson-1']]);
});

test('a missing or foreign TutorSession remains indistinguishable through the canonical purge', async () => {
  const service = new TutorService({}, {}, {}, {}, {}, {}, {}, {}, {
    async deleteTutorSession() {
      return { deleted: false, alreadyDeleted: true, preview: null };
    },
  });

  await assert.rejects(
    () => service.deleteSession('owner-1', 'tutor-1'),
    { name: 'NotFoundException', message: 'Tutor session not found.' },
  );
});
