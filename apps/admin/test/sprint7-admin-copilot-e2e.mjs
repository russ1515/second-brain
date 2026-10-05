import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';
import { chromium } from 'playwright';

// Opt-in P1 evidence gate. It only uses pre-existing technical fixtures on
// loopback. It never creates a provider call, performs an Admin mutation, or
// stores a prompt, answer, credential, token, or correlation identifier.
const adminBase = loopbackOrigin(process.env.P1_ADMIN_BASE, 'P1_ADMIN_BASE');
const apiBase = loopbackApi(process.env.P1_API_BASE, 'P1_API_BASE');
const password = required(process.env.P1_BROWSER_PASSWORD, 'P1_BROWSER_PASSWORD');
const superAdmin = technical(process.env.P1_INFRA_SUPER_ADMIN_EMAIL ?? process.env.P1_SUPER_ADMIN_EMAIL, 'P1_SUPER_ADMIN_EMAIL', 'superadmin');
const finance = technical(process.env.P1_INFRA_FINANCE_EMAIL ?? process.env.P1_FINANCE_EMAIL, 'P1_FINANCE_EMAIL', 'finance');
const superTotp = required(process.env.P1_BROWSER_TOTP_SECRET, 'P1_BROWSER_TOTP_SECRET');
const financeTotp = required(process.env.P1_FINANCE_TOTP_SECRET ?? process.env.P1_BROWSER_TOTP_SECRET, 'P1_FINANCE_TOTP_SECRET');
const runId = safeId(process.env.P1_RUN_ID);
const sourceSha = safeSha(process.env.P1_STAGING_SHA);
const evidenceDirectory = process.env.SPRINT7_COPILOT_E2E_EVIDENCE_DIR ?? '';
const checks = [];
let currentCheck = 'INITIALIZATION';
let browser;
let financeProbe = null;

function required(value, name) {
  assert.ok(typeof value === 'string' && value.length > 0, `${name}_REQUIRED`);
  return value;
}

function technical(value, name, role) {
  assert.equal(value, `p1-browser-${role}@example.test`, `${name}_MUST_BE_TECHNICAL_FIXTURE`);
  return value;
}

function safeId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/u.test(value) ? value : null;
}

function safeSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{7,64}$/iu.test(value) ? value : null;
}

function loopbackOrigin(value, name) {
  assert.ok(typeof value === 'string', `${name}_REQUIRED`);
  const url = new URL(value);
  assert.equal(url.protocol, 'http:', `${name}_MUST_USE_HTTP_LOOPBACK`);
  assert.equal(url.hostname, '127.0.0.1', `${name}_MUST_USE_IPV4_LOOPBACK`);
  assert.ok(/^[1-9][0-9]{0,4}$/u.test(url.port), `${name}_PORT_REQUIRED`);
  assert.ok(url.pathname === '' || url.pathname === '/', `${name}_PATH_NOT_ALLOWED`);
  return url.origin;
}

function loopbackApi(value, name) {
  const origin = loopbackOrigin(String(value ?? '').replace(/\/api\/?$/u, '/'), name);
  const url = new URL(value);
  assert.equal(url.pathname.replace(/\/+$/u, ''), '/api', `${name}_MUST_END_IN_API`);
  return `${origin}/api`;
}

function record(name) {
  checks.push({ name, status: 'PASS' });
}

function evidencePath() {
  return path.join('/p1/evidence', `sprint7-admin-copilot-e2e-${runId}.json`);
}

function writeEvidence(status, failureCheck = null) {
  mkdirSync('/p1/evidence', { recursive: true, mode: 0o700 });
  writeFileSync(evidencePath(), JSON.stringify({
    gate: 'SPRINT7_ADMIN_COPILOT_E2E', status, runId, sourceSha, failureCheck,
    checks, financeProbe, providerCalls: 'NONE', mutations: 'NONE', promptsStored: false,
  }), { mode: 0o600, flag: 'wx' });
}

function safeResponse(value, seen = new Set()) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    return !/(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*[=:]|api[_ -]?key\s*[=:]|smtp:\/\/|eyJ[A-Za-z0-9_-]{8,}\.)/iu.test(value);
  }
  if (typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.entries(value).every(([key, item]) => !/(?:password|passcode|secret|token|credential|authorization|cookie|connection(?:string)?|database(?:url)?|privateKey|apiKey|accessToken|refreshToken|challengeToken)$/iu.test(key) && safeResponse(item, seen));
}

function assertAllowedLoopback(url) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'http:', 'BROWSER_REQUEST_PROTOCOL_MUST_BE_HTTP_LOOPBACK');
  assert.equal(parsed.hostname, '127.0.0.1', 'BROWSER_REQUEST_HOST_MUST_BE_LOOPBACK');
  assert.ok([new URL(adminBase).port, new URL(apiBase).port].includes(parsed.port), 'BROWSER_REQUEST_PORT_NOT_ALLOWED');
}

function isAdminApiResponse(response, pathname, method) {
  const url = new URL(response.url());
  return url.protocol === 'http:'
    && url.hostname === '127.0.0.1'
    && [new URL(adminBase).port, new URL(apiBase).port].includes(url.port)
    && url.pathname === `/api${pathname}`
    && response.request().method() === method;
}

async function restrictNetwork(page) {
  await page.route('**/*', async (route) => {
    try {
      assertAllowedLoopback(route.request().url());
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) assertAllowedLoopback(frame.url());
  });
}

async function login(page, email, totp) {
  await page.goto(`${adminBase}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse((response) => isAdminApiResponse(response, '/auth/login', 'POST'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal((await loginResponse).status(), 200, 'ADMIN_LOGIN_STATUS');
  await page.getByLabel('Authentication code').fill(authenticator.generate(totp));
  const verified = page.waitForResponse((response) => isAdminApiResponse(response, '/auth/2fa/verify', 'POST'));
  await page.getByRole('button', { name: 'Verify MFA', exact: true }).click();
  assert.equal((await verified).status(), 200, 'ADMIN_MFA_STATUS');
  await page.waitForURL(/\/dashboard(?:\?.*)?$/u);
}

async function openCopilot(page) {
  await page.getByRole('button', { name: 'Admin Copilot', exact: true }).click();
  await page.waitForURL(/\/copilot(?:\?.*)?$/u);
  // The protected shell may prefetch this read-only route while the dashboard
  // mounts. Refresh after navigation so the assertion always observes the
  // concrete browser request, not a race with that harmless prefetch.
  const capabilities = page.waitForResponse((response) => isAdminApiResponse(response, '/admin/copilot/capabilities', 'GET'));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  const response = await capabilities;
  assert.equal(response.status(), 200, 'COPILOT_CAPABILITIES_STATUS');
  assert.equal(response.headers()['cache-control'], 'no-store', 'COPILOT_CAPABILITIES_NO_STORE');
  return response.json();
}

async function ask(page, query) {
  const response = page.waitForResponse((candidate) => isAdminApiResponse(candidate, '/admin/copilot/query', 'POST'));
  await page.getByLabel('Ask a grounded operational question').fill(query);
  await page.getByRole('button', { name: 'Ask Copilot', exact: true }).click();
  const result = await response;
  assert.equal(result.status(), 200, 'COPILOT_QUERY_STATUS');
  assert.equal(result.headers()['cache-control'], 'no-store', 'COPILOT_QUERY_NO_STORE');
  return result.json();
}

async function main() {
  assert.ok(runId, 'P1_RUN_ID_REQUIRED');
  assert.ok(sourceSha, 'P1_STAGING_SHA_REQUIRED');
  assert.equal(path.resolve(evidenceDirectory), '/p1/evidence', 'SPRINT7_COPILOT_E2E_EVIDENCE_DIR_MUST_BE_P1_EVIDENCE');
  browser = await chromium.launch({ headless: true });
  const unexpectedActions = [];
  try {
    currentCheck = 'SUPER_ADMIN_REAL_SOURCES';
    const superPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    superPage.setDefaultTimeout(20_000);
    await restrictNetwork(superPage);
    superPage.on('request', (request) => {
      const pathname = new URL(request.url()).pathname;
      if (/(?:\/actions?|\/execute|\/mutations?|\/pricing|\/feature-flags?)/iu.test(pathname)) unexpectedActions.push(pathname);
    });
    await login(superPage, superAdmin, superTotp);
    const capabilities = await openCopilot(superPage);
    assert.equal(capabilities.readOnly, true, 'COPILOT_CAPABILITIES_READ_ONLY');
    assert.equal(capabilities.mode, 'READ_ANALYZE_EXPLAIN_RECOMMEND', 'COPILOT_CAPABILITIES_MODE');
    assert.ok(Array.isArray(capabilities.availableTools), 'COPILOT_AVAILABLE_TOOLS');
    const health = await ask(superPage, 'Quels services sont dégradés ?');
    assert.ok(safeResponse(health), 'COPILOT_HEALTH_RESPONSE_REDACTED');
    assert.ok(Array.isArray(health.sources) && health.sources.some((source) => source.kind === 'system_health'), 'COPILOT_REAL_SYSTEM_HEALTH_SOURCE');
    assert.equal(health.trace?.provider, 'NOT_CONFIGURED', 'COPILOT_NO_UNAUTHORIZED_PROVIDER_CALL');
    assert.equal(health.trace?.costStatus, 'NOT_INSTRUMENTED', 'COPILOT_COST_STATUS_EXPLICIT');
    await superPage.getByText('System Health', { exact: false }).first().waitFor();
    const code = await ask(superPage, 'Quelle route API gère la réservation de quota ?');
    assert.ok(safeResponse(code), 'COPILOT_CODE_RESPONSE_REDACTED');
    assert.ok(Array.isArray(code.sources) && code.sources.some((source) => source.kind === 'repository' && source.status === 'AVAILABLE'), 'COPILOT_READ_ONLY_CODE_SOURCE');
    const proposal = await ask(superPage, 'Veuillez suspendre ce compte utilisateur.');
    assert.ok(safeResponse(proposal), 'COPILOT_PROPOSAL_RESPONSE_REDACTED');
    assert.equal(proposal.status, 'PROPOSAL_ONLY', 'COPILOT_ACTION_IS_PROPOSAL_ONLY');
    assert.equal(proposal.proposal?.status, 'HUMAN_CONFIRMATION_REQUIRED', 'COPILOT_ACTION_REQUIRES_HUMAN_CONFIRMATION');
    assert.deepEqual(unexpectedActions, [], 'COPILOT_MUST_NOT_CALL_AN_ACTION_ENDPOINT');
    await superPage.close();
    record(currentCheck);

    currentCheck = 'FINANCE_RBAC_LEAST_PRIVILEGE';
    const financePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    financePage.setDefaultTimeout(20_000);
    await restrictNetwork(financePage);
    await login(financePage, finance, financeTotp);
    await openCopilot(financePage);
    const denied = await ask(financePage, 'Quels services sont dégradés ?');
    financeProbe = {
      status: typeof denied.status === 'string' ? denied.status : null,
      sources: Array.isArray(denied.sources)
        ? denied.sources.slice(0, 4).map((source) => ({
          kind: typeof source.kind === 'string' ? source.kind : null,
          status: typeof source.status === 'string' ? source.status : null,
        }))
        : [],
    };
    assert.ok(safeResponse(denied), 'COPILOT_DENIAL_RESPONSE_REDACTED');
    assert.equal(denied.status, 'ACCESS_DENIED', 'COPILOT_FINANCE_CANNOT_READ_INFRASTRUCTURE');
    assert.ok(denied.sources?.some((source) => source.status === 'ACCESS_DENIED'), 'COPILOT_DENIAL_SOURCE_EXPLICIT');
    record(currentCheck);

    currentCheck = 'FINANCE_MOBILE_LAYOUT';
    const layout = await financePage.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: window.innerWidth }));
    assert.ok(layout.html <= layout.viewport + 1 && layout.body <= layout.viewport + 1, 'COPILOT_MOBILE_LAYOUT_OVERFLOW');
    await financePage.close();
    record(currentCheck);
  } finally {
    if (browser) await browser.close();
    browser = undefined;
  }
}

main().then(() => {
  writeEvidence('PASS');
  process.stdout.write('SPRINT7_ADMIN_COPILOT_E2E_PASS\n');
}).catch(async () => {
  checks.push({ name: currentCheck, status: 'FAIL' });
  if (browser) await browser.close().catch(() => undefined);
  try { writeEvidence('FAIL', currentCheck); } catch { /* Fail closed without overwriting prior evidence. */ }
  process.stdout.write(`SPRINT7_ADMIN_COPILOT_E2E_FAIL:${currentCheck}\n`);
  process.exitCode = 1;
});
