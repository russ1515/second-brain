const assert = require('node:assert/strict');
const test = require('node:test');

const { CommercialControlService } = require('../dist/admin/commercial/commercial-control.service.js');

function planFixture(overrides = {}) {
  return {
    id: 'plan-pro',
    slug: 'pro',
    name: 'Pro',
    tier: 10,
    audience: 'individual',
    quotas: { ai_questions: 10000, voice_minutes: 3000 },
    features: {},
    priceMonthly: 499,
    priceYearly: 4900,
    currency: 'usd',
    isActive: true,
    publicV1: true,
    fallbackRatio: 0.5,
    configurationVersion: 2,
    updatedAt: new Date('2026-10-05T00:00:00.000Z'),
    ...overrides,
  };
}

function commercialService(plan = planFixture()) {
  const writes = [];
  const tx = {
    plan: {
      findUnique: async () => ({ ...plan }),
      update: async ({ data }) => {
        writes.push({ kind: 'plan.update', data });
        return { ...plan, ...data };
      },
    },
    planVersion: {
      updateMany: async ({ data }) => {
        writes.push({ kind: 'planVersion.close', data });
        return { count: 1 };
      },
      create: async ({ data }) => {
        writes.push({ kind: 'planVersion.create', data });
        return data;
      },
    },
    auditLog: {
      create: async ({ data }) => {
        writes.push({ kind: 'auditLog.create', data });
        return data;
      },
    },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };
  const audit = {
    auditData: (_context, event) => ({
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      before: event.before,
      after: event.after,
      reason: event.reason,
      metadata: event.metadata,
    }),
  };
  return {
    service: new CommercialControlService(prisma, audit, { all: () => ({}) }),
    writes,
  };
}

const context = {
  actorId: 'finance-admin',
  actorRole: 'FINANCE',
  requestId: 'sprint7-commercial-unit-0001',
  sessionId: 'session-1',
};

test('commercial pricing appends a version, updates only the active catalog and audits in one transaction', async () => {
  const { service, writes } = commercialService();
  const result = await service.updatePricing('pro', {
    priceMonthly: 599,
    priceYearly: 5900,
    expectedVersion: 2,
    reason: 'Approved commercial catalog correction',
  }, context);

  assert.equal(result.changed, true);
  assert.deepEqual(result.plan, {
    id: 'plan-pro', slug: 'pro', name: 'Pro', priceMonthly: 599, priceYearly: 5900,
    currency: 'USD', status: 'ACTIVE', publicV1: true, fallbackRatio: 0.5,
    configurationVersion: 3,
  });
  assert.deepEqual(writes.map((write) => write.kind), [
    'planVersion.close', 'planVersion.create', 'plan.update', 'auditLog.create',
  ]);
  const version = writes.find((write) => write.kind === 'planVersion.create').data;
  assert.equal(version.version, 3);
  assert.equal(version.priceMonthly, 599);
  assert.equal(version.priceYearly, 5900);
  assert.deepEqual(version.quotas, { ai_questions: 10000, voice_minutes: 3000 });
  assert.equal(version.fallbackRatio, 0.5);
  const audit = writes.find((write) => write.kind === 'auditLog.create').data;
  assert.equal(audit.action, 'plan.pricing.update');
  assert.equal(audit.metadata.source, 'COMMERCIAL_CONTROL_CENTER');
  assert.equal(audit.before.priceMonthly, 499);
  assert.equal(audit.after.priceMonthly, 599);
});

test('commercial pricing rejects stale and no-op mutations before writing a version', async () => {
  const stale = commercialService();
  await assert.rejects(
    () => stale.service.updatePricing('pro', {
      priceMonthly: 599, priceYearly: 5900, expectedVersion: 1, reason: 'Stale tab validation',
    }, context),
    (error) => error.getResponse().code === 'COMMERCIAL_PLAN_VERSION_CONFLICT',
  );
  assert.deepEqual(stale.writes, []);

  const unchanged = commercialService();
  await assert.rejects(
    () => unchanged.service.updatePricing('pro', {
      priceMonthly: 499, priceYearly: 4900, expectedVersion: 2, reason: 'No-op validation',
    }, context),
    (error) => error.getResponse().code === 'COMMERCIAL_PRICING_UNCHANGED',
  );
  assert.deepEqual(unchanged.writes, []);
});
