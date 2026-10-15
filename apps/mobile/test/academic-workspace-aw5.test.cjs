'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const screen = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/[id].tsx'), 'utf8');
const assistant = fs.readFileSync(path.resolve(__dirname, '../components/workspace/assistant.tsx'), 'utf8');
const i18n = fs.readFileSync(path.resolve(__dirname, '../lib/i18n.tsx'), 'utf8');
const aliases = fs.readFileSync(path.resolve(__dirname, '../lib/locales/global-path-v1.ts'), 'utf8');
const shellLocales = fs.readFileSync(path.resolve(__dirname, '../lib/locales/workspace-shells-v1.ts'), 'utf8');

const phases = [
  'CAPTURE',
  'COMPREHENSION',
  'METHOD',
  'WORK',
  'COACHING',
  'VERIFICATION',
  'FINALIZATION',
  'DECONSTRUCTION',
];

test('AW-5 keeps one Workspace Professor with a discreet phase and server transition controls', () => {
  assert.equal((screen.match(/<WorkspaceAssistant\b/g) ?? []).length, 1);
  assert.match(assistant, /testID="workspace-professor-phase"/);
  assert.match(assistant, /testID="workspace-professor-advance"/);
  assert.match(assistant, /POST|method: 'POST'/);
  assert.match(screen, /`\/workspaces\/\$\{workspace\.id\}\/transitions`/);
  assert.match(screen, /expectedPhase[\s\S]*requestedPhase[\s\S]*expectedRevision/);
  assert.doesNotMatch(assistant, /wizard|stepper/i);
});

test('all eight phases have a deterministic client CTA while the server remains authoritative', () => {
  for (const phase of phases) {
    assert.match(assistant, new RegExp(`case '${phase}'`));
    assert.equal((i18n.match(new RegExp(`'workspaceProfessor\\.phase\\.${phase}'`, 'g')) ?? []).length, 2);
  }
  assert.match(assistant, /case 'WORK': return 'VERIFICATION'/);
  assert.match(assistant, /professor\.currentPhase === 'WORK'[\s\S]*transition\('COACHING'\)/);
  assert.match(assistant, /case 'VERIFICATION': return requiredChecksReady \? 'FINALIZATION' : 'WORK'/);
  assert.match(assistant, /professor\.currentPhase === 'FINALIZATION'[\s\S]*transition\('WORK'\)/);
  assert.match(assistant, /case 'DECONSTRUCTION': return null/);
});
test('dirty draft is flushed before a Professor turn or phase transition and is never reloaded on failure', () => {
  assert.match(screen, /prepareProfessorAssist[\s\S]*await save\(pendingDraft\)[\s\S]*return revisionRef\.current/);
  assert.match(screen, /transitionProfessor[\s\S]*await save\(pendingDraft\)[\s\S]*expectedRevision = revisionRef\.current/);
  assert.match(assistant, /await onBeforeAssist\(\)/);
  assert.match(screen, /refreshProfessorState[\s\S]*assistantHistory: next\.assistantHistory[\s\S]*professor: next\.professor/);
  const professorRefresh = screen.slice(screen.indexOf('const refreshProfessorState'), screen.indexOf('const handleProfessorAssistFailure'));
  assert.doesNotMatch(professorRefresh, /setContent|contentRef\.current\s*=/);
  assert.doesNotMatch(screen, /professorAssistActiveRef/);
  assert.match(screen, /handleBeforeUnload[\s\S]*saveRef\.current\(pending\)/);
});

test('assistant and transition retries preserve idempotency, draft conflicts and visible history', () => {
  assert.match(assistant, /createClientRequestId\('workspace-assist'\)/);
  assert.match(screen, /createClientRequestId\('workspace-transition'\)/);
  assert.match(assistant, /expectedPhase:[\s\S]*expectedRevision:/);
  assert.match(assistant, /entry\.role === 'user'[\s\S]*entry\.requestId === logicalRequestId/);
  assert.match(assistant, /entry\.role === 'assistant'[\s\S]*entry\.requestId === response\.reply\.requestId/);
  assert.match(assistant, /operation\?\.status === 'completed'/);
  assert.match(assistant, /operation\?\.status === 'pending'/);
  assert.match(assistant, /operation\?\.status === 'failed'/);
  const applyProfessor = screen.slice(screen.indexOf('const applyProfessorState'), screen.indexOf('const prepareProfessorAssist'));
  assert.doesNotMatch(applyProfessor, /revisionRef\.current\s*=/);
  assert.match(screen, /draftStillCanonical = next\.draft\.content === lastSavedRef\.current/);
  assert.match(screen, /draftStillCanonical[\s\S]*revisionRef\.current = next\.autosaveRevision/);
  assert.match(screen, /conflictActiveRef\.current = true[\s\S]*setConflictDraft/);
  assert.match(screen, /transitionRequestRef/);
});

test('AW-5 phase labels remain complete in all 34 interface languages', () => {
  for (const phase of ['CAPTURE', 'COMPREHENSION', 'METHOD', 'WORK', 'COACHING']) {
    assert.match(aliases, new RegExp(`'workspaceProfessor\\.phase\\.${phase}'`));
  }
  for (const phase of ['VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION']) {
    assert.equal(
      (shellLocales.match(new RegExp(`'workspaceProfessor\\.phase\\.${phase}'`, 'g')) ?? []).length,
      32,
    );
  }
});
