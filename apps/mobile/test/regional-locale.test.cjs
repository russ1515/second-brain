const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');
const RESOLUTION_FILE = path.join(ROOT, 'apps/mobile/lib/locale-resolution.ts');
const I18N_FILE = path.join(ROOT, 'apps/mobile/lib/i18n.tsx');
const ROOT_LAYOUT_FILE = path.join(ROOT, 'apps/mobile/app/_layout.tsx');
const LANDING_FILE = path.join(ROOT, 'apps/mobile/components/landing/landing-page.tsx');

function loadTypeScriptModule(file) {
  const source = fs.readFileSync(file, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  const execute = new Function('require', 'module', 'exports', compiled);
  execute(require, module, module.exports);
  return module.exports;
}

const { resolveFormatLocale, resolveUiLocale } = loadTypeScriptModule(RESOLUTION_FILE);
const { SUPPORTED_LANGUAGE_CODES } = require('@second-brain/shared');

test('regional BCP 47 variants resolve to the supported base catalog', () => {
  const examples = {
    'fr-CA': 'fr',
    'pt-BR': 'pt',
    'pt_PT': 'pt',
    'zh-Hant-TW': 'zh',
    'es-419': 'es',
    'ar-MA': 'ar',
    'en-GB': 'en',
  };

  for (const [regionalLocale, expected] of Object.entries(examples)) {
    assert.equal(resolveUiLocale({ browserLocales: [regionalLocale] }), expected, regionalLocale);
  }
});

test('every registered UI language accepts a regional BCP 47 signal', () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.length, 27);

  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const regional = code === 'zh' ? 'zh-Hant-TW' : `${code}-ZZ`;
    assert.equal(resolveUiLocale({ browserLocales: [regional] }), code, regional);
  }
});

test('saved preference wins over ordered browser and device locales', () => {
  assert.equal(resolveUiLocale({
    savedLocale: 'de-CH',
    browserLocales: ['es-MX', 'fr-CA'],
    deviceLocale: 'it-IT',
  }), 'de');

  assert.equal(resolveUiLocale({
    browserLocales: ['es-MX', 'fr-CA'],
    deviceLocale: 'it-IT',
  }), 'es');
});

test('regional formatting keeps the first compatible canonical BCP 47 locale', () => {
  const examples = [
    ['fr', ['en-US', 'fr-ca'], null, 'fr-CA'],
    ['pt', ['pt-BR'], null, 'pt-BR'],
    ['en', ['en-gb'], null, 'en-GB'],
    ['zh', ['zh-hant-tw'], null, 'zh-Hant-TW'],
    ['pt', ['de-DE'], 'pt_BR', 'pt-BR'],
  ];

  for (const [uiLocale, browserLocales, deviceLocale, expected] of examples) {
    assert.equal(resolveFormatLocale({ uiLocale, browserLocales, deviceLocale }), expected);
  }
});

test('a saved UI language never borrows an incompatible browser region', () => {
  const signals = {
    savedLocale: 'fr',
    browserLocales: ['en-US'],
    deviceLocale: 'en-US',
  };
  const uiLocale = resolveUiLocale(signals);
  assert.equal(uiLocale, 'fr');
  assert.equal(resolveFormatLocale({
    uiLocale,
    browserLocales: signals.browserLocales,
    deviceLocale: signals.deviceLocale,
  }), 'fr');
});

test('invalid preferences are skipped and unsupported environments fall back to English', () => {
  assert.equal(resolveUiLocale({
    savedLocale: 'Klingon',
    browserLocales: ['xx-ZZ', 'uk-UA'],
    deviceLocale: 'fr-FR',
  }), 'uk');
  assert.equal(resolveUiLocale({
    savedLocale: 'xx-ZZ',
    browserLocales: ['tlh-Qo-noS'],
    deviceLocale: 'zz-ZZ',
  }), 'en');
});

test('the public Landing receives the resolved locale on its first client render', () => {
  const i18n = fs.readFileSync(I18N_FILE, 'utf8');
  const rootLayout = fs.readFileSync(ROOT_LAYOUT_FILE, 'utf8');

  assert.match(i18n, /useState<Locale>\(\(\)\s*=>\s*detectedDeviceLocale\(savedWebLocale\(\)\)\)/);
  assert.match(i18n, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(i18n, /navigator\.languages/);
  assert.match(i18n, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.locale/);
  assert.match(i18n, /formatLocale:\s*string/);
  assert.match(i18n, /resolveFormatLocale\(/);
  assert.match(rootLayout, /<I18nProvider>[\s\S]*?<AuthProvider>/);
});

test('Web metadata follows UI locale and automatic locale detection stays local-only', () => {
  const i18n = fs.readFileSync(I18N_FILE, 'utf8');
  const auth = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/auth-context.tsx'), 'utf8');
  const resolution = fs.readFileSync(RESOLUTION_FILE, 'utf8');
  const landing = fs.readFileSync(LANDING_FILE, 'utf8');

  assert.match(i18n, /document\.documentElement\.lang\s*=\s*locale/);
  assert.match(i18n, /document\.documentElement\.dir\s*=\s*localeDirection\(locale\)/);
  assert.doesNotMatch(i18n, /\/auth\/locale/);
  assert.doesNotMatch(auth, /\/auth\/locale/);
  assert.doesNotMatch(i18n, /geolocation|getCurrentPosition|ipapi|ipinfo/i);
  assert.doesNotMatch(resolution, /navigator\.geolocation|getCurrentPosition|ipapi|ipinfo/i);
  assert.match(landing, /localeDirection\(locale\)\s*===\s*'rtl'/);
  assert.doesNotMatch(landing, /RTL_LOCALES/);
});

test('learner date and number surfaces use formatLocale instead of a base or implicit locale', () => {
  const learnerFiles = [
    'apps/mobile/components/review/experience.tsx',
    'apps/mobile/components/language/course-ui.tsx',
    'apps/mobile/components/home/decision.tsx',
    'apps/mobile/components/document/grounded-ask.tsx',
    'apps/mobile/components/brain/digital-twin.tsx',
    'apps/mobile/components/profile/account.tsx',
    'apps/mobile/app/(tabs)/study.tsx',
    'apps/mobile/app/(tabs)/brain.tsx',
    'apps/mobile/app/calendar.tsx',
    'apps/mobile/app/exams.tsx',
    'apps/mobile/app/library.tsx',
    'apps/mobile/app/library/[id].tsx',
    'apps/mobile/app/languages/index.tsx',
    'apps/mobile/app/lesson/[id].tsx',
    'apps/mobile/app/progress.tsx',
    'apps/mobile/app/subscription.tsx',
    'apps/mobile/app/sync.tsx',
    'apps/mobile/app/tutor/index.tsx',
    'apps/mobile/app/tutor/[id].tsx',
    'apps/mobile/app/usage.tsx',
    'apps/mobile/lib/lesson-pdf.ts',
    'apps/mobile/lib/usage-display.ts',
  ];

  for (const relative of learnerFiles) {
    const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
    const regionalCalls = [
      ...source.matchAll(/(?:toLocale(?:String|DateString|TimeString)|Intl\.(?:DateTimeFormat|NumberFormat))\s*\(([^)]*)\)/g),
    ];
    for (const match of regionalCalls) {
      assert.match(match[1], /formatLocale/, `${relative} has an implicit or base-only regional formatter: ${match[0]}`);
    }
  }
});
