'use strict';

require('reflect-metadata');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const test = require('node:test');
const {
  bindVerificationEvidence,
  findDraftAnchor,
  validateVerificationAnchors,
} = require('../dist/workspaces/workspace-verification-evidence.js');
const { autopilotProfessorDirective, parseAutopilotOutput, taskFulfillmentIssues } = require('../dist/workspaces/workspace-autopilot.js');
const { AcademicWorkspaceService } = require('../dist/workspaces/academic-workspace.service.js');
const { realVerificationFixture } = require('./fixtures/workspace-verification-real.cjs');

const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => structuredClone(value);
function bind(fixture, output = fixture.verificationOutput, overrides = {}) {
  return bindVerificationEvidence(output, fixture.contract, {
    draft: fixture.draft, revision: fixture.currentRevision, runId: fixture.runId,
    history: fixture.history, ...overrides,
  });
}
function gate(fixture, output, overrides = {}) {
  return taskFulfillmentIssues(output, fixture.contract, fixture.draft, [], {
    sourceAvailable: false, draftRevision: fixture.currentRevision, ...overrides,
  });
}
function review(output, id) {
  return output.taskFulfillment.criterionReviews.find(item => item.criterionId === id);
}
function assertRealAnchor(draft, revision, anchor) {
  assert.equal(anchor.source, 'draft');
  assert.equal(anchor.revision, revision);
  assert.ok(Number.isSafeInteger(anchor.startOffset) && Number.isSafeInteger(anchor.endOffset));
  assert.ok(anchor.startOffset >= 0 && anchor.endOffset > anchor.startOffset && anchor.endOffset <= draft.length);
  assert.equal(draft.substring(anchor.startOffset, anchor.endOffset), anchor.excerpt);
  assert.equal(anchor.draftFingerprint, hash(draft));
  assert.equal(validateVerificationAnchors(draft, revision, [anchor]), true);
}

test('Retained real fixture freezes the actual 290-character WORK and the failed V result, without reconstructing missing provider content', () => {
  const fixture = realVerificationFixture();
  assert.equal(fixture.sourceSha, '5912ed56aaba642f0afd3c42a3da26fb07aad983');
  assert.equal(fixture.draft.length, 290);
  assert.equal(hash(fixture.draft), fixture.draftFingerprint);
  assert.equal(fixture.workOutput.workArtifactValidated, true);
  assert.equal(fixture.workOutput.draft, fixture.draft);
  assert.equal(fixture.contract.criteria.length, 4);
  assert.deepEqual(fixture.contract.criteria.map(item => item.id), ['required-1', 'required-2', 'required-3', 'required-4']);
  assert.ok(fixture.workOutput.workEvidence.every(item => item.excerpt === fixture.draft));
  assert.match(review(fixture.verificationOutput, 'required-2').excerpt, / \.\.\. /);
  assert.equal(review(fixture.verificationOutput, 'required-3').excerpt,
    'The draft includes the detailed calculation and conclusion in euros as required.');
  assert.equal(review(fixture.verificationOutput, 'required-4').excerpt, fixture.contract.criteria[3].requirement);
  const unbound = parseAutopilotOutput(JSON.stringify(fixture.verificationOutput));
  assert.ok(gate(fixture, unbound).includes('task-evidence-invalid'), 'historical rejection must remain reproducible before binding');
});

test('The exact failed V fixture is rebound to the frozen persisted draft, never to its commentary or objective', () => {
  const fixture = realVerificationFixture();
  const originalOutput = JSON.stringify(fixture.verificationOutput);
  const originalHistory = JSON.stringify(fixture.history);
  const bound = bind(fixture);
  assert.equal(JSON.stringify(fixture.verificationOutput), originalOutput, 'historical output is immutable');
  assert.equal(JSON.stringify(fixture.history), originalHistory, 'historical WORK metadata is immutable');
  assert.equal(bound.taskFulfillment.evidenceSource, 'PERSISTED_DRAFT');
  assert.equal(bound.taskFulfillment.draftRevision, 3);
  assert.equal(bound.taskFulfillment.draftFingerprint, fixture.draftFingerprint);
  assert.equal(bound.taskFulfillment.fulfilled, true, 'preserve the existing verdict, do not invent another');
  assert.deepEqual(bound.taskFulfillment.criterionReviews.map(item => item.status),
    ['SATISFIED', 'SATISFIED', 'SATISFIED', 'SATISFIED']);
  assert.equal(review(bound, 'required-1').evidenceOrigin, 'VERIFIER_QUOTE');
  for (const id of ['required-2', 'required-3', 'required-4']) {
    assert.equal(review(bound, id).evidenceOrigin, 'VALIDATED_WORK_INDEX');
    assert.ok(review(bound, id).evidenceAnchors.length);
  }
  for (const item of bound.taskFulfillment.criterionReviews) {
    for (const anchor of item.evidenceAnchors) assertRealAnchor(fixture.draft, 3, anchor);
  }
  assert.deepEqual(gate(fixture, bound), []);
});

test('Without the exact trusted WORK index, discontinuous quotes, commentary and objective stay invalid evidence', () => {
  const fixture = realVerificationFixture();
  const bound = bind(fixture, fixture.verificationOutput, { history: [] });
  assert.equal(review(bound, 'required-1').status, 'SATISFIED');
  for (const id of ['required-2', 'required-3', 'required-4']) {
    assert.equal(review(bound, id).status, 'INVALID_EVIDENCE');
    assert.ok(!review(bound, id).evidenceAnchors?.length);
  }
  assert.ok(gate(fixture, bound).includes('task-evidence-invalid'));
});

test('Exact contiguous anchors and whitespace-normalized quotes retain their real original offsets', () => {
  const fixture = realVerificationFixture();
  const quote = '3 × 4 € = 12 €';
  const anchor = findDraftAnchor(fixture.draft, 3, quote);
  assert.ok(anchor);
  assert.equal(anchor.startOffset, fixture.draft.indexOf(quote));
  assert.equal(anchor.endOffset, fixture.draft.indexOf(quote) + quote.length);
  assertRealAnchor(fixture.draft, 3, anchor);
  const whole = findDraftAnchor(fixture.draft, 3, review(fixture.verificationOutput, 'required-1').excerpt);
  assert.ok(whole);
  assert.equal(whole.startOffset, 0);
  assert.equal(whole.endOffset, fixture.draft.length);
  assert.equal(whole.excerpt, fixture.draft);
});

test('Separate evidence spans remain separate anchors, not a synthetic joined citation', () => {
  const fixture = realVerificationFixture();
  fixture.contract.criteria = fixture.contract.criteria.filter(item => item.id === 'required-2');
  fixture.verificationOutput.taskFulfillment.criterionReviews = [review(fixture.verificationOutput, 'required-2')];
  const pieces = ['3 × 4 € = 12 €', '12 € + 7 € = 19 €',
    'Conclusion : Le prix total à payer pour les trois cahiers et le livre est de 19 euros.'];
  const anchors = pieces.map(piece => findDraftAnchor(fixture.draft, 3, piece));
  assert.ok(anchors.every(Boolean));
  assert.equal(findDraftAnchor(fixture.draft, 3, pieces.join(' ... ')), undefined);
  fixture.verificationOutput.taskFulfillment.criterionReviews[0].evidenceAnchors = anchors;
  const bound = bind(fixture, fixture.verificationOutput, { history: [] });
  assert.equal(review(bound, 'required-2').status, 'SATISFIED');
  assert.equal(review(bound, 'required-2').evidenceAnchors.length, 3);
  assert.equal(validateVerificationAnchors(fixture.draft, 3, review(bound, 'required-2').evidenceAnchors), true);
  assert.deepEqual(gate(fixture, bound), []);
  assert.ok(anchors.every(anchor => fixture.draft.slice(anchor.startOffset, anchor.endOffset) === anchor.excerpt));
});

test('Synthetic ellipses do not become anchors, but a literal ellipsis actually present in a draft remains quotable', () => {
  const fixture = realVerificationFixture();
  assert.equal(findDraftAnchor(fixture.draft, 3, review(fixture.verificationOutput, 'required-2').excerpt), undefined);
  const draft = 'Le texte cite une hésitation : « Je ... je reprends. »';
  const anchor = findDraftAnchor(draft, 4, 'Je ... je reprends.');
  assert.ok(anchor);
  assertRealAnchor(draft, 4, anchor);
});

test('Invalid explicit anchors never fall back to otherwise trusted WORK evidence', () => {
  const fixture = realVerificationFixture();
  const good = findDraftAnchor(fixture.draft, 3, fixture.draft);
  assert.ok(good);
  const bad = [
    { ...good, revision: 2 },
    { ...good, startOffset: -1 },
    { ...good, startOffset: good.startOffset + 1 },
    { ...good, endOffset: fixture.draft.length + 1 },
    { ...good, startOffset: 0.5 },
    { ...good, excerpt: 'A fabricated quote not in the draft.' },
    { ...good, draftFingerprint: '0'.repeat(64) },
    { ...good, source: 'commentary' },
    { ...good, source: 'objective' },
    { ...good, source: 'prompt' },
    { ...good, source: 'method' },
  ];
  for (const anchor of bad) {
    assert.equal(validateVerificationAnchors(fixture.draft, 3, [anchor]), false);
    const output = copy(fixture.verificationOutput);
    review(output, 'required-2').evidenceAnchors = [anchor];
    const bound = bind(fixture, output);
    assert.equal(review(bound, 'required-2').status, 'INVALID_EVIDENCE');
    assert.notEqual(review(bound, 'required-2').evidenceOrigin, 'VALIDATED_WORK_INDEX');
    assert.ok(gate(fixture, bound).length);
  }
});

test('A correct anchor becomes stale after either a revision change or an answer edit', () => {
  const fixture = realVerificationFixture();
  const anchor = findDraftAnchor(fixture.draft, 3, '12 € + 7 € = 19 €');
  assert.ok(anchor);
  assert.equal(validateVerificationAnchors(fixture.draft, 3, [anchor]), true);
  assert.equal(validateVerificationAnchors(fixture.draft, 4, [anchor]), false);
  const modified = fixture.draft.replace('19 euros.', '20 euros.');
  assert.equal(validateVerificationAnchors(modified, 3, [anchor]), false, 'whole draft hash invalidates even an unchanged quoted passage');
  const rebound = findDraftAnchor(modified, 4, '12 € + 7 € = 19 €');
  assert.ok(rebound);
  assertRealAnchor(modified, 4, rebound);
  assert.notEqual(rebound.draftFingerprint, fixture.draftFingerprint);
});

test('Metadata-only revision advancement is explicitly rebound to the unchanged answer, never silently accepted as a stale anchor', () => {
  const fixture = realVerificationFixture();
  assert.equal(fixture.workRevision, 2);
  assert.equal(fixture.currentRevision, 3);
  assert.equal(hash(fixture.workOutput.draft), hash(fixture.draft));
  const atTwo = findDraftAnchor(fixture.draft, 2, fixture.draft);
  assert.ok(atTwo);
  assert.equal(validateVerificationAnchors(fixture.draft, 3, [atTwo]), false);
  const bound = bind(fixture);
  assert.ok(bound.taskFulfillment.criterionReviews.every(item => item.evidenceAnchors.every(anchor => anchor.revision === 3)));
  assert.deepEqual(gate(fixture, bound), []);
});

test('Negative, partial or missing verdicts cannot be upgraded by trusted WORK metadata', () => {
  const fixture = realVerificationFixture();
  for (const status of ['PARTIAL', 'MISSING', 'INVALID_EVIDENCE']) {
    const output = copy(fixture.verificationOutput);
    const item = review(output, 'required-2'); item.status = status;
    const bound = bind(fixture, output);
    assert.notEqual(review(bound, 'required-2').status, 'SATISFIED');
    assert.ok(gate(fixture, bound).length);
  }
  const refuted = copy(fixture.verificationOutput);
  review(refuted, 'required-2').fulfilled = false;
  const boundRefuted = bind(fixture, refuted);
  assert.equal(review(boundRefuted, 'required-2').fulfilled, false);
  assert.notEqual(review(boundRefuted, 'required-2').status, 'SATISFIED');
  assert.ok(gate(fixture, boundRefuted).includes('task-criterion-unfulfilled'));
  for (const field of ['fulfilled', 'contractMatchesTask']) {
    const output = copy(fixture.verificationOutput); output.taskFulfillment[field] = false;
    const bound = bind(fixture, output);
    assert.equal(bound.taskFulfillment[field], false);
    assert.notEqual(review(bound, 'required-2').evidenceOrigin, 'VALIDATED_WORK_INDEX');
    assert.ok(gate(fixture, bound).length);
  }
});

test('A missing criterion is not created from WORK, and an unknown or duplicate criterion never passes the final gate', () => {
  const fixture = realVerificationFixture();
  const missing = copy(fixture.verificationOutput);
  missing.taskFulfillment.criterionReviews = missing.taskFulfillment.criterionReviews.filter(item => item.criterionId !== 'required-2');
  const boundMissing = bind(fixture, missing);
  assert.equal(boundMissing.taskFulfillment.criterionReviews.filter(item => item.status === 'SATISFIED').length, 3);
  assert.equal(review(boundMissing, 'required-2').fulfilled, false);
  assert.equal(review(boundMissing, 'required-2').status, 'MISSING');
  assert.deepEqual(review(boundMissing, 'required-2').evidenceAnchors, []);
  assert.ok(gate(fixture, boundMissing).includes('task-criterion-unfulfilled'));
  const unknown = copy(fixture.verificationOutput);
  review(unknown, 'required-2').criterionId = 'not-a-recorded-criterion';
  const boundUnknown = bind(fixture, unknown);
  assert.notEqual(review(boundUnknown, 'not-a-recorded-criterion').status, 'SATISFIED');
  assert.notEqual(review(boundUnknown, 'not-a-recorded-criterion').evidenceOrigin, 'VALIDATED_WORK_INDEX');
  assert.ok(gate(fixture, boundUnknown).includes('task-criterion-invalid'));
  const duplicate = copy(fixture.verificationOutput);
  duplicate.taskFulfillment.criterionReviews.push(copy(review(duplicate, 'required-2')));
  const boundDuplicate = bind(fixture, duplicate);
  assert.ok(gate(fixture, boundDuplicate).includes('task-criterion-invalid'));
});

test('The WORK index cannot be reused across a different run, phase, contract or unvalidated artifact', () => {
  const mutations = [
    entry => { entry.role = 'user'; },
    entry => { entry.professorPhase = 'METHOD'; },
    entry => { entry.professorPhase = 'COMPREHENSION'; },
    entry => { entry.autopilot.runId = 'another-run'; },
    entry => { delete entry.autopilot.output.workArtifactValidated; },
    entry => { entry.autopilot.output.workArtifactValidated = false; },
    entry => { entry.autopilot.output.workContract.instructionFingerprint = '0'.repeat(64); },
    entry => { entry.autopilot.output.workContract.criteria[1].requirement = 'A different requirement.'; },
    entry => { entry.autopilot.output.workContract.criteria[1].required = false; },
    entry => { entry.autopilot.output.workContract.scope = 'current-section'; },
    entry => { entry.autopilot.output.draft += '\nA later change.'; },
    entry => { entry.autopilot.output.workEvidence[1].excerpt = 'Professor commentary, not the answer.'; },
    entry => { entry.autopilot.output.workEvidence.push(copy(entry.autopilot.output.workEvidence[1])); },
  ];
  for (const mutation of mutations) {
    const fixture = realVerificationFixture(); mutation(fixture.history[0]);
    const bound = bind(fixture);
    assert.notEqual(review(bound, 'required-2').status, 'SATISFIED');
    assert.notEqual(review(bound, 'required-2').evidenceOrigin, 'VALIDATED_WORK_INDEX');
    assert.ok(gate(fixture, bound).length);
  }
});

test('Changing or shortening the persisted answer invalidates the historical WORK index rather than certifying an incomplete answer', () => {
  const fixture = realVerificationFixture();
  const original = fixture.draft;
  fixture.draft = fixture.draft.slice(0, fixture.draft.indexOf('\n\nConclusion'));
  assert.notEqual(hash(fixture.draft), fixture.draftFingerprint);
  const bound = bind(fixture);
  assert.ok(bound.taskFulfillment.criterionReviews.some(item => item.status !== 'SATISFIED'));
  assert.ok(gate(fixture, bound).length);
  assert.equal(fixture.workOutput.draft, original, 'historical accepted evidence is preserved');
});

test('Unicode NFKC, CRLF, whitespace, mathematical punctuation and literal Markdown keep exact original offsets', () => {
  const draft = 'Préface 👩🏽‍🏫\r\n**Calcul** : ３ × ４ € = １２ €.\r\nConclusion\u00a0: total １９ €.';
  for (const excerpt of ['3 × 4 € = 12 €', '**Calcul**', 'Conclusion : total 19 €.', '👩🏽‍🏫']) {
    const anchor = findDraftAnchor(draft, 8, excerpt);
    assert.ok(anchor, excerpt);
    assertRealAnchor(draft, 8, anchor);
  }
  const spaced = findDraftAnchor('Calcul\r\n\r\n  détaillé :\t12 € + 7 € = 19 €.', 8, 'Calcul détaillé : 12 € + 7 € = 19 €.');
  assert.ok(spaced);
  assertRealAnchor('Calcul\r\n\r\n  détaillé :\t12 € + 7 € = 19 €.', 8, spaced);
  const compatibility = findDraftAnchor('La ligature est ﬁ.', 8, 'fi');
  assert.ok(compatibility);
  assert.equal(compatibility.excerpt, 'ﬁ');
  assertRealAnchor('La ligature est ﬁ.', 8, compatibility);
  assert.equal(findDraftAnchor('Calcul : 12 € - 7 € = 5 €.', 8, '12 € + 7 € = 5 €'), undefined,
    'normalisation must not erase the mathematical operator');
});

test('Anchors use UTF-16 offsets without splitting a surrogate pair or a joined emoji grapheme', () => {
  const draft = 'Avant 👩🏽‍🏫 après.';
  const quote = '👩🏽‍🏫'; const startOffset = draft.indexOf(quote);
  const anchor = findDraftAnchor(draft, 9, quote);
  assert.ok(anchor); assert.equal(anchor.startOffset, startOffset);
  assert.equal(anchor.endOffset, startOffset + quote.length);
  assertRealAnchor(draft, 9, anchor);
  for (const endOffset of [startOffset + 1, startOffset + 2, startOffset + 4, startOffset + 5]) {
    const forged = { ...anchor, endOffset, excerpt: draft.substring(startOffset, endOffset) };
    assert.equal(validateVerificationAnchors(draft, 9, [forged]), false, 'a matching slice is insufficient when it cuts a grapheme');
  }
});

test('Evidence collections fail closed on empty arrays, malformed values and non-positive revisions', () => {
  const fixture = realVerificationFixture();
  for (const anchors of [undefined, null, [], {}, [null], ['not-an-anchor']]) {
    assert.equal(validateVerificationAnchors(fixture.draft, 3, anchors), false);
  }
  assert.equal(findDraftAnchor(fixture.draft, 3, ''), undefined);
  assert.equal(findDraftAnchor(fixture.draft, -1, fixture.draft), undefined);
  assert.equal(findDraftAnchor(fixture.draft, 3.5, fixture.draft), undefined);
  const anchor = findDraftAnchor(fixture.draft, 3, fixture.draft);
  assert.ok(anchor);
  assert.equal(validateVerificationAnchors(fixture.draft, -1, [anchor]), false);
});

function serviceIntegrationFixture(withTrustedHistory, freshDraftQuotes = false) {
  const fixture = realVerificationFixture();
  const service = Object.create(AcademicWorkspaceService.prototype);
  const state = { version: 1, runId: fixture.runId, status: 'PAUSED', aiSteps: 6, maxAiSteps: 6,
    correctionLoops: 1, maxCorrectionLoops: 1, receipts: [], workIntent: 'assignment-exercise',
    workContract: copy(fixture.contract) };
  const brief = { version: 1, fields: { userInstructions: fixture.instructions,
    requirements: fixture.contract.criteria[1].requirement, deliverable: fixture.contract.criteria[2].requirement,
    subject: 'Calcul de prix — exercice court',
    context: 'Exercice scolaire de calcul, réalisé sur un compte technique pour validation.' } };
  // A unit-only row context, not a claim that the live post-failure WORK phase
  // was changed. The private generator is exercised without any reservation,
  // migration, provider, transition or database write.
  const row = { id: fixture.workspaceId, userId: 'technical-fixture-owner', template: 'assignment',
    objective: fixture.contract.criteria[3].requirement, status: 'active', mode: 'guide', sources: [], plan: [],
    draftContent: fixture.draft, draftFormat: 'markdown', autosaveRevision: 3,
    progress: { completedSteps: [], workflow: { brief, autopilot: state } },
    // Empty commentary is deliberate unit scaffolding, not invented historical
    // commentary. The trusted structured WORK projection itself is exact.
    assistantHistory: withTrustedHistory ? fixture.history.map(entry => ({ ...entry, content: '' })) : [] };
  const calls = { mockedLlm: 0, provider: 0, messages: [], options: [] };
  service.prisma = { profile: { findUnique: async ({ where }) => {
    assert.equal(where.userId, row.userId); return { preferredLanguage: 'fr' };
  } } };
  service.llm = { generate: async (messages, options) => {
    calls.mockedLlm += 1; calls.messages.push(copy(messages)); calls.options.push(copy(options));
    const response = copy(fixture.verificationOutput);
    response.taskFulfillment.criterionReviews = response.taskFulfillment.criterionReviews.map(item => ({
      ...item, status: 'SATISFIED', ...(freshDraftQuotes ? { excerpt: fixture.draft } : {}),
    }));
    return { text: JSON.stringify(response) };
  } };
  service.sourceEngine = {
    resolve: async (owner, references) => {
      assert.equal(owner, row.userId); assert.deepEqual(references, []);
      return { usedContext: false, context: '', citations: [], sources: [] };
    },
    validateReply: (content) => ({ content, citations: [] }),
  };
  const professor = { currentPhase: 'VERIFICATION', phaseSequence: 4 };
  const generate = () => service.generateProfessorAssist(row.userId, row,
    { action: 'check-coherence', requestId: 'technical-anchor-integration-request',
      message: 'Deterministic retained Verification fixture only.' },
    'technical-anchor-integration-request', 'deterministic-fixture-request-fingerprint', professor,
    { runId: fixture.runId, requestId: 'technical-anchor-integration-request', expectedRevision: 3 });
  return { fixture, row, calls, generate };
}

test('Generator integration mock independently verifies every criterion with fresh exact R3 draft quotations', async () => {
  const { fixture, row, calls, generate } = serviceIntegrationFixture(true, true);
  const beforeRow = JSON.stringify(row);
  const beforeWorkDirective = autopilotProfessorDirective('WORK', 'assignment', fixture.contract);
  const generated = await generate();
  const output = generated.reply.autopilot.output;
  assert.equal(calls.mockedLlm, 1); assert.equal(calls.provider, 0);
  assert.equal(calls.options[0].operation, 'workspace-assistant');
  assert.equal(calls.options[0].maxOutputTokens, 1500);
  assert.equal(calls.options[0].jsonSchema.name, 'workspace_verification_complete_v1');
  assert.equal(calls.options[0].jsonSchema.strict, true);
  const reviewsSchema = calls.options[0].jsonSchema.schema.properties.taskFulfillment.properties.criterionReviews;
  assert.equal(reviewsSchema.minItems, 4);
  assert.equal(reviewsSchema.maxItems, 4);
  assert.match(calls.messages[0].at(-1).content, /Professor phase: VERIFICATION/);
  assert.ok(calls.messages[0].at(-1).content.includes(`Current draft:\n${fixture.draft}`));
  assert.equal(autopilotProfessorDirective('WORK', 'assignment', fixture.contract), beforeWorkDirective);
  assert.equal(JSON.stringify(row), beforeRow, 'generator must not mutate the stored draft, instructions, contract, plan or history');
  assert.equal(output.taskFulfillment.draftRevision, 3);
  assert.equal(output.taskFulfillment.draftFingerprint, fixture.draftFingerprint);
  assert.equal(output.taskFulfillment.reviewedDraftFingerprint, fixture.draftFingerprint);
  assert.ok(output.taskFulfillment.criterionReviews.every(item => item.status === 'SATISFIED'));
  assert.deepEqual(gate(fixture, output), []);
});

test('Generator integration rejects raw commentary, objective and synthetic joined quotes before binding or publication', async () => {
  const { fixture, row, calls, generate } = serviceIntegrationFixture(false);
  const beforeRow = JSON.stringify(row);
  await assert.rejects(generate, error => error?.getResponse?.().reason === 'VERIFICATION_EXCERPT_NOT_IN_DRAFT');
  assert.equal(calls.mockedLlm, 1); assert.equal(calls.provider, 0);
  assert.equal(JSON.stringify(row), beforeRow);
  assert.equal(fixture.verificationOutput.taskFulfillment.criterionReviews.length, 4, 'historical raw failure fixture stays intact');
});
