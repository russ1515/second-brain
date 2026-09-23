const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createHash, randomBytes } = require('node:crypto');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

// This is intentionally an opt-in HTTP contract suite: it exercises a running
// API and real MFA/RBAC, but never starts a server or prints credentials.
const configuredApiBase = process.env.SPRINT4_API_URL ?? process.env.SPRINT4_COST_API_URL;
const apiBase = configuredApiBase?.replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL ?? '';
const password = process.env.SPRINT4_TEST_PASSWORD;
const totpSecret = process.env.SPRINT4_TEST_TOTP_SECRET;
const cipherMaterial = process.env.TWO_FACTOR_ENC_KEY;
const confirmation = process.env.SPRINT4_HTTP_TEST_CONFIRM === 'I_UNDERSTAND_TEST_ONLY';
const enabled = Boolean(confirmation && apiBase && password && totpSecret && cipherMaterial && /(?:test|staging|sprint)/i.test(databaseUrl)
  && !/(?:^|[._/-])(prod|production)(?:[._/?-]|$)/i.test(databaseUrl));
const stepUpTtlSeconds = Number(process.env.ADMIN_STEP_UP_TTL ?? 600);
const sessionMaxTtlSeconds = Number(process.env.ADMIN_SESSION_MAX_TTL ?? 28_800);
const prisma = enabled ? new PrismaClient() : null;
const runId = `sprint4-http-${process.pid}-${Date.now()}`;
let finance;
let learner;

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
      'x-request-id': `${runId}-${Math.random().toString(16).slice(2)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, body: payload, headers: response.headers };
}

async function loginAndVerify(email) {
  const login = await api('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200);
  assert.equal(login.body.twoFactorRequired, true);
  const verified = await api('/auth/2fa/verify', {
    method: 'POST',
    body: { challengeToken: login.body.challengeToken, code: authenticator.generate(totpSecret) },
  });
  assert.equal(verified.status, 200);
  return verified.body.tokens.accessToken;
}

function accessSessionId(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sessionId;
}

test.before(async () => {
  if (!enabled) return;
  await prisma.$connect();
  const hash = await argon2.hash(password);
  learner = await prisma.user.create({
    data: { email: `${runId}-learner@example.test`, passwordHash: hash, emailVerified: true },
  });
  finance = await prisma.user.create({
    data: {
      email: `${runId}-finance@example.test`,
      passwordHash: hash,
      emailVerified: true,
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(totpSecret),
    },
  });
  await prisma.adminRoleAssignment.create({
    data: { userId: finance.id, role: 'FINANCE', reason: 'Sprint 4 HTTP RBAC fixture' },
  });
});

test.after(async () => {
  if (!enabled) return;
  try {
    if (finance) {
      await prisma.providerPricingVersion.deleteMany({ where: { provider: `${runId}-provider` } });
      await prisma.adminRoleAssignment.deleteMany({ where: { userId: finance.id } });
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: runId } } });
  } finally {
    await prisma.$disconnect();
  }
});

test('Cost Center HTTP contract enforces authentication, RBAC, MFA and step-up', {
  skip: !enabled && 'set SPRINT4_HTTP_TEST_CONFIRM=I_UNDERSTAND_TEST_ONLY plus API URL, dedicated DATABASE_URL and test-only MFA credentials',
}, async () => {
  assert.equal((await api('/admin/costs/overview?range=7d')).status, 401);

  const learnerLogin = await api('/auth/login', { method: 'POST', body: { email: learner.email, password } });
  assert.equal(learnerLogin.status, 200);
  assert.equal((await api('/admin/costs/overview?range=7d', { token: learnerLogin.body.tokens.accessToken })).status, 403);

  const financeToken = await loginAndVerify(finance.email);
  const overview = await api('/admin/costs/overview?range=7d', { token: financeToken });
  assert.equal(overview.status, 200);
  assert.equal(overview.headers.get('cache-control'), 'no-store');
  assert.ok(overview.body.data && Object.hasOwn(overview.body.data, 'cost'));
  assert.equal((await api('/admin/costs/pricing?range=7d', { token: financeToken })).status, 200);
  const invalidRange = await api('/admin/costs/overview?range=invalid', { token: financeToken });
  assert.equal(invalidRange.status, 400);
  assert.equal(invalidRange.body.code || invalidRange.body.message?.code, 'COST_RANGE_INVALID');

  // Finance has pricing-manage but an aged MFA proof must still be rejected by
  // the critical-action step-up guard before it can mutate the catalog.
  assert.ok(sessionMaxTtlSeconds > stepUpTtlSeconds + 2,
    'ADMIN_SESSION_MAX_TTL must exceed ADMIN_STEP_UP_TTL for this step-up fixture.');
  await prisma.session.update({
    where: { id: accessSessionId(financeToken) },
    data: { mfaVerifiedAt: new Date(Date.now() - (stepUpTtlSeconds + 2) * 1000) },
  });
  const pricingBody = {
    provider: `${runId}-provider`, model: 'http-model', version: 'v1', currency: 'USD',
    effectiveFrom: new Date(Date.now() + 60_000).toISOString(),
    inputTokenPrice: '0.000001', sourceReference: 'https://pricing.example.test/catalog', reason: 'Sprint 4 HTTP pricing fixture',
  };
  const denied = await api('/admin/costs/pricing', { method: 'POST', token: financeToken, body: pricingBody });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code || denied.body.message?.code, 'ADMIN_STEP_UP_REQUIRED');

  const steppedUp = await api('/auth/2fa/step-up', {
    method: 'POST', token: financeToken, body: { code: authenticator.generate(totpSecret) },
  });
  assert.equal(steppedUp.status, 200);
  const created = await api('/admin/costs/pricing', { method: 'POST', token: financeToken, body: pricingBody });
  assert.equal(created.status, 201);
  assert.equal(created.body.provider, pricingBody.provider);
  assert.equal(created.body.version, 'v1');
  assert.equal(await prisma.auditLog.count({ where: { action: 'PROVIDER_PRICING_VERSION_CREATED', targetId: created.body.id } }), 1);

  const v2Body = {
    ...pricingBody,
    version: 'v2', effectiveFrom: new Date(Date.now() + 120_000).toISOString(),
    reason: 'Sprint 4 HTTP pricing supersession fixture',
  };
  const v2 = await api('/admin/costs/pricing', { method: 'POST', token: financeToken, body: v2Body });
  assert.equal(v2.status, 201);
  assert.equal(v2.body.version, 'v2');
  const [v1Row, v2Row] = await Promise.all([
    prisma.providerPricingVersion.findUniqueOrThrow({ where: { id: created.body.id } }),
    prisma.providerPricingVersion.findUniqueOrThrow({ where: { id: v2.body.id } }),
  ]);
  assert.equal(v1Row.effectiveTo.toISOString(), v2Row.effectiveFrom.toISOString());
  assert.equal(await prisma.auditLog.count({ where: { action: 'PROVIDER_PRICING_VERSION_SUPERSEDED', targetId: created.body.id } }), 1);
});
