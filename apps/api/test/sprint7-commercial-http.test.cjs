const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

// Opt-in, read-mostly P1 commercial-control validation.  It only uses the
// pre-existing technical @example.test fixtures, never creates a payment,
// changes a plan, invokes a provider, or prints credentials/response bodies.
const apiBase = (process.env.SPRINT7_COMMERCIAL_API_URL ?? '').replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL ?? '';
const confirmation = process.env.SPRINT7_COMMERCIAL_HTTP_CONFIRM === 'I_UNDERSTAND_STAGING_ONLY';
const password = process.env.P1_BROWSER_PASSWORD;
const totpSecret = process.env.P1_BROWSER_TOTP_SECRET;
const evidenceDirectory = process.env.SPRINT7_COMMERCIAL_EVIDENCE_DIR ?? '';
const runId = safeRunId(process.env.P1_RUN_ID);
const sourceSha = safeSha(process.env.P1_STAGING_SHA);
const stepUpTtlSeconds = Number(process.env.ADMIN_STEP_UP_TTL ?? 600);
const sessionMaxTtlSeconds = Number(process.env.ADMIN_SESSION_MAX_TTL ?? 28_800);
const fixtureEmails = {
  learner: process.env.P1_INFRA_LEARNER_EMAIL,
  superAdmin: process.env.P1_INFRA_SUPER_ADMIN_EMAIL,
  techOps: process.env.P1_INFRA_TECH_OPS_EMAIL,
  support: process.env.P1_INFRA_SUPPORT_EMAIL,
  finance: process.env.P1_INFRA_FINANCE_EMAIL,
};
const fixtureEmailsConfigured = Object.values(fixtureEmails).every(isTechnicalFixtureEmail);
const evidenceDirectoryValid = path.isAbsolute(evidenceDirectory) && path.resolve(evidenceDirectory) === '/p1/evidence';
const enabled = Boolean(
  confirmation
  && /^http:\/\/127\.0\.0\.1:\d+\/api$/u.test(apiBase)
  && /(?:p1|staging|test|sprint)/iu.test(databaseUrl)
  && !/(?:^|[._/-])(prod|production)(?:[._/?-]|$)/iu.test(databaseUrl)
  && password
  && totpSecret
  && fixtureEmailsConfigured
  && evidenceDirectoryValid
  && runId !== 'RUN_ID_NOT_REPORTED'
  && sourceSha !== 'SHA_NOT_REPORTED'
  && Number.isFinite(stepUpTtlSeconds)
  && Number.isFinite(sessionMaxTtlSeconds),
);

const prisma = enabled ? new PrismaClient() : null;
const checks = Object.create(null);
const sessions = [];
let requestSequence = 0;
let financeSessionId;
let financeMfaVerifiedAt;
let financeSessionWasRead = false;

function safeRunId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/u.test(value) ? value : 'RUN_ID_NOT_REPORTED';
}

function safeSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{7,64}$/iu.test(value) ? value : 'SHA_NOT_REPORTED';
}

function isTechnicalFixtureEmail(value) {
  return typeof value === 'string' && /^p1-browser-[a-z0-9-]+@example\.test$/u.test(value);
}

function mark(name, passed) {
  checks[name] = passed === true;
  assert.equal(passed, true, name);
}

function codeOf(payload) {
  if (payload && typeof payload === 'object') {
    const value = payload.code ?? payload.message?.code;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

function safeResponse(value, seen = new Set()) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    return !/(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*=|api[_-]?key\s*=|smtp:\/\/)/iu.test(value);
  }
  if (typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.entries(value).every(([key, child]) => (
    !/^(?:password|passcode|secret|credential|authorization|cookie|connection(?:string)?|database(?:url)?|privateKey|apiKey|accessToken|refreshToken|challengeToken|token)$/iu.test(key)
    && safeResponse(child, seen)
  ));
}

function rowsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function publicPlanPrice(row) {
  const pricing = row?.pricing && typeof row.pricing === 'object' ? row.pricing : row;
  return {
    slug: typeof row?.slug === 'string' ? row.slug : '',
    monthly: numeric(pricing?.priceMonthly),
    yearly: numeric(pricing?.priceYearly),
    currency: typeof pricing?.currency === 'string' ? pricing.currency.toUpperCase() : '',
  };
}

function matchesOfficialPrices(rows) {
  const expected = new Map([
    ['free', [0, 0]],
    ['pro', [499, 4900]],
    ['pro_max', [1500, 15000]],
  ]);
  const prices = new Map(rows.map((row) => {
    const normalized = publicPlanPrice(row);
    return [normalized.slug, normalized];
  }));
  return [...expected].every(([slug, [monthly, yearly]]) => {
    const plan = prices.get(slug);
    return plan?.monthly === monthly && plan?.yearly === yearly && plan.currency === 'USD';
  });
}

function quotaPolicyContract(policy) {
  const serialized = JSON.stringify(policy ?? {});
  const upper = serialized.toUpperCase();
  const paidFallbackFiftyPercent = /(?:"FALLBACKRATIO"\s*:\s*0\.5|50\s*%|50_PERCENT|FIFTY_PERCENT|FIFTY)/u.test(upper);
  return upper.includes('PRIMARY')
    && upper.includes('FALLBACK')
    && upper.includes('BLOCKED')
    && paidFallbackFiftyPercent
    && /OVERAGE[^}]*OFF|"OVERAGE"\s*:\s*"OFF"/u.test(upper)
    && /NEGATIVE[^}]*FORBIDDEN|"NEGATIVEQUOTA"\s*:\s*"FORBIDDEN"/u.test(upper)
    && /AUTOMATIC[^}]*ON|"AUTOMATICRESET"\s*:\s*"ON"/u.test(upper)
    && /HARD[^}]*ON|"HARDSTOP"\s*:\s*"ON"/u.test(upper);
}

function dateOrAbsent(value) {
  return value === undefined || value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
}

function commercialRowsUseDatesOnlyWhenObserved(rows) {
  return rows.every((row) => [
    row?.cycleStart, row?.cycleEnd, row?.nextRenewalAt, row?.cancelAt,
    row?.expiresAt, row?.createdAt, row?.updatedAt, row?.paidAt,
  ].every(dateOrAbsent));
}

function mutationBody(plan) {
  return {
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    expectedVersion: plan.configurationVersion,
    reason: 'Sprint 7 technical step-up rejection validation',
  };
}

function accessSessionId(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  return payload.sessionId;
}

async function request(pathname, { method = 'GET', body, token } = {}) {
  requestSequence += 1;
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `sprint7-commercial-${runId}-${requestSequence}-${randomUUID()}`,
      'user-agent': 'SecondBrain-Sprint7-Commercial-Gate/1.0',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, headers: response.headers, body: payload };
}

async function loginTechnical(email, requiresMfa) {
  const login = await request('/auth/login', { method: 'POST', body: { email, password } });
  mark(`login_${requiresMfa ? 'admin' : 'learner'}_http_200`, login.status === 200);
  if (!requiresMfa) {
    const accessToken = login.body?.tokens?.accessToken;
    const refreshToken = login.body?.tokens?.refreshToken;
    mark('learner_login_contract', login.body?.twoFactorRequired === undefined
      && login.body?.challengeToken === undefined
      && typeof accessToken === 'string'
      && accessToken.length > 0
      && typeof refreshToken === 'string'
      && refreshToken.length > 0);
    const session = { accessToken, refreshToken };
    sessions.push(session);
    return session;
  }

  mark('admin_mfa_challenge_required', login.body?.twoFactorRequired === true && typeof login.body?.challengeToken === 'string');
  const verified = await request('/auth/2fa/verify', {
    method: 'POST',
    body: { challengeToken: login.body?.challengeToken, code: authenticator.generate(totpSecret) },
  });
  const accessToken = verified.body?.tokens?.accessToken;
  const refreshToken = verified.body?.tokens?.refreshToken;
  mark('admin_mfa_verified', verified.status === 200
    && typeof accessToken === 'string' && accessToken.length > 0
    && typeof refreshToken === 'string' && refreshToken.length > 0);
  const session = { accessToken, refreshToken };
  sessions.push(session);
  return session;
}

function assertFixture(rows, email, expectedRole) {
  const user = rows.find((candidate) => candidate.email === email);
  mark(`fixture_${expectedRole ?? 'learner'}_present`, Boolean(user));
  const roles = user.adminRoleAssignments.map((assignment) => assignment.role).sort();
  if (expectedRole) {
    mark(`fixture_${expectedRole}_mfa`, user.twoFactorEnabled === true);
    mark(`fixture_${expectedRole}_role`, JSON.stringify(roles) === JSON.stringify([expectedRole]));
  } else {
    mark('fixture_learner_not_admin', user.twoFactorEnabled === false && roles.length === 0);
  }
  return user;
}

function writeEvidence(status) {
  if (!evidenceDirectoryValid) throw new Error('SPRINT7_COMMERCIAL_EVIDENCE_DIRECTORY_INVALID');
  const destination = path.join(evidenceDirectory, `sprint7-commercial-http-${runId}.json`);
  if (path.dirname(destination) !== path.resolve(evidenceDirectory)) throw new Error('SPRINT7_COMMERCIAL_EVIDENCE_PATH_INVALID');
  fs.writeFileSync(destination, JSON.stringify({
    gate: 'SPRINT7_COMMERCIAL_HTTP',
    status,
    runId,
    sourceSha,
    checks,
  }), { mode: 0o600, flag: 'wx' });
}

test('Sprint 7 commercial control is catalog-consistent, safe, RBAC-gated, and requires MFA step-up for pricing', {
  skip: !enabled && 'set confirmed P1 loopback, technical-fixture, evidence, and staging-only environment variables',
}, async () => {
  let result = 'FAIL';
  try {
    await prisma.$connect();
    const fixtureRows = await prisma.user.findMany({
      where: { email: { in: Object.values(fixtureEmails) }, emailVerified: true, accountStatus: 'active' },
      select: { id: true, email: true, twoFactorEnabled: true, adminRoleAssignments: { where: { revokedAt: null }, select: { role: true } } },
    });
    const learner = assertFixture(fixtureRows, fixtureEmails.learner, null);
    const superAdmin = assertFixture(fixtureRows, fixtureEmails.superAdmin, 'SUPER_ADMIN');
    const techOps = assertFixture(fixtureRows, fixtureEmails.techOps, 'TECH_OPS');
    const support = assertFixture(fixtureRows, fixtureEmails.support, 'SUPPORT');
    const finance = assertFixture(fixtureRows, fixtureEmails.finance, 'FINANCE');
    mark('technical_fixture_manifest_verified', true);

    const unauthenticated = await request('/admin/commercial/overview');
    mark('commercial_overview_unauthenticated_denied', unauthenticated.status === 401);

    const [learnerSession, superAdminSession, techOpsSession, supportSession, financeSession] = await Promise.all([
      loginTechnical(learner.email, false),
      loginTechnical(superAdmin.email, true),
      loginTechnical(techOps.email, true),
      loginTechnical(support.email, true),
      loginTechnical(finance.email, true),
    ]);

    const [userPlans, learnerDenied, financeOverview, financePlans, financeSubscriptions, financePayments, financeUsage, financeAudit,
      financeFeaturesDenied, financeSettingsDenied, supportSubscriptions, supportPricingDenied, techOpsFeatures, techOpsPricingDenied,
      superOverview, superPlans, superSubscriptions, superPayments, superUsage, superFeatures, superSettings, superAudit,
    ] = await Promise.all([
      request('/plans', { token: learnerSession.accessToken }),
      request('/admin/commercial/overview', { token: learnerSession.accessToken }),
      request('/admin/commercial/overview', { token: financeSession.accessToken }),
      request('/admin/commercial/plans', { token: financeSession.accessToken }),
      request('/admin/commercial/subscriptions', { token: financeSession.accessToken }),
      request('/admin/commercial/payments', { token: financeSession.accessToken }),
      request('/admin/commercial/usage', { token: financeSession.accessToken }),
      request('/admin/commercial/audit', { token: financeSession.accessToken }),
      request('/admin/commercial/features', { token: financeSession.accessToken }),
      request('/admin/commercial/settings', { token: financeSession.accessToken }),
      request('/admin/commercial/subscriptions', { token: supportSession.accessToken }),
      request('/admin/commercial/plans/pro/pricing', { method: 'PUT', token: supportSession.accessToken, body: { expectedVersion: 1 } }),
      request('/admin/commercial/features', { token: techOpsSession.accessToken }),
      request('/admin/commercial/plans/pro/pricing', { method: 'PUT', token: techOpsSession.accessToken, body: { expectedVersion: 1 } }),
      request('/admin/commercial/overview', { token: superAdminSession.accessToken }),
      request('/admin/commercial/plans', { token: superAdminSession.accessToken }),
      request('/admin/commercial/subscriptions', { token: superAdminSession.accessToken }),
      request('/admin/commercial/payments', { token: superAdminSession.accessToken }),
      request('/admin/commercial/usage', { token: superAdminSession.accessToken }),
      request('/admin/commercial/features', { token: superAdminSession.accessToken }),
      request('/admin/commercial/settings', { token: superAdminSession.accessToken }),
      request('/admin/commercial/audit', { token: superAdminSession.accessToken }),
    ]);

    mark('user_plan_catalog_available', userPlans.status === 200 && Array.isArray(userPlans.body));
    mark('learner_commercial_admin_denied', learnerDenied.status === 403);
    mark('finance_commercial_reads_allowed', [financeOverview, financePlans, financeSubscriptions, financePayments, financeUsage, financeAudit]
      .every((response) => response.status === 200));
    mark('finance_feature_and_settings_denied', financeFeaturesDenied.status === 403 && financeSettingsDenied.status === 403);
    mark('support_subscription_read_only', supportSubscriptions.status === 200 && supportPricingDenied.status === 403);
    mark('tech_ops_feature_read_only', techOpsFeatures.status === 200 && techOpsPricingDenied.status === 403);
    mark('super_admin_all_commercial_reads_allowed', [superOverview, superPlans, superSubscriptions, superPayments, superUsage, superFeatures, superSettings, superAudit]
      .every((response) => response.status === 200));
    mark('commercial_cache_control_no_store', [financeOverview, financePlans, financeSubscriptions, financePayments, financeUsage, financeAudit, superSettings]
      .every((response) => response.headers.get('cache-control') === 'no-store'));
    mark('commercial_responses_redacted', [financeOverview, financePlans, financeSubscriptions, financePayments, financeUsage, financeAudit,
      techOpsFeatures, superOverview, superPlans, superSubscriptions, superPayments, superUsage, superFeatures, superSettings, superAudit]
      .every((response) => safeResponse(response.body)));

    const userPlanRows = rowsOf(userPlans.body);
    const financePlanRows = rowsOf(financePlans.body);
    const superPlanRows = rowsOf(superPlans.body);
    mark('official_prices_user_catalog', matchesOfficialPrices(userPlanRows));
    mark('official_prices_admin_catalog', matchesOfficialPrices(financePlanRows) && matchesOfficialPrices(superPlanRows));
    const userPricing = JSON.stringify(userPlanRows.filter((row) => ['free', 'pro', 'pro_max'].includes(row.slug)).map(publicPlanPrice).sort((a, b) => a.slug.localeCompare(b.slug)));
    const financePricing = JSON.stringify(financePlanRows.filter((row) => ['free', 'pro', 'pro_max'].includes(row.slug)).map(publicPlanPrice).sort((a, b) => a.slug.localeCompare(b.slug)));
    mark('user_and_admin_catalog_pricing_identical', userPricing === financePricing);

    mark('commercial_overview_contract', financeOverview.body?.activePricing !== undefined
      && financeOverview.body?.quotaPolicy !== undefined
      && financeOverview.body?.capabilities !== undefined);
    mark('quota_policy_primary_fallback_blocked', quotaPolicyContract(financeOverview.body?.quotaPolicy));
    mark('subscription_dates_observed_or_absent', commercialRowsUseDatesOnlyWhenObserved(rowsOf(financeSubscriptions.body)));
    mark('payment_dates_observed_or_absent', commercialRowsUseDatesOnlyWhenObserved(rowsOf(financePayments.body)));
    mark('usage_rows_present_or_explicitly_empty', Array.isArray(rowsOf(financeUsage.body)));
    mark('feature_targeting_unavailable_is_explicit', /NOT_SUPPORTED/u.test(JSON.stringify(techOpsFeatures.body)));
    mark('settings_do_not_expose_runtime_secrets', safeResponse(superSettings.body));

    const databasePlans = await prisma.plan.findMany({
      where: { slug: { in: ['free', 'pro', 'pro_max'] } },
      select: { id: true, slug: true, priceMonthly: true, priceYearly: true, currency: true, fallbackRatio: true, configurationVersion: true },
    });
    mark('official_prices_persisted_in_authoritative_catalog', matchesOfficialPrices(databasePlans));
    mark('paid_fallback_ratio_persisted', databasePlans
      .filter((plan) => plan.slug === 'pro' || plan.slug === 'pro_max')
      .every((plan) => plan.fallbackRatio === 0.5));
    mark('free_has_no_fallback', databasePlans.find((plan) => plan.slug === 'free')?.fallbackRatio === 0);
    const changedPaidPlanIds = new Set(databasePlans
      .filter((plan) => plan.slug === 'pro' || plan.slug === 'pro_max')
      .map((plan) => plan.id));
    const officialPricingAudit = await prisma.auditLog.findMany({
      where: { action: 'plan.pricing.activate_sprint7', targetType: 'Plan', targetId: { in: [...changedPaidPlanIds] } },
      select: { action: true, targetId: true, result: true, before: true, after: true, reason: true, createdAt: true },
    });
    mark('official_pricing_migration_audited', officialPricingAudit.length === 2
      && new Set(officialPricingAudit.map((entry) => entry.targetId)).size === 2
      && officialPricingAudit.every((entry) => changedPaidPlanIds.has(entry.targetId ?? ''))
      && officialPricingAudit.every((entry) => entry.result === 'success'
        && entry.reason === 'Sprint 7 official pricing activation'
        && safeResponse(entry.before) && safeResponse(entry.after)
        && entry.createdAt instanceof Date));

    const pro = financePlanRows.find((plan) => plan.slug === 'pro');
    mark('admin_plan_configuration_version_present', Number.isInteger(pro?.configurationVersion) && pro.configurationVersion > 0);
    mark('step_up_ttl_is_shorter_than_session_ttl', sessionMaxTtlSeconds > stepUpTtlSeconds + 2);
    financeSessionId = accessSessionId(financeSession.accessToken);
    const financeSessionBefore = await prisma.session.findUniqueOrThrow({
      where: { id: financeSessionId },
      select: { mfaVerifiedAt: true },
    });
    financeMfaVerifiedAt = financeSessionBefore.mfaVerifiedAt;
    financeSessionWasRead = true;
    await prisma.session.update({
      where: { id: financeSessionId },
      data: { mfaVerifiedAt: new Date(Date.now() - (stepUpTtlSeconds + 2) * 1000) },
    });
    const pricingBefore = await prisma.plan.findUniqueOrThrow({
      where: { slug: 'pro' },
      select: { priceMonthly: true, priceYearly: true, configurationVersion: true },
    });
    const stepUpDenied = await request('/admin/commercial/plans/pro/pricing', {
      method: 'PUT', token: financeSession.accessToken, body: mutationBody(pro),
    });
    mark('pricing_mutation_requires_step_up', stepUpDenied.status === 403 && codeOf(stepUpDenied.body) === 'ADMIN_STEP_UP_REQUIRED');
    const stepUp = await request('/auth/2fa/step-up', {
      method: 'POST', token: financeSession.accessToken, body: { code: authenticator.generate(totpSecret) },
    });
    mark('finance_step_up_accepted', stepUp.status === 200);
    // A deliberately non-integer optimistic version proves that the request
    // reaches backend validation after step-up without changing plan data.
    const invalidAfterStepUp = await request('/admin/commercial/plans/pro/pricing', {
      method: 'PUT', token: financeSession.accessToken,
      body: { ...mutationBody(pro), expectedVersion: 'not-an-integer' },
    });
    mark('pricing_backend_validation_after_step_up', invalidAfterStepUp.status === 400);
    const pricingAfter = await prisma.plan.findUniqueOrThrow({
      where: { slug: 'pro' },
      select: { priceMonthly: true, priceYearly: true, configurationVersion: true },
    });
    mark('step_up_validation_does_not_mutate_pricing', JSON.stringify(pricingAfter) === JSON.stringify(pricingBefore));
    const financeInfrastructureDenied = await request('/admin/infrastructure?range=now', { token: financeSession.accessToken });
    mark('finance_does_not_administrate_infrastructure', financeInfrastructureDenied.status === 403);

    result = 'PASS';
  } finally {
    // The sole test-local DB write ages the fresh technical FINANCE session to
    // exercise the step-up guard. Restore it before logout so an interrupted
    // gate never leaves altered authentication state behind.
    if (financeSessionId && financeSessionWasRead) {
      await prisma?.session.update({
        where: { id: financeSessionId },
        data: { mfaVerifiedAt: financeMfaVerifiedAt },
      }).catch(() => undefined);
    }
    for (const session of sessions) {
      await request('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined);
    }
    await prisma?.$disconnect();
    writeEvidence(result);
  }
});
