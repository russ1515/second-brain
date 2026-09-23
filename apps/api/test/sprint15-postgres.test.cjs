const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

const { PlanService } = require('../dist/subscription/plan.service.js');
const { SubscriptionService } = require('../dist/subscription/subscription.service.js');
const { QuotaService } = require('../dist/usage/quota.service.js');

const prisma = new PrismaClient();
const plans = new PlanService(prisma);
const subscriptions = new SubscriptionService(prisma, plans);
const quotas = new QuotaService(prisma, subscriptions);
const runId = `${process.pid}-${Date.now()}`;

function concurrencyOutcomeSummary(attempts) {
  return attempts.map((item) => {
    if (item.status === 'fulfilled') return 'fulfilled';
    const response = item.reason?.response;
    const code = response?.code ?? item.reason?.code ?? item.reason?.constructor?.name ?? 'unknown';
    return `rejected:${code}`;
  }).join(', ');
}

async function createPaidUser(slug, suffix) {
  const user = await prisma.user.create({
    data: {
      email: `sprint15-${runId}-${suffix}@example.test`,
      passwordHash: 'integration-only-not-a-credential',
      emailVerified: true,
    },
  });
  const plan = await prisma.plan.findUniqueOrThrow({ where: { slug } });
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      planId: plan.id,
      planVersion: plan.configurationVersion,
      status: 'active',
      provider: 'stripe',
      providerSubscriptionId: `sub-${runId}-${suffix}`,
      currentPeriodStart: startsAt,
      currentPeriodEnd: endsAt,
    },
  });
  return { user, plan, subscription, startsAt, endsAt };
}

async function accountFor(userId) {
  return prisma.quotaAccount.findFirstOrThrow({
    where: { cycle: { userId }, resource: 'AI_TEXT' },
    orderBy: { updatedAt: 'desc' },
  });
}

test.before(async () => {
  await prisma.$connect();
  await plans.onModuleInit();
});

test.after(async () => {
  await prisma.$disconnect();
});

test('PRO fallback is 50% of the corresponding FREE quota', async () => {
  const { user } = await createPaidUser('pro', 'fallback-pro');
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 10_000, idempotencyKey: 'primary-all' });
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 500, idempotencyKey: 'fallback-all' });
  const account = await accountFor(user.id);
  assert.equal(account.primaryLimit, 10_000);
  assert.equal(account.fallbackLimit, 500);
  await assert.rejects(
    () => quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: 'blocked' }),
    (error) => error?.response?.code === 'QUOTA_EXHAUSTED',
  );
  assert.equal((await accountFor(user.id)).state, 'BLOCKED');
});

test('PRO MAX fallback is 50% of the corresponding FREE quota', async () => {
  const { user } = await createPaidUser('pro_max', 'fallback-promax');
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 50_000, idempotencyKey: 'primary-all' });
  const account = await accountFor(user.id);
  assert.equal(account.primaryLimit, 50_000);
  assert.equal(account.fallbackLimit, 500);
});

test('real PostgreSQL concurrency allows exactly one of ten on the last PRIMARY unit', async () => {
  const { user } = await createPaidUser('pro', 'concurrency-primary');
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 9_999, idempotencyKey: 'prime' });
  const account = await accountFor(user.id);
  await prisma.quotaAccount.update({ where: { id: account.id }, data: { fallbackLimit: 0 } });
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => quotas.reserve({
    userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: `primary-race-${index}`,
  })));
  const outcomes = concurrencyOutcomeSummary(attempts);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1, outcomes);
  assert.equal(attempts.filter((item) => item.status === 'rejected' && item.reason?.response?.code === 'QUOTA_EXHAUSTED').length, 9, outcomes);
  const final = await accountFor(user.id);
  assert.equal(final.primaryUsed, final.primaryLimit);
  assert.ok(final.primaryUsed >= 0 && final.fallbackUsed >= 0);
  assert.equal(await prisma.quotaReservation.count({ where: { userId: user.id } }), 2);
  assert.equal(await prisma.usageLedger.count({ where: { userId: user.id, event: 'RESERVE' } }), 2);
});

test('real PostgreSQL concurrency allows exactly one of ten on the last FALLBACK unit', async () => {
  const { user } = await createPaidUser('pro', 'concurrency-fallback');
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 10_000, idempotencyKey: 'primary-all' });
  const account = await accountFor(user.id);
  await prisma.quotaAccount.update({ where: { id: account.id }, data: { fallbackLimit: 500, fallbackUsed: 499, state: 'FALLBACK' } });
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => quotas.reserve({
    userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: `fallback-race-${index}`,
  })));
  const outcomes = concurrencyOutcomeSummary(attempts);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1, outcomes);
  assert.equal(attempts.filter((item) => item.status === 'rejected' && item.reason?.response?.code === 'QUOTA_EXHAUSTED').length, 9, outcomes);
  const final = await accountFor(user.id);
  assert.equal(final.fallbackUsed, final.fallbackLimit);
  assert.ok(final.primaryUsed <= final.primaryLimit && final.fallbackUsed <= final.fallbackLimit);
  assert.equal(await prisma.quotaReservation.count({ where: { userId: user.id } }), 2);
  assert.equal(await prisma.usageLedger.count({ where: { userId: user.id, event: 'RESERVE' } }), 2);
});

test('concurrent duplicate idempotency key creates one reservation and one reserve ledger', async () => {
  const { user } = await createPaidUser('pro', 'concurrency-idempotency');
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, () => quotas.reserve({
    userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: 'same-operation',
  })));
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 10);
  assert.equal(await prisma.quotaReservation.count({ where: { userId: user.id, idempotencyKey: 'same-operation' } }), 1);
  assert.equal(await prisma.usageLedger.count({ where: { userId: user.id, idempotencyKey: `${user.id}:same-operation:reserve` } }), 1);
  assert.equal((await accountFor(user.id)).primaryUsed, 1);
});

test('downgrade does not allocate a fresh FREE cycle in the same reference period', async () => {
  const { user } = await createPaidUser('pro', 'anti-double-free');
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 10_000, idempotencyKey: 'primary-all' });
  const account = await accountFor(user.id);
  await prisma.quotaAccount.update({ where: { id: account.id }, data: { fallbackLimit: 500 } });
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 100, idempotencyKey: 'fallback-part' });
  const free = await prisma.plan.findUniqueOrThrow({ where: { slug: 'free' } });
  await prisma.subscription.update({ where: { userId: user.id }, data: { planId: free.id, planVersion: free.configurationVersion, status: 'free', provider: null } });
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: 'after-downgrade' });
  assert.equal(await prisma.quotaCycle.count({ where: { userId: user.id } }), 1);
  const after = await accountFor(user.id);
  assert.equal(after.primaryLimit, 10_000);
  assert.equal(after.primaryUsed, 10_000);
  assert.equal(after.fallbackUsed, 101);
});

test('PRO MAX to PRO keeps the current reference cycle and consumption', async () => {
  const { user } = await createPaidUser('pro_max', 'anti-double-pro');
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 50_000, idempotencyKey: 'primary-all' });
  const before = await accountFor(user.id);
  const pro = await prisma.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
  await prisma.subscription.update({ where: { userId: user.id }, data: { planId: pro.id, planVersion: pro.configurationVersion } });
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: 'after-downgrade' });
  const after = await accountFor(user.id);
  assert.equal(await prisma.quotaCycle.count({ where: { userId: user.id } }), 1);
  assert.equal(after.id, before.id);
  assert.equal(after.primaryLimit, 50_000);
  assert.equal(after.primaryUsed, 50_000);
  assert.equal(after.fallbackUsed, 1);
});
