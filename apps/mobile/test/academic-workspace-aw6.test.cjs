'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const workspace = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/[id].tsx'), 'utf8');
const workspaceHome = fs.readFileSync(path.resolve(__dirname, '../app/library/workspace/index.tsx'), 'utf8');
const capture = fs.readFileSync(path.resolve(__dirname, '../components/workspace/universal-capture.tsx'), 'utf8');
const captureDraft = fs.readFileSync(path.resolve(__dirname, '../lib/workspace-capture-draft.ts'), 'utf8');
const assistant = fs.readFileSync(path.resolve(__dirname, '../components/workspace/assistant.tsx'), 'utf8');

test('AW-6 source picker exposes owner-scoped documents, collections and canonical Brain', () => {
  assert.match(workspace, /api<LibraryPage>\('\/library\/paged\?filter=all&sort=newest&limit=50'\)/);
  assert.match(workspace, /api<Collection\[]>\('\/library\/collections'\)/);
  assert.match(workspace, /onToggleSource\(\{ kind: 'document', id: document\.id \}\)/);
  assert.match(workspace, /onToggleSource\(\{ kind: 'collection', id: collection\.id \}\)/);
  assert.match(workspace, /onToggleSource\(\{ kind: 'brain', id: 'brain' \}\)/);
});

test('AW-6 displays only server-resolved source status and never legacy client snapshots', () => {
  assert.match(workspace, /api<WorkspaceSourceStatesResponse>\(`\/workspaces\/\$\{workspaceId\}\/sources`\)/);
  assert.match(workspace, /sourceStates: WorkspaceSourceState\[]/);
  assert.match(workspace, /state\.availability === 'available'/);
  assert.match(workspace, /return t\('workspace10\.unavailable'\)/);
  assert.doesNotMatch(workspace, /return t\('state\.partial'\)/);
  assert.doesNotMatch(workspace, /preview\.synthesis|preview\.question|source\.synthesis|source\.question/);
});

test('AW-6 source previews only navigate to existing product routes', () => {
  assert.match(workspace, /router\.push\(`\/library\/\$\{source\.id\}`\)/);
  assert.match(workspace, /router\.push\('\/brain'\)/);
  assert.match(workspace, /pathname: '\/research', params: \{ experienceSessionId: source\.id \}/);
  assert.match(workspace, /preview\.kind === 'collection' \? undefined/);
});

test('every Workspace mutation sends source identifiers without client provenance', () => {
  assert.match(workspace, /const canonical = \{ kind: source\.kind, id: source\.id \}/);
  assert.match(workspaceHome, /sources: sources\.map\(canonicalWorkspaceSource\)/);
  assert.match(capture, /sources: sources\.map\(canonicalWorkspaceSource\)/);
  assert.match(capture, /sources: next\.map\(canonicalWorkspaceSource\)/);
  for (const source of [workspace, workspaceHome, capture]) {
    assert.match(source, /function canonicalWorkspaceSource[\s\S]*return \{ kind: source\.kind, id: source\.id \}/);
  }
  assert.match(captureDraft, /\['document', 'collection', 'research-source', 'brain'\]/);
});

test('manual Workspace creation can attach Brain without adding an alternate source engine', () => {
  assert.match(workspaceHome, /type SourceMode = 'documents' \| 'collections' \| 'brain'/);
  assert.match(workspaceHome, /options=\{\['documents', 'collections', 'brain'\] as const\}/);
  assert.match(workspaceHome, /selected\('brain', 'brain'\)/);
  assert.doesNotMatch(workspaceHome, /\/workspaces\/[^'"`]*\/sources\/query|RetrievalService|RagService/);
});

test('assistant renders only server citations with bounded previews and real destinations', () => {
  assert.match(assistant, /entry\.citations\?\.length/);
  assert.match(assistant, /citation\.citationLabel/);
  assert.match(assistant, /snippet=\{preview\.snippet\}/);
  assert.match(assistant, /router\.push\(`\/library\/\$\{citation\.documentId\}`\)/);
  assert.match(assistant, /router\.push\('\/brain'\)/);
  assert.match(assistant, /\^https:\\\/\\\//);
  assert.match(assistant, /citation\.url && \/\^https:/);
  assert.match(assistant, /entry\.evidenceStatus === 'none'/);
  assert.match(assistant, /research10\.noSourcesDetail/);
  assert.doesNotMatch(assistant, /synthesis|question.*citation/);
});
