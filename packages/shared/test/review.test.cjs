'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('review item references round-trip without confusing both FSRS engines', () => {
  assert.deepEqual(shared.parseReviewItemReference(shared.reviewItemReference('flashcard', 'card-1')), { engine: 'flashcard', id: 'card-1' });
  assert.deepEqual(shared.parseReviewItemReference(shared.reviewItemReference('reviewable', 'activity-1')), { engine: 'reviewable', id: 'activity-1' });
  assert.equal(shared.parseReviewItemReference('unknown:item'), null);
});

test('the four learner labels map to deterministic factual feedback', () => {
  assert.equal(shared.reviewFeedbackCode(1), 'review-soon');
  assert.equal(shared.reviewFeedbackCode(2), 'still-fragile');
  assert.equal(shared.reviewFeedbackCode(3), 'good-recall');
  assert.equal(shared.reviewFeedbackCode(4), 'easy-recall');
});

test('review priority rank preserves the existing engine ordering', () => {
  assert.ok(shared.reviewPriorityRank('urgent') > shared.reviewPriorityRank('high'));
  assert.ok(shared.reviewPriorityRank('high') > shared.reviewPriorityRank('medium'));
  assert.ok(shared.reviewPriorityRank('medium') > shared.reviewPriorityRank('low'));
});
