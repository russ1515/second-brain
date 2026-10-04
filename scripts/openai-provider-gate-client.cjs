'use strict';

// Runs inside the temporary P1 API container after run-openai-provider-gate.sh
// completed its non-secret filesystem/configuration preflight. It never prints
// or persists a credential, token, prompt, reply, email, TOTP seed, or provider
// request identifier. Its only network request outside P1 is the one genuine
// Tutor turn issued by the application itself.

const { randomUUID } = require('node:crypto');
const { mkdirSync, writeFileSync, chmodSync } = require('node:fs');
const { join } = require('node:path');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const runId = process.env.P1_PROVIDER_GATE_RUN_ID?.trim() || 'RUN_ID_NOT_REPORTED';
let model = '';
const baseUrl = process.env.P1_PROVIDER_GATE_API_BASE ?? 'http://127.0.0.1:3000/api';
const evidenceDir = process.env.P1_PROVIDER_GATE_EVIDENCE_DIR ?? '/p1/evidence';
const sourceSha = process.env.P1_PROVIDER_GATE_SOURCE_SHA ?? 'SOURCE_SHA_NOT_REPORTED';
let browserPassword = '';
let browserTotpSecret = '';

// Only exact, independently verified official prices are accepted. This gate
// deliberately supports a single approved snapshot so a model change cannot
// silently inherit stale or invented pricing.
const OFFICIAL_PRICING = new Map([
  ['gpt-4.1-mini-2025-04-14', {
    version: 'openai-gpt-4.1-mini-2025-04-14-20261004',
    inputTokenPrice: '0.0000004',
    cachedInputTokenPrice: '0.0000001',
    outputTokenPrice: '0.0000016',
    sourceReference: 'https://developers.openai.com/api/docs/models/gpt-4.1-mini',
  }],
]);

function required(key) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    const error = new Error(`MISSING_${key}`);
    error.gateStatus = 'NOT_VERIFIED';
    throw error;
  }
  return value.trim();
}

function gateError(code, gateStatus = 'FAIL') {
  const error = new Error(code);
  error.gateStatus = gateStatus;
  error.code = code;
  return error;
}

function correlationId() {
  return `openai-provider-gate-${runId}-${randomUUID()}`.slice(0, 128);
}

function evidencePath() {
  return join(evidenceDir, `openai-provider-gate-${runId}.json`);
}

function writeEvidence(status, details) {
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  const payload = {
    gate: 'OPENAI_REAL_PROVIDER_ATTRIBUTABLE_INSTRUMENTATION',
    status,
    runId,
    sourceSha,
    recordedAt: new Date().toISOString(),
    ...details,
  };
  writeFileSync(evidencePath(), `${JSON.stringify(payload)}\n`, { mode: 0o600 });
  chmodSync(evidencePath(), 0o600);
}

async function request(path, { method = 'GET', token, requestId, body } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(requestId ? { 'x-request-id': requestId } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw gateError('P1_API_UNREACHABLE', 'NOT_VERIFIED');
  }
  let parsed = null;
  try {
    parsed = response.status === 204 ? null : await response.json();
  } catch {
    throw gateError(`P1_HTTP_${response.status}_INVALID_JSON`);
  }
  if (!response.ok) throw gateError(`P1_HTTP_${response.status}`);
  return parsed;
}

async function resolveSuperAdminFixtureEmail() {
  const candidates = await prisma.user.findMany({
    where: {
      accountStatus: 'active',
      suspendedAt: null,
      bannedAt: null,
      twoFactorEnabled: true,
      adminRoleAssignments: { some: { role: 'SUPER_ADMIN', revokedAt: null } },
    },
    select: { email: true, passwordHash: true },
  });
  const matching = [];
  for (const candidate of candidates) {
    if (await argon2.verify(candidate.passwordHash, browserPassword)) matching.push(candidate.email);
  }
  if (matching.length !== 1) {
    throw gateError('P1_SUPER_ADMIN_FIXTURE_AMBIGUOUS_OR_MISSING', 'NOT_VERIFIED');
  }
  return matching[0];
}

async function loginSuperAdmin() {
  const superAdminEmail = await resolveSuperAdminFixtureEmail();
  const login = await request('/auth/login', {
    method: 'POST', body: { email: superAdminEmail, password: browserPassword },
  });
  if (!login?.twoFactorRequired || typeof login?.challengeToken !== 'string') {
    throw gateError('P1_SUPER_ADMIN_MFA_CHALLENGE_INVALID', 'NOT_VERIFIED');
  }
  const verified = await request('/auth/2fa/verify', {
    method: 'POST',
    body: { challengeToken: login.challengeToken, code: authenticator.generate(browserTotpSecret) },
  });
  if (typeof verified?.tokens?.accessToken !== 'string') {
    throw gateError('P1_SUPER_ADMIN_MFA_VERIFY_INVALID', 'NOT_VERIFIED');
  }
  const token = verified.tokens.accessToken;
  const identity = await request('/auth/me', { token });
  if (typeof identity?.id !== 'string' || !identity.id) {
    throw gateError('P1_SUPER_ADMIN_IDENTITY_INVALID', 'NOT_VERIFIED');
  }
  return { token, userId: identity.id };
}

function applicablePricings(items, at) {
  return items.filter((item) => {
    const starts = Date.parse(item?.effectiveFrom ?? '');
    const ends = item?.effectiveTo ? Date.parse(item.effectiveTo) : null;
    return item?.provider === 'openai' && item?.model === model && item?.status === 'ACTIVE' &&
      Number.isFinite(starts) && starts <= at &&
      (ends === null || (Number.isFinite(ends) && ends > at));
  });
}

function isOfficialPricing(item, official) {
  return item?.currency === 'USD' && item?.version === official.version &&
    item?.sourceReference === official.sourceReference &&
    sameDecimal(item.inputTokenPrice, official.inputTokenPrice) &&
    sameDecimal(item.cachedInputTokenPrice, official.cachedInputTokenPrice) &&
    sameDecimal(item.outputTokenPrice, official.outputTokenPrice);
}

function validRate(value) {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) && Number(value) >= 0;
}

function sameDecimal(actual, expected) {
  return validRate(actual) && validRate(expected) && decimalUnits(actual) === decimalUnits(expected);
}

function modelRow(payload) {
  return payload?.data?.items?.find((item) => item?.provider === 'openai' && item?.modelName === model) ?? null;
}

function featureRow(payload) {
  return payload?.data?.items?.find((item) => item?.feature === 'TUTOR_TEXT') ?? null;
}

function decimalUnits(value) {
  const text = typeof value === 'string' ? value : '0';
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw gateError('PRICING_DECIMAL_INVALID');
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 1_000_000_000_000n + BigInt((fraction + '000000000000').slice(0, 12));
}

function fixedDecimal(value) {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 1_000_000_000_000n;
  const fraction = String(absolute % 1_000_000_000_000n).padStart(12, '0');
  return `${sign}${whole}.${fraction}`;
}

function expectedCost(attempt) {
  const rates = attempt?.pricingSnapshot?.rates;
  if (!rates || !validRate(rates.inputTokens) || !validRate(rates.cachedInputTokens) || !validRate(rates.outputTokens)) {
    throw gateError('PRICING_SNAPSHOT_INCOMPLETE');
  }
  return fixedDecimal(
    decimalUnits(rates.inputTokens) * BigInt(attempt.inputTokens ?? 0) +
    decimalUnits(rates.cachedInputTokens) * BigInt(attempt.cachedInputTokens ?? 0) +
    decimalUnits(rates.outputTokens) * BigInt(attempt.outputTokens ?? 0),
  );
}

function decimalDelta(after, before) {
  return fixedDecimal(decimalUnits(after ?? '0') - decimalUnits(before ?? '0'));
}

function integerDelta(after, before) {
  const current = Number.isSafeInteger(after) ? after : 0;
  const previous = Number.isSafeInteger(before) ? before : 0;
  return current - previous;
}

async function main() {
  if (runId === 'RUN_ID_NOT_REPORTED') throw gateError('MISSING_P1_PROVIDER_GATE_RUN_ID', 'NOT_VERIFIED');
  model = required('OPENAI_MODEL');
  const officialPricing = OFFICIAL_PRICING.get(model);
  if (!officialPricing) throw gateError('OPENAI_MODEL_OFFICIAL_PRICING_NOT_APPROVED', 'NOT_VERIFIED');
  browserPassword = required('P1_BROWSER_PASSWORD');
  browserTotpSecret = required('P1_BROWSER_TOTP_SECRET');
  const principal = await loginSuperAdmin();
  const adminToken = principal.token;
  const orchestrator = await request('/ai/orchestrator', { token: adminToken });
  if (orchestrator?.active !== 'openai') {
    throw gateError('OPENAI_RUNTIME_NOT_ACTIVE', 'NOT_VERIFIED');
  }
  const openaiCatalog = orchestrator?.providers?.find((provider) => provider?.name === 'openai');
  if (
    !openaiCatalog?.available ||
    Object.values(orchestrator?.selection ?? {}).some((provider) => provider !== 'openai')
  ) {
    throw gateError('OPENAI_RUNTIME_CONFIGURATION_INCOHERENT', 'NOT_VERIFIED');
  }

  const now = Date.now();
  const range = new URLSearchParams({
    range: 'custom',
    from: new Date(now - 5 * 60_000).toISOString(),
    to: new Date(now + 5 * 60_000).toISOString(),
    provider: 'openai',
    model,
  });
  let pricingPayload = await request(`/admin/costs/pricing?${range}`, { token: adminToken });
  let applicable = applicablePricings(pricingPayload?.data?.items ?? [], now);
  if (applicable.length > 1) {
    throw gateError('OPENAI_ACTIVE_PRICING_AMBIGUOUS', 'NOT_VERIFIED');
  }
  let pricing = applicable[0];
  if (pricing && !isOfficialPricing(pricing, officialPricing)) {
    throw gateError('OPENAI_ACTIVE_PRICING_NOT_OFFICIAL', 'NOT_VERIFIED');
  }
  if (!pricing) {
    await request('/admin/costs/pricing', {
      method: 'POST',
      token: adminToken,
      body: {
        provider: 'openai',
        model,
        version: officialPricing.version,
        currency: 'USD',
        effectiveFrom: new Date(now - 1_000).toISOString(),
        sourceReference: officialPricing.sourceReference,
        reason: 'One-call provider gate with official OpenAI pricing verified 2026-10-04.',
        status: 'ACTIVE',
        inputTokenPrice: officialPricing.inputTokenPrice,
        cachedInputTokenPrice: officialPricing.cachedInputTokenPrice,
        outputTokenPrice: officialPricing.outputTokenPrice,
      },
    });
    pricingPayload = await request(`/admin/costs/pricing?${range}`, { token: adminToken });
    applicable = applicablePricings(pricingPayload?.data?.items ?? [], Date.now());
    if (applicable.length !== 1) {
      throw gateError('OPENAI_ACTIVE_PRICING_AMBIGUOUS', 'NOT_VERIFIED');
    }
    pricing = applicable[0];
  }
  if (!pricing || !isOfficialPricing(pricing, officialPricing)) {
    throw gateError('OPENAI_ACTIVE_EXACT_MODEL_PRICING_MISSING', 'NOT_VERIFIED');
  }
  const beforeModels = await request(`/admin/costs/models?${range}`, { token: adminToken });
  const before = modelRow(beforeModels);
  const beforeFeatures = await request(`/admin/costs/features?${range}`, { token: adminToken });
  const beforeFeature = featureRow(beforeFeatures);

  const session = await request('/tutor/sessions', {
    method: 'POST', token: adminToken,
    body: { title: 'Provider validation' },
  });
  if (typeof session?.id !== 'string') throw gateError('TUTOR_SESSION_CREATE_INVALID');

  const requestId = correlationId();
  // This is the sole real provider-triggering request. The temporary API's
  // server-only gate policy sets retries=0 and a small maximum output budget.
  await request(`/tutor/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: 'POST', token: adminToken, requestId,
    body: { content: 'Reply only with OK.' },
  });

  const matchingOperations = await prisma.providerUsageOperation.findMany({
    where: { requestId, attempts: { some: { provider: 'openai' } } },
    include: {
      attempts: { orderBy: { attemptNumber: 'asc' } },
      quotaReservation: { include: { ledger: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  const operation = matchingOperations[0];
  const attempt = operation?.attempts?.[0];
  if (matchingOperations.length !== 1 || !operation || !attempt || operation.attempts.length !== 1) {
    throw gateError('OPENAI_LEDGER_SINGLE_ATTEMPT_MISSING');
  }
  if (
    operation.userId !== principal.userId || operation.subscriptionId === null || !operation.planSlug ||
    operation.feature !== 'TUTOR_TEXT' || operation.resource !== 'AI_TEXT' ||
    operation.requestId !== requestId || operation.status !== 'SUCCEEDED' ||
    !operation.completedAt || operation.unattributedReason !== null ||
    !operation.quotaReservationId || !['PRIMARY', 'FALLBACK'].includes(operation.quotaState) ||
    attempt.provider !== 'openai' ||
    attempt.model !== model || attempt.status !== 'SUCCEEDED' ||
    !attempt.completedAt || !attempt.finalizedAt ||
    attempt.measurementSource !== 'PROVIDER' || attempt.costStatus !== 'MEASURED'
  ) {
    throw gateError('OPENAI_LEDGER_ATTRIBUTION_OR_MEASUREMENT_INVALID');
  }
  if (
    !Number.isSafeInteger(attempt.inputTokens) || attempt.inputTokens < 1 ||
    !Number.isSafeInteger(attempt.outputTokens) || attempt.outputTokens < 1 ||
    !(attempt.cachedInputTokens === null ||
      (Number.isSafeInteger(attempt.cachedInputTokens) && attempt.cachedInputTokens >= 0)) ||
    !Number.isSafeInteger(attempt.metadata?.providerUsageTotalUnits) ||
    !attempt.providerRequestId || !attempt.pricingVersionId || !attempt.pricingSnapshot
  ) {
    throw gateError('OPENAI_LEDGER_USAGE_OR_PRICING_MISSING');
  }
  if (
    !(attempt.metadata.openaiCacheWriteUnits === undefined ||
      (Number.isSafeInteger(attempt.metadata.openaiCacheWriteUnits) &&
        attempt.metadata.openaiCacheWriteUnits >= 0)) ||
    attempt.metadata.providerUsageTotalUnits !== attempt.inputTokens +
      (attempt.cachedInputTokens ?? 0) +
      (attempt.metadata.openaiCacheWriteUnits ?? 0) +
      attempt.outputTokens ||
    attempt.pricingVersionId !== pricing.id || attempt.pricingVersion !== officialPricing.version ||
    attempt.originalCurrency !== 'USD'
  ) {
    throw gateError('OPENAI_LEDGER_USAGE_OR_PRICING_INCOHERENT');
  }
  const snapshotRates = attempt.pricingSnapshot?.rates;
  if (
    attempt.pricingSnapshot?.provider !== 'openai' ||
    attempt.pricingSnapshot?.model !== model ||
    attempt.pricingSnapshot?.pricingVersionId !== pricing.id ||
    attempt.pricingSnapshot?.pricingVersion !== officialPricing.version ||
    attempt.pricingSnapshot?.currency !== 'USD' ||
    attempt.pricingSnapshot?.sourceReference !== officialPricing.sourceReference ||
    !sameDecimal(snapshotRates?.inputTokens, officialPricing.inputTokenPrice) ||
    !sameDecimal(snapshotRates?.cachedInputTokens, officialPricing.cachedInputTokenPrice) ||
    !sameDecimal(snapshotRates?.outputTokens, officialPricing.outputTokenPrice)
  ) {
    throw gateError('OPENAI_PRICING_SNAPSHOT_NOT_OFFICIAL');
  }
  const expectedUsd = expectedCost(attempt);
  const recordedUsd = typeof attempt.referenceAmountUsd?.toFixed === 'function'
    ? attempt.referenceAmountUsd.toFixed(12)
    : null;
  const originalUsd = typeof attempt.originalAmount?.toFixed === 'function'
    ? attempt.originalAmount.toFixed(12)
    : null;
  if (expectedUsd !== recordedUsd || originalUsd !== recordedUsd || decimalUnits(recordedUsd ?? '0') <= 0n) {
    throw gateError('OPENAI_COST_RECONCILIATION_MISMATCH');
  }

  const reservation = operation.quotaReservation;
  const events = reservation?.ledger?.map((entry) => entry.event) ?? [];
  if (
    !reservation || reservation.userId !== principal.userId || reservation.feature !== 'TUTOR_TEXT' ||
    reservation.resource !== 'AI_TEXT' || reservation.status !== 'FINALIZED' ||
    reservation.requestedUnits !== 1 || reservation.actualUnits !== 1 ||
    events.filter((event) => event === 'RESERVE').length !== 1 ||
    events.filter((event) => event === 'FINALIZE').length !== 1 ||
    events.filter((event) => event === 'RELEASE').length !== 0
  ) {
    throw gateError('OPENAI_QUOTA_LEDGER_FINALIZATION_INVALID');
  }

  const afterModels = await request(`/admin/costs/models?${range}`, { token: adminToken });
  const after = modelRow(afterModels);
  if (!after || after.providerCalls !== (before?.providerCalls ?? 0) + 1) {
    throw gateError('OPENAI_COST_CENTER_MODEL_DELTA_INVALID');
  }
  if (decimalDelta(after.cost?.knownSubtotalUsd, before?.cost?.knownSubtotalUsd) !== recordedUsd) {
    throw gateError('OPENAI_COST_CENTER_AMOUNT_DELTA_INVALID');
  }
  if (
    integerDelta(after.inputTokens, before?.inputTokens) !== attempt.inputTokens ||
    integerDelta(after.cachedInputTokens, before?.cachedInputTokens) !== (attempt.cachedInputTokens ?? 0) ||
    integerDelta(after.outputTokens, before?.outputTokens) !== attempt.outputTokens
  ) {
    throw gateError('OPENAI_COST_CENTER_TOKEN_DELTA_INVALID');
  }
  const afterFeatures = await request(`/admin/costs/features?${range}`, { token: adminToken });
  const afterFeature = featureRow(afterFeatures);
  if (!afterFeature || afterFeature.providerCalls !== (beforeFeature?.providerCalls ?? 0) + 1) {
    throw gateError('OPENAI_COST_CENTER_FEATURE_DELTA_INVALID');
  }
  if (decimalDelta(afterFeature.cost?.knownSubtotalUsd, beforeFeature?.cost?.knownSubtotalUsd) !== recordedUsd) {
    throw gateError('OPENAI_COST_CENTER_FEATURE_AMOUNT_DELTA_INVALID');
  }

  writeEvidence('PASS', {
    correlationId: requestId,
    userId: operation.userId,
    provider: attempt.provider,
    model: attempt.model,
    operation: {
      userAttributed: Boolean(operation.userId),
      subscriptionAttributed: Boolean(operation.subscriptionId),
      planSlug: operation.planSlug,
      planVersion: operation.planVersion,
      feature: operation.feature,
      resource: operation.resource,
      quotaState: operation.quotaState,
      status: operation.status,
    },
    attempt: {
      status: attempt.status,
      measurementSource: attempt.measurementSource,
      providerRequestIdPresent: Boolean(attempt.providerRequestId),
      inputTokens: attempt.inputTokens,
      cachedInputTokens: attempt.cachedInputTokens,
      outputTokens: attempt.outputTokens,
      totalUnits: attempt.metadata.providerUsageTotalUnits,
      latencyMs: attempt.latencyMs,
      costStatus: attempt.costStatus,
    },
    quotaLedger: {
      reservationStatus: reservation.status,
      requestedUnits: reservation.requestedUnits,
      actualUnits: reservation.actualUnits,
      reserveEvents: events.filter((event) => event === 'RESERVE').length,
      finalizeEvents: events.filter((event) => event === 'FINALIZE').length,
      releaseEvents: events.filter((event) => event === 'RELEASE').length,
    },
    pricing: {
      version: attempt.pricingVersion,
      sourceReference: pricing.sourceReference,
      currency: attempt.originalCurrency,
    },
    cost: { expectedUsd, recordedUsd, matches: true },
    costCenter: {
      providerCallsBefore: before?.providerCalls ?? 0,
      providerCallsAfter: after.providerCalls,
      inputTokensDelta: integerDelta(after.inputTokens, before?.inputTokens),
      cachedInputTokensDelta: integerDelta(after.cachedInputTokens, before?.cachedInputTokens),
      outputTokensDelta: integerDelta(after.outputTokens, before?.outputTokens),
      costStatus: after.cost?.costStatus,
      amountDeltaUsd: decimalDelta(after.cost?.knownSubtotalUsd, before?.cost?.knownSubtotalUsd),
      feature: 'TUTOR_TEXT',
      featureCallsBefore: beforeFeature?.providerCalls ?? 0,
      featureCallsAfter: afterFeature.providerCalls,
      featureAmountDeltaUsd: decimalDelta(
        afterFeature.cost?.knownSubtotalUsd,
        beforeFeature?.cost?.knownSubtotalUsd,
      ),
    },
  });
}

main()
  .catch((error) => {
    const status = error?.gateStatus === 'NOT_VERIFIED' ? 'NOT_VERIFIED' : 'FAIL';
    const code = typeof error?.code === 'string'
      ? error.code.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120)
      : 'OPENAI_PROVIDER_GATE_UNEXPECTED';
    writeEvidence(status, { code });
    process.stdout.write(`OPENAI_PROVIDER_GATE_${status}\n`);
    process.exitCode = status === 'NOT_VERIFIED' ? 2 : 1;
  })
  .finally(() => prisma.$disconnect());
