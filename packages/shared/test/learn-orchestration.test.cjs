'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

const base = {
  selectedIntent: null,
  modality: 'write',
  depth: 'standard',
  contexts: [],
};

test('Learn exposes the five product intentions and four input modalities', () => {
  assert.deepEqual(shared.LEARN_INTENTS, ['understand', 'learn', 'practice', 'research', 'create']);
  assert.deepEqual(shared.LEARN_MODALITIES, ['write', 'speak', 'capture', 'import']);
});

test('natural questions and every explicit intention route to existing experiences', () => {
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Why is the sky blue?' }).execution, 'tutor-message');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Thermodynamique', selectedIntent: 'understand' }).destination.path, '/tutor');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'La thermodynamique', selectedIntent: 'learn' }).destination.path, '/lesson/new');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Les équations', selectedIntent: 'practice' }).destination.path, '/examiner');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Les équations', selectedIntent: 'research' }).destination.path, '/research');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Rédige un rapport', selectedIntent: 'create' }).destination.path, '/library/workspace');
});

test('active document context routes understanding and creation to that exact document', () => {
  const contexts = [{
    id: 'document:doc-1', kind: 'document', scope: 'active-object', referenceId: 'doc-1',
    label: 'Biology notes', priority: 80, visibility: 'visible', addedAt: new Date().toISOString(),
  }];
  const understand = shared.routeLearnIntent({ ...base, text: 'Explain chapter 2', selectedIntent: 'understand', contexts });
  assert.equal(understand.destination.path, '/library/ask');
  assert.equal(understand.destination.params.documentId, 'doc-1');
  const create = shared.routeLearnIntent({ ...base, text: 'Create flashcards', selectedIntent: 'create', contexts });
  assert.equal(create.destination.path, '/library/doc-1');
  assert.equal(create.destination.params.action, 'flashcards');
  const analysis = shared.routeLearnIntent({ ...base, text: 'Analyse ce PDF', contexts });
  assert.equal(analysis.destination.params.documentId, 'doc-1');
});

test('guided learning, paths and language conversation keep specialised routes', () => {
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Je veux une session guidée', selectedIntent: 'learn' }).destination.path, '/daily-session');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Crée mon parcours', selectedIntent: 'learn' }).destination.path, '/adaptive-path');
  assert.equal(shared.routeLearnIntent({ ...base, text: 'Je veux parler anglais' }).destination.path, '/languages');
});

test('ambiguous short topics ask exactly one intent clarification', () => {
  const result = shared.routeLearnIntent({ ...base, text: 'JavaScript' });
  assert.equal(result.status, 'clarification');
  assert.equal(result.question, 'intent');
  assert.deepEqual(result.options, shared.LEARN_INTENTS);
});

test('deep research requires confirmation while ordinary research does not', () => {
  const standard = shared.routeLearnIntent({ ...base, text: 'Research sleep', selectedIntent: 'research' });
  const deep = shared.routeLearnIntent({ ...base, text: 'Research sleep', selectedIntent: 'research', depth: 'deep' });
  assert.equal(standard.requiresConfirmation, false);
  assert.equal(deep.requiresConfirmation, true);
  assert.equal(deep.destination.path, '/research');
  assert.equal(deep.destination.params.depth, 'deep');
});

test('capture, import and voice use their existing processing paths', () => {
  assert.equal(shared.routeLearnIntent({ ...base, text: '', modality: 'capture' }).destination.path, '/scan');
  assert.equal(shared.routeLearnIntent({ ...base, text: '', modality: 'import', hasAttachment: true }).execution, 'upload');
  assert.equal(shared.routeLearnIntent({ ...base, text: '', modality: 'speak' }).execution, 'tutor-voice');
});

test('drafts survive navigation and transient or quota errors', () => {
  assert.equal(shared.shouldClearLearnDraft('completed'), true);
  for (const outcome of ['navigated', 'error', 'quota', 'upload-failed']) {
    assert.equal(shared.shouldClearLearnDraft(outcome), false);
  }
});

test('Learn composition is truly stacked before wide desktop', () => {
  assert.equal(shared.resolveLearnComposition(390), 'single-column');
  assert.equal(shared.resolveLearnComposition(900), 'single-column');
  assert.equal(shared.resolveLearnComposition(1000), 'split');
  assert.throws(() => shared.resolveLearnComposition(-1), /non-negative/);
});

test('long drafts stay local while route-prefill parameters remain bounded', () => {
  const result = shared.routeLearnIntent({ ...base, text: 'x'.repeat(10_000), selectedIntent: 'create' });
  assert.equal(result.destination.params.objective.length, 2_000);
});
