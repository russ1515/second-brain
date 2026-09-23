const test = require('node:test');
const assert = require('node:assert/strict');

// Focused Sprint 3 backend contract tests. Run after the API build because the
// project test harness deliberately executes the compiled Nest services.
const { AdminAuditService } = require('../dist/admin/admin-audit.service.js');
const { AdminService } = require('../dist/admin/admin.service.js');
const { QuotaService } = require('../dist/usage/quota.service.js');
const { UserAdminService } = require('../dist/admin/users/user-admin.service.js');

const now = new Date('2026-09-15T12:00:00.000Z');

function superIdentity(extra = []) {
  return {
    userId: 'admin-1', email: 'admin@example.test', roles: ['SUPER_ADMIN'],
    capabilities: [
      'users.read', 'users.manage', 'subscriptions.read', 'subscriptions.manage',
      'quotas.read', 'quotas.adjust', 'usage.read', 'payments.read', 'security.read',
      'audit.read', 'audit.reasons.read', 'learner_profile.read',
      'learner_profile.restricted', 'learner_profile.highly_restricted',
      ...extra,
    ],
  };
}

test('audit data sanitizes headers, reasons, metadata and opaque payment/auth material', async () => {
  const writes = [];
  const audit = new AdminAuditService({
    auditLog: { create: async (args) => writes.push(args.data) },
    securityEvent: { create: async (args) => writes.push(args.data) },
  });
  await audit.record(
    { actorId: 'admin', requestId: 'Bearer eyJabcdefgh.payload.signature', userAgent: 'https://receipt.example.test/secret' },
    { action: 'test', reason: 'access_token=sk_live_1234567890abcdef customer=cus_1234567890abcdef', metadata: { cardNumber: '4242 4242 4242 4242', note: 'pi_1234567890abcdef' } },
  );
  const serialized = JSON.stringify(writes[0]);
  for (const unsafe of ['eyJabcdefgh.payload.signature', 'sk_live_1234567890abcdef', 'cus_1234567890abcdef', '4242 4242 4242 4242', 'pi_1234567890abcdef', 'receipt.example.test']) {
    assert.equal(serialized.includes(unsafe), false);
  }
  assert.match(serialized, /REDACTED/);
});

test('legacy incident/audit paths reject sensitive prose and never expose historic audit detail', async () => {
  const writes = [];
  const tx = {
    incident: {
      create: async ({ data }) => ({
        id: 'incident-1', ...data, status: 'open', createdAt: now, resolvedAt: null,
      }),
    },
    auditLog: { create: async ({ data }) => writes.push(data) },
  };
  const service = new AdminService({
    $transaction: async (work) => work(tx),
    auditLog: {
      findMany: async () => [{
        id: 'legacy-audit', actorId: 'admin-1', action: 'legacy',
        detail: 'Bearer eyJabcdefgh.payload.signature', createdAt: now,
      }],
    },
  }, {}, {});
  await service.createIncident('admin-1', { title: 'Service degradation', severity: 'low' });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].detail, 'incident:incident-1');
  await assert.rejects(
    () => service.createIncident('admin-1', { title: 'cus_1234567890abcdef', severity: 'low' }),
    (error) => error.response?.code === 'ADMIN_TEXT_SENSITIVE_CONTENT_REJECTED',
  );
  const audits = await service.listAuditLogs();
  assert.equal(audits[0].detail, '[REDACTED]');
});

test('ADMIN_CREDIT is a serializable ledger adjustment: fallback first, then primary, never a reset', async () => {
  const account = {
    id: 'account-1', primaryLimit: 100, primaryUsed: 100,
    fallbackLimit: 50, fallbackUsed: 25, state: 'BLOCKED', version: 3,
  };
  const ledgerRows = [];
  const tx = {
    quotaCycle: { findFirst: async () => ({ id: 'cycle-1', userId: 'learner-1' }) },
    quotaAccount: {
      findUnique: async () => ({ ...account }),
      update: async ({ data }) => {
        account.primaryUsed -= data.primaryUsed.decrement;
        account.fallbackUsed -= data.fallbackUsed.decrement;
        account.state = data.state;
        account.version += data.version.increment;
        return { ...account };
      },
    },
    usageLedger: { create: async ({ data }) => { const row = { id: 'ledger-1', ...data }; ledgerRows.push(row); return row; } },
    auditLog: { create: async () => undefined },
    securityEvent: { create: async () => undefined },
  };
  const service = new QuotaService({ $transaction: async (work) => work(tx) }, {}, undefined);
  const result = await service.adminCredit({
    userId: 'learner-1', resource: 'AI_TEXT', amount: 40, reason: 'support correction', actorId: 'admin-1',
    afterApplied: async () => undefined,
  });
  assert.deepEqual({ primary: result.primaryCredit, fallback: result.fallbackCredit, applied: result.appliedCredit }, { primary: 15, fallback: 25, applied: 40 });
  assert.equal(account.primaryUsed, 85);
  assert.equal(account.fallbackUsed, 0);
  assert.equal(account.state, 'PRIMARY');
  assert.equal(ledgerRows.length, 1);
  assert.equal(ledgerRows[0].event, 'ADJUST');
  assert.deepEqual({ primary: ledgerRows[0].primaryDelta, fallback: ledgerRows[0].fallbackDelta }, { primary: -15, fallback: -25 });
  assert.equal(ledgerRows[0].metadata.source, 'ADMIN_CREDIT');
  assert.equal(ledgerRows[0].metadata.unappliedCredit, 0);
});

test('directory pagination is server-side, bounded by request values, and does not require client-side hydration', async () => {
  let findArgs;
  const prisma = {
    user: {
      findMany: async (args) => {
        findArgs = args;
        return [{
          id: 'learner-1', email: 'learner@example.test', accountStatus: 'active', createdAt: now, lastActiveAt: now,
          profile: { displayName: 'Learner', preferredLanguage: 'fr' },
          subscription: { status: 'active', plan: { slug: 'pro' } },
          quotaCycles: [{ accounts: [{ state: 'PRIMARY', primaryLimit: 100, primaryUsed: 30, fallbackLimit: 50, fallbackUsed: 0 }] }],
        }];
      },
      count: async () => 6,
    },
  };
  const service = new UserAdminService(prisma, {}, {});
  const response = await service.list(superIdentity(), {
    page: 2, pageSize: 5, search: 'learner', sortBy: 'email', sortDirection: 'asc',
  });
  assert.equal(findArgs.skip, 5);
  assert.equal(findArgs.take, 5);
  assert.deepEqual(findArgs.orderBy, { email: 'asc' });
  assert.equal(response.total, 6);
  assert.equal(response.totalPages, 2);
  assert.equal(response.items[0].usagePercent, 20);
});

test('highly restricted learner profile requires its distinct capability and a body reason, then audits without exposing documents or conversations', async () => {
  const writes = [];
  const user = {
    id: 'learner-1',
    profile: { preferredLanguage: 'fr', timezone: 'Europe/Paris' },
    onboardingProfile: {
      status: 'completed', category: 'university', completedAt: now,
      education: { level: 'licence' }, languages: { study: 'Spanish' }, languageLearner: {},
      goals: { goal: 'exam' }, subjects: { values: ['math'] }, preferences: { pace: 'slow' },
      teacher: { style: 'guided' }, academicSupport: {}, assessment: {}, extra: {},
    },
    languageProfiles: [{ language: 'Spanish', nativeLanguage: 'French', mode: 'beginner', cefrLevel: 'A1', goal: 'travel' }],
    profileReviewsForUser: [],
  };
  const prisma = {
    user: { findUnique: async () => user },
    $transaction: async (work) => work({
      auditLog: { create: async ({ data }) => writes.push(data) },
      securityEvent: { create: async ({ data }) => writes.push(data) },
    }),
  };
  const audit = {
    auditData: (_ctx, event) => event,
    securityData: (_ctx, type, userId, metadata) => ({ type, userId, metadata }),
  };
  const service = new UserAdminService(prisma, {}, audit);
  const support = { ...superIdentity(), capabilities: ['learner_profile.read'] };
  await assert.rejects(
    () => service.learnerProfile('learner-1', support, { access: 'highly_restricted', reason: 'support case' }),
    (error) => error.response?.code === 'ADMIN_CAPABILITY_DENIED',
  );
  await assert.rejects(
    () => service.learnerProfile('learner-1', superIdentity(), { access: 'highly_restricted' }),
    (error) => error.response?.code === 'SENSITIVE_ACCESS_REASON_REQUIRED',
  );
  const result = await service.learnerProfile(
    'learner-1', superIdentity(), { access: 'highly_restricted', reason: 'support case' }, { actorId: 'admin-1' },
  );
  assert.equal(result.classification, 'HIGHLY_RESTRICTED');
  assert.deepEqual(result.documents, { status: 'HIGHLY_RESTRICTED_NOT_IMPLEMENTED' });
  assert.deepEqual(result.conversations, { status: 'HIGHLY_RESTRICTED_NOT_IMPLEMENTED' });
  assert.equal(writes.length, 2);
  assert.equal(writes[0].action, 'learner_profile.highly_restricted.access');
});

test('subscription override reasons stay redacted without the dedicated audit.reasons.read capability', async () => {
  const prisma = {
    user: { findUnique: async () => ({ id: 'learner-1', createdAt: now }) },
    subscription: { findUnique: async () => ({
      status: 'active', interval: 'month', provider: 'stripe', providerSubscriptionId: 'sub_12345678',
      currentPeriodStart: now, currentPeriodEnd: now, cancelAtPeriodEnd: false, trialEndsAt: null, planVersion: 1,
      plan: { slug: 'pro', name: 'PRO' },
    }) },
    entitlementOverride: { findMany: async () => [{
      id: 'override-1', value: 'pro_max', startsAt: new Date('2026-09-01T00:00:00.000Z'), endsAt: null,
      revokedAt: null, createdAt: now, grantedById: 'admin-2', reason: 'private commercial exception',
    }] },
  };
  const identity = { ...superIdentity(), capabilities: ['subscriptions.read', 'audit.read'] };
  const result = await new UserAdminService(prisma, {}, {}).subscription('learner-1', identity);
  assert.equal(result.overrides[0].reason, '[REDACTED]');
  assert.equal(result.overrides[0].reasonVisibility, 'REDACTED');
  assert.equal(result.overrides[0].grantedById, 'admin-2');
});
