'use strict';

// Runs inside the temporary P1 API container after run-openai-provider-gate.sh
// completed its non-secret filesystem/configuration preflight. It never prints
// or persists a credential, token, prompt, reply, email, TOTP seed, or provider
// request identifier. Its only network request outside P1 is the one genuine
// Tutor turn issued by the application itself.

const { createHash, randomUUID } = require('node:crypto');
const { mkdirSync, writeFileSync, chmodSync } = require('node:fs');
const { join } = require('node:path');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const runId = process.env.P1_PROVIDER_GATE_RUN_ID?.trim() || 'RUN_ID_NOT_REPORTED';
let model = '';
const baseUrl = process.env.P1_PROVIDER_GATE_API_BASE ?? 'http://127.0.0.1:3000/api';
const evidenceDir = process.env.P1_PROVIDER_GATE_EVIDENCE_DIR ?? '/p1/evidence';
const sourceSha = process.env.P1_PROVIDER_GATE_SOURCE_SHA ?? 'SOURCE_SHA_NOT_REPORTED';
const learnerEmail = 'p1-browser-learner@example.test';
const superAdminEmail = 'p1-browser-superadmin@example.test';
let browserPassword = '';
let browserTotpSecret = '';

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

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
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

async function loginLearner() {
  const login = await request('/auth/login', {
    method: 'POST', body: { email: learnerEmail, password: browserPassword },
  });
  if (login?.twoFactorRequired || typeof login?.tokens?.accessToken !== 'string') {
    throw gateError('P1_LEARNER_FIXTURE_LOGIN_INVALID', 'NOT_VERIFIED');
  }
  return login.tokens.accessToken;
}

async function loginSuperAdmin() {
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
  return verified.tokens.accessToken;
}

function activePricing(items, at) {
  return items.find((item) => {
    const starts = Date.parse(item?.effectiveFrom ?? '');
    const ends = item?.effectiveTo ? Date.parse(item.effectiveTo) : null;
    return item?.provider === 'openai' && item?.model === model && item?.status === 'ACTIVE' &&
      item?.currency === 'USD' && Number.isFinite(starts) && starts <= at &&
      (ends === null || (Number.isFinite(ends) && ends > at)) &&
      validRate(item.inputTokenPrice) && validRate(item.cachedInputTokenPrice) &&
      validRate(item.outputTokenPrice) && /^https:\/\//.test(item.sourceReference ?? '');
  });
}

function validRate(value) {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) && Number(value) >= 0;
}

function modelRow(payload) {
  return payload?.data?.items?.find((item) => item?.provider === 'openai' && item?.modelName === model) ?? null;
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

async function main() {
  if (runId === 'RUN_ID_NOT_REPORTED') throw gateError('MISSING_P1_PROVIDER_GATE_RUN_ID', 'NOT_VERIFIED');
  model = required('LLM_MODEL');
  browserPassword = required('P1_BROWSER_PASSWORD');
  browserTotpSecret = required('P1_BROWSER_TOTP_SECRET');
  const adminToken = await loginSuperAdmin();
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
  const pricingPayload = await request(`/admin/costs/pricing?${range}`, { token: adminToken });
  const pricing = activePricing(pricingPayload?.data?.items ?? [], now);
  if (!pricing) throw gateError('OPENAI_ACTIVE_EXACT_MODEL_PRICING_MISSING', 'NOT_VERIFIED');
  const beforeModels = await request(`/admin/costs/models?${range}`, { token: adminToken });
  const before = modelRow(beforeModels);

  const learnerToken = await loginLearner();
  const session = await request('/tutor/sessions', {
    method: 'POST', token: learnerToken,
    body: { title: 'Provider validation' },
  });
  if (typeof session?.id !== 'string') throw gateError('TUTOR_SESSION_CREATE_INVALID');

  const requestId = correlationId();
  // This is the sole real provider-triggering request. The temporary API's
  // server-only gate policy sets retries=0 and a small maximum output budget.
  await request(`/tutor/sessions/${encodeURIComponent(session.id)}/messages`, {
    method: 'POST', token: learnerToken, requestId,
    body: { content: 'Reply only with OK.' },
  });

  const operation = await prisma.providerUsageOperation.findFirst({
    where: { requestId },
    include: { attempts: { orderBy: { attemptNumber: 'asc' } }, user: { select: { id: true } } },
  });
  const attempt = operation?.attempts?.[0];
  if (!operation || !attempt || operation.attempts.length !== 1) {
    throw gateError('OPENAI_LEDGER_SINGLE_ATTEMPT_MISSING');
  }
  if (
    operation.userId === null || operation.subscriptionId === null || !operation.planSlug ||
    operation.feature !== 'TUTOR_TEXT' || operation.resource !== 'AI_TEXT' ||
    operation.requestId !== requestId || attempt.provider !== 'openai' ||
    attempt.model !== model || attempt.status !== 'SUCCEEDED' ||
    attempt.measurementSource !== 'PROVIDER' || attempt.costStatus !== 'MEASURED'
  ) {
    throw gateError('OPENAI_LEDGER_ATTRIBUTION_OR_MEASUREMENT_INVALID');
  }
  if (
    !Number.isSafeInteger(attempt.inputTokens) || !Number.isSafeInteger(attempt.outputTokens) ||
    !Number.isSafeInteger(attempt.metadata?.providerUsageTotalUnits) ||
    !attempt.providerRequestId || !attempt.pricingVersionId || !attempt.pricingSnapshot
  ) {
    throw gateError('OPENAI_LEDGER_USAGE_OR_PRICING_MISSING');
  }
  const expectedUsd = expectedCost(attempt);
  const recordedUsd = typeof attempt.referenceAmountUsd?.toFixed === 'function'
    ? attempt.referenceAmountUsd.toFixed(12)
    : null;
  if (expectedUsd !== recordedUsd) throw gateError('OPENAI_COST_RECONCILIATION_MISMATCH');

  const afterModels = await request(`/admin/costs/models?${range}`, { token: adminToken });
  const after = modelRow(afterModels);
  if (!after || after.providerCalls !== (before?.providerCalls ?? 0) + 1) {
    throw gateError('OPENAI_COST_CENTER_MODEL_DELTA_INVALID');
  }
  if (decimalDelta(after.cost?.knownSubtotalUsd, before?.cost?.knownSubtotalUsd) !== recordedUsd) {
    throw gateError('OPENAI_COST_CENTER_AMOUNT_DELTA_INVALID');
  }

  writeEvidence('PASS', {
    correlationSha256: hash(requestId),
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
    pricing: {
      version: attempt.pricingVersion,
      sourceReferencePresent: Boolean(pricing.sourceReference),
      currency: attempt.originalCurrency,
    },
    cost: { expectedUsd, recordedUsd, matches: true },
    costCenter: {
      providerCallsBefore: before?.providerCalls ?? 0,
      providerCallsAfter: after.providerCalls,
      costStatus: after.cost?.costStatus,
      amountDeltaUsd: decimalDelta(after.cost?.knownSubtotalUsd, before?.cost?.knownSubtotalUsd),
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
