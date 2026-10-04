'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('Learner Passport publishes honest provenance and a versioned contract', () => {
  assert.equal(shared.LEARNER_PASSPORT_VERSION, 1);
  assert.deepEqual(shared.LEARNER_PASSPORT_SOURCES, [
    'DECLARED', 'OBSERVED', 'VERIFIED',
  ]);
});

test('known-language levels are bounded to native or CEFR', () => {
  assert.deepEqual(shared.KNOWN_LANGUAGE_LEVELS, [
    'native', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2',
  ]);
  assert.equal(new Set(shared.KNOWN_LANGUAGE_LEVELS).size, 7);
});
