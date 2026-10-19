'use strict';

// Read-only proof helper. It never invokes a provider or changes pricing/users.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const mode = process.env.AUTOPILOT_COST_PROOF_MODE ?? 'preflight';
const model = process.env.OPENAI_MODEL || process.env.LLM_MODEL;
const maxCalls = 5;
const maxUsd = new Prisma.Decimal('0.20');
const promptBytes = Number(process.env.WORKSPACE_AUTOPILOT_MAX_PROMPT_BYTES ?? 60_000);
const outputTokens = 2_000; // Existing workspace-assistant policy cap, not a price.

async function main() {
  assert.equal(process.env.LLM_PROVIDER, 'openai', 'REAL_CONFIGURED_PROVIDER_REQUIRED');
  assert.ok(model, 'EXACT_CONFIGURED_MODEL_REQUIRED');
  assert.ok(Number.isSafeInteger(promptBytes) && promptBytes > 0, 'PROMPT_BOUND_REQUIRED');
  const now = new Date();
  const price = await prisma.providerPricingVersion.findFirst({
    where: {
      provider: 'openai', model, status: 'ACTIVE', currency: 'USD',
      effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    }, orderBy: { effectiveFrom: 'desc' },
  });
  assert.ok(price?.inputTokenPrice && price?.outputTokenPrice, 'ACTIVE_EXACT_USD_PRICING_REQUIRED');
  const inputPrice = Prisma.Decimal.max(price.inputTokenPrice, price.cachedInputTokenPrice ?? 0);
  // UTF-8 bytes conservatively bound text tokens; the margin covers message framing.
  const inputTokenBound = promptBytes + 1_024;
  const upperUsd = inputPrice.mul(inputTokenBound)
    .add(price.outputTokenPrice.mul(outputTokens)).mul(maxCalls);
  assert.ok(upperUsd.lte(maxUsd), 'AUTHORIZED_COST_CEILING_CANNOT_BE_GUARANTEED');
  const preflight = {
    status: 'PASS', provider: 'openai', model, pricingVersion: price.version,
    currency: price.currency, maxCalls, maxInputBytesPerCall: promptBytes,
    maxInputTokensPerCall: inputTokenBound, maxOutputTokensPerCall: outputTokens,
    conservativeUpperUsd: upperUsd.toFixed(12), authorizedUsd: maxUsd.toFixed(2),
    inputTokenPrice: price.inputTokenPrice.toFixed(12),
    cachedInputTokenPrice: price.cachedInputTokenPrice?.toFixed(12) ?? null,
    outputTokenPrice: price.outputTokenPrice.toFixed(12),
  };
  if (mode === 'preflight') return { preflight, paidCalls: 0 };
  assert.equal(mode, 'ledger');
  const file = process.env.AUTOPILOT_BROWSER_EVIDENCE;
  assert.ok(file, 'EXACT_BROWSER_EVIDENCE_REQUIRED');
  const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
  const requestIds = [...new Set(evidence.requestIds ?? [])];
  assert.ok(requestIds.length && requestIds.every(id => /^[A-Za-z0-9_.:-]{8,180}$/.test(id)));
  const user = await prisma.user.findUnique({
    where: { email: 'p1-browser-learner@example.test' }, select: { id: true },
  });
  assert.ok(user, 'AUTHORIZED_TECHNICAL_USER_REQUIRED');
  const operations = await prisma.providerUsageOperation.findMany({
    where: { userId: user.id, requestId: { in: requestIds } },
    include: { attempts: true }, orderBy: { startedAt: 'asc' },
  });
  const attempts = operations.flatMap(operation => operation.attempts.map(attempt => ({ operation, attempt })));
  assert.ok(attempts.length > 0 && attempts.length <= maxCalls, 'PHYSICAL_PROVIDER_CALL_LIMIT');
  let total = new Prisma.Decimal(0);
  const trace = [];
  for (const { operation, attempt } of attempts) {
    assert.equal(operation.feature, 'ACADEMIC_WORKSPACE');
    assert.equal(operation.resource, 'ACADEMIC_AI');
    assert.ok(operation.quotaReservationId, 'QUOTA_RESERVATION_REQUIRED');
    assert.equal(operation.status, 'SUCCEEDED');
    assert.equal(attempt.status, 'SUCCEEDED');
    assert.equal(attempt.provider, 'openai');
    assert.equal(attempt.model, model);
    assert.equal(attempt.costStatus, 'MEASURED');
    assert.ok(attempt.pricingSnapshot && attempt.referenceAmountUsd !== null);
    assert.ok(attempt.inputTokens !== null && attempt.inputTokens <= inputTokenBound);
    assert.ok(attempt.outputTokens !== null && attempt.outputTokens <= outputTokens);
    total = total.add(attempt.referenceAmountUsd);
    trace.push({
      requestId: operation.requestId, operationId: operation.id,
      feature: operation.feature, resource: operation.resource, quotaState: operation.quotaState,
      attemptId: attempt.attemptId, provider: attempt.provider, model: attempt.model,
      inputTokens: attempt.inputTokens, outputTokens: attempt.outputTokens,
      cachedInputTokens: attempt.cachedInputTokens, costStatus: attempt.costStatus,
      amountUsd: attempt.referenceAmountUsd.toFixed(12), pricingVersion: attempt.pricingVersion,
    });
  }
  assert.ok(total.lte(maxUsd), 'AUTHORIZED_CUMULATIVE_USD_LIMIT');
  return { preflight, status: 'PASS', paidCalls: attempts.length, totalUsd: total.toFixed(12), trace };
}

main().then(result => console.log(JSON.stringify(result, null, 2)))
  .catch(error => {
    // An assertion code is sufficient; never print a Prisma connection error.
    console.log(JSON.stringify({ status: 'FAIL', reason: error.code === 'ERR_ASSERTION' ? error.message : 'COST_PROOF_UNAVAILABLE' }));
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
