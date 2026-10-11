'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');

const { LanguageService } = require('../dist/languages/language.service.js');

function deletionFixture({ sharedDeck = false } = {}) {
  const userId = 'owner-1';
  const profileId = 'language/profile 1';
  const deckId = 'deck-1';
  const calls = [];
  const reviewables = [
    { id: 'legacy-owned', userId, kind: 'language', refId: `${profileId}:unit-a1` },
    {
      id: 'canonical-owned',
      userId,
      kind: 'language',
      refId: `language-mastery:${encodeURIComponent(profileId)}:milestone:a1`,
    },
    {
      id: 'other-profile',
      userId,
      kind: 'language',
      refId: 'language-mastery:language-2:milestone:a1',
    },
    {
      id: 'other-owner',
      userId: 'owner-2',
      kind: 'language',
      refId: `language-mastery:${encodeURIComponent(profileId)}:milestone:a1`,
    },
    {
      id: 'other-kind',
      userId,
      kind: 'lesson',
      refId: `${profileId}:unit-a1`,
    },
  ];

  const tx = {
    $executeRaw: async () => {
      calls.push(['lock']);
      return 1;
    },
    languageProfile: {
      findFirst: async (args) => {
        calls.push(['profile-final-check', args]);
        return { id: profileId, vocabDeckId: deckId };
      },
      delete: async (args) => {
        calls.push(['profile-delete', args]);
        return { id: profileId };
      },
      count: async (args) => {
        calls.push(['profile-deck-count', args]);
        return sharedDeck ? 1 : 0;
      },
    },
    lesson: {
      count: async (args) => {
        calls.push(['lesson-final-count', args]);
        return 0;
      },
    },
    tutorSession: {
      count: async (args) => {
        calls.push(['tutor-final-count', args]);
        return 0;
      },
    },
    experienceSession: {
      count: async (args) => {
        calls.push(['experience-final-count', args]);
        return 0;
      },
    },
    learningCompletion: {
      deleteMany: async (args) => {
        calls.push(['completion-delete', args]);
        return { count: 1 };
      },
    },
    reviewable: {
      deleteMany: async (args) => {
        calls.push(['reviewable-delete', args]);
        const prefixes = args.where.OR.map(({ refId }) => refId.startsWith);
        const retained = reviewables.filter((row) => !(
          row.userId === args.where.userId
          && row.kind === args.where.kind
          && prefixes.some((prefix) => row.refId.startsWith(prefix))
        ));
        reviewables.splice(0, reviewables.length, ...retained);
        return { count: 2 };
      },
    },
    dailyPlanItem: {
      deleteMany: async (args) => {
        calls.push(['daily-plan-delete', args]);
        return { count: 1 };
      },
    },
    studyResource: {
      count: async (args) => {
        calls.push(['resource-deck-count', args]);
        return 0;
      },
    },
    deck: {
      deleteMany: async (args) => {
        calls.push(['deck-delete', args]);
        return { count: 1 };
      },
    },
  };

  const prisma = {
    languageProfile: {
      findUnique: async ({ where }) => {
        assert.deepEqual(where, { id: profileId });
        return { id: profileId, userId, vocabDeckId: deckId };
      },
    },
    lesson: {
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { userId, languageProfileId: profileId },
          select: { id: true },
        });
        return [{ id: 'lesson-1' }];
      },
    },
    tutorSession: {
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { userId, languageProfileId: profileId },
          select: { id: true },
        });
        return [{ id: 'tutor-1' }];
      },
    },
    experienceSession: {
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { userId, languageProfileId: profileId },
          select: { id: true },
        });
        return [{ id: 'experience-1' }];
      },
    },
    $transaction: async (operation) => operation(tx),
  };

  const learningDeletions = {
    deleteLesson: async (...args) => calls.push(['lesson-purge', ...args]),
    deleteTutorSession: async (...args) => calls.push(['tutor-purge', ...args]),
    deleteSession: async (...args) => calls.push(['experience-purge', ...args]),
  };
  const masteryAttempts = {
    purgeOwned: async (...args) => {
      calls.push(['mastery-purge', ...args]);
      return { attempts: 1, completions: 0 };
    },
  };

  return {
    userId,
    profileId,
    deckId,
    calls,
    reviewables,
    service: new LanguageService(prisma, learningDeletions, masteryAttempts),
  };
}

test('language deletion delegates linked learning purges, deletes the profile and its exclusive deck', async () => {
  const fixture = deletionFixture();

  await fixture.service.remove(fixture.userId, fixture.profileId);

  assert.deepEqual(fixture.calls.slice(0, 3), [
    ['lesson-purge', fixture.userId, 'lesson-1'],
    ['tutor-purge', fixture.userId, 'tutor-1'],
    ['experience-purge', fixture.userId, 'experience-1'],
  ]);
  assert.ok(fixture.calls.some((event) => event[0] === 'mastery-purge'
    && event[1] === fixture.userId && event[2] === fixture.profileId));
  assert.ok(fixture.calls.some(([event]) => event === 'profile-delete'));
  assert.deepEqual(
    fixture.calls.find(([event]) => event === 'reviewable-delete'),
    ['reviewable-delete', {
      where: {
        userId: fixture.userId,
        kind: 'language',
        OR: [
          { refId: { startsWith: `${fixture.profileId}:` } },
          {
            refId: {
              startsWith: `language-mastery:${encodeURIComponent(fixture.profileId)}:`,
            },
          },
        ],
      },
    }],
  );
  assert.deepEqual(
    fixture.reviewables.map(({ id }) => id),
    ['other-profile', 'other-owner', 'other-kind'],
    'both owned profile prefixes must be purged without deleting legitimate reviewables',
  );
  assert.deepEqual(
    fixture.calls.find(([event]) => event === 'deck-delete'),
    ['deck-delete', { where: { id: fixture.deckId, userId: fixture.userId } }],
  );
});

test('language deletion preserves a vocabulary deck still shared by another profile', async () => {
  const fixture = deletionFixture({ sharedDeck: true });

  await fixture.service.remove(fixture.userId, fixture.profileId);

  assert.ok(fixture.calls.some(([event]) => event === 'profile-delete'));
  assert.equal(fixture.calls.some(([event]) => event === 'deck-delete'), false);
});
