const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const { PlanService } = require('../dist/subscription/plan.service.js');

/**
 * Real HTTP contract test for the Sprint 2 Control Center.
 *
 * Required environment (never logged by this file):
 * - DATABASE_URL: dedicated, disposable PostgreSQL test database
 * - SPRINT2_API_URL: running API URL, with or without a trailing `/api`
 * - SPRINT2_TEST_PASSWORD: test-only fixture password
 *
 * The running API must use the same DATABASE_URL. The test creates an isolated
 * prefix of accounts and removes it in `test.after`; it never truncates or
 * otherwise clears a database. Start against a cold dashboard cache (or a
 * freshly started API) because the dashboard intentionally caches aggregates
 * for 30 seconds per capability set and range.
 */
const prisma = new PrismaClient();
const rawApiUrl = process.env.SPRINT2_API_URL;
const password = process.env.SPRINT2_TEST_PASSWORD;
const fixturePrefix = `sprint2-dashboard-${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`;
const fixture = { userIds: [], emails: [], adminToken: null, analystToken: null, baselinePlans: null };
let requestSequence = 0;

function apiBase(url) {
  const normalized = url.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
}

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${apiBase(rawApiUrl)}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `sprint2-dashboard-${process.pid}-${requestSequence++}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, body: payload };
}

function accessSessionId(accessToken) {
  const encoded = accessToken.split('.')[1];
  assert.ok(encoded, 'The API login response must contain an access-token payload.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  assert.equal(typeof payload.sessionId, 'string');
  return payload.sessionId;
}

async function login(email) {
  const result = await api('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200, 'The test fixture must be able to log in through the real API.');
  assert.ok(typeof result.body?.tokens?.accessToken === 'string', 'The API login response must issue an access token.');
  return result.body.tokens.accessToken;
}

async function markSessionMfa(accessToken) {
  await prisma.session.update({
    where: { id: accessSessionId(accessToken) },
    data: { mfaVerifiedAt: new Date() },
  });
}

function planCounts(response) {
  const section = response.body?.sections?.subscriptions;
  assert.equal(section?.status, 'available', 'Subscription aggregates must be available for a SUPER_ADMIN.');
  assert.ok(Array.isArray(section?.data?.items), 'Subscription section must expose fixed plan rows.');
  const counts = Object.create(null);
  for (const item of section.data.items) counts[item.plan] = item.count;
  for (const slug of ['free', 'pro', 'pro_max']) {
    assert.equal(typeof counts[slug], 'number', `Plan row ${slug} must be present.`);
  }
  return counts;
}

async function createUser(label, passwordHash) {
  const user = await prisma.user.create({
    data: {
      email: `${fixturePrefix}-${label}@example.test`,
      passwordHash,
      emailVerified: true,
      lastActiveAt: new Date(),
    },
  });
  fixture.userIds.push(user.id);
  fixture.emails.push(user.email);
  return user;
}

async function createLearners(passwordHash, plansBySlug) {
  const distribution = [
    ...Array.from({ length: 6 }, () => 'free'),
    ...Array.from({ length: 3 }, () => 'pro'),
    'pro_max',
  ];
  const periodStart = new Date(Date.now() - 60_000);
  const periodEnd = new Date(Date.now() + 2_592_000_000);
  const learners = [];

  for (const [index, slug] of distribution.entries()) {
    const learner = await createUser(`learner-${index + 1}`, passwordHash);
    const plan = plansBySlug.get(slug);
    assert.ok(plan, `The ${slug} plan must exist in the test database.`);
    await prisma.subscription.create({
      data: {
        userId: learner.id,
        planId: plan.id,
        planVersion: plan.configurationVersion,
        status: slug === 'free' ? 'free' : 'active',
        ...(slug === 'free' ? {} : { interval: 'month', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd }),
      },
    });
    learners.push(learner);
  }

  // Sentinels make the privacy assertion meaningful: activity includes a
  // payment event but must expose neither its provider reference nor document
  // content from a learner in the same response.
  const privateContent = `private-content-${fixturePrefix}`;
  const privatePaymentRef = `private-payment-ref-${fixturePrefix}`;
  await prisma.document.create({
    data: {
      userId: learners[0].id,
      title: 'Sprint 2 privacy fixture',
      source: 'text',
      content: privateContent,
      charCount: privateContent.length,
      status: 'ready',
    },
  });
  await prisma.payment.create({
    data: {
      userId: learners[6].id,
      provider: 'test',
      providerRef: privatePaymentRef,
      amount: 1999,
      currency: 'usd',
      status: 'succeeded',
      purpose: 'subscription',
    },
  });
  return { privateContent, privatePaymentRef };
}

test.before(async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required for the Sprint 2 test database.');
  assert.ok(rawApiUrl, 'SPRINT2_API_URL is required and must point at the running test API.');
  assert.ok(password, 'SPRINT2_TEST_PASSWORD is required for test-only fixture logins.');
  let databaseName = '';
  try {
    databaseName = new URL(process.env.DATABASE_URL).pathname;
  } catch {
    assert.fail('DATABASE_URL must be a valid PostgreSQL connection URL for the dedicated test database.');
  }
  // A guard against accidentally aiming a test that directly marks MFA sessions
  // at an ambiguously named database. It intentionally inspects only the path,
  // never logs the URL or its credentials.
  assert.ok(/(?:test|staging|sprint)/i.test(databaseName), 'DATABASE_URL must name a dedicated test, staging, or sprint database.');
  await prisma.$connect();

  // The catalog seed only creates missing rows; it does not overwrite a plan's
  // price, quotas, or configuration on this test database.
  await new PlanService(prisma).onModuleInit();
  const plans = await prisma.plan.findMany({
    where: { slug: { in: ['free', 'pro', 'pro_max'] } },
    select: { id: true, slug: true, configurationVersion: true },
  });
  assert.equal(plans.length, 3, 'The dedicated test database must provide free, pro, and pro_max plans.');
  const plansBySlug = new Map(plans.map((plan) => [plan.slug, plan]));
  const passwordHash = await argon2.hash(password);

  const admin = await createUser('super-admin', passwordHash);
  const normal = await createUser('normal-user', passwordHash);
  const analyst = await createUser('analytics-admin', passwordHash);
  await prisma.adminRoleAssignment.create({
    data: { userId: admin.id, role: 'SUPER_ADMIN', reason: 'Sprint 2 dashboard HTTP integration fixture' },
  });
  await prisma.adminRoleAssignment.create({
    data: { userId: analyst.id, role: 'ANALYTICS', reason: 'Sprint 2 dashboard section-isolation fixture' },
  });

  fixture.adminToken = await login(admin.email);
  await markSessionMfa(fixture.adminToken);

  // Use a different range for the baseline so it cannot warm the required
  // `30d` cache key that is asserted after fixture insertion.
  const baseline = await api('/admin/dashboard?range=today', { token: fixture.adminToken });
  assert.equal(baseline.status, 200);
  fixture.baselinePlans = planCounts(baseline);
  fixture.privateValues = await createLearners(passwordHash, plansBySlug);

  fixture.analystToken = await login(analyst.email);
  await markSessionMfa(fixture.analystToken);
  fixture.normalEmail = normal.email;
});

test.after(async () => {
  try {
    if (fixture.userIds.length > 0) {
      // Audit/security logs are scalar references rather than User relations;
      // delete only the rows tied to this unique test fixture before cascaded
      // user deletion removes sessions, subscriptions, documents, and payments.
      await prisma.auditLog.deleteMany({
        where: { OR: [{ actorId: { in: fixture.userIds } }, { targetId: { in: fixture.userIds } }] },
      });
      await prisma.securityEvent.deleteMany({
        where: { OR: [{ actorId: { in: fixture.userIds } }, { userId: { in: fixture.userIds } }] },
      });
      await prisma.user.deleteMany({ where: { id: { in: fixture.userIds } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test('real HTTP dashboard returns exact fixture plan totals and privacy-safe aggregates', async () => {
  const dashboard = await api('/admin/dashboard?range=30d', { token: fixture.adminToken });
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body?.range?.key, '30d');
  assert.equal(dashboard.body?.range?.timezone, 'UTC');
  assert.match(dashboard.body?.generatedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);

  const counts = planCounts(dashboard);
  assert.equal(counts.free, fixture.baselinePlans.free + 6);
  assert.equal(counts.pro, fixture.baselinePlans.pro + 3);
  assert.equal(counts.pro_max, fixture.baselinePlans.pro_max + 1);

  const serialized = JSON.stringify(dashboard.body);
  for (const privateValue of [...fixture.emails, fixture.privateValues.privateContent, fixture.privateValues.privatePaymentRef]) {
    assert.equal(serialized.includes(privateValue), false, 'Dashboard aggregates must not reveal learner identity, content, or payment references.');
  }
  const activity = dashboard.body.sections?.activity;
  assert.equal(activity?.status, 'available');
  for (const item of activity.data?.items ?? []) {
    assert.deepEqual(Object.keys(item).sort(), ['kind', 'occurredAt', 'source']);
  }
});

test('real HTTP dashboard rejects invalid ranges and normal authenticated users', async () => {
  const invalid = await api('/admin/dashboard?range=90d', { token: fixture.adminToken });
  assert.equal(invalid.status, 400);
  assert.equal(JSON.stringify(invalid.body ?? {}).includes('DASHBOARD_RANGE_INVALID'), true);

  const normalToken = await login(fixture.normalEmail);
  const denied = await api('/admin/dashboard?range=30d', { token: normalToken });
  assert.equal(denied.status, 403);
});

test('real HTTP dashboard isolates restricted sections instead of failing the whole response', async () => {
  const response = await api('/admin/dashboard?range=today', { token: fixture.analystToken });
  assert.equal(response.status, 200);
  assert.equal(response.body?.sections?.overview?.status, 'available');
  assert.deepEqual(response.body?.sections?.health, {
    status: 'unavailable', data: null, reason: 'FORBIDDEN_SECTION',
  });
  assert.deepEqual(response.body?.sections?.security, {
    status: 'unavailable', data: null, reason: 'FORBIDDEN_SECTION',
  });
  assert.equal(response.body?.sections?.alerts?.status, 'available');
});
