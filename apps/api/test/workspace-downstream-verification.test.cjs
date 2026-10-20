'use strict';

require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { verificationExpectedCriteria, verificationResponseSchema, verificationProfessorDirective,
  normalizeVerificationProviderOutput } = require('../dist/workspaces/workspace-downstream-verification.js');
const { bindVerificationEvidence, findDraftAnchor } = require('../dist/workspaces/workspace-verification-evidence.js');
const { parseAutopilotOutput, taskFulfillmentIssues } = require('../dist/workspaces/workspace-autopilot.js');
const { realVerificationFixture } = require('./fixtures/workspace-verification-real.cjs');

const clone = value => structuredClone(value);
function fixture() {
  const real = realVerificationFixture();
  const output = { text: 'Contrôle indépendant du brouillon persistant.', taskFulfillment: {
    contractMatchesTask: true, fulfilled: true, scope: real.contract.scope,
    criterionReviews: real.contract.criteria.map(criterion => ({ criterionId: criterion.id,
      status: 'SATISFIED', fulfilled: true, reason: `Le texte satisfait ${criterion.id}.`, evidenceExcerpts: [real.draft] })),
    citationLabels: [], uncoveredRequirements: [],
  }, checkedPlanItemIds: [], issues: [], needsInput: '' };
  const context = { draft: real.draft, revision: real.currentRevision, sourceAvailable: false };
  const normalize = (value = output, override = {}) => normalizeVerificationProviderOutput(
    typeof value === 'string' ? value : JSON.stringify(value), real.contract, { ...context, ...override });
  const gate = value => taskFulfillmentIssues(value, real.contract, real.draft, [],
    { sourceAvailable: false, draftRevision: real.currentRevision });
  const bind = value => bindVerificationEvidence(parseAutopilotOutput(normalize(value)), real.contract,
    { draft: real.draft, revision: real.currentRevision, runId: real.runId, history: real.history });
  return { real, output, context, normalize, gate, bind };
}
function rejectReason(action, reason) {
  assert.throws(action, error => error.reason === reason, reason);
}

test('V schema requires all four IDs exactly once in count, explicit status, reasons and quotations', () => {
  const { real } = fixture();
  const schema = verificationResponseSchema(real.contract, false);
  assert.equal(schema.strict, true);
  const review = schema.schema.properties.taskFulfillment.properties.criterionReviews;
  assert.equal(review.minItems, 4); assert.equal(review.maxItems, 4);
  assert.deepEqual(review.items.properties.criterionId.enum, ['required-1', 'required-2', 'required-3', 'required-4']);
  assert.deepEqual(review.items.properties.status.enum, ['SATISFIED', 'PARTIAL', 'MISSING']);
  assert.ok(review.items.required.includes('evidenceExcerpts'));
  assert.equal(schema.schema.properties.draft, undefined);
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    assert.equal(node.type === 'null', false);
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort());
    }
    Object.values(node).forEach(value => Array.isArray(value) ? value.forEach(visit) : visit(value));
  };
  visit(schema.schema);
});

test('V directive includes the exact complete checklist and rejects historical success as proof', () => {
  const { real } = fixture();
  const directive = verificationProfessorDirective(real.contract, false);
  assert.match(directive, /EXPECTED_CRITERION_COUNT=4/);
  for (const criterion of real.contract.criteria) {
    assert.ok(directive.includes(criterion.id)); assert.ok(directive.includes(criterion.requirement));
  }
  assert.match(directive, /old WORK evidence or previous verdict is not proof of correctness/);
  assert.match(directive, /Separate quotations may jointly support one criterion/);
});

for (const count of [0, 1, 3]) {
  test(`raw ${count}/4 criteria are rejected before binding can append MISSING rows`, () => {
    const { output, normalize } = fixture();
    output.taskFulfillment.criterionReviews = output.taskFulfillment.criterionReviews.slice(0, count);
    rejectReason(() => normalize(), 'VERIFICATION_CRITERIA_COVERAGE');
  });
}

for (const mutation of ['duplicate', 'unknown']) {
  test(`raw four-row review with ${mutation} ID is rejected`, () => {
    const { output, normalize } = fixture();
    output.taskFulfillment.criterionReviews[3].criterionId = mutation === 'duplicate' ? 'required-1' : 'not-a-recorded-criterion';
    rejectReason(() => normalize(), 'VERIFICATION_CRITERIA_IDS');
  });
}

for (const status of [undefined, null, 'NOT_EVALUATED', 'NOT_EVALUABLE', 'INVALID_EVIDENCE']) {
  test(`raw status ${String(status)} never becomes SATISFIED by omission/default`, () => {
    const { output, normalize } = fixture();
    output.taskFulfillment.criterionReviews[0].status = status;
    rejectReason(() => normalize(), 'VERIFICATION_CRITERION_VERDICT_INVALID');
  });
}

test('all four fresh independent reviews retain draft revision/hash and pass existing authoritative gate', () => {
  const { output, bind, gate, real } = fixture();
  const snapshot = JSON.stringify(real);
  const bound = bind(output);
  assert.equal(bound.taskFulfillment.criterionReviews.length, 4);
  assert.ok(bound.taskFulfillment.criterionReviews.every(review => review.evidenceOrigin === 'VERIFIER_QUOTE'));
  assert.deepEqual(gate(bound), []);
  assert.equal(JSON.stringify(real), snapshot, 'no WORK, draft, instructions or historical evidence mutation');
});

for (const status of ['MISSING', 'PARTIAL']) {
  test(`${status} is recorded as a failed criterion, never omitted or upgraded by the trusted WORK index`, () => {
    const { output, bind, gate } = fixture();
    Object.assign(output.taskFulfillment.criterionReviews[2], { fulfilled: false, status, evidenceExcerpts: [] });
    output.taskFulfillment.fulfilled = false;
    const bound = bind(output);
    assert.equal(bound.taskFulfillment.criterionReviews[2].status, status);
    assert.equal(bound.taskFulfillment.criterionReviews[2].fulfilled, false);
    assert.ok(gate(bound).includes('task-criterion-unfulfilled'));
  });
}

test('a SATISFIED review with no real quotation is rejected even with exact trusted WORK metadata', () => {
  const { output, normalize } = fixture();
  output.taskFulfillment.criterionReviews[1].evidenceExcerpts = [];
  rejectReason(() => normalize(), 'VERIFICATION_SATISFIED_WITHOUT_EVIDENCE');
});

test('a null quote array is invalid even on a negative verdict, not treated as an omitted field', () => {
  const { output, normalize } = fixture();
  Object.assign(output.taskFulfillment.criterionReviews[0], { status: 'MISSING', fulfilled: false, evidenceExcerpts: null });
  rejectReason(() => normalize(), 'VERIFICATION_EXCERPTS_INVALID');
});

for (const quoteType of ['commentary', 'objective', 'ellipsis', 'synthetic']) {
  test(`${quoteType} is not substituted for persisted draft evidence`, () => {
    const { real, output, normalize } = fixture();
    const quotes = {
      commentary: 'The draft includes the detailed calculation and conclusion in euros as required.',
      objective: real.contract.criteria[3].requirement,
      ellipsis: 'Trois cahiers coûtent ... 19 euros.',
      synthetic: 'Le résultat vérifié est 19 € et toutes les exigences sont correctes.',
    };
    output.taskFulfillment.criterionReviews[1].evidenceExcerpts = [quotes[quoteType]];
    rejectReason(() => normalize(), 'VERIFICATION_EXCERPT_NOT_IN_DRAFT');
  });
}

test('one criterion may use several separate real spans rather than a fabricated joined quotation', () => {
  const { output, bind, gate, real } = fixture();
  output.taskFulfillment.criterionReviews[1].evidenceExcerpts = ['3 × 4 € = 12 €', '12 € + 7 € = 19 €'];
  const bound = bind(output);
  const anchors = bound.taskFulfillment.criterionReviews[1].evidenceAnchors;
  assert.equal(anchors.length, 2);
  assert.ok(anchors.every(anchor => real.draft.substring(anchor.startOffset, anchor.endOffset) === anchor.excerpt));
  assert.deepEqual(gate(bound), []);
});

test('explicit stale canonical anchors are rejected even with equal draft text', () => {
  const { output, normalize, real } = fixture();
  const review = output.taskFulfillment.criterionReviews[0];
  review.evidenceAnchors = [findDraftAnchor(real.draft, real.currentRevision - 1, real.draft)];
  rejectReason(() => normalize(), 'VERIFICATION_ANCHORS_INVALID');
});

test('explicit current canonical anchors and historical excerpt transport remain supported without bypass', () => {
  const { output, bind, gate, real } = fixture();
  for (const [index, review] of output.taskFulfillment.criterionReviews.entries()) {
    delete review.evidenceExcerpts;
    if (index % 2) review.evidenceAnchors = [findDraftAnchor(real.draft, real.currentRevision, real.draft)];
    else review.excerpt = real.draft;
  }
  assert.deepEqual(gate(bind(output)), []);
});

test('optional and inapplicable conditional requirements do not become mandatory verifier rows', () => {
  const { real, output, context } = fixture();
  const contract = clone(real.contract);
  contract.criteria.push({ id: 'optional-1', requirement: 'Option facultative.', required: false, classification: 'OPTIONAL', condition: 'NONE' });
  contract.criteria.push({ id: 'conditional-1', requirement: 'Source seulement si disponible.', required: true, classification: 'CONDITIONAL', condition: 'SOURCE_AVAILABLE' });
  assert.deepEqual(verificationExpectedCriteria(contract, false).map(row => row.id), real.contract.criteria.map(row => row.id));
  const parsed = parseAutopilotOutput(normalizeVerificationProviderOutput(JSON.stringify(output), contract, context));
  const bound = bindVerificationEvidence(parsed, contract, { draft: real.draft, revision: real.currentRevision, runId: real.runId, history: [] });
  assert.equal(bound.taskFulfillment.criterionReviews.length, 6, 'existing binder records omissions as MISSING, never successful');
  assert.deepEqual(taskFulfillmentIssues(bound, contract, real.draft, [], { sourceAvailable: false, draftRevision: real.currentRevision }), []);
  assert.equal(verificationExpectedCriteria(contract, true).length, 5);
  rejectReason(() => verificationExpectedCriteria(contract), 'VERIFICATION_APPLICABILITY_UNKNOWN');
});

test('required STYLE/FORMAT obligations remain in exact expected IDs', () => {
  const { real } = fixture();
  const contract = clone(real.contract);
  contract.criteria[1].classification = 'FORMAT'; contract.criteria[2].classification = 'STYLE';
  assert.equal(verificationExpectedCriteria(contract, false).length, 4);
});

test('malformed lists, null reasons and contradictory verdicts fail closed', () => {
  for (const edit of [
    row => { row.reason = null; }, row => { row.reason = ''; }, row => { row.fulfilled = false; },
    row => { row.evidenceExcerpts = null; }, row => { row.evidenceExcerpts = ['']; },
    row => { row.evidenceExcerpts = Array(9).fill('3 × 4 € = 12 €'); },
  ]) {
    const { output, normalize } = fixture(); edit(output.taskFulfillment.criterionReviews[0]);
    assert.throws(() => normalize());
  }
  const { output, normalize } = fixture(); output.taskFulfillment.criterionReviews[0] = null;
  rejectReason(() => normalize(), 'VERIFICATION_CRITERIA_IDS');
});

test('a verifier cannot regenerate or mutate the frozen WORK artifact through extra output fields', () => {
  const { output, normalize } = fixture(); output.draft = 'A replacement answer';
  rejectReason(() => normalize(), 'VERIFICATION_ARTIFACT_MUTATION_FORBIDDEN');
});

for (const [field, value] of Object.entries({ plan: [], briefFields: {},
  deconstruction: 'Premature final retrospective.', finalizationEvidence: {} })) {
  test(`raw verifier output cannot mutate ${field} even outside strict-schema transport`, () => {
    const { output, normalize } = fixture(); output[field] = value;
    rejectReason(() => normalize(), 'VERIFICATION_ARTIFACT_MUTATION_FORBIDDEN');
  });
}

test('the retained real omission is reproduced as a raw failure rather than a fabricated successful review', () => {
  const { output, normalize } = fixture();
  output.taskFulfillment.criterionReviews = output.taskFulfillment.criterionReviews.slice(0, 1);
  rejectReason(() => normalize(), 'VERIFICATION_CRITERIA_COVERAGE');
});

test('unknown and duplicate citationLabels are rejected before source presentation normalization', () => {
  for (const labels of [['W99'], ['W1', 'W1']]) {
    const { output, normalize } = fixture(); output.taskFulfillment.citationLabels = labels;
    rejectReason(() => normalize(output, { citations: [{ citationLabel: 'W1', url: 'https://example.test/authorized' }] }),
      'VERIFICATION_SOURCE_LABELS_INVALID');
  }
});

for (const field of ['text', 'issues', 'needsInput']) {
  test(`unknown source label in raw ${field} cannot be hidden by AW-6 label stripping`, () => {
    const { output, normalize } = fixture();
    output[field] = field === 'issues' ? ['Unsupported assertion [W99].'] : 'Unsupported assertion [W99].';
    rejectReason(() => normalize(), 'VERIFICATION_SOURCE_LABEL_UNKNOWN');
  });
}

test('a real recorded citation label and its actual URL are retained in verifier commentary', () => {
  const { output, normalize } = fixture();
  output.taskFulfillment.citationLabels = ['W1'];
  output.text = 'Source utilisée [W1] : https://example.test/authorized.';
  const normalized = JSON.parse(normalize(output, { citations: [{ citationLabel: 'W1', url: 'https://example.test/authorized' }] }));
  assert.equal(normalized.text, output.text);
  assert.deepEqual(normalized.taskFulfillment.citationLabels, ['W1']);
});

test('unknown source URLs in verifier text are rejected rather than presented as real citations', () => {
  const { output, normalize } = fixture(); output.text = 'Source : https://fabricated.test/unsupported.';
  rejectReason(() => normalize(), 'VERIFICATION_SOURCE_URL_UNKNOWN');
});

test('URLs genuinely present in the persisted draft remain allowed without invented bibliography', () => {
  const { output, normalize, real } = fixture();
  const draft = `${real.draft}\nhttps://example.test/actual-draft-source`;
  output.text = 'Référence du brouillon : https://example.test/actual-draft-source.';
  assert.equal(JSON.parse(normalize(output, { draft })).text, output.text);
});
