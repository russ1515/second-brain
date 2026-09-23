const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

// This suite deliberately uses the compiled domain services against a real
// PostgreSQL database. It must only be run with a dedicated test/staging URL.
const { PlanService } = require('../dist/subscription/plan.service.js');
const { SubscriptionService } = require('../dist/subscription/subscription.service.js');
const { QuotaService } = require('../dist/usage/quota.service.js');
const { AdminAuditService } = require('../dist/admin/admin-audit.service.js');
const { AdminService } = require('../dist/admin/admin.service.js');
const { UserAdminService } = require('../dist/admin/users/user-admin.service.js');

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!/(test|staging|sprint)/i.test(databaseUrl)) {
  throw new Error('Sprint 3 PostgreSQL integration requires a dedicated test/staging/sprint DATABASE_URL.');
}

const prisma = new PrismaClient();
const plans = new PlanService(prisma);
const subscriptions = new SubscriptionService(prisma, plans);
const quotas = new QuotaService(prisma, subscriptions);
const audit = new AdminAuditService(prisma);
const users = new UserAdminService(prisma, quotas, audit);
const adminService = new AdminService(prisma, subscriptions, audit);
const runId = `sprint3-${process.pid}-${Date.now()}`;

let admin;
let learner;
let deletionTarget;
let pro;

function identity() {
  return {
    userId: admin.id,
    email: admin.email,
    roles: ['SUPER_ADMIN'],
    capabilities: [
      'users.read', 'users.manage', 'users.suspend', 'users.ban', 'users.delete_request', 'users.sessions.revoke',
      'subscriptions.read', 'subscriptions.manage', 'quotas.read', 'quotas.adjust', 'usage.read', 'payments.read',
      'security.read', 'audit.read', 'audit.reasons.read', 'learner_profile.read', 'learner_profile.restricted',
      'learner_profile.highly_restricted',
    ],
  };
}

function context() {
  return { actorId: admin.id, actorRole: 'SUPER_ADMIN', requestId: `sprint3-${runId}` };
}

async function createLearner(suffix, withSubscription = false) {
  const now = new Date();
  const user = await prisma.user.create({
    data: {
      email: `${runId}-${suffix}@example.test`,
      passwordHash: 'integration-fixture-not-a-credential',
      emailVerified: true,
      lastActiveAt: now,
      profile: { create: { displayName: `Fixture ${suffix}`, preferredLanguage: 'fr', timezone: 'Europe/Paris' } },
      onboardingProfile: {
        create: {
          status: 'completed', category: 'university', currentStep: 'complete', completedAt: now,
          education: { level: 'licence' }, languages: { study: 'Spanish' }, goals: { goal: 'exam' },
          subjects: { values: ['mathematics'] }, preferences: { pace: 'steady' }, teacher: { style: 'guided' },
        },
      },
      languageProfiles: {
        create: { language: 'Spanish', normalizedLanguage: `spanish-${suffix}`, nativeLanguage: 'French', mode: 'beginner', cefrLevel: 'A2', goal: 'exam' },
      },
    },
  });
  if (!withSubscription) return user;
  const startsAt = new Date(Date.now() - 60_000);
  const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.subscription.create({
    data: {
      userId: user.id, planId: pro.id, planVersion: pro.configurationVersion, status: 'active', interval: 'month',
      provider: 'fake', providerSubscriptionId: `fixture-${suffix}`, currentPeriodStart: startsAt, currentPeriodEnd: endsAt,
    },
  });
  await prisma.payment.create({
    data: { userId: user.id, provider: 'fake', providerRef: `fixture-payment-${suffix}`, amount: 1999, currency: 'usd', status: 'succeeded' },
  });
  await prisma.session.create({
    data: { userId: user.id, refreshTokenHash: `fixture-session-${suffix}`, userAgent: 'FixtureBrowser/1.0', ipAddress: '203.0.113.10', expiresAt: endsAt },
  });
  await quotas.reserve({ userId: user.id, resource: 'AI_TEXT', feature: 'sprint3-integration', units: 100, idempotencyKey: `seed-${suffix}` });
  return user;
}

test.before(async () => {
  await prisma.$connect();
  await plans.onModuleInit();
  pro = await prisma.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
  admin = await prisma.user.create({
    data: { email: `${runId}-admin@example.test`, passwordHash: 'integration-fixture-not-a-credential', emailVerified: true, isAdmin: true },
  });
  learner = await createLearner('learner', true);
  deletionTarget = await createLearner('deletion', false);
});

test.after(async () => {
  // The surrounding database is ephemeral in the validation procedure. Keep
  // this targeted cleanup best-effort so an assertion failure cannot hide data.
  await prisma.user.deleteMany({ where: { email: { startsWith: runId } } }).catch(() => undefined);
  await prisma.$disconnect();
});

test('real PostgreSQL directory, summary panels and privacy-minimized profile are bounded and persisted', async () => {
  const page = await users.list(identity(), {
    page: 1, pageSize: 1, search: learner.email, sortBy: 'email', sortDirection: 'asc', plan: 'pro', quotaState: 'PRIMARY',
  }, context());
  assert.equal(page.pageSize, 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, learner.id);

  const detail = await users.detail(learner.id, identity(), context());
  assert.equal(detail.header.id, learner.id);
  assert.equal(detail.identityVerification.status, 'NOT_IMPLEMENTED');
  assert.equal(detail.sections.support.data.lazy, true);

  const payments = await users.payments(learner.id, identity(), { page: 1, pageSize: 10 });
  assert.equal(payments.items.length, 1);
  assert.ok(payments.items[0].referenceMasked);
  assert.equal(Object.hasOwn(payments.items[0], 'providerRef'), false);

  const sessions = await users.sessions(learner.id, identity(), { page: 1, pageSize: 10 });
  assert.equal(sessions.items.length, 1);
  assert.match(sessions.items[0].device, /FixtureBrowser|Unknown browser|Chrome|Firefox|Edge|Safari/);
  assert.equal(Object.hasOwn(sessions.items[0], 'refreshTokenHash'), false);

  const standard = await users.learnerProfile(learner.id, identity(), { access: 'standard' }, context());
  assert.equal(standard.classification, 'STANDARD');
  assert.equal(Object.hasOwn(standard, 'documents'), false);
  assert.equal(Object.hasOwn(standard, 'conversations'), false);

  const high = await users.learnerProfile(learner.id, identity(), { access: 'highly_restricted', reason: 'fixture support investigation' }, context());
  assert.equal(high.classification, 'HIGHLY_RESTRICTED');
  assert.equal(high.documents.status, 'HIGHLY_RESTRICTED_NOT_IMPLEMENTED');
  assert.equal(high.conversations.status, 'HIGHLY_RESTRICTED_NOT_IMPLEMENTED');
  assert.equal(await prisma.auditLog.count({ where: { targetId: learner.id, action: 'learner_profile.highly_restricted.access' } }), 1);
});

test('real PostgreSQL plan/beta overrides and quota ADMIN_CREDIT preserve automation and ledger truth', async () => {
  const paymentCountBefore = await prisma.payment.count({ where: { userId: learner.id } });
  const subscriptionBefore = await prisma.subscription.findUniqueOrThrow({ where: { userId: learner.id } });
  const startsAt = new Date(Date.now() + 1_000).toISOString();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const override = await users.planOverride(learner.id, identity(), { plan: 'pro_max', startsAt, expiresAt, reason: 'fixture commercial correction' }, context());
  assert.equal(override.source, 'ADMIN_OVERRIDE');
  assert.equal(override.paymentCreated, false);
  assert.equal((await prisma.payment.count({ where: { userId: learner.id } })), paymentCountBefore);
  assert.equal((await prisma.subscription.findUniqueOrThrow({ where: { userId: learner.id } })).planId, subscriptionBefore.planId);
  const overrides = await prisma.entitlementOverride.findMany({ where: { userId: learner.id, kind: 'plan', revokedAt: null }, select: { value: true } });
  assert.ok(overrides.some((row) => row.value === 'pro_max'));

  const beta = await users.betaAccess(learner.id, identity(), { plan: 'pro', startsAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), reason: 'fixture beta access' }, context());
  assert.equal(await prisma.auditLog.count({ where: { action: 'subscription.beta_access.grant', targetType: 'EntitlementOverride', targetId: beta.id } }), 1);

  const account = await prisma.quotaAccount.findFirstOrThrow({ where: { cycle: { userId: learner.id }, resource: 'AI_TEXT' }, orderBy: { updatedAt: 'desc' } });
  await prisma.quotaAccount.update({ where: { id: account.id }, data: { primaryUsed: account.primaryLimit, fallbackUsed: 80, state: 'FALLBACK' } });
  const credit = await users.quotaAdjustment(learner.id, identity(), { resource: 'AI_TEXT', amount: 100, reason: 'fixture quota correction', cycleId: account.cycleId }, context());
  assert.equal(credit.source, 'ADMIN_CREDIT');
  assert.equal(credit.appliedCredit, 100);
  const after = await prisma.quotaAccount.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(after.fallbackUsed, 0);
  assert.equal(after.primaryUsed, account.primaryLimit - 20);
  assert.equal(after.state, 'PRIMARY');
  const ledger = await prisma.usageLedger.findFirstOrThrow({ where: { userId: learner.id, event: 'ADJUST' }, orderBy: { createdAt: 'desc' } });
  assert.equal(ledger.metadata.source, 'ADMIN_CREDIT');
  assert.equal(ledger.primaryDelta, -20);
  assert.equal(ledger.fallbackDelta, -80);
});

test('real PostgreSQL account actions, support notes, profile review and concurrent credits remain auditable', async () => {
  await adminService.suspendUser(context(), learner.id, true, 'fixture suspension');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).accountStatus, 'suspended');
  assert.equal(await prisma.session.count({ where: { userId: learner.id, revokedAt: null } }), 0);
  await adminService.suspendUser(context(), learner.id, false, 'fixture reactivation');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).accountStatus, 'active');

  await users.createSupportNote(learner.id, identity(), { body: 'Fixture support note', reason: 'fixture support context' }, context());
  const notes = await users.supportNotes(learner.id, identity(), { page: 1, pageSize: 10 });
  assert.equal(notes.items.length, 1);
  assert.equal(notes.items[0].body, 'Fixture support note');

  const review = await users.reviewProfile(learner.id, identity(), { action: 'REQUEST_USER_UPDATE', reason: 'fixture profile follow-up' }, context());
  assert.equal(review.deliveryStatus, 'NOT_INSTRUMENTED');
  assert.equal(await prisma.adminProfileReview.count({ where: { userId: learner.id, action: 'REQUEST_USER_UPDATE' } }), 1);

  const account = await prisma.quotaAccount.findFirstOrThrow({ where: { cycle: { userId: learner.id }, resource: 'AI_TEXT' }, orderBy: { updatedAt: 'desc' } });
  await prisma.quotaAccount.update({ where: { id: account.id }, data: { primaryUsed: 50, fallbackUsed: 0, state: 'PRIMARY' } });
  const adjustmentsBefore = await prisma.usageLedger.count({ where: { userId: learner.id, event: 'ADJUST' } });
  const concurrent = await Promise.all([
    users.quotaAdjustment(learner.id, identity(), { resource: 'AI_TEXT', amount: 30, reason: 'fixture concurrent credit A', cycleId: account.cycleId }, context()),
    users.quotaAdjustment(learner.id, identity(), { resource: 'AI_TEXT', amount: 30, reason: 'fixture concurrent credit B', cycleId: account.cycleId }, context()),
  ]);
  assert.equal(concurrent.length, 2);
  const finalAccount = await prisma.quotaAccount.findUniqueOrThrow({ where: { id: account.id } });
  assert.equal(finalAccount.primaryUsed, 0);
  assert.ok(finalAccount.primaryUsed >= 0 && finalAccount.fallbackUsed >= 0);
  assert.equal(await prisma.usageLedger.count({ where: { userId: learner.id, event: 'ADJUST' } }), adjustmentsBefore + 2);

  await adminService.banUser(context(), learner.id, { reason: 'fixture ban', internalNote: 'fixture case' });
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: learner.id } })).accountStatus, 'banned');
  const deletion = await adminService.requestDeletion(context(), deletionTarget.id, 'fixture deletion request');
  assert.equal(deletion.status, 'requested');
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: deletionTarget.id } })).accountStatus, 'deletion_pending');
  assert.equal(await prisma.accountDeletionRequest.count({ where: { userId: deletionTarget.id, status: 'requested' } }), 1);
  assert.ok(await prisma.auditLog.count({ where: { targetId: learner.id } }) >= 1);
  assert.ok(await prisma.securityEvent.count({ where: { userId: learner.id } }) >= 1);
});
