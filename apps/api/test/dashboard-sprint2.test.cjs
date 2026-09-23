const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// This suite deliberately uses in-memory Prisma doubles. It exercises the
// compiled DashboardService contract without a running PostgreSQL/Redis/Qdrant
// stack or any production data. Run it after `pnpm --filter @second-brain/api build`.
const { DashboardService } = require('../dist/admin/dashboard/dashboard.service.js');
const { DashboardController } = require('../dist/admin/dashboard/dashboard.controller.js');
const { AdminGuard } = require('../dist/admin/admin.guard.js');
const { CapabilityGuard } = require('../dist/admin/capability.guard.js');

const adminIdentity = {
  userId: 'admin-dashboard-test',
  email: 'admin@example.test',
  roles: ['SUPER_ADMIN'],
  capabilities: [
    'dashboard.read', 'plans.read', 'subscriptions.read', 'quotas.read',
    'usage.read', 'infrastructure.read', 'bugs.read', 'security.read', 'audit.read',
  ],
};

function executionContext(request = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'dashboard-handler',
    getClass: () => 'dashboard-controller',
  };
}

function directCache(calls = []) {
  return {
    wrap: async (key, ttl, compute) => {
      calls.push({ key, ttl });
      return compute();
    },
  };
}

function zeroPrisma({ failUsage = false, activityTrace } = {}) {
  const zero = async () => 0;
  const none = async () => [];
  return {
    user: {
      count: zero,
      findMany: async (args) => {
        if (activityTrace) activityTrace.registrationSelect = args.select;
        return [];
      },
    },
    plan: { findMany: none },
    subscription: { groupBy: none },
    quotaCycle: { findMany: none },
    quotaAccount: {
      findMany: async (args) => {
        if (activityTrace) activityTrace.quotaSelect = args.select;
        return [];
      },
    },
    providerUsage: { groupBy: async () => {
      if (failUsage) throw new Error('test dependency unavailable');
      return [];
    } },
    document: { groupBy: none, count: zero },
    languageProfile: { count: zero, findMany: none },
    experienceSession: { count: zero },
    tutorSession: { count: zero },
    academicWorkspace: { count: zero },
    card: { count: zero },
    reviewLog: { count: zero },
    learningDna: { count: zero },
    concept: { count: zero },
    conceptEdge: { count: zero },
    incident: {
      count: zero,
      findMany: async (args) => {
        if (activityTrace) activityTrace.incidentSelect = args.select;
        return [];
      },
    },
    securityEvent: { count: zero },
    auditLog: {
      findMany: async (args) => {
        if (activityTrace) activityTrace.auditSelect = args.select;
        return [];
      },
    },
    payment: {
      findMany: async (args) => {
        if (activityTrace) activityTrace.paymentSelect = args.select;
        return [];
      },
    },
    $queryRaw: async () => 1,
  };
}

function service(prisma, cache = directCache()) {
  return new DashboardService(
    prisma,
    { ping: async () => 'PONG' },
    { listCollections: async () => ({ collections: [] }) },
    cache,
  );
}

function kpiByKey(section) {
  return Object.fromEntries(section.kpis.map((item) => [item.key, item]));
}

test('dashboard range accepts only UTC today, 7d, and 30d', () => {
  const instance = service(zeroPrisma());
  const today = instance.range();
  const sevenDays = instance.range('7d');
  const thirtyDays = instance.range('30d');

  assert.equal(today.key, 'today');
  assert.equal(today.today.getUTCHours(), 0);
  assert.equal(today.today.getUTCMinutes(), 0);
  assert.equal(today.to > today.from, true);
  assert.equal(sevenDays.key, '7d');
  assert.equal(thirtyDays.key, '30d');
  assert.ok(thirtyDays.from < sevenDays.from);
  assert.throws(() => instance.range('90d'), (error) => error.response?.code === 'DASHBOARD_RANGE_INVALID');
  assert.throws(() => instance.range(['today', '7d']), (error) => error.response?.code === 'DASHBOARD_RANGE_INVALID');
});

test('overview KPIs use deterministic aggregate counts and explicit comparison metadata', async () => {
  const counts = [100, 10, 40, 20, 80, 40, 4, 12];
  const instance = service({ ...zeroPrisma(), user: { count: async () => counts.shift(), findMany: async () => [] } });
  const data = await instance.overview(instance.range('7d'));
  const kpis = kpiByKey(data);

  assert.equal(counts.length, 0);
  assert.deepEqual(
    Object.keys(kpis),
    ['total_users', 'active_today', 'active_7_days', 'active_30_days', 'new_users_today', 'new_users_this_month'],
  );
  assert.equal(kpis.total_users.value, 100);
  assert.equal(kpis.active_today.value, 10);
  assert.deepEqual(kpis.active_7_days.change, { absolute: 20, percentage: 100 });
  assert.deepEqual(kpis.active_30_days.change, { absolute: 40, percentage: 100 });
  assert.equal(kpis.new_users_today.value, 4);
  assert.equal(kpis.new_users_this_month.value, 12);
  assert.equal(kpis.active_7_days.period, 'rolling_7_days');
  assert.equal(kpis.active_7_days.definitionKey, 'dashboard.kpi.active7Days');
});

test('plan aggregates have stable FREE/PRO/PRO_MAX rows, active counts, and safe zero-denominator behavior', async () => {
  const prisma = zeroPrisma();
  prisma.user.count = async () => 100;
  prisma.plan.findMany = async () => [
    { id: 'free', slug: 'free' }, { id: 'pro', slug: 'pro' }, { id: 'max', slug: 'pro_max' },
  ];
  prisma.subscription.groupBy = async ({ by }) => by.length === 2
    ? [
      { planId: 'free', status: 'free', _count: { _all: 55 } },
      { planId: 'pro', status: 'active', _count: { _all: 30 } },
      { planId: 'pro', status: 'canceled', _count: { _all: 5 } },
      { planId: 'max', status: 'active', _count: { _all: 5 } },
      // An unknown plan must not leak into the public fixed plan rows.
      { planId: 'retired', status: 'active', _count: { _all: 7 } },
    ]
    : [
      { status: 'free', _count: { _all: 55 } },
      { status: 'active', _count: { _all: 42 } },
      { status: 'canceled', _count: { _all: 5 } },
    ];

  const data = await service(prisma).subscriptions();
  assert.deepEqual(data.items, [
    { plan: 'free', count: 55, percent: 55, active: 0 },
    { plan: 'pro', count: 35, percent: 35, active: 30 },
    { plan: 'pro_max', count: 5, percent: 5, active: 5 },
  ]);
  // Legacy/unknown-plan subscriptions remain accounted for separately rather
  // than being silently shown as one of the three commercial plans.
  assert.equal(data.unassignedUsers, 0);
  assert.equal(data.otherPlanSubscriptions, 7);
  assert.equal(data.states.find((state) => state.state === 'active').count, 42);
  assert.equal(data.states.find((state) => state.state === 'payment_failed').count, 0);

  const empty = await service(zeroPrisma()).subscriptions();
  assert.deepEqual(empty.items.map((item) => item.percent), [null, null, null]);
  assert.deepEqual(empty.items.map((item) => item.count), [0, 0, 0]);
});

test('quota aggregate deduplicates users, uses strongest state, and reports threshold fixture values', async () => {
  const prisma = zeroPrisma();
  prisma.quotaCycle.findMany = async () => [
    {
      userId: 'primary-user',
      accounts: [{ state: 'PRIMARY', primaryLimit: 100, primaryUsed: 70, fallbackLimit: 0, fallbackUsed: 0 }],
    },
    {
      userId: 'fallback-user',
      accounts: [
        { state: 'PRIMARY', primaryLimit: 10, primaryUsed: 0, fallbackLimit: 0, fallbackUsed: 0 },
        { state: 'FALLBACK', primaryLimit: 100, primaryUsed: 85, fallbackLimit: 0, fallbackUsed: 0 },
      ],
    },
    {
      userId: 'blocked-user',
      accounts: [{ state: 'BLOCKED', primaryLimit: 100, primaryUsed: 100, fallbackLimit: 0, fallbackUsed: 0 }],
    },
    {
      userId: 'unmeasured-user',
      accounts: [{ state: 'PRIMARY', primaryLimit: null, primaryUsed: 0, fallbackLimit: 0, fallbackUsed: 0 }],
    },
    // A cycle without accounts is not fabricated as PRIMARY.
    { userId: 'no-account-user', accounts: [] },
  ];

  const data = await service(prisma).quotas(service(prisma).range('30d'));
  assert.deepEqual(data.states, [
    { state: 'PRIMARY', count: 2, percent: 50 },
    { state: 'FALLBACK', count: 1, percent: 25 },
    { state: 'BLOCKED', count: 1, percent: 25 },
  ]);
  assert.deepEqual(data.items, {
    usersInFallback: 1,
    usersBlocked: 1,
    usersAtOrAbove70: 3,
    usersAtOrAbove85: 2,
    usersAtOrAbove95: 1,
    usersWithActiveQuota: 4,
    measuredQuotaAccounts: 4,
  });

  const empty = await service(zeroPrisma()).quotas(service(zeroPrisma()).range('today'));
  assert.deepEqual(empty.states.map((state) => state.count), [0, 0, 0]);
  assert.deepEqual(empty.states.map((state) => state.percent), [null, null, null]);
  assert.equal(empty.items.usersWithActiveQuota, 0);
});

test('empty and partial dependencies retain real zeroes and isolate an unavailable section', async () => {
  const cacheCalls = [];
  const empty = await service(zeroPrisma(), directCache(cacheCalls)).dashboard(adminIdentity, 'today');
  assert.equal(empty.range.key, 'today');
  assert.equal(empty.range.timezone, 'UTC');
  assert.match(empty.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(cacheCalls.length, 1);
  assert.equal(cacheCalls[0].ttl, 30);
  assert.match(cacheCalls[0].key, /^admin:dashboard:v1:all:today:/);
  assert.equal(empty.sections.overview.status, 'available');
  assert.deepEqual(empty.sections.overview.data.kpis.map((item) => item.value), [0, 0, 0, 0, 0, 0]);
  assert.equal(empty.sections.quotas.status, 'available');
  assert.equal(empty.sections.quotas.data.items.usersWithActiveQuota, 0);
  assert.equal(empty.sections.activity.status, 'available');
  assert.deepEqual(empty.sections.activity.data.items, []);

  const partial = await service(zeroPrisma({ failUsage: true })).dashboard(adminIdentity, '7d');
  assert.equal(partial.sections.usage.status, 'error');
  assert.equal(partial.sections.usage.data, null);
  assert.equal(partial.sections.usage.reason, 'UNAVAILABLE');
  assert.equal(partial.sections.overview.status, 'available');
  assert.equal(partial.sections.alerts.status, 'available');
});

test('authenticated admin identity reaches controller only through dashboard.read RBAC', async () => {
  const request = {
    user: { userId: adminIdentity.userId, sessionId: 'session-1', mfaVerifiedAt: new Date() },
  };
  const adminGuard = new AdminGuard({ resolve: async () => adminIdentity }, { get: () => 28_800 });
  assert.equal(await adminGuard.canActivate(executionContext(request)), true);
  assert.deepEqual(request.adminIdentity, adminIdentity);

  const capabilityGuard = new CapabilityGuard({ getAllAndOverride: () => ['dashboard.read'] });
  assert.equal(capabilityGuard.canActivate(executionContext(request)), true);
  assert.throws(
    () => new CapabilityGuard({ getAllAndOverride: () => ['dashboard.read'] }).canActivate(executionContext({ adminIdentity: { capabilities: [] } })),
    (error) => error.response?.code === 'ADMIN_CAPABILITY_DENIED',
  );

  const calls = [];
  const controller = new DashboardController({
    dashboard: async (identity, range) => {
      calls.push({ identity, range });
      return { ok: true };
    },
  });
  assert.deepEqual(await controller.index(request, '30d'), { ok: true });
  assert.deepEqual(calls, [{ identity: adminIdentity, range: '30d' }]);

  await assert.rejects(
    () => new AdminGuard({ resolve: async () => adminIdentity }).canActivate(executionContext({ user: { userId: adminIdentity.userId, mfaVerifiedAt: null } })),
    (error) => error.response?.code === 'ADMIN_MFA_REQUIRED',
  );
});

test('a dashboard-only role receives explicit forbidden section envelopes instead of restricted aggregates', async () => {
  const limitedIdentity = { ...adminIdentity, capabilities: ['dashboard.read'] };
  const response = await service(zeroPrisma()).dashboard(limitedIdentity, 'today');

  assert.equal(response.sections.overview.status, 'available');
  for (const section of ['subscriptions', 'quotas', 'usage', 'learning', 'health', 'incidents', 'security', 'activity']) {
    assert.deepEqual(response.sections[section], {
      status: 'unavailable', data: null, reason: 'FORBIDDEN_SECTION',
    });
  }
  assert.equal(response.sections.alerts.status, 'available');
  assert.equal(response.sections.alerts.data.signals, null);
});

test('dashboard activity is aggregate-only and its Prisma selections exclude learner and payment identifiers', async () => {
  const trace = {};
  const prisma = zeroPrisma({ activityTrace: trace });
  const eventTime = new Date('2026-09-15T10:00:00.000Z');
  prisma.user.findMany = async (args) => {
    trace.registrationSelect = args.select;
    return [{ createdAt: eventTime, email: 'private-learner@example.test' }];
  };
  prisma.auditLog.findMany = async (args) => {
    trace.auditSelect = args.select;
    return [{ action: 'billing.payment_completed', createdAt: eventTime, content: 'private learner content' }];
  };
  prisma.payment.findMany = async (args) => {
    trace.paymentSelect = args.select;
    return [{ createdAt: eventTime, providerRef: 'payment-ref-should-not-escape' }];
  };
  prisma.incident.findMany = async (args) => {
    trace.incidentSelect = args.select;
    return [{ createdAt: eventTime, title: 'private incident title' }];
  };
  prisma.quotaAccount.findMany = async (args) => {
    trace.quotaSelect = args.select;
    return [{ updatedAt: eventTime, userId: 'private-user-id' }];
  };

  const activity = await service(prisma).activity(service(prisma).range('today'));
  assert.deepEqual(trace.registrationSelect, { createdAt: true });
  assert.deepEqual(trace.auditSelect, { action: true, createdAt: true });
  assert.deepEqual(trace.paymentSelect, { createdAt: true });
  assert.deepEqual(trace.incidentSelect, { createdAt: true });
  assert.deepEqual(trace.quotaSelect, { updatedAt: true });
  assert.equal(activity.items.length, 5);
  for (const item of activity.items) {
    assert.deepEqual(Object.keys(item).sort(), ['kind', 'occurredAt', 'source']);
  }
  const payload = JSON.stringify(activity);
  for (const sensitiveValue of [
    'private-learner@example.test', 'private learner content', 'payment-ref-should-not-escape', 'private-user-id',
  ]) {
    assert.equal(payload.includes(sensitiveValue), false);
  }
});

test('admin dashboard frontend is API-backed and contains no fake dashboard metric fixture', () => {
  const adminRoot = path.resolve(__dirname, '../../admin');
  const component = fs.readFileSync(path.join(adminRoot, 'components/ControlDashboard.tsx'), 'utf8');
  const screen = fs.readFileSync(path.join(adminRoot, 'app/(protected)/dashboard.tsx'), 'utf8');
  const transport = fs.readFileSync(path.join(adminRoot, 'lib/dashboard.ts'), 'utf8');
  const shell = fs.readFileSync(path.join(adminRoot, 'components/AdminShell.tsx'), 'utf8');
  const dashboardSources = `${component}\n${screen}\n${transport}`;

  assert.match(component, /api<DashboardResponse>\(`\/admin\/dashboard\?range=\$\{range\}`\)/);
  assert.match(component, /setResponse\(result\)/);
  assert.match(component, /getDashboardSection\(response, key\)/);
  assert.match(component, /'active_7_days'/);
  assert.match(component, /'active_30_days'/);
  assert.match(component, /'state'/);
  assert.match(component, /aria-selected=\{range === option\}/);
  assert.match(component, /function alertLabel/);
  assert.match(component, /healthQdrant/);
  assert.match(component, /securitySuspendedUsers/);
  assert.match(component, /documentPagesResource/);
  assert.match(shell, /accessibilityRole="button"/);
  assert.match(shell, /switchToLightTheme/);
  assert.match(shell, /switchToFrench/);
  assert.match(screen, /ControlDashboard/);
  assert.match(transport, /status: 'unavailable'/);
  assert.doesNotMatch(dashboardSources, /\b(?:fake|mock|fixture|sample|demo)\b/i);
  assert.doesNotMatch(component, /(?:totalUsers|activeToday|active7d|active30d|newUsersToday|newUsersThisMonth)\s*:\s*\d+/);
  assert.doesNotMatch(component, /(?:usersInFallback|usersBlocked|usersAt70|usersAt85|usersAt95)\s*:\s*\d+/);
});
