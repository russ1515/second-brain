'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const toolsPath = path.join(ROOT, 'apps/mobile/components/workspace/tools.tsx');
const assistantPath = path.join(ROOT, 'apps/mobile/components/workspace/assistant.tsx');
const screenPath = path.join(ROOT, 'apps/mobile/app/library/workspace/[id].tsx');

function source(file) {
  assert.equal(fs.existsSync(file), true, `${path.relative(ROOT, file)} must exist`);
  return fs.readFileSync(file, 'utf8');
}

test('AW-7 mounts one compact Workspace Tools surface driven by shell and Professor phase', () => {
  const tools = source(toolsPath);
  const assistant = source(assistantPath);
  const screen = source(screenPath);

  assert.match(tools, /export function WorkspaceTools/);
  assert.match(tools, /testID=["']workspace-tools["']/);
  assert.match(tools, /\/workspaces\/\$\{workspaceId\}\/tools/);
  assert.match(tools, /workspace-tool-\$\{tool\.toolId\}/);
  assert.match(tools, /workspace-tools-more/);
  assert.match(assistant, /<WorkspaceTools\b/);
  assert.match(assistant, /shellKind=/);
  assert.match(assistant, /phase=/);
  assert.match(assistant, /currentRevision=\{draftRevision\}/);
  assert.match(screen, /<WorkspaceAssistant\b/);
});

test('AW-7 renders a proposal and AW-6 citations before any explicit apply', () => {
  const tools = source(toolsPath);

  assert.match(tools, /workspace-tool-proposal/);
  assert.match(tools, /SourceCitation/);
  assert.match(tools, /SourcePreview/);
  assert.match(tools, /workspace-tool-apply/);
  assert.match(tools, /workspace-tool-reject/);
  assert.doesNotMatch(tools, /setContent\s*\(/);
  assert.match(
    tools,
    /disabled=\{proposal\.status\s*!==\s*['"]ready['"]\s*\|\|\s*stale\s*\|\|\s*rejecting\}/,
    'source-unavailable proposals must never expose an active apply action',
  );
});

test('AW-7 calls the owner-scoped execute/apply/reject API with stable request identity', () => {
  const tools = source(toolsPath);
  const screen = source(screenPath);

  assert.match(tools, /\/workspaces\/\$\{[^}]+\}\/tools\/\$\{[^}]+\}/);
  assert.match(screen, /\/tools\/\$\{proposal\.toolId\}\/apply/);
  assert.match(tools, /\/reject/);
  assert.match(tools, /requestId/);
  assert.match(tools, /expectedRevision/);
  assert.match(tools, /method:\s*['"]POST['"]/);
  assert.match(
    tools,
    /apiError\.status\s*===\s*409\s*&&\s*apiErrorCode\(apiError\)\s*===\s*['"]workspace_tool_in_progress['"]/,
    'a retry that finds its operation pending must retain the same request id',
  );
  assert.match(
    tools,
    /if\s*\(executionStillAmbiguous\s*&&\s*executedRequest\)\s*\{[\s\S]*?setUncertainRun\(\{[\s\S]*?request:\s*executedRequest/,
  );
});

test('AW-7 flushes dirty draft state and exposes controlled stale-revision recovery', () => {
  const tools = source(toolsPath);
  const assistant = source(assistantPath);
  const screen = source(screenPath);

  assert.match(tools, /onBeforeRun/);
  assert.match(assistant, /onBeforeRun=\{onBeforeAssist\}/);
  assert.match(tools, /apiError\.status\s*===\s*409/);
  assert.match(tools, /workspace-tool-stale/);
  assert.match(
    tools,
    /proposal\s*&&\s*currentRevision\s*>\s*proposal\.baseRevision/,
    'a parent render lagging behind the autosave revision must not create a false stale proposal',
  );
  assert.doesNotMatch(
    tools,
    /proposal\s*&&\s*currentRevision\s*!==\s*proposal\.baseRevision/,
  );

  const applyBlock = screen.slice(
    screen.indexOf('const applyWorkspaceToolProposal'),
    screen.indexOf('const undoAssistantInsertion'),
  );
  const remoteApply = applyBlock.indexOf('await api<WorkspaceToolApplyResponse>');
  const lateEditGuard = applyBlock.indexOf('contentRef.current !== currentDraft');
  const editorReplacement = applyBlock.indexOf('setContent(nextContent)');
  assert.ok(remoteApply >= 0 && lateEditGuard > remoteApply && editorReplacement > lateEditGuard,
    'an edit made while apply is in flight must be detected before replacing editor content');
  assert.match(
    screen,
    /onChange=\{\(value\)\s*=>\s*\{[\s\S]*?contentRef\.current\s*=\s*value;[\s\S]*?setContent\(value\)/,
    'the editor must publish keystrokes to the in-flight guard synchronously',
  );
  assert.match(tools, /start:\s*selection\.start,[\s\S]*?end:\s*selection\.end,[\s\S]*?text:\s*selectedText\.trim\(\)/);
  assert.match(assistant, /selection=\{selection\}/);
  assert.match(screen, /currentSelection\.start\s*!==\s*selectionAtRun\.start/);
  assert.match(screen, /currentSelection\.end\s*!==\s*selectionAtRun\.end/);
  assert.match(
    screen,
    /currentDraft\.slice\(selectionAtRun\.start,\s*selectionAtRun\.end\)\.trim\(\)\s*!==\s*selectionAtRun\.text/,
  );
  assert.match(
    screen,
    /currentDraft\.slice\(0,\s*selectionAtRun\.start\)[\s\S]*?currentDraft\.slice\(selectionAtRun\.end\)/,
    'replacement must use the immutable range captured when the tool ran',
  );
  assert.match(
    screen,
    /onSelection=\{\(nextSelection\)\s*=>\s*\{[\s\S]*?selectionRef\.current\s*=\s*nextSelection;[\s\S]*?setSelection\(nextSelection\)/,
    'selection movement must be visible synchronously to an in-flight apply guard',
  );
});

test('AW-7 reject never routes draft content through an apply callback', () => {
  const tools = source(toolsPath);
  const rejectBlock = tools.match(/const\s+reject\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*{[\s\S]*?\n\s*}/);
  assert.ok(rejectBlock, 'a dedicated reject handler must exist');
  assert.doesNotMatch(rejectBlock[0], /onApply|draft\s*:/);
});
