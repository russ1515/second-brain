/*
 * HTTP-only companion to the browser validation.  It talks only to a caller
 * supplied local test API and never prints access tokens, passwords, or TOTP
 * values.  The fixture namespace and database guard make an accidental
 * production invocation fail closed.
 */
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { authenticator } = require('otplib');

const baseUrl = process.env.SPRINT3_API_BASE_URL;
const databaseUrl = process.env.DATABASE_URL;
const fixtureConfirmation = process.env.SPRINT3_BROWSER_FIXTURE_CONFIRM;
const adminEmail = 'sprint3-browser-admin@example.test';
const normalEmail = 'sprint3-browser-normal@example.test';
const learnerEmail = 'sprint3-browser-learner@example.test';
const totpTestVector = 'JBSWY3DPEHPK3PXP';
let phase = 'bootstrap';
let responseStatus = 0;
const durations = [];

function requireDedicatedTarget() {
  assert.equal(fixtureConfirmation, 'I_UNDERSTAND_TEST_ONLY', 'Explicit test-only confirmation is required.');
  assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/u.test(baseUrl ?? ''), 'A loopback HTTP API URL is required.');
  assert.ok(databaseUrl, 'DATABASE_URL is required.');
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname).replace(/^\/+/, '');
  assert.match(databaseName, /(?:test|staging|sprint)/iu, 'A dedicated test, staging, or sprint database is required.');
}

function fixturePassword() {
  return `S3-${createHash('sha256').update(`sprint3-browser:${totpTestVector}`).digest('base64url').slice(0, 30)}-Aa1!`;
}

async function request(path, { method = 'GET', body, accessToken } = {}) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  durations.push({ path, milliseconds: Date.now() - startedAt });
  return { response, payload };
}

async function loginAdmin() {
  phase = 'admin-password';
  const first = await request('/api/auth/login', { method: 'POST', body: { email: adminEmail, password: fixturePassword() } });
  responseStatus = first.response.status;
  assert.equal(first.response.status, 200);
  assert.equal(first.payload?.twoFactorRequired, true);
  phase = 'admin-mfa';
  const second = await request('/api/auth/2fa/verify', {
    method: 'POST',
    body: { challengeToken: first.payload.challengeToken, code: authenticator.generate(totpTestVector) },
  });
  responseStatus = second.response.status;
  assert.equal(second.response.status, 200);
  assert.equal(typeof second.payload?.tokens?.accessToken, 'string');
  return second.payload.tokens.accessToken;
}

async function main() {
  requireDedicatedTarget();
  const adminToken = await loginAdmin();
  const validStepUpCode = authenticator.generate(totpTestVector);
  const invalidStepUpCode = `${validStepUpCode.slice(0, -1)}${validStepUpCode.endsWith('0') ? '1' : '0'}`;
  phase = 'admin-step-up-invalid';
  const rejectedStepUp = await request('/api/auth/2fa/step-up', { method: 'POST', body: { code: invalidStepUpCode }, accessToken: adminToken });
  responseStatus = rejectedStepUp.response.status;
  assert.equal(rejectedStepUp.response.status, 403);
  assert.equal(rejectedStepUp.payload?.code, 'MFA_CODE_INVALID');
  phase = 'admin-step-up-session-still-valid';
  const stillAuthenticated = await request('/api/auth/me', { accessToken: adminToken });
  responseStatus = stillAuthenticated.response.status;
  assert.equal(stillAuthenticated.response.status, 200);
  phase = 'admin-step-up';
  const steppedUp = await request('/api/auth/2fa/step-up', { method: 'POST', body: { code: validStepUpCode }, accessToken: adminToken });
  responseStatus = steppedUp.response.status;
  assert.equal(steppedUp.response.status, 200);
  phase = 'admin-directory';
  const directory = await request('/api/admin/users?page=1&pageSize=25', { accessToken: adminToken });
  responseStatus = directory.response.status;
  assert.equal(directory.response.status, 200);
  assert.ok(Array.isArray(directory.payload?.items));
  assert.equal(directory.payload?.page, 1);
  // Other integration fixtures may legitimately push this user beyond the
  // first server page.  Exercise the actual server-side search rather than
  // assuming a fixed global ordering.
  phase = 'admin-directory-search';
  const search = await request(`/api/admin/users?page=1&pageSize=25&search=${encodeURIComponent(learnerEmail)}`, { accessToken: adminToken });
  responseStatus = search.response.status;
  assert.equal(search.response.status, 200);
  const learner = search.payload?.items?.find((item) => item.email === learnerEmail);
  assert.ok(learner?.id, 'The disposable learner must be visible to the Super Admin.');
  phase = 'admin-detail';
  const detail = await request(`/api/admin/users/${encodeURIComponent(learner.id)}`, { accessToken: adminToken });
  responseStatus = detail.response.status;
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload?.header?.email, learnerEmail);
  phase = 'normal-login';
  const normal = await request('/api/auth/login', { method: 'POST', body: { email: normalEmail, password: fixturePassword() } });
  responseStatus = normal.response.status;
  assert.equal(normal.response.status, 200);
  assert.equal(typeof normal.payload?.tokens?.accessToken, 'string');
  phase = 'normal-rbac';
  const denied = await request('/api/admin/users', { accessToken: normal.payload.tokens.accessToken });
  responseStatus = denied.response.status;
  assert.equal(denied.response.status, 403);
  console.log(`SPRINT3_ADMIN_HTTP_SMOKE_PASS:${durations.map((entry) => `${entry.path}:${entry.milliseconds}`).join(',')}`);
}

main().catch(() => {
  console.error(`SPRINT3_ADMIN_HTTP_SMOKE_FAIL:${phase}:${responseStatus}`);
  process.exitCode = 1;
});
