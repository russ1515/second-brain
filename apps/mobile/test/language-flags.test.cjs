const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const { SUPPORTED_LANGUAGE_CODES, SUPPORTED_LANGUAGES } = require('@second-brain/shared');

const ROOT = path.resolve(__dirname, '../../..');
const FLAGS = path.join(ROOT, 'apps/mobile/assets/flags');

function loadTypeScriptModule(file) {
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
  return module.exports;
}

test('every language has one licensed local Web SVG and native PNG asset', () => {
  const { LOCAL_FLAG_SVG_BY_REGION } = loadTypeScriptModule(path.join(FLAGS, 'index.ts'));
  const regions = new Set(SUPPORTED_LANGUAGE_CODES.map((code) => SUPPORTED_LANGUAGES[code].flagRegion));
  assert.equal(regions.size, 34);
  assert.deepEqual(Object.keys(LOCAL_FLAG_SVG_BY_REGION).sort(), [...regions].sort());

  for (const region of regions) {
    assert.match(LOCAL_FLAG_SVG_BY_REGION[region], /^data:image\/svg\+xml;charset=utf-8,/);
    const png = fs.readFileSync(path.join(FLAGS, 'png', `${region}.png`));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], region);
  }

  assert.match(fs.readFileSync(path.join(FLAGS, 'LICENSE.md'), 'utf8'), /CC0 1\.0 Universal/);
});

test('the unified renderer selects SVG on Web and bundled PNG on native', () => {
  const component = fs.readFileSync(path.join(ROOT, 'apps/mobile/components/ds/language-flag.tsx'), 'utf8');
  const native = fs.readFileSync(path.join(FLAGS, 'native.ts'), 'utf8');
  assert.match(component, /Platform\.OS\s*===\s*['\"]web['\"]/);
  assert.match(component, /LOCAL_FLAG_PNG_BY_REGION\[region\]/);
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const region = SUPPORTED_LANGUAGES[code].flagRegion;
    assert.match(native, new RegExp(`${region}: require\\(['\"]\\./png/${region}\\.png['\"]\\)`));
  }
});

test('existing language selectors reuse LanguageFlag instead of registry emoji fields', () => {
  const selectors = [
    'apps/mobile/components/ds/language.tsx',
    'apps/mobile/components/auth/kit.tsx',
    'apps/mobile/components/landing/language-experience.tsx',
    'apps/mobile/app/language-manager.tsx',
  ];
  for (const relative of selectors) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    if (relative.endsWith('auth/kit.tsx')) {
      assert.match(source, /LanguageSelector/);
    } else {
      assert.match(source, /LanguageFlag/);
    }
    assert.doesNotMatch(source, /\.neutralIcon|\.flag\b/);
  }
});

test('the compact shell choice shows the native language name, not only a code', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'apps/mobile/components/ds/language.tsx'),
    'utf8',
  );
  assert.match(source, /active\?\.name \?\? value\.toUpperCase\(\)/);
  assert.doesNotMatch(
    source,
    /compact[\s\S]{0,500}>\{value\.toUpperCase\(\)\}<\/Text>/,
  );
});
