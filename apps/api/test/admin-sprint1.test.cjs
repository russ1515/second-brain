const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { AdminGuard } = require('../dist/admin/admin.guard.js');
const { CapabilityGuard } = require('../dist/admin/capability.guard.js');
const { ROLE_CAPABILITIES } = require('../dist/admin/admin-rbac.js');
const { AuthService } = require('../dist/auth/auth.service.js');
const { JwtAccessStrategy } = require('../dist/auth/strategies/jwt-access.strategy.js');
const { QuotaService } = require('../dist/usage/quota.service.js');
const { ProviderMeteringService } = require('../dist/usage/provider-metering.service.js');
const { AdminAuditService } = require('../dist/admin/admin-audit.service.js');
const { UserAdminService } = require('../dist/admin/users/user-admin.service.js');
const { ForbiddenException } = require('@nestjs/common');

function executionContext(request = {}) {
  return { switchToHttp: () => ({ getRequest: () => request }), getHandler: () => 'handler', getClass: () => 'class' };
}

test('admin auth: unauthenticated and non-MFA sessions are refused', async () => {
  const guard = new AdminGuard({ resolve: async () => ({ userId: 'u1', roles: ['SUPPORT'], capabilities: ['dashboard.read'] }) });
  await assert.rejects(() => guard.canActivate(executionContext({})), /Admins only/);
  await assert.rejects(
    () => guard.canActivate(executionContext({ user: { userId: 'u1', email: 'a@b.c', sessionId: 's1', mfaVerifiedAt: null } })),
    (error) => error.response.code === 'ADMIN_MFA_REQUIRED',
  );
});

test('admin auth: legacy identity resolution cannot persist a grant before MFA is proven', async () => {
  let resolved = false;
  const guard = new AdminGuard({
    isEligible: async () => true,
    resolve: async () => {
      resolved = true;
      return { userId: 'legacy-admin', roles: ['SUPER_ADMIN'], capabilities: ['dashboard.read'] };
    },
  });
  await assert.rejects(
    () => guard.canActivate(executionContext({ user: { userId: 'legacy-admin', sessionId: 's1', mfaVerifiedAt: null } })),
    (error) => error.response.code === 'ADMIN_MFA_REQUIRED',
  );
  assert.equal(resolved, false);
  assert.equal(await guard.canActivate(executionContext({ user: { userId: 'legacy-admin', sessionId: 's1', mfaVerifiedAt: new Date() } })), true);
  assert.equal(resolved, true);
});

test('admin auth: normal users are 403, MFA admins pass, stale admin sessions expire', async () => {
  const normal = new AdminGuard({ resolve: async () => { throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN' }); } });
  const request = { user: { userId: 'u1', email: 'u@example.com', sessionId: 's1', mfaVerifiedAt: new Date() } };
  await assert.rejects(() => normal.canActivate(executionContext(request)), (error) => error.status === 403);
  const allowed = new AdminGuard({ resolve: async () => ({ userId: 'a1', roles: ['SUPPORT'], capabilities: ['dashboard.read'] }) });
  assert.equal(await allowed.canActivate(executionContext({ user: { ...request.user, userId: 'a1' } })), true);
  const expired = new AdminGuard({ resolve: async () => ({}) }, { get: () => 1 });
  await assert.rejects(() => expired.canActivate(executionContext({ user: { ...request.user, mfaVerifiedAt: new Date(Date.now() - 2_000) } })), (error) => error.response.code === 'ADMIN_SESSION_EXPIRED');
});

test('admin RBAC: capability allow and deny are backend decisions', () => {
  const reflector = { getAllAndOverride: () => ['payments.reconcile'] };
  const guard = new CapabilityGuard(reflector);
  assert.equal(guard.canActivate(executionContext({ adminIdentity: { capabilities: ['payments.reconcile'] } })), true);
  assert.throws(
    () => guard.canActivate(executionContext({ adminIdentity: { capabilities: ['payments.read'] } })),
    (error) => error.response.code === 'ADMIN_CAPABILITY_DENIED',
  );
  assert.ok(ROLE_CAPABILITIES.SUPER_ADMIN.includes('security.manage'));
  assert.ok(!ROLE_CAPABILITIES.ANALYTICS.includes('users.ban'));
});

test('account state: suspended and banned identities cannot authenticate', () => {
  const auth = Object.create(AuthService.prototype);
  assert.doesNotThrow(() => auth.assertAccountActive({ accountStatus: 'active', suspendedAt: null, bannedAt: null }));
  assert.throws(() => auth.assertAccountActive({ accountStatus: 'suspended', suspendedAt: new Date(), bannedAt: null }), (error) => error.response.code === 'ACCOUNT_SUSPENDED');
  assert.throws(() => auth.assertAccountActive({ accountStatus: 'banned', suspendedAt: null, bannedAt: new Date() }), (error) => error.response.code === 'ACCOUNT_BANNED');
});

test('JWT validation rejects revoked sessions and persisted suspension', async () => {
  const config = { getOrThrow: () => 'secret' };
  const context = { authenticateCalled: false, authenticate() { this.authenticateCalled = true; } };
  const prisma = {
    user: { findUnique: async () => ({ email: 'admin@example.com', accountStatus: 'active', suspendedAt: null, bannedAt: null }) },
    session: { findUnique: async () => ({ userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000), mfaVerifiedAt: new Date() }) },
  };
  const strategy = new JwtAccessStrategy(config, prisma, context);
  const user = await strategy.validate({ sub: 'u1', email: 'stale@example.com', purpose: 'access', sessionId: 's1' });
  assert.equal(user.email, 'admin@example.com');
  assert.equal(context.authenticateCalled, true);
  prisma.session.findUnique = async () => ({ userId: 'u1', revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), mfaVerifiedAt: new Date() });
  await assert.rejects(() => strategy.validate({ sub: 'u1', email: 'x', purpose: 'access', sessionId: 's1' }));
});

function quotaHarness(primaryLimit = 10, fallbackLimit = 5, capRows = []) {
  const cycle = { id: 'c1', userId: 'u1', planSlug: 'pro', planVersion: 1, startsAt: new Date('2026-09-01'), endsAt: new Date('2026-10-01'), status: 'ACTIVE', createdAt: new Date() };
  const account = { id: 'a1', cycleId: 'c1', resource: 'AI_TEXT', primaryLimit, fallbackLimit, primaryUsed: 0, fallbackUsed: 0, state: 'PRIMARY', version: 0, updatedAt: new Date() };
  const reservations = new Map();
  const tx = {
    quotaAccount: {
      upsert: async () => account,
      findUniqueOrThrow: async () => ({ ...account }),
      update: async ({ data }) => { if (data.state) account.state = data.state; if (data.primaryUsed?.increment) account.primaryUsed += data.primaryUsed.increment; return { ...account }; },
      updateMany: async ({ where, data }) => {
        if (where.primaryUsed?.lte !== undefined && account.primaryUsed > where.primaryUsed.lte) return { count: 0 };
        if (where.fallbackUsed?.lte !== undefined && account.fallbackUsed > where.fallbackUsed.lte) return { count: 0 };
        if (where.primaryUsed?.gte !== undefined && account.primaryUsed < where.primaryUsed.gte) return { count: 0 };
        if (where.fallbackUsed?.gte !== undefined && account.fallbackUsed < where.fallbackUsed.gte) return { count: 0 };
        if (data.primaryUsed?.increment) account.primaryUsed += data.primaryUsed.increment;
        if (data.fallbackUsed?.increment) account.fallbackUsed += data.fallbackUsed.increment;
        if (data.primaryUsed?.decrement) account.primaryUsed -= data.primaryUsed.decrement;
        if (data.fallbackUsed?.decrement) account.fallbackUsed -= data.fallbackUsed.decrement;
        if (data.state) account.state = data.state;
        return { count: 1 };
      },
    },
    quotaReservation: {
      findUnique: async ({ where }) => where.id ? reservations.get(where.id) : reservations.get(where.userId_idempotencyKey.idempotencyKey),
      findUniqueOrThrow: async ({ where }) => { const row = reservations.get(where.id); if (!row) throw new Error('missing'); return row; },
      create: async ({ data }) => { const row = { id: `r${reservations.size + 1}`, status: 'RESERVED', actualUnits: null, createdAt: new Date(), completedAt: null, ...data }; reservations.set(data.idempotencyKey, row); reservations.set(row.id, row); return row; },
      updateMany: async ({ where, data }) => { const row = reservations.get(where.id); if (!row || row.status !== where.status) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
    usageLedger: { create: async () => ({}) },
    entitlementOverride: { findMany: async () => capRows },
  };
  const prisma = {
    ...tx,
    quotaCycle: { findFirst: async () => cycle, upsert: async () => cycle },
    plan: { findUniqueOrThrow: async () => ({ id: 'p1', slug: 'pro', quotas: { ai_questions: primaryLimit }, fallbackRatio: fallbackLimit / primaryLimit, configurationVersion: 1 }) },
    planVersion: { findUnique: async () => null },
    $transaction: async (callback) => callback(tx),
  };
  const subscription = {
    resolveForUser: async () => ({
      id: 's1', planId: 'p1', planVersion: 1,
      currentPeriodStart: cycle.startsAt, currentPeriodEnd: cycle.endsAt,
    }),
  };
  return { service: new QuotaService(prisma, subscription), account, reservations };
}

test('quota concurrency: PRIMARY then FALLBACK then hard stop, never over limit', async () => {
  const { service, account } = quotaHarness();
  const attempts = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => service.reserve({ userId: 'u1', resource: 'AI_TEXT', feature: 'tutor', units: 1, idempotencyKey: `op-${i}` })));
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 15);
  assert.equal(account.primaryUsed, 10);
  assert.equal(account.fallbackUsed, 5);
  assert.equal(account.state, 'BLOCKED');
  assert.ok(account.primaryUsed >= 0 && account.fallbackUsed >= 0);
});

test('private staging cap is a total AI_TEXT hard stop: no fallback or over-allocation', async () => {
  const capRows = [{ value: 3, endsAt: new Date(Date.now() + 60_000) }];
  const { service, account, reservations } = quotaHarness(10, 5, capRows);
  const attempts = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => service.reserve({
    userId: 'u1', resource: 'AI_TEXT', feature: 'tutor', units: 1, idempotencyKey: `cap-${i}`,
  })));
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 3);
  assert.equal(attempts.filter((item) => item.status === 'rejected' && item.reason?.response?.code === 'QUOTA_EXHAUSTED').length, 7);
  assert.equal(account.primaryUsed, 3);
  assert.equal(account.fallbackUsed, 0);
  assert.equal(account.state, 'BLOCKED');
  assert.equal([...reservations.values()].filter((row) => row.id.startsWith('r')).length / 2, 3);
});

test('quota idempotency and provider failure release exact units', async () => {
  const { service, account } = quotaHarness();
  const first = await service.reserve({ userId: 'u1', resource: 'AI_TEXT', feature: 'tutor', units: 3, idempotencyKey: 'same-action' });
  const duplicate = await service.reserve({ userId: 'u1', resource: 'AI_TEXT', feature: 'tutor', units: 3, idempotencyKey: 'same-action' });
  assert.equal(first.id, duplicate.id); assert.equal(account.primaryUsed, 3);
  await service.release(first.id, 'provider_failure');
  await service.release(first.id, 'duplicate_release');
  assert.equal(account.primaryUsed, 0);
});

test('provider metering calls release when provider fails', async () => {
  let released = 0;
  const context = { current: () => ({ userId: 'u1', requestId: 'req-12345678' }), nextOperationId: () => 'op1', reservationFor: () => undefined };
  const prisma = {
    plan: { findUniqueOrThrow: async () => ({ slug: 'pro', configurationVersion: 1 }) },
    providerUsage: { upsert: async () => ({ id: 'pu1' }), update: async () => ({}) },
  };
  const quotas = { reserve: async () => ({ id: 'r1', status: 'RESERVED' }), finalize: async () => {}, release: async () => { released += 1; } };
  const meter = new ProviderMeteringService(context, prisma, { resolveForUser: async () => ({ id: 's1', planId: 'p1', planVersion: 1 }) }, quotas);
  await assert.rejects(() => meter.execute({ provider: 'gemini', feature: 'tutor', resource: 'AI_TEXT', units: 1 }, async () => { throw new Error('provider down'); }));
  assert.equal(released, 1);
});

test('quota hard stop occurs before provider invocation', async () => {
  let providerCalls = 0;
  const context = { current: () => ({ userId: 'u1', requestId: 'req-12345678' }), nextOperationId: () => 'op-blocked', reservationFor: () => undefined };
  const meter = new ProviderMeteringService(context, {}, {}, { reserve: async () => { throw new ForbiddenException({ code: 'QUOTA_EXHAUSTED' }); } });
  await assert.rejects(() => meter.execute({ provider: 'gemini', feature: 'tutor', resource: 'AI_TEXT', units: 1 }, async () => { providerCalls += 1; }));
  assert.equal(providerCalls, 0);
});

test('staging quota cap requires active private beta access, stays within it, and is auditable', async () => {
  const auditRows = [];
  const securityRows = [];
  const caps = [];
  const betaEndsAt = new Date(Date.now() + 60 * 60_000);
  const tx = {
    entitlementOverride: {
      findFirst: async ({ where }) => {
        if (where.kind === 'feature') return { endsAt: betaEndsAt };
        return caps.find((cap) => cap.id === where.id && cap.revokedAt === null) ?? null;
      },
      findMany: async () => caps.filter((cap) => cap.revokedAt === null && cap.endsAt > new Date()),
      updateMany: async ({ where, data }) => {
        for (const cap of caps.filter((row) => where.id.in.includes(row.id))) Object.assign(cap, data);
        return { count: 1 };
      },
      create: async ({ data }) => {
        const row = { id: `cap-${caps.length + 1}`, ...data, revokedAt: null, revokedById: null };
        caps.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = caps.find((cap) => cap.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    auditLog: { create: async ({ data }) => { auditRows.push(data); return data; } },
    securityEvent: { create: async ({ data }) => { securityRows.push(data); return data; } },
  };
  const prisma = {
    user: { findUnique: async () => ({ id: 'learner-1' }) },
    $transaction: async (callback) => callback(tx),
  };
  const audit = {
    auditData: (_context, data) => data,
    securityData: (_context, type, userId, metadata, severity) => ({ type, userId, metadata, severity }),
  };
  const service = new UserAdminService(
    prisma,
    {},
    audit,
    { quota: async () => 10 },
  );
  const identity = { userId: 'finance-1', capabilities: ['quotas.adjust'] };
  const context = { actorId: 'finance-1' };
  const created = await service.createStagingQuotaCap('learner-1', identity, {
    resource: 'AI_TEXT', limit: 3, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), reason: 'bounded private staging validation',
  }, context);
  assert.equal(created.limit, 3);
  assert.equal(caps.length, 1);
  assert.equal(auditRows[0].action, 'quota.staging_cap.create');
  assert.equal(securityRows[0].type, 'STAGING_QUOTA_CAP_CREATED');
  await assert.rejects(
    () => service.createStagingQuotaCap('learner-1', identity, {
      resource: 'AI_TEXT', limit: 11, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), reason: 'must not exceed allowance',
    }, context),
    (error) => error.response.code === 'STAGING_QUOTA_CAP_MUST_NOT_INCREASE_ALLOWANCE',
  );
  await assert.rejects(
    () => service.createStagingQuotaCap('learner-1', identity, {
      resource: 'AI_TEXT', limit: 2, expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(), reason: 'must not outlast beta access',
    }, context),
    (error) => error.response.code === 'STAGING_QUOTA_CAP_EXPIRY_EXCEEDS_BETA_ACCESS',
  );
  await assert.rejects(
    () => service.createStagingQuotaCap('learner-1', identity, {
      resource: 'AI_TEXT', limit: 4, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), reason: 'must not widen',
    }, context),
    (error) => error.response.code === 'STAGING_QUOTA_CAP_CAN_ONLY_RESTRICT',
  );
  const revoked = await service.revokeStagingQuotaCap('learner-1', created.id, identity, 'end bounded validation', context);
  assert.equal(revoked.revoked, true);
  assert.ok(caps[0].revokedAt);
  assert.equal(auditRows[1].action, 'quota.staging_cap.revoke');
  assert.equal(securityRows[1].type, 'STAGING_QUOTA_CAP_REVOKED');
});

test('staging quota-cap revocation is an OK mutation, not a resource creation', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../src/admin/admin.controller.ts'), 'utf8');
  assert.match(
    controller,
    /@Post\('users\/:id\/staging-quota-cap\/:capId\/revoke'\)\s*@RequireAdminCapabilities\('quotas\.adjust'\)\s*@UseGuards\(AdminStepUpGuard\)\s*@HttpCode\(HttpStatus\.OK\)\s*revokeStagingQuotaCap/s,
  );
});

test('Audit V2 recursively redacts secrets', async () => {
  let written;
  const audit = new AdminAuditService({ auditLog: { create: async ({ data }) => { written = data; return data; } } });
  await audit.record({ actorId: 'a1' }, { action: 'test', before: { email: 'safe@example.com', password: 'nope', nested: { accessToken: 'nope' } } });
  assert.equal(written.before.email, 'safe@example.com');
  assert.equal(written.before.password, '[REDACTED]');
  assert.equal(written.before.nested.accessToken, '[REDACTED]');
});

test('commercial source locks official prices and avoids boot overwrite', () => {
  const constants = fs.readFileSync(path.join(__dirname, '../src/subscription/plan.constants.ts'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '../src/subscription/plan.service.ts'), 'utf8');
  assert.match(constants, /priceMonthly: 1999/); assert.match(constants, /priceYearly: 19900/);
  assert.match(constants, /priceMonthly: 4999/); assert.match(constants, /priceYearly: 49900/);
  assert.match(service, /update: \{\}/); assert.doesNotMatch(service, /update:\s*\{[^}]*quotas/s);
});

test('webhook foundation is idempotent, transactional, and signature-freshness bounded', () => {
  const billing = fs.readFileSync(path.join(__dirname, '../src/payments/billing.service.ts'), 'utf8');
  const stripe = fs.readFileSync(path.join(__dirname, '../src/payments/providers/stripe-payment.provider.ts'), 'utf8');
  assert.match(billing, /registry\.status === 'processed'/);
  assert.match(billing, /TransactionIsolationLevel\.Serializable/);
  assert.match(billing, /status: 'failed'/);
  assert.match(stripe, /> 300/);
});

test('admin web exposes every protected foundation route and responsive breakpoints', () => {
  const shell = fs.readFileSync(path.join(__dirname, '../../admin/components/AdminShell.tsx'), 'utf8');
  const protectedLayout = fs.readFileSync(path.join(__dirname, '../../admin/app/(protected)/_layout.tsx'), 'utf8');
  for (const route of ['dashboard', 'users', 'plans', 'usage', 'costs', 'bugs', 'support', 'infrastructure', 'payments', 'emails', 'documents', 'security', 'analytics', 'settings']) assert.match(shell, new RegExp(`['\"]${route}['\"]`));
  assert.match(shell, /width < 1024/); assert.match(shell, /width < 768/);
  assert.match(protectedLayout, /!auth\.identity/); assert.match(protectedLayout, /Redirect href="\/login"/);
});

test('admin web keeps access tokens session-scoped and includes FR/EN catalogs', () => {
  const client = fs.readFileSync(path.join(__dirname, '../../admin/lib/api.ts'), 'utf8');
  const i18n = fs.readFileSync(path.join(__dirname, '../../admin/lib/i18n.ts'), 'utf8');
  assert.match(client, /sessionStorage/); assert.doesNotMatch(client, /localStorage.*access/i);
  assert.match(i18n, /fr:/); assert.match(i18n, /en:/);
});
