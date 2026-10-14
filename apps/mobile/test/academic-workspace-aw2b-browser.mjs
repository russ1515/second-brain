import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.WORKSPACE_BROWSER_BASE_URL ?? '').replace(/\/+$/u, '');
const userAEmail = process.env.P1_INFRA_LEARNER_EMAIL ?? '';
const userAPassword = process.env.P1_BROWSER_PASSWORD ?? '';
const userBEmail = process.env.P1_INFRA_LEARNER_B_EMAIL ?? '';
const userBPassword = process.env.P1_BROWSER_PASSWORD_B ?? userAPassword;
const evidenceDir = process.env.WORKSPACE_BROWSER_EVIDENCE_DIR ?? '';
const confirmed = process.env.WORKSPACE_BROWSER_CONFIRM === 'I_UNDERSTAND_STAGING_ONLY';
const sourceSha = process.env.P1_STAGING_SHA ?? 'UNKNOWN';
const runId = (process.env.P1_RUN_ID ?? `aw2b-${Date.now()}`)
  .replace(/[^A-Za-z0-9_-]/gu, '-')
  .slice(0, 80);

const technicalLearner = (value) => (
  typeof value === 'string'
  && /^p1-browser-[a-z0-9-]+@example\.test$/u.test(value)
);

assert.equal(confirmed, true, 'WORKSPACE_BROWSER_CONFIRM_REQUIRED');
assert.equal(baseUrl, 'https://beta.secondbrainlearn.com', 'BETA_URL_REQUIRED');
assert.ok(technicalLearner(userAEmail), 'TECHNICAL_USER_A_REQUIRED');
assert.ok(technicalLearner(userBEmail), 'TECHNICAL_USER_B_REQUIRED');
assert.ok(userAEmail !== userBEmail, 'TWO_DISTINCT_TECHNICAL_USERS_REQUIRED');
assert.ok(userAPassword.length > 0, 'TECHNICAL_USER_A_PASSWORD_REQUIRED');
assert.ok(userBPassword.length > 0, 'TECHNICAL_USER_B_PASSWORD_REQUIRED');
assert.ok(path.isAbsolute(evidenceDir), 'ABSOLUTE_EVIDENCE_DIR_REQUIRED');

const evidencePath = path.join(evidenceDir, `${runId}.json`);
const checks = {
  create: 'NOT_RUN',
  autosaveReload: 'NOT_RUN',
  fastExit: 'NOT_RUN',
  reloginResume: 'NOT_RUN',
  conflict409: 'NOT_RUN',
  conflictRecovery: 'NOT_RUN',
  archive: 'NOT_RUN',
  ownershipGet: 'NOT_RUN',
  ownershipPatch: 'NOT_RUN',
  exportOwner: 'NOT_RUN',
  exportIsolation: 'NOT_RUN',
};
let stage = 'BOOT';
let workspaceId = null;
let experienceSessionId = null;
let contextA;
let contextB;
let pageA;

fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

function writeEvidence(status) {
  const evidence = {
    gate: 'ACADEMIC_WORKSPACE_AW2B_BROWSER',
    status,
    sourceSha,
    runId,
    stage,
    workspaceId,
    experienceSessionId,
    checks,
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(evidencePath, 0o600);
}

async function login(page, email, password, returnTo = '/library/workspace') {
  const signInUrl = `${baseUrl}/sign-in?mode=login&returnTo=${encodeURIComponent(returnTo)}`;
  await page.goto(signInUrl, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|se connecter/iu }).first().click();
  await page.waitForURL((url) => url.pathname === returnTo, { timeout: 30_000 });
}

async function logoutThroughUi(page) {
  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  const action = page.getByRole('button', { name: /sign out|log out|se déconnecter|déconnexion/iu }).last();
  await action.waitFor({ state: 'visible', timeout: 15_000 });
  await action.click();
  await page.waitForFunction(() => !window.localStorage.getItem('sb.accessToken'), undefined, { timeout: 15_000 });
}

async function browserApi(page, apiPath, init = {}) {
  return page.evaluate(async ({ apiPath: requestedPath, init: requestedInit }) => {
    const token = window.localStorage.getItem('sb.accessToken');
    if (!token) return { status: 0, body: null };
    const response = await window.fetch(requestedPath, {
      method: requestedInit.method ?? 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(requestedInit.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(requestedInit.body === undefined ? {} : { body: JSON.stringify(requestedInit.body) }),
    });
    let body = null;
    if (response.status !== 204) {
      body = await response.json().catch(() => null);
    }
    return { status: response.status, body };
  }, { apiPath, init });
}

async function archiveWorkspace(page, id) {
  if (!id || page.isClosed()) return { status: 0 };
  return browserApi(page, `/api/workspaces/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status: 'archived' },
  });
}

async function ensureUserAForCleanup() {
  if (!workspaceId || !pageA || pageA.isClosed()) return;
  const authenticated = await pageA.evaluate(() => Boolean(window.localStorage.getItem('sb.accessToken'))).catch(() => false);
  if (!authenticated) {
    await login(pageA, userAEmail, userAPassword).catch(() => undefined);
  }
}

async function createTechnicalWorkspace(page) {
  await page.goto(`${baseUrl}/library/workspace`, { waitUntil: 'networkidle' });
  await page.getByTestId('workspace-manual-toggle').click();
  await page.getByTestId('workspace-create').waitFor({ state: 'visible' });
  await page.getByTestId('workspace-template-other').click();
  await page.getByTestId('workspace-adaptive-fields').waitFor({ state: 'visible' });
  await page.getByTestId('workspace-title').fill(`AW2B technical ${runId}`);
  await page.getByTestId('workspace-objective').fill(`AW2B lifecycle verification ${runId}`);
  const fields = page.locator('[data-testid^="workspace-field-"]');
  const fieldCount = await fields.count();
  assert.ok(fieldCount > 0, 'WORKSPACE_ADAPTIVE_FIELDS_REQUIRED');
  for (let index = 0; index < fieldCount; index += 1) {
    await fields.nth(index).fill(`AW2B technical field ${index + 1} ${runId}`);
  }
  const createResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/workspaces'
  ), { timeout: 15_000 });
  await page.getByTestId('workspace-create-action').click();
  const response = await createResponse;
  assert.ok(response.status() === 200 || response.status() === 201, 'WORKSPACE_CREATE_RESPONSE');
  await page.waitForURL(/\/library\/workspace\/[^/?#]+(?:\?.*)?$/u, { timeout: 30_000 });
  const id = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);
  assert.ok(typeof id === 'string' && id.length > 0, 'WORKSPACE_ID_REQUIRED');
  return id;
}

async function explicitSave(page, id, expectedStatus) {
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/workspaces/${id}/autosave`
  ), { timeout: 15_000 });
  await page.getByTestId('workspace-save-draft').click();
  const response = await responsePromise;
  assert.equal(response.status(), expectedStatus, 'WORKSPACE_AUTOSAVE_STATUS');
}

const browser = await chromium.launch({ headless: true });

try {
  stage = 'LOGIN_USER_A';
  contextA = await browser.newContext({
    locale: 'en-US',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  pageA = await contextA.newPage();
  await login(pageA, userAEmail, userAPassword);

  stage = 'CREATE_WORKSPACE';
  workspaceId = await createTechnicalWorkspace(pageA);
  checks.create = 'PASS';
  await pageA.getByTestId('workspace-draft-input').waitFor({ state: 'visible' });

  const initialDraft = `AW2B autosave ${runId}`;
  stage = 'AUTOSAVE_RELOAD';
  const automaticSave = pageA.waitForResponse((response) => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/workspaces/${workspaceId}/autosave`
  ), { timeout: 15_000 });
  await pageA.getByTestId('workspace-draft-input').fill(initialDraft);
  assert.equal((await automaticSave).status(), 200, 'AUTOSAVE_RESPONSE');
  await pageA.reload({ waitUntil: 'networkidle' });
  assert.ok(
    await pageA.getByTestId('workspace-draft-input').inputValue() === initialDraft,
    'AUTOSAVE_RELOAD_CONTENT',
  );
  checks.autosaveReload = 'PASS';

  stage = 'FAST_EXIT';
  const fastExitDraft = `AW2B fast exit ${runId}`;
  await pageA.getByTestId('workspace-draft-input').fill(fastExitDraft);
  const fastExitSave = pageA.waitForResponse((response) => (
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === `/api/workspaces/${workspaceId}/autosave`
  ), { timeout: 15_000 });
  const exitStartedAt = Date.now();
  const backAction = pageA.locator('[role="button"][aria-label*="·"]').first();
  await backAction.click({ noWaitAfter: true });
  assert.ok(Date.now() - exitStartedAt < 1_200, 'FAST_EXIT_NOT_INITIATED_BEFORE_DEBOUNCE');
  assert.equal((await fastExitSave).status(), 200, 'FAST_EXIT_SAVE_RESPONSE');
  await pageA.waitForURL((url) => url.pathname !== `/library/workspace/${workspaceId}`, { timeout: 15_000 });
  checks.fastExit = 'PASS';

  await pageA.goto(`${baseUrl}/library/workspace/${workspaceId}`, { waitUntil: 'networkidle' });
  assert.ok(
    await pageA.getByTestId('workspace-draft-input').inputValue() === fastExitDraft,
    'FAST_EXIT_DRAFT_NOT_PERSISTED',
  );

  stage = 'LOGOUT_LOGIN_RESUME';
  await logoutThroughUi(pageA);
  await login(pageA, userAEmail, userAPassword, `/library/workspace/${workspaceId}`);
  await pageA.getByTestId('workspace-draft-input').waitFor({ state: 'visible' });
  assert.ok(
    await pageA.getByTestId('workspace-draft-input').inputValue() === fastExitDraft,
    'RELOGIN_DRAFT_NOT_PERSISTED',
  );
  checks.reloginResume = 'PASS';

  stage = 'REAL_409';
  const stalePage = await contextA.newPage();
  await stalePage.goto(`${baseUrl}/library/workspace/${workspaceId}`, { waitUntil: 'networkidle' });
  await stalePage.getByTestId('workspace-draft-input').waitFor({ state: 'visible' });

  const serverDraft = `AW2B server revision ${runId}`;
  await pageA.getByTestId('workspace-draft-input').fill(serverDraft);
  await explicitSave(pageA, workspaceId, 200);

  const localDraft = `AW2B local recovery ${runId}`;
  await stalePage.getByTestId('workspace-draft-input').fill(localDraft);
  await explicitSave(stalePage, workspaceId, 409);
  await stalePage.getByTestId('workspace-conflict-recovery').waitFor({ state: 'visible' });
  await stalePage.getByTestId('workspace-conflict-reload').waitFor({ state: 'visible' });
  await stalePage.getByTestId('workspace-conflict-copy').waitFor({ state: 'visible' });
  checks.conflict409 = 'PASS';

  await stalePage.getByTestId('workspace-conflict-copy').click();
  const localRecovery = stalePage.getByTestId('workspace-conflict-local-draft');
  await localRecovery.waitFor({ state: 'visible' });
  assert.ok(await localRecovery.inputValue() === localDraft, 'CONFLICT_LOCAL_DRAFT_NOT_RECOVERABLE');

  const reloadResponse = stalePage.waitForResponse((response) => (
    response.request().method() === 'GET'
    && new URL(response.url()).pathname === `/api/workspaces/${workspaceId}`
  ), { timeout: 15_000 });
  await stalePage.getByTestId('workspace-conflict-reload').click();
  assert.equal((await reloadResponse).status(), 200, 'CONFLICT_RELOAD_RESPONSE');
  assert.ok(
    await stalePage.getByTestId('workspace-draft-input').inputValue() === serverDraft,
    'CONFLICT_SERVER_VERSION_NOT_RELOADED',
  );
  assert.ok(await localRecovery.inputValue() === localDraft, 'CONFLICT_LOCAL_DRAFT_LOST_AFTER_RELOAD');
  await stalePage.getByTestId('workspace-conflict-dismiss').waitFor({ state: 'visible' });
  checks.conflictRecovery = 'PASS';
  await stalePage.close();

  stage = 'WORKSPACE_LINK';
  const workspaceResponse = await browserApi(pageA, `/api/workspaces/${workspaceId}`);
  assert.equal(workspaceResponse.status, 200, 'OWNER_WORKSPACE_GET');
  const linkedSession = workspaceResponse.body?.experienceSessionId;
  assert.ok(typeof linkedSession === 'string' && linkedSession.length > 0, 'EXPERIENCE_SESSION_LINK_REQUIRED');
  experienceSessionId = linkedSession;

  stage = 'ARCHIVE';
  const archiveResponse = await archiveWorkspace(pageA, workspaceId);
  assert.equal(archiveResponse.status, 200, 'OWNER_WORKSPACE_ARCHIVE');
  checks.archive = 'PASS';

  stage = 'EXPORT_USER_A';
  const exportAResponse = await browserApi(pageA, '/api/me/export');
  assert.equal(exportAResponse.status, 200, 'OWNER_EXPORT_RESPONSE');
  const exportAWorkspaces = exportAResponse.body?.data?.academicWorkspaces;
  const exportASessions = exportAResponse.body?.data?.experienceSessions;
  assert.ok(Array.isArray(exportAWorkspaces), 'OWNER_EXPORT_WORKSPACES_ARRAY');
  assert.ok(Array.isArray(exportASessions), 'OWNER_EXPORT_SESSIONS_ARRAY');
  const exportedWorkspace = exportAWorkspaces.find((item) => item?.id === workspaceId);
  const exportedSession = exportASessions.find((item) => item?.id === experienceSessionId);
  assert.ok(Boolean(exportedWorkspace), 'OWNER_EXPORT_WORKSPACE_MISSING');
  assert.ok(Boolean(exportedSession), 'OWNER_EXPORT_SESSION_MISSING');
  assert.ok(exportedWorkspace.experienceSessionId === experienceSessionId, 'OWNER_EXPORT_LINK_MISMATCH');
  assert.ok(exportedSession.workspaceRef === workspaceId, 'OWNER_EXPORT_REVERSE_LINK_MISMATCH');
  checks.exportOwner = 'PASS';

  stage = 'LOGIN_USER_B';
  contextB = await browser.newContext({
    locale: 'en-US',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  });
  const pageB = await contextB.newPage();
  await login(pageB, userBEmail, userBPassword);

  stage = 'OWNERSHIP_ISOLATION';
  const deniedGet = await browserApi(pageB, `/api/workspaces/${workspaceId}`);
  assert.ok(deniedGet.status === 403 || deniedGet.status === 404, 'CROSS_USER_GET_MUST_BE_DENIED');
  checks.ownershipGet = 'PASS';

  const deniedPatch = await browserApi(pageB, `/api/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: { title: `AW2B denied patch ${runId}` },
  });
  assert.ok(deniedPatch.status === 403 || deniedPatch.status === 404, 'CROSS_USER_PATCH_MUST_BE_DENIED');
  checks.ownershipPatch = 'PASS';

  stage = 'EXPORT_USER_B';
  const exportBResponse = await browserApi(pageB, '/api/me/export');
  assert.equal(exportBResponse.status, 200, 'SECOND_USER_EXPORT_RESPONSE');
  const exportBWorkspaces = exportBResponse.body?.data?.academicWorkspaces;
  const exportBSessions = exportBResponse.body?.data?.experienceSessions;
  assert.ok(Array.isArray(exportBWorkspaces), 'SECOND_USER_EXPORT_WORKSPACES_ARRAY');
  assert.ok(Array.isArray(exportBSessions), 'SECOND_USER_EXPORT_SESSIONS_ARRAY');
  assert.ok(!exportBWorkspaces.some((item) => item?.id === workspaceId), 'CROSS_USER_WORKSPACE_EXPORT_LEAK');
  assert.ok(!exportBSessions.some((item) => item?.id === experienceSessionId), 'CROSS_USER_SESSION_EXPORT_LEAK');
  checks.exportIsolation = 'PASS';

  stage = 'COMPLETE';
  writeEvidence('PASS');
  process.stdout.write('ACADEMIC_WORKSPACE_AW2B_BROWSER=PASS CHECKS=11 PAID_CALLS=0 CLEANUP=ARCHIVED\n');
} catch (caught) {
  writeEvidence('FAIL');
  throw caught;
} finally {
  await ensureUserAForCleanup().catch(() => undefined);
  if (workspaceId && pageA && !pageA.isClosed()) {
    await archiveWorkspace(pageA, workspaceId).catch(() => undefined);
  }
  await contextB?.close().catch(() => undefined);
  await contextA?.close().catch(() => undefined);
  await browser.close();
}
