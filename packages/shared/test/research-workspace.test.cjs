'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('research exposes three depths with strict, increasing source budgets', () => {
  assert.deepEqual(shared.RESEARCH_DEPTHS, ['quick', 'sourced', 'deep']);
  assert.equal(shared.researchSourceLimit('quick'), 5);
  assert.equal(shared.researchSourceLimit('sourced'), 10);
  assert.equal(shared.researchSourceLimit('deep'), 16);
});

test('deep plan is a preview with four semantic steps and no progress estimate', () => {
  assert.deepEqual(shared.buildDeepResearchPlan().map((step) => step.id), ['find', 'compare', 'verify', 'synthesize']);
  assert.equal(shared.buildDeepResearchPlan().some((step) => 'percent' in step), false);
});

test('document and collection scopes stay bounded and explicit', () => {
  const ids = Array.from({ length: 30 }, (_, index) => `doc-${index}`);
  assert.equal(shared.researchScopeToRag({ kind: 'documents', documentIds: [...ids, 'doc-1'] }).documentIds.length, 20);
  assert.deepEqual(shared.researchScopeToRag({ kind: 'collection', collectionId: 'c1' }), { collectionId: 'c1' });
  assert.deepEqual(shared.researchScopeToRag({ kind: 'library' }), {});
  assert.equal(shared.researchScopeToRag({ kind: 'web' }), null);
});

test('workspace progress only derives from real plan completion', () => {
  const progress = shared.workspaceProgressFromPlan([
    { id: 'a', title: 'A', order: 0, completed: true },
    { id: 'b', title: 'B', order: 1, completed: false },
  ]);
  assert.deepEqual(progress, { currentStep: 'b', completedSteps: ['a'], totalSteps: 2 });
});

test('workspace templates and contextual assistant actions are product-level contracts', () => {
  assert.deepEqual(shared.WORKSPACE_TEMPLATES, ['memoire', 'tfc', 'dissertation', 'report', 'article', 'assignment', 'academic-research', 'other']);
  assert.ok(shared.WORKSPACE_ASSIST_ACTIONS.includes('compare-sources'));
  assert.ok(shared.WORKSPACE_ASSIST_ACTIONS.includes('check-coherence'));
});
