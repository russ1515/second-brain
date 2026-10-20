'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { AcademicWorkspaceService } = require('../dist/workspaces/academic-workspace.service.js');
const { workspaceProgressFromPlan } = require('@second-brain/shared');
const { realVerificationFixture } = require('./fixtures/workspace-verification-real.cjs');

// Reuse the existing transaction/CAS/rollback and owner-scoped Prisma harness,
// without executing or registering its unrelated tests and without duplicating
// that mock database. The explicit boundary makes a changed fixture fail loudly.
const fixtureFile = path.join(__dirname, 'academic-workspace-hardening.test.cjs');
const fixtureSource = fs.readFileSync(fixtureFile, 'utf8');
const fixtureBoundary = fixtureSource.indexOf("\ntest('same owner, idempotency key");
assert.ok(fixtureBoundary > 0, 'existing shared harness boundary must remain explicit');
const fixtureModule = new Module(fixtureFile, module);
fixtureModule.filename = fixtureFile;
fixtureModule.paths = Module._nodeModulePaths(path.dirname(fixtureFile));
fixtureModule._compile(fixtureSource.slice(0, fixtureBoundary)
  + '\nmodule.exports = { createHarness, httpStatus };', fixtureFile);
const { createHarness, httpStatus } = fixtureModule.exports;
const hash = value => createHash('sha256').update(value).digest('hex');
const clone = value => structuredClone(value);
const auto = workspace => workspace.progress.workflow.autopilot;

async function persistedDraftFixture(options = {}) {
  const retained = realVerificationFixture();
  retained.currentRevision = options.revision ?? retained.currentRevision;
  const harness = createHarness();
  harness.state.failures = [];
  const originalFailureCode = harness.service.autopilotFailureCode.bind(harness.service);
  harness.service.autopilotFailureCode = error => {
    harness.state.failures.push(error);
    return originalFailureCode(error);
  };
  const workspace = await harness.service.create('owner', {
    title: 'Calcul de prix — exercice court', template: 'assignment', objective: retained.contract.criteria[3].requirement,
    requestId: 'downstream-existing-draft-create', initialContent: retained.draft, sources: [],
    brief: { version: 1, fields: {
      subject: 'Calcul de prix — exercice court', userInstructions: retained.instructions,
      requirements: retained.contract.criteria[1].requirement, deliverable: retained.contract.criteria[2].requirement,
      context: 'Exercice scolaire de calcul, réalisé sur un compte technique pour validation.',
    } },
  });
  const row = harness.state.workspaces[0];
  row.autosaveRevision = retained.currentRevision;
  row.plan = clone(options.plan ?? [{ id: 'downstream-answer-step', title: 'Calcul et conclusion', order: 0, stepId: 'drafting', completed: false }]);
  row.assistantHistory = clone(retained.history).map(entry => ({ ...entry,
    content: 'Le draft réel a été produit et validé.', createdAt: new Date().toISOString() }));
  const professor = { ...workspace.professor, currentPhase: 'VERIFICATION', phaseSequence: 6,
    phaseEnteredRevision: retained.currentRevision, phaseEnteredDraftFingerprint: hash(retained.draft) };
  const base = auto(workspace);
  row.progress = workspaceProgressFromPlan(row.plan, { ...row.progress.workflow, professor,
    autopilot: { ...base, runId: retained.runId, consent: true, status: 'RUNNING', aiSteps: 0, maxAiSteps: 5,
      correctionLoops: 0, maxCorrectionLoops: 0, receipts: [], workContract: clone(retained.contract),
      workIntent: 'assignment-exercise', activeRequest: undefined, pendingResult: undefined } });
  harness.state.phaseCalls = [];
  harness.state.transform = options.transform;
  harness.state.llmResponder = (_messages, _options, state) => {
    const phase = state.workspaces[0].progress.workflow.professor.currentPhase;
    state.phaseCalls.push(phase);
    let output;
    if (phase === 'VERIFICATION') {
      output = { text: 'Le calcul et la conclusion répondent aux quatre critères.', issues: [],
        checkedPlanItemIds: state.workspaces[0].plan.map(item => item.id), taskFulfillment: {
          scope: 'entire-task', fulfilled: true, contractMatchesTask: true, citationLabels: [],
          criterionReviews: retained.contract.criteria.map(criterion => ({ criterionId: criterion.id,
            fulfilled: true, status: 'SATISFIED', reason: 'Le calcul et la conclusion sont présents.', excerpt: retained.draft })),
        } };
    } else if (phase === 'FINALIZATION') {
      output = { text: 'Le travail est prêt : le résultat conservé est 19 euros.',
        issues: [], needsInput: '',
        deconstruction: 'Nous avons multiplié le prix unitaire par la quantité, ajouté le livre et contrôlé les unités. '
          + 'Pour un autre achat, séparer les sous-totaux puis les additionner. Aucun résultat ni source ajouté.' };
    } else {
      throw new Error(`frozen upstream phase unexpectedly called: ${phase}`);
    }
    return JSON.stringify(state.transform ? state.transform(output, phase, state) : output);
  };
  return { ...harness, retained, workspace: await harness.service.get('owner', workspace.id) };
}

async function command(harness, workspace, suffix, extra = {}) {
  return harness.service.autopilot('owner', workspace.id, { action: 'step', requestId: `downstream-${suffix}`,
    expectedRevision: workspace.autosaveRevision, ...extra });
}

function assertFrozen(workspace, retained) {
  assert.equal(workspace.draft.content, retained.draft);
  assert.equal(hash(workspace.draft.content), retained.draftFingerprint);
  assert.equal(workspace.brief.fields.userInstructions, retained.instructions);
  assert.equal(auto(workspace).workContract.instructionFingerprint, retained.contract.instructionFingerprint);
}

async function reload(harness, workspace) {
  // New service instance + same already-authorized owner is F5/reconnection
  // persistence simulation, not a claim that browser OTP/login was executed.
  harness.service = new AcademicWorkspaceService(harness.prisma, harness.llm, harness.sourceEngine);
  const result = await harness.service.get('owner', workspace.id);
  assert.equal(result.professor.currentPhase, workspace.professor.currentPhase);
  assert.equal(result.autosaveRevision, workspace.autosaveRevision);
  assert.deepEqual(result.completion.snapshots, workspace.completion.snapshots);
  assertFrozen(result, harness.retained);
  return result;
}

test('Full downstream uses one existing persisted draft through V/F/D/completion, export and owner-scoped reload', async () => {
  const harness = await persistedDraftFixture();
  let workspace = await reload(harness, harness.workspace);
  const initialHistory = clone(workspace.assistantHistory);
  workspace = await command(harness, workspace, 'full-verification');
  assert.equal(workspace.professor.currentPhase, 'FINALIZATION', JSON.stringify(auto(workspace))
    + harness.state.failures.map(error => error.stack).join('\n'));
  assert.ok(auto(workspace).workReview);
  assertFrozen(workspace, harness.retained);
  workspace = await reload(harness, workspace);
  workspace = await command(harness, workspace, 'full-finalization');
  assert.equal(workspace.professor.currentPhase, 'DECONSTRUCTION', JSON.stringify(auto(workspace)));
  assert.equal(workspace.status, 'completed');
  assert.equal(auto(workspace).status, 'COMPLETED');
  assert.equal(auto(workspace).activeRequest, undefined, 'final snapshot and request completion must settle atomically');
  assert.equal(auto(workspace).receipts.at(-1).status, 'completed');
  assert.equal(workspace.completion.snapshots.length, 1);
  assert.equal(workspace.completion.snapshots[0].draft.content, harness.retained.draft);
  assert.equal(harness.state.sessions[0].status, 'completed');
  assert.deepEqual(workspace.assistantHistory.slice(0, initialHistory.length), initialHistory);
  assert.deepEqual(harness.state.phaseCalls, ['VERIFICATION', 'FINALIZATION']);
  assert.equal(harness.state.llmCalls, 2, 'Deconstruction reuses the persisted bounded retrospective, no gratuitous third call');
  workspace = await reload(harness, workspace);
  const snapshotId = workspace.completion.snapshots[0].id;
  const markdown = await harness.service.export('owner', workspace.id,
    { requestId: 'downstream-markdown-export', snapshotId, format: 'markdown', locale: 'fr' });
  const pdf = await harness.service.export('owner', workspace.id,
    { requestId: 'downstream-pdf-export', snapshotId, format: 'pdf', locale: 'fr' });
  assert.match(markdown.content, /12 € \+ 7 € = 19 €/);
  assert.match(pdf.html, /12 € \+ 7 € = 19 €/);
  assert.equal(pdf.mimeType, 'application/pdf');
  assert.doesNotMatch(pdf.html, /<(?:button|input|textarea)\b/i);
  assert.doesNotMatch(markdown.content, /downstream-full-|Continuer|Supprimer|<button/);
  assert.match(pdf.html, /dir="ltr"/);
  const rtl = await harness.service.export('owner', workspace.id,
    { requestId: 'downstream-pdf-export-rtl', snapshotId, format: 'pdf', locale: 'he' });
  assert.match(rtl.html, /dir="rtl"/);
  assert.match(rtl.html, /19 euros/);
  await assert.rejects(harness.service.get('intruder', workspace.id), error => httpStatus(error) === 404);
  await assert.rejects(harness.service.export('intruder', workspace.id,
    { requestId: 'downstream-foreign-export', snapshotId, format: 'markdown' }), error => httpStatus(error) === 404);
  const calls = harness.state.llmCalls;
  const frozenSnapshot = clone(workspace.completion.snapshots[0]);
  workspace = await reload(harness, workspace);
  await assert.rejects(command(harness, workspace, 'terminal-no-regenerate'), error => httpStatus(error) === 409);
  const terminal = await harness.service.get('owner', workspace.id);
  assert.equal(auto(terminal).status, 'COMPLETED');
  assert.equal(harness.state.llmCalls, calls);
  assert.deepEqual(terminal.completion.snapshots[0], frozenSnapshot);
});

const retainedSevenStepPlan = [
  'Analyze the instructions',
  'Check the evaluation rubric',
  'Gather evidence and data',
  'Build a detailed outline for the calculation and conclusion',
  'Draft the detailed calculation and conclusion',
  'Review accuracy and coherence',
  'Complete delivery and submission checks',
].map((title, order) => ({ id: `downstream-retained-plan-${order}`, title, order, stepId: 'drafting', completed: false }));

test('Full downstream retains and verifies the existing seven-step plan at revision 4 without reconstructing WORK', async () => {
  const harness = await persistedDraftFixture({ revision: 4, plan: retainedSevenStepPlan });
  let workspace = await command(harness, harness.workspace, 'seven-plan-verification');
  assert.equal(workspace.professor.currentPhase, 'FINALIZATION', JSON.stringify(auto(workspace)));
  assert.deepEqual(workspace.plan.map(item => ({ ...item, completed: false })), retainedSevenStepPlan);
  assert.equal(workspace.plan.filter(item => item.completed).length, 7);
  const verification = workspace.assistantHistory.find(entry => entry.professorPhase === 'VERIFICATION').autopilot.output;
  assert.deepEqual(verification.checkedPlanItemIds, retainedSevenStepPlan.map(item => item.id));
  assert.equal(verification.taskFulfillment.criterionReviews.length, 4);
  assert.ok(verification.taskFulfillment.criterionReviews.every(review => review.evidenceAnchors.every(anchor => anchor.revision === 4)));
  workspace = await reload(harness, workspace);
  workspace = await command(harness, workspace, 'seven-plan-finalization');
  assert.equal(workspace.status, 'completed');
  assert.equal(auto(workspace).status, 'COMPLETED');
  assert.equal(auto(workspace).activeRequest, undefined);
  assert.equal(workspace.completion.snapshots.length, 1);
  assert.equal(workspace.completion.snapshots[0].plan.filter(item => item.completed).length, 7);
  assertFrozen(workspace, harness.retained);
  await reload(harness, workspace);
  assert.deepEqual(harness.state.phaseCalls, ['VERIFICATION', 'FINALIZATION']);
});

test('Downstream Verification and Finalization receive the complete persisted draft including its tail beyond 12000 characters', async () => {
  const original = realVerificationFixture();
  const tail = 'TAIL_AFTER_12000: la conclusion finale demeure 19 euros et ne doit jamais être tronquée.';
  const harness = await persistedDraftFixture({ transform: (output, phase) => {
    if (phase === 'VERIFICATION') {
      for (const review of output.taskFulfillment.criterionReviews) review.excerpt = original.draft;
    }
    return output;
  } });
  const longDraft = `${'Contexte pédagogique conservé.\n'.repeat(420)}\n${original.draft}\n\n${tail}`;
  assert.ok(longDraft.indexOf(tail) > 12000);
  harness.retained.draft = longDraft;
  harness.retained.draftFingerprint = hash(longDraft);
  harness.state.workspaces[0].draftContent = longDraft;
  let workspace = await harness.service.get('owner', harness.workspace.id);
  workspace = await command(harness, workspace, 'long-draft-verification');
  assert.equal(workspace.professor.currentPhase, 'FINALIZATION', JSON.stringify(auto(workspace)));
  workspace = await command(harness, workspace, 'long-draft-finalization');
  assert.equal(workspace.status, 'completed', JSON.stringify(auto(workspace)));
  assert.equal(harness.state.llmMessages.length, 2);
  for (const [index, messages] of harness.state.llmMessages.entries()) {
    const context = messages.at(-1).content;
    assert.ok(context.includes(`Current draft:\n${longDraft}`), `phase ${index} receives the full exact persisted answer`);
    assert.ok(context.includes(tail), `phase ${index} retains the terminal passage`);
    assert.equal(harness.state.llmOptions[index].jsonSchema.strict, true);
  }
  assertFrozen(workspace, harness.retained);
  assert.equal(workspace.completion.snapshots[0].draft.content, longDraft);
});

test('All four task criteria SATISFIED do not fabricate the unchecked seventh retained plan item or complete the work', async () => {
  const harness = await persistedDraftFixture({ revision: 4, plan: retainedSevenStepPlan,
    transform: (output, phase) => {
      if (phase === 'VERIFICATION') output.checkedPlanItemIds = output.checkedPlanItemIds.slice(0, 6);
      return output;
    } });
  const workspace = await command(harness, harness.workspace, 'six-of-seven-plan-verification');
  assert.notEqual(workspace.status, 'completed');
  assert.notEqual(workspace.professor.currentPhase, 'FINALIZATION');
  assert.equal(workspace.completion.snapshots.length, 0);
  assert.equal(workspace.plan.filter(item => item.completed).length, 6);
  assert.equal(workspace.plan[6].completed, false);
  assert.equal(auto(workspace).status, 'NEEDS_INPUT');
  assertFrozen(workspace, harness.retained);
  const reloaded = await reload(harness, workspace);
  assert.equal(reloaded.plan[6].completed, false);
  assert.equal(harness.state.llmCalls, 1);
});

const coverageFailures = {
  '4 expected / 1 returned': reviews => reviews.slice(0, 1),
  '4 expected / 3 returned': reviews => reviews.slice(0, 3),
  'duplicate criterion': reviews => [reviews[0], reviews[0], ...reviews.slice(2)],
  'unknown criterion': reviews => [{ ...reviews[0], criterionId: 'unknown' }, ...reviews.slice(1)],
  'null criterion': reviews => [{ ...reviews[0], criterionId: null }, ...reviews.slice(1)],
  'one MISSING criterion': reviews => [{ ...reviews[0], fulfilled: false, status: 'MISSING', excerpt: '' }, ...reviews.slice(1)],
};
for (const [name, transform] of Object.entries(coverageFailures)) {
  test(`Downstream Verification fails closed for ${name}, preserving the real draft and no final snapshot`, async () => {
    const harness = await persistedDraftFixture({ transform: (output, phase) => {
      if (phase === 'VERIFICATION') output.taskFulfillment.criterionReviews = transform(output.taskFulfillment.criterionReviews);
      return output;
    } });
    const result = await command(harness, harness.workspace, `coverage-${Object.keys(coverageFailures).indexOf(name)}`);
    assert.notEqual(result.professor.currentPhase, 'FINALIZATION');
    assert.notEqual(result.status, 'completed');
    assert.equal(result.completion.snapshots.length, 0);
    assert.equal(auto(result).workReview, undefined);
    assertFrozen(result, harness.retained);
    assert.equal(harness.state.llmCalls, 1);
    await reload(harness, result);
  });
}

test('Downstream concurrent duplicate Verification is idempotent and a competing stale command never replays provider', async () => {
  const harness = await persistedDraftFixture();
  const request = { action: 'step', requestId: 'downstream-concurrent-verification', expectedRevision: harness.workspace.autosaveRevision };
  const results = await Promise.allSettled([
    harness.service.autopilot('owner', harness.workspace.id, request),
    harness.service.autopilot('owner', harness.workspace.id, request),
  ]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  assert.equal(harness.state.llmCalls, 1);
  let current = await harness.service.get('owner', harness.workspace.id);
  const transitionCount = current.professor.transitions.length;
  await harness.service.autopilot('owner', current.id, request);
  current = await harness.service.get('owner', current.id);
  assert.equal(current.professor.transitions.length, transitionCount);
  assert.equal(harness.state.llmCalls, 1);
  await assert.rejects(command(harness, current, 'stale-competing-verification', { expectedRevision: harness.workspace.autosaveRevision }),
    error => httpStatus(error) === 409);
  assert.equal(harness.state.llmCalls, 1);
  assertFrozen(current, harness.retained);
});

test('Downstream evidence spans use exact persisted text and survive Verification persistence and reload', async () => {
  const harness = await persistedDraftFixture({ transform: (output, phase) => {
    if (phase === 'VERIFICATION') {
      for (const review of output.taskFulfillment.criterionReviews) {
        delete review.excerpt;
        review.evidenceExcerpts = ['3 × 4 € = 12 €', '12 € + 7 € = 19 €'];
      }
    }
    return output;
  } });
  const result = await command(harness, harness.workspace, 'multi-anchor-verification');
  assert.equal(result.professor.currentPhase, 'FINALIZATION', JSON.stringify(auto(result)));
  const reply = result.assistantHistory.find(entry => entry.professorPhase === 'VERIFICATION');
  const reviews = reply.autopilot.output.taskFulfillment.criterionReviews;
  assert.equal(reviews.length, 4);
  for (const review of reviews) {
    assert.equal(review.evidenceAnchors.length, 2);
    for (const anchor of review.evidenceAnchors) {
      assert.equal(anchor.source, 'draft');
      assert.equal(anchor.revision, harness.retained.currentRevision);
      assert.equal(anchor.draftFingerprint, harness.retained.draftFingerprint);
      assert.equal(harness.retained.draft.slice(anchor.startOffset, anchor.endOffset), anchor.excerpt);
    }
  }
  await reload(harness, result);
});

for (const source of ['commentary', 'objective', 'prompt', 'method']) {
  test(`Downstream Verification cannot use ${source} as persisted draft evidence`, async () => {
    const harness = await persistedDraftFixture({ transform: (output, phase) => {
      if (phase === 'VERIFICATION') output.taskFulfillment.criterionReviews[0].evidenceAnchors = [{
        source, revision: 3, startOffset: 0, endOffset: 4, excerpt: 'fake', draftFingerprint: '0'.repeat(64),
      }];
      return output;
    } });
    const result = await command(harness, harness.workspace, `evidence-not-${source}`);
    assert.notEqual(result.professor.currentPhase, 'FINALIZATION');
    assert.equal(auto(result).workReview, undefined);
    assert.equal(result.completion.snapshots.length, 0);
    assertFrozen(result, harness.retained);
  });
}

test('Downstream Verification cannot accept a synthetic quotation or an explicit stale draft anchor', async () => {
  for (const kind of ['synthetic', 'stale']) {
    const harness = await persistedDraftFixture({ transform: (output, phase) => {
      if (phase === 'VERIFICATION') {
        const review = output.taskFulfillment.criterionReviews[0];
        if (kind === 'synthetic') {
          review.excerpt = 'Invented calculation and invented conclusion not present in the answer.';
          review.evidenceExcerpts = [review.excerpt];
        } else review.evidenceAnchors = [{ source: 'draft', revision: 2, startOffset: 0,
          endOffset: 5, excerpt: 'Trois', draftFingerprint: harness.retained.draftFingerprint }];
      }
      return output;
    } });
    // Without a historical evidence index there is no permitted fallback from
    // a fake quote to any independently anchored older WORK excerpt.
    harness.state.workspaces[0].assistantHistory = [];
    const result = await command(harness, harness.workspace, `invalid-quote-${kind}`);
    assert.notEqual(result.professor.currentPhase, 'FINALIZATION');
    assert.equal(auto(result).workReview, undefined);
    assert.equal(result.completion.snapshots.length, 0);
    assertFrozen(result, harness.retained);
  }
});

test('Downstream stale draft after Verification blocks Finalization before provider and preserves the newer learner edit', async () => {
  const harness = await persistedDraftFixture();
  const verified = await command(harness, harness.workspace, 'stale-draft-verification');
  assert.equal(verified.professor.currentPhase, 'FINALIZATION');
  const changed = `${verified.draft.content}\n\nAjout manuel nécessitant une nouvelle vérification.`;
  await harness.service.autosave('owner', verified.id, { workspaceId: verified.id,
    expectedRevision: verified.autosaveRevision, draft: { format: 'markdown', content: changed } });
  const latest = await harness.service.get('owner', verified.id);
  const result = await command(harness, latest, 'stale-draft-finalization');
  assert.equal(auto(result).status, 'NEEDS_INPUT');
  assert.equal(result.completion.snapshots.length, 0);
  assert.equal(result.draft.content, changed);
  assert.equal(harness.state.llmCalls, 1);
});

for (const phase of ['VERIFICATION', 'FINALIZATION']) {
  test(`Downstream a learner edit during ${phase} wins CAS and cannot receive stale validation or a final snapshot`, async () => {
    const harness = await persistedDraftFixture();
    let workspace = harness.workspace;
    if (phase === 'FINALIZATION') workspace = await command(harness, workspace, 'concurrent-edit-before-finalization');
    const targetCalls = harness.state.llmCalls + 1;
    let release;
    harness.state.llmBarrier = new Promise(resolve => { release = resolve; });
    const pending = command(harness, workspace, `concurrent-edit-${phase.toLowerCase()}`);
    for (let turn = 0; harness.state.llmCalls < targetCalls && turn < 200; turn += 1) {
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(harness.state.llmCalls, targetCalls, 'mock provider reached deterministically');
    const changed = `${workspace.draft.content}\n\nNouvelle réponse confirmée pendant la vérification.`;
    await harness.service.autosave('owner', workspace.id, { workspaceId: workspace.id,
      expectedRevision: workspace.autosaveRevision, draft: { format: 'markdown', content: changed } });
    release();
    await pending;
    const result = await harness.service.get('owner', workspace.id);
    assert.equal(result.draft.content, changed);
    assert.equal(result.brief.fields.userInstructions, harness.retained.instructions);
    assert.equal(result.status, 'active');
    assert.equal(result.completion.snapshots.length, 0);
    assert.equal(auto(result).status, 'PAUSED_ERROR');
    assert.equal(harness.state.llmCalls, targetCalls);
  });
}

test('Downstream missing verified review prevents Finalization and Deconstruction without spending or completion', async () => {
  for (const phase of ['FINALIZATION', 'DECONSTRUCTION']) {
    const harness = await persistedDraftFixture();
    harness.state.workspaces[0].progress.workflow.professor.currentPhase = phase;
    const latest = await harness.service.get('owner', harness.workspace.id);
    const result = await command(harness, latest, `missing-review-${phase.toLowerCase()}`);
    assert.equal(auto(result).status, 'NEEDS_INPUT');
    assert.equal(result.status, 'active');
    assert.equal(result.completion.snapshots.length, 0);
    assert.equal(harness.state.llmCalls, 0);
    assertFrozen(result, harness.retained);
  }
});

test('Downstream Deconstruction requires a persisted matching Finalization, not merely a valid Verification', async () => {
  const harness = await persistedDraftFixture();
  const verified = await command(harness, harness.workspace, 'deconstruction-without-finalization-verify');
  const row = harness.state.workspaces[0];
  row.progress.workflow.professor.currentPhase = 'DECONSTRUCTION';
  row.progress.workflow.professor.phaseSequence += 1;
  const latest = await harness.service.get('owner', verified.id);
  const result = await command(harness, latest, 'deconstruction-without-finalization');
  assert.notEqual(result.status, 'completed');
  assert.equal(result.completion.snapshots.length, 0);
  assert.ok(['NEEDS_INPUT', 'PAUSED_ERROR'].includes(auto(result).status));
  assert.equal(harness.state.llmCalls, 1, 'missing finalization is discovered without another provider call');
  assertFrozen(result, harness.retained);
});

test('Downstream completed finalize receipts replay idempotently and concurrent repeats never duplicate a snapshot', async () => {
  const harness = await persistedDraftFixture();
  let workspace = await command(harness, harness.workspace, 'duplicate-finalize-verify');
  workspace = await command(harness, workspace, 'duplicate-finalize-complete');
  assert.equal(workspace.status, 'completed');
  const beforeRevision = workspace.autosaveRevision;
  const beforeSnapshot = clone(workspace.completion.snapshots[0]);
  const request = { requestId: 'downstream-finalize-idempotent-public', expectedRevision: beforeRevision };
  const [first, second] = await Promise.all([
    harness.service.finalize('owner', workspace.id, request),
    harness.service.finalize('owner', workspace.id, request),
  ]);
  assert.deepEqual(first.snapshot, beforeSnapshot);
  assert.deepEqual(second.snapshot, beforeSnapshot);
  const result = await reload(harness, await harness.service.get('owner', workspace.id));
  assert.equal(result.autosaveRevision, beforeRevision);
  assert.equal(result.completion.snapshots.length, 1);
  assert.equal(auto(result).activeRequest, undefined);
  assert.equal(auto(result).status, 'COMPLETED');
  assert.equal(harness.state.llmCalls, 2);
});

test('Downstream a crash after final snapshot commit cannot strand Autopilot RUNNING or duplicate completion on replay', async () => {
  const harness = await persistedDraftFixture();
  const verified = await command(harness, harness.workspace, 'atomic-close-verification');
  const realFinalize = harness.service.finalize.bind(harness.service);
  harness.service.finalize = async (...args) => {
    await realFinalize(...args);
    throw new Error('deterministic interruption immediately after finalization commit');
  };
  const request = { action: 'step', requestId: 'downstream-atomic-close-finalization', expectedRevision: verified.autosaveRevision };
  await harness.service.autopilot('owner', verified.id, request);
  let result = await harness.service.get('owner', verified.id);
  assert.equal(result.status, 'completed');
  assert.equal(auto(result).status, 'COMPLETED');
  assert.equal(auto(result).activeRequest, undefined);
  assert.equal(auto(result).receipts.at(-1).status, 'completed');
  assert.equal(result.completion.snapshots.length, 1);
  result = await reload(harness, result);
  const replay = await harness.service.autopilot('owner', result.id, request);
  assert.equal(auto(replay).status, 'COMPLETED');
  assert.equal(replay.completion.snapshots.length, 1);
  assert.equal(harness.state.llmCalls, 2);
  assertFrozen(replay, harness.retained);
});

test('Downstream interruption before snapshot persists Finalization/Deconstruction and resume completes without another provider call', async () => {
  const harness = await persistedDraftFixture();
  const verified = await command(harness, harness.workspace, 'deconstruction-resume-verification');
  harness.service.finalize = async () => { throw new Error('deterministic interruption before final snapshot transaction'); };
  let result = await command(harness, verified, 'deconstruction-resume-finalization');
  assert.equal(result.professor.currentPhase, 'DECONSTRUCTION');
  assert.equal(result.status, 'active');
  assert.equal(auto(result).status, 'PAUSED_ERROR');
  assert.equal(result.completion.snapshots.length, 0);
  assertFrozen(result, harness.retained);
  result = await reload(harness, result);
  result = await command(harness, result, 'deconstruction-resume', { action: 'resume' });
  result = await command(harness, result, 'deconstruction-resume-free-completion');
  assert.equal(result.status, 'completed');
  assert.equal(auto(result).status, 'COMPLETED');
  assert.equal(result.completion.snapshots.length, 1);
  assert.equal(harness.state.llmCalls, 2, 'the persisted Finalization retrospective is reused without regeneration');
  await reload(harness, result);
});

test('Downstream Finalization provider failure safely preserves the accepted review, draft and history without retry', async () => {
  const harness = await persistedDraftFixture();
  const verified = await command(harness, harness.workspace, 'provider-failure-verification');
  const frozenHistory = clone(verified.assistantHistory);
  const frozenReview = clone(auto(verified).workReview);
  harness.state.llmError = new Error('technical provider failure');
  const result = await command(harness, verified, 'provider-failure-finalization');
  assert.equal(auto(result).status, 'PAUSED_ERROR');
  assert.equal(result.professor.currentPhase, 'FINALIZATION');
  assert.equal(result.completion.snapshots.length, 0);
  assert.deepEqual(result.assistantHistory, frozenHistory);
  assert.deepEqual(auto(result).workReview, frozenReview);
  assertFrozen(result, harness.retained);
  assert.equal(harness.state.llmCalls, 2);
  await assert.rejects(command(harness, result, 'provider-failure-must-not-auto-retry'), error => httpStatus(error) === 409);
  assert.equal(harness.state.llmCalls, 2);
});

for (const [name, outputChange] of Object.entries({
  'missing deconstruction': output => { delete output.deconstruction; },
  'nonempty issues': output => { output.issues = ['Une contradiction reste à résoudre.']; },
  'proposed replacement draft': output => { output.draft = 'This must never replace the verified answer.'; },
  'fabricated citation': output => { output.deconstruction += ' According to [W99].'; },
  'fabricated source URL': output => { output.deconstruction += ' Source: https://invented.example/does-not-exist'; },
})) {
  test(`Downstream Finalization rejects ${name} without altering frozen draft or creating a final snapshot`, async () => {
    const harness = await persistedDraftFixture({ transform: (output, phase) => {
      if (phase === 'FINALIZATION') outputChange(output);
      return output;
    } });
    let workspace = await command(harness, harness.workspace, `finalization-${name.replaceAll(' ', '-')}-verify`);
    workspace = await command(harness, workspace, `finalization-${name.replaceAll(' ', '-')}`);
    assert.notEqual(workspace.status, 'completed');
    assert.equal(workspace.professor.currentPhase, 'FINALIZATION');
    assert.equal(workspace.completion.snapshots.length, 0);
    assertFrozen(workspace, harness.retained);
    assert.equal(harness.state.llmCalls, 2);
  });
}
