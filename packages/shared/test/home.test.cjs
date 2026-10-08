'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('Home composition preserves the decision-first order on every viewport', () => {
  assert.deepEqual(shared.HOME_CONTENT_ORDER, [
    'next-best-action',
    'resume',
    'learning-calendar',
    'goal',
    'progress',
  ]);
  assert.equal(shared.resolveHomeComposition(375), 'single-column');
  assert.equal(shared.resolveHomeComposition(759), 'single-column');
  assert.equal(shared.resolveHomeComposition(760), 'adaptive');
  assert.equal(shared.resolveHomeComposition(1099), 'adaptive');
  assert.equal(shared.resolveHomeComposition(1100), 'wide');
  assert.throws(() => shared.resolveHomeComposition(-1), /non-negative/);
});

test('Home overview contract exposes every independently degradable source', () => {
  assert.deepEqual(shared.HOME_OVERVIEW_SOURCES, [
    'recommendations',
    'coach',
    'initiatives',
    'foresight',
    'reviews',
    'exams',
    'sessions',
    'goals',
    'calendar',
    'evidence',
  ]);
});

test('canonical learning dimensions are stable and default to not evaluated', () => {
  assert.deepEqual(shared.LEARNING_EVIDENCE_DIMENSIONS, [
    'knowledge',
    'understanding',
    'application',
    'reasoning',
    'critical_reflection',
    'perspective',
  ]);
  const empty = shared.emptyLearningDimensionScores();
  assert.ok(shared.LEARNING_EVIDENCE_DIMENSIONS.every((key) => empty[key].score === null));
  assert.equal(shared.isNormalisedLearningScore(0), true);
  assert.equal(shared.isNormalisedLearningScore(1), true);
  assert.equal(shared.isNormalisedLearningScore(1.01), false);
});
