'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseAcceptanceAllowance,
  reconcileAcceptanceAllowances,
  activateAcceptanceAllowance,
  activeAcceptanceAllowance,
  reserveAcceptanceAllowance,
  settleAcceptanceAllowance,
} = require('../dist/workspaces/workspace-acceptance-allowance.js');

const NOW = '2026-10-20T12:00:00.000Z';
const rawConfig = (overrides = {}) => ({
  version: 1, acceptanceRunId: 'acceptance-window-01', ownerId: 'technical-owner-01',
  workspaceId: 'technical-workspace-01', runId: 'technical-autopilot-01',
  expectedHistoricalAiSteps: 6, expectedHistoricalMaxAiSteps: 6,
  authorizedAt: '2026-10-20T11:59:00.000Z', expiresAt: '2026-10-20T13:00:00.000Z',
  maxCalls: 3, maxCostUsd: '0.10', allowedPhases: ['VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'],
  provider: 'openai', model: 'configured-test-model', testOnly: true, ...overrides,
});
const config = (overrides = {}) => parseAcceptanceAllowance(JSON.stringify(rawConfig(overrides)), NOW);
const scope = (overrides = {}) => ({ ownerId: 'technical-owner-01', workspaceId: 'technical-workspace-01',
  runId: 'technical-autopilot-01', phase: 'VERIFICATION', now: NOW, ...overrides });
const initial = () => ({ version: 1, runId: 'technical-autopilot-01', status: 'PAUSED', aiSteps: 6,
  maxAiSteps: 6, correctionLoops: 1, maxCorrectionLoops: 1, receipts: [],
  stepGrant: { version: 1, grantId: 'historical-grant-01', workspaceId: 'technical-workspace-01',
    runId: 'technical-autopilot-01', fromMaxAiSteps: 5, maxAiSteps: 6, aiStepsAtGrant: 5,
    additionalAiSteps: 1, maxPromptBytes: 30_000, requestId: 'historical-resume-01', revision: 2,
    appliedAt: '2026-10-19T12:00:00.000Z' },
});
const activate = (state = initial(), conf = config(), context = scope()) =>
  activateAcceptanceAllowance(state, conf, context, 'authorized-resume-01');
const reserve = (state, index = 1, cost = '0.03', conf = config(), context = scope()) =>
  reserveAcceptanceAllowance(state, conf, context, `acceptance-request-${index}`, `acceptance:operation:${index}`, cost);
const settle = (state, index = 1, cost = '0.001', windowId = 'acceptance-window-01') =>
  settleAcceptanceAllowance(state, windowId, `acceptance-request-${index}`,
    { state: 'SETTLED', actualCostUsd: cost, ledgerOperationId: `ledger-operation-${index}` }, NOW);
const error = code => candidate => candidate?.code === code;
const last = state => state.acceptanceAllowances.at(-1);

test('Private config is exact, temporary and bounded; disabled or malformed values never authorize', () => {
  assert.equal(config().maxCostUsd, '0.1');
  for (const overrides of [
    { testOnly: false }, { provider: 'echo' }, { maxCalls: 4 }, { maxCalls: 0 },
    { maxCostUsd: '0.100000000001' }, { maxCostUsd: '0' }, { maxCostUsd: '-0.01' },
    { maxCostUsd: '1e-2' }, { maxCostUsd: 0.1 }, { model: '' }, { ownerId: 'short' },
    { allowedPhases: ['WORK'] }, { allowedPhases: ['VERIFICATION', 'VERIFICATION'] },
    { expiresAt: '2026-10-20T16:00:00.001Z' }, { authorizedAt: '2026-10-20T12:01:00.000Z' },
    { expiresAt: NOW }, { arbitraryFrontendOverride: true },
  ]) assert.equal(config(overrides), undefined, JSON.stringify(overrides));
  assert.equal(parseAcceptanceAllowance('{malformed', NOW), undefined);
  assert.equal(parseAcceptanceAllowance(undefined, NOW), undefined);
});

test('Normal production state remains exactly unchanged when no private allowance is configured', () => {
  const state = initial();
  const before = JSON.stringify(state);
  assert.equal(reconcileAcceptanceAllowances(state, undefined, scope()), state);
  assert.equal(activeAcceptanceAllowance(state, undefined, scope()), undefined);
  assert.equal(JSON.stringify(state), before);
  assert.equal(Object.hasOwn(state, 'acceptanceAllowances'), false);
});

test('An explicitly authorized new window does not reset the historical 6/6 or the consumed 5→6 grant', () => {
  const state = initial();
  const before = JSON.stringify(state);
  const active = activate(state);
  assert.equal(JSON.stringify(state), before);
  assert.equal(active.aiSteps, 6);
  assert.equal(active.maxAiSteps, 6);
  assert.deepEqual(active.stepGrant, state.stepGrant);
  assert.deepEqual(active.receipts, state.receipts);
  assert.equal(last(active).status, 'ACTIVE');
  assert.equal(last(active).reservations.length, 0);
  assert.equal(activeAcceptanceAllowance(active, config(), scope()).acceptanceRunId, 'acceptance-window-01');
});

test('GET/reconcile never activates a configured window; repeat resume never replenishes it', () => {
  const state = initial();
  assert.equal(reconcileAcceptanceAllowances(state, config(), scope()), state);
  const active = reserve(activate());
  const again = activateAcceptanceAllowance(active, config(), scope(), 'another-resume-01');
  assert.deepEqual(again, active);
  assert.equal(last(again).reservations.length, 1);
  assert.equal(last(again).authorizationRequestId, 'authorized-resume-01');
});

test('Owner, workspace, run, phase and historical counters isolate normal users', () => {
  for (const change of [{ ownerId: 'different-owner-01' }, { workspaceId: 'different-workspace-01' },
    { runId: 'different-run-01' }, { phase: 'WORK' }, { phase: 'COMPREHENSION' }]) {
    assert.equal(activeAcceptanceAllowance(activate(), config(), scope(change)), undefined);
    assert.throws(() => activate(initial(), config(), scope(change)), error('workspace_acceptance_not_authorized'));
  }
  for (const change of [{ aiSteps: 5 }, { maxAiSteps: 5 }, { status: 'COMPLETED' }, { status: 'STOPPED' }])
    assert.throws(() => activate({ ...initial(), ...change }), error('workspace_acceptance_not_authorized'));
});

test('Removing private authorization revokes it and a same-ID config change cannot re-arm it', () => {
  const active = activate();
  const revoked = reconcileAcceptanceAllowances(active, undefined, scope());
  assert.equal(last(revoked).status, 'REVOKED');
  assert.equal(activeAcceptanceAllowance(revoked, config(), scope()), undefined);
  assert.throws(() => activate(revoked), error('workspace_acceptance_rearm_blocked'));
  assert.throws(() => activate(active, config({ maxCostUsd: '0.09' })), error('workspace_acceptance_rearm_blocked'));
  assert.throws(() => activate(active, config({ model: 'different-configured-model' })), error('workspace_acceptance_rearm_blocked'));
});

test('Expiry is automatic and the run ending closes its allowance', () => {
  const active = activate();
  const later = scope({ now: '2026-10-20T13:00:00.000Z' });
  assert.equal(activeAcceptanceAllowance(active, config(), later), undefined);
  assert.equal(last(reconcileAcceptanceAllowances(active, undefined, later)).status, 'EXPIRED');
  for (const status of ['COMPLETED', 'STOPPED']) {
    const ended = reconcileAcceptanceAllowances({ ...active, status }, config(), scope());
    assert.equal(last(ended).status, 'COMPLETED');
    assert.throws(() => activate({ ...ended, status: 'PAUSED' }), error('workspace_acceptance_rearm_blocked'));
  }
});

test('Verification failure back to WORK, NEEDS_INPUT or PAUSED_ERROR closes the acceptance window', () => {
  const active = activate();
  assert.equal(last(reconcileAcceptanceAllowances(active, config(), scope({ phase: 'WORK' }))).status, 'FAILED');
  for (const status of ['NEEDS_INPUT', 'PAUSED_ERROR']) {
    const failed = reconcileAcceptanceAllowances({ ...active, status }, config(), scope());
    assert.equal(last(failed).status, 'FAILED');
    assert.equal(activeAcceptanceAllowance({ ...active, status }, config(), scope()), undefined);
    assert.throws(() => activate({ ...failed, status: 'PAUSED' }), error('workspace_acceptance_rearm_blocked'));
  }
  assert.equal(last(reconcileAcceptanceAllowances(active, config(), scope())).status, 'ACTIVE', 'manual pause alone is not a new run');
});

test('Reservation is immutable, idempotent and never allows a concurrent second provider call', () => {
  const active = activate();
  const before = JSON.stringify(active);
  const reserved = reserve(active);
  assert.equal(JSON.stringify(active), before);
  assert.equal(last(reserved).reservations[0].state, 'RESERVED');
  assert.equal(reserve(reserved), reserved);
  assert.throws(() => reserve(reserved, 1, '0.02'), error('workspace_acceptance_idempotency_conflict'));
  assert.throws(() => reserve(reserved, 2), error('workspace_acceptance_reservation_pending'));
  assert.equal(reserved.aiSteps, 6);
  assert.equal(reserved.maxAiSteps, 6);
});

test('Maximum three reservations is enforced independently of the historical production cap', () => {
  let state = activate();
  for (let index = 1; index <= 3; index++) state = settle(reserve(state, index), index);
  assert.equal(last(state).reservations.length, 3);
  assert.equal(last(state).status, 'EXHAUSTED');
  assert.equal(reserve(state, 3), state, 'completed request replay never creates a fourth slot');
  assert.equal(activeAcceptanceAllowance(state, config(), scope()), undefined);
  assert.throws(() => reserve(state, 4), error('workspace_acceptance_not_active'));
  assert.throws(() => activate(state), error('workspace_acceptance_rearm_blocked'));
  assert.equal(state.aiSteps, 6);
  assert.equal(state.maxAiSteps, 6);
});

test('Decimal12 USD checks enforce $0.10 before invocation without floating-point slack', () => {
  let state = settle(reserve(activate(), 1, '0.07'), 1, '0.06');
  assert.throws(() => reserve(state, 2, '0.040000000001'), error('workspace_acceptance_cost_limit'));
  state = settle(reserve(state, 2, '0.04'), 2, '0.04');
  assert.equal(last(state).status, 'EXHAUSTED');
  assert.equal(last(state).reservations[1].actualCostUsd, '0.04');
  assert.throws(() => reserve(activate(), 1, '0.100000000001'), error('workspace_acceptance_cost_limit'));
});

test('Settlement requires a ledger identity, happens once and preserves all historical records', () => {
  const reserved = reserve(activate());
  assert.throws(() => settleAcceptanceAllowance(reserved, 'acceptance-window-01', 'acceptance-request-1',
    { state: 'SETTLED', actualCostUsd: '0.001' }, NOW), error('workspace_acceptance_invalid_settlement'));
  const settled = settle(reserved);
  assert.equal(settle(settled), settled);
  assert.throws(() => settle(settled, 1, '0.002'), error('workspace_acceptance_already_settled'));
  assert.equal(last(settled).reservations[0].ledgerOperationId, 'ledger-operation-1');
  assert.equal(last(settled).reservations[0].actualCostUsd, '0.001');
  assert.deepEqual(settled.stepGrant, initial().stepGrant);
});

test('Unknown provider cost is never zero; it retains its reservation and blocks any replacement window', () => {
  const failed = settleAcceptanceAllowance(reserve(activate()), 'acceptance-window-01', 'acceptance-request-1',
    { state: 'UNKNOWN', ledgerOperationId: 'ledger-operation-1' }, NOW);
  assert.equal(last(failed).status, 'FAILED');
  assert.equal(last(failed).reservations[0].upperCostUsd, '0.03');
  assert.equal(last(failed).reservations[0].actualCostUsd, undefined);
  assert.equal(activeAcceptanceAllowance(failed, config(), scope()), undefined);
  assert.throws(() => activate(failed, config({ acceptanceRunId: 'acceptance-window-02' })),
    error('workspace_acceptance_previous_unsettled'));
});

test('A returned cost above its reserved upper bound fails closed while retaining the real cost', () => {
  const failed = settle(reserve(activate(), 1, '0.01'), 1, '0.011');
  assert.equal(last(failed).status, 'FAILED');
  assert.equal(last(failed).reservations[0].state, 'UNKNOWN');
  assert.equal(last(failed).reservations[0].actualCostUsd, '0.011');
  assert.throws(() => reserve(failed, 2), error('workspace_acceptance_not_active'));
});

test('Authoritative no-call closes the window without inventing provider usage', () => {
  const state = settleAcceptanceAllowance(reserve(activate()), 'acceptance-window-01', 'acceptance-request-1',
    { state: 'NOT_CALLED', actualCostUsd: '0' }, NOW);
  assert.equal(last(state).status, 'FAILED');
  assert.equal(last(state).reservations[0].state, 'NOT_CALLED');
  assert.equal(last(state).reservations[0].actualCostUsd, '0');
  assert.throws(() => settleAcceptanceAllowance(reserve(activate()), 'acceptance-window-01', 'acceptance-request-1',
    { state: 'NOT_CALLED' }, NOW), error('workspace_acceptance_invalid_settlement'));
});

test('A separately authorized new ID is allowed only after all previous calls are settled', () => {
  const first = settle(reserve(activate()));
  const nextConfig = config({ acceptanceRunId: 'acceptance-window-02' });
  const next = activate(first, nextConfig);
  assert.equal(next.acceptanceAllowances.length, 2);
  assert.equal(next.acceptanceAllowances[0].status, 'REVOKED');
  assert.equal(next.acceptanceAllowances[0].reservations.length, 1);
  assert.equal(last(next).status, 'ACTIVE');
  assert.equal(last(next).reservations.length, 0);
  assert.deepEqual(next.stepGrant, initial().stepGrant);
  assert.throws(() => activate(reserve(activate()), nextConfig), error('workspace_acceptance_previous_unsettled'));
});

test('Different windows cannot reuse a provider operation identity and erase its attribution', () => {
  const nextConfig = config({ acceptanceRunId: 'acceptance-window-02' });
  const state = activate(settle(reserve(activate())), nextConfig);
  assert.throws(() => reserve(state, 1, '0.03', nextConfig), error('workspace_acceptance_idempotency_conflict'));
});

test('The journal retains tombstones, refuses overflow, and does not evict consumed IDs', () => {
  let state = activate();
  for (let index = 2; index <= 32; index++) state = activate(state,
    config({ acceptanceRunId: `acceptance-window-${String(index).padStart(2, '0')}` }));
  assert.equal(state.acceptanceAllowances.length, 32);
  assert.equal(state.acceptanceAllowances[0].acceptanceRunId, 'acceptance-window-01');
  assert.equal(state.acceptanceAllowances[0].status, 'REVOKED');
  assert.throws(() => activate(state, config({ acceptanceRunId: 'acceptance-window-33' })),
    error('workspace_acceptance_journal_full'));
});

test('Malformed persisted allowance accounting is fail-closed rather than reset', () => {
  const state = activate();
  for (const alter of [
    window => { window.maxCalls = 99; },
    window => { window.configFingerprint = 'invalid'; },
    window => { window.reservations = [{ requestId: 'bad' }]; },
    window => { window.reservations = [null]; },
  ]) {
    const invalid = structuredClone(state);
    alter(last(invalid));
    assert.throws(() => activeAcceptanceAllowance(invalid, config(), scope()), error('workspace_acceptance_invalid_journal'));
  }
});
