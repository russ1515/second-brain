import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';
import { chromium } from 'playwright';

// Opt-in UI gate for the read-only Admin Copilot. The two Copilot responses
// are browser-local fixtures: no provider call, mutation or secret is sent.
const adminBase = localOrigin(process.env.P1_ADMIN_BASE, 'P1_ADMIN_BASE');
const apiBase = localApiBase(process.env.P1_API_BASE);
const email = technical(process.env.P1_SUPER_ADMIN_EMAIL, 'P1_SUPER_ADMIN_EMAIL');
const password = required(process.env.P1_BROWSER_PASSWORD, 'P1_BROWSER_PASSWORD');
const totpSecret = required(process.env.P1_BROWSER_TOTP_SECRET, 'P1_BROWSER_TOTP_SECRET');
const runId = safeIdentifier(process.env.P1_RUN_ID); const sourceSha = safeSha(process.env.P1_STAGING_SHA); const evidenceDirectory = process.env.SPRINT7_COPILOT_EVIDENCE_DIR ?? '';
const checks = []; let currentCheck = 'INITIALIZATION'; let browser;

function required(value, name) { assert.ok(typeof value === 'string' && value.length > 0, `${name}_REQUIRED`); return value; }
function safeIdentifier(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/u.test(value) ? value : null; }
function safeSha(value) { return typeof value === 'string' && /^[a-f0-9]{7,64}$/iu.test(value) ? value : null; }
function technical(value, name) { assert.ok(typeof value === 'string' && value === 'p1-browser-superadmin@example.test', `${name}_MUST_BE_TECHNICAL_FIXTURE`); return value; }
function localOrigin(value, name) { assert.ok(typeof value === 'string', `${name}_REQUIRED`); const url = new URL(value); assert.equal(url.protocol, 'http:', `${name}_MUST_USE_HTTP_LOOPBACK`); assert.equal(url.hostname, '127.0.0.1', `${name}_MUST_USE_IPV4_LOOPBACK`); assert.ok(/^[1-9][0-9]{0,4}$/u.test(url.port), `${name}_PORT_REQUIRED`); assert.ok(url.pathname === '/' || url.pathname === '', `${name}_PATH_NOT_ALLOWED`); return url.origin; }
function localApiBase(value) { assert.ok(typeof value === 'string', 'P1_API_BASE_REQUIRED'); const url = new URL(value); assert.equal(url.protocol, 'http:', 'P1_API_BASE_MUST_USE_HTTP_LOOPBACK'); assert.equal(url.hostname, '127.0.0.1', 'P1_API_BASE_MUST_USE_IPV4_LOOPBACK'); assert.equal(url.pathname.replace(/\/+$/, ''), '/api', 'P1_API_BASE_MUST_END_IN_API'); return url.toString().replace(/\/$/u, ''); }
function record(name) { checks.push({ name, status: 'PASS' }); }
function evidencePath() { return path.join('/p1/evidence', `sprint7-admin-copilot-browser-${runId}.json`); }
function writeEvidence(status, failureCheck = null) { mkdirSync('/p1/evidence', { recursive: true, mode: 0o700 }); writeFileSync(evidencePath(), JSON.stringify({ gate: 'SPRINT7_ADMIN_COPILOT_BROWSER', status, runId, sourceSha, failureCheck, checks, readOnly: true }), { mode: 0o600, flag: 'wx' }); }
function assertLoopback(url) { const parsed = new URL(url); assert.equal(parsed.protocol, 'http:', 'BROWSER_REQUEST_PROTOCOL_MUST_BE_HTTP_LOOPBACK'); assert.equal(parsed.hostname, '127.0.0.1', 'BROWSER_REQUEST_HOST_MUST_BE_LOOPBACK'); assert.ok([new URL(adminBase).port, new URL(apiBase).port].includes(parsed.port), 'BROWSER_REQUEST_PORT_NOT_ALLOWED'); }
async function restrictNetwork(page) { await page.route('**/*', async (route) => { try { assertLoopback(route.request().url()); await route.continue(); } catch { await route.abort('blockedbyclient'); } }); page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) assertLoopback(frame.url()); }); }
async function login(page) { await page.goto(`${adminBase}/login`, { waitUntil: 'networkidle' }); await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(password); const loginResponse = page.waitForResponse((response) => response.url() === `${apiBase}/auth/login` && response.request().method() === 'POST'); await page.getByRole('button', { name: 'Continue', exact: true }).click(); assert.equal((await loginResponse).status(), 200); await page.getByLabel('Authentication code').fill(authenticator.generate(totpSecret)); const verified = page.waitForResponse((response) => response.url() === `${apiBase}/auth/2fa/verify` && response.request().method() === 'POST'); await page.getByRole('button', { name: 'Verify MFA', exact: true }).click(); assert.equal((await verified).status(), 200); await page.waitForURL(/\/dashboard(?:\?.*)?$/u); }

async function main() {
  assert.ok(runId, 'P1_RUN_ID_REQUIRED'); assert.ok(sourceSha, 'P1_STAGING_SHA_REQUIRED'); assert.equal(path.resolve(evidenceDirectory), '/p1/evidence', 'SPRINT7_COPILOT_EVIDENCE_DIR_MUST_BE_P1_EVIDENCE');
  // The compact shell intentionally collapses its sidebar. Navigate through
  // the desktop control, then resize to verify the Copilot itself at mobile
  // width rather than treating a hidden navigation control as a UI failure.
  browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(20_000); await restrictNetwork(page);
  let queryRequests = 0; const unexpectedActions = [];
  page.on('request', (request) => { const pathname = new URL(request.url()).pathname; if (/(?:\/actions?|\/execute|\/mutations?|\/pricing|\/feature-flags?)/iu.test(pathname)) unexpectedActions.push(pathname); });
  await page.route(`${apiBase}/admin/copilot/capabilities`, async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'AVAILABLE' }) }));
  await page.route(`${apiBase}/admin/copilot/query`, async (route) => { queryRequests += 1; assert.equal(route.request().method(), 'POST'); const body = JSON.parse(route.request().postData() ?? '{}'); assert.equal(typeof body.query, 'string'); assert.ok(body.query.length > 0); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ conversationId: 'sprint7-copilot-test', answer: 'Evidence remains UNKNOWN until instrumentation confirms it.', status: 'UNKNOWN', sources: [{ kind: 'AUDIT_LOG', label: 'Synthetic proof', status: 'NOT_INSTRUMENTED' }], proposal: { status: 'BUSINESS_DECISION_REQUIRED', reason: 'Human review is required.' }, trace: { provider: 'NOT_CONFIGURED', model: 'NOT_AVAILABLE', costStatus: 'NOT_INSTRUMENTED', correlation: 'sprint7-test-correlation' } }) }); });
  try {
    currentCheck = 'READ_ONLY_COPILOT_RENDER'; await login(page); await page.getByRole('button', { name: 'Admin Copilot', exact: true }).click(); await page.waitForURL(/\/copilot(?:\?.*)?$/u); await page.getByRole('heading', { name: 'Admin Copilot', exact: true }).waitFor(); await page.getByText('READ ONLY — no client-side action execution', { exact: true }).waitFor(); record(currentCheck);
    currentCheck = 'EVIDENCE_STATUS_AND_NO_ACTION'; await page.getByLabel('Ask a grounded operational question').fill('What evidence is currently available?'); await page.getByRole('button', { name: 'Ask Copilot', exact: true }).click(); await page.getByText('Evidence remains UNKNOWN until instrumentation confirms it.', { exact: true }).waitFor(); for (const value of ['UNKNOWN', 'NOT_CONFIGURED', 'NOT_INSTRUMENTED', 'NOT_AVAILABLE', 'BUSINESS_DECISION_REQUIRED']) await page.getByText(value, { exact: true }).first().waitFor(); await page.getByText('Proposal recorded for human review only. No action was executed.', { exact: true }).waitFor(); assert.equal(queryRequests, 1, 'COPILOT_QUERY_COUNT'); assert.deepEqual(unexpectedActions, [], 'COPILOT_MUST_NOT_EXECUTE_ACTIONS'); record(currentCheck);
    currentCheck = 'RESPONSIVE_I18N_A11Y'; await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Switch to French', exact: true }).click(); await page.getByRole('heading', { name: 'Copilot Admin', exact: true }).waitFor(); assert.equal(await page.locator('html').getAttribute('lang'), 'fr'); const layout = await page.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: window.innerWidth })); assert.ok(layout.html <= layout.viewport + 1 && layout.body <= layout.viewport + 1, 'COPILOT_RESPONSIVE_OVERFLOW'); record(currentCheck);
  } finally { await browser.close(); browser = undefined; }
}

main().then(() => { writeEvidence('PASS'); process.stdout.write('SPRINT7_ADMIN_COPILOT_BROWSER_PASS\n'); }).catch(async () => { checks.push({ name: currentCheck, status: 'FAIL' }); if (browser) await browser.close().catch(() => undefined); try { writeEvidence('FAIL', currentCheck); } catch { /* Evidence collisions fail closed. */ } process.stdout.write(`SPRINT7_ADMIN_COPILOT_BROWSER_FAIL:${currentCheck}\n`); process.exitCode = 1; });
