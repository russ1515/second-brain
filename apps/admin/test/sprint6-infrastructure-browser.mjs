import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';
import { chromium } from 'playwright';

// Opt-in P1 staging browser gate. It accepts only a private technical fixture
// and local loopback endpoints. It never prints or persists credentials,
// tokens, TOTP values, request bodies, or response bodies.
const adminBase = localOrigin(process.env.P1_ADMIN_BASE, 'P1_ADMIN_BASE');
const apiBase = localApiBase(process.env.P1_API_BASE);
const email = process.env.P1_SUPER_ADMIN_EMAIL;
const password = process.env.P1_BROWSER_PASSWORD;
const totpSecret = process.env.P1_BROWSER_TOTP_SECRET;
const runId = safeIdentifier(process.env.P1_RUN_ID);
const sourceSha = safeSha(process.env.P1_STAGING_SHA);
const evidenceDirectory = process.env.SPRINT6_INFRA_EVIDENCE_DIR ?? '';
const checks = [];
let currentCheck = 'INITIALIZATION';
let browser;

function safeIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/u.test(value) ? value : null;
}

function safeSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{7,64}$/iu.test(value) ? value : null;
}

function localOrigin(value, name) {
  assert.ok(typeof value === 'string', `${name}_REQUIRED`);
  const url = new URL(value);
  assert.equal(url.protocol, 'http:', `${name}_MUST_USE_HTTP_LOOPBACK`);
  assert.equal(url.hostname, '127.0.0.1', `${name}_MUST_USE_IPV4_LOOPBACK`);
  assert.ok(/^[1-9][0-9]{0,4}$/u.test(url.port), `${name}_PORT_REQUIRED`);
  assert.ok(url.pathname === '/' || url.pathname === '', `${name}_PATH_NOT_ALLOWED`);
  assert.equal(url.search, '', `${name}_QUERY_NOT_ALLOWED`);
  assert.equal(url.hash, '', `${name}_FRAGMENT_NOT_ALLOWED`);
  return url.origin;
}

function localApiBase(value) {
  assert.ok(typeof value === 'string', 'P1_API_BASE_REQUIRED');
  const url = new URL(value);
  assert.equal(url.protocol, 'http:', 'P1_API_BASE_MUST_USE_HTTP_LOOPBACK');
  assert.equal(url.hostname, '127.0.0.1', 'P1_API_BASE_MUST_USE_IPV4_LOOPBACK');
  assert.ok(/^[1-9][0-9]{0,4}$/u.test(url.port), 'P1_API_BASE_PORT_REQUIRED');
  assert.equal(url.pathname.replace(/\/+$/, ''), '/api', 'P1_API_BASE_MUST_END_IN_API');
  assert.equal(url.search, '', 'P1_API_BASE_QUERY_NOT_ALLOWED');
  assert.equal(url.hash, '', 'P1_API_BASE_FRAGMENT_NOT_ALLOWED');
  return url.toString().replace(/\/$/u, '');
}

function assertTechnicalSuperAdmin(value) {
  assert.ok(typeof value === 'string' && /^p1-browser-superadmin@example\.test$/u.test(value), 'P1_SUPER_ADMIN_EMAIL_MUST_BE_TECHNICAL_FIXTURE');
}

function assertGateInputs() {
  assertTechnicalSuperAdmin(email);
  assert.ok(typeof password === 'string' && password.length > 0, 'P1_BROWSER_PASSWORD_REQUIRED');
  assert.ok(typeof totpSecret === 'string' && totpSecret.length > 0, 'P1_BROWSER_TOTP_SECRET_REQUIRED');
  assert.ok(runId, 'P1_RUN_ID_REQUIRED');
  assert.ok(sourceSha, 'P1_STAGING_SHA_REQUIRED');
  assert.equal(path.resolve(evidenceDirectory), '/p1/evidence', 'SPRINT6_INFRA_EVIDENCE_DIR_MUST_BE_P1_EVIDENCE');
}

function record(name) {
  checks.push({ name, status: 'PASS' });
}

function invalidTotpCode(validCode) {
  return `${validCode[0] === '9' ? '0' : String(Number(validCode[0]) + 1)}${validCode.slice(1)}`;
}

function evidencePath() {
  assert.ok(runId, 'P1_RUN_ID_REQUIRED');
  return path.join('/p1/evidence', `sprint6-infrastructure-browser-${runId}.json`);
}

function writeEvidence(status, failureCheck = null) {
  mkdirSync('/p1/evidence', { recursive: true, mode: 0o700 });
  writeFileSync(evidencePath(), JSON.stringify({
    gate: 'SPRINT6_INFRASTRUCTURE_BROWSER',
    status,
    runId,
    sourceSha,
    failureCheck,
    checks,
  }), { mode: 0o600, flag: 'wx' });
}

function responseIsRedacted(value, seen = new Set()) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    return !/(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*=|api[_-]?key\s*=|eyJ[A-Za-z0-9_-]{8,}\.)/iu.test(value);
  }
  if (typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.values(value).every((child) => responseIsRedacted(child, seen));
}

function expectedNonObservedRow(overview) {
  const componentIndex = (overview?.components ?? []).findIndex((item) => item?.dataStatus === 'NOT_INSTRUMENTED' || item?.dataStatus === 'UNKNOWN');
  if (componentIndex >= 0) {
    return { selector: `system-health-component-${String(overview.components[componentIndex].key).toUpperCase()}`, status: overview.components[componentIndex].dataStatus };
  }
  const providerIndex = (overview?.providers ?? []).findIndex((item) => item?.dataStatus === 'NOT_INSTRUMENTED' || item?.dataStatus === 'UNKNOWN');
  if (providerIndex >= 0) return { selector: `system-health-provider-${providerIndex}`, status: overview.providers[providerIndex].dataStatus };
  if (overview?.resources?.dataStatus === 'NOT_INSTRUMENTED' || overview?.resources?.dataStatus === 'UNKNOWN') {
    return { selector: 'system-health-resources', status: overview.resources.dataStatus };
  }
  return null;
}

function assertLoopbackRequest(url) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'http:', 'BROWSER_REQUEST_PROTOCOL_MUST_BE_HTTP_LOOPBACK');
  assert.equal(parsed.hostname, '127.0.0.1', 'BROWSER_REQUEST_HOST_MUST_BE_LOOPBACK');
  assert.ok([new URL(adminBase).port, new URL(apiBase).port].includes(parsed.port), 'BROWSER_REQUEST_PORT_NOT_ALLOWED');
}

async function restrictNetwork(page) {
  await page.route('**/*', async (route) => {
    try {
      assertLoopbackRequest(route.request().url());
      await route.continue();
    } catch {
      await route.abort('blockedbyclient');
    }
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) assertLoopbackRequest(frame.url());
  });
}

async function startMfaLogin(page) {
  await page.goto(`${adminBase}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse((response) => response.url() === `${apiBase}/auth/login` && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal((await loginResponse).status(), 200);
  await page.getByLabel('Authentication code').waitFor();
}

async function requestWithSession(page, pathname, accessToken, body) {
  return page.evaluate(async ({ base, requestPath, token, requestBody }) => {
    const response = await fetch(`${base}${requestPath}`, {
      method: requestBody === undefined ? 'GET' : 'POST',
      headers: {
        ...(requestBody === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Request-Id': crypto.randomUUID(),
      },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    });
    return response.status;
  }, { base: apiBase, requestPath: pathname, token: accessToken, requestBody: body });
}

async function main() {
  assertGateInputs();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(20_000);
  await restrictNetwork(page);
  try {
    currentCheck = 'WRONG_TOTP_REJECTED';
    await startMfaLogin(page);
    await page.getByLabel('Authentication code').fill(invalidTotpCode(authenticator.generate(totpSecret)));
    const wrongTotpResponse = page.waitForResponse((response) => response.url() === `${apiBase}/auth/2fa/verify` && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Verify MFA', exact: true }).click();
    const wrongStatus = (await wrongTotpResponse).status();
    assert.ok(wrongStatus === 401 || wrongStatus === 403, 'WRONG_TOTP_MUST_BE_401_OR_403');
    record(currentCheck);

    currentCheck = 'SUPER_ADMIN_MFA_AND_SESSION';
    await startMfaLogin(page);
    await page.getByLabel('Authentication code').fill(authenticator.generate(totpSecret));
    const verified = page.waitForResponse((response) => response.url() === `${apiBase}/auth/2fa/verify` && response.request().method() === 'POST');
    const sessionResponse = page.waitForResponse((response) => response.url() === `${apiBase}/admin/session` && response.request().method() === 'GET');
    await page.getByRole('button', { name: 'Verify MFA', exact: true }).click();
    const verification = await verified;
    assert.equal(verification.status(), 200);
    const tokens = await verification.json();
    assert.equal(typeof tokens?.tokens?.accessToken, 'string', 'MFA_ACCESS_TOKEN_REQUIRED');
    assert.equal(typeof tokens?.tokens?.refreshToken, 'string', 'MFA_REFRESH_TOKEN_REQUIRED');
    const identity = await (await sessionResponse).json();
    assert.ok(identity?.identity?.roles?.includes('SUPER_ADMIN'), 'SUPER_ADMIN_SESSION_ROLE_REQUIRED');
    await page.waitForURL(/\/dashboard(?:\?.*)?$/u);
    record(currentCheck);

    currentCheck = 'INFRASTRUCTURE_ROUTE_AND_REDACTION';
    const infrastructureResponse = page.waitForResponse((response) => response.url() === `${apiBase}/admin/infrastructure?range=now` && response.request().method() === 'GET');
    await page.getByRole('button', { name: 'Infrastructure', exact: true }).focus();
    await page.getByRole('button', { name: 'Infrastructure', exact: true }).press('Enter');
    await page.waitForURL(/\/infrastructure(?:\?.*)?$/u);
    const response = await infrastructureResponse;
    assert.equal(response.status(), 200);
    const overview = await response.json();
    assert.ok(Array.isArray(overview?.components) && Array.isArray(overview?.providers) && Array.isArray(overview?.alerts));
    assert.ok(responseIsRedacted(overview), 'INFRASTRUCTURE_RESPONSE_MUST_BE_REDACTED');
    await page.getByRole('heading', { name: 'System health', exact: true }).waitFor();
    await page.getByRole('radiogroup', { name: 'Observation window' }).waitFor();
    record(currentCheck);

    currentCheck = 'UNKNOWN_NOT_INSTRUMENTED_PRESERVED';
    const nonObservedRow = expectedNonObservedRow(overview);
    assert.ok(nonObservedRow, 'EXPECTED_NOT_INSTRUMENTED_OR_UNKNOWN_STATE');
    const row = page.getByTestId(nonObservedRow.selector);
    await row.getByText(nonObservedRow.status, { exact: true }).waitFor();
    const visibleText = await page.locator('body').innerText();
    assert.doesNotMatch(visibleText, /(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*=|api[_-]?key\s*=)/iu);
    record(currentCheck);

    currentCheck = 'RANGE_RESPONSIVE_I18N_A11Y';
    const rangeResponse = page.waitForResponse((candidate) => candidate.url() === `${apiBase}/admin/infrastructure?range=1h` && candidate.request().method() === 'GET');
    await page.getByRole('radio', { name: '1 hour', exact: true }).press('Enter');
    assert.equal((await rangeResponse).status(), 200);
    await page.getByRole('button', { name: 'Switch to French', exact: true }).click();
    await page.getByRole('heading', { name: 'Santé système', exact: true }).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const layout = await page.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: window.innerWidth }));
    assert.ok(layout.html <= layout.viewport + 1 && layout.body <= layout.viewport + 1, 'RESPONSIVE_HORIZONTAL_OVERFLOW');
    record(currentCheck);

    currentCheck = 'LOGOUT_INVALIDATES_SERVER_SESSION';
    const logoutResponse = page.waitForResponse((candidate) => candidate.url() === `${apiBase}/auth/logout-all` && candidate.request().method() === 'POST');
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    assert.equal((await logoutResponse).status(), 204);
    await page.waitForURL(/\/login(?:\?.*)?$/u);
    const [oldAccessStatus, oldRefreshStatus] = await Promise.all([
      requestWithSession(page, '/admin/session', tokens.tokens.accessToken),
      requestWithSession(page, '/auth/refresh', null, { refreshToken: tokens.tokens.refreshToken }),
    ]);
    assert.ok(oldAccessStatus === 401 || oldAccessStatus === 403, 'LOGOUT_OLD_ACCESS_TOKEN_MUST_BE_DENIED');
    assert.ok(oldRefreshStatus === 401 || oldRefreshStatus === 403, 'LOGOUT_OLD_REFRESH_TOKEN_MUST_BE_DENIED');
    record(currentCheck);
  } finally {
    await browser.close();
    browser = undefined;
  }
}

main().then(() => {
  writeEvidence('PASS');
  process.stdout.write('SPRINT6_INFRASTRUCTURE_BROWSER_PASS\n');
}).catch(async () => {
  checks.push({ name: currentCheck, status: 'FAIL' });
  if (browser) await browser.close().catch(() => undefined);
  try { writeEvidence('FAIL', currentCheck); } catch { /* Evidence collisions fail closed without overwriting. */ }
  process.stdout.write(`SPRINT6_INFRASTRUCTURE_BROWSER_FAIL:${currentCheck}\n`);
  process.exitCode = 1;
});
