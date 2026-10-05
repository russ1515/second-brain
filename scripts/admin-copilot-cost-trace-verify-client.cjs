'use strict';

// Verification-only companion to the bounded Admin Copilot provider gate.
// It never invokes /admin/copilot/query and therefore cannot make a provider
// request. It reconciles the already-recorded immutable operation, quota,
// privacy-safe audit entry, and authenticated Admin Cost Center response.

const { mkdirSync, writeFileSync, chmodSync } = require('node:fs');
const { join } = require('node:path');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const runId = process.env.P1_ADMIN_COPILOT_VERIFY_RUN_ID?.trim() || 'RUN_ID_NOT_REPORTED';
const sourceSha = process.env.P1_ADMIN_COPILOT_VERIFY_SOURCE_SHA ?? 'SOURCE_SHA_NOT_REPORTED';
const originalRunId = process.env.P1_ADMIN_COPILOT_GATE_ORIGINAL_RUN_ID ?? 'ORIGINAL_RUN_ID_NOT_REPORTED';
const evidenceDir = process.env.P1_ADMIN_COPILOT_GATE_EVIDENCE_DIR ?? '/p1/evidence';
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

function evidencePath() {
  return join(evidenceDir, `admin-copilot-provider-trace-verification-${runId}.json`);
}

function writeEvidence(status, details) {
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  const payload = {
    gate: 'ADMIN_COPILOT_REAL_PROVIDER_COST_TRACE_VERIFICATION',
    status,
    runId,
    originalRunId,
    sourceSha,
    recordedAt: new Date().toISOString(),
    ...details,
  };
  writeFileSync(evidencePath(), `${JSON.stringify(payload)}\n`, { mode: 0o600 });
  chmodSync(evidencePath(), 0o600);
}

async function request(path, { method = 'GET', token, body } = {}) {
  let response;
  try {
    response = await fetch(`http://127.0.0.1:3000/api${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  if (matching.length !== 1) throw gateError('P1_SUPER_ADMIN_FIXTURE_AMBIGUOUS_OR_MISSING', 'NOT_VERIFIED');
  return matching[0];
}

async function loginSuperAdmin() {
  const email = await resolveSuperAdminFixtureEmail();
  const login = await request('/auth/login', { method: 'POST', body: { email, password: browserPassword } });
  if (!login?.twoFactorRequired || typeof login?.challengeToken !== 'string') {
    throw gateError('P1_SUPER_ADMIN_MFA_CHALLENGE_INVALID', 'NOT_VERIFIED');
  }
  const verified = await request('/auth/2fa/verify', {
    method: 'POST', body: { challengeToken: login.challengeToken, code: authenticator.generate(browserTotpSecret) },
  });
  if (typeof verified?.tokens?.accessToken !== 'string') {
    throw gateError('P1_SUPER_ADMIN_MFA_VERIFY_INVALID', 'NOT_VERIFIED');
  }
  return verified.tokens.accessToken;
}

function metadataSource(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value.source : undefined;
}

function metadataPromptStored(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value.promptStored : undefined;
}

function modelRow(payload, provider, model) {
  return payload?.data?.items?.find((item) => item?.provider === provider && item?.modelName === model) ?? null;
}

function featureRow(payload) {
  return payload?.data?.items?.find((item) => item?.feature === 'ADMIN_COPILOT') ?? null;
}

function containsSensitiveResponseText(value) {
  return /(?:\bBearer\s+|\bsk-[A-Za-z0-9_-]{12,}|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.)/i.test(value);
}

function validCorrelationId(value) {
  return /^[A-Za-z0-9:_-]{8,128}$/.test(value);
}

async function main() {
  if (runId === 'RUN_ID_NOT_REPORTED') throw gateError('MISSING_P1_ADMIN_COPILOT_VERIFY_RUN_ID', 'NOT_VERIFIED');
  const correlationId = required('P1_ADMIN_COPILOT_GATE_CORRELATION_ID');
  if (!validCorrelationId(correlationId)) throw gateError('ADMIN_COPILOT_CORRELATION_ID_INVALID', 'NOT_VERIFIED');
  browserPassword = required('P1_BROWSER_PASSWORD');
  browserTotpSecret = required('P1_BROWSER_TOTP_SECRET');

  const operations = await prisma.providerUsageOperation.findMany({
    where: { requestId: correlationId, attempts: { some: { provider: 'openai' } } },
    include: {
      attempts: { orderBy: { attemptNumber: 'asc' } },
      quotaReservation: { include: { ledger: { orderBy: { createdAt: 'asc' } } } },
    },
  });
  const operation = operations[0];
  const attempt = operation?.attempts?.[0];
  if (operations.length !== 1 || !operation || !attempt || operation.attempts.length !== 1) {
    throw gateError('ADMIN_COPILOT_LEDGER_SINGLE_ATTEMPT_MISSING');
  }
  if (
    !operation.userId || operation.subscriptionId === null || !operation.planSlug || operation.feature !== 'ADMIN_COPILOT' ||
    operation.resource !== 'AI_TEXT' || operation.requestId !== correlationId || operation.status !== 'SUCCEEDED' ||
    !operation.completedAt || operation.unattributedReason !== null || !operation.quotaReservationId ||
    !['PRIMARY', 'FALLBACK'].includes(operation.quotaState) || metadataSource(operation.metadata) !== 'ADMIN_COPILOT' ||
    attempt.provider !== 'openai' || !attempt.model || attempt.status !== 'SUCCEEDED' || !attempt.completedAt ||
    !attempt.finalizedAt || attempt.measurementSource !== 'PROVIDER' || attempt.costStatus !== 'MEASURED' ||
    !attempt.providerRequestId || !attempt.pricingVersionId || !attempt.pricingSnapshot ||
    !Number.isSafeInteger(attempt.inputTokens) || attempt.inputTokens < 1 ||
    !Number.isSafeInteger(attempt.outputTokens) || attempt.outputTokens < 1 ||
    !(attempt.cachedInputTokens === null || (Number.isSafeInteger(attempt.cachedInputTokens) && attempt.cachedInputTokens >= 0)) ||
    !attempt.referenceAmountUsd || attempt.referenceAmountUsd.lessThanOrEqualTo(0)
  ) {
    throw gateError('ADMIN_COPILOT_LEDGER_ATTRIBUTION_OR_MEASUREMENT_INVALID');
  }

  const reservation = operation.quotaReservation;
  const events = reservation?.ledger?.map((entry) => entry.event) ?? [];
  if (
    !reservation || reservation.userId !== operation.userId || reservation.feature !== 'ADMIN_COPILOT' ||
    reservation.resource !== 'AI_TEXT' || reservation.status !== 'FINALIZED' || reservation.requestedUnits !== 1 ||
    reservation.actualUnits !== 1 || events.filter((event) => event === 'RESERVE').length !== 1 ||
    events.filter((event) => event === 'FINALIZE').length !== 1 || events.filter((event) => event === 'RELEASE').length !== 0
  ) {
    throw gateError('ADMIN_COPILOT_QUOTA_LEDGER_FINALIZATION_INVALID');
  }

  // The immutable audit record intentionally redacts the caller-controlled
  // request header. Correlate it with the same actor and a tightly bounded
  // operation window instead of weakening the redaction policy.
  const auditRows = await prisma.auditLog.findMany({
    where: {
      action: 'admin.copilot.query', targetType: 'AdminCopilotConversation', actorId: operation.userId,
      createdAt: {
        gte: new Date(operation.startedAt.getTime() - 60_000),
        lte: new Date(operation.completedAt.getTime() + 60_000),
      },
    },
    select: { requestId: true, result: true, metadata: true },
  });
  if (
    auditRows.length !== 1 || auditRows[0]?.requestId !== '[REDACTED]' || auditRows[0]?.result !== 'available' ||
    metadataSource(auditRows[0]?.metadata) !== 'ADMIN_COPILOT' || metadataPromptStored(auditRows[0]?.metadata) !== false
  ) {
    throw gateError('ADMIN_COPILOT_AUDIT_PRIVACY_SAFE_TRACE_INVALID');
  }

  const token = await loginSuperAdmin();
  const from = attempt.startedAt.toISOString();
  const to = new Date(attempt.startedAt.getTime() + 1).toISOString();
  const range = new URLSearchParams({
    range: 'custom', from, to, provider: attempt.provider, model: attempt.model, feature: 'ADMIN_COPILOT',
  });
  const [models, features] = await Promise.all([
    request(`/admin/costs/models?${range}`, { token }),
    request(`/admin/costs/features?${range}`, { token }),
  ]);
  if (containsSensitiveResponseText(JSON.stringify({ models, features }))) {
    throw gateError('ADMIN_COPILOT_COST_CENTER_RESPONSE_REDACTION_FAILED');
  }
  const model = modelRow(models, attempt.provider, attempt.model);
  const feature = featureRow(features);
  const costUsd = attempt.referenceAmountUsd.toFixed(12);
  const exactModel = model && model.providerCalls === 1 && model.inputTokens === attempt.inputTokens &&
    model.cachedInputTokens === (attempt.cachedInputTokens ?? 0) && model.outputTokens === attempt.outputTokens &&
    model.cost?.costStatus === 'MEASURED' && model.cost?.knownSubtotalUsd === costUsd;
  const exactFeature = feature && feature.providerCalls === 1 && feature.cost?.costStatus === 'MEASURED' &&
    feature.cost?.knownSubtotalUsd === costUsd;
  if (!exactModel || !exactFeature) throw gateError('ADMIN_COPILOT_COST_CENTER_EXACT_TRACE_INVALID');

  writeEvidence('PASS', {
    correlationId,
    provider: attempt.provider,
    model: attempt.model,
    operation: {
      status: operation.status, feature: operation.feature, resource: operation.resource, source: 'ADMIN_COPILOT',
      userAttributed: true, subscriptionAttributed: true, planAttributed: true, quotaState: operation.quotaState,
    },
    attempt: {
      status: attempt.status, measurementSource: attempt.measurementSource, providerRequestIdPresent: true,
      inputTokens: attempt.inputTokens, cachedInputTokens: attempt.cachedInputTokens, outputTokens: attempt.outputTokens,
      costStatus: attempt.costStatus,
    },
    cost: { recordedUsd: costUsd, costStatus: attempt.costStatus },
    quotaLedger: { reservationStatus: reservation.status, reserveEvents: 1, finalizeEvents: 1, releaseEvents: 0 },
    audit: { source: 'ADMIN_COPILOT', requestIdRedacted: true, promptStored: false, result: 'available' },
    costCenter: {
      authenticated: true, exactAttemptWindow: { from, to }, modelProviderCalls: model.providerCalls,
      modelInputTokens: model.inputTokens, modelCachedInputTokens: model.cachedInputTokens,
      modelOutputTokens: model.outputTokens, modelAmountUsd: model.cost.knownSubtotalUsd,
      feature: 'ADMIN_COPILOT', featureProviderCalls: feature.providerCalls, featureAmountUsd: feature.cost.knownSubtotalUsd,
      costStatus: feature.cost.costStatus,
    },
    safety: { verificationOnly: true, providerRequestsTriggered: 0, rbacAuthenticatedSuperAdmin: true, mutationExecuted: false },
  });
}

main()
  .then(() => process.stdout.write('ADMIN_COPILOT_COST_TRACE_VERIFICATION_PASS\n'))
  .catch((error) => {
    const status = error?.gateStatus === 'NOT_VERIFIED' ? 'NOT_VERIFIED' : 'FAIL';
    const code = typeof error?.code === 'string'
      ? error.code.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120)
      : 'ADMIN_COPILOT_COST_TRACE_VERIFICATION_UNEXPECTED';
    writeEvidence(status, { code });
    process.stdout.write(`ADMIN_COPILOT_COST_TRACE_VERIFICATION_${status}\n`);
    process.exitCode = status === 'NOT_VERIFIED' ? 2 : 1;
  })
  .finally(() => prisma.$disconnect());
