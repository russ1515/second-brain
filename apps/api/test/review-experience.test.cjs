'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ReviewExperienceService } = require('../dist/flashcards/review-experience.service.js');
const { FsrsEngine } = require('../dist/revision/fsrs-engine.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function emptyFixture(overrides = {}) {
  const prisma = {
    card: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
    reviewable: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
    exam: { findFirst: async () => null },
    concept: { findFirst: async () => null, findMany: async () => [] },
    document: { findFirst: async () => null },
    goal: { findFirst: async () => null },
    experienceSession: { findFirst: async () => null },
    reviewLog: { findFirst: async () => null },
    ...overrides.prisma,
  };
  const cardSessions = {
    stats: async () => ({ due: 0, new: 0, learning: 0, review: 0, relearning: 0, reviewsToday: 0, retention: null }),
    queue: async () => ({ cards: [], newRemaining: 20, reviewRemaining: 200 }),
    ...overrides.cardSessions,
  };
  const cardReviews = { review: async () => { throw new Error('not expected'); }, ...overrides.cardReviews };
  const revision = { due: async () => [], review: async () => { throw new Error('not expected'); }, ...overrides.revision };
  const fsrs = { signals: () => ({ retrievability: 0, forgettingProbability: 1, memoryScore: 0, nextReview: new Date().toISOString(), priority: 'medium', urgency: 'new' }), ...overrides.fsrs };
  const experiences = {
    resumable: async () => ({ items: [], nextCursor: null }),
    get: async () => { throw new Error('not expected'); },
    create: async () => { throw new Error('not expected'); },
    updateState: async () => { throw new Error('not expected'); },
    resume: async () => { throw new Error('not expected'); },
    complete: async () => { throw new Error('not expected'); },
    ...overrides.experiences,
  };
  return { service: new ReviewExperienceService(prisma, cardSessions, cardReviews, revision, fsrs, experiences), prisma, cardSessions };
}

test('review home is honestly caught up when both existing engines have nothing due', async () => {
  const { service } = emptyFixture();
  const home = await service.home('user-1', {});
  assert.equal(home.dueCount, 0);
  assert.equal(home.priorityItems.length, 0);
  assert.equal(home.plan.nextDueAt, null);
  assert.equal(home.resumableSession, null);
});

test('target concept stays owner-scoped and reaches the bounded card queue', async () => {
  let conceptWhere;
  let queueOptions;
  const { service } = emptyFixture({
    prisma: {
      card: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      reviewable: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      exam: { findFirst: async () => null },
      concept: { findFirst: async (args) => { conceptWhere = args.where; return { id: 'concept-1', name: 'SQL indexes' }; }, findMany: async () => [] },
      document: { findFirst: async () => null }, goal: { findFirst: async () => null }, experienceSession: { findFirst: async () => null },
    },
    cardSessions: { queue: async (_userId, options) => { queueOptions = options; return { cards: [], newRemaining: 20, reviewRemaining: 200 }; } },
  });
  const home = await service.home('owner-1', { conceptId: 'concept-1' });
  assert.equal(conceptWhere.userId, 'owner-1');
  assert.equal(queueOptions.conceptId, 'concept-1');
  assert.equal(queueOptions.limit, 50);
  assert.equal(home.context.concept.name, 'SQL indexes');
});

test('due and overdue explanations come from persisted dates, never invented risk', async () => {
  const now = new Date();
  const due = new Date(now.getTime() - 3 * 86_400_000);
  const card = { id: 'card-1', userId: 'user-1', deckId: 'deck-1', front: 'What is an index?', back: 'A lookup structure', sourceDocumentId: null, state: 'review', stability: 2, difficulty: 5, due, elapsedDays: 3, scheduledDays: 2, reps: 2, lapses: 0, lastReview: due, createdAt: due, updatedAt: due, deck: { name: 'SQL' }, sourceDocument: null, concepts: [] };
  const { service } = emptyFixture({
    prisma: {
      card: { count: async (args) => args.where.due.lte ? 1 : args.where.due.lt ? 1 : 0, findFirst: async () => null, findMany: async () => [card] },
      reviewable: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      exam: { findFirst: async () => null }, concept: { findFirst: async () => null, findMany: async () => [] }, document: { findFirst: async () => null }, goal: { findFirst: async () => null }, experienceSession: { findFirst: async () => null }, reviewLog: { findFirst: async () => null },
    },
    cardSessions: {
      stats: async () => ({ due: 1, new: 0, learning: 0, review: 1, relearning: 0, reviewsToday: 0, retention: null }),
      queue: async () => ({ cards: [{ id: 'card-1' }], newRemaining: 20, reviewRemaining: 200 }),
    },
    fsrs: { signals: () => ({ retrievability: 0.4, forgettingProbability: 0.6, memoryScore: 40, nextReview: due.toISOString(), priority: 'urgent', urgency: 'overdue' }) },
  });
  const home = await service.home('user-1', {});
  assert.equal(home.dueCount, 1);
  assert.equal(home.overdueCount, 1);
  assert.equal(home.priorityItems[0].priority, 'urgent');
  assert.ok(home.priorityItems[0].reasons.some((reason) => reason.code === 'overdue' && reason.value >= 2));
});

test('exam and goal contexts are resolved for the owner and only a linked exam concept affects selection', async () => {
  let queueOptions;
  const examDate = new Date(Date.now() + 4 * 86_400_000);
  const { service } = emptyFixture({
    prisma: {
      card: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      reviewable: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      exam: { findFirst: async (args) => args.where.id ? { id: 'exam-1', subject: 'Networks', date: examDate, conceptId: 'concept-network' } : null },
      concept: { findFirst: async () => null, findMany: async () => [] }, document: { findFirst: async () => null },
      goal: { findFirst: async () => ({ id: 'goal-1', title: 'Pass networks' }) }, experienceSession: { findFirst: async () => null }, reviewLog: { findFirst: async () => null },
    },
    cardSessions: { queue: async (_userId, options) => { queueOptions = options; return { cards: [], newRemaining: 20, reviewRemaining: 200 }; } },
  });
  const home = await service.home('owner-1', { examId: 'exam-1', goalId: 'goal-1' });
  assert.equal(home.context.exam.subject, 'Networks');
  assert.equal(home.context.goal.title, 'Pass networks');
  assert.equal(queueOptions.conceptId, 'concept-network');
});

test('a session rating advances only after the card review is persisted', async () => {
  const now = new Date('2026-09-10T10:00:00.000Z');
  const due = new Date('2026-09-12T10:00:00.000Z');
  const session = {
    id: 'session-1', userId: 'owner-1', version: 1, type: 'review', status: 'active', title: 'Review', intent: 'memory-consolidation', inputModality: 'text',
    activeContexts: { version: 1, ownerUserId: 'owner-1', capturedAt: now.toISOString(), items: [] }, currentStep: { id: 'flashcard:card-1', index: 0, state: 'active' },
    progress: { completed: 0, total: 1, percent: 0 }, productions: [], sourceReferences: [{ kind: 'review-item', id: 'flashcard:card-1', title: 'Deck' }], twinImpact: null,
    resumeTarget: null, nextBestAction: null, links: { tutorSessionId: null, studySessionId: null, documentId: null, lessonId: null, goalId: null, languageProfileId: null, workspaceRef: null },
    startedAt: now.toISOString(), updatedAt: now.toISOString(), pausedAt: null, completedAt: null,
  };
  let reviewedOwner;
  let current = session;
  const { service } = emptyFixture({
    prisma: {
      card: { count: async () => 0, findFirst: async () => null, findMany: async () => [{ id: 'card-1', userId: 'owner-1', deckId: 'deck-1', front: 'Question', back: 'Answer', sourceDocumentId: null, state: 'review', stability: 2, difficulty: 5, due, elapsedDays: 1, scheduledDays: 2, reps: 2, lapses: 0, lastReview: now, createdAt: now, updatedAt: now, deck: { name: 'Deck' }, sourceDocument: null, concepts: [] }] },
      reviewable: { count: async () => 0, findFirst: async () => null, findMany: async () => [] },
      exam: { findFirst: async () => null }, concept: { findFirst: async () => null, findMany: async () => [] }, document: { findFirst: async () => null }, goal: { findFirst: async () => null }, experienceSession: { findFirst: async () => null },
    },
    cardReviews: { review: async (userId) => { reviewedOwner = userId; return { card: { due: due.toISOString() }, scheduledDays: 2 }; } },
    experiences: {
      get: async () => current,
      updateState: async (_userId, _id, update) => { current = { ...current, ...update, progress: { ...update.progress, percent: 100 }, version: 2 }; return current; },
      complete: async () => { current = { ...current, status: 'completed', completedAt: now.toISOString() }; return current; },
    },
  });
  const result = await service.grade('owner-1', 'session-1', { itemReference: 'flashcard:card-1', rating: 2 });
  assert.equal(reviewedOwner, 'owner-1');
  assert.equal(result.persisted, true);
  assert.equal(result.feedback, 'still-fragile');
  assert.equal(result.review.session.status, 'completed');
  assert.equal(result.review.summary.reviewed, 1);
});

test('a retry after the FSRS commit reconciles the pending marker without rating twice', async () => {
  const pendingAt = new Date('2026-09-10T10:00:00.000Z');
  const due = new Date('2026-09-14T10:00:00.000Z');
  let cardReviewCalls = 0;
  let session = {
    id: 'session-2', userId: 'owner-1', version: 2, type: 'review', status: 'active', title: null, intent: 'memory-consolidation', inputModality: 'text',
    activeContexts: { version: 1, ownerUserId: 'owner-1', capturedAt: pendingAt.toISOString(), items: [] }, currentStep: { id: 'flashcard:card-2', index: 0, state: 'active' }, progress: { completed: 0, total: 1, percent: 0 },
    productions: [{ id: 'pending', kind: 'review-pending-3', referenceId: 'flashcard:card-2', createdAt: pendingAt.toISOString() }], sourceReferences: [{ kind: 'review-item', id: 'flashcard:card-2', title: 'Deck' }], twinImpact: null, resumeTarget: null, nextBestAction: null,
    links: { tutorSessionId: null, studySessionId: null, documentId: null, lessonId: null, goalId: null, languageProfileId: null, workspaceRef: null }, startedAt: pendingAt.toISOString(), updatedAt: pendingAt.toISOString(), pausedAt: null, completedAt: null,
  };
  const card = { id: 'card-2', userId: 'owner-1', deckId: 'deck-1', front: 'Q', back: 'A', sourceDocumentId: null, state: 'review', stability: 3, difficulty: 4, due, elapsedDays: 1, scheduledDays: 4, reps: 3, lapses: 0, lastReview: pendingAt, createdAt: pendingAt, updatedAt: pendingAt, deck: { name: 'Deck' }, sourceDocument: null, concepts: [] };
  const { service } = emptyFixture({
    prisma: {
      card: { count: async () => 0, findFirst: async () => ({ due }), findMany: async () => [card] }, reviewLog: { findFirst: async () => ({ id: 'log-1' }) },
      reviewable: { count: async () => 0, findFirst: async () => null, findMany: async () => [] }, exam: { findFirst: async () => null }, concept: { findFirst: async () => null, findMany: async () => [] }, document: { findFirst: async () => null }, goal: { findFirst: async () => null }, experienceSession: { findFirst: async () => null },
    },
    cardReviews: { review: async () => { cardReviewCalls += 1; throw new Error('must not rerate'); } },
    experiences: {
      get: async () => session,
      updateState: async (_userId, _id, update) => { session = { ...session, ...update, progress: update.progress ? { ...update.progress, percent: 100 } : session.progress }; return session; },
      complete: async () => { session = { ...session, status: 'completed', completedAt: due.toISOString() }; return session; },
    },
  });
  const result = await service.grade('owner-1', 'session-2', { itemReference: 'flashcard:card-2', rating: 3 });
  assert.equal(cardReviewCalls, 0);
  assert.equal(result.nextReviewAt, due.toISOString());
  assert.equal(result.review.summary.reviewed, 1);
});

test('a successful linked FSRS review idempotently consolidates the exact RLLE repair loop', async () => {
  const now = new Date('2026-09-10T10:00:00.000Z').toISOString();
  let course = {
    id: 'course-session-1',
    userId: 'owner-1',
    type: 'language',
    status: 'active',
    intent: 'language-course',
    currentStep: {
      id: 'unit-a1',
      state: 'active',
      metadata: {
        rlleCourse: {
          schemaVersion: 1,
          curriculumIds: ['unit-a1'],
          completedUnitIds: ['unit-a1'],
          currentMission: null,
          gaps: [{ id: 'gap-1', kind: 'grammar', status: 'repairing', label: 'articles', evidenceIds: ['evidence-1'], firstObservedAt: now, lastObservedAt: now }],
          mistakeMemory: [{ id: 'mistake-1', gapId: 'gap-1', pattern: 'articles', learnerExample: 'I go to office', correction: 'I go to the office', occurrenceCount: 2, sourceSessionIds: ['mission-1'], lastObservedAt: now, repairStage: 'reuse-later' }],
          repairLoops: [{ mistakeId: 'mistake-1', currentStage: 'reuse-later', completedStages: ['explain', 'guided-practice', 'retry-now'], microLessonId: 'lesson-1', retryEvidenceId: 'evidence-2', reviewCardIds: ['card-repair-1'] }],
        },
      },
    },
    productions: [],
  };
  let lookupWhere;
  let updateCount = 0;
  let completeCount = 0;
  const { service } = emptyFixture({
    prisma: {
      card: {
        findFirst: async (args) => {
          assert.equal(args.where.userId, 'owner-1');
          return { deck: { languageProfiles: [{ id: 'language-profile-1' }] } };
        },
      },
      experienceSession: {
        findFirst: async (args) => {
          lookupWhere = args.where;
          return { id: course.id };
        },
      },
    },
    experiences: {
      get: async (_userId, id) => {
        assert.equal(id, course.id);
        return course;
      },
      updateState: async (_userId, id, update) => {
        assert.equal(id, course.id);
        updateCount += 1;
        course = { ...course, ...update };
        return course;
      },
      complete: async (_userId, id) => {
        assert.equal(id, course.id);
        completeCount += 1;
        course = { ...course, status: 'completed' };
        return course;
      },
    },
  });
  const reviewSession = { id: 'review-session-1', links: { languageProfileId: null } };

  await service.consolidateLanguageRepair('owner-1', reviewSession, 'card-repair-1', 2);
  assert.equal(updateCount, 0);
  await service.consolidateLanguageRepair('owner-1', reviewSession, 'card-repair-1', 3);
  await service.consolidateLanguageRepair('owner-1', reviewSession, 'card-repair-1', 3);

  const state = course.currentStep.metadata.rlleCourse;
  assert.equal(lookupWhere.userId, 'owner-1');
  assert.equal(lookupWhere.languageProfileId, 'language-profile-1');
  assert.equal(state.repairLoops[0].currentStage, 'consolidate');
  assert.deepEqual(state.repairLoops[0].completedStages, ['explain', 'guided-practice', 'retry-now', 'reuse-later', 'consolidate']);
  assert.equal(state.mistakeMemory[0].repairStage, 'consolidate');
  assert.equal(state.gaps[0].status, 'consolidated');
  assert.equal(course.productions.filter((item) => item.kind === 'language-repair-consolidated').length, 1);
  assert.equal(updateCount, 1);
  assert.equal(completeCount, 1);
});

test('the existing FSRS algorithm keeps its score mapping and schedules real dates', () => {
  const engine = new FsrsEngine();
  assert.deepEqual([0.2, 0.5, 0.75, 0.95].map((score) => engine.gradeFromScore(score)), [1, 2, 3, 4]);
  const now = new Date('2026-09-10T10:00:00.000Z');
  const next = engine.review(engine.fresh(now), 3, now);
  assert.equal(next.reps, 1);
  assert.ok(next.due instanceof Date);
});

test('Lot 9 UI keeps Review focused, resumable, sourced, responsive and bilingual', () => {
  const home = read('apps/mobile/app/(tabs)/study.tsx');
  const session = read('apps/mobile/app/revision.tsx');
  const components = read('apps/mobile/components/review/experience.tsx');
  const document = read('apps/mobile/app/library/[id].tsx');
  const i18n = read('apps/mobile/lib/i18n.tsx');
  assert.match(home, /\/review\/home/);
  assert.match(home, /loadReviewHomeCache/);
  assert.match(session, /\/review\/sessions/);
  assert.match(session, /ProgressNarrative/);
  assert.match(session, /SourcePreview/);
  assert.match(components, /accessibilityRole="progressbar"/);
  assert.match(components, /accessibilityRole="radiogroup"/);
  assert.match(document, /documentId: document\.id/);
  assert.match(i18n, /'review9\.title': 'Review'/);
  assert.match(i18n, /'review9\.title': 'Réviser'/);
});
