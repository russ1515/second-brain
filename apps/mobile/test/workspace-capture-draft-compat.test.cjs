'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../lib/workspace-capture-draft.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: sourcePath,
}).outputText;

const storage = new Map();
const asyncStorage = {
  getItem: async (key) => storage.get(key) ?? null,
  setItem: async (key, value) => { storage.set(key, value); },
  removeItem: async (key) => { storage.delete(key); },
};
const templates = ['assignment', 'memoire', 'tfc', 'dissertation', 'article', 'report', 'academic-research', 'other'];
const draftModule = { exports: {} };
const loadDraftModule = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
loadDraftModule(
  draftModule.exports,
  (request) => {
    if (request === '@react-native-async-storage/async-storage') return asyncStorage;
    if (request === '@second-brain/shared') return { WORKSPACE_TEMPLATES: templates };
    if (request === './workspace-capture-flow') {
      return { workspaceCaptureSignature: (value) => `aw1-v1:${String(value).length}:${'0'.repeat(32)}` };
    }
    return Module.createRequire(sourcePath)(request);
  },
  draftModule,
  sourcePath,
  path.dirname(sourcePath),
);

const { loadWorkspaceCaptureDraft } = draftModule.exports;

function legacyDraft(template, additions = {}) {
  return {
    version: 1,
    mode: 'text',
    title: 'Recovered draft',
    objective: '',
    template,
    initialContent: 'Persistent capture',
    sources: [],
    trackedDocumentId: null,
    attachmentId: 'capture-1',
    createRequestId: null,
    createSignature: null,
    updatedAt: '2026-10-14T00:00:00.000Z',
    ...additions,
  };
}

async function load(value, userId = 'compat-user') {
  storage.clear();
  storage.set(`sb.workspace.capture.v1.${userId}`, JSON.stringify(value));
  return loadWorkspaceCaptureDraft(userId);
}

test('a pre-AW-3 non-default template remains an explicit persisted choice', async () => {
  const restored = await load(legacyDraft('report'));
  assert.equal(restored.template, 'report');
  assert.equal(restored.templateOverridden, true);
});

test('the historical assignment default remains eligible for deterministic classification', async () => {
  const restored = await load(legacyDraft('assignment'));
  assert.equal(restored.template, 'assignment');
  assert.equal(restored.templateOverridden, false);
});

test('an AW-3 draft explicitly marked as not overridden remains classifiable', async () => {
  const restored = await load(legacyDraft('report', { templateOverridden: false }));
  assert.equal(restored.template, 'report');
  assert.equal(restored.templateOverridden, false);
});

test('an uncertain pre-AW-3 create retry freezes its template and idempotency pair', async () => {
  const signature = `aw1-v1:42:${'a'.repeat(32)}`;
  const restored = await load(legacyDraft('assignment', {
    createRequestId: 'workspace-request-1',
    createSignature: signature,
  }));
  assert.equal(restored.templateOverridden, true);
  assert.equal(restored.createRequestId, 'workspace-request-1');
  assert.equal(restored.createSignature, signature);
});
