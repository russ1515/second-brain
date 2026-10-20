'use strict';
require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { AcademicWorkspaceService } = require('../dist/workspaces/academic-workspace.service.js');
const { initialWorkspaceAutopilotState, initialWorkspaceProfessorState } = require('@second-brain/shared');
const { activateAcceptanceAllowance, reconcileAcceptanceAllowances } = require('../dist/workspaces/workspace-acceptance-allowance.js');
const { realVerificationFixture } = require('./fixtures/workspace-verification-real.cjs');
const copy = (value) => structuredClone(value);
const code = (error) => error?.getResponse?.().code ?? error?.code;

// Serialized in-memory application seams only. No HTTP, DB or provider transport.
function fixture({ active = true, phase = 'VERIFICATION' } = {}) {
  const historical = realVerificationFixture();
  const now = new Date();
  const owner = 'technical-acceptance-owner';
  const authorization = {
    version: 1, acceptanceRunId: 'technical-acceptance-window-01', ownerId: owner,
    workspaceId: historical.workspaceId, runId: historical.runId,
    expectedHistoricalAiSteps: 6, expectedHistoricalMaxAiSteps: 6,
    authorizedAt: new Date(now.getTime() - 1_000).toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
    maxCalls: 3, maxCostUsd: '0.10', allowedPhases: ['VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'],
    provider: 'openai', model: 'configured-acceptance-fixture-model', testOnly: true,
  };
  const values = { WORKSPACE_SCOPED_ACCEPTANCE_ALLOWANCE: JSON.stringify(authorization), 'llm.model': authorization.model };
  const state = initialWorkspaceAutopilotState(historical.runId, 6, 1, now.toISOString());
  Object.assign(state, { aiSteps: 6, status: 'PAUSED', correctionLoops: 1,
    workIntent: 'assignment-exercise', workContract: copy(historical.contract),
    stepGrant: { version: 1, grantId: 'historical-grant-0001', workspaceId: historical.workspaceId,
      runId: historical.runId, fromMaxAiSteps: 5, maxAiSteps: 6, aiStepsAtGrant: 5,
      additionalAiSteps: 1, maxPromptBytes: 50_000, requestId: 'historical-resume-0001', revision: 2, appliedAt: now.toISOString() },
    receipts: [{ requestId: 'historical-resume-0001', fingerprint: 'a'.repeat(64), action: 'resume', status: 'completed',
      createdAt: now.toISOString(), stepGrantId: 'historical-grant-0001' }],
  });
  const professor = { ...initialWorkspaceProfessorState(3, historical.draftFingerprint), currentPhase: phase, phaseSequence: 4 };
  const brief = { version: 1, fields: { userInstructions: historical.instructions,
    requirements: historical.contract.criteria[1].requirement, deliverable: historical.contract.criteria[2].requirement,
    subject: 'Calcul de prix — exercice court', context: 'Exercice scolaire de calcul, réalisé sur un compte technique pour validation.' } };
  const row = { id: historical.workspaceId, userId: owner, template: 'assignment',
    objective: historical.contract.criteria[3].requirement, status: 'active', mode: 'guide',
    sources: [], plan: [], draftContent: historical.draft, draftFormat: 'markdown', autosaveRevision: 3,
    progress: { completedSteps: [], workflow: { brief, professor, autopilot: state } },
    assistantHistory: historical.history.map(entry => ({ ...entry, content: '' })),
  };
  const service = Object.create(AcademicWorkspaceService.prototype);
  const calls = { price: [], ledger: [], llm: [], perform: [] };
  let ledger;
  const pricing = { id: 'technical-pricing-0001', currency: 'USD', inputTokenPrice: new Prisma.Decimal('0.0000004'),
    cachedInputTokenPrice: new Prisma.Decimal('0.0000001'), outputTokenPrice: new Prisma.Decimal('0.0000016') };
  service.config = { get: (key) => values[key] };
  service.prisma = { profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    providerPricingVersion: { findFirst: async (query) => { calls.price.push(query); return pricing; } },
    providerUsageOperation: { findUnique: async (query) => { calls.ledger.push(query); return ledger; } } };
  service.sourceEngine = { resolve: async () => ({ usedContext: false, context: '', citations: [], sources: [] }),
    validateReply: (content) => ({ content, citations: [] }) };
  const current = () => row.progress.workflow.autopilot;
  const phaseScope = () => ({ ownerId: owner, workspaceId: row.id, runId: current().runId,
    phase: row.progress.workflow.professor.currentPhase, now: new Date() });
  const view = () => ({ id: row.id, progress: copy(row.progress), professor: copy(row.progress.workflow.professor),
    draft: { content: row.draftContent, format: row.draftFormat }, autosaveRevision: row.autosaveRevision });
  let tail = Promise.resolve();
  service.changeAutopilot = (userId, id, change, internal) => {
    const task = tail.then(() => {
      assert.equal(userId, owner); assert.equal(id, row.id);
      if (internal) service.assertAutopilotExecution(row.progress, internal);
      const changed = change(copy(row), copy(row.progress), copy(current()));
      row.progress.workflow.autopilot = reconcileAcceptanceAllowances(changed.state, service.scopedAcceptanceConfig(), phaseScope());
      return view();
    });
    tail = task.catch(() => undefined); return task;
  };
  service.get = async (userId, id) => { assert.equal(userId, owner); assert.equal(id, row.id); return view(); };
  service.performAutopilotStep = async (_owner, _id, execution) => { calls.perform.push(copy(execution)); return view(); };
  function setExecution(requestId = 'technical-acceptance-step-01') {
    current().status = 'RUNNING';
    current().activeRequest = { requestId, status: 'pending', phase: professor.currentPhase, revision: 3,
      createdAt: new Date().toISOString(), acceptanceRunId: authorization.acceptanceRunId };
    return { workspaceId: row.id, runId: current().runId, requestId, expectedRevision: 3, acceptanceRunId: authorization.acceptanceRunId };
  }
  if (active) {
    row.progress.workflow.autopilot = activateAcceptanceAllowance(current(), service.scopedAcceptanceConfig(), phaseScope(), 'technical-window-authorize-01');
    current().status = 'RUNNING';
  }
  function ledgerFor(reservation, changes = {}) {
    const operation = { id: 'technical-ledger-operation-01', userId: owner, requestId: reservation.context.requestId,
      feature: 'ACADEMIC_WORKSPACE', resource: 'ACADEMIC_AI', status: 'SUCCEEDED', quotaReservationId: 'existing-commercial-reservation',
      metadata: { acceptanceRunId: authorization.acceptanceRunId, workspaceId: row.id, autopilotRunId: current().runId,
        phase: reservation.context.phase },
      attempts: [{ attemptNumber: 1, status: 'SUCCEEDED', costStatus: 'MEASURED', provider: 'openai',
        model: authorization.model, pricingVersionId: pricing.id, referenceAmountUsd: new Prisma.Decimal('0.00002'),
        inputTokens: 10, cachedInputTokens: 0, outputTokens: 10 }],
      ...changes };
    ledger = operation; return operation;
  }
  service.llm = { activeProvider: 'openai', generate: async (messages, options, context) => {
    const reserved = current().acceptanceAllowances[0].reservations.find(item => item.operationId === context.operationId);
    assert.equal(reserved?.state, 'RESERVED', 'durable technical ceiling precedes the fake transport');
    calls.llm.push({ messages: copy(messages), options: copy(options), context: copy(context) });
    ledgerFor({ context });
    return { provider: 'openai', model: options.model, text: JSON.stringify(historical.verificationOutput) };
  } };
  return { service, row, owner, historical, authorization, values, pricing, calls, current, view, setExecution, ledgerFor,
    setLedger: value => { ledger = value; } };
}

const shortMessages = [{ role: 'user', content: 'A short deterministic acceptance prompt.' }];
const reserve = (f, execution, messages = shortMessages) => f.service.reserveAutopilotAcceptanceCost(f.owner, f.row,
  f.row.progress.workflow.professor, execution, messages, 1500);
const window = (f) => f.current().acceptanceAllowances[0];
const preserved = (f) => { assert.equal(f.current().aiSteps, 6); assert.equal(f.current().maxAiSteps, 6);
  assert.equal(f.current().stepGrant.grantId, 'historical-grant-0001'); assert.equal(f.row.autosaveRevision, 3); };

test('real generator seam reserves before its mock LLM and attributes the unchanged frozen draft without historical credit reset', async () => {
  const f = fixture(); const execution = f.setExecution();
  const draft = f.row.draftContent, contract = copy(f.current().workContract), grant = copy(f.current().stepGrant);
  const generated = await f.service.generateProfessorAssist(f.owner, f.row,
    { action: 'check-coherence', requestId: execution.requestId, message: 'Deterministic acceptance fixture only.' },
    execution.requestId, 'acceptance-fixture-fingerprint', f.row.progress.workflow.professor, execution);
  assert.equal(f.calls.llm.length, 1); assert.equal(f.calls.price.length, 1);
  assert.deepEqual(f.calls.price[0].where.model, f.authorization.model);
  assert.equal(Object.hasOwn(f.calls.price[0].where, 'currency'), false, 'select the current version before checking USD');
  const call = f.calls.llm[0];
  assert.equal(call.options.model, f.authorization.model); assert.equal(call.options.maxOutputTokens, 1500);
  assert.equal(call.options.operation, 'workspace-assistant');
  assert.deepEqual(call.context, { operationId: window(f).reservations[0].operationId, userId: f.owner,
    requestId: execution.requestId, acceptanceRunId: f.authorization.acceptanceRunId,
    workspaceId: f.row.id, autopilotRunId: execution.runId, phase: 'VERIFICATION', requiredPricingVersionId: f.pricing.id });
  assert.equal(window(f).reservations[0].state, 'SETTLED');
  assert.equal(window(f).reservations[0].actualCostUsd, '0.00002');
  assert.equal(f.row.draftContent, draft); assert.deepEqual(f.current().workContract, contract); assert.deepEqual(f.current().stepGrant, grant);
  assert.equal(generated.reply.autopilot.output.taskFulfillment.reviewedDraftFingerprint, f.historical.draftFingerprint);
  preserved(f);
});

test('same reservation is idempotent and another request cannot spend while the first ceiling is outstanding', async () => {
  const f = fixture(); const execution = f.setExecution();
  const first = await reserve(f, execution); const second = await reserve(f, execution);
  assert.equal(first.context.operationId, second.context.operationId); assert.equal(window(f).reservations.length, 1);
  const next = f.setExecution('technical-acceptance-step-02');
  await assert.rejects(() => reserve(f, next), error => code(error) === 'workspace_acceptance_reservation_pending');
  assert.equal(window(f).reservations.length, 1); assert.equal(f.calls.llm.length, 0); preserved(f);
});

test('missing rates, unknown model, revoked scope, oversized prompt, WORK and expensive quote fail before mock transport', async () => {
  for (const mutate of [
    f => { f.pricing.inputTokenPrice = null; }, f => { f.pricing.cachedInputTokenPrice = null; },
    f => { f.values['llm.model'] = 'unquoted-model'; }, f => { f.values.WORKSPACE_SCOPED_ACCEPTANCE_ALLOWANCE = ''; },
    f => { f.service.llm.activeProvider = 'echo'; }, f => { f.row.progress.workflow.professor.currentPhase = 'WORK'; },
    f => { f.pricing.inputTokenPrice = new Prisma.Decimal('1'); },
  ]) {
    const f = fixture(); const execution = f.setExecution(); mutate(f);
    await assert.rejects(() => reserve(f, execution)); assert.equal(window(f).reservations.length, 0); assert.equal(f.calls.llm.length, 0); preserved(f);
  }
  const f = fixture(); const execution = f.setExecution();
  await assert.rejects(() => reserve(f, execution, [{ role: 'user', content: 'x'.repeat(50_001) }]));
  assert.equal(f.calls.price.length, 0); assert.equal(window(f).reservations.length, 0);
});

test('a current non-USD version is refused, not skipped to quote an older USD version', async () => {
  const f = fixture(); const execution = f.setExecution(); f.pricing.currency = 'EUR';
  await assert.rejects(() => reserve(f, execution), error => code(error) === 'workspace_acceptance_pricing_required');
  assert.equal(f.calls.price.length, 1);
  assert.equal(Object.hasOwn(f.calls.price[0].where, 'currency'), false);
  assert.equal(f.calls.price[0].where.model, f.authorization.model);
  assert.deepEqual(f.calls.price[0].orderBy, { effectiveFrom: 'desc' });
  assert.equal(window(f).reservations.length, 0); assert.equal(f.calls.llm.length, 0); preserved(f);
});

test('settlement uses one exact measured ledger attempt and releases only the unused technical ceiling once', async () => {
  const f = fixture(); const execution = f.setExecution(); const reservation = await reserve(f, execution);
  const upper = new Prisma.Decimal(window(f).reservations[0].upperCostUsd);
  assert.ok(upper.gt('0.00002')); f.ledgerFor(reservation);
  await f.service.settleAutopilotAcceptanceCost(f.owner, f.row.id, execution, reservation);
  await f.service.settleAutopilotAcceptanceCost(f.owner, f.row.id, execution, reservation);
  assert.deepEqual(f.calls.ledger[0], { where: { idempotencyKey: reservation.context.operationId }, include: { attempts: true } });
  assert.equal(window(f).reservations.length, 1); assert.equal(window(f).reservations[0].actualCostUsd, '0.00002');
  assert.equal(window(f).reservations[0].ledgerOperationId, 'technical-ledger-operation-01'); preserved(f);
});

test('unknown or mismatched accounting retains the upper ceiling and closes the scoped window, never as free zero cost', async () => {
  for (const mutate of [
    operation => { operation.status = 'FINALIZATION_PENDING'; },
    operation => { operation.attempts[0].costStatus = 'UNKNOWN'; operation.attempts[0].referenceAmountUsd = null; },
    operation => { operation.attempts[0].model = 'different-model'; },
    operation => { operation.metadata.workspaceId = 'different-workspace'; },
    operation => { operation.userId = 'different-owner'; },
    operation => { operation.attempts[0].pricingVersionId = 'different-pricing-version'; },
    operation => { operation.attempts[0].inputTokens = 100_000; },
    operation => { operation.attempts[0].outputTokens = 1501; },
    operation => { operation.attempts.push({ ...operation.attempts[0] }); },
  ]) {
    const f = fixture(); const execution = f.setExecution(); const reservation = await reserve(f, execution);
    const held = window(f).reservations[0].upperCostUsd; const operation = f.ledgerFor(reservation); mutate(operation);
    await assert.rejects(() => f.service.settleAutopilotAcceptanceCost(f.owner, f.row.id, execution, reservation),
      error => code(error) === 'workspace_acceptance_cost_unsettled');
    assert.equal(window(f).status, 'FAILED'); assert.equal(window(f).reservations[0].state, 'UNKNOWN');
    assert.equal(window(f).reservations[0].upperCostUsd, held); assert.equal(window(f).reservations[0].actualCostUsd, undefined); preserved(f);
  }
});

test('ordinary non-acceptance execution does not query pricing, ledger or change any counters', async () => {
  const f = fixture({ active: false });
  assert.equal(await reserve(f, undefined), undefined);
  assert.equal(await reserve(f, { runId: f.current().runId, requestId: 'ordinary-execution-01' }), undefined);
  assert.equal(f.calls.price.length, 0); assert.equal(f.calls.ledger.length, 0); assert.equal(f.current().acceptanceAllowances, undefined); preserved(f);
});

test('authenticated resume and step select the private allowance but preserve the consumed historical 6/6 and grant', async () => {
  const f = fixture({ active: false }); const grant = copy(f.current().stepGrant);
  await f.service.autopilot(f.owner, f.row.id, { action: 'resume', requestId: 'technical-window-resume-01', expectedRevision: 3 });
  assert.equal(window(f).status, 'ACTIVE'); assert.equal(window(f).authorizationRequestId, 'technical-window-resume-01');
  await f.service.autopilot(f.owner, f.row.id, { action: 'step', requestId: 'technical-window-step-0001', expectedRevision: 3 });
  assert.equal(f.calls.perform.length, 1); assert.equal(f.calls.perform[0].acceptanceRunId, f.authorization.acceptanceRunId);
  assert.equal(f.current().activeRequest.acceptanceRunId, f.authorization.acceptanceRunId);
  assert.deepEqual(f.current().stepGrant, grant); assert.equal(f.calls.price.length, 0); preserved(f);
});

test('client-supplied acceptanceRunId cannot create a window, and another normal owner stays under its own cap', async () => {
  const f = fixture({ active: false }); f.values.WORKSPACE_SCOPED_ACCEPTANCE_ALLOWANCE = '';
  await assert.rejects(() => f.service.autopilot(f.owner, f.row.id,
    { action: 'resume', requestId: 'forged-window-resume-01', expectedRevision: 3, acceptanceRunId: f.authorization.acceptanceRunId }));
  assert.equal(f.current().acceptanceAllowances, undefined); preserved(f);
  const other = fixture({ active: false });
  const privateAuthorization = JSON.parse(other.values.WORKSPACE_SCOPED_ACCEPTANCE_ALLOWANCE);
  privateAuthorization.ownerId = 'some-other-technical-owner'; privateAuthorization.workspaceId = 'some-other-workspace';
  other.values.WORKSPACE_SCOPED_ACCEPTANCE_ALLOWANCE = JSON.stringify(privateAuthorization);
  other.current().aiSteps = 2;
  await other.service.autopilot(other.owner, other.row.id, { action: 'resume', requestId: 'ordinary-owner-resume-01', expectedRevision: 3 });
  assert.equal(other.current().status, 'RUNNING'); assert.equal(other.current().aiSteps, 2);
  assert.equal(other.current().acceptanceAllowances, undefined); assert.equal(other.calls.price.length, 0);
});

test('the same terminated allowance ID cannot rearm through a later resume', async () => {
  const f = fixture(); window(f).status = 'EXHAUSTED'; window(f).closedAt = new Date().toISOString();
  await assert.rejects(() => f.service.autopilot(f.owner, f.row.id,
    { action: 'resume', requestId: 'same-window-rearm-0001', expectedRevision: 3 }), error => code(error) === 'workspace_acceptance_rearm_blocked');
  assert.equal(window(f).status, 'EXHAUSTED'); assert.equal(window(f).reservations.length, 0); preserved(f);
});

test('cached output and deterministic deconstruction step do not allocate an acceptance call', async () => {
  for (const phase of ['VERIFICATION', 'DECONSTRUCTION']) {
    const f = fixture({ active: false, phase }); f.values.WORKSPACE_SCOPED_ACCEPTANCE_ALLOWANCE = '';
    f.current().status = 'RUNNING';
    if (phase === 'VERIFICATION') {
      f.current().pendingResult = { replyId: 'cached-fixture-reply-01', phase, phaseSequence: 4, revision: 3 };
      f.row.assistantHistory.push({ id: 'cached-fixture-reply-01', autopilot: { runId: f.current().runId } });
    }
    await f.service.autopilot(f.owner, f.row.id,
      { action: 'step', requestId: `no-call-${phase.toLowerCase()}-0001`, expectedRevision: 3 });
    assert.equal(f.calls.perform.length, 1); assert.equal(f.calls.perform[0].acceptanceRunId, undefined);
    assert.equal(f.calls.price.length, 0); assert.equal(f.current().acceptanceAllowances, undefined); preserved(f);
  }
});
