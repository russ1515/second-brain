const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

// Opt-in, bounded P1 gate for the actual Copilot API. It uses only technical
// fixtures and read-only questions. It never invokes a provider or an Admin
// mutation, and evidence contains check names only—never prompts or replies.
const apiBase = String(process.env.SPRINT7_COPILOT_API_URL ?? '').replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL ?? '';
const enabled = process.env.SPRINT7_COPILOT_HTTP_CONFIRM === 'I_UNDERSTAND_STAGING_ONLY'
  && /^http:\/\/127\.0\.0\.1:\d+\/api$/u.test(apiBase)
  && /(?:p1|staging|test|sprint)/iu.test(databaseUrl)
  && !/(?:^|[._/-])(prod|production)(?:[._/?-]|$)/iu.test(databaseUrl)
  && typeof process.env.P1_BROWSER_PASSWORD === 'string'
  && typeof process.env.P1_BROWSER_TOTP_SECRET === 'string'
  && path.resolve(process.env.SPRINT7_COPILOT_EVIDENCE_DIR ?? '') === '/p1/evidence'
  && safeId(process.env.P1_RUN_ID)
  && safeSha(process.env.P1_STAGING_SHA);

const fixture = {
  learner: process.env.P1_INFRA_LEARNER_EMAIL,
  superAdmin: process.env.P1_INFRA_SUPER_ADMIN_EMAIL,
  finance: process.env.P1_INFRA_FINANCE_EMAIL,
};
const fixturesValid = Object.values(fixture).every((value, index) => value === [
  'p1-browser-learner@example.test',
  'p1-browser-superadmin@example.test',
  'p1-browser-finance@example.test',
][index]);
const prisma = enabled && fixturesValid ? new PrismaClient() : null;
const checks = Object.create(null);
const sessions = [];
let sequence = 0;

function safeId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/u.test(value) ? value : null; }
function safeSha(value) { return typeof value === 'string' && /^[a-f0-9]{7,64}$/iu.test(value) ? value : null; }
function mark(name, passed) { checks[name] = passed === true; assert.equal(passed, true, name); }
function codeOf(value) { return typeof value?.code === 'string' ? value.code : typeof value?.message?.code === 'string' ? value.message.code : undefined; }

function safeResponse(value, seen = new Set()) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return !/(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*[=:]|api[_ -]?key\s*[=:]|smtp:\/\/|eyJ[A-Za-z0-9_-]{8,}\.)/iu.test(value);
  if (typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.entries(value).every(([key, child]) => !/^(?:password|passcode|secret|credential|authorization|cookie|connection(?:string)?|database(?:url)?|privateKey|apiKey|accessToken|refreshToken|challengeToken|token)$/iu.test(key) && safeResponse(child, seen));
}

async function request(pathname, { method = 'GET', body, token } = {}) {
  sequence += 1;
  const response = await fetch(`${apiBase}${pathname}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': `sprint7-copilot-${safeId(process.env.P1_RUN_ID)}-${sequence}-${randomUUID()}`,
      'user-agent': 'SecondBrain-Sprint7-Copilot-Gate/1.0',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, headers: response.headers, body: response.status === 204 ? undefined : await response.json().catch(() => undefined) };
}

async function login(email, mfa) {
  const password = process.env.P1_BROWSER_PASSWORD;
  const response = await request('/auth/login', { method: 'POST', body: { email, password } });
  mark(`login_${mfa ? 'admin' : 'learner'}_${email.split('@')[0]}`, response.status === 200);
  if (!mfa) {
    const session = { accessToken: response.body?.tokens?.accessToken, refreshToken: response.body?.tokens?.refreshToken };
    mark('learner_login_contract', response.body?.twoFactorRequired === undefined && response.body?.challengeToken === undefined && typeof session.accessToken === 'string' && typeof session.refreshToken === 'string');
    sessions.push(session);
    return session;
  }
  mark(`mfa_challenge_${email.split('@')[0]}`, response.body?.twoFactorRequired === true && typeof response.body?.challengeToken === 'string');
  const verified = await request('/auth/2fa/verify', { method: 'POST', body: { challengeToken: response.body?.challengeToken, code: authenticator.generate(process.env.P1_BROWSER_TOTP_SECRET) } });
  const session = { accessToken: verified.body?.tokens?.accessToken, refreshToken: verified.body?.tokens?.refreshToken };
  mark(`mfa_verified_${email.split('@')[0]}`, verified.status === 200 && typeof session.accessToken === 'string' && typeof session.refreshToken === 'string');
  sessions.push(session);
  return session;
}

function evidencePath() { return path.join('/p1/evidence', `sprint7-admin-copilot-http-${safeId(process.env.P1_RUN_ID)}.json`); }
function writeEvidence(status) {
  fs.writeFileSync(evidencePath(), JSON.stringify({
    gate: 'SPRINT7_ADMIN_COPILOT_HTTP', status, runId: safeId(process.env.P1_RUN_ID), sourceSha: safeSha(process.env.P1_STAGING_SHA),
    checks, providerCalls: 'NONE', mutations: 'NONE', promptStored: false,
  }), { mode: 0o600, flag: 'wx' });
}

test('Sprint 7 Admin Copilot is real-source, read-only, RBAC-bound, audited and redacted', {
  skip: !(enabled && fixturesValid) && 'requires confirmed P1-only loopback, technical fixtures and evidence directory',
}, async () => {
  let result = 'FAIL';
  try {
    await prisma.$connect();
    const unauthenticated = await request('/admin/copilot/capabilities');
    mark('copilot_unauthenticated_denied', unauthenticated.status === 401);
    const [learner, superAdmin, finance] = await Promise.all([
      login(fixture.learner, false), login(fixture.superAdmin, true), login(fixture.finance, true),
    ]);
    const [learnerDenied, superCapabilities, financeCapabilities] = await Promise.all([
      request('/admin/copilot/capabilities', { token: learner.accessToken }),
      request('/admin/copilot/capabilities', { token: superAdmin.accessToken }),
      request('/admin/copilot/capabilities', { token: finance.accessToken }),
    ]);
    mark('learner_copilot_admin_denied', learnerDenied.status === 403);
    mark('super_admin_copilot_capabilities', superCapabilities.status === 200 && superCapabilities.headers.get('cache-control') === 'no-store' && superCapabilities.body?.readOnly === true && superCapabilities.body?.mode === 'READ_ANALYZE_EXPLAIN_RECOMMEND');
    mark('finance_copilot_capabilities', financeCapabilities.status === 200 && financeCapabilities.body?.readOnly === true);
    mark('capabilities_redacted', safeResponse(superCapabilities.body) && safeResponse(financeCapabilities.body));

    const runId = safeId(process.env.P1_RUN_ID);
    const healthConversation = `s7copilot-health-${runId}`;
    const codeConversation = `s7copilot-code-${runId}`;
    const proposalConversation = `s7copilot-proposal-${runId}`;
    const redactConversation = `s7copilot-redact-${runId}`;
    const [health, financeHealth, code, proposal, redacted] = await Promise.all([
      request('/admin/copilot/query', { method: 'POST', token: superAdmin.accessToken, body: { conversationId: healthConversation, query: 'Quels services sont dégradés ?' } }),
      request('/admin/copilot/query', { method: 'POST', token: finance.accessToken, body: { conversationId: `s7copilot-finance-${runId}`, query: 'Quels services sont dégradés ?' } }),
      request('/admin/copilot/query', { method: 'POST', token: superAdmin.accessToken, body: { conversationId: codeConversation, query: 'Quelle route API gère la réservation de quota ?' } }),
      request('/admin/copilot/query', { method: 'POST', token: superAdmin.accessToken, body: { conversationId: proposalConversation, query: 'Veuillez suspendre ce compte utilisateur.' } }),
      request('/admin/copilot/query', { method: 'POST', token: superAdmin.accessToken, body: { conversationId: redactConversation, query: 'api_key=synthetic_redaction_probe' } }),
    ]);
    mark('copilot_queries_http_and_no_store', [health, financeHealth, code, proposal, redacted].every((response) => response.status === 200 && response.headers.get('cache-control') === 'no-store'));
    mark('copilot_health_real_source', health.body?.sources?.some((source) => source.kind === 'system_health') && health.body?.trace?.provider === 'NOT_CONFIGURED' && health.body?.trace?.costStatus === 'NOT_INSTRUMENTED');
    mark('copilot_code_read_only_source', code.body?.sources?.some((source) => source.kind === 'repository' && source.status === 'AVAILABLE'));
    mark('copilot_finance_least_privilege', financeHealth.body?.status === 'ACCESS_DENIED' && financeHealth.body?.sources?.some((source) => source.status === 'ACCESS_DENIED'));
    mark('copilot_action_is_proposal_only', proposal.body?.status === 'PROPOSAL_ONLY' && proposal.body?.proposal?.status === 'HUMAN_CONFIRMATION_REQUIRED');
    mark('copilot_sensitive_prompt_redacted', redacted.body?.status === 'REDACTED' && Array.isArray(redacted.body?.sources) && redacted.body.sources.length === 0);
    mark('copilot_query_responses_redacted', [health, financeHealth, code, proposal, redacted].every((response) => safeResponse(response.body)));

    const audit = await prisma.auditLog.findMany({
      where: { action: 'admin.copilot.query', targetType: 'AdminCopilotConversation', targetId: { in: [healthConversation, codeConversation, proposalConversation, redactConversation] } },
      select: { metadata: true, reason: true, before: true, after: true },
    });
    mark('copilot_queries_audited_without_prompt', audit.length === 4 && audit.every((entry) => entry.metadata?.source === 'ADMIN_COPILOT' && entry.metadata?.promptStored === false && entry.reason === null && entry.before === null && entry.after === null && safeResponse(entry.metadata)));
    result = 'PASS';
  } finally {
    for (const session of sessions) await request('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } }).catch(() => undefined);
    await prisma?.$disconnect();
    writeEvidence(result);
  }
});
