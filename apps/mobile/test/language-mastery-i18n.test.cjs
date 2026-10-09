'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');
const localeRoot = path.join(mobileRoot, 'lib/locales');
const sourceCatalogPath = path.join(mobileRoot, 'lib/i18n.tsx');
const overlayPath = path.join(localeRoot, 'language-mastery-v1.ts');
const masteryKeys = [
  'rlle.ui.autonomy.notice',
  'rlle.ui.autonomy.verdict.mastered',
  'rlle.ui.autonomy.verdict.not-mastered',
  'rlle.ui.autonomy.verdict.not-evaluable',
  'rlle.ui.autonomy.leaveForHelp',
  'rlle.ui.autonomy.start',
  'rlle.ui.autonomy.resume',
  'rlle.ui.remediation.start',
  'rlle.ui.remediation.ready',
  'rlle.ui.training.format.recognition-mcq',
  'rlle.ui.training.format.contextual-discrimination',
  'rlle.ui.training.format.fill-blank-no-hint',
  'rlle.ui.training.format.sentence-reconstruction',
  'rlle.ui.training.format.register-matching',
  'rlle.ui.training.format.error-correction',
  'rlle.ui.training.format.listening-discrimination',
  'rlle.ui.training.format.guided-writing',
  'rlle.ui.training.format.voice-pronunciation',
  'rlle.ui.training.format.mini-dialogue',
  'rlle.ui.training.tokenBank',
  'rlle.ui.training.voice',
  'rlle.ui.training.answer',
  'rlle.ui.capabilities.title',
  'rlle.ui.capabilities.detail',
  'rlle.ui.capabilities.audioCapture',
  'rlle.ui.capabilities.transcription',
  'rlle.ui.capabilities.spokenContent',
  'rlle.ui.capabilities.listening',
  'rlle.ui.capabilities.graphy',
  'rlle.ui.capabilities.pronunciation',
  'rlle.ui.capabilities.available',
  'rlle.ui.capabilities.runtimeRequired',
  'rlle.ui.capabilities.notEvaluable',
  'rlle.ui.capabilities.providerReady',
  'rlle.ui.capabilities.blocked',
  'rlle.ui.capabilities.blockedDetail',
  'rlle.ui.capabilities.checkMicrophone',
  'rlle.ui.capabilities.strictDisabled',
];
const generatedFiles = {
  ar: 'ar.ts', bn: 'bn.ts', cs: 'cs.ts', da: 'da.ts', de: 'de.ts', el: 'el.ts',
  es: 'es.ts', fi: 'fi.ts', ha: 'ha.ts', he: 'he.ts', hi: 'hi.ts', hu: 'hu.ts',
  id: 'id.ts', it: 'it.ts', ja: 'ja.ts', ko: 'ko.ts', ln: 'ln.ts', nb: 'no.ts',
  nl: 'nl.ts', pl: 'pl.ts', pt: 'pt.ts', ro: 'ro.ts', ru: 'ru.ts', sv: 'sv.ts',
  sw: 'sw.ts', th: 'th.ts', tr: 'tr.ts', uk: 'uk.ts', vi: 'vi.ts', wo: 'wo.ts',
  zh: 'zh.ts', 'zh-Hant': 'zh-Hant.ts',
};

function loadOverlay() {
  const source = fs.readFileSync(overlayPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: overlayPath,
  }).outputText;
  const aliased = new Map();
  const compiled = new Module(overlayPath, module);
  compiled.filename = overlayPath;
  compiled.paths = Module._nodeModulePaths(path.dirname(overlayPath));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => id === '../i18n'
    ? {
        extendLocaleAliases: (locale, aliases) => aliased.set(locale, aliases),
      }
    : normalRequire(id);
  compiled._compile(js, overlayPath);
  return { exports: compiled.exports, aliased };
}

function hasGeneratedKey(code, key) {
  const source = fs.readFileSync(path.join(localeRoot, generatedFiles[code]), 'utf8');
  return source.includes('"' + key + '":');
}

test('the autonomous mastery UI is technically covered in all 34 locales', () => {
  const { exports, aliased } = loadOverlay();
  assert.deepEqual([...exports.languageMasteryKeys], masteryKeys);
  assert.equal(aliased.size, 32);

  for (const code of exports.languageMasteryLocaleCodes) {
    const aliases = aliased.get(code);
    assert.ok(aliases, code + ' alias overlay was not registered');
    assert.deepEqual(Object.keys(aliases), masteryKeys);
    for (const [targetKey, sourceKey] of Object.entries(aliases)) {
      assert.ok(hasGeneratedKey(code, sourceKey), code + '.' + targetKey + ' source ' + sourceKey + ' is missing');
    }
  }

  assert.equal(new Set(['en', 'fr', ...aliased.keys()]).size, 34);
  assert.match(
    fs.readFileSync(path.join(localeRoot, 'index.ts'), 'utf8'),
    /import ['"]\.\/language-mastery-v1['"];/,
  );
});

test('English and French use precise mastery copy without placeholder drift', () => {
  const source = fs.readFileSync(sourceCatalogPath, 'utf8');
  const parsed = ts.createSourceFile(sourceCatalogPath, source, ts.ScriptTarget.Latest, true);
  const catalogs = new Map();
  for (const statement of parsed.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !['en', 'fr'].includes(declaration.name.text)) continue;
      let initializer = declaration.initializer;
      while (
        ts.isAsExpression(initializer)
        || ts.isSatisfiesExpression(initializer)
        || ts.isParenthesizedExpression(initializer)
      ) initializer = initializer.expression;
      assert.ok(ts.isObjectLiteralExpression(initializer));
      const values = {};
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.name)) continue;
        assert.ok(ts.isStringLiteralLike(property.initializer));
        values[property.name.text] = property.initializer.text;
      }
      catalogs.set(declaration.name.text, values);
    }
  }
  for (const code of ['en', 'fr']) {
    const catalog = catalogs.get(code);
    assert.ok(catalog, code + ' source catalog is missing');
    for (const key of masteryKeys) {
      assert.ok(catalog[key]?.trim(), code + '.' + key + ' is blank');
      assert.deepEqual([...catalog[key].matchAll(/\{([^{}]+)\}/g)], [], code + '.' + key + ' placeholder drift');
    }
  }
  assert.match(catalogs.get('en')['rlle.ui.autonomy.notice'], /no hints/i);
  assert.match(catalogs.get('fr')['rlle.ui.autonomy.notice'], /aucun indice/i);
  assert.equal(catalogs.get('en')['rlle.ui.autonomy.verdict.mastered'], 'Mastered');
  assert.equal(catalogs.get('fr')['rlle.ui.autonomy.verdict.mastered'], 'Maîtrisé');
});
