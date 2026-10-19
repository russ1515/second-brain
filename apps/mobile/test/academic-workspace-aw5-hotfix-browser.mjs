import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// One existing technical learner, normal login, one Workspace, no cleanup deletion.
const baseUrl = 'https://beta.secondbrainlearn.com';
const email = process.env.P1_INFRA_LEARNER_EMAIL;
const password = process.env.P1_BROWSER_PASSWORD;
const mode = process.env.AW5_MODE;
const evidenceDir = process.env.WORKSPACE_BROWSER_EVIDENCE_DIR;
assert.equal(email, 'p1-browser-learner@example.test', 'AUTHORIZED_TECHNICAL_LEARNER_REQUIRED');
assert.ok(password, 'PRIVATE_TEST_PASSWORD_REQUIRED');
assert.ok(['reproduce', 'verify'].includes(mode), 'AW5_MODE_REQUIRED');
assert.ok(evidenceDir && path.isAbsolute(evidenceDir), 'ABSOLUTE_EVIDENCE_DIRECTORY_REQUIRED');
assert.equal(process.env.WORKSPACE_BROWSER_CONFIRM, 'I_UNDERSTAND_STAGING_ONLY');
fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

const evidence = {
  gate: 'AW5_EXPLAIN_METHOD_HOTFIX', mode,
  sourceSha: process.env.P1_STAGING_SHA ?? 'UNKNOWN',
  browser: null, stage: 'LOGIN', status: 'RUNNING',
  workspaceId: null, objectiveEmpty: null, assistantPosts: 0,
  trace: [], checks: {}, screenshots: [],
};
const evidencePath = path.join(evidenceDir, `${mode}.json`);
function persist() {
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
}
const browser = await chromium.launch({ headless: true });
evidence.browser = browser.version();
const context = await browser.newContext({
  locale: 'fr-FR', viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce',
});
const page = await context.newPage();
let assistantPosts = 0;
await context.route('**/api/workspaces/*/assistant', async (route) => {
  if (route.request().method() !== 'POST') return route.continue();
  assistantPosts += 1;
  evidence.assistantPosts = assistantPosts;
  persist();
  // Reproduction must never spend; verification may send exactly one turn.
  if (mode === 'reproduce' || assistantPosts > 1) return route.abort('blockedbyclient');
  return route.continue();
});

async function screenshot(label) {
  const file = path.join(evidenceDir, `${mode}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  evidence.screenshots.push(file);
  persist();
}
async function workspaceRead(id) {
  const result = await page.evaluate(async (workspaceId) => {
    const token = window.localStorage.getItem('sb.accessToken');
    if (!token) return { status: 0 };
    const response = await fetch(`/api/workspaces/${workspaceId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    return { status: response.status, body };
  }, id);
  assert.equal(result.status, 200, 'WORKSPACE_GET_REQUIRED');
  return result.body;
}
function transitionTrace(response, body) {
  return {
    endpoint: new URL(response.url()).pathname,
    payload: response.request().postDataJSON(),
    status: response.status(),
    response: response.ok()
      ? { currentPhase: body.professor?.currentPhase, revision: body.revision }
      : { code: body.code, message: body.message },
  };
}
async function advance(expectedStatus) {
  const responsePromise = page.waitForResponse(r => (
    r.request().method() === 'POST'
    && new URL(r.url()).pathname === `/api/workspaces/${evidence.workspaceId}/transitions`
  ));
  await page.getByTestId('workspace-professor-advance').click();
  const response = await responsePromise;
  const body = await response.json();
  evidence.trace.push(transitionTrace(response, body));
  persist();
  assert.equal(response.status(), expectedStatus, 'TRANSITION_HTTP_STATUS');
  return body;
}

try {
  await page.goto(`${baseUrl}/login?returnTo=%2Flibrary%2Fworkspace`, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: /se connecter|sign in/iu }).first().click();
  assert.equal((await loginResponse).status(), 200, 'NORMAL_TECHNICAL_LOGIN_REQUIRED');
  await page.waitForURL(url => url.pathname === '/library/workspace', { timeout: 30_000 });
  evidence.checks.normalLogin = 'PASS';

  if (mode === 'reproduce') {
    evidence.stage = 'CREATE_EMPTY_OBJECTIVE'; persist();
    await page.getByTestId('workspace-manual-toggle').click();
    await page.getByTestId('workspace-template-assignment').click();
    await page.getByTestId('workspace-title').fill(`AW5 technical fraction ${Date.now()}`);
    await page.getByTestId('workspace-field-subject').fill('Mathématiques : fractions');
    await page.getByTestId('workspace-field-requirements').fill(
      'Comprendre pourquoi 1/2 et 2/4 représentent la même quantité. Expliquer avec un exemple de gâteau, sans faire tout le devoir.',
    );
    assert.equal(await page.getByTestId('workspace-objective').inputValue(), '');
    const created = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/workspaces');
    await page.getByTestId('workspace-create-action').click();
    assert.equal((await created).status(), 201, 'TECHNICAL_WORKSPACE_CREATED');
    await page.waitForURL(/\/library\/workspace\/[^/?#]+(?:\?.*)?$/u);
    evidence.workspaceId = new URL(page.url()).pathname.split('/').at(-1);
    evidence.checks.create = 'PASS'; persist();
    await page.reload({ waitUntil: 'networkidle' });
    let saved = await workspaceRead(evidence.workspaceId);
    assert.equal(saved.objective, '');
    evidence.objectiveEmpty = true;
    assert.equal(saved.professor.currentPhase, 'CAPTURE');
    await advance(201);
    await page.getByTestId('workspace-professor-phase').getByText('Compréhension', { exact: true }).waitFor();
    evidence.checks.captureToComprehension = 'PASS';

    evidence.stage = 'EXPLAIN_REPRODUCTION'; persist();
    await page.getByTestId('workspace-assistant').getByRole('button', { name: 'Expliquer', exact: true }).click();
    await page.waitForTimeout(1200);
    evidence.checks.explainSendsNoRequest = assistantPosts === 0 ? 'PASS' : 'FAIL';
    assert.equal(assistantPosts, 0, 'BASELINE_EXPLAIN_HAS_NO_POST');
    evidence.trace.push({ action: 'click Explain', assistantPostCount: 0, visibleReplyCount: await page.getByTestId('workspace-assistant-history').locator(':scope > *').count() });
    const refusal = await advance(400);
    assert.equal(refusal.code, 'workspace_professor_transition_criteria_not_met');
    evidence.checks.serverRefusesMissingEvidence = 'PASS';
    evidence.uiError = await page.getByTestId('workspace-assistant').innerText();
    await screenshot('comprehension-refusal');
    saved = await workspaceRead(evidence.workspaceId);
    assert.equal(saved.professor.currentPhase, 'COMPREHENSION');
  } else {
    const baseline = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'reproduce.json'), 'utf8'));
    assert.equal(baseline.status, 'PASS');
    evidence.workspaceId = baseline.workspaceId;
    await page.goto(`${baseUrl}/library/workspace/${evidence.workspaceId}`, { waitUntil: 'networkidle' });
    const before = await workspaceRead(evidence.workspaceId);
    assert.equal(before.objective, '');
    assert.equal(before.professor.currentPhase, 'COMPREHENSION');
    evidence.objectiveEmpty = true;
    evidence.stage = 'SAFE_TRANSITION_REASON'; persist();
    await advance(400);
    await page.getByText('Demande au Professeur d’expliquer cette consigne et attends sa réponse avant de continuer vers Méthode.', { exact: true }).waitFor();
    evidence.checks.actionableError = 'PASS';
    await screenshot('actionable-refusal');

    evidence.stage = 'ONE_REAL_EXPLAIN'; persist();
    const assistantResponse = page.waitForResponse(r => (
      r.request().method() === 'POST'
      && new URL(r.url()).pathname === `/api/workspaces/${evidence.workspaceId}/assistant`
    ), { timeout: 90_000 });
    await page.getByTestId('workspace-assistant').getByRole('button', { name: 'Expliquer', exact: true }).click();
    const response = await assistantResponse;
    const body = await response.json();
    evidence.trace.push({
      endpoint: new URL(response.url()).pathname, payload: response.request().postDataJSON(),
      status: response.status(),
      response: { reply: body.reply?.content, evidenceStatus: body.reply?.evidenceStatus, professorPhase: body.professor?.currentPhase, evidenceCount: body.professor?.evidence?.length },
    });
    persist();
    assert.ok(response.ok(), 'REAL_EXPLAIN_HTTP_SUCCESS');
    assert.ok(body.reply?.content?.trim(), 'REAL_PEDAGOGICAL_REPLY_REQUIRED');
    assert.doesNotMatch(body.reply.content, /\[echo\]/iu);
    await page.getByTestId('workspace-assistant-history').getByText(body.reply.content, { exact: true }).waitFor();
    assert.ok(body.professor.evidence.some(item => item.assistantReplyId === body.reply.id && item.phase === 'COMPREHENSION'));
    evidence.checks.realExplainVisible = 'PASS';
    evidence.checks.authoritativeEvidence = 'PASS';
    await screenshot('visible-explanation');
    evidence.stage = 'METHOD_AND_REFRESH'; persist();
    const moved = await advance(201);
    assert.equal(moved.professor.currentPhase, 'METHOD');
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByTestId('workspace-professor-phase').getByText('Méthode', { exact: true }).waitFor();
    const saved = await workspaceRead(evidence.workspaceId);
    assert.equal(saved.professor.currentPhase, 'METHOD');
    assert.ok(saved.assistantHistory.some(item => item.id === body.reply.id && item.content === body.reply.content));
    evidence.checks.methodPersistedAfterRefresh = 'PASS';
    evidence.checks.replyPersistedAfterRefresh = 'PASS';
    assert.equal(assistantPosts, 1, 'ONE_REAL_TURN_ONLY');
    await screenshot('method-after-refresh');
  }
  evidence.status = 'PASS';
  evidence.stage = 'DONE';
} catch (error) {
  evidence.status = 'FAIL';
  // Never include browser call logs or credential-bearing request headers.
  evidence.failure = String(error?.message ?? 'UNKNOWN').split('\n')[0].slice(0, 240);
  await screenshot('failure').catch(() => undefined);
  process.exitCode = 1;
} finally {
  evidence.assistantPosts = assistantPosts;
  evidence.finalUrl = page.url();
  persist();
  console.log(JSON.stringify({ status: evidence.status, stage: evidence.stage, assistantPosts, evidencePath, checks: evidence.checks, failure: evidence.failure }));
  await browser.close();
}
