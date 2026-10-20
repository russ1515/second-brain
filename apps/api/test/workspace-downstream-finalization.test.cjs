'use strict';

require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const {
  assertFinalizationProviderOutput,
  buildFinalizationContext,
  finalizationDirective,
  finalizationEvidenceFor,
  finalizationResponseSchema,
  validFinalizationEvidence,
} = require('../dist/workspaces/workspace-downstream-finalization.js');

const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
function fixture() {
  const draft = 'Trois cahiers coûtent chacun 4 euros : 3 × 4 € = 12 €.\nLe livre coûte 7 €.\n12 € + 7 € = 19 €. Le prix total est de 19 euros.';
  const state = {
    runId: 'downstream-technical-run',
    workReview: { draftFingerprint: hash(draft), sourceFingerprint: hash('[]'), replyId: 'verified-reply' },
  };
  const history = [{
    id: 'verified-reply', role: 'assistant', professorPhase: 'VERIFICATION',
    autopilot: { runId: state.runId, output: { text: 'Vérification terminée.', taskFulfillment: {
      fulfilled: true, contractMatchesTask: true, reviewedDraftFingerprint: hash(draft),
    } } },
  }];
  return { draft, revision: 3, state, history, sources: [], citations: [],
    instructions: 'Calculer le prix total en expliquant les opérations.', methodology: 'Additionner les coûts des achats.' };
}
const properOutput = () => ({ text: 'Le travail vérifié est prêt.',
  deconstruction: 'La démarche consiste à calculer le coût des cahiers puis à additionner celui du livre. Les unités et le résultat ont été vérifiés. Cette méthode se transfère aux autres achats.',
  issues: [], needsInput: '' });
function completedFixture() {
  const f = fixture();
  f.history.push({ id: 'final-review', role: 'assistant', professorPhase: 'FINALIZATION',
    autopilot: { runId: f.state.runId, output: { ...properOutput(), finalizationEvidence: finalizationEvidenceFor(f) } } });
  return f;
}
function reason(expected) {
  return error => error?.getResponse?.().code === 'workspace_autopilot_invalid_finalization'
    && error.getResponse().reason === expected;
}

test('FINALIZATION reuses one strict existing-provider contract, with no draft/assessment mutation fields', () => {
  const schema = finalizationResponseSchema();
  assert.equal(schema.strict, true);
  assert.equal(schema.schema.additionalProperties, false);
  assert.deepEqual(schema.schema.required, ['text', 'deconstruction', 'issues', 'needsInput']);
  assert.deepEqual(Object.keys(schema.schema.properties), schema.schema.required);
  assert.match(finalizationDirective(), /Do not generate, modify, replace or append/);
  assert.match(finalizationDirective(), /empty appliedCorrections list/);
});

test('proper final pedagogical output passes without changing a byte of the existing task/draft/state', () => {
  const f = fixture(); const before = copy(f);
  assertFinalizationProviderOutput(JSON.stringify(properOutput()), f);
  const context = buildFinalizationContext(f);
  const bound = JSON.parse(context.slice(context.indexOf('\n') + 1));
  assert.equal(bound.originalTask, f.instructions);
  assert.equal(bound.verifiedDraft.content, f.draft);
  assert.equal(bound.verifiedDraft.revision, 3);
  assert.equal(bound.verificationReplyId, 'verified-reply');
  assert.equal(bound.methodContext.recordedMethodology, f.methodology);
  assert.deepEqual(bound.appliedCorrections, []);
  assert.deepEqual(bound.sources, []);
  assert.deepEqual(f, before);
});

test('raw provider mutation attempts are rejected before the general parser could ignore them', () => {
  const f = fixture();
  for (const extra of [
    { draft: 'A different new work.' }, { plan: [] }, { briefFields: {} }, { workContract: {} },
    { taskFulfillment: { fulfilled: true } }, { workEvidence: [] }, { finalizationEvidence: finalizationEvidenceFor(f) },
  ]) assert.throws(() => assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), ...extra }), f),
    reason('forbidden-mutation-or-field'));
});

test('fabricated citation labels are rejected on RAW output, not silently stripped by normalization', () => {
  const f = fixture();
  for (const field of ['text', 'deconstruction', 'needsInput']) {
    assert.throws(() => assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), [field]: 'Source [W99]' }), f),
      reason('unknown-source-label'));
  }
  assert.throws(() => assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), issues: ['[W99]'] }), f),
    reason('unknown-source-label'));
});

test('real AW-6 labels/URLs are allowed, invented URL identities are not', () => {
  const f = fixture();
  f.citations = [{ citationLabel: 'W1', sourceId: 'technical-source', url: 'https://example.org/evidence', title: 'Technical source' }];
  assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), deconstruction: 'Source [W1] : https://example.org/evidence.' }), f);
  assert.throws(() => assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), deconstruction: 'https://invented.example.org/source' }), f),
    reason('unknown-source-url'));
  f.draft += '\nSource fournie : https://example.org/original';
  assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), deconstruction: 'https://example.org/original' }), f);
});

test('missing deconstruction fails closed, while an explicit unresolved issue remains visible and does not complete', () => {
  const f = fixture();
  assert.throws(() => assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), deconstruction: '' }), f), reason('missing-deconstruction'));
  assertFinalizationProviderOutput(JSON.stringify({ ...properOutput(), deconstruction: '', issues: ['Une preuve manque.'] }), f);
  const done = completedFixture();
  done.history.at(-1).autopilot.output.issues = ['Une preuve manque.'];
  assert.equal(validFinalizationEvidence(done), false);
});

test('missing/failed/cross-run Verification cannot produce finalization context or unlock deconstruction', () => {
  for (const change of [
    f => { f.state.workReview = undefined; },
    f => { f.history = []; },
    f => { f.history[0].autopilot.output.taskFulfillment.fulfilled = false; },
    f => { f.history[0].autopilot.runId = 'another-run'; },
    f => { f.history[0].professorPhase = 'METHOD'; },
    f => { f.history[0].autopilot.output.taskFulfillment.reviewedDraftFingerprint = hash('other-draft'); },
  ]) {
    const f = completedFixture(); change(f);
    assert.throws(() => buildFinalizationContext(f), reason('verification-missing-or-stale'));
    assert.equal(validFinalizationEvidence(f), false);
  }
});

test('finalization provenance binds draft bytes, revision, sources and the exact accepted Verification reply', () => {
  const f = completedFixture();
  assert.equal(validFinalizationEvidence(f), true);
  for (const change of [
    n => { n.revision += 1; },
    n => { n.draft += '\n'; },
    n => { n.sources = [{ id: 'new-source', kind: 'document' }]; },
    n => { n.state.workReview.replyId = 'another-verifier'; },
    n => { n.history.at(-1).autopilot.runId = 'another-run'; },
    n => { n.history.at(-1).autopilot.output.finalizationEvidence = undefined; },
  ]) { const changed = copy(f); change(changed); assert.equal(validFinalizationEvidence(changed), false); }
});

test('F5/relogin reload consumes the same persisted finalization receipt with no provider or mutable state', () => {
  const f = completedFixture(); const before = copy(f);
  for (let attempt = 0; attempt < 3; attempt += 1) assert.equal(validFinalizationEvidence(JSON.parse(JSON.stringify(f))), true);
  assert.deepEqual(f, before);
});

test('method proposals remain explicitly non-execution evidence and do not manufacture corrections', () => {
  const f = fixture();
  f.history.push({ id: 'method-proposal', role: 'assistant', professorPhase: 'METHOD',
    autopilot: { runId: f.state.runId, output: { text: 'Vérifier les deux opérations.' } } });
  f.history.push({ id: 'ignored-other-run', role: 'assistant', professorPhase: 'METHOD',
    autopilot: { runId: 'another-run', output: { text: 'Invented unrelated method.' } } });
  const context = buildFinalizationContext(f);
  assert.match(context, /Vérifier les deux opérations/);
  assert.doesNotMatch(context, /Invented unrelated method/);
  assert.match(context, /"proposalIsNotExecutionEvidence":true/);
  assert.match(context, /"appliedCorrections":\[\]/);
});

test('only an applied owner-run COACHING change with matching undo receipt is a real correction', () => {
  const f = fixture();
  f.state.undo = { operationId: 'coaching-request', appliedRevision: 2, draft: { format: 'markdown', content: 'Ancien calcul erroné.' } };
  f.history.push({ id: 'coaching-applied', requestId: 'auto-coaching-request', role: 'assistant', professorPhase: 'COACHING',
    autopilot: { runId: f.state.runId, output: { text: 'Correction de l’addition.', draft: '12 € + 7 € = 19 €.' } } });
  const bound = JSON.parse(buildFinalizationContext(f).split('\n').slice(1).join('\n'));
  assert.equal(bound.appliedCorrections.length, 1);
  assert.equal(bound.appliedCorrections[0].previousDraft, 'Ancien calcul erroné.');
  assert.equal(bound.appliedCorrections[0].finalDraft, f.draft);
  const stale = copy(f); stale.state.undo.appliedRevision = 4;
  assert.match(buildFinalizationContext(stale), /"appliedCorrections":\[\]/);
});

test('deconstruction is unusable without a real bound finalization, even when a pedagogical string exists', () => {
  const f = completedFixture();
  f.history.at(-1).autopilot.output.finalizationEvidence = undefined;
  assert.equal(validFinalizationEvidence(f), false);
  assert.throws(() => assertFinalizationProviderOutput('{bad json', f), reason('invalid-json'));
});
