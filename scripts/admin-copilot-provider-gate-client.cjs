'use strict';

// Executes inside the temporary API container created by
// run-admin-copilot-provider-gate.sh. It sends one bounded read-only Admin
// Copilot request only after configuration and pricing preflight succeed.
// Evidence intentionally excludes credentials, JWTs, MFA values, prompts,
// responses, email addresses, and provider request identifiers.

const { randomUUID } = require('node:crypto');
const { mkdirSync, writeFileSync, chmodSync } = require('node:fs');
const { join } = require('node:path');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const runId = process.env.P1_ADMIN_COPILOT_GATE_RUN_ID?.trim() || 'RUN_ID_NOT_REPORTED';
const sourceSha = process.env.P1_ADMIN_COPILOT_GATE_SOURCE_SHA ?? 'SOURCE_SHA_NOT_REPORTED';
const evidenceDir = process.env.P1_ADMIN_COPILOT_GATE_EVIDENCE_DIR ?? '/p1/evidence';
const baseUrl = process.env.P1_ADMIN_COPILOT_GATE_API_BASE ?? 'http://127.0.0.1:3000/api';
let model = '';
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
  return `admin-copilot-provider-gate-${runId}-${randomUUID()}`.slice(0, 128);
}

function evidencePath() {
  return join(evidenceDir, `admin-copilot-provider-gate-${runId}.json`);
}

function writeEvidence(status, details) {
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  const payload = {
    gate: 'ADMIN_COPILOT_REAL_PROVIDER_COST_TRACE',
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
      accountStatus: 'active', suspendedAt: null, bannedAt: null, twoFactorEnabled: true,
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

function safeInteger(value) {
  return Number.isSafeInteger(value) ? value : null;
}

function decimalText(value) {
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  return value;
}

function decimalUnits(value) {
  const text = decimalText(value);
  if (!text) throw gateError('COST_DECIMAL_INVALID');
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

function decimalDelta(after, before) {
  return fixedDecimal(decimalUnits(after ?? '0') - decimalUnits(before ?? '0'));
}

function integerDelta(after, before) {
  const current = safeInteger(after) ?? 0;
  const previous = safeInteger(before) ?? 0;
  return current - previous;
}

function activePricingAt(items, now) {
  return items.filter((item) => item.provider === 'openai' && item.model === model &&
    item.status === 'ACTIVE' && item.effectiveFrom <= now &&
    (!item.effectiveTo || item.effectiveTo > now));
}

function validPricing(pricing) {
  const input = pricing?.inputTokenPrice?.toFixed?.(12);
  const cached = pricing?.cachedInputTokenPrice?.toFixed?.(12);
  const output = pricing?.outputTokenPrice?.toFixed?.(12);
  return pricing?.currency === 'USD' && decimalText(input) && decimalText(cached) && decimalText(output) &&
    decimalUnits(input) > 0n && decimalUnits(cached) >= 0n && decimalUnits(output) > 0n;
}

function publicPricingMatches(pricing, item) {
  const decimal = (value) => value?.toFixed?.(12) ?? null;
  return item?.id === pricing.id && item?.provider === pricing.provider && item?.model === pricing.model &&
    item?.version === pricing.version && item?.status === pricing.status && item?.currency === pricing.currency &&
    item?.inputTokenPrice === decimal(pricing.inputTokenPrice) &&
    item?.cachedInputTokenPrice === decimal(pricing.cachedInputTokenPrice) &&
    item?.outputTokenPrice === decimal(pricing.outputTokenPrice) &&
    item?.effectiveFrom === pricing.effectiveFrom.toISOString() &&
    item?.effectiveTo === (pricing.effectiveTo?.toISOString() ?? null);
}

function modelRow(payload) {
  return payload?.data?.items?.find((item) => item?.provider === 'openai' && item?.modelName === model) ?? null;
}

function featureRow(payload) {
  return payload?.data?.items?.find((item) => item?.feature === 'ADMIN_COPILOT') ?? null;
}

function responseHasSensitiveText(value) {
  if (typeof value !== 'string') return false;
  return /(?:\bBearer\s+|\bsk-[A-Za-z0-9_-]{12,}|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.)/i.test(value);
}

function metadataSource(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value.source : undefined;
}

async function main() {
  if (runId === 'RUN_ID_NOT_REPORTED') throw gateError('MISSING_P1_ADMIN_COPILOT_GATE_RUN_ID', 'NOT_VERIFIED');
  model = required('P1_ADMIN_COPILOT_MODEL');
  if (model !== required('ADMIN_COPILOT_MODEL')) {
    throw gateError('ADMIN_COPILOT_MODEL_RUNTIME_MISMATCH', 'NOT_VERIFIED');
  }
  if (model !== required('OPENAI_MODEL')) {
    throw gateError('OPENAI_MODEL_RUNTIME_MISMATCH', 'NOT_VERIFIED');
  }
  browserPassword = required('P1_BROWSER_PASSWORD');
  browserTotpSecret = required('P1_BROWSER_TOTP_SECRET');

  const principal = await loginSuperAdmin();
  const adminToken = principal.token;
  const capabilities = await request('/admin/copilot/capabilities', { token: adminToken });
  if (!Array.isArray(capabilities?.availableTools) || capabilities.availableTools.length === 0) {
    throw gateError('ADMIN_COPILOT_RBAC_CAPABILITIES_INVALID', 'NOT_VERIFIED');
  }
  const orchestrator = await request('/ai/orchestrator', { token: adminToken });
  const openaiCatalog = orchestrator?.providers?.find((provider) => provider?.name === 'openai');
  if (orchestrator?.active !== 'openai' || !openaiCatalog?.available) {
    throw gateError('ADMIN_COPILOT_OPENAI_RUNTIME_NOT_ACTIVE', 'NOT_VERIFIED');
  }

  const now = new Date();
  const pricingRows = await prisma.providerPricingVersion.findMany({
    where: { provider: 'openai', model, status: 'ACTIVE' },
  });
  const applicablePricing = activePricingAt(pricingRows, now);
  if (applicablePricing.length !== 1 || !validPricing(applicablePricing[0])) {
    throw gateError('ADMIN_COPILOT_ACTIVE_EXACT_PRICING_MISSING', 'NOT_VERIFIED');
  }
  const pricing = applicablePricing[0];
  const pricingPayload = await request(`/admin/costs/pricing?${new URLSearchParams({
    range: 'custom', from: new Date(now.getTime() - 5 * 60_000).toISOString(),
    to: new Date(now.getTime() + 5 * 60_000).toISOString(), provider: 'openai', model,
  })}`, { token: adminToken });
  const publicPricing = pricingPayload?.data?.items?.filter((item) => item?.id === pricing.id) ?? [];
  if (publicPricing.length !== 1 || !publicPricingMatches(pricing, publicPricing[0])) {
    throw gateError('ADMIN_COPILOT_AUTHENTICATED_PRICING_PRECHECK_FAILED', 'NOT_VERIFIED');
  }

  const range = new URLSearchParams({
    range: 'custom', from: new Date(now.getTime() - 5 * 60_000).toISOString(),
    to: new Date(now.getTime() + 5 * 60_000).toISOString(), provider: 'openai', model, feature: 'ADMIN_COPILOT',
  });
  const [beforeModels, beforeFeatures] = await Promise.all([
    request(`/admin/costs/models?${range}`, { token: adminToken }),
    request(`/admin/costs/features?${range}`, { token: adminToken }),
  ]);
  const beforeModel = modelRow(beforeModels);
  const beforeFeature = featureRow(beforeFeatures);

  const requestId = correlationId();
  // Sole provider-triggering request. Its constant wording is non-sensitive,
  // read-only, and is intentionally never persisted in gate evidence.
  const copilot = await request('/admin/copilot/query', {
    method: 'POST', token: adminToken, requestId,
    body: { query: 'What is the current platform health?' },
  });
  if (responseHasSensitiveText(JSON.stringify(copilot))) {
    throw gateError('ADMIN_COPILOT_RESPONSE_REDACTION_FAILED');
  }
  if (
    copilot?.status !== 'AVAILABLE'
    || !copilot?.sources?.some((source) => source?.kind === 'system_health' && source?.status === 'AVAILABLE')
    || copilot?.trace?.provider !== 'openai'
    || copilot?.trace?.model !== model
    || copilot?.trace?.correlation !== requestId
    || copilot?.trace?.costStatus !== 'MEASURED'
  ) {
    throw gateError('ADMIN_COPILOT_RESPONSE_TRACE_INVALID');
  }

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
    throw gateError('ADMIN_COPILOT_LEDGER_SINGLE_ATTEMPT_MISSING');
  }
  if (
    operation.userId !== principal.userId || operation.subscriptionId === null || !operation.planSlug ||
    operation.feature !== 'ADMIN_COPILOT' || operation.resource !== 'AI_TEXT' ||
    operation.requestId !== requestId || operation.status !== 'SUCCEEDED' || !operation.completedAt ||
    operation.unattributedReason !== null || !operation.quotaReservationId ||
    !['PRIMARY', 'FALLBACK'].includes(operation.quotaState) || metadataSource(operation.metadata) !== 'ADMIN_COPILOT' ||
    attempt.provider !== 'openai' || attempt.model !== model || attempt.status !== 'SUCCEEDED' ||
    !attempt.completedAt || !attempt.finalizedAt || attempt.measurementSource !== 'PROVIDER' ||
    attempt.costStatus !== 'MEASURED' || !attempt.providerRequestId || !attempt.pricingVersionId || !attempt.pricingSnapshot
  ) {
    throw gateError('ADMIN_COPILOT_LEDGER_ATTRIBUTION_OR_MEASUREMENT_INVALID');
  }
  if (
    !Number.isSafeInteger(attempt.inputTokens) || attempt.inputTokens < 1 ||
    !Number.isSafeInteger(attempt.outputTokens) || attempt.outputTokens < 1 ||
    !(attempt.cachedInputTokens === null ||
      (Number.isSafeInteger(attempt.cachedInputTokens) && attempt.cachedInputTokens >= 0)) ||
    attempt.pricingVersionId !== pricing.id || attempt.pricingVersion !== pricing.version ||
    attempt.originalCurrency !== 'USD' || !attempt.referenceAmountUsd ||
    decimalUnits(attempt.referenceAmountUsd.toFixed(12)) <= 0n
  ) {
    throw gateError('ADMIN_COPILOT_LEDGER_USAGE_OR_COST_INVALID');
  }

  const reservation = operation.quotaReservation;
  const events = reservation?.ledger?.map((entry) => entry.event) ?? [];
  if (
    !reservation || reservation.userId !== principal.userId || reservation.feature !== 'ADMIN_COPILOT' ||
    reservation.resource !== 'AI_TEXT' || reservation.status !== 'FINALIZED' ||
    reservation.requestedUnits !== 1 || reservation.actualUnits !== 1 ||
    events.filter((event) => event === 'RESERVE').length !== 1 ||
    events.filter((event) => event === 'FINALIZE').length !== 1 ||
    events.filter((event) => event === 'RELEASE').length !== 0
  ) {
    throw gateError('ADMIN_COPILOT_QUOTA_LEDGER_FINALIZATION_INVALID');
  }

  const auditRows = await prisma.auditLog.findMany({
    where: { requestId, action: 'admin.copilot.query' }, select: { action: true, metadata: true, result: true },
  });
  if (auditRows.length !== 1 || auditRows[0]?.result !== 'success' || metadataSource(auditRows[0]?.metadata) !== 'ADMIN_COPILOT') {
    throw gateError('ADMIN_COPILOT_AUDIT_SOURCE_INVALID');
  }

  const [afterModels, afterFeatures] = await Promise.all([
    request(`/admin/costs/models?${range}`, { token: adminToken }),
    request(`/admin/costs/features?${range}`, { token: adminToken }),
  ]);
  const afterModel = modelRow(afterModels);
  const afterFeature = featureRow(afterFeatures);
  const recordedUsd = attempt.referenceAmountUsd.toFixed(12);
  if (!afterModel || afterModel.providerCalls !== (beforeModel?.providerCalls ?? 0) + 1 ||
    decimalDelta(afterModel.cost?.knownSubtotalUsd, beforeModel?.cost?.knownSubtotalUsd) !== recordedUsd ||
    integerDelta(afterModel.inputTokens, beforeModel?.inputTokens) !== attempt.inputTokens ||
    integerDelta(afterModel.cachedInputTokens, beforeModel?.cachedInputTokens) !== (attempt.cachedInputTokens ?? 0) ||
    integerDelta(afterModel.outputTokens, beforeModel?.outputTokens) !== attempt.outputTokens) {
    throw gateError('ADMIN_COPILOT_COST_CENTER_MODEL_DELTA_INVALID');
  }
  if (!afterFeature || afterFeature.providerCalls !== (beforeFeature?.providerCalls ?? 0) + 1 ||
    decimalDelta(afterFeature.cost?.knownSubtotalUsd, beforeFeature?.cost?.knownSubtotalUsd) !== recordedUsd) {
    throw gateError('ADMIN_COPILOT_COST_CENTER_FEATURE_DELTA_INVALID');
  }

  writeEvidence('PASS', {
    correlationId: requestId,
    provider: attempt.provider,
    model: attempt.model,
    operation: {
      status: operation.status, feature: operation.feature, resource: operation.resource,
      source: 'ADMIN_COPILOT', userAttributed: true, subscriptionAttributed: true,
      planAttributed: Boolean(operation.planSlug), quotaState: operation.quotaState,
    },
    attempt: {
      status: attempt.status, measurementSource: attempt.measurementSource,
      providerRequestIdPresent: true, inputTokens: attempt.inputTokens,
      cachedInputTokens: attempt.cachedInputTokens, outputTokens: attempt.outputTokens,
      costStatus: attempt.costStatus,
    },
    quotaLedger: {
      reservationStatus: reservation.status, requestedUnits: reservation.requestedUnits,
      actualUnits: reservation.actualUnits, reserveEvents: 1, finalizeEvents: 1, releaseEvents: 0,
    },
    pricing: { active: true, exactModel: true, version: attempt.pricingVersion, currency: attempt.originalCurrency },
    cost: { recordedUsd, costStatus: attempt.costStatus },
    costCenter: {
      modelProviderCallsBefore: beforeModel?.providerCalls ?? 0,
      modelProviderCallsAfter: afterModel.providerCalls,
      modelInputTokensDelta: integerDelta(afterModel.inputTokens, beforeModel?.inputTokens),
      modelCachedInputTokensDelta: integerDelta(afterModel.cachedInputTokens, beforeModel?.cachedInputTokens),
      modelOutputTokensDelta: integerDelta(afterModel.outputTokens, beforeModel?.outputTokens),
      modelAmountDeltaUsd: decimalDelta(afterModel.cost?.knownSubtotalUsd, beforeModel?.cost?.knownSubtotalUsd),
      feature: 'ADMIN_COPILOT', featureCallsBefore: beforeFeature?.providerCalls ?? 0,
      featureCallsAfter: afterFeature.providerCalls,
      featureAmountDeltaUsd: decimalDelta(afterFeature.cost?.knownSubtotalUsd, beforeFeature?.cost?.knownSubtotalUsd),
      costStatus: afterFeature.cost?.costStatus,
    },
    audit: { source: 'ADMIN_COPILOT', queryAuditEntries: 1 },
    safety: { rbacAuthenticatedSuperAdmin: true, responseRedactionChecked: true, mutationExecuted: false },
  });
}

main()
  .then(() => process.stdout.write('ADMIN_COPILOT_PROVIDER_GATE_PASS\n'))
  .catch((error) => {
    const status = error?.gateStatus === 'NOT_VERIFIED' ? 'NOT_VERIFIED' : 'FAIL';
    const code = typeof error?.code === 'string'
      ? error.code.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120)
      : 'ADMIN_COPILOT_PROVIDER_GATE_UNEXPECTED';
    writeEvidence(status, { code });
    process.stdout.write(`ADMIN_COPILOT_PROVIDER_GATE_${status}\n`);
    process.exitCode = status === 'NOT_VERIFIED' ? 2 : 1;
  })
  .finally(() => prisma.$disconnect());
