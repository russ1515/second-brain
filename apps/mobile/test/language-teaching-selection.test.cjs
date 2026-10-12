'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');

test('teaching-language selection is explicit for new and existing paths', () => {
  const screen = read('app/languages/index.tsx');
  assert.match(screen, /LANGUAGE_TEACHING_SOURCES/);
  assert.match(screen, /testID="language-create-teaching-source"/);
  assert.match(screen, /teachingLanguageSource: teachingSource/);
  assert.match(screen, /testID="language-teaching-source"/);
  assert.match(screen, /method: 'PATCH'/);
  assert.match(screen, /body: \{ teachingLanguageSource: teachingSource \}/);
  assert.match(screen, /rlle\.ui\.teachingLanguage\.existingCourse/);
  assert.doesNotMatch(screen, /saveTeachingLanguage[\s\S]{0,900}startRlleCourse/);
});

test('bounded teaching-language copy keeps all 34 UI catalogs complete', () => {
  const overlayPath = path.join(mobileRoot, 'lib/locales/teaching-language-v1.ts');
  const source = fs.readFileSync(overlayPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: overlayPath,
  }).outputText;
  const translated = new Map();
  const compiled = new Module(overlayPath, module);
  compiled.filename = overlayPath;
  compiled.paths = Module._nodeModulePaths(path.dirname(overlayPath));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => id === '../i18n'
    ? { extendLocale: (locale, catalog) => translated.set(locale, catalog) }
    : normalRequire(id);
  compiled._compile(js, overlayPath);

  const keys = [...compiled.exports.teachingLanguageKeys];
  assert.deepEqual(keys, [
    'rlle.ui.teachingLanguage.detail',
    'rlle.ui.teachingLanguage.existingCourse',
  ]);
  assert.equal(translated.size, 32);
  for (const [code, catalog] of translated) {
    assert.deepEqual(Object.keys(catalog), keys, code);
    for (const value of Object.values(catalog)) assert.ok(value.trim(), code);
  }

  const sourceCatalog = read('lib/i18n.tsx');
  for (const key of keys) {
    assert.equal((sourceCatalog.match(new RegExp("'" + key.replaceAll('.', '\\.') + "':", 'g')) || []).length, 2, key);
  }
  assert.equal(new Set(['en', 'fr', ...translated.keys()]).size, 34);
  assert.match(read('lib/locales/index.ts'), /import ['"]\.\/teaching-language-v1['"];/);
});

test('pedagogical narration resolves the path teaching language, never the learning target', () => {
  const language = read('lib/language-teaching.ts');
  const tutor = read('app/tutor/[id].tsx');
  const tutorIndex = read('app/tutor/index.tsx');
  const lesson = read('app/lesson/[id].tsx');
  const daily = read('app/daily-session.tsx');
  assert.match(language, /teachingLanguageSource === 'native'/);
  assert.match(language, /toSupportedLanguage\(interfaceLocale\)/);
  assert.doesNotMatch(language, /profile\.language(?:Code)?/);
  assert.match(tutor, /useTeachingSpeechLanguage\(linkedLanguageProfileId\)/);
  assert.match(tutorIndex, /language=\{teachingLanguage\}/);
  assert.match(lesson, /language=\{teachingSpeechLanguage\}/);
  assert.match(daily, /language=\{teachingSpeechLanguage\}/);
  assert.doesNotMatch(tutor, /SpeakButton[^\n]+language=\{targetLanguage\}/);
});

test('TTS cache is cleared at every authenticated account boundary', () => {
  const speechApi = read('lib/speech-api.ts');
  const auth = read('lib/auth-context.tsx');
  assert.match(speechApi, /export function clearSpeechCache/);
  assert.match(speechApi, /synthesisCacheGeneration \+= 1/);
  assert.match(speechApi, /generation === synthesisCacheGeneration/);
  assert.match(speechApi, /for \(const controller of synthesisControllers\) controller\.abort\(\)/);
  assert.match(auth, /function clearAccountSpeech\(\)[\s\S]*stopSpeaking\(\);[\s\S]*clearSpeechCache\(\);/);
  assert.ok((auth.match(/clearAccountSpeech\(\)/g) || []).length >= 4);
});
