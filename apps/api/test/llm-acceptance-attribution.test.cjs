require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { LlmService } = require('../dist/llm/llm.service.js');
const { ProviderMeteringService } = require('../dist/usage/provider-metering.service.js');
const { RequestContextService } = require('../dist/common/request-context.service.js');

// Entirely in memory: neither a provider transport nor a database is contacted.
const messages = [{ role: 'user', content: 'A deterministic fixture.' }];
const options = { operation: 'workspace-assistant', model: 'configured-fixture-model', maxOutputTokens: 1500 };
const scope = {
  operationId: 'acceptance-op-1', userId: 'technical-owner', requestId: 'technical-request',
  acceptanceRunId: 'acceptance-run-1', workspaceId: 'technical-workspace',
  autopilotRunId: 'historical-run', phase: 'VERIFICATION', requiredPricingVersionId: 'fixture-pricing',
};
const result = { provider: 'openai', model: options.model, text: 'Fixture only.',
  providerRequestId: 'fixture-provider-request', usage: { inputTokens: 12, outputTokens: 7, cachedTokens: 0 } };
const rejection = (error) => error?.getResponse?.().code === 'scoped_acceptance_attribution_required';

function inRequest(context, requestId, userId, callback) {
  return new Promise((resolve, reject) => context.run(requestId, () => {
    if (userId) context.authenticate(userId, 'fixture-session');
    Promise.resolve().then(callback).then(resolve, reject);
  }));
}

function fixture({ legacy = false, providerImplementation, omitMeter = false, providerName = 'openai' } = {}) {
  const context = new RequestContextService();
  const operations = [], attempts = [], reservations = new Map(), reserveCalls = [], finalizations = [], releases = [], providerCalls = [], pricingLookups = [];
  const pricing = {
    id: 'fixture-pricing', provider: 'openai', model: options.model, version: 1, currency: 'USD', sourceReference: 'deterministic-fixture',
    inputTokenPrice: new Prisma.Decimal('0.0000004'), cachedInputTokenPrice: new Prisma.Decimal('0.0000001'), outputTokenPrice: new Prisma.Decimal('0.0000016'),
  };
  const prisma = {
    plan: { findUniqueOrThrow: async () => ({ slug: 'fixture-plan', configurationVersion: 1 }) },
    providerUsage: {
      findUnique: async () => null,
      upsert: async ({ create }) => ({ id: `legacy-${create.internalOperationId}` }),
      update: async () => ({}),
    },
    providerUsageOperation: {
      create: async ({ data }) => {
        if (operations.some((item) => item.idempotencyKey === data.idempotencyKey)) {
          const error = new Prisma.PrismaClientKnownRequestError('Fixture unique operation.', { code: 'P2002', clientVersion: 'fixture' });
          throw error;
        }
        const row = { id: `operation-${operations.length + 1}`, status: 'STARTED', ...data };
        operations.push(row); return row;
      },
      update: async ({ where, data }) => Object.assign(operations.find((item) => item.id === where.id), data),
      findUniqueOrThrow: async ({ where }) => operations.find((item) => item.idempotencyKey === where.idempotencyKey),
    },
    providerUsageAttempt: {
      count: async ({ where }) => attempts.filter((item) => item.operationId === where.operationId).length,
      create: async ({ data }) => { const row = { id: `attempt-${attempts.length + 1}`, ...data }; attempts.push(row); return row; },
      update: async ({ where, data }) => Object.assign(attempts.find((item) => item.id === where.id), data),
      findMany: async ({ where }) => attempts.filter((item) => item.operationId === where.operationId && item.status === where.status),
    },
    providerPricingVersion: { findFirst: async (query) => { pricingLookups.push(query); return pricing; } },
  };
  if (legacy) { delete prisma.providerUsageOperation; delete prisma.providerUsageAttempt; delete prisma.providerPricingVersion; }
  const quotas = {
    reserve: async (input) => {
      reserveCalls.push(input);
      if (!reservations.has(input.idempotencyKey)) reservations.set(input.idempotencyKey, { id: `reservation-${reservations.size + 1}`, status: 'RESERVED', primaryUnits: 1, fallbackUnits: 0 });
      return reservations.get(input.idempotencyKey);
    },
    finalize: async (...args) => { finalizations.push(args); },
    release: async (...args) => { releases.push(args); },
  };
  const meter = new ProviderMeteringService(context, prisma, { resolveForUser: async () => ({ id: 'fixture-subscription', planId: 'fixture-plan', planVersion: 1 }) }, quotas, { ingest: async () => undefined });
  const provider = { name: providerName, generate: async (...args) => {
    providerCalls.push(args); return providerImplementation ? providerImplementation(...args) : result;
  } };
  const llm = new LlmService({ pickProvider: () => provider }, { recordAiCall: () => undefined, captureError: () => undefined }, omitMeter ? undefined : meter);
  return { context, meter, llm, operations, attempts, reserveCalls, finalizations, releases, providerCalls, pricing, pricingLookups };
}

test('private acceptance follows existing authenticated quota and immutable cost ledger once', async () => {
  const f = fixture();
  const response = await inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope));
  assert.deepEqual(response, result);
  assert.equal(f.providerCalls.length, 1);
  assert.deepEqual(f.providerCalls[0], [messages, options]);
  assert.equal(f.reserveCalls.length, 1);
  assert.equal(f.reserveCalls[0].resource, 'ACADEMIC_AI');
  assert.equal(f.reserveCalls[0].feature, 'ACADEMIC_WORKSPACE');
  assert.equal(f.reserveCalls[0].units, 1);
  assert.deepEqual(f.finalizations, [['reservation-1', 1]]);
  assert.deepEqual(f.releases, []);
  const expectedMetadata = { operation: 'workspace-assistant', acceptanceRunId: scope.acceptanceRunId,
    workspaceId: scope.workspaceId, autopilotRunId: scope.autopilotRunId, phase: scope.phase };
  assert.equal(f.operations[0].idempotencyKey, scope.operationId);
  assert.equal(f.operations[0].userId, scope.userId);
  assert.equal(f.operations[0].requestId, scope.requestId);
  assert.deepEqual(f.operations[0].metadata, expectedMetadata);
  assert.deepEqual(f.attempts[0].metadata, expectedMetadata);
  assert.equal(f.attempts[0].costStatus, 'MEASURED');
  assert.equal(f.attempts[0].referenceAmountUsd.toString(), '0.000016');
  assert.equal(f.pricingLookups.length, 2, 'quote guard plus existing measured pricing');
  assert.equal(f.pricingLookups[0].where.model, options.model);
  assert.strictEqual(f.pricingLookups[0].where.effectiveFrom.lte, f.pricingLookups[1].where.effectiveFrom.lte,
    'pre-call guard and measured cost must use the identical attempt instant');
  assert.equal(JSON.stringify(f.operations).includes('A deterministic fixture'), false);
  assert.equal(JSON.stringify(f.operations).includes('fixture-session'), false);
});

test('same scoped operation in flight deduplicates without a second reservation or provider invocation', async () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const f = fixture({ providerImplementation: async () => { await wait; return result; } });
  const first = inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope));
  const second = inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, { ...scope }));
  await new Promise(setImmediate); release();
  assert.deepEqual(await Promise.all([first, second]), [result, result]);
  assert.equal(f.providerCalls.length, 1); assert.equal(f.reserveCalls.length, 1); assert.equal(f.finalizations.length, 1);
});

test('a completed scoped operation cannot be replayed as fresh provider work', async () => {
  const f = fixture();
  await inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope));
  await assert.rejects(() => inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope)),
    (error) => error.getResponse().code === 'PROVIDER_OPERATION_ALREADY_RECORDED');
  assert.equal(f.providerCalls.length, 1); assert.equal(f.operations.length, 1); assert.equal(f.finalizations.length, 1);
});

test('attribution fails before provider/reservation with missing context, user or mismatched real request', async () => {
  const f = fixture();
  await assert.rejects(async () => f.llm.generate(messages, options, scope), rejection);
  for (const [requestId, owner] of [[scope.requestId, undefined], [scope.requestId, 'different-owner'], ['different-request', scope.userId]]) {
    await assert.rejects(() => inRequest(f.context, requestId, owner, () => f.llm.generate(messages, options, scope)), rejection);
  }
  assert.equal(f.providerCalls.length, 0); assert.equal(f.reserveCalls.length, 0); assert.equal(f.operations.length, 0);
});

test('a forged concurrent attribution cannot borrow an earlier authenticated in-flight result', async () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const f = fixture({ providerImplementation: async () => { await wait; return result; } });
  const first = inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope));
  await new Promise(setImmediate);
  await assert.rejects(() => inRequest(f.context, scope.requestId, 'different-owner', () => f.llm.generate(messages, options, scope)), rejection);
  await assert.rejects(() => inRequest(f.context, 'different-request', scope.userId, () => f.llm.generate(messages, options, scope)), rejection);
  release(); await first; assert.equal(f.providerCalls.length, 1); assert.equal(f.reserveCalls.length, 1);
});

test('scope identity is part of LLM deduplication, with operation uniqueness still ledger-authoritative', async () => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const f = fixture({ providerImplementation: async () => { await wait; return result; } });
  const first = inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope));
  await new Promise(setImmediate);
  const otherScope = { ...scope, userId: 'other-technical-owner', requestId: 'other-request', workspaceId: 'other-workspace' };
  await assert.rejects(() => inRequest(f.context, otherScope.requestId, otherScope.userId, () => f.llm.generate(messages, options, otherScope)),
    (error) => error.getResponse().code === 'PROVIDER_OPERATION_IN_PROGRESS');
  release(); await first; assert.equal(f.providerCalls.length, 1); assert.equal(f.operations[0].userId, scope.userId);
});

test('scoped metering itself rejects missing/anonymous/mismatched context and legacy client', async () => {
  for (const legacy of [false, true]) {
    const f = fixture({ legacy }); let invoked = 0;
    const input = { provider: 'openai', model: options.model, feature: 'ACADEMIC_WORKSPACE', resource: 'ACADEMIC_AI', units: 1,
      operationId: scope.operationId, requireAttribution: { userId: scope.userId, requestId: scope.requestId } };
    await assert.rejects(async () => f.meter.executeWithAttempts(input, async () => { invoked++; }), rejection);
    for (const [requestId, owner] of [[scope.requestId, undefined], [scope.requestId, 'wrong-owner'], ['wrong-request', scope.userId]]) {
      await assert.rejects(() => inRequest(f.context, requestId, owner, () => f.meter.executeWithAttempts(input, async () => { invoked++; })), rejection);
    }
    if (legacy) await assert.rejects(() => inRequest(f.context, scope.requestId, scope.userId, () => f.meter.executeWithAttempts(input, async () => { invoked++; })), rejection);
    assert.equal(invoked, 0); assert.equal(f.reserveCalls.length, 0);
  }
});

test('private context requires a pinned bounded model and permitted operation/phase; no meter fails closed', async () => {
  for (const [changedOptions, changedScope] of [
    [{ ...options, model: undefined }, scope], [{ ...options, model: '   ' }, scope],
    [{ ...options, maxOutputTokens: 1501 }, scope], [{ ...options, maxOutputTokens: 0 }, scope],
    [{ ...options, maxOutputTokens: NaN }, scope], [{ ...options, operation: 'tutor' }, scope],
    [options, { ...scope, phase: 'WORK' }], [options, { ...scope, acceptanceRunId: '' }],
    [options, { ...scope, requiredPricingVersionId: undefined }],
    [options, { ...scope, operationId: 'untrusted value with spaces' }],
  ]) {
    const f = fixture();
    await assert.rejects(() => inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, changedOptions, changedScope)), rejection);
    assert.equal(f.providerCalls.length, 0); assert.equal(f.reserveCalls.length, 0);
  }
  const f = fixture({ omitMeter: true });
  await assert.rejects(() => inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope)), rejection);
  assert.equal(f.providerCalls.length, 0);
  for (const providerName of ['echo', 'gemini']) {
    const other = fixture({ providerName });
    await assert.rejects(() => inRequest(other.context, scope.requestId, scope.userId, () => other.llm.generate(messages, options, scope)), rejection);
    assert.equal(other.providerCalls.length, 0); assert.equal(other.reserveCalls.length, 0);
  }
});

test('the current effective price must still match the acceptance quote in USD before any provider attempt', async () => {
  for (const mutate of [
    f => { f.pricing.id = 'a-new-effective-pricing-version'; },
    f => { f.pricing.currency = 'EUR'; },
  ]) {
    const f = fixture(); mutate(f);
    await assert.rejects(() => inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope)));
    assert.equal(f.providerCalls.length, 0); assert.equal(f.attempts.length, 0);
    assert.equal(f.operations[0].status, 'FAILED');
    assert.equal(f.pricingLookups.length, 1); assert.equal(f.finalizations.length, 0);
    assert.deepEqual(f.releases, [['reservation-1', 'provider_failure']]);
  }
});

test('ordinary metered generation does not apply an acceptance pricing pin or add an extra lookup', async () => {
  const f = fixture(); f.pricing.currency = 'EUR';
  await inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options));
  assert.equal(f.providerCalls.length, 1); assert.equal(f.attempts.length, 1);
  assert.equal(f.pricingLookups.length, 1); assert.equal(f.attempts[0].costStatus, 'UNKNOWN');
  assert.equal(f.attempts[0].referenceAmountUsd, null);
});

test('ordinary generation retains contextless behavior without acceptance metadata or a new routing path', async () => {
  const f = fixture({ omitMeter: true });
  assert.deepEqual(await f.llm.generate(messages, { operation: 'workspace-assistant' }), result);
  assert.equal(f.providerCalls.length, 1);
  assert.deepEqual(f.providerCalls[0][1], { operation: 'workspace-assistant', maxOutputTokens: 2000 });
});

test('a scoped provider failure remains one attempt, unknown cost and one existing quota release', async () => {
  const f = fixture({ providerImplementation: async () => { throw Object.assign(new Error('Fixture network failure.'), { code: 'OPENAI_NETWORK_ERROR' }); } });
  await assert.rejects(() => inRequest(f.context, scope.requestId, scope.userId, () => f.llm.generate(messages, options, scope)));
  assert.equal(f.providerCalls.length, 1); assert.equal(f.attempts.length, 1);
  assert.equal(f.attempts[0].costStatus, 'UNKNOWN');
  assert.equal(f.attempts[0].referenceAmountUsd, undefined);
  assert.equal(f.finalizations.length, 0); assert.deepEqual(f.releases, [['reservation-1', 'provider_failure']]);
});
