import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { authenticator } from 'otplib';
import { chromium } from 'playwright';

// Opt-in P1 commercial browser gate. It uses only technical fixtures over
// loopback, never logs browser credentials/tokens, and never submits a
// commercial mutation. Pricing step-up/validation is covered by the API gate.
const adminBase = localOrigin(process.env.P1_ADMIN_BASE, 'P1_ADMIN_BASE');
const apiBase = localApiBase(process.env.P1_API_BASE);
const password = required(process.env.P1_BROWSER_PASSWORD, 'P1_BROWSER_PASSWORD');
const superAdmin = technical(process.env.P1_SUPER_ADMIN_EMAIL, 'P1_SUPER_ADMIN_EMAIL', 'superadmin');
const finance = technical(process.env.P1_FINANCE_EMAIL ?? 'p1-browser-finance@example.test', 'P1_FINANCE_EMAIL', 'finance');
const techOps = technical(process.env.P1_TECH_OPS_EMAIL ?? 'p1-browser-techops@example.test', 'P1_TECH_OPS_EMAIL', 'techops');
const superTotp = required(process.env.P1_BROWSER_TOTP_SECRET, 'P1_BROWSER_TOTP_SECRET');
const financeTotp = required(process.env.P1_FINANCE_TOTP_SECRET ?? process.env.P1_BROWSER_TOTP_SECRET, 'P1_FINANCE_TOTP_SECRET');
const techOpsTotp = required(process.env.P1_TECH_OPS_TOTP_SECRET ?? process.env.P1_BROWSER_TOTP_SECRET, 'P1_TECH_OPS_TOTP_SECRET');
const runId = safeIdentifier(process.env.P1_RUN_ID); const sourceSha = safeSha(process.env.P1_STAGING_SHA); const evidenceDirectory = process.env.SPRINT7_COMMERCIAL_EVIDENCE_DIR ?? '';
const checks = []; let currentCheck = 'INITIALIZATION'; let browser;

function required(value, name) { assert.ok(typeof value === 'string' && value.length > 0, `${name}_REQUIRED`); return value; }
function safeIdentifier(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,96}$/u.test(value) ? value : null; }
function safeSha(value) { return typeof value === 'string' && /^[a-f0-9]{7,64}$/iu.test(value) ? value : null; }
function technical(value, name, role) { assert.ok(typeof value === 'string' && value === `p1-browser-${role}@example.test`, `${name}_MUST_BE_TECHNICAL_FIXTURE`); return value; }
function localOrigin(value, name) { assert.ok(typeof value === 'string', `${name}_REQUIRED`); const url = new URL(value); assert.equal(url.protocol, 'http:', `${name}_MUST_USE_HTTP_LOOPBACK`); assert.equal(url.hostname, '127.0.0.1', `${name}_MUST_USE_IPV4_LOOPBACK`); assert.ok(/^[1-9][0-9]{0,4}$/u.test(url.port), `${name}_PORT_REQUIRED`); assert.ok(url.pathname === '/' || url.pathname === '', `${name}_PATH_NOT_ALLOWED`); return url.origin; }
function localApiBase(value) { assert.ok(typeof value === 'string', 'P1_API_BASE_REQUIRED'); const url = new URL(value); assert.equal(url.protocol, 'http:', 'P1_API_BASE_MUST_USE_HTTP_LOOPBACK'); assert.equal(url.hostname, '127.0.0.1', 'P1_API_BASE_MUST_USE_IPV4_LOOPBACK'); assert.equal(url.pathname.replace(/\/+$/, ''), '/api', 'P1_API_BASE_MUST_END_IN_API'); return url.toString().replace(/\/$/u, ''); }
function record(name) { checks.push({ name, status: 'PASS' }); }
function evidencePath() { return path.join('/p1/evidence', `sprint7-commercial-browser-${runId}.json`); }
function writeEvidence(status, failureCheck = null) { mkdirSync('/p1/evidence', { recursive: true, mode: 0o700 }); writeFileSync(evidencePath(), JSON.stringify({ gate: 'SPRINT7_COMMERCIAL_BROWSER', status, runId, sourceSha, failureCheck, checks }), { mode: 0o600, flag: 'wx' }); }
function responseIsRedacted(value, seen = new Set()) { if (value === null || value === undefined) return true; if (typeof value === 'string') return !/(?:sk-[A-Za-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|-----BEGIN|password\s*=|api[_-]?key\s*=|eyJ[A-Za-z0-9_-]{8,}\.)/iu.test(value); if (typeof value !== 'object' || seen.has(value)) return true; seen.add(value); return Object.values(value).every((child) => responseIsRedacted(child, seen)); }
function assertLoopback(url) { const parsed = new URL(url); assert.equal(parsed.protocol, 'http:', 'BROWSER_REQUEST_PROTOCOL_MUST_BE_HTTP_LOOPBACK'); assert.equal(parsed.hostname, '127.0.0.1', 'BROWSER_REQUEST_HOST_MUST_BE_LOOPBACK'); assert.ok([new URL(adminBase).port, new URL(apiBase).port].includes(parsed.port), 'BROWSER_REQUEST_PORT_NOT_ALLOWED'); }
function isAdminApiResponse(response, pathname, method) { const url = new URL(response.url()); return url.protocol === 'http:' && url.hostname === '127.0.0.1' && [new URL(adminBase).port, new URL(apiBase).port].includes(url.port) && url.pathname === `/api${pathname}` && response.request().method() === method; }
async function restrictNetwork(page) { await page.route('**/*', async (route) => { try { assertLoopback(route.request().url()); await route.continue(); } catch { await route.abort('blockedbyclient'); } }); page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) assertLoopback(frame.url()); }); }

async function login(page, email, totp) {
  await page.goto(`${adminBase}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email); await page.getByLabel('Password').fill(password);
  const loginResponse = page.waitForResponse((response) => isAdminApiResponse(response, '/auth/login', 'POST'));
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); assert.equal((await loginResponse).status(), 200);
  await page.getByLabel('Authentication code').fill(authenticator.generate(totp));
  const verified = page.waitForResponse((response) => isAdminApiResponse(response, '/auth/2fa/verify', 'POST'));
  await page.getByRole('button', { name: 'Verify MFA', exact: true }).click(); assert.equal((await verified).status(), 200);
  await page.waitForURL(/\/dashboard(?:\?.*)?$/u);
}

async function navigatePlans(page) {
  await page.getByRole('button', { name: 'Plans', exact: true }).click(); await page.waitForURL(/\/plans(?:\?.*)?$/u);
  // The protected shell can eagerly fetch the first section. Refresh after
  // navigation so this test observes a concrete, browser-originated response.
  const response = page.waitForResponse((candidate) => isAdminApiResponse(candidate, '/admin/commercial/plans', 'GET'));
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  return response;
}

async function main() {
  assert.ok(runId, 'P1_RUN_ID_REQUIRED'); assert.ok(sourceSha, 'P1_STAGING_SHA_REQUIRED'); assert.equal(path.resolve(evidenceDirectory), '/p1/evidence', 'SPRINT7_COMMERCIAL_EVIDENCE_DIR_MUST_BE_P1_EVIDENCE');
  browser = await chromium.launch({ headless: true });
  try {
    const superContext = await browser.newContext(); const superPage = await superContext.newPage({ viewport: { width: 1440, height: 960 } }); superPage.setDefaultTimeout(20_000); await restrictNetwork(superPage);
    let pricingMutationRequests = 0; superPage.on('request', (request) => { if (request.method() === 'PUT' && /\/admin\/commercial\/plans\/[^/]+\/pricing$/u.test(new URL(request.url()).pathname)) pricingMutationRequests += 1; });
    currentCheck = 'SUPER_ADMIN_LOGIN';
    await login(superPage, superAdmin, superTotp); record(currentCheck);

    currentCheck = 'SUPER_ADMIN_PLANS_HTTP';
    const catalogResponse = await navigatePlans(superPage); assert.equal(catalogResponse.status(), 200); const catalog = await catalogResponse.json(); assert.ok(Array.isArray(catalog?.items), 'COMMERCIAL_PLANS_ITEMS_REQUIRED'); assert.ok(responseIsRedacted(catalog), 'COMMERCIAL_CATALOG_RESPONSE_MUST_BE_REDACTED'); record(currentCheck);

    currentCheck = 'SUPER_ADMIN_CATALOG_RENDER';
    await superPage.getByRole('heading', { name: 'Commercial Control Center', exact: true }).waitFor();
    const visible = await superPage.locator('body').innerText();
    for (const amount of ['$0.00', '$4.99', '$49.00', '$15.00', '$150.00']) assert.ok(visible.includes(amount), `ACTIVE_PRICE_NOT_RENDERED:${amount}`);
    for (const state of ['PRIMARY', 'FALLBACK', 'BLOCKED']) assert.ok(visible.includes(state), `QUOTA_STATE_GUIDANCE_NOT_RENDERED:${state}`); record(currentCheck);

    currentCheck = 'SUPER_ADMIN_PRICING_DIALOG';
    const edit = superPage.getByRole('button', { name: /^Edit pricing /u }).first(); await edit.waitFor(); await edit.click();
    await superPage.getByRole('heading', { name: 'Official active pricing', exact: true }).waitFor(); await superPage.getByText(/step-up MFA/u).waitFor();
    assert.equal(pricingMutationRequests, 0, 'PRICING_MUTATION_MUST_REQUIRE_EXPLICIT_SAVE'); await superPage.getByRole('button', { name: 'Close', exact: true }).click(); record(currentCheck);
    currentCheck = 'SENTINEL_STATUS_PRESERVED';
    await superPage.route(`${apiBase}/admin/commercial/usage`, async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ plan: 'FREE', feature: 'documents', status: 'NOT_CONFIGURED', quotaState: 'BLOCKED' }] }) }));
    await superPage.getByRole('button', { name: 'Usage', exact: true }).click(); await superPage.waitForURL(/\/usage(?:\?.*)?$/u); await superPage.getByText('NOT_CONFIGURED', { exact: true }).waitFor();
    assert.equal(pricingMutationRequests, 0, 'SENTINEL_RENDER_MUST_NOT_MUTATE_PRICING'); await superPage.close(); await superContext.close(); record(currentCheck);

    currentCheck = 'FINANCE_CATALOG_READ';
    const financeContext = await browser.newContext(); const financePage = await financeContext.newPage({ viewport: { width: 1024, height: 768 } }); financePage.setDefaultTimeout(20_000); await restrictNetwork(financePage); await login(financePage, finance, financeTotp);
    const financeResponse = await navigatePlans(financePage); assert.equal(financeResponse.status(), 200); await financePage.getByRole('heading', { name: 'Commercial Control Center', exact: true }).waitFor(); await financePage.close(); await financeContext.close(); record(currentCheck);

    currentCheck = 'TECH_OPS_COMMERCIAL_CATALOG_DENIED';
    const techOpsContext = await browser.newContext(); const techOpsPage = await techOpsContext.newPage({ viewport: { width: 390, height: 844 } }); techOpsPage.setDefaultTimeout(20_000); await restrictNetwork(techOpsPage); await login(techOpsPage, techOps, techOpsTotp);
    const denied = await navigatePlans(techOpsPage); assert.equal(denied.status(), 403); await techOpsPage.getByText('This commercial section is not available for your role.', { exact: true }).waitFor();
    const layout = await techOpsPage.evaluate(() => ({ html: document.documentElement.scrollWidth, body: document.body.scrollWidth, viewport: window.innerWidth })); assert.ok(layout.html <= layout.viewport + 1 && layout.body <= layout.viewport + 1, 'TECH_OPS_FORBIDDEN_LAYOUT_OVERFLOW'); await techOpsPage.close(); await techOpsContext.close(); record(currentCheck);
  } finally { await browser.close(); browser = undefined; }
}

main().then(() => { writeEvidence('PASS'); process.stdout.write('SPRINT7_COMMERCIAL_BROWSER_PASS\n'); }).catch(async () => { checks.push({ name: currentCheck, status: 'FAIL' }); if (browser) await browser.close().catch(() => undefined); try { writeEvidence('FAIL', currentCheck); } catch { /* Do not overwrite previous evidence. */ } process.stdout.write(`SPRINT7_COMMERCIAL_BROWSER_FAIL:${currentCheck}\n`); process.exitCode = 1; });
