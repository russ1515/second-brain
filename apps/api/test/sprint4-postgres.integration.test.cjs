const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

// This suite runs compiled services against PostgreSQL. It is intentionally
// impossible to point it at a plainly named production database.
const { PlanService } = require('../dist/subscription/plan.service.js');
const { SubscriptionService } = require('../dist/subscription/subscription.service.js');
const { QuotaService } = require('../dist/usage/quota.service.js');
const { ProviderMeteringService } = require('../dist/usage/provider-metering.service.js');
const { RequestContextService } = require('../dist/common/request-context.service.js');
const { AdminAuditService } = require('../dist/admin/admin-audit.service.js');
const { CostCenterService } = require('../dist/admin/costs/cost-center.service.js');
const { OpenAIProvider } = require('../dist/llm/providers/openai.provider.js');
const { LlmService } = require('../dist/llm/llm.service.js');

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!/(?:test|staging|sprint)/i.test(databaseUrl) || /(?:^|[._/-])(prod|production)(?:[._/?-]|$)/i.test(databaseUrl)) {
  throw new Error('Sprint 4 PostgreSQL integration requires a dedicated test/staging/sprint DATABASE_URL.');
}

const prisma = new PrismaClient();
const plans = new PlanService(prisma);
const subscriptions = new SubscriptionService(prisma, plans);
const quotas = new QuotaService(prisma, subscriptions);
const requestContext = new RequestContextService();
const metering = new ProviderMeteringService(
  requestContext,
  prisma,
  subscriptions,
  quotas,
  { ingest: async () => undefined },
);
const costs = new CostCenterService(prisma, new AdminAuditService(prisma));

const runId = `sprint4-${process.pid}-${Date.now()}`;
const provider = `${runId}-provider`;
const aggregateProvider = `${runId}-aggregate`;
const unknownProvider = `${runId}-unknown`;
const openAiFixtureModel = `${runId}-openai-responses-model`;
const fixtureUsers = [];
let paidUser;

function costQuery(providerName) {
  return {
    range: 'custom',
    from: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    provider: providerName,
  };
}

function quotaExhausted(error) {
  const response = typeof error?.getResponse === 'function' ? error.getResponse() : error?.response;
  return response?.code === 'QUOTA_EXHAUSTED';
}

function inRequest(requestId, userId, callback) {
  return new Promise((resolve, reject) => {
    requestContext.run(requestId, () => {
      requestContext.authenticate(userId, `${runId}-session`);
      Promise.resolve(callback()).then(resolve, reject);
    });
  });
}

async function createPaidUser(label) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
  const user = await prisma.user.create({
    data: {
      email: `${runId}-${label}@example.test`,
      passwordHash: 'integration-fixture-not-a-credential',
      emailVerified: true,
    },
  });
  fixtureUsers.push(user.id);
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      planVersion: plan.configurationVersion,
      status: 'active',
      interval: 'month',
      provider: 'fake',
      providerSubscriptionId: `${runId}-${label}-subscription`,
      currentPeriodStart: startsAt,
      currentPeriodEnd: endsAt,
    },
  });
  return user;
}

async function createPricing(data) {
  return prisma.providerPricingVersion.create({
    data: {
      status: 'ACTIVE',
      currency: 'USD',
      effectiveFrom: new Date(Date.now() - 60_000),
      reason: 'Sprint 4 PostgreSQL integration fixture',
      ...data,
    },
  });
}

async function operationFor(operationId) {
  return prisma.providerUsageOperation.findUniqueOrThrow({
    where: { idempotencyKey: operationId },
    include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
  });
}

test.before(async () => {
  await prisma.$connect();
  assert.ok(prisma.providerUsageOperation && prisma.providerUsageAttempt && prisma.providerPricingVersion,
    'Sprint 4 migration/client generation must be applied before this suite.');
  await plans.onModuleInit();
  paidUser = await createPaidUser('paid');
});

test.after(async () => {
  // Delete only records whose explicit run prefix belongs to this suite. The
  // ordering also handles the RESTRICT adjustment relations in the immutable
  // ledger, keeping a shared staging database clean after validation.
  try {
    if (!prisma.providerUsageOperation || !prisma.providerUsageAttempt || !prisma.providerPricingVersion) return;
    const operationIds = (await prisma.providerUsageOperation.findMany({
      where: { idempotencyKey: { startsWith: runId } }, select: { id: true },
    })).map((row) => row.id);
    if (operationIds.length) {
      await prisma.providerCostAdjustment.deleteMany({ where: { operationId: { in: operationIds } } });
      await prisma.providerUsageAttempt.deleteMany({ where: { operationId: { in: operationIds } } });
      await prisma.providerUsageOperation.deleteMany({ where: { id: { in: operationIds } } });
    }
    await prisma.providerUsage.deleteMany({ where: { internalOperationId: { startsWith: runId } } });
    await prisma.providerPricingVersion.deleteMany({ where: { provider: { startsWith: runId } } });
    await prisma.providerPricingVersion.deleteMany({
      where: { provider: 'openai', model: openAiFixtureModel },
    });
    if (fixtureUsers.length) {
      await prisma.usageLedger.deleteMany({ where: { userId: { in: fixtureUsers } } });
      await prisma.quotaReservation.deleteMany({ where: { userId: { in: fixtureUsers } } });
      await prisma.quotaCycle.deleteMany({ where: { userId: { in: fixtureUsers } } });
      await prisma.subscription.deleteMany({ where: { userId: { in: fixtureUsers } } });
      await prisma.user.deleteMany({ where: { id: { in: fixtureUsers } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test('versioned Decimal pricing snapshots input, cached input and output tokens without repricing history', async () => {
  const v1 = await createPricing({
    provider,
    model: 'text-model',
    version: 'v1',
    inputTokenPrice: '0.000001',
    cachedInputTokenPrice: '0.0000002',
    outputTokenPrice: '0.000002',
    sourceReference: 'fixture://pricing/v1',
  });
  const operationId = `${runId}:token-pricing`;
  await inRequest(`${runId}:token-request`, paidUser.id, () => metering.execute({
    provider,
    model: 'text-model',
    feature: 'LANGUAGE_TEXT',
    resource: 'AI_TEXT',
    units: 1,
    operationId,
    measure: () => ({
      providerRequestId: `${runId}-token-request`,
      inputTokens: 100,
      cachedInputTokens: 50,
      outputTokens: 20,
    }),
  }, async () => ({ ok: true })));

  // A later catalog version must not recalculate the already-finalized V1 row.
  await createPricing({
    provider,
    model: 'text-model',
    version: 'v2',
    inputTokenPrice: '0.009999',
    cachedInputTokenPrice: '0.008888',
    outputTokenPrice: '0.007777',
    effectiveFrom: new Date(Date.now() + 5 * 60 * 1000),
    sourceReference: 'fixture://pricing/v2',
  });

  const operation = await operationFor(operationId);
  const [attempt] = operation.attempts;
  assert.equal(operation.planSlug, 'pro');
  assert.equal(operation.feature, 'LANGUAGE_TEXT');
  assert.equal(attempt.status, 'SUCCEEDED');
  assert.equal(attempt.costStatus, 'MEASURED');
  assert.equal(attempt.pricingVersionId, v1.id);
  assert.equal(attempt.pricingVersion, 'v1');
  assert.equal(attempt.inputTokens, 100);
  assert.equal(attempt.cachedInputTokens, 50);
  assert.equal(attempt.outputTokens, 20);
  assert.equal(attempt.referenceAmountUsd.toFixed(12), '0.000150000000');
  assert.equal(attempt.originalAmount.toFixed(12), '0.000150000000');
  assert.equal(attempt.pricingSnapshot.pricingVersion, 'v1');
  assert.equal(attempt.pricingSnapshot.rates.inputTokens, '0.000001');
  assert.equal(attempt.pricingSnapshot.rates.cachedInputTokens, '0.0000002');
  assert.equal(attempt.pricingSnapshot.rates.outputTokens, '0.000002');

  const pricing = await costs.pricing(costQuery(provider));
  assert.equal(pricing.data.dataStatus, 'AVAILABLE');
  assert.deepEqual(pricing.data.items.map((item) => item.version).sort(), ['v1', 'v2']);
});

test('mocked OpenAI Responses flow retains one correlation through the immutable ledger and Cost Center', async () => {
  await createPricing({
    provider: 'openai',
    model: openAiFixtureModel,
    version: `${runId}-openai-v1`,
    inputTokenPrice: '0.000001',
    cachedInputTokenPrice: '0.0000002',
    outputTokenPrice: '0.000002',
    sourceReference: 'fixture://openai-responses-pricing',
  });
  let call = 0;
  const openai = new OpenAIProvider('test-key', openAiFixtureModel, async () => {
    call += 1;
    const cacheWriteTokens = call === 2 ? 5 : 0;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        id: `${runId}-openai-provider-request-${call}`,
        model: openAiFixtureModel,
        output: [{
          type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: 'fixture response' }],
        }],
        usage: {
          input_tokens: 100,
          input_tokens_details: { cached_tokens: 20, cache_write_tokens: cacheWriteTokens },
          output_tokens: 10,
          output_tokens_details: { reasoning_tokens: 4 },
          total_tokens: 110,
        },
      }),
    };
  });
  const llm = new LlmService(
    { pickProvider: () => openai, supportsVision: false },
    { recordAiCall: () => undefined, captureError: () => undefined },
    metering,
  );

  const correlationId = `${runId}:openai-correlation`;
  const result = await inRequest(correlationId, paidUser.id, () => llm.generate([
    { role: 'system', content: 'Fixture system instruction.' },
    { role: 'user', content: 'Fixture learner question.' },
  ], { operation: 'tutor', maxOutputTokens: 12 }));
  assert.equal(result.provider, 'openai');
  assert.equal(result.model, openAiFixtureModel);
  assert.equal(result.usage.inputTokens, 80);
  assert.equal(result.usage.cachedTokens, 20);
  assert.equal(result.usage.outputTokens, 10);
  assert.equal(result.usage.totalTokens, 110);

  const operation = await prisma.providerUsageOperation.findFirstOrThrow({
    where: { requestId: correlationId },
    include: { attempts: { orderBy: { attemptNumber: 'asc' } } },
  });
  const [attempt] = operation.attempts;
  assert.equal(operation.userId, paidUser.id);
  assert.equal(operation.planSlug, 'pro');
  assert.equal(operation.feature, 'TUTOR_TEXT');
  assert.equal(operation.resource, 'AI_TEXT');
  assert.equal(operation.requestId, correlationId);
  assert.equal(attempt.provider, 'openai');
  assert.equal(attempt.model, openAiFixtureModel);
  assert.equal(attempt.providerRequestId, `${runId}-openai-provider-request-1`);
  assert.equal(attempt.inputTokens, 80);
  assert.equal(attempt.cachedInputTokens, 20);
  assert.equal(attempt.outputTokens, 10);
  assert.equal(attempt.reasoningTokens, null, 'Responses output already includes reasoning');
  assert.equal(attempt.costStatus, 'MEASURED');
  assert.equal(attempt.referenceAmountUsd.toFixed(12), '0.000104000000');
  assert.equal(attempt.pricingSnapshot.pricingVersion, `${runId}-openai-v1`);
  assert.equal(attempt.metadata.providerUsageTotalUnits, 110);
  assert.equal(attempt.metadata.openaiReasoningUnits, 4);

  const unknownCorrelationId = `${runId}:openai-cache-write-correlation`;
  await inRequest(unknownCorrelationId, paidUser.id, () => llm.generate([
    { role: 'user', content: 'Second fixture learner question.' },
  ], { operation: 'tutor', maxOutputTokens: 12 }));
  const cacheWriteOperation = await prisma.providerUsageOperation.findFirstOrThrow({
    where: { requestId: unknownCorrelationId },
    include: { attempts: true },
  });
  const [cacheWriteAttempt] = cacheWriteOperation.attempts;
  assert.equal(cacheWriteAttempt.costStatus, 'UNKNOWN');
  assert.equal(cacheWriteAttempt.originalAmount, null);
  assert.equal(cacheWriteAttempt.referenceAmountUsd, null);
  assert.equal(cacheWriteAttempt.metadata.openaiCacheWriteUnits, 5);
  assert.equal(cacheWriteAttempt.pricingSnapshot.measurementConstraint, 'OPENAI_CACHE_WRITE_UNPRICED');

  const models = await costs.models({ ...costQuery('openai'), model: openAiFixtureModel });
  const row = models.data.items.find((item) => item.provider === 'openai' && item.modelName === openAiFixtureModel);
  assert.ok(row);
  assert.equal(row.providerCalls, 2);
  assert.equal(row.inputTokens, 155);
  assert.equal(row.cachedInputTokens, 40);
  assert.equal(row.outputTokens, 20);
  assert.equal(row.cost.costStatus, 'UNKNOWN');
  assert.equal(row.cost.knownUsd, null);
  assert.equal(row.cost.knownSubtotalUsd, '0.000104000000');
  assert.equal(row.cost.unknownAttempts, 1);
});

test('unknown provider price remains visible as UNKNOWN and never becomes a zero-dollar total', async () => {
  const operationId = `${runId}:unknown-price`;
  await inRequest(`${runId}:unknown-request`, paidUser.id, () => metering.execute({
    provider: unknownProvider,
    model: 'unpriced-model',
    feature: 'TUTOR_TEXT',
    resource: 'AI_TEXT',
    units: 1,
    operationId,
    measure: () => ({ inputTokens: 7, outputTokens: 3 }),
  }, async () => ({ ok: true })));

  const operation = await operationFor(operationId);
  const [attempt] = operation.attempts;
  assert.equal(attempt.costStatus, 'UNKNOWN');
  assert.equal(attempt.referenceAmountUsd, null);
  assert.equal(attempt.originalAmount, null);
  assert.equal(attempt.pricingSnapshot.pricingVersion, 'NO_APPLICABLE_PRICING');

  const overview = await costs.overview(costQuery(unknownProvider));
  assert.equal(overview.data.providerCalls, 1);
  assert.equal(overview.data.cost.knownUsd, null);
  assert.equal(overview.data.cost.measuredUsd, null);
  assert.equal(overview.data.cost.unknownAttempts, 1);
  assert.equal(overview.data.cost.coverage.unknown, 1);
});

test('one logical operation retains each failed and retried provider attempt independently', async () => {
  const operationId = `${runId}:retry-operation`;
  const result = await inRequest(`${runId}:retry-request`, paidUser.id, () => metering.executeWithAttempts({
    provider,
    model: 'text-model',
    feature: 'TUTOR_TEXT',
    resource: 'AI_TEXT',
    units: 1,
    operationId,
  }, async (runner) => {
    await assert.rejects(
      () => runner.attempt(async () => { throw new Error('fixture provider retry failure'); }),
      /fixture provider retry failure/,
    );
    return runner.attempt(async () => ({ attempt: 'second' }), {
      measure: () => ({ inputTokens: 4, cachedInputTokens: 2, outputTokens: 1 }),
    });
  }));
  assert.deepEqual(result, { attempt: 'second' });

  const operation = await operationFor(operationId);
  assert.equal(operation.status, 'SUCCEEDED');
  assert.equal(operation.attempts.length, 2);
  assert.deepEqual(operation.attempts.map((attempt) => attempt.attemptNumber), [1, 2]);
  assert.equal(operation.attempts[0].status, 'FAILED');
  assert.equal(operation.attempts[0].costStatus, 'UNKNOWN');
  assert.equal(operation.attempts[1].status, 'SUCCEEDED');
  assert.equal(operation.attempts[1].costStatus, 'MEASURED');

  const providers = await costs.providers(costQuery(provider));
  const row = providers.data.items.find((item) => item.provider === provider);
  assert.ok(row);
  assert.equal(row.retryOperations, 1);
  assert.ok(row.providerCalls >= 3, 'the first priced attempt and the two retry attempts are all retained');
});

test('a quota-blocked request cannot execute a provider call, while a forced leak has an explicit anomaly shape', async () => {
  const blockedUser = await createPaidUser('blocked');
  const seed = await quotas.reserve({
    userId: blockedUser.id,
    resource: 'AI_TEXT',
    feature: 'SPRINT4_TEST',
    units: 1,
    idempotencyKey: `${runId}:blocked-seed`,
  });
  await quotas.release(seed.id, 'Sprint 4 blocked fixture setup');
  const account = await prisma.quotaAccount.findFirstOrThrow({
    where: { cycle: { userId: blockedUser.id }, resource: 'AI_TEXT' },
    orderBy: { updatedAt: 'desc' },
  });
  await prisma.quotaAccount.update({
    where: { id: account.id },
    data: { primaryLimit: 0, fallbackLimit: 0, primaryUsed: 0, fallbackUsed: 0, state: 'PRIMARY' },
  });

  let providerCalled = false;
  const blockedOperationId = `${runId}:blocked-operation`;
  await assert.rejects(
    () => inRequest(`${runId}:blocked-request`, blockedUser.id, () => metering.execute({
      provider,
      model: 'text-model',
      feature: 'TUTOR_TEXT',
      resource: 'AI_TEXT',
      units: 1,
      operationId: blockedOperationId,
      measure: () => ({ inputTokens: 1 }),
    }, async () => {
      providerCalled = true;
      return { mustNotRun: true };
    })),
    quotaExhausted,
  );
  assert.equal(providerCalled, false);
  const blocked = await operationFor(blockedOperationId);
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(blocked.quotaState, 'BLOCKED');
  assert.equal(blocked.attempts.length, 0);
  assert.equal(await prisma.quotaReservation.count({ where: { userId: blockedUser.id, idempotencyKey: blockedOperationId } }), 0);

  // This is deliberately a synthetic corruption fixture: it proves that the
  // Cost Center surfaces, rather than hides, any provider usage after BLOCKED.
  const leaked = await prisma.providerUsageOperation.create({
    data: {
      idempotencyKey: `${runId}:forced-blocked-leak`,
      requestId: `${runId}:forced-blocked-request`,
      userId: paidUser.id,
      feature: 'TUTOR_TEXT',
      resource: 'AI_TEXT',
      planSlug: 'pro',
      quotaState: 'BLOCKED',
      status: 'BLOCKED',
      completedAt: new Date(),
    },
  });
  await prisma.providerUsageAttempt.create({
    data: {
      operationId: leaked.id,
      attemptNumber: 1,
      attemptId: `${runId}:forced-blocked-leak:attempt:1`,
      provider,
      model: 'text-model',
      status: 'SUCCEEDED',
      costStatus: 'MEASURED',
      inputTokens: 1,
      originalAmount: '0.000001',
      originalCurrency: 'USD',
      referenceAmountUsd: '0.000001',
      startedAt: new Date(),
      completedAt: new Date(),
      finalizedAt: new Date(),
    },
  });
  const anomalies = await costs.anomalies(costQuery(provider));
  const leak = anomalies.data.items.find((item) => item.signal === 'PROVIDER_USAGE_AFTER_QUOTA_BLOCK');
  assert.deepEqual(leak, {
    signal: 'PROVIDER_USAGE_AFTER_QUOTA_BLOCK',
    severity: 'CRITICAL',
    count: 1,
    dataStatus: 'OBSERVED',
  });
});

test('observed Voice, OCR, embeddings and search units remain explicitly estimated or not-instrumented by engine', async () => {
  const telemetryProvider = `${runId}-telemetry`;
  await createPricing({
    provider: telemetryProvider, model: 'telemetry-model', version: 'v1',
    inputTokenPrice: '0.000001', audioInputSecondPrice: '0.001', ocrPagePrice: '0.01',
    embeddingUnitPrice: '0.000001', searchUnitPrice: '0.02',
  });
  const execute = (label, feature, resource, measure) => inRequest(`${runId}:telemetry-request:${label}`, paidUser.id, () => metering.execute({
    provider: telemetryProvider, model: 'telemetry-model', feature, resource, units: 1,
    operationId: `${runId}:telemetry:${label}`, measure: () => measure,
  }, async () => ({ ok: true })));

  await execute('language-text', 'LANGUAGE_TEXT', 'AI_TEXT', { inputTokens: 10 });
  await execute('language-voice', 'LANGUAGE_VOICE', 'VOICE_SECONDS', { audioInputSeconds: 3, measurementSource: 'OBSERVED' });
  await execute('tutor-voice', 'TUTOR_VOICE', 'VOICE_SECONDS', { audioInputSeconds: 2, measurementSource: 'OBSERVED' });
  await execute('ocr', 'DOCUMENT_OCR', 'OCR_PAGES', { ocrPages: 2, measurementSource: 'OBSERVED' });
  await execute('embedding', 'DOCUMENT_EMBEDDING', 'EMBEDDING_UNITS', { embeddingUnits: 12, measurementSource: 'OBSERVED' });
  await execute('search', 'WEB_SEARCH', 'WEB_SEARCH', { searchUnits: 1, measurementSource: 'OBSERVED' });
  await execute('not-instrumented', 'TUTOR_TEXT', 'AI_TEXT', {});

  const query = costQuery(telemetryProvider);
  const attempts = await prisma.providerUsageAttempt.findMany({ where: { provider: telemetryProvider }, orderBy: { attemptNumber: 'asc' } });
  assert.deepEqual(new Set(attempts.map((attempt) => attempt.costStatus)), new Set(['MEASURED', 'ESTIMATED', 'NOT_INSTRUMENTED']));

  const overview = await costs.overview(query);
  assert.equal(overview.data.cost.costStatus, 'NOT_INSTRUMENTED');
  assert.equal(overview.data.cost.knownUsd, null, 'a partial known subtotal must never be returned as a complete total');
  assert.ok(overview.data.cost.knownSubtotalUsd, 'the separately labelled subtotal remains auditable');

  const [voice, documents, research, languages] = await Promise.all([
    costs.voice(query), costs.documents(query), costs.research(query), costs.languages(query),
  ]);
  assert.equal(voice.data.items.some((item) => item.feature === 'TUTOR_VOICE' && item.cost.costStatus === 'ESTIMATED'), true);
  assert.equal(documents.data.items.some((item) => item.feature === 'DOCUMENT_OCR' && item.cost.costStatus === 'ESTIMATED'), true);
  assert.equal(documents.data.items.some((item) => item.feature === 'DOCUMENT_EMBEDDING' && item.cost.costStatus === 'ESTIMATED'), true);
  assert.equal(research.data.items.some((item) => item.feature === 'WEB_SEARCH' && item.cost.costStatus === 'ESTIMATED'), true);
  assert.equal(languages.data.items.find((item) => item.feature === 'LANGUAGE_TEXT').cost.costStatus, 'MEASURED');
  assert.equal(languages.data.items.find((item) => item.feature === 'LANGUAGE_VOICE').cost.costStatus, 'ESTIMATED');
});

test('raw immutable ledger totals exactly match the Cost Center aggregate response', async () => {
  await createPricing({
    provider: aggregateProvider,
    model: 'aggregate-model',
    version: 'v1',
    inputTokenPrice: '0.000001',
    cachedInputTokenPrice: '0.0000005',
    outputTokenPrice: '0.000004',
  });
  const execute = (suffix, measurement) => inRequest(`${runId}:aggregate-request:${suffix}`, paidUser.id, () => metering.execute({
    provider: aggregateProvider,
    model: 'aggregate-model',
    feature: 'LANGUAGE_TEXT',
    resource: 'AI_TEXT',
    units: 1,
    operationId: `${runId}:aggregate:${suffix}`,
    measure: () => measurement,
  }, async () => ({ ok: true })));
  await execute('one', { inputTokens: 10, cachedInputTokens: 2, outputTokens: 3 });
  await execute('two', { inputTokens: 2, cachedInputTokens: 1, outputTokens: 4 });

  const query = costQuery(aggregateProvider);
  const [rawAttempts, rawTotals, rawOperations, overview] = await Promise.all([
    prisma.providerUsageAttempt.count({ where: { provider: aggregateProvider } }),
    prisma.providerUsageAttempt.aggregate({
      where: { provider: aggregateProvider },
      _sum: { referenceAmountUsd: true, inputTokens: true, cachedInputTokens: true, outputTokens: true },
    }),
    prisma.providerUsageOperation.count({ where: { idempotencyKey: { startsWith: `${runId}:aggregate:` } } }),
    costs.overview(query),
  ]);
  assert.equal(rawAttempts, 2);
  assert.equal(rawOperations, 2);
  assert.equal(rawTotals._sum.referenceAmountUsd.toFixed(12), '0.000041500000');
  assert.equal(overview.data.providerCalls, rawAttempts);
  assert.equal(overview.data.logicalRequests, rawOperations);
  assert.equal(overview.data.cost.measuredUsd, rawTotals._sum.referenceAmountUsd.toFixed(12));
  assert.equal(overview.data.cost.knownUsd, rawTotals._sum.referenceAmountUsd.toFixed(12));
  assert.equal(overview.data.cost.unknownAttempts, 0);

  const models = await costs.models(query);
  const row = models.data.items.find((item) => item.provider === aggregateProvider && item.modelName === 'aggregate-model');
  assert.ok(row);
  assert.equal(row.inputTokens, rawTotals._sum.inputTokens);
  assert.equal(row.cachedInputTokens, rawTotals._sum.cachedInputTokens);
  assert.equal(row.outputTokens, rawTotals._sum.outputTokens);
});
