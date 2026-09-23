'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('Home composition preserves the decision-first order on every viewport', () => {
  assert.deepEqual(shared.HOME_CONTENT_ORDER, [
    'next-best-action',
    'resume',
    'upcoming',
    'goal',
    'progress',
    'quick-actions',
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
    'progress',
  ]);
});
