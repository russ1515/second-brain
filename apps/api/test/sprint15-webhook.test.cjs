const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { PlanService } = require('../dist/subscription/plan.service.js');
const { SubscriptionService } = require('../dist/subscription/subscription.service.js');
const { QuotaService } = require('../dist/usage/quota.service.js');

const prisma = new PrismaClient();
const plans = new PlanService(prisma);
const subscriptions = new SubscriptionService(prisma, plans);
const quotas = new QuotaService(prisma, subscriptions);
const apiBase = process.env.SPRINT15_API_URL || 'http://127.0.0.1:3100/api';
const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
const stamp = `${process.pid}-${Date.now()}`;

async function createUser(label, id) {
  return prisma.user.create({
    data: { ...(id ? { id } : {}), email: `s15-webhook-${stamp}-${label}@example.test`, passwordHash: 'not-used', emailVerified: true },
  });
}

function stripeBody(id, type, userId, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return JSON.stringify({
    id,
    type,
    created: overrides.created ?? now,
    data: {
      object: {
        payment_status: 'paid',
        client_reference_id: userId,
        customer: `cus-${userId}`,
        subscription: `sub-${userId}`,
        period_start: overrides.periodStart ?? now - 60,
        period_end: overrides.periodEnd ?? now + 2_592_000,
        amount_total: overrides.amount ?? 1999,
        amount_paid: overrides.amount ?? 1999,
        currency: 'usd',
        metadata: { userId, planSlug: overrides.planSlug ?? 'pro', interval: 'month' },
      },
    },
  });
}

async function webhook(rawBody, valid = true) {
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = createHmac('sha256', signingSecret).update(`${timestamp}.${rawBody}`).digest('hex');
  const response = await fetch(`${apiBase}/billing/webhook/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': valid ? `t=${timestamp},v1=${digest}` : `t=${timestamp},v1=${'0'.repeat(64)}` },
    body: rawBody,
  });
  return { status: response.status, body: await response.json().catch(() => undefined) };
}

test.before(async () => {
  assert.ok(signingSecret);
  await prisma.$connect();
  await plans.onModuleInit();
});
test.after(async () => prisma.$disconnect());

test('signed payment is atomic and duplicate delivery is idempotent', async () => {
  const user = await createUser('valid');
  const eventId = `evt-${stamp}-valid`;
  const raw = stripeBody(eventId, 'checkout.session.completed', user.id);
  assert.equal((await webhook(raw)).status, 200);
  assert.equal((await webhook(raw)).status, 200);
  const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider: 'stripe', eventId } } });
  assert.equal(event.status, 'processed');
  assert.equal(event.attemptCount, 1);
  assert.equal(await prisma.payment.count({ where: { userId: user.id, providerRef: eventId } }), 1);
  assert.equal(await prisma.invoice.count({ where: { userId: user.id } }), 1);
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id }, include: { plan: true } });
  assert.equal(sub.status, 'active');
  assert.equal(sub.plan.slug, 'pro');
  assert.equal(await prisma.auditLog.count({ where: { targetId: user.id, action: 'billing.webhook.subscription_activated' } }), 1);
});

test('invalid signature is refused without persistence', async () => {
  const user = await createUser('invalid-signature');
  const eventId = `evt-${stamp}-invalid`;
  const result = await webhook(stripeBody(eventId, 'checkout.session.completed', user.id), false);
  assert.ok(result.status >= 400);
  assert.equal(await prisma.webhookEvent.count({ where: { provider: 'stripe', eventId } }), 0);
  assert.equal(await prisma.subscription.count({ where: { userId: user.id } }), 0);
});

test('partially failed event retries the identical payload without double credit', async () => {
  const futureUserId = `s15-partial-${stamp}`;
  const eventId = `evt-${stamp}-partial`;
  const raw = stripeBody(eventId, 'checkout.session.completed', futureUserId);
  assert.ok((await webhook(raw)).status >= 400);
  let event = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider: 'stripe', eventId } } });
  assert.equal(event.status, 'failed');
  assert.equal(event.attemptCount, 1);
  assert.equal(await prisma.payment.count({ where: { userId: futureUserId } }), 0);
  await createUser('partial-created', futureUserId);
  assert.equal((await webhook(raw)).status, 200);
  assert.equal((await webhook(raw)).status, 200);
  event = await prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventId: { provider: 'stripe', eventId } } });
  assert.equal(event.status, 'processed');
  assert.equal(event.attemptCount, 2);
  assert.equal(await prisma.payment.count({ where: { userId: futureUserId, providerRef: eventId } }), 1);
  assert.equal(await prisma.quotaCycle.count({ where: { userId: futureUserId } }), 0);
  await quotas.reserve({ userId: futureUserId, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: 'first-paid-unit' });
  const account = await prisma.quotaAccount.findFirstOrThrow({ where: { cycle: { userId: futureUserId }, resource: 'AI_TEXT' } });
  assert.equal(account.primaryLimit, 10_000);
  assert.equal(account.fallbackLimit, 500);
  assert.equal(await prisma.quotaCycle.count({ where: { userId: futureUserId } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { targetId: futureUserId, action: 'billing.webhook.subscription_activated' } }), 1);
});

test('out-of-order update cannot roll a renewed subscription backward; renewal creates a fresh quota cycle', async () => {
  const user = await createUser('ordering');
  const now = Math.floor(Date.now() / 1000);
  const firstStart = now - 60;
  const firstEnd = now + 2_592_000;
  const activationId = `evt-${stamp}-activation`;
  assert.equal((await webhook(stripeBody(activationId, 'checkout.session.completed', user.id, { periodStart: firstStart, periodEnd: firstEnd }))).status, 200);
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 10_000, idempotencyKey: 'old-primary' });
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 10, idempotencyKey: 'old-fallback' });
  const oldCycle = await prisma.quotaCycle.findFirstOrThrow({ where: { userId: user.id } });

  const renewedStart = now - 1;
  const renewedEnd = now + 5_184_000;
  const renewalId = `evt-${stamp}-renewal`;
  assert.equal((await webhook(stripeBody(renewalId, 'invoice.paid', user.id, { periodStart: renewedStart, periodEnd: renewedEnd }))).status, 200);
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'integration', units: 1, idempotencyKey: 'new-primary' });
  const cycles = await prisma.quotaCycle.findMany({ where: { userId: user.id }, include: { accounts: true }, orderBy: { createdAt: 'asc' } });
  assert.equal(cycles.length, 2);
  assert.equal(cycles[0].id, oldCycle.id);
  assert.equal(cycles[0].accounts[0].fallbackUsed, 10);
  assert.equal(cycles[1].accounts[0].primaryUsed, 1);
  assert.equal(cycles[1].accounts[0].fallbackUsed, 0);

  const staleId = `evt-${stamp}-stale`;
  assert.equal((await webhook(stripeBody(staleId, 'customer.subscription.updated', user.id, { created: now - 120, periodStart: firstStart, periodEnd: firstEnd }))).status, 200);
  const afterStale = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(Math.floor(afterStale.currentPeriodStart.getTime() / 1000), renewedStart);
  assert.equal(Math.floor(afterStale.currentPeriodEnd.getTime() / 1000), renewedEnd);
  assert.equal(await prisma.payment.count({ where: { userId: user.id, providerRef: renewalId } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { targetId: user.id, action: 'billing.webhook.subscription_renewed' } }), 1);
});

test('payment failure is persisted once and audited', async () => {
  const user = await createUser('failed-payment');
  const activationId = `evt-${stamp}-before-failure`;
  assert.equal((await webhook(stripeBody(activationId, 'checkout.session.completed', user.id))).status, 200);
  const failedId = `evt-${stamp}-payment-failed`;
  const raw = stripeBody(failedId, 'invoice.payment_failed', user.id, { amount: 1999 });
  assert.equal((await webhook(raw)).status, 200);
  assert.equal((await webhook(raw)).status, 200);
  const sub = await prisma.subscription.findUniqueOrThrow({ where: { userId: user.id } });
  assert.equal(sub.status, 'payment_failed');
  assert.equal(await prisma.payment.count({ where: { userId: user.id, status: 'failed' } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { targetId: user.id, action: 'billing.webhook.payment_failed' } }), 1);
});
