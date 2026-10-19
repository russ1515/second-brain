import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

// Public runtime acceptance: normal technical login, one consent, <=5 AI calls.
const baseUrl = 'https://beta.secondbrainlearn.com';
const password = process.env.P1_BROWSER_PASSWORD;
const directory = process.env.WORKSPACE_BROWSER_EVIDENCE_DIR;
assert.ok(password, 'PRIVATE_TECHNICAL_PASSWORD_REQUIRED');
assert.ok(directory && path.isAbsolute(directory), 'ABSOLUTE_EVIDENCE_DIRECTORY_REQUIRED');
assert.equal(process.env.WORKSPACE_BROWSER_CONFIRM, 'I_UNDERSTAND_STAGING_ONLY');
assert.equal(process.env.AUTOPILOT_REAL_ACCEPTANCE_CONFIRM, 'MAX_5_CALLS_MAX_USD_020');
const prompt = 'Devoir de physique — niveau universitaire. Expliquer les énergies cinétique et potentielle et leurs formules. Calculer l’énergie cinétique pour une masse de 2 kg à 5 m/s, avec les unités, la méthode et une conclusion. Pour l’énergie potentielle, donner seulement Ep = mgh : aucune hauteur n’est fournie, ne pas en inventer. Préparer un brouillon court puis expliquer la démarche.';
const proof = {
  gate: 'PROFESSOR_AUTOPILOT_V1_REAL_BROWSER', status: 'RUNNING', stage: 'LOGIN',
  sourceSha: process.env.P1_STAGING_SHA ?? 'UNKNOWN', browser: null,
  workspaceId: null, requestIds: [], trace: [], checks: {}, screenshots: [],
  maxObservedAiSteps: 0, manualPhaseClicks: 0, consentClicks: 0,
};
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const evidencePath = path.join(directory, 'autopilot-browser.json');
const writeProof = () => fs.writeFileSync(evidencePath, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
const browser = await chromium.launch({ headless: true });
proof.browser = browser.version();
const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const responseTasks = new Set();
let releaseHeld;
let signalHeld;
let heldOnce = false;
const held = new Promise(resolve => { signalHeld = resolve; });
const released = new Promise(resolve => { releaseHeld = resolve; });

async function readWorkspace(id) {
  return page.evaluate(async workspaceId => {
    const token = window.localStorage.getItem('sb.accessToken');
    if (!token) return { status: 0 };
    const response = await fetch(`/api/workspaces/${workspaceId}`, { headers: { authorization: `Bearer ${token}` } });
    return { status: response.status, body: await response.json() };
  }, id);
}
async function login(returnTo) {
  await page.goto(`${baseUrl}/login?returnTo=${encodeURIComponent(returnTo)}`, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="email"]').fill('p1-browser-learner@example.test');
  await page.locator('input[type="password"]').fill(password);
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login');
  await page.getByRole('button', { name: /se connecter|sign in/iu }).first().click();
  assert.equal((await response).status(), 200, 'NORMAL_TECHNICAL_LOGIN_REQUIRED');
  await page.waitForURL(url => url.pathname === returnTo, { timeout: 30_000 });
}
async function screenshot(label, target) {
  if (target) await target.scrollIntoViewIfNeeded();
  const file = path.join(directory, `${label}.png`);
  await page.screenshot({ path: file });
  proof.screenshots.push(file); writeProof();
}

// Network scheduling only: hold the first WORK step so optional Pause/F5/login
// can be tested on a real persisted METHOD result. No response is mocked.
await context.route('**/api/workspaces/*/autopilot', async route => {
  if (route.request().method() !== 'POST') return route.continue();
  const request = route.request().postDataJSON();
  if (request.action !== 'step') return route.continue();
  const id = new URL(route.request().url()).pathname.split('/').at(-2);
  const current = await readWorkspace(id);
  if (current.status !== 200) return route.abort('blockedbyclient');
  const state = current.body.progress.workflow?.autopilot;
  if (!heldOnce && current.body.professor.currentPhase === 'WORK' && state?.aiSteps === 2) {
    heldOnce = true;
    signalHeld();
    await released;
  }
  if (state?.aiSteps >= 5 && current.body.professor.currentPhase !== 'DECONSTRUCTION') return route.abort('blockedbyclient');
  return route.continue();
});
// An unrelated assistant/tool/STT/TTS call is never part of this acceptance.
await context.route('**/api/workspaces/*/assistant', route => route.abort('blockedbyclient'));
await context.route('**/api/voice/**', route => route.abort('blockedbyclient'));

page.on('response', response => {
  if (response.request().method() !== 'POST' || !/\/api\/workspaces\/[^/]+\/autopilot$/u.test(new URL(response.url()).pathname)) return;
  const task = (async () => {
    const request = response.request();
    const requestId = request.headers()['x-request-id'];
    if (requestId) proof.requestIds.push(requestId);
    const body = await response.json().catch(() => null);
    const state = body?.progress?.workflow?.autopilot;
    proof.maxObservedAiSteps = Math.max(proof.maxObservedAiSteps, state?.aiSteps ?? 0);
    proof.trace.push({
      action: request.postDataJSON().action, requestId, status: response.status(),
      phase: body?.professor?.currentPhase, revision: body?.autosaveRevision,
      executionStatus: state?.status, aiSteps: state?.aiSteps,
      errorCode: state?.errorCode ?? body?.code, active: Boolean(state?.activeRequest),
    });
    writeProof();
  })();
  responseTasks.add(task);
  task.finally(() => responseTasks.delete(task));
});

try {
  await login('/library/workspace');
  proof.checks.normalLogin = 'PASS';
  proof.stage = 'ONE_CONFIRMATION_CAPTURE'; writeProof();
  await page.getByTestId('workspace-capture-text').first().click();
  await page.locator('textarea[data-testid="workspace-capture-text"]').fill(prompt);
  await page.getByTestId('workspace-orchestrator-proposal').waitFor();
  const createResponse = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/workspaces');
  await page.getByTestId('workspace-orchestrator-continue').click();
  proof.consentClicks++;
  const created = await createResponse;
  assert.equal(created.status(), 201, 'CREATE_WORKSPACE');
  const createdBody = await created.json();
  proof.workspaceId = createdBody.id;
  assert.equal(createdBody.template, 'assignment', 'EXISTING_CLASSIFIER_DETECTS_ASSIGNMENT');
  assert.equal(createdBody.brief.fields.userInstructions, prompt, 'CANONICAL_ORIGINAL_INSTRUCTIONS');
  assert.equal(createdBody.draft.content, '', 'INSTRUCTIONS_ARE_NOT_THE_ANSWER_DRAFT');
  assert.equal(createdBody.progress.workflow.autopilot.status, 'RUNNING');
  assert.ok(createdBody.progress.workflow.autopilot.consent);
  assert.ok(createdBody.progress.workflow.autopilot.maxAiSteps <= 5, 'STAGING_ACCEPTANCE_SERVER_CAP');
  proof.checks.oneConfirmationStart = 'PASS';
  proof.checks.instructionResponseSeparation = 'PASS'; writeProof();
  await page.waitForURL(url => url.pathname === `/library/workspace/${proof.workspaceId}`);

  proof.stage = 'AUTOMATIC_COMPREHENSION_AND_METHOD'; writeProof();
  let heldTimer;
  try {
    await Promise.race([held, new Promise((_, reject) => {
      heldTimer = setTimeout(() => reject(new Error('WORK_STEP_NOT_REACHED_AUTOMATICALLY')), 150_000);
    })]);
  } finally {
    clearTimeout(heldTimer);
  }
  const method = await readWorkspace(proof.workspaceId);
  assert.equal(method.status, 200);
  assert.equal(method.body.professor.currentPhase, 'WORK');
  assert.equal(method.body.progress.workflow.autopilot.aiSteps, 2);
  proof.checks.captureComprehensionMethodWorkAutomatic = 'PASS';

  proof.stage = 'OPTIONAL_PAUSE_F5_RELOGIN'; writeProof();
  const pause = page.waitForResponse(r => r.request().method() === 'POST'
    && new URL(r.url()).pathname.endsWith('/autopilot') && r.request().postDataJSON().action === 'pause');
  await page.getByTestId('workspace-autopilot-pause').click();
  assert.equal((await pause).status(), 201);
  const paused = await readWorkspace(proof.workspaceId);
  assert.equal(paused.body.progress.workflow.autopilot.status, 'PAUSED');
  releaseHeld();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: 'networkidle' });
  const afterF5 = await readWorkspace(proof.workspaceId);
  assert.equal(afterF5.body.professor.currentPhase, 'WORK');
  assert.equal(afterF5.body.progress.workflow.autopilot.status, 'PAUSED');
  assert.equal(afterF5.body.progress.workflow.autopilot.aiSteps, 2);
  assert.equal(afterF5.body.assistantHistory.length, method.body.assistantHistory.length);
  proof.checks.pause = 'PASS'; proof.checks.f5Resume = 'PASS';
  await screenshot('paused-work-after-f5', page.getByTestId('workspace-autopilot'));
  await page.goto(`${baseUrl}/profile`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /sign out|log out|se déconnecter|déconnexion/iu }).last().click();
  await page.waitForFunction(() => !window.localStorage.getItem('sb.accessToken'));
  await login(`/library/workspace/${proof.workspaceId}`);
  const relogin = await readWorkspace(proof.workspaceId);
  assert.equal(relogin.body.userId, createdBody.userId);
  assert.equal(relogin.body.professor.currentPhase, 'WORK');
  assert.equal(relogin.body.progress.workflow.autopilot.status, 'PAUSED');
  assert.equal(relogin.body.progress.workflow.autopilot.aiSteps, 2);
  proof.checks.reloginResume = 'PASS'; writeProof();

  proof.stage = 'RESUME_AUTOMATIC_DRAFT_TO_COMPLETION'; writeProof();
  await page.getByTestId('workspace-autopilot-resume').click();
  let completed;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const result = await readWorkspace(proof.workspaceId);
    assert.equal(result.status, 200);
    const state = result.body.progress.workflow.autopilot;
    assert.ok(state.aiSteps <= 5, 'MAX_FIVE_AI_STEPS');
    if (state.status === 'COMPLETED') { completed = result.body; break; }
    if (['PAUSED_ERROR', 'NEEDS_INPUT', 'STOPPED'].includes(state.status)) {
      proof.blocker = { status: state.status, code: state.errorCode, reason: state.reason };
      throw new Error('AUTOPILOT_SAFELY_INTERRUPTED_REVIEW_REQUIRED');
    }
    await page.waitForTimeout(750);
  }
  assert.ok(completed, 'AUTOPILOT_COMPLETION_TIMEOUT');
  assert.equal(completed.professor.currentPhase, 'DECONSTRUCTION');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.progress.workflow.autopilot.aiSteps, 5);
  assert.equal(completed.brief.fields.userInstructions, prompt);
  assert.ok(completed.draft.content.trim());
  assert.notEqual(completed.draft.content.trim(), prompt);
  assert.ok(/25\s*(?:J|joules)/iu.test(completed.draft.content), 'REAL_KINETIC_ENERGY_25_JOULES');
  assert.ok(completed.completionChecks.filter(check => check.required).every(check => check.passed));
  assert.ok(completed.completion.snapshots.length > 0, 'AW8_CANONICAL_SNAPSHOT');
  const finalTurn = [...completed.assistantHistory].reverse().find(entry => entry.autopilot?.output.deconstruction);
  assert.ok(finalTurn?.autopilot.output.deconstruction?.trim(), 'PEDAGOGICAL_DECONSTRUCTION');
  proof.finalResult = {
    draft: completed.draft.content, deconstruction: finalTurn.autopilot.output.deconstruction,
    phase: completed.professor.currentPhase, checks: completed.completionChecks,
    transitionPath: completed.professor.transitions.map(item => `${item.from}->${item.to}`),
    finalSnapshotId: completed.completion.snapshots.at(-1).id,
  };
  proof.checks.resume = 'PASS'; proof.checks.automaticDraftVerificationFinalization = 'PASS';
  proof.checks.deconstruction = 'PASS'; proof.checks.realPhysicsResult = 'PASS';
  await page.getByTestId('workspace-autopilot-reply').waitFor();
  await screenshot('completed-result', page.getByTestId('workspace-autopilot-reply'));
  await page.reload({ waitUntil: 'networkidle' });
  const saved = await readWorkspace(proof.workspaceId);
  assert.equal(saved.body.status, 'completed');
  assert.equal(saved.body.draft.content, completed.draft.content);
  assert.equal(saved.body.progress.workflow.autopilot.status, 'COMPLETED');
  proof.checks.finalResultPersists = 'PASS';

  // Existing AW-8 endpoint and snapshot; no parallel export engine.
  const exported = await page.evaluate(async ({ id, snapshotId }) => {
    const token = window.localStorage.getItem('sb.accessToken');
    const response = await fetch(`/api/workspaces/${id}/exports`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: `autopilot-acceptance-markdown-${id}`, snapshotId, format: 'markdown', locale: 'fr' }),
    });
    const body = await response.json();
    return { status: response.status, content: body.content, snapshotId: body.snapshotId };
  }, { id: proof.workspaceId, snapshotId: proof.finalResult.finalSnapshotId });
  assert.equal(exported.status, 201);
  assert.ok(exported.content.includes(completed.draft.content));
  proof.checks.aw8MarkdownOutput = 'PASS';
  // Reuse the explicit AW-8 reopen action before exercising the persisted undo.
  // Only this technical dossier is changed; the immutable final snapshot remains.
  await page.getByTestId('workspace-autopilot-continue-editing').click();
  await page.getByTestId('workspace-autopilot-undo').waitFor();
  const undoResponse = page.waitForResponse(r => r.request().method() === 'POST'
    && new URL(r.url()).pathname.endsWith('/autopilot') && r.request().postDataJSON().action === 'undo');
  await page.getByTestId('workspace-autopilot-undo').click();
  assert.equal((await undoResponse).status(), 201);
  const undone = await readWorkspace(proof.workspaceId);
  assert.equal(undone.status, 200);
  assert.equal(undone.body.draft.content, '', 'UNDO_RESTORES_PREVIOUS_TECHNICAL_DRAFT');
  assert.equal(undone.body.brief.fields.userInstructions, prompt);
  assert.equal(undone.body.progress.workflow.autopilot.status, 'PAUSED');
  assert.ok(undone.body.completion.snapshots.some(snapshot => snapshot.id === proof.finalResult.finalSnapshotId));
  proof.checks.undoRevisionSafety = 'PASS';
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal((await readWorkspace(proof.workspaceId)).body.draft.content, '');
  proof.checks.undoPersists = 'PASS';
  proof.status = 'PASS'; proof.stage = 'DONE';
} catch (error) {
  proof.status = 'FAIL';
  proof.failure = String(error?.message ?? 'UNKNOWN').split('\n')[0].slice(0, 240);
  releaseHeld();
  await screenshot('failure').catch(() => undefined);
  process.exitCode = 1;
} finally {
  await Promise.allSettled([...responseTasks]);
  proof.finalUrl = page.url();
  proof.requestIds = [...new Set(proof.requestIds)];
  writeProof();
  console.log(JSON.stringify({ status: proof.status, stage: proof.stage, checks: proof.checks, maxObservedAiSteps: proof.maxObservedAiSteps, blocker: proof.blocker, failure: proof.failure, evidencePath }));
  await browser.close();
}
