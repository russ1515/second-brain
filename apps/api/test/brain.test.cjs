'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BrainService } = require('../dist/brain/brain.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function fixture(overrides = {}) {
  const prisma = {
    concept: { count: async () => 1, findMany: async () => [] },
    conceptEdge: { count: async () => 0, findMany: async () => [] },
    document: { findMany: async () => [] },
    goal: { findMany: async () => [] },
    reviewLog: { findMany: async () => [] },
    lesson: { findMany: async () => [] },
    tutorSession: { findMany: async () => [] },
    ...overrides.prisma,
  };
  const mastery = {
    strengthsWeaknesses: async () => ({ strengths: [], weaknesses: [] }),
    computeMastery: (concept) => ({ conceptId: concept.id, name: concept.name, mastery: null, level: 'unknown', cardCount: 0, reviewedCount: 0, dueCount: 0, lapses: 0 }),
  };
  const paths = { next: async () => ({ items: overrides.pathItems ?? [] }) };
  const learnerProfiles = { profile: async () => overrides.profile ?? ({ interactions: 0 }) };
  const dna = { dna: async () => ({ maturity: 0, interactions: 0, traits: [], updatedAt: null }) };
  const memory = { page: async () => ({ summary: { lessons: 0, exercises: 0, errors: 0, successes: 0, revisions: 0, conversations: 0, homework: 0, reports: 0, documents: 0, concepts: 0, connections: 0, total: 0 }, entries: [], nextCursor: null }) };
  const onboarding = { get: async () => ({ answers: {}, status: 'completed', currentStep: 'done', completedAt: null, updatedAt: null }) };
  const predictions = { forecast: async () => overrides.forecast ?? ({ predictions: [], topRisk: null, generatedAt: '2026-09-10T10:00:00.000Z' }) };
  return { service: new BrainService(prisma, mastery, paths, learnerProfiles, dna, memory, onboarding, predictions), prisma };
}

test('Brain overview stays sparse and hides forecasts without enough evidence', async () => {
  const { service } = fixture({
    profile: { interactions: 0 },
    forecast: { topRisk: { kind: 'forgetting', probability: 80, level: 'high', cause: 'x', action: 'y', reasons: ['z'] }, predictions: [], generatedAt: '2026-09-10T10:00:00.000Z' },
  });
  const result = await service.overview('user-1', new Date('2026-09-10T10:00:00.000Z'));
  assert.equal(result.maturity.level, 'sparse');
  assert.equal(result.foresight, null);
  assert.equal(result.partial, false);
});

test('Brain graph enforces the authenticated owner and hard page bound', async () => {
  let countArgs;
  let listArgs;
  const { service } = fixture({ prisma: {
    concept: {
      count: async (args) => { countArgs = args; return 0; },
      findMany: async (args) => { listArgs = args; return []; },
    },
    conceptEdge: { count: async () => 0, findMany: async () => [] },
    document: { findMany: async () => [] },
    goal: { findMany: async () => [] },
    reviewLog: { findMany: async () => [] },
    lesson: { findMany: async () => [] },
    tutorSession: { findMany: async () => [] },
  } });
  const graph = await service.graph('owner-1', { limit: 999, query: 'networks' });
  assert.equal(countArgs.where.userId, 'owner-1');
  assert.equal(listArgs.where.userId, 'owner-1');
  assert.equal(listArgs.take, 101);
  assert.equal(graph.bounded, true);
});

test('Ask Brain is deterministic and grounded in path evidence', async () => {
  const { service } = fixture({ pathItems: [{ conceptId: 'c1', name: 'Networks', status: 'at_risk', mastery: 0.4, level: 'weak', dueCount: 2, blockedBy: [] }] });
  const answer = await service.ask('user-1', 'Quel concept je maîtrise le moins ?');
  assert.equal(answer.kind, 'weakest');
  assert.equal(answer.grounded, true);
  assert.deepEqual(answer.concepts.map((item) => item.id), ['c1']);
});

test('Lot 8 UI exposes one Brain, contextual legacy routes, accessible alternatives and cache', () => {
  const screen = read('apps/mobile/app/(tabs)/brain.tsx');
  const components = read('apps/mobile/components/brain/digital-twin.tsx');
  const graph = read('apps/mobile/components/brain/knowledge-graph.tsx');
  const legacy = read('apps/mobile/components/brain/legacy-brain-redirect.tsx');
  const tutor = read('apps/mobile/app/tutor/[id].tsx');
  assert.match(screen, /loadBrainCache/);
  assert.match(screen, /knowledgeMode === 'graph'/);
  assert.match(screen, /HistoryTimeline/);
  assert.match(screen, /BrainConceptPanel/);
  assert.match(components, /accessibilityRole="list"/);
  assert.match(graph, /accessibilityLabel/);
  assert.match(legacy, /pathname: '\/brain'/);
  assert.match(tutor, /brain-impact/);
  assert.match(tutor, /twinImpact\?\.changes\.length/);
});

test('Brain i18n includes French and English, and legacy routes remain present', () => {
  const i18n = read('apps/mobile/lib/i18n.tsx');
  assert.match(i18n, /'brain8\.ask\.title': 'Ask your brain/);
  assert.match(i18n, /'brain8\.ask\.title': 'Interroge ton cerveau/);
  for (const route of ['twin-profile', 'memory', 'mastery', 'graph', 'strengths', 'insights', 'learning-dna', 'insights-center', 'foresight', 'predictions']) {
    assert.match(read(`apps/mobile/app/${route}.tsx`), /LegacyBrainRedirect/);
  }
});
