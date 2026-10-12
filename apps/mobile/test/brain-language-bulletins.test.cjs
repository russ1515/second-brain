'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const file = path.resolve(__dirname, '../lib/brain-language-bulletins.ts');
const source = fs.readFileSync(file, 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: file,
}).outputText;
const compiled = new Module(file, module);
compiled.filename = file;
compiled.paths = Module._nodeModulePaths(path.dirname(file));
compiled._compile(js, file);
const { resolveBrainLanguageBulletins } = compiled.exports;

const profile = (id) => ({ id, language: `Language ${id}` });
const liveCourse = (id) => ({ kind: 'live', course: { profileId: id, masteryBulletins: [] } });

test('the general Brain keeps healthy language bulletins when one course is unavailable', async () => {
  const loaded = [];
  const result = await resolveBrainLanguageBulletins(undefined, {
    listProfiles: async () => [profile('a'), profile('b'), profile('c')],
    loadProfile: async () => { throw new Error('must not load one profile'); },
    loadCourse: async (id) => {
      loaded.push(id);
      if (id === 'b') throw new Error('temporary failure');
      return liveCourse(id);
    },
  });

  assert.deepEqual(loaded.sort(), ['a', 'b', 'c']);
  assert.deepEqual(result.items.map((item) => item.profile.id), ['a', 'c']);
  assert.equal(result.partial, true);
});

test('a contextual Brain profile stays scoped and fails loudly for retry', async () => {
  let listed = false;
  await assert.rejects(
    resolveBrainLanguageBulletins('target', {
      listProfiles: async () => { listed = true; return []; },
      loadProfile: async (id) => profile(id),
      loadCourse: async () => { throw new Error('course unavailable'); },
    }),
    /course unavailable/,
  );
  assert.equal(listed, false);
});

test('a contextual Brain profile returns its live bulletin source', async () => {
  const result = await resolveBrainLanguageBulletins('target', {
    listProfiles: async () => [],
    loadProfile: async (id) => profile(id),
    loadCourse: async (id) => liveCourse(id),
  });
  assert.equal(result.partial, false);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].profile.id, 'target');
});
