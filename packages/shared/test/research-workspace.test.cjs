'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('research exposes three depths with strict, increasing source budgets', () => {
  assert.deepEqual(shared.RESEARCH_DEPTHS, ['quick', 'sourced', 'deep']);
  assert.equal(shared.researchSourceLimit('quick'), 5);
  assert.equal(shared.researchSourceLimit('sourced'), 10);
  assert.equal(shared.researchSourceLimit('deep'), 16);
  assert.deepEqual(shared.researchExecutionLimits('quick'), { maxQueries: 1, maxSources: 5, maxIterations: 1, timeoutMs: 25000 });
  assert.deepEqual(shared.researchExecutionLimits('deep'), { maxQueries: 4, maxSources: 16, maxIterations: 1, timeoutMs: 75000 });
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

test('all eight workspace templates expose distinct fields, plans and completion controls', () => {
  const signatures = new Set();
  for (const template of shared.WORKSPACE_TEMPLATES) {
    const definition = shared.WORKSPACE_TEMPLATE_DEFINITIONS[template];
    assert.ok(definition.fields.length >= 6, `${template} fields`);
    assert.ok(definition.requiredFields.length >= 1, `${template} required fields`);
    assert.ok(definition.steps.length >= 7, `${template} steps`);
    assert.ok(definition.completionControls.includes('brief'), `${template} brief control`);
    assert.ok(definition.completionControls.includes('submission'), `${template} submission control`);
    const plan = shared.workspaceDefaultPlan(template);
    assert.deepEqual(plan.map((item) => item.stepId), definition.steps);
    assert.ok(plan.every((item, index) => item.order === index && item.completed === false));
    signatures.add(JSON.stringify({ fields: definition.fields, steps: definition.steps }));
  }
  assert.equal(signatures.size, shared.WORKSPACE_TEMPLATES.length);
});

test('workspace completion uses real brief, plan, sources and draft state', () => {
  const template = 'memoire';
  const plan = shared.workspaceDefaultPlan(template);
  const brief = {
    version: 1,
    fields: {
      subject: 'Learning systems',
      researchQuestion: 'How does retrieval practice affect retention?',
      methodology: 'Controlled comparison',
      institutionInstructions: 'APA references and a signed methodology chapter.',
    },
  };
  const before = shared.workspaceCompletionChecks({
    template,
    brief,
    plan,
    sources: [],
    draftContent: '',
  });
  assert.equal(before.find((item) => item.id === 'brief').passed, true);
  assert.equal(before.find((item) => item.id === 'methodology').passed, true);
  assert.equal(before.find((item) => item.id === 'plan').passed, false);
  assert.equal(before.find((item) => item.id === 'sources').passed, false);
  assert.equal(before.find((item) => item.id === 'submission').passed, false);

  const completed = shared.workspaceCompletionChecks({
    template,
    brief,
    plan: plan.map((item) => ({ ...item, completed: true })),
    sources: [{ kind: 'document', id: 'doc-1' }],
    draftContent: 'A learner-authored draft.',
  });
  assert.ok(completed.every((item) => item.passed));
});

test('workspace progress preserves the persisted workflow brief', () => {
  const workflow = {
    version: 1,
    brief: { version: 1, fields: { userInstructions: 'Use my outline.' } },
  };
  const progress = shared.workspaceProgressFromPlan(
    [{ id: 'a', title: 'A', order: 0, completed: false }],
    workflow,
  );
  assert.deepEqual(progress.workflow, workflow);
});
