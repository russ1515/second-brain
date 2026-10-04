const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

// Opt-in staging contract test. It reuses only technical @example.test fixtures
// provisioned by the private P1 harness. It never creates users, changes roles,
// invokes a provider, prints credentials, or writes response bodies.
const apiBase = (process.env.SPRINT6_INFRA_API_URL ?? '').replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL ?? '';
const confirmation = process.env.SPRINT6_INFRA_HTTP_CONFIRM === 'I_UNDERSTAND_STAGING_ONLY';
const password = process.env.P1_BROWSER_PASSWORD;
const totpSecret = process.env.P1_BROWSER_TOTP_SECRET;
const evidenceDirectory = process.env.SPRINT6_INFRA_EVIDENCE_DIR ?? '';
const runId = safeRunId(process.env.P1_RUN_ID);
const sourceSha = safeSha(process.env.P1_STAGING_SHA);
const fixtureEmails = {
  learner: process.env.P1_INFRA_LEARNER_EMAIL,
  superAdmin: process.env.P1_INFRA_SUPER_ADMIN_EMAIL,
  techOps: process.env.P1_INFRA_TECH_OPS_EMAIL,
  support: process.env.P1_INFRA_SUPPORT_EMAIL,
  finance: process.env.P1_INFRA_FINANCE_EMAIL,
};
const fixtureEmailsConfigured = Object.values(fixtureEmails).every((email) => isTechnicalFixtureEmail(email));
const evidenceDirectoryValid = path.isAbsolute(evidenceDirectory) && path.resolve(evidenceDirectory) === '/p1/evidence';
const enabled = Boolean(
  confirmation
  && /^http:\/\/127\.0\.0\.1:\d+\/api$/u.test(apiBase)
  && /(?:p1|staging|test|sprint)/iu.test(databaseUrl)
  && !/(?:^|[._/-])(prod|production)(?:[._/?-]|$)/iu.test(databaseUrl)
  && password
  && totpSecret
  && runId !== 'RUN_ID_NOT_REPORTED'
  && sourceSha !== 'SHA_NOT_REPORTED'
  && fixtureEmailsConfigured
  && evidenceDirectoryValid,
);

const checks = Object.create(null);
const sessions = [];
const prisma = enabled ? new PrismaClient() : null;
let requestSequence = 0;
let observedCorrelationCount = 0;

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

async function request(pathname, { method = 'GET', body, token } = {}) {
  requestSequence += 1;
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `sprint6-infra-${runId}-${requestSequence}-${randomUUID()}`,
      'user-agent': 'SecondBrain-Sprint6-Infrastructure-Gate/1.0',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, headers: response.headers, body: payload };
}

function invalidTotpCode(validCode) {
  return `${validCode[0] === '9' ? '0' : String(Number(validCode[0]) + 1)}${validCode.slice(1)}`;
}

async function loginTechnical(email, requireMfa, verifyWrongTotp = false) {
  const login = await request('/auth/login', { method: 'POST', body: { email, password } });
  mark(`login_${requireMfa ? 'admin' : 'learner'}_http_200`, login.status === 200);

  if (!requireMfa) {
    const accessToken = login.body?.tokens?.accessToken;
    const refreshToken = login.body?.tokens?.refreshToken;
    mark('learner_no_mfa_contract', login.body?.twoFactorRequired === undefined && login.body?.challengeToken === undefined);
    mark('learner_tokens_present', typeof accessToken === 'string' && accessToken.length > 0 && typeof refreshToken === 'string' && refreshToken.length > 0);
    const session = { accessToken, refreshToken };
    sessions.push(session);
    return session;
  }

  mark('admin_mfa_challenge_required', login.body?.twoFactorRequired === true && typeof login.body?.challengeToken === 'string');
  if (verifyWrongTotp) {
    const wrong = await request('/auth/2fa/verify', {
      method: 'POST', body: { challengeToken: login.body.challengeToken, code: invalidTotpCode(authenticator.generate(totpSecret)) },
    });
    mark('wrong_totp_rejected', wrong.status === 401 || wrong.status === 403);
    // A rejected code may consume the challenge, so begin a fresh MFA flow.
    return loginTechnical(email, true, false);
  }

  const verified = await request('/auth/2fa/verify', {
    method: 'POST', body: { challengeToken: login.body.challengeToken, code: authenticator.generate(totpSecret) },
  });
  const accessToken = verified.body?.tokens?.accessToken;
  const refreshToken = verified.body?.tokens?.refreshToken;
  mark('correct_totp_accepted', verified.status === 200 && typeof accessToken === 'string' && accessToken.length > 0 && typeof refreshToken === 'string' && refreshToken.length > 0);
  const session = { accessToken, refreshToken };
  sessions.push(session);
  return session;
}

function assertFixture(rows, email, expectedRole) {
  const user = rows.find((candidate) => candidate.email === email);
  assert.ok(user, 'TECHNICAL_FIXTURE_MISSING');
  const roles = user.adminRoleAssignments.map((assignment) => assignment.role).sort();
  if (expectedRole) {
    assert.equal(user.twoFactorEnabled, true, 'TECHNICAL_ADMIN_MFA_REQUIRED');
    assert.deepEqual(roles, [expectedRole], 'TECHNICAL_FIXTURE_ROLE_MISMATCH');
  } else {
    assert.equal(user.twoFactorEnabled, false, 'TECHNICAL_LEARNER_MFA_MUST_BE_DISABLED');
    assert.deepEqual(roles, [], 'TECHNICAL_LEARNER_MUST_NOT_HAVE_ADMIN_ROLE');
  }
  return user;
}

function scanResponse(value, seen = new Set()) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    return !/(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*=|api[_-]?key\s*=)/iu.test(value);
  }
  if (typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.entries(value).every(([key, child]) => (
    !/^(?:password|passcode|secret|credential|authorization|cookie|connection(?:string)?|database(?:url)?|privateKey|apiKey|accessToken|refreshToken|challengeToken|token)$/iu.test(key)
    && scanResponse(child, seen)
  ));
}

function coreComponentsHealthy(overview) {
  const components = new Map((overview?.components ?? []).map((component) => [component?.key, component]));
  return ['api', 'postgresql', 'redis', 'qdrant'].every((key) => (
    components.get(key)?.status === 'HEALTHY' && components.get(key)?.dataStatus === 'OBSERVED'
  ));
}

function observedResourceContract(resources) {
  const values = [
    resources?.host?.uptimeSeconds, resources?.host?.cpuCores,
    resources?.host?.memoryAvailableBytes, resources?.host?.diskAvailableBytes,
    resources?.containers?.total, resources?.containers?.running,
    resources?.containers?.unhealthy, resources?.containers?.restarting,
  ];
  return resources?.dataStatus === 'OBSERVED' && values.every((value) => Number.isFinite(value) && value >= 0);
}

function writeEvidence(status) {
  if (!evidenceDirectoryValid) throw new Error('SPRINT6_INFRA_EVIDENCE_DIRECTORY_INVALID');
  const file = path.join(evidenceDirectory, `sprint6-infrastructure-http-${runId}.json`);
  if (path.dirname(file) !== path.resolve(evidenceDirectory)) throw new Error('SPRINT6_INFRA_EVIDENCE_PATH_INVALID');
  fs.writeFileSync(file, JSON.stringify({
    gate: 'SPRINT6_INFRASTRUCTURE_HTTP',
    status,
    runId,
    sourceSha,
    checks,
    correlationCount: observedCorrelationCount,
  }), { mode: 0o600, flag: 'wx' });
}

test('Sprint 6 Infrastructure HTTP route is MFA/RBAC-protected, read-only, and redacted', {
  skip: !enabled && 'set confirmed P1 loopback variables, SHA/run ID, and private P1 technical fixture manifest values',
}, async () => {
  let result = 'FAIL';
  try {
    const publicHealth = await request('/health');
    mark('public_health_real_dependencies', publicHealth.status === 200
      && publicHealth.body?.status === 'ok'
      && ['postgres', 'redis', 'qdrant'].every((key) => publicHealth.body?.info?.[key]?.status === 'up'));
    const unauthenticated = await request('/admin/infrastructure?range=now');
    mark('unauthenticated_denied', unauthenticated.status === 401);

    const users = await prisma.user.findMany({
      where: { email: { in: Object.values(fixtureEmails) }, emailVerified: true, accountStatus: 'active' },
      select: { email: true, twoFactorEnabled: true, adminRoleAssignments: { where: { revokedAt: null }, select: { role: true } } },
    });
    const learner = assertFixture(users, fixtureEmails.learner, null);
    const superAdmin = assertFixture(users, fixtureEmails.superAdmin, 'SUPER_ADMIN');
    const techOps = assertFixture(users, fixtureEmails.techOps, 'TECH_OPS');
    const support = assertFixture(users, fixtureEmails.support, 'SUPPORT');
    const finance = assertFixture(users, fixtureEmails.finance, 'FINANCE');
    mark('technical_fixture_manifest_verified', true);

    const learnerSession = await loginTechnical(learner.email, false);
    const supportSession = await loginTechnical(support.email, true);
    const financeSession = await loginTechnical(finance.email, true);
    const techOpsSession = await loginTechnical(techOps.email, true);
    const superAdminSession = await loginTechnical(superAdmin.email, true, true);
    const readOnlyCountsBefore = await Promise.all([
      prisma.providerUsageOperation.count(), prisma.providerUsageAttempt.count(),
      prisma.errorEvent.count(), prisma.bugGroup.count(), prisma.incident.count(),
    ]);

    const [learnerDenied, supportDenied, financeDenied, techOpsAllowed, superAdminAllowed, invalidRange] = await Promise.all([
      request('/admin/infrastructure?range=now', { token: learnerSession.accessToken }),
      request('/admin/infrastructure?range=now', { token: supportSession.accessToken }),
      request('/admin/infrastructure?range=now', { token: financeSession.accessToken }),
      request('/admin/infrastructure?range=1h', { token: techOpsSession.accessToken }),
      request('/admin/infrastructure?range=24h', { token: superAdminSession.accessToken }),
      request('/admin/infrastructure?range=30d', { token: superAdminSession.accessToken }),
    ]);
    mark('learner_denied', learnerDenied.status === 403);
    mark('support_denied', supportDenied.status === 403);
    mark('finance_denied', financeDenied.status === 403);
    mark('tech_ops_allowed', techOpsAllowed.status === 200);
    mark('super_admin_allowed', superAdminAllowed.status === 200);
    mark('invalid_range_rejected', invalidRange.status === 400);
    mark('cache_control_no_store', techOpsAllowed.headers.get('cache-control') === 'no-store');
    mark('response_redacted', scanResponse(techOpsAllowed.body) && scanResponse(superAdminAllowed.body));
    mark('response_has_observation_contract', Array.isArray(techOpsAllowed.body?.components) && Array.isArray(techOpsAllowed.body?.providers) && Array.isArray(techOpsAllowed.body?.alerts));
    mark('overall_and_core_components_healthy', techOpsAllowed.body?.overall?.status === 'HEALTHY' && techOpsAllowed.body?.overall?.dataStatus === 'OBSERVED' && coreComponentsHealthy(techOpsAllowed.body));
    const smtp = techOpsAllowed.body?.components?.find((component) => component?.key === 'smtp');
    mark('smtp_fresh_verification_observed', smtp?.status === 'HEALTHY' && smtp?.dataStatus === 'OBSERVED' && typeof smtp?.observedAt === 'string');
    mark('resource_snapshot_observed', observedResourceContract(techOpsAllowed.body?.resources));
    mark('performance_contract_preserves_not_instrumented_history', techOpsAllowed.body?.performance?.currentProcess?.scope === 'CURRENT_PROCESS_ONLY'
      && techOpsAllowed.body?.performance?.selectedRange?.httpErrorRate === null
      && techOpsAllowed.body?.performance?.selectedRange?.slowRequests === null);
    mark('alert_states_visible_without_auto_remediation', techOpsAllowed.body?.alerts?.some((alert) => alert?.key === 'http_error_rate_threshold' && alert?.state === 'BUSINESS_DECISION_REQUIRED')
      && techOpsAllowed.body?.alerts?.some((alert) => alert?.key === 'latency_threshold' && alert?.state === 'BUSINESS_DECISION_REQUIRED'));
    observedCorrelationCount = Array.isArray(techOpsAllowed.body?.correlations) ? techOpsAllowed.body.correlations.length : 0;
    mark('incident_correlation_contract_redacted', Array.isArray(techOpsAllowed.body?.correlations) && scanResponse(techOpsAllowed.body.correlations));
    const infrastructureReadAudits = await prisma.auditLog.findMany({
      where: {
        action: 'infrastructure.overview.read',
        requestId: { startsWith: `sprint6-infra-${runId}-` },
      },
      select: { action: true, targetType: true, targetId: true, result: true, metadata: true },
    });
    mark('infrastructure_reads_audited', infrastructureReadAudits.length >= 2 && infrastructureReadAudits.every((entry) => (
      entry.action === 'infrastructure.overview.read'
      && entry.targetType === 'Infrastructure'
      && entry.targetId === 'system-health'
      && entry.result === 'success'
      && typeof entry.metadata === 'object'
      && entry.metadata !== null
    )));
    const readOnlyCountsAfter = await Promise.all([
      prisma.providerUsageOperation.count(), prisma.providerUsageAttempt.count(),
      prisma.errorEvent.count(), prisma.bugGroup.count(), prisma.incident.count(),
    ]);
    mark('read_only_durable_ledgers_unchanged', JSON.stringify(readOnlyCountsBefore) === JSON.stringify(readOnlyCountsAfter));

    const logout = await request('/auth/logout', { method: 'POST', body: { refreshToken: superAdminSession.refreshToken } });
    const [oldAccessDenied, oldRefreshDenied] = await Promise.all([
      request('/admin/infrastructure?range=now', { token: superAdminSession.accessToken }),
      request('/auth/refresh', { method: 'POST', body: { refreshToken: superAdminSession.refreshToken } }),
    ]);
    mark('logout_session_invalidated', logout.status === 204 && (oldAccessDenied.status === 401 || oldAccessDenied.status === 403) && (oldRefreshDenied.status === 401 || oldRefreshDenied.status === 403));

    result = 'PASS';
  } finally {
    for (const session of sessions) {
      await request('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined);
    }
    await prisma?.$disconnect();
    writeEvidence(result);
  }
});
