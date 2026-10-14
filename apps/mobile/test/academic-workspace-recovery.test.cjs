'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const screenPath = path.resolve(__dirname, '../app/library/workspace/[id].tsx');
const i18nPath = path.resolve(__dirname, '../lib/i18n.tsx');
const screen = fs.readFileSync(screenPath, 'utf8');
const i18n = fs.readFileSync(i18nPath, 'utf8');

test('workspace saves are serialized and stop after a revision conflict', () => {
  assert.match(screen, /saveQueueRef\.current\.then\([\s\S]*persist\(nextContent\)/);
  assert.match(screen, /if \(conflictActiveRef\.current\) \{[\s\S]*content: latestContent[\s\S]*return false/);
  assert.match(screen, /apiError\.status === 409[\s\S]*conflictActiveRef\.current = true/);
  assert.match(screen, /apiError\.status === 409[\s\S]*const latestContent = contentRef\.current[\s\S]*content: latestContent/);
  assert.equal((screen.match(/`\/workspaces\/\$\{workspace\.id\}\/autosave`/g) ?? []).length, 1);
});

test('a successful create releases its idempotency key before navigation', () => {
  const createScreen = fs.readFileSync(
    path.resolve(__dirname, '../app/library/workspace/index.tsx'),
    'utf8',
  );
  assert.match(
    createScreen,
    /await api<PersistentWorkspace>\('\/workspaces',[\s\S]*createRequestRef\.current = null;[\s\S]*router\.push/,
  );
});

test('dirty drafts flush or block silent loss on all supported exit paths', () => {
  assert.match(screen, /AppState\.addEventListener\('change'/);
  assert.match(screen, /window\.addEventListener\('beforeunload'/);
  assert.match(screen, /navigation\.addListener\('beforeRemove'/);
  assert.match(screen, /event\.preventDefault\(\)/);
  assert.match(screen, /saveRef\.current\(pending\)/);
  assert.match(screen, /contentRef\.current !== lastSavedRef\.current/);
});

test('409 recovery retains local text and exposes explicit reload and copy controls', () => {
  assert.match(screen, /setConflictDraft\(\{ content: latestContent, serverReloaded: false/);
  assert.match(screen, /testID="workspace-conflict-reload"/);
  assert.match(screen, /testID="workspace-conflict-copy"/);
  assert.match(screen, /testID="workspace-conflict-local-draft"/);
  assert.match(screen, /editable=\{false\}[\s\S]*selectTextOnFocus/);
  assert.match(screen, /conflictActiveRef\.current[\s\S]*content: value, copyState: 'idle'/);
  assert.doesNotMatch(screen, /serverReloaded[^\n]*merge|merge[^\n]*serverReloaded/i);
});

test('recovery UI reuses existing localized copy, reload and conflict messages', () => {
  for (const key of [
    'app.dismiss',
    'error.conflict',
    'globalPath.copy',
    'globalPath.copyDone',
    'health.refresh',
    'workspace10.conflict',
  ]) {
    assert.ok(i18n.includes(`'${key}':`), key);
  }
});
