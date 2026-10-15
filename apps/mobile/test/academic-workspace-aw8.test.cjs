'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const completionPath = path.join(ROOT, 'apps/mobile/components/workspace/completion.tsx');
const screenPath = path.join(ROOT, 'apps/mobile/app/library/workspace/[id].tsx');

function source(file) {
  assert.equal(fs.existsSync(file), true, `${path.relative(ROOT, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

test('AW-8 mounts one server-authoritative completion surface and flushes autosave first', () => {
  const completion = source(completionPath);
  const screen = source(screenPath);

  assert.match(completion, /export function WorkspaceCompletion/);
  assert.match(completion, /\/workspaces\/\$\{workspaceId\}\/completion/);
  assert.match(completion, /\/workspaces\/\$\{workspaceId\}\/finalize/);
  assert.match(completion, /expectedRevision/);
  assert.match(completion, /await onPrepareMutation\(\)/);
  assert.match(screen, /const prepareCompletionMutation = async/);
  assert.match(screen, /pendingDraft !== lastSavedRef\.current && !await save\(pendingDraft\)/);
  assert.match(screen, /contentRef\.current !== lastSavedRef\.current/);
  assert.match(screen, /<WorkspaceCompletion\b/);
});

test('AW-8 exports only a server snapshot and keeps export separate from archive', () => {
  const completion = source(completionPath);
  const exportBlock = completion.slice(
    completion.indexOf('const exportSnapshot'),
    completion.indexOf('const archive'),
  );

  assert.match(exportBlock, /completion\.latestSnapshot\.id/);
  assert.match(exportBlock, /format,/);
  assert.match(exportBlock, /locale,/);
  assert.match(exportBlock, /\/exports/);
  assert.match(exportBlock, /savePdfExport/);
  assert.match(exportBlock, /saveMarkdownExport/);
  assert.doesNotMatch(exportBlock, /\/archive|status:\s*['"]archived['"]/);
  assert.doesNotMatch(exportBlock, /draft|selectedText|proposal/);
});

test('AW-8 uses existing PDF and file capabilities with non-empty guards', () => {
  const completion = source(completionPath);

  assert.match(completion, /import \* as Print from ['"]expo-print['"]/);
  assert.match(completion, /import \* as FileSystem from ['"]expo-file-system['"]/);
  assert.match(completion, /Print\.printAsync\(\{ html: response\.html \}\)/);
  assert.match(completion, /Print\.printToFileAsync\(\{ html: response\.html \}\)/);
  assert.match(completion, /FileSystem\.writeAsStringAsync/);
  assert.match(completion, /response\.content\.trim\(\)/);
  assert.match(completion, /response\.html\.trim\(\)/);
});

test('AW-8 archive is confirmed, closes separately, and restore remains explicit', () => {
  const completion = source(completionPath);

  assert.match(completion, /workspace-archive-request/);
  assert.match(completion, /workspace-archive-confirmation/);
  assert.match(completion, /workspace-archive-confirm/);
  assert.match(completion, /\/workspaces\/\$\{workspaceId\}\/archive/);
  assert.match(completion, /workspace-restore/);
  assert.match(completion, /\/workspaces\/\$\{workspaceId\}\/restore/);
  assert.match(completion, /onContinueWorking/);
  assert.match(completion, /completion\?\.status \?\? status\) === ['"]completed['"]/);
  assert.match(completion, /latestSnapshot \|\| \(!archived && completed\)/);
  assert.match(completion, /!archived && completed && latestSnapshot/);
});

test('AW-8 archived workspaces are consultable without active editing surfaces', () => {
  const screen = source(screenPath);

  assert.match(screen, /workspaceReadOnly = completionLocked \|\| workspace\.status === ['"]archived['"] \|\| workspace\.status === ['"]completed['"]/);
  assert.match(screen, /<BriefPanel[^>]*readOnly=\{workspaceReadOnly\}/);
  assert.match(screen, /<PlanPanel[^>]*readOnly=\{workspaceReadOnly\}/);
  assert.match(screen, /<SourcesPanel[\s\S]*?readOnly=\{workspaceReadOnly\}/);
  assert.match(screen, /workspace-assistant-read-only/);
  assert.match(screen, /editable=\{!readOnly\}/);
});

test('AW-8 retains AW-7 state and requires no AI operation', () => {
  const completion = source(completionPath);
  const screen = source(screenPath);

  assert.doesNotMatch(completion, /\/assist|\/tools|Llm|OpenAI|provider/i);
  assert.match(screen, /\.\.\.current\.progress\.workflow,[\s\S]*?professor/);
  assert.match(screen, /<WorkspaceAssistant\b/);
  assert.match(screen, /onApplyToolProposal=\{applyWorkspaceToolProposal\}/);
});

test('AW-8 uses locale direction, responsive actions and translated labels', () => {
  const completion = source(completionPath);

  assert.match(completion, /localeDirection\(locale\) === ['"]rtl['"]/);
  assert.match(completion, /compact \? ['"]column['"] : rtl \? ['"]row-reverse['"] : ['"]row['"]/);
  assert.match(completion, /accessibilityRole="list"/);
  assert.match(completion, /accessibilityRole="text"/);
  assert.match(completion, /t\(['"]workspace10\./);
  assert.doesNotMatch(completion, />\s*(Finalize|Archive|Restore|Export|Continue)\s*</);
  assert.doesNotMatch(completion, /return error\.message/);
  assert.doesNotMatch(completion, /profile\.kyc\.incomplete/);
  assert.match(completion, /workspace_completion_idempotency_conflict/);
});

test('AW-8 retries local delivery with the same logical server export', () => {
  const completion = source(completionPath);
  const exportBlock = completion.slice(
    completion.indexOf('const exportSnapshot'),
    completion.indexOf('const archive'),
  );

  assert.match(exportBlock, /pendingExportRef\.current\[format\] = request/);
  assert.match(exportBlock, /caught instanceof ApiError && caught\.status !== 0/);
  assert.doesNotMatch(exportBlock, /!\(caught instanceof ApiError\) \|\| caught\.status !== 0/);
});
