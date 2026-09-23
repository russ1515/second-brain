const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createHash, randomBytes } = require('node:crypto');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const apiBase = process.env.SPRINT15_API_URL || 'http://127.0.0.1:3100/api';
const password = process.env.SPRINT15_TEST_PASSWORD;
const browserTotpSecret = process.env.SPRINT15_BROWSER_TOTP_SECRET;
const cipherMaterial = process.env.TWO_FACTOR_ENC_KEY;

function encryptSecret(plaintext) {
  const key = createHash('sha256').update(cipherMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `sprint15-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, body: payload };
}

function accessSessionId(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sessionId;
}

async function login(email) {
  return api('/auth/login', { method: 'POST', body: { email, password } });
}

async function stepUp(token, secret) {
  const result = await api('/auth/2fa/step-up', { method: 'POST', token, body: { code: authenticator.generate(secret) } });
  assert.equal(result.status, 200);
}

test.before(async () => {
  assert.ok(password && browserTotpSecret && cipherMaterial, 'Sprint 1.5 test-only secrets must be supplied through the process environment.');
  await prisma.$connect();
});

test.after(async () => prisma.$disconnect());

test('real API account states, MFA, recovery, logout, RBAC and step-up', async () => {
  const hash = await argon2.hash(password);
  const stamp = Date.now();
  const adminEmail = 'sprint15-admin@example.test';
  const normalEmail = `sprint15-normal-${stamp}@example.test`;
  const supportEmail = `sprint15-support-${stamp}@example.test`;
  const browserEmail = 'sprint15-browser-admin@example.test';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail, passwordHash: hash, emailVerified: true, isAdmin: true },
    update: { passwordHash: hash, emailVerified: true, isAdmin: true, accountStatus: 'active', suspendedAt: null, bannedAt: null, twoFactorEnabled: false, twoFactorSecret: null },
  });
  // Production authorization is based on a persistent role assignment.  Do not
  // rely on the deliberately disabled legacy `isAdmin` bootstrap in this test.
  await prisma.adminRoleAssignment.upsert({
    where: { userId_role: { userId: admin.id, role: 'SUPER_ADMIN' } },
    create: { userId: admin.id, role: 'SUPER_ADMIN', reason: 'Sprint 1.5 security fixture' },
    update: { revokedAt: null },
  });
  const normal = await prisma.user.create({ data: { email: normalEmail, passwordHash: hash, emailVerified: true } });
  const support = await prisma.user.create({
    data: { email: supportEmail, passwordHash: hash, emailVerified: true, twoFactorEnabled: true, twoFactorSecret: encryptSecret(browserTotpSecret) },
  });
  await prisma.adminRoleAssignment.create({ data: { userId: support.id, role: 'SUPPORT', reason: 'Sprint 1.5 RBAC fixture' } });
  await prisma.user.upsert({
    where: { email: browserEmail },
    create: { email: browserEmail, passwordHash: hash, emailVerified: true, isAdmin: true, twoFactorEnabled: true, twoFactorSecret: encryptSecret(browserTotpSecret) },
    update: { passwordHash: hash, emailVerified: true, isAdmin: true, accountStatus: 'active', suspendedAt: null, bannedAt: null, twoFactorEnabled: true, twoFactorSecret: encryptSecret(browserTotpSecret) },
  });

  // ACTIVE login and an existing JWT/refresh pair retained for state-transition assertions.
  const activeLogin = await login(normalEmail);
  assert.equal(activeLogin.status, 200);
  assert.ok(activeLogin.body.tokens.accessToken && activeLogin.body.tokens.refreshToken);
  const normalOld = activeLogin.body.tokens;
  assert.equal((await api('/auth/me', { token: normalOld.accessToken })).status, 200);

  // Enroll MFA through the actual API, then require it on every later admin login.
  const initialAdminLogin = await login(adminEmail);
  assert.equal(initialAdminLogin.status, 200);
  assert.equal((await api('/admin/session', { token: initialAdminLogin.body.tokens.accessToken })).status, 403);
  const setup = await api('/auth/2fa/setup', { method: 'POST', token: initialAdminLogin.body.tokens.accessToken, body: {} });
  assert.equal(setup.status, 200);
  const enabled = await api('/auth/2fa/enable', { method: 'POST', token: initialAdminLogin.body.tokens.accessToken, body: { code: authenticator.generate(setup.body.secret) } });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.recoveryCodes.length, 10);

  const challenged = await login(adminEmail);
  assert.equal(challenged.status, 200);
  assert.equal(challenged.body.twoFactorRequired, true);
  const wrongTotp = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: challenged.body.challengeToken, code: '000000' } });
  assert.equal(wrongTotp.status, 401);
  const verified = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: challenged.body.challengeToken, code: authenticator.generate(setup.body.secret) } });
  assert.equal(verified.status, 200);
  const adminTokens = verified.body.tokens;
  const adminSession = await api('/admin/session', { token: adminTokens.accessToken });
  assert.equal(adminSession.status, 200);
  assert.ok(adminSession.body.identity.roles.includes('SUPER_ADMIN'));

  // Recovery code is accepted once and then permanently consumed.
  const recoveryChallenge = await login(adminEmail);
  const recovered = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: recoveryChallenge.body.challengeToken, code: enabled.body.recoveryCodes[0] } });
  assert.equal(recovered.status, 200);
  const reusedRecoveryChallenge = await login(adminEmail);
  const reusedRecovery = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: reusedRecoveryChallenge.body.challengeToken, code: enabled.body.recoveryCodes[0] } });
  assert.equal(reusedRecovery.status, 401);

  // Persisted MFA age expires the admin session; a real step-up refreshes it.
  // The configured default admin-session maximum is eight hours.  Age the
  // persisted proof beyond that boundary; two hours is intentionally valid.
  await prisma.session.update({ where: { id: accessSessionId(adminTokens.accessToken) }, data: { mfaVerifiedAt: new Date(Date.now() - 9 * 60 * 60 * 1000) } });
  const expired = await api('/admin/session', { token: adminTokens.accessToken });
  assert.equal(expired.status, 403);
  assert.equal(expired.body.code || expired.body.message?.code, 'ADMIN_SESSION_EXPIRED');
  await stepUp(adminTokens.accessToken, setup.body.secret);

  // A normal authenticated user is never an admin.
  assert.equal((await api('/admin/session', { token: normalOld.accessToken })).status, 403);

  // Different RBAC identity: SUPPORT can enter the control center but cannot ban.
  const supportChallenge = await login(supportEmail);
  const supportVerified = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: supportChallenge.body.challengeToken, code: authenticator.generate(browserTotpSecret) } });
  assert.equal(supportVerified.status, 200);
  const supportSession = await api('/admin/session', { token: supportVerified.body.tokens.accessToken });
  assert.equal(supportSession.status, 200);
  assert.deepEqual(supportSession.body.identity.roles, ['SUPPORT']);
  assert.equal((await api(`/admin/users/${normal.id}/ban`, { method: 'POST', token: supportVerified.body.tokens.accessToken, body: { reason: 'must be denied' } })).status, 403);

  // SUSPENDED denies login, refresh and an already-issued JWT.
  await stepUp(adminTokens.accessToken, setup.body.secret);
  assert.equal((await api(`/admin/users/${normal.id}/suspend`, { method: 'POST', token: adminTokens.accessToken, body: { reason: 'Sprint 1.5 suspension validation' } })).status, 204);
  assert.ok([401, 403].includes((await login(normalEmail)).status));
  assert.equal((await api('/auth/refresh', { method: 'POST', body: { refreshToken: normalOld.refreshToken } })).status, 401);
  assert.equal((await api('/auth/me', { token: normalOld.accessToken })).status, 401);

  // REACTIVATED allows a new login but cannot revive the revoked old session.
  await stepUp(adminTokens.accessToken, setup.body.secret);
  assert.equal((await api(`/admin/users/${normal.id}/reactivate`, { method: 'POST', token: adminTokens.accessToken, body: { reason: 'Sprint 1.5 reactivation validation' } })).status, 204);
  assert.equal((await api('/auth/me', { token: normalOld.accessToken })).status, 401);
  const reactivatedLogin = await login(normalEmail);
  assert.equal(reactivatedLogin.status, 200);

  // BANNED denies every token path.
  await stepUp(adminTokens.accessToken, setup.body.secret);
  assert.equal((await api(`/admin/users/${normal.id}/ban`, { method: 'POST', token: adminTokens.accessToken, body: { reason: 'Sprint 1.5 ban validation', internalNote: 'local integration fixture', reference: 'S15' } })).status, 204);
  assert.ok([401, 403].includes((await login(normalEmail)).status));
  assert.equal((await api('/auth/refresh', { method: 'POST', body: { refreshToken: reactivatedLogin.body.tokens.refreshToken } })).status, 401);
  assert.equal((await api('/auth/me', { token: reactivatedLogin.body.tokens.accessToken })).status, 401);

  // API logout revokes the backing session, not just the client copy.
  const logoutChallenge = await login(adminEmail);
  const logoutVerified = await api('/auth/2fa/verify', { method: 'POST', body: { challengeToken: logoutChallenge.body.challengeToken, code: authenticator.generate(setup.body.secret) } });
  assert.equal((await api('/auth/logout', { method: 'POST', body: { refreshToken: logoutVerified.body.tokens.refreshToken } })).status, 204);
  assert.equal((await api('/auth/me', { token: logoutVerified.body.tokens.accessToken })).status, 401);

  const securityEvents = await prisma.securityEvent.findMany({ where: { userId: { in: [admin.id, normal.id, support.id] } } });
  const serializedEvents = JSON.stringify(securityEvents);
  assert.ok(securityEvents.length > 0);
  assert.ok(!serializedEvents.includes(password));
  assert.ok(!serializedEvents.includes(setup.body.secret));
  assert.ok(!serializedEvents.includes(adminTokens.accessToken));
  assert.ok(!serializedEvents.includes(adminTokens.refreshToken));
  const audits = await prisma.auditLog.findMany({ where: { targetId: normal.id } });
  const serializedAudits = JSON.stringify(audits);
  assert.ok(audits.length >= 3);
  assert.ok(!serializedAudits.includes(password) && !serializedAudits.includes(setup.body.secret));
});
