'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const localeRoot = path.resolve(__dirname, '../lib/locales');

function loadOverlay(name) {
  const sourcePath = path.join(localeRoot, name);
  const source = fs.readFileSync(sourcePath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: sourcePath,
  }).outputText;
  const captured = new Map();
  const compiled = new Module(sourcePath, module);
  compiled.filename = sourcePath;
  compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => id === '../i18n'
    ? { extendLocale: (locale, values) => captured.set(locale, values) }
    : normalRequire(id);
  compiled._compile(js, sourcePath);
  return { exports: compiled.exports, captured };
}

function placeholders(value) {
  return [...String(value).matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((match) => match[0]).sort();
}

test('all 34 locales expose every new learning-data control key without contract drift', () => {
  const groups = [
    ['learning-data-control-europe-v1.ts', 'learningDataControlEuropeLocales', 'learningDataControlKeys'],
    ['learning-data-control-asia-v1.ts', 'learningDataControlAsiaLocales', 'learningDataControlAsiaKeys'],
    ['learning-data-control-africa-v1.ts', 'learningDataControlAfricaLocales', 'learningDataControlAfricaKeys'],
  ].map(([file, localeExport, keyExport]) => ({ localeExport, keyExport, ...loadOverlay(file) }));
  const expectedLocales = [
    'en', 'fr', 'es', 'de', 'it', 'pt', 'hi', 'tr', 'pl', 'ru', 'zh', 'vi', 'ja',
    'sv', 'th', 'ar', 'ko', 'nl', 'el', 'cs', 'ro', 'hu', 'da', 'fi', 'id', 'nb',
    'uk', 'ln', 'sw', 'wo', 'ha', 'he', 'zh-Hant', 'bn',
  ].sort();

  const allLocales = ['en', 'fr'];
  let referenceKeys = null;
  for (const group of groups) {
    const locales = group.exports[group.localeExport];
    const keys = group.exports[group.keyExport];
    assert.ok(Array.isArray(locales) && Array.isArray(keys));
    assert.equal(keys.length, 54);
    if (referenceKeys) assert.deepEqual(keys, referenceKeys);
    else referenceKeys = keys;
    for (const locale of locales) {
      assert.ok(!allLocales.includes(locale), `duplicate locale ${locale}`);
      allLocales.push(locale);
      const values = group.captured.get(locale);
      assert.ok(values, `${locale} was not loaded`);
      assert.deepEqual(Object.keys(values), keys);
      for (const key of keys) {
        assert.ok(String(values[key]).trim(), `${locale}.${key} is empty`);
        if (key.includes('.count.') || key === 'learningControl.sharedPreserved') {
          assert.deepEqual(placeholders(values[key]), ['{count}'], `${locale}.${key}`);
        }
        if (key === 'library7.trash.permanentDetail') {
          assert.deepEqual(placeholders(values[key]), ['{title}'], `${locale}.${key}`);
        }
        if (key === 'library7.trash.empty' || key === 'library7.trash.emptyDetail') {
          assert.deepEqual(placeholders(values[key]), ['{n}'], `${locale}.${key}`);
        }
        if (key === 'priv.learningReset.typePrompt') {
          assert.match(values[key], /RÉINITIALISER/);
        }
      }
    }
  }
  assert.deepEqual(allLocales.sort(), expectedLocales);

  const sourceCopy = [
    fs.readFileSync(path.join(localeRoot, 'learning-control-v1.ts'), 'utf8'),
    fs.readFileSync(path.resolve(__dirname, '../lib/i18n.tsx'), 'utf8'),
  ].join('\n');
  for (const key of referenceKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const assignments = sourceCopy.match(new RegExp(`['"]${escaped}['"]\\s*:`, 'g')) ?? [];
    assert.ok(assignments.length >= 2, `en/fr source copy missing for ${key}`);
  }
});
