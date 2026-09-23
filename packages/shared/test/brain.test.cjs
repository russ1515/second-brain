'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('Brain maturity is honest at 0, 1, 10 and 100 concepts', () => {
  assert.equal(shared.resolveBrainMaturity({ conceptCount: 0, edgeCount: 0, historyCount: 0 }), 'sparse');
  assert.equal(shared.resolveBrainMaturity({ conceptCount: 1, edgeCount: 0, historyCount: 1 }), 'sparse');
  assert.equal(shared.resolveBrainMaturity({ conceptCount: 10, edgeCount: 2, historyCount: 3 }), 'medium');
  assert.equal(shared.resolveBrainMaturity({ conceptCount: 100, edgeCount: 50, historyCount: 100 }), 'dense');
});

test('unknown mastery never becomes a fabricated zero-percent score', () => {
  assert.equal(shared.classifyLearningStatus({ mastery: null, reviewedCount: 0, dueCount: 0, hasUnmetPrerequisites: false }), 'ready');
  assert.equal(shared.classifyLearningStatus({ mastery: null, reviewedCount: 0, dueCount: 0, hasUnmetPrerequisites: true }), 'blocked');
});

test('learning status keeps the existing FSRS and prerequisite thresholds', () => {
  assert.equal(shared.classifyLearningStatus({ mastery: 0.8, reviewedCount: 1, dueCount: 0, hasUnmetPrerequisites: false }), 'mastered');
  assert.equal(shared.classifyLearningStatus({ mastery: 0.7, reviewedCount: 2, dueCount: 0, hasUnmetPrerequisites: false }), 'in_progress');
  assert.equal(shared.classifyLearningStatus({ mastery: 0.7, reviewedCount: 2, dueCount: 1, hasUnmetPrerequisites: false }), 'at_risk');
});

test('Brain overview sources can degrade independently', () => {
  assert.deepEqual(shared.BRAIN_OVERVIEW_SOURCES, [
    'knowledge', 'strengths', 'learningDna', 'learnerProfile', 'declaredProfile',
    'memory', 'path', 'foresight', 'documents',
  ]);
});
