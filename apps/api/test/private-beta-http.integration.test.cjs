'use strict';

/*
 * Private-beta HTTP integration gate.
 *
 * This test is intentionally opt-in. It only targets a loopback API paired
 * with a fresh database whose name proves it is an isolated gate database.
 * Run it inside the temporary API validation container, never against a
 * production database or a public endpoint:
 *
 *   PRIVATE_BETA_HTTP_TEST_CONFIRM=I_UNDERSTAND_PRIVATE_BETA_HTTP_TEST_ONLY
 *   PRIVATE_BETA_HTTP_ISOLATED_DB_CONFIRM=I_UNDERSTAND_PRIVATE_BETA_HTTP_ISOLATED_DATABASE_ONLY
 *   PRIVATE_BETA_ENFORCED=true
 *   PRIVATE_BETA_HTTP_FIXTURE_NAMESPACE=private-beta-http-gate-<run-id>
 *   PRIVATE_BETA_REGISTRATION_EMAILS=<the generated technical allowlist address>
 *   PRIVATE_BETA_HTTP_API_URL=http://127.0.0.1:<port>/api
 *   PRIVATE_BETA_HTTP_EVIDENCE_PATH=/evidence/private-beta-http.json
 *   DATABASE_URL=<private_beta_http_gate_<run-id> PostgreSQL URL>
 *   NODE_ENV=test MAIL_TRANSPORT=log LLM_PROVIDER=echo EMBEDDINGS_PROVIDER=fake
 *   pnpm --filter @second-brain/api test:private-beta:http
 *
 * It creates only `@example.test` technical fixtures and removes them in a
 * finally block. JSON evidence contains statuses and booleans only: never
 * credentials, e-mail addresses, tokens, IDs, URLs, or database details.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createHash, randomBytes, randomUUID } = require('node:crypto');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const CONFIRMATION = 'I_UNDERSTAND_PRIVATE_BETA_HTTP_TEST_ONLY';
const ISOLATED_CONFIRMATION = 'I_UNDERSTAND_PRIVATE_BETA_HTTP_ISOLATED_DATABASE_ONLY';
const confirmation = process.env.PRIVATE_BETA_HTTP_TEST_CONFIRM;
const isolatedConfirmation = process.env.PRIVATE_BETA_HTTP_ISOLATED_DB_CONFIRM;
const configuredApiBase = process.env.PRIVATE_BETA_HTTP_API_URL;
const databaseUrl = process.env.DATABASE_URL ?? '';
const evidenceRawPath = process.env.PRIVATE_BETA_HTTP_EVIDENCE_PATH;
const explicitRunRequested = confirmation === CONFIRMATION;
const fixtureNamespace = (process.env.PRIVATE_BETA_HTTP_FIXTURE_NAMESPACE ?? '').trim().toLowerCase();
const fixturePassword = `Pb-${randomBytes(24).toString('base64url')}-Aa1!`;
const allowlistedRegistrationEmail = `${fixtureNamespace}-registration@example.test`;
const unlistedRegistrationEmail = `${fixtureNamespace}-unlisted@example.test`;
// RFC 6238 test material, used only for disposable test fixtures. It is not a
// user or staging-administrator MFA secret.
const fixtureTotpSecret = authenticator.generateSecret();
const checks = Object.create(null);
let phase = 'configuration';
let configurationGuardsPassed = false;

function isDedicatedDatabase(raw) {
  try {
    const parsed = new URL(raw);
    if (!/^postgres(?:ql)?:$/u.test(parsed.protocol)) return false;
    const databaseName = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    return parsed.hostname === 'postgres'
      && (parsed.port === '' || parsed.port === '5432')
      && /^private_beta_http_gate_[a-z0-9_]{8,64}$/u.test(databaseName);
  } catch {
    return false;
  }
}

function isLoopbackApi(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:'
      && parsed.hostname === '127.0.0.1'
      && /^\d+$/u.test(parsed.port)
      && (parsed.pathname === '/' || parsed.pathname === '/api' || parsed.pathname === '/api/');
  } catch {
    return false;
  }
}

function normalizedApiBase(raw) {
  const parsed = new URL(raw);
  return parsed.pathname.replace(/\/+$/, '') === '/api'
    ? `${parsed.origin}/api`
    : `${parsed.origin}/api`;
}

function resolveEvidencePath(raw) {
  assert.equal(typeof raw, 'string', 'A private-beta evidence path is required.');
  assert.ok(raw.trim().length > 0, 'A private-beta evidence path is required.');
  return path.resolve(raw);
}

function assertSafeConfiguration() {
  assert.equal(process.env.PRIVATE_BETA_ENFORCED, 'true', 'Private-beta enforcement must be explicitly enabled.');
  assert.equal(process.env.NODE_ENV, 'test', 'The private-beta HTTP gate only permits NODE_ENV=test.');
  assert.equal(isolatedConfirmation, ISOLATED_CONFIRMATION, 'An explicit isolated-gate confirmation is required.');
  assert.match(fixtureNamespace, /^private-beta-http-gate-[a-z0-9-]{8,48}$/u, 'A safe technical test namespace is required.');
  assert.ok(isDedicatedDatabase(databaseUrl), 'A fresh private_beta_http_gate_<run-id> PostgreSQL database is required.');
  assert.ok(isLoopbackApi(configuredApiBase), 'A loopback API URL ending at /api is required.');
  assert.ok(process.env.TWO_FACTOR_ENC_KEY || process.env.JWT_ACCESS_SECRET, 'Fixture encryption material is required.');
  assert.equal(process.env.MAIL_TRANSPORT, 'log', 'The isolated gate must never send real email.');
  assert.equal(process.env.LLM_PROVIDER, 'echo', 'The isolated gate must retain the non-billable echo provider.');
  assert.equal(process.env.EMBEDDINGS_PROVIDER, 'fake', 'The isolated gate must retain fake embeddings.');
  const registrationEmails = (process.env.PRIVATE_BETA_REGISTRATION_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  assert.ok(registrationEmails.includes(allowlistedRegistrationEmail), 'The technical allowlisted registration address is required.');
  resolveEvidencePath(evidenceRawPath);
}

function encryptFixtureTotp(plaintext) {
  const material = process.env.TWO_FACTOR_ENC_KEY ?? process.env.JWT_ACCESS_SECRET;
  const key = createHash('sha256').update(material).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

function safeStatus(response, expected, check) {
  assert.equal(response.status, expected, check);
  checks[check] = 'PASS';
}

function genericDenial(response, check) {
  safeStatus(response, 401, check);
  assert.equal(JSON.stringify(response.body ?? {}).includes('PRIVATE_BETA'), false, check);
}

function accessSessionId(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.sessionId === 'string' && payload.sessionId.length > 0 ? payload.sessionId : null;
  } catch {
    return null;
  }
}

async function request(apiBase, route, { method = 'GET', body, accessToken } = {}) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      'x-request-id': `private-beta-http-${randomUUID()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, body: payload };
}

async function createFixtures(prisma) {
  const passwordHash = await argon2.hash(fixturePassword);
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  const [superAdmin, learner] = await prisma.$transaction(async (tx) => {
    const admin = await tx.user.create({
      data: {
        email: `${fixtureNamespace}-admin@example.test`,
        passwordHash,
        emailVerified: true,
        accountStatus: 'active',
        twoFactorEnabled: true,
        twoFactorSecret: encryptFixtureTotp(fixtureTotpSecret),
      },
      select: { id: true },
    });
    const pendingLearner = await tx.user.create({
      data: {
        email: `${fixtureNamespace}-learner@example.test`,
        passwordHash,
        emailVerified: true,
        accountStatus: 'active',
      },
      select: { id: true },
    });
    await tx.adminRoleAssignment.create({
      data: { userId: admin.id, role: 'SUPER_ADMIN', reason: 'Private beta HTTP technical fixture' },
    });
    await tx.entitlementOverride.create({
      data: {
        userId: admin.id,
        kind: 'feature',
        key: 'private_beta_access',
        value: true,
        reason: 'Private beta HTTP technical fixture operator access',
        grantedById: admin.id,
        startsAt: new Date(),
        endsAt: expiresAt,
      },
    });
    return [admin, pendingLearner];
  });
  return { superAdmin, learner };
}

async function cleanupFixtures(prisma, fixtureIds) {
  const additional = await prisma.user.findMany({
    where: { email: { startsWith: `${fixtureNamespace}-` } },
    select: { id: true },
  });
  const ids = [...fixtureIds, ...additional.map((row) => row.id)].filter(Boolean);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.securityEvent.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { userId: { in: ids } }] } });
    await tx.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } });
    await tx.entitlementOverride.deleteMany({ where: { userId: { in: ids } } });
    await tx.adminRoleAssignment.deleteMany({ where: { userId: { in: ids } } });
    await tx.user.deleteMany({ where: { id: { in: ids } } });
  });
}

async function writeEvidence(outcome) {
  if (!evidenceRawPath) return;
  const evidencePath = resolveEvidencePath(evidenceRawPath);
  const evidence = {
    schemaVersion: 1,
    gate: 'PRIVATE_BETA_HTTP',
    outcome,
    testOnly: true,
    target: configurationGuardsPassed ? 'loopback-api-with-dedicated-non-production-postgresql' : 'not-validated',
    privateBetaEnforced: process.env.PRIVATE_BETA_ENFORCED === 'true',
    configurationGuardsPassed,
    checks,
    failedPhase: outcome === 'PASS' ? null : phase,
    generatedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
}

test('private beta HTTP gate is opt-in and validates grant/revocation at the real API boundary', {
  skip: !explicitRunRequested && 'set PRIVATE_BETA_HTTP_TEST_CONFIRM to run the dedicated private-beta HTTP gate',
}, async () => {
  let prisma;
  let fixtureIds = [];
  let outcome = 'FAIL';
  let cleanupFailed = false;

  try {
    assertSafeConfiguration();
    configurationGuardsPassed = true;
    const apiBase = normalizedApiBase(configuredApiBase);
    prisma = new PrismaClient();
    await prisma.$connect();

    phase = 'unlisted-registration';
    const registrationSideEffectsBefore = await Promise.all([
      prisma.user.count({ where: { email: unlistedRegistrationEmail } }),
      prisma.session.count(),
      prisma.emailOtp.count(),
    ]);
    const deniedRegistration = await request(apiBase, '/auth/register', {
      method: 'POST',
      body: { email: unlistedRegistrationEmail, password: fixturePassword, displayName: 'Technical beta test' },
    });
    safeStatus(deniedRegistration, 403, 'unlistedRegistrationDenied');
    const registrationSideEffectsAfter = await Promise.all([
      prisma.user.count({ where: { email: unlistedRegistrationEmail } }),
      prisma.session.count(),
      prisma.emailOtp.count(),
    ]);
    assert.deepEqual(registrationSideEffectsAfter, registrationSideEffectsBefore, 'unlistedRegistrationHasNoPersistedSideEffect');
    checks.unlistedRegistrationHasNoUserSideEffect = 'PASS';

    phase = 'allowlisted-registration';
    const allowedRegistration = await request(apiBase, '/auth/register', {
      method: 'POST',
      body: { email: allowlistedRegistrationEmail, password: fixturePassword, displayName: 'Technical beta test' },
    });
    safeStatus(allowedRegistration, 201, 'allowlistedRegistrationAccepted');
    const pendingAccessToken = allowedRegistration.body?.tokens?.accessToken;
    assert.equal(typeof pendingAccessToken, 'string', 'allowlistedRegistrationAccessTokenRequired');
    const pendingProtectedApi = await request(apiBase, '/auth/me', { accessToken: pendingAccessToken });
    safeStatus(pendingProtectedApi, 401, 'unverifiedRegistrationProtectedApiDenied');

    phase = 'fixtures';
    const fixtures = await createFixtures(prisma);
    fixtureIds = [fixtures.superAdmin.id, fixtures.learner.id];

    phase = 'verified-login-without-grant';
    const deniedLogin = await request(apiBase, '/auth/login', {
      method: 'POST',
      body: { email: `${fixtureNamespace}-learner@example.test`, password: fixturePassword },
    });
    genericDenial(deniedLogin, 'verifiedLoginDeniedWithoutGrant');

    phase = 'super-admin-mfa-login';
    const adminLogin = await request(apiBase, '/auth/login', {
      method: 'POST',
      body: { email: `${fixtureNamespace}-admin@example.test`, password: fixturePassword },
    });
    safeStatus(adminLogin, 200, 'superAdminPasswordAccepted');
    assert.equal(adminLogin.body?.twoFactorRequired, true, 'superAdminMfaChallengeRequired');
    checks.superAdminMfaChallengeRequired = 'PASS';
    const adminMfa = await request(apiBase, '/auth/2fa/verify', {
      method: 'POST',
      body: { challengeToken: adminLogin.body?.challengeToken, code: authenticator.generate(fixtureTotpSecret) },
    });
    safeStatus(adminMfa, 200, 'superAdminMfaAccepted');
    const adminAccessToken = adminMfa.body?.tokens?.accessToken;
    const adminSessionId = typeof adminAccessToken === 'string' ? accessSessionId(adminAccessToken) : null;
    assert.ok(adminSessionId, 'superAdminSessionRequired');
    checks.superAdminSessionRequired = 'PASS';

    // A new MFA login is itself fresh. Deliberately age only the disposable
    // fixture session to prove the grant endpoint refuses a stale proof and
    // accepts an explicit step-up afterwards.
    await prisma.session.update({
      where: { id: adminSessionId },
      data: { mfaVerifiedAt: new Date(Date.now() - 61 * 60_000) },
    });
    phase = 'grant-step-up-required';
    const grantBody = {
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      reason: 'Private beta HTTP validation grant after reviewed technical MFA proof',
    };
    const staleGrant = await request(apiBase, `/admin/users/${fixtures.learner.id}/private-beta-access`, {
      method: 'POST', body: grantBody, accessToken: adminAccessToken,
    });
    safeStatus(staleGrant, 403, 'grantDeniedWithoutFreshStepUp');

    phase = 'super-admin-step-up';
    const stepUp = await request(apiBase, '/auth/2fa/step-up', {
      method: 'POST', body: { code: authenticator.generate(fixtureTotpSecret) }, accessToken: adminAccessToken,
    });
    safeStatus(stepUp, 200, 'superAdminStepUpAccepted');

    phase = 'grant';
    const grant = await request(apiBase, `/admin/users/${fixtures.learner.id}/private-beta-access`, {
      method: 'POST', body: grantBody, accessToken: adminAccessToken,
    });
    safeStatus(grant, 201, 'privateBetaGrantCreated');
    const grantId = grant.body?.id;
    assert.equal(typeof grantId, 'string', 'privateBetaGrantIdentifierRequired');
    checks.privateBetaGrantIdentifierRequired = 'PASS';
    const [grantAudit, grantSecurity] = await Promise.all([
      prisma.auditLog.findFirst({
        where: { actorId: fixtures.superAdmin.id, targetId: grantId, action: 'private_beta_access.grant' },
        select: { id: true },
      }),
      prisma.securityEvent.findFirst({
        where: { actorId: fixtures.superAdmin.id, userId: fixtures.learner.id, type: 'PRIVATE_BETA_ACCESS_GRANTED' },
        select: { id: true },
      }),
    ]);
    assert.ok(grantAudit, 'privateBetaGrantAuditRequired');
    assert.ok(grantSecurity, 'privateBetaGrantSecurityEventRequired');
    checks.privateBetaGrantAuditRequired = 'PASS';
    checks.privateBetaGrantSecurityEventRequired = 'PASS';

    phase = 'allowed-login';
    const allowedLogin = await request(apiBase, '/auth/login', {
      method: 'POST',
      body: { email: `${fixtureNamespace}-learner@example.test`, password: fixturePassword },
    });
    safeStatus(allowedLogin, 200, 'grantedLearnerLoginAllowed');
    const learnerAccessToken = allowedLogin.body?.tokens?.accessToken;
    const learnerRefreshToken = allowedLogin.body?.tokens?.refreshToken;
    assert.equal(typeof learnerAccessToken, 'string', 'grantedLearnerAccessTokenRequired');
    assert.equal(typeof learnerRefreshToken, 'string', 'grantedLearnerRefreshTokenRequired');
    checks.grantedLearnerTokensIssued = 'PASS';

    phase = 'protected-api';
    const protectedApi = await request(apiBase, '/auth/me', { accessToken: learnerAccessToken });
    safeStatus(protectedApi, 200, 'grantedLearnerProtectedApiAllowed');

    phase = 'refresh';
    const refreshed = await request(apiBase, '/auth/refresh', {
      method: 'POST', body: { refreshToken: learnerRefreshToken },
    });
    safeStatus(refreshed, 200, 'grantedLearnerRefreshAllowed');
    const refreshedAccessToken = refreshed.body?.accessToken;
    const refreshedRefreshToken = refreshed.body?.refreshToken;
    assert.equal(typeof refreshedAccessToken, 'string', 'refreshedAccessTokenRequired');
    assert.equal(typeof refreshedRefreshToken, 'string', 'refreshedRefreshTokenRequired');
    checks.grantedLearnerRefreshTokensIssued = 'PASS';

    phase = 'revoke';
    const revoke = await request(apiBase, `/admin/users/${fixtures.learner.id}/private-beta-access/${grantId}/revoke`, {
      method: 'POST',
      body: { reason: 'Private beta HTTP validation revocation after evidence capture' },
      accessToken: adminAccessToken,
    });
    safeStatus(revoke, 200, 'privateBetaGrantRevoked');
    const [revokeAudit, revokeSecurity] = await Promise.all([
      prisma.auditLog.findFirst({
        where: { actorId: fixtures.superAdmin.id, targetId: grantId, action: 'private_beta_access.revoke' },
        select: { id: true },
      }),
      prisma.securityEvent.findFirst({
        where: { actorId: fixtures.superAdmin.id, userId: fixtures.learner.id, type: 'PRIVATE_BETA_ACCESS_REVOKED' },
        select: { id: true },
      }),
    ]);
    assert.ok(revokeAudit, 'privateBetaRevokeAuditRequired');
    assert.ok(revokeSecurity, 'privateBetaRevokeSecurityEventRequired');
    checks.privateBetaRevokeAuditRequired = 'PASS';
    checks.privateBetaRevokeSecurityEventRequired = 'PASS';

    phase = 'revoked-access';
    const deniedExistingJwt = await request(apiBase, '/auth/me', { accessToken: refreshedAccessToken });
    safeStatus(deniedExistingJwt, 401, 'revokedExistingJwtDenied');
    const deniedRefresh = await request(apiBase, '/auth/refresh', {
      method: 'POST', body: { refreshToken: refreshedRefreshToken },
    });
    safeStatus(deniedRefresh, 401, 'revokedRefreshDenied');
    const deniedAfterRevoke = await request(apiBase, '/auth/login', {
      method: 'POST',
      body: { email: `${fixtureNamespace}-learner@example.test`, password: fixturePassword },
    });
    genericDenial(deniedAfterRevoke, 'revokedLoginRemainsGeneric');

    outcome = 'PASS';
    phase = 'complete';
  } catch {
    outcome = 'FAIL';
    throw new Error(`PRIVATE_BETA_HTTP_GATE_FAILED:${phase}`);
  } finally {
    if (prisma) {
      try {
        await cleanupFixtures(prisma, fixtureIds);
      } catch {
        cleanupFailed = true;
        outcome = 'FAIL';
        phase = 'cleanup';
      }
      await prisma.$disconnect().catch(() => undefined);
    }
    try {
      await writeEvidence(outcome);
    } catch {
      outcome = 'FAIL';
      phase = 'evidence';
    }
    if (cleanupFailed) throw new Error('PRIVATE_BETA_HTTP_GATE_FAILED:cleanup');
    if (outcome !== 'PASS') throw new Error(`PRIVATE_BETA_HTTP_GATE_FAILED:${phase}`);
  }
});
