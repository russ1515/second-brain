import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = (process.env.WORKSPACE_BROWSER_BASE_URL ?? '').replace(/\/+$/u, '');
const email = process.env.P1_INFRA_LEARNER_EMAIL ?? '';
const password = process.env.P1_BROWSER_PASSWORD ?? '';
const evidenceDir = process.env.WORKSPACE_BROWSER_EVIDENCE_DIR ?? '';
const confirmed = process.env.WORKSPACE_BROWSER_CONFIRM === 'I_UNDERSTAND_STAGING_ONLY';
const sourceSha = process.env.P1_STAGING_SHA ?? 'UNKNOWN';
const runId = (process.env.P1_RUN_ID ?? `workspace-${Date.now()}`).replace(/[^A-Za-z0-9_-]/gu, '-').slice(0, 80);

assert.equal(confirmed, true, 'WORKSPACE_BROWSER_CONFIRM_REQUIRED');
assert.match(baseUrl, /^https:\/\/beta\.secondbrainlearn\.com$/u, 'BETA_URL_REQUIRED');
assert.match(email, /^p1-browser-[a-z0-9-]+@example\.test$/u, 'TECHNICAL_LEARNER_REQUIRED');
assert.ok(password.length > 0, 'P1_BROWSER_PASSWORD_REQUIRED');
assert.ok(path.isAbsolute(evidenceDir), 'ABSOLUTE_EVIDENCE_DIR_REQUIRED');

const paths = [
  ['memoire', ['subject', 'researchQuestion']],
  ['tfc', ['subject', 'deliverable']],
  ['dissertation', ['subject', 'researchQuestion']],
  ['report', ['context', 'deliverable']],
  ['article', ['subject', 'researchQuestion']],
  ['assignment', ['subject', 'requirements']],
  ['academic-research', ['subject', 'researchQuestion']],
  ['other', ['deliverable']],
];

fs.mkdirSync(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  locale: 'en-US',
  reducedMotion: 'reduce',
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const results = [];
const createdIds = [];

async function archiveTechnicalWorkspace(id) {
  return page.evaluate(async (workspaceId) => {
    const token = window.localStorage.getItem('sb.accessToken');
    if (!token) return { status: 0 };
    const response = await window.fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    return { status: response.status };
  }, id);
}

async function archiveStaleTechnicalWorkspaces() {
  return page.evaluate(async () => {
    const token = window.localStorage.getItem('sb.accessToken');
    if (!token) return { listed: 0, archived: 0 };
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    const response = await window.fetch('/api/workspaces?limit=100', { headers });
    if (!response.ok) return { listed: 0, archived: 0 };
    const payload = await response.json();
    const technical = (Array.isArray(payload?.items) ? payload.items : [])
      .filter((item) => typeof item?.title === 'string' && item.title.startsWith('Workspace validation '));
    let archived = 0;
    for (const item of technical) {
      const result = await window.fetch(`/api/workspaces/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'archived' }),
      });
      if (result.ok) archived += 1;
    }
    return { listed: technical.length, archived };
  });
}

try {
  await page.goto(`${baseUrl}/sign-in?mode=login&returnTo=%2Flibrary%2Fworkspace`, { waitUntil: 'networkidle' });
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in/iu }).first().click();
  await page.waitForURL(/\/library\/workspace(?:\?|$)/u, { timeout: 30_000 });
  await page.getByTestId('workspace-create').waitFor({ state: 'visible' });
  const staleCleanup = await archiveStaleTechnicalWorkspaces();
  assert.equal(staleCleanup.archived, staleCleanup.listed, 'STALE_TECHNICAL_CLEANUP');

  const planSignatures = new Set();
  for (const [template, requiredFields] of paths) {
    await page.goto(`${baseUrl}/library/workspace`, { waitUntil: 'networkidle' });
    await page.getByTestId(`workspace-template-${template}`).click();
    await page.getByTestId('workspace-adaptive-fields').waitFor({ state: 'visible' });
    const fieldCount = await page.locator('[data-testid^="workspace-field-"]').count();
    assert.ok(fieldCount >= 6, `${template}: adaptive fields`);

    const preview = (await page.getByTestId('workspace-adaptive-plan').innerText()).replace(/\s+/gu, ' ').trim();
    assert.ok(preview.length > 30, `${template}: adapted plan preview`);
    planSignatures.add(preview);

    const title = `Workspace validation ${template} ${runId}`;
    const marker = `Technical browser save and resume proof for ${template} (${runId}).`;
    await page.getByTestId('workspace-title').fill(title);
    await page.getByTestId('workspace-objective').fill(`Validate the ${template} workflow without producing a complete academic work.`);
    for (const field of requiredFields) {
      await page.getByTestId(`workspace-field-${field}`).fill(`Technical ${field} for ${template}.`);
    }

    await page.getByTestId('workspace-create-action').click();
    await page.waitForURL(/\/library\/workspace\/[^/?#]+(?:\?.*)?$/u, { timeout: 30_000 });
    const workspaceId = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1);
    assert.ok(workspaceId, `${template}: workspace id`);
    createdIds.push(workspaceId);

    await page.getByTestId('workspace-adaptive-brief').waitFor({ state: 'visible' });
    await page.getByTestId('workspace-completion-controls').waitFor({ state: 'visible' });
    const persistedPlan = (await page.getByTestId('workspace-plan').innerText()).replace(/\s+/gu, ' ').trim();
    assert.ok(persistedPlan.length > 30, `${template}: persisted plan`);

    const draft = page.getByTestId('workspace-draft-input');
    await draft.fill(marker);
    const saveResponse = page.waitForResponse((response) => (
      response.request().method() === 'PATCH'
      && response.url().includes(`/api/workspaces/${workspaceId}/autosave`)
    ), { timeout: 15_000 });
    await page.getByTestId('workspace-save-draft').click();
    assert.equal((await saveResponse).status(), 200, `${template}: explicit save`);

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.getByTestId('workspace-draft-input').inputValue(), marker, `${template}: reload`);
    await page.goto(`${baseUrl}/library/workspace`, { waitUntil: 'networkidle' });
    await page.getByTestId(`workspace-resume-${workspaceId}`).waitFor({ state: 'visible' });
    await page.getByTestId(`workspace-open-${workspaceId}`).click();
    await page.waitForURL(new RegExp(`/library/workspace/${workspaceId}(?:\\?.*)?$`, 'u'));
    assert.equal(await page.getByTestId('workspace-draft-input').inputValue(), marker, `${template}: resume`);

    await page.screenshot({
      path: path.join(evidenceDir, `${runId}-${template}.png`),
      fullPage: true,
    });
    const archived = await archiveTechnicalWorkspace(workspaceId);
    assert.equal(archived.status, 200, `${template}: technical cleanup`);
    results.push({ template, adaptiveFields: fieldCount, created: true, saved: true, resumed: true, archived: true });
  }

  assert.equal(planSignatures.size, paths.length, 'ALL_PLAN_PREVIEWS_MUST_BE_DISTINCT');
  const evidence = {
    gate: 'WORKSPACE_PATHS_BROWSER',
    status: 'PASS',
    sourceSha,
    publicUrl: baseUrl,
    templates: results,
    distinctPlans: planSignatures.size,
    createdCount: results.length,
    archivedTechnicalCount: results.filter((item) => item.archived).length,
    staleTechnicalArchived: staleCleanup.archived,
    completedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(evidenceDir, `${runId}.json`), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`WORKSPACE_PATHS_BROWSER=PASS TEMPLATES=${results.length} DISTINCT_PLANS=${planSignatures.size} CLEANUP=${evidence.archivedTechnicalCount}\n`);
} finally {
  for (const id of createdIds.slice(results.length)) {
    await archiveTechnicalWorkspace(id).catch(() => undefined);
  }
  await context.close();
  await browser.close();
}
