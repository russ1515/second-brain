'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../lib/tutor-reply-pdf.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const calls = [];
const platform = { OS: 'ios' };
const mocks = {
  'expo-print': {
    printAsync: async ({ html }) => { calls.push({ kind: 'web-print', html }); },
    printToFileAsync: async ({ html }) => { calls.push({ kind: 'file', html }); return { uri: 'file:///cache/reply.pdf', numberOfPages: 1 }; },
  },
  'expo-file-system': {
    documentDirectory: 'file:///documents/',
    copyAsync: async (value) => { calls.push({ kind: 'copy', ...value }); },
    getInfoAsync: async (uri) => ({ exists: true, uri, isDirectory: false, size: 428, modificationTime: 0 }),
  },
  'react-native': {
    Platform: platform,
    Share: { share: async (value) => { calls.push({ kind: 'share', ...value }); return { action: 'sharedAction' }; } },
  },
};
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const compiled = new Module(sourcePath, module);
compiled.filename = sourcePath;
compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const normalRequire = compiled.require.bind(compiled);
compiled.require = (id) => mocks[id] ?? normalRequire(id);
compiled._compile(js, sourcePath);
const { saveTutorReplyAsPdf, tutorReplyHtml } = compiled.exports;

test('Tutor reply PDF escapes model content', () => {
  const html = tutorReplyHtml('Cours <test>', '<script>alert(1)</script>', 'fr-FR');
  assert.match(html, /Cours &lt;test&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('native Tutor PDF creates and verifies a non-empty persistent file URI', async () => {
  calls.length = 0;
  platform.OS = 'ios';
  const result = await saveTutorReplyAsPdf('Cours', 'Contenu', 'fr-FR');
  assert.match(result.uri, /^file:\/\/\/documents\/second-brain-reply-\d+\.pdf$/);
  assert.equal(result.bytes, 428);
  assert.ok(calls.some((call) => call.kind === 'file'));
  assert.ok(calls.some((call) => call.kind === 'copy'));
  assert.ok(calls.some((call) => call.kind === 'share'));
});

test('web Tutor PDF opens the browser print/save flow explicitly', async () => {
  calls.length = 0;
  platform.OS = 'web';
  const result = await saveTutorReplyAsPdf('Course', 'Content', 'en');
  assert.deepEqual(result, { uri: null, bytes: null });
  assert.ok(calls.some((call) => call.kind === 'web-print'));
  assert.ok(!calls.some((call) => call.kind === 'file'));
});
