'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { NextBestActionAdapter } = require('../dist/recommendation/next-best-action.adapter.js');
const { HomeOverviewService } = require('../dist/home/home-overview.service.js');
const { HomeController } = require('../dist/home/home.controller.js');
const { translateStaticCopy } = require('../dist/localization/static-copy.catalog.js');

const NOW = new Date('2026-09-09T10:00:00.000Z');

test('NBA aggregation returns null for no evidence and handles one candidate', () => {
  const adapter = new NextBestActionAdapter();
  assert.equal(adapter.fromCandidates([], NOW), null);

  const action = adapter.fromCandidates([candidate({
    title: 'Review now',
    priority: 800,
    destination: { kind: 'review', path: '/revision' },
  })], NOW);
  assert.equal(action.title, 'Review now');
  assert.equal(action.destination.path, '/revision');
  assert.equal(action.signalsUsed.length, 1);
});

test('NBA aggregation de-duplicates equivalent intents and keeps factual evidence', () => {
  const adapter = new NextBestActionAdapter();
  const action = adapter.fromCandidates([
    candidate({ title: 'Primary review', priority: 900, dedupeKey: 'concept:c1' }),
    candidate({
      title: 'Duplicate review',
      priority: 700,
      dedupeKey: 'concept:c1',
      estimatedDuration: 12,
      signals: [signal('coach.review', 'Coach also selected this concept')],
    }),
    candidate({ title: 'Different task', priority: 600, dedupeKey: 'concept:c2' }),
  ], NOW);

  assert.equal(action.title, 'Primary review');
  assert.equal(action.estimatedDuration, 12);
  assert.equal(action.signalsUsed.length, 2);
  assert.deepEqual(action.alternatives.map((item) => item.title), ['Different task']);
  assert.ok(action.signalsUsed.every((item) => item.evidence.length > 0));
  assert.doesNotMatch(JSON.stringify(action), /chain[- ]of[- ]thought|hidden reasoning/i);
});

test('NBA aggregation ignores expired and invalid candidates', () => {
  const adapter = new NextBestActionAdapter();
  const action = adapter.fromCandidates([
    candidate({ title: 'Expired', priority: 999, validUntil: '2026-09-09T09:59:59.000Z' }),
    candidate({ title: 'Invalid', priority: 998, validUntil: 'not-a-date' }),
    candidate({ title: 'Current', priority: 500, validUntil: '2026-09-10T10:00:00.000Z' }),
  ], NOW);
  assert.equal(action.title, 'Current');

  const expiredRecommendation = {
    id: 'old-rec', kind: 'lesson', title: 'Old recommendation',
    reason: 'Old evidence.', status: 'suggested',
    target: { kind: 'route', id: '/learn' },
    createdAt: '2026-08-01T10:00:00.000Z',
  };
  assert.equal(adapter.fromRecommendations([expiredRecommendation], NOW), null);
  assert.equal(adapter.fromRecommendations([{ ...expiredRecommendation, createdAt: 'invalid' }], NOW), null);
});

test('Home priority is deterministic: imminent exam, due revision, then resumable session', async () => {
  const imminentExam = makeService({
    exams: [{ id: 'exam-1', subject: 'Physics', date: '2026-09-10', priority: 'high', daysUntil: 1, preparation: 20 }],
    reviews: [{ id: 'review-1', priority: 'urgent', urgency: 'overdue' }],
    sessions: [session()],
  });
  const examOverview = await imminentExam.service.overview('u1', NOW);
  assert.equal(examOverview.nextBestAction.source.kind, 'goal');
  assert.deepEqual(examOverview.nextBestAction.destination, {
    kind: 'route', path: '/exams', params: { examId: 'exam-1' },
  });

  const revision = makeService({
    reviews: [{ id: 'review-1', priority: 'normal', urgency: 'due' }],
    sessions: [session()],
    initiatives: [{
      id: 'initiative-1', kind: 'review_due', title: '2 reviews are due',
      message: 'Review soon.', priority: 60, status: 'active',
      reasons: ['Two FSRS reviews are due.'], createdAt: NOW.toISOString(),
    }],
  });
  const reviewOverview = await revision.service.overview('u1', NOW);
  assert.equal(reviewOverview.nextBestAction.source.kind, 'revision');
  assert.equal(reviewOverview.nextBestAction.destination.path, '/revision');
  assert.equal(reviewOverview.nextBestAction.signalsUsed.length, 2);

  const resumable = makeService({ sessions: [session()] });
  const sessionOverview = await resumable.service.overview('u1', NOW);
  assert.equal(sessionOverview.nextBestAction.source.kind, 'session');
  assert.equal(sessionOverview.nextBestAction.destination.path, '/tutor/tutor-1');
  assert.equal(sessionOverview.nextBestAction.destination.params.experienceSessionId, 'session-1');
});

test('Home labels foresight as an estimate and carries its confidence', async () => {
  const { service } = makeService({
    foresight: {
      predictions: [],
      topRisk: {
        kind: 'forgetting', probability: 72, level: 'high',
        cause: 'Three items may cross their forgetting threshold.',
        action: 'Review these ahead of time.',
        reasons: ['Three forecast events within seven days.'],
      },
      generatedAt: NOW.toISOString(),
    },
  });
  const overview = await service.overview('u1', NOW);
  assert.equal(overview.nextBestAction.source.kind, 'foresight');
  assert.equal(overview.nextBestAction.confidence, 0.72);
  assert.match(overview.nextBestAction.reason, /^At your current pace, .*estimated at 72%/);
  assert.equal(overview.nextBestAction.signalsUsed[0].humanLabel, 'Foresight estimate');
});

test('Home only shows a duration supplied by an existing business service', async () => {
  const configured = makeService({
    coach: { recommendations: [{
      kind: 'lesson', activity: 'API design', reason: 'The next planned lesson.',
      minutes: 18, conceptId: 'concept-1', languageProfileId: null,
    }] },
  });
  assert.equal((await configured.service.overview('u1', NOW)).nextBestAction.estimatedDuration, 18);

  const unknown = makeService({
    coach: { recommendations: [{
      kind: 'lesson', activity: 'API design', reason: 'The next planned lesson.',
      minutes: 0, conceptId: 'concept-1', languageProfileId: null,
    }] },
  });
  assert.equal((await unknown.service.overview('u1', NOW)).nextBestAction.estimatedDuration, null);
});

test('Home returns an honest new-user action only when empty-state sources are known', async () => {
  const { service } = makeService();
  const overview = await service.overview('new-user', NOW);
  assert.equal(overview.context.kind, 'new');
  assert.equal(overview.nextBestAction.title, 'Start learning');
  assert.equal(overview.nextBestAction.destination.path, '/learn');
  assert.equal(overview.nextBestAction.estimatedDuration, null);
});

test('Home degrades partially, keeps verified data and scopes every source to one user', async () => {
  const { service, calls } = makeService({
    calendarError: new Error('calendar unavailable'),
    reviews: [{ id: 'review-1', priority: 'normal', urgency: 'due' }],
  });
  const overview = await service.overview('owned-user', NOW);
  assert.equal(overview.partial, true);
  assert.equal(overview.sources.calendar, 'unavailable');
  assert.equal(overview.nextBestAction.destination.path, '/revision');
  assert.equal(calls.length, 10);
  assert.ok(calls.every((call) => call.userId === 'owned-user'));
  assert.deepEqual(calls.map((call) => call.source).sort(), [
    'calendar', 'coach', 'exams', 'foresight', 'goals', 'initiatives', 'progress', 'recommendations', 'reviews', 'sessions',
  ]);
});

test('Home does not invent a priority when all business sources are unavailable', async () => {
  const error = new Error('unavailable');
  const { service } = makeService({
    recommendationsError: error,
    coachError: error,
    initiativesError: error,
    foresightError: error,
    reviewsError: error,
    examsError: error,
    sessionsError: error,
    goalsError: error,
    calendarError: error,
    progressError: error,
  });
  const overview = await service.overview('u1', NOW);
  assert.equal(overview.nextBestAction, null);
  assert.equal(overview.partial, true);
  assert.ok(Object.values(overview.sources).every((state) => state === 'unavailable'));
});

test('French Home copy is static while learner-authored session titles stay untouched', async () => {
  const { service } = makeService({
    sessions: [session({ title: 'Continue Biology' })],
    translate: (texts) => texts.map((text) => translateStaticCopy(text, 'fr')),
  });
  const overview = await service.overview('u1', NOW);
  assert.equal(overview.nextBestAction.title, 'Continue Biology');
  assert.equal(overview.nextBestAction.primaryAction.label, 'Reprendre');
  assert.equal(translateStaticCopy('Review what is due', 'fr'), 'Réviser les éléments dus');
  assert.equal(translateStaticCopy('2 reviews are due now.', 'fr'), '2 révisions sont dues maintenant.');
});

test('Mobile Home consumes one aggregate endpoint and keeps the compact content order', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../mobile/app/(tabs)/index.tsx'), 'utf8');
  assert.equal((source.match(/\/home\/overview/g) ?? []).length, 1);
  for (const legacyPath of ['/journey/today', '/coach/today', '/twin/next', '/proactive']) {
    assert.equal(source.includes(legacyPath), false);
  }
  assert.equal((source.match(/<NextBestActionCard/g) ?? []).length, 1);
  assert.match(source, /staleTime:\s*30_000/);
  assert.match(source, /gcTime:\s*5 \* 60_000/);
  assert.match(source, /placeholderData:/);
  assert.match(source, /queryFn: \(\{ signal \}\)/);
  const content = source.slice(source.indexOf('return (', source.indexOf('const data =')));
  const order = ['<NextBestActionCard', '{resumeSection}', '{upcomingSection}', '{goalSection}', '{progressSection}', '<HomeQuickActions'];
  let previous = -1;
  for (const marker of order) {
    const current = content.indexOf(marker, previous + 1);
    assert.ok(current > previous, `${marker} must follow the previous Home section`);
    previous = current;
  }
  const decisionComponents = fs.readFileSync(path.resolve(__dirname, '../../mobile/components/home/decision.tsx'), 'utf8');
  assert.match(decisionComponents, /accessibilityState=\{\{ expanded: whyOpen \}\}/);
  assert.match(decisionComponents, /isReduceMotionEnabled/);
});

test('Home endpoint is protected by the JWT access guard', () => {
  const guards = Reflect.getMetadata('__guards__', HomeController) ?? [];
  assert.ok(guards.some((guard) => guard.name === 'JwtAccessGuard'));
});

function candidate(overrides = {}) {
  return {
    title: 'Candidate',
    actionLabel: 'Open',
    destination: { kind: 'route', path: '/learn' },
    reason: 'A verified reason.',
    signals: [signal('verified.signal', 'Verified evidence')],
    priority: 100,
    source: { kind: 'recommendation-engine' },
    ...overrides,
  };
}

function signal(name, evidence) {
  return {
    signal: name,
    humanLabel: 'Verified signal',
    evidence,
    source: 'test',
    timestamp: NOW.toISOString(),
  };
}

function session(overrides = {}) {
  return {
    id: 'session-1',
    type: 'tutor',
    status: 'paused',
    title: 'Physics session',
    intent: 'Learn physics',
    inputModality: 'text',
    activeContexts: { ownerUserId: 'u1', items: [], updatedAt: NOW.toISOString() },
    progress: { completed: 1, total: 3, percent: 33 },
    productions: [],
    sourceReferences: [],
    twinImpact: null,
    nextBestAction: null,
    resumeTarget: null,
    links: {
      tutorSessionId: 'tutor-1', studySessionId: null, documentId: null,
      lessonId: null, goalId: null, languageProfileId: null, workspaceRef: null,
    },
    version: 1,
    createdAt: '2026-09-08T10:00:00.000Z',
    updatedAt: '2026-09-09T09:00:00.000Z',
    pausedAt: '2026-09-09T09:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

function makeService(options = {}) {
  const calls = [];
  const call = (source, value, error) => async (userId) => {
    calls.push({ source, userId });
    if (error) throw error;
    return value;
  };
  const recommendations = { feed: call('recommendations', { recommendations: options.recommendations ?? [] }, options.recommendationsError) };
  const coach = { today: call('coach', options.coach ?? { recommendations: [] }, options.coachError) };
  const initiatives = { list: call('initiatives', options.initiatives ?? [], options.initiativesError) };
  const foresight = {
    forecast: call('foresight', options.foresight ?? {
      predictions: [], topRisk: null, generatedAt: NOW.toISOString(),
    }, options.foresightError),
  };
  const revision = { due: call('reviews', options.reviews ?? [], options.reviewsError) };
  const exams = { list: call('exams', options.exams ?? [], options.examsError) };
  const sessions = {
    resumable: async (userId) => {
      calls.push({ source: 'sessions', userId });
      if (options.sessionsError) throw options.sessionsError;
      return { items: options.sessions ?? [], nextCursor: null };
    },
  };
  const goals = { list: call('goals', options.goals ?? [], options.goalsError) };
  const calendar = { view: call('calendar', options.calendar ?? { days: [] }, options.calendarError) };
  const mentor = {
    overview: call('progress', options.progress ?? {
      stats: {
        dueNow: 0, atRiskConcepts: 0, conceptsMastered: 0,
        cardsReviewed: 0, lessonsCompleted: 0, exercisesCorrect: 0,
      },
      streak: { current: 0 },
    }, options.progressError),
  };
  const localization = {
    localizeForUser: async (_userId, texts) => options.translate ? options.translate(texts) : texts,
  };
  return {
    calls,
    service: new HomeOverviewService(
      recommendations,
      new NextBestActionAdapter(),
      coach,
      initiatives,
      foresight,
      revision,
      exams,
      sessions,
      goals,
      calendar,
      mentor,
      localization,
    ),
  };
}
