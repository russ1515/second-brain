/*
 * Explicit, staging-only PostgreSQL + HTTP validation for the restrictive
 * AI_TEXT private-beta quota cap.
 *
 * This is deliberately a direct Node harness rather than an always-on test:
 * it creates short-lived technical fixtures in a caller-confirmed staging DB,
 * calls the running loopback API, and removes every fixture before exiting.
 * It must never be pointed at production or at a public API endpoint.
 *
 * Required environment:
 *   STAGING_QUOTA_CAP_HTTP_TEST_CONFIRM=I_UNDERSTAND_STAGING_ONLY
 *   STAGING_QUOTA_CAP_HTTP_TEST_DATABASE_CONFIRM=I_UNDERSTAND_NON_PRODUCTION_DATABASE
 *   STAGING_QUOTA_CAP_HTTP_ISOLATED_DB_CONFIRM=I_UNDERSTAND_STAGING_QUOTA_CAP_ISOLATED_DATABASE_ONLY
 *   STAGING_QUOTA_CAP_HTTP_TEST_STAGE=OVH_PRIVATE_STAGING
 *   STAGING_QUOTA_CAP_HTTP_TEST_API_URL=http://127.0.0.1:<port>/api
 *   STAGING_QUOTA_CAP_HTTP_TEST_EVIDENCE_DIR=/absolute/outside-git/evidence
 *   DATABASE_URL=<staging_quota_cap_http_gate_<run-id> PostgreSQL URL>
 *   TWO_FACTOR_ENC_KEY=<existing staging secret, not printed>
 *   LLM_PROVIDER=echo
 *   EMBEDDINGS_PROVIDER=fake
 *
 * The test does not call an external provider.  It requires the local echo
 * provider so its three permitted Tutor calls are safely observable in the
 * provider ledger.  It performs no plan, price, global-quota, migration, or
 * human-account mutation.
 */
const assert = require('node:assert/strict');
const { createCipheriv, createHash, randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const CONFIRMATION = 'I_UNDERSTAND_STAGING_ONLY';
const DATABASE_CONFIRMATION = 'I_UNDERSTAND_NON_PRODUCTION_DATABASE';
const ISOLATED_CONFIRMATION = 'I_UNDERSTAND_STAGING_QUOTA_CAP_ISOLATED_DATABASE_ONLY';
const STAGE = 'OVH_PRIVATE_STAGING';
const CAP_LIMIT = 3;
const CONCURRENT_REQUESTS = 10;
const apiBase = (process.env.STAGING_QUOTA_CAP_HTTP_TEST_API_URL ?? '').replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL ?? '';
const evidenceDir = process.env.STAGING_QUOTA_CAP_HTTP_TEST_EVIDENCE_DIR ?? '';
const cipherMaterial = process.env.TWO_FACTOR_ENC_KEY ?? '';
const runId = `staging-quota-cap-${Date.now()}-${randomBytes(4).toString('hex')}`;
const prisma = new PrismaClient();

const fixture = {
  admin: null,
  learner: null,
  adminToken: null,
  learnerToken: null,
  betaGrantId: null,
  capId: null,
  betaExpiry: null,
  capExpiry: null,
};

const evidence = {
  gate: 'STAGING_QUOTA_CAP_HTTP',
  runId,
  generatedAt: new Date().toISOString(),
  status: 'RUNNING',
  environment: {
    explicitConfirmation: 'NOT_VERIFIED',
    stageGuard: 'NOT_VERIFIED',
    loopbackApiGuard: 'NOT_VERIFIED',
    nonProductionDatabaseGuard: 'NOT_VERIFIED',
    postgresqlConnection: 'NOT_VERIFIED',
    echoProviderGuard: 'NOT_VERIFIED',
  },
  checks: {
    technicalFixturesOnly: 'NOT_VERIFIED',
    adminMfaAndStepUp: 'NOT_VERIFIED',
    learnerPrivateBetaGrant: 'NOT_VERIFIED',
    capEndpointRejectsUnsteppedAdmin: 'NOT_VERIFIED',
    capDoesNotIncreaseAllowance: 'NOT_VERIFIED',
    capExpiresWithinBetaGrant: 'NOT_VERIFIED',
    learnerAdminAccessDenied: 'NOT_VERIFIED',
    concurrentTutorRequests: 'NOT_VERIFIED',
    providerNotInvokedAfterBlocked: 'NOT_VERIFIED',
    primaryFallbackBlockedInvariant: 'NOT_VERIFIED',
    auditAndSecurityEvidence: 'NOT_VERIFIED',
    capRevoked: 'NOT_VERIFIED',
    betaGrantRevoked: 'NOT_VERIFIED',
    fixturesRemoved: 'NOT_VERIFIED',
  },
  counts: {},
  cleanup: { attempted: false, completed: false },
  failure: null,
};

class GateError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function requireCondition(condition, code) {
  if (!condition) throw new GateError(code);
}

function responseCode(body) {
  if (!body || typeof body !== 'object') return undefined;
  return body.code ?? body.message?.code;
}

function safeFailureCode(error) {
  if (error instanceof GateError) return error.code;
  if (error instanceof assert.AssertionError) return 'ASSERTION_FAILED';
  const candidate = typeof error?.code === 'string' ? error.code : '';
  return /^[A-Z][A-Z0-9_]{2,80}$/.test(candidate) ? candidate : 'SAFE_FAILURE';
}

function safePositiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function ensureExecutionGuards() {
  requireCondition(process.env.STAGING_QUOTA_CAP_HTTP_TEST_CONFIRM === CONFIRMATION, 'EXPLICIT_CONFIRMATION_REQUIRED');
  evidence.environment.explicitConfirmation = 'PASS';
  requireCondition(process.env.STAGING_QUOTA_CAP_HTTP_TEST_DATABASE_CONFIRM === DATABASE_CONFIRMATION, 'DATABASE_CONFIRMATION_REQUIRED');
  requireCondition(process.env.STAGING_QUOTA_CAP_HTTP_ISOLATED_DB_CONFIRM === ISOLATED_CONFIRMATION, 'ISOLATED_DATABASE_CONFIRMATION_REQUIRED');
  requireCondition(process.env.STAGING_QUOTA_CAP_HTTP_TEST_STAGE === STAGE, 'STAGING_STAGE_REQUIRED');
  evidence.environment.stageGuard = 'PASS';

  requireCondition(/^http:\/\/127\.0\.0\.1:\d{2,5}\/api$/u.test(apiBase), 'LOOPBACK_API_REQUIRED');
  evidence.environment.loopbackApiGuard = 'PASS';

  requireCondition(Boolean(evidenceDir) && path.isAbsolute(evidenceDir), 'ABSOLUTE_EVIDENCE_DIRECTORY_REQUIRED');
  requireCondition(Boolean(cipherMaterial), 'TWO_FACTOR_ENC_KEY_REQUIRED');
  requireCondition(process.env.NODE_ENV === 'test', 'NODE_ENV_TEST_REQUIRED');
  requireCondition(process.env.PRIVATE_BETA_ENFORCED === 'true', 'PRIVATE_BETA_ENFORCEMENT_REQUIRED');
  requireCondition(process.env.MAIL_TRANSPORT === 'log', 'LOG_MAIL_TRANSPORT_REQUIRED');
  requireCondition(process.env.LLM_PROVIDER === 'echo', 'ECHO_PROVIDER_REQUIRED');
  requireCondition(process.env.EMBEDDINGS_PROVIDER === 'fake', 'FAKE_EMBEDDINGS_PROVIDER_REQUIRED');
  evidence.environment.echoProviderGuard = 'PASS';

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new GateError('DATABASE_URL_INVALID');
  }
  requireCondition(parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:', 'POSTGRES_DATABASE_URL_REQUIRED');
  const databaseName = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const normalized = `${parsed.hostname}/${databaseName}`.toLowerCase();
  requireCondition(Boolean(databaseName), 'DATABASE_NAME_REQUIRED');
  requireCondition(parsed.hostname === 'postgres' && (parsed.port === '' || parsed.port === '5432'), 'ISOLATED_POSTGRES_SERVICE_REQUIRED');
  requireCondition(/^staging_quota_cap_http_gate_[a-z0-9_]{8,64}$/u.test(databaseName), 'ISOLATED_DATABASE_NAME_REQUIRED');
  evidence.environment.nonProductionDatabaseGuard = 'PASS';
}

function encryptTotpSecret(plaintext) {
  const key = createHash('sha256').update(cipherMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

function testPassword() {
  // Kept in memory only.  It is never logged, persisted in evidence, or reused.
  return `Qcap-${randomBytes(24).toString('base64url')}-Aa1!`;
}

async function apiRequest(pathname, { method = 'GET', token, body, requestId } = {}) {
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    signal: AbortSignal.timeout(30_000),
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': requestId ?? `${runId}-${randomUUID()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, body: payload };
}

function accessSessionId(accessToken) {
  try {
    const encoded = accessToken.split('.')[1];
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return typeof payload.sessionId === 'string' ? payload.sessionId : null;
  } catch {
    return null;
  }
}

async function loginAdmin(email, password, totpSecret) {
  const login = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200, 'technical admin login must succeed');
  assert.equal(login.body?.twoFactorRequired, true, 'technical admin must require MFA');
  const verified = await apiRequest('/auth/2fa/verify', {
    method: 'POST',
    body: { challengeToken: login.body?.challengeToken, code: authenticator.generate(totpSecret) },
  });
  assert.equal(verified.status, 200, 'technical admin MFA verification must succeed');
  const token = verified.body?.tokens?.accessToken;
  assert.equal(typeof token, 'string', 'technical admin access token must be present');
  return token;
}

async function loginLearner(email, password) {
  const login = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200, 'technical learner login must succeed after beta grant');
  assert.equal(login.body?.twoFactorRequired, undefined, 'technical learner fixture must not require MFA');
  const token = login.body?.tokens?.accessToken;
  assert.equal(typeof token, 'string', 'technical learner access token must be present');
  return token;
}

async function ageAdminMfaProof(token) {
  const sessionId = accessSessionId(token);
  requireCondition(Boolean(sessionId), 'ADMIN_SESSION_ID_MISSING');
  const stepUpTtl = safePositiveInteger(process.env.ADMIN_STEP_UP_TTL, 600);
  const sessionMaxTtl = safePositiveInteger(process.env.ADMIN_SESSION_MAX_TTL, 28_800);
  requireCondition(sessionMaxTtl > stepUpTtl + 5, 'STEP_UP_TEST_TTLS_INCOMPATIBLE');
  await prisma.session.update({
    where: { id: sessionId },
    data: { mfaVerifiedAt: new Date(Date.now() - (stepUpTtl + 5) * 1_000) },
  });
}

async function stepUp(token, totpSecret) {
  const response = await apiRequest('/auth/2fa/step-up', {
    method: 'POST', token, body: { code: authenticator.generate(totpSecret) },
  });
  assert.equal(response.status, 200, 'technical admin step-up must succeed');
}

async function verifyPostgres() {
  const rows = await prisma.$queryRawUnsafe('SELECT version() AS version');
  const version = Array.isArray(rows) ? rows[0]?.version : undefined;
  requireCondition(typeof version === 'string' && /postgresql/iu.test(version), 'POSTGRESQL_CONNECTION_REQUIRED');
  evidence.environment.postgresqlConnection = 'PASS';
}

async function createFixtures(password, totpSecret) {
  const passwordHash = await argon2.hash(password);
  const betaExpiry = new Date(Date.now() + 30 * 60_000);
  fixture.betaExpiry = betaExpiry;
  const [admin, learner] = await prisma.$transaction([
    prisma.user.create({
      data: {
        email: `${runId}-admin@example.test`,
        passwordHash,
        emailVerified: true,
        accountStatus: 'active',
        twoFactorEnabled: true,
        twoFactorSecret: encryptTotpSecret(totpSecret),
      },
      select: { id: true, email: true },
    }),
    prisma.user.create({
      data: {
        email: `${runId}-learner@example.test`,
        passwordHash,
        emailVerified: true,
        accountStatus: 'active',
      },
      select: { id: true, email: true },
    }),
  ]);
  fixture.admin = admin;
  fixture.learner = learner;
  await prisma.$transaction([
    prisma.adminRoleAssignment.create({
      data: { userId: admin.id, role: 'SUPER_ADMIN', reason: 'Technical staging quota-cap HTTP fixture' },
    }),
    // This technical precondition permits the fixture admin to authenticate if
    // PRIVATE_BETA_ENFORCED is already enabled.  The learner grant itself is
    // deliberately exercised through the protected HTTP endpoint below.
    prisma.entitlementOverride.create({
      data: {
        userId: admin.id,
        kind: 'feature',
        key: 'private_beta_access',
        value: true,
        reason: 'Technical staging quota-cap fixture access',
        grantedById: admin.id,
        startsAt: new Date(),
        endsAt: betaExpiry,
      },
    }),
  ]);
  evidence.checks.technicalFixturesOnly = 'PASS';
}

async function verifyBaselineAllowance() {
  const freePlan = await prisma.plan.findUnique({
    where: { slug: 'free' },
    select: { id: true, configurationVersion: true, quotas: true },
  });
  requireCondition(Boolean(freePlan), 'FREE_PLAN_REQUIRED');
  const version = await prisma.planVersion.findUnique({
    where: { planId_version: { planId: freePlan.id, version: freePlan.configurationVersion } },
    select: { quotas: true },
  });
  const quotas = (version?.quotas ?? freePlan.quotas ?? {});
  const raw = quotas && typeof quotas === 'object' ? quotas.ai_questions : undefined;
  if (raw !== undefined && raw !== null && typeof raw === 'number' && raw >= 0) {
    requireCondition(Number.isSafeInteger(raw) && raw >= CAP_LIMIT, 'BASELINE_AI_TEXT_ALLOWANCE_TOO_SMALL');
    return { kind: 'FINITE_AT_LEAST_CAP', limit: raw };
  }
  requireCondition(raw === undefined || raw === null || (typeof raw === 'number' && raw < 0), 'BASELINE_AI_TEXT_ALLOWANCE_INVALID');
  return { kind: 'UNLIMITED_OR_UNCONFIGURED', limit: null };
}

async function createBetaGrantWithStepUp(totpSecret) {
  await ageAdminMfaProof(fixture.adminToken);
  const denied = await apiRequest(`/admin/users/${fixture.learner.id}/private-beta-access`, {
    method: 'POST', token: fixture.adminToken,
    body: { expiresAt: fixture.betaExpiry.toISOString(), reason: 'Technical staging quota-cap validation' },
  });
  assert.equal(denied.status, 403, 'private beta grant must reject an aged MFA proof');
  assert.equal(responseCode(denied.body), 'ADMIN_STEP_UP_REQUIRED');
  await stepUp(fixture.adminToken, totpSecret);
  const granted = await apiRequest(`/admin/users/${fixture.learner.id}/private-beta-access`, {
    method: 'POST', token: fixture.adminToken,
    body: { expiresAt: fixture.betaExpiry.toISOString(), reason: 'Technical staging quota-cap validation' },
  });
  assert.equal(granted.status, 201, 'private beta grant must be created through protected HTTP');
  assert.equal(typeof granted.body?.id, 'string');
  fixture.betaGrantId = granted.body.id;
  evidence.checks.adminMfaAndStepUp = 'PASS';
  evidence.checks.learnerPrivateBetaGrant = 'PASS';
}

async function createCapWithStepUp(totpSecret, baselineAllowance) {
  fixture.capExpiry = new Date(Date.now() + 10 * 60_000);
  requireCondition(fixture.capExpiry < fixture.betaExpiry, 'CAP_EXPIRY_MUST_PRECEDE_BETA_GRANT');

  await ageAdminMfaProof(fixture.adminToken);
  const denied = await apiRequest(`/admin/users/${fixture.learner.id}/staging-quota-cap`, {
    method: 'POST', token: fixture.adminToken,
    body: {
      resource: 'AI_TEXT', limit: CAP_LIMIT, expiresAt: fixture.capExpiry.toISOString(),
      reason: 'Technical staging quota-cap validation',
    },
  });
  assert.equal(denied.status, 403, 'cap creation must reject an aged MFA proof');
  assert.equal(responseCode(denied.body), 'ADMIN_STEP_UP_REQUIRED');
  evidence.checks.capEndpointRejectsUnsteppedAdmin = 'PASS';

  await stepUp(fixture.adminToken, totpSecret);
  if (baselineAllowance.limit !== null && baselineAllowance.limit < 1_000_000_000) {
    const widening = await apiRequest(`/admin/users/${fixture.learner.id}/staging-quota-cap`, {
      method: 'POST', token: fixture.adminToken,
      body: {
        resource: 'AI_TEXT', limit: baselineAllowance.limit + 1, expiresAt: fixture.capExpiry.toISOString(),
        reason: 'Technical validation must reject a wider allowance',
      },
    });
    assert.equal(widening.status, 409, 'the cap endpoint must reject a value above the existing allowance');
    assert.equal(responseCode(widening.body), 'STAGING_QUOTA_CAP_MUST_NOT_INCREASE_ALLOWANCE');
  }
  const created = await apiRequest(`/admin/users/${fixture.learner.id}/staging-quota-cap`, {
    method: 'POST', token: fixture.adminToken,
    body: {
      resource: 'AI_TEXT', limit: CAP_LIMIT, expiresAt: fixture.capExpiry.toISOString(),
      reason: 'Technical staging quota-cap validation',
    },
  });
  assert.equal(created.status, 201, 'cap creation must succeed after MFA step-up');
  assert.equal(created.body?.resource, 'AI_TEXT');
  assert.equal(created.body?.limit, CAP_LIMIT);
  assert.equal(typeof created.body?.id, 'string');
  fixture.capId = created.body.id;
  const createdExpiry = new Date(created.body.expiresAt);
  assert.ok(createdExpiry <= fixture.betaExpiry, 'cap expiry must not outlast beta access');
  evidence.checks.capDoesNotIncreaseAllowance = 'PASS';
  evidence.checks.capExpiresWithinBetaGrant = 'PASS';
}

async function createTutorSessions() {
  const sessions = [];
  for (let index = 0; index < CONCURRENT_REQUESTS; index += 1) {
    const created = await apiRequest('/tutor/sessions', {
      method: 'POST', token: fixture.learnerToken,
      body: { title: `Technical quota cap validation ${index + 1}` },
    });
    assert.equal(created.status, 201, 'technical Tutor session creation must succeed');
    assert.equal(typeof created.body?.id, 'string');
    sessions.push(created.body.id);
  }
  return sessions;
}

async function runConcurrentTutorRequests(sessionIds) {
  const requestIds = sessionIds.map((_, index) => `${runId}-tutor-${index + 1}`);
  const responses = await Promise.all(sessionIds.map((sessionId, index) => apiRequest(`/tutor/sessions/${sessionId}/messages`, {
    method: 'POST',
    token: fixture.learnerToken,
    requestId: requestIds[index],
    body: { content: `Technical staging quota cap probe ${index + 1}.` },
  })));
  const allowed = responses.filter((response) => response.status === 201);
  const blocked = responses.filter((response) => response.status === 403 && responseCode(response.body) === 'QUOTA_EXHAUSTED');
  assert.equal(allowed.length, CAP_LIMIT, 'exactly the cap limit may reach Tutor');
  assert.equal(blocked.length, CONCURRENT_REQUESTS - CAP_LIMIT, 'remaining concurrent requests must block before Tutor provider work');
  assert.equal(allowed.length + blocked.length, CONCURRENT_REQUESTS, 'no concurrent request may fail by another path');
  evidence.checks.concurrentTutorRequests = 'PASS';
  evidence.counts.http = { requested: CONCURRENT_REQUESTS, allowed: allowed.length, blocked: blocked.length };
  return requestIds;
}

async function verifyQuotaAndProviderEvidence(requestIds) {
  const [cycle, operations, attempts, legacyUsage] = await Promise.all([
    prisma.quotaCycle.findFirst({
      where: { userId: fixture.learner.id, status: 'ACTIVE' },
      orderBy: { startsAt: 'desc' },
      include: { accounts: { where: { resource: 'AI_TEXT' } } },
    }),
    prisma.providerUsageOperation.findMany({
      where: { userId: fixture.learner.id, resource: 'AI_TEXT' },
      select: { id: true, requestId: true, status: true, quotaState: true },
    }),
    prisma.providerUsageAttempt.findMany({
      where: { operation: { userId: fixture.learner.id, resource: 'AI_TEXT' } },
      select: { id: true, operationId: true, status: true, provider: true },
    }),
    prisma.providerUsage.count({ where: { userId: fixture.learner.id, resource: 'AI_TEXT' } }),
  ]);
  requireCondition(Boolean(cycle), 'AI_TEXT_CYCLE_REQUIRED');
  assert.equal(cycle.accounts.length, 1, 'one AI_TEXT account must exist for the technical learner');
  const account = cycle.accounts[0];
  const reservations = await prisma.quotaReservation.findMany({
    where: { userId: fixture.learner.id, cycleId: cycle.id, accountId: account.id, resource: 'AI_TEXT' },
    select: { id: true, idempotencyKey: true, primaryUnits: true, fallbackUnits: true, status: true, actualUnits: true },
  });
  const reserveLedger = await prisma.usageLedger.findMany({
    where: { userId: fixture.learner.id, cycleId: cycle.id, resource: 'AI_TEXT', event: 'RESERVE' },
    select: { id: true, idempotencyKey: true, primaryDelta: true, fallbackDelta: true, reservationId: true },
  });

  assert.equal(reservations.length, CAP_LIMIT, 'blocked requests must not reserve quota');
  assert.equal(new Set(reservations.map((row) => row.idempotencyKey)).size, CAP_LIMIT, 'every permitted request needs one idempotency key');
  assert.ok(reservations.every((row) => row.primaryUnits === 1 && row.fallbackUnits === 0 && row.status === 'FINALIZED' && row.actualUnits === 1));
  assert.equal(reserveLedger.length, CAP_LIMIT, 'each permitted reservation needs exactly one reserve ledger row');
  assert.equal(new Set(reserveLedger.map((row) => row.idempotencyKey)).size, CAP_LIMIT, 'reserve ledger must not duplicate');
  assert.ok(reserveLedger.every((row) => row.primaryDelta === 1 && row.fallbackDelta === 0 && row.reservationId));
  assert.equal(account.primaryUsed, CAP_LIMIT, 'primary usage must equal the individual cap');
  assert.equal(account.fallbackUsed, 0, 'an active individual cap must never allocate fallback');
  assert.equal(account.state, 'BLOCKED', 'the quota account must be terminally blocked at the cap');
  assert.ok(account.primaryUsed >= 0 && account.primaryUsed <= CAP_LIMIT, 'primary usage must stay non-negative and bounded');
  assert.ok(account.fallbackUsed >= 0, 'fallback usage must stay non-negative');
  evidence.checks.primaryFallbackBlockedInvariant = 'PASS';

  const successfulOperations = operations.filter((row) => row.status === 'SUCCEEDED');
  const blockedOperations = operations.filter((row) => row.status === 'BLOCKED');
  // The current Tutor path stops before opening a provider operation.  A future
  // implementation may deliberately retain a BLOCKED operation for audit, but
  // it must still never create a provider *attempt* for a blocked request.
  assert.equal(successfulOperations.length, CAP_LIMIT, 'exactly the permitted requests may complete provider operations');
  assert.equal(operations.length, successfulOperations.length + blockedOperations.length, 'provider operations must be either succeeded or explicitly blocked');
  assert.equal(attempts.length, CAP_LIMIT, 'blocked requests must not create provider attempts');
  assert.ok(legacyUsage <= CAP_LIMIT, 'blocked requests must not create legacy provider envelopes');
  assert.ok(successfulOperations.every((row) => row.quotaState === 'PRIMARY' && requestIds.includes(row.requestId)));
  assert.ok(attempts.every((row) => row.status === 'SUCCEEDED' && row.provider === 'echo'));
  evidence.checks.providerNotInvokedAfterBlocked = 'PASS';
  evidence.counts.persistence = {
    reservations: reservations.length,
    reserveLedger: reserveLedger.length,
    primaryUsed: account.primaryUsed,
    fallbackUsed: account.fallbackUsed,
    providerOperations: operations.length,
    succeededProviderOperations: successfulOperations.length,
    blockedProviderOperations: blockedOperations.length,
    providerAttempts: attempts.length,
    legacyProviderUsage: legacyUsage,
  };
}

async function verifyLearnerAdminDenied() {
  const denied = await apiRequest(`/admin/users/${fixture.learner.id}/staging-quota-cap`, {
    method: 'POST', token: fixture.learnerToken,
    body: {
      resource: 'AI_TEXT', limit: 0, expiresAt: fixture.capExpiry.toISOString(),
      reason: 'Technical learner must not administer caps',
    },
  });
  assert.equal(denied.status, 403, 'a learner must not administer individual caps');
  evidence.checks.learnerAdminAccessDenied = 'PASS';
}

async function revokeAndVerifyEvidence(totpSecret) {
  // Keep cleanup independent of a deliberately short staging step-up TTL.
  await stepUp(fixture.adminToken, totpSecret);
  const capRevoked = await apiRequest(`/admin/users/${fixture.learner.id}/staging-quota-cap/${fixture.capId}/revoke`, {
    method: 'POST', token: fixture.adminToken,
    body: { reason: 'Technical staging quota-cap validation cleanup' },
  });
  assert.equal(capRevoked.status, 200, 'technical cap revocation must succeed');
  assert.equal(capRevoked.body?.revoked, true);
  const cap = await prisma.entitlementOverride.findUnique({ where: { id: fixture.capId }, select: { revokedAt: true } });
  assert.ok(cap?.revokedAt, 'cap must be durably revoked before fixture cleanup');
  evidence.checks.capRevoked = 'PASS';

  // Refresh the proof again so the beta-revocation cleanup is independent of a
  // deliberately short staging step-up TTL.
  await stepUp(fixture.adminToken, totpSecret);
  const betaRevoked = await apiRequest(`/admin/users/${fixture.learner.id}/private-beta-access/${fixture.betaGrantId}/revoke`, {
    method: 'POST', token: fixture.adminToken,
    body: { reason: 'Technical staging quota-cap validation cleanup' },
  });
  assert.equal(betaRevoked.status, 200, 'technical beta grant revocation must succeed');
  assert.equal(betaRevoked.body?.revoked, true);
  const grant = await prisma.entitlementOverride.findUnique({ where: { id: fixture.betaGrantId }, select: { revokedAt: true } });
  assert.ok(grant?.revokedAt, 'beta grant must be durably revoked before fixture cleanup');
  const learnerSession = await apiRequest('/auth/me', { token: fixture.learnerToken });
  assert.equal(learnerSession.status, 401, 'beta revocation must invalidate the technical learner session');
  evidence.checks.betaGrantRevoked = 'PASS';

  const [audits, securityEvents] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        actorId: fixture.admin.id,
        targetId: { in: [fixture.betaGrantId, fixture.capId] },
        action: { in: ['private_beta_access.grant', 'private_beta_access.revoke', 'quota.staging_cap.create', 'quota.staging_cap.revoke'] },
      },
      select: { action: true },
    }),
    prisma.securityEvent.findMany({
      where: {
        userId: fixture.learner.id,
        type: { in: ['PRIVATE_BETA_ACCESS_GRANTED', 'PRIVATE_BETA_ACCESS_REVOKED', 'STAGING_QUOTA_CAP_CREATED', 'STAGING_QUOTA_CAP_REVOKED'] },
      },
      select: { type: true },
    }),
  ]);
  const auditActions = new Set(audits.map((row) => row.action));
  const securityTypes = new Set(securityEvents.map((row) => row.type));
  for (const action of ['private_beta_access.grant', 'private_beta_access.revoke', 'quota.staging_cap.create', 'quota.staging_cap.revoke']) {
    assert.ok(auditActions.has(action), 'every mutable action must be audited');
  }
  for (const type of ['PRIVATE_BETA_ACCESS_GRANTED', 'PRIVATE_BETA_ACCESS_REVOKED', 'STAGING_QUOTA_CAP_CREATED', 'STAGING_QUOTA_CAP_REVOKED']) {
    assert.ok(securityTypes.has(type), 'every mutable action must emit a security event');
  }
  evidence.checks.auditAndSecurityEvidence = 'PASS';
  evidence.counts.audit = { actionTypes: auditActions.size, securityEventTypes: securityTypes.size };
}

async function deleteTechnicalFixtureData() {
  if (!fixture.admin && !fixture.learner) return;
  evidence.cleanup.attempted = true;
  const ids = [fixture.admin?.id, fixture.learner?.id].filter(Boolean);
  const learnerId = fixture.learner?.id;
  if (learnerId) {
    const operations = await prisma.providerUsageOperation.findMany({ where: { userId: learnerId }, select: { id: true } });
    const operationIds = operations.map((row) => row.id);
    if (operationIds.length) {
      await prisma.providerCostAdjustment.deleteMany({ where: { operationId: { in: operationIds } } });
      await prisma.providerUsageAttempt.deleteMany({ where: { operationId: { in: operationIds } } });
      await prisma.providerUsageOperation.deleteMany({ where: { id: { in: operationIds } } });
    }
    await prisma.providerUsage.deleteMany({ where: { userId: learnerId } });
    await prisma.usageLedger.deleteMany({ where: { userId: learnerId } });
    await prisma.quotaReservation.deleteMany({ where: { userId: learnerId } });
    await prisma.quotaCycle.deleteMany({ where: { userId: learnerId } });
  }
  if (ids.length) {
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: [fixture.betaGrantId, fixture.capId].filter(Boolean) } }] } });
    await prisma.securityEvent.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { userId: { in: ids } }] } });
    await prisma.adminRoleAssignment.deleteMany({ where: { userId: { in: ids } } });
    await prisma.entitlementOverride.deleteMany({ where: { userId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  evidence.cleanup.completed = true;
  evidence.checks.fixturesRemoved = 'PASS';
}

async function writeEvidence() {
  if (!evidenceDir || !path.isAbsolute(evidenceDir)) return;
  await fs.mkdir(evidenceDir, { recursive: true, mode: 0o700 });
  const filename = `staging-quota-cap-http-${runId}.json`;
  const destination = path.join(evidenceDir, filename);
  const temporary = `${destination}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temporary, destination);
}

async function main() {
  let failure;
  try {
    ensureExecutionGuards();
    await prisma.$connect();
    await verifyPostgres();

    const password = testPassword();
    const totpSecret = authenticator.generateSecret();
    await createFixtures(password, totpSecret);
    const baselineAllowance = await verifyBaselineAllowance();
    evidence.counts.baselineAiTextAllowance = baselineAllowance.kind;

    fixture.adminToken = await loginAdmin(fixture.admin.email, password, totpSecret);
    await createBetaGrantWithStepUp(totpSecret);
    fixture.learnerToken = await loginLearner(fixture.learner.email, password);
    await createCapWithStepUp(totpSecret, baselineAllowance);
    await verifyLearnerAdminDenied();

    const sessionIds = await createTutorSessions();
    const requestIds = await runConcurrentTutorRequests(sessionIds);
    await verifyQuotaAndProviderEvidence(requestIds);
    await revokeAndVerifyEvidence(totpSecret);
    evidence.status = 'PASS';
  } catch (error) {
    failure = error;
    evidence.status = 'FAIL';
    evidence.failure = { code: safeFailureCode(error) };
  } finally {
    try {
      await deleteTechnicalFixtureData();
    } catch (cleanupError) {
      evidence.cleanup.completed = false;
      evidence.checks.fixturesRemoved = 'FAIL';
      if (!failure) {
        failure = cleanupError;
        evidence.status = 'FAIL';
        evidence.failure = { code: safeFailureCode(cleanupError) };
      }
    }
    try {
      await writeEvidence();
    } catch (evidenceError) {
      if (!failure) {
        failure = evidenceError;
        evidence.status = 'FAIL';
        evidence.failure = { code: safeFailureCode(evidenceError) };
      }
    }
    await prisma.$disconnect().catch(() => undefined);
  }
  if (failure) {
    // Deliberately excludes endpoint, database, account, token, TOTP, and error
    // message details.  The JSON evidence contains only sanitized status/counts.
    console.error(`STAGING_QUOTA_CAP_HTTP_GATE_FAILED:${safeFailureCode(failure)}`);
    process.exitCode = 1;
    return;
  }
  console.log('STAGING_QUOTA_CAP_HTTP_GATE_PASS');
}

void main();
