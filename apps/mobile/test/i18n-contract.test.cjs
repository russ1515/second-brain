const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');
const I18N_FILE = path.join(ROOT, 'apps/mobile/lib/i18n.tsx');
const LOCALES_DIR = path.join(ROOT, 'apps/mobile/lib/locales');
const SHARED_LANGUAGES_FILE = path.join(ROOT, 'packages/shared/src/languages.ts');

function sourceFile(file) {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression?.(current)
    || ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function objectLiteral(file, variableName) {
  const source = sourceFile(file);
  let result;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === variableName
      && node.initializer
    ) {
      const initializer = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) result = initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result, `Missing object literal ${variableName} in ${path.relative(ROOT, file)}`);
  return result;
}

function stringArray(file, variableName) {
  const source = sourceFile(file);
  let result;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === variableName
      && node.initializer
    ) {
      const initializer = unwrap(node.initializer);
      if (ts.isArrayLiteralExpression(initializer)) result = initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result, `Missing array ${variableName} in ${path.relative(ROOT, file)}`);
  return result.elements.map((element) => {
    const value = unwrap(element);
    assert.ok(ts.isStringLiteralLike(value), `Non-string value in ${variableName}`);
    return value.text;
  });
}

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) return property.name.text;
  return null;
}

function catalog(file, variableName) {
  const object = objectLiteral(file, variableName);
  const entries = new Map();
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = propertyName(property);
    const value = unwrap(property.initializer);
    assert.ok(key, `Unsupported catalog key in ${path.relative(ROOT, file)}`);
    assert.ok(ts.isStringLiteralLike(value), `Non-string translation for ${key}`);
    assert.ok(!entries.has(key), `Duplicate translation key ${key}`);
    entries.set(key, value.text);
  }
  return entries;
}

function nestedCatalog(file, variableName) {
  const object = objectLiteral(file, variableName);
  const catalogs = new Map();
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const code = propertyName(property);
    const value = unwrap(property.initializer);
    assert.ok(code && ts.isObjectLiteralExpression(value), `Invalid nested catalog ${code}`);
    const entries = new Map();
    for (const entry of value.properties) {
      assert.ok(ts.isPropertyAssignment(entry));
      const key = propertyName(entry);
      const translation = unwrap(entry.initializer);
      assert.ok(key && ts.isStringLiteralLike(translation));
      entries.set(key, translation.text);
    }
    catalogs.set(code, entries);
  }
  return catalogs;
}

function tupleCatalog(file, variableName, keys) {
  const object = objectLiteral(file, variableName);
  const catalogs = new Map();
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const code = propertyName(property);
    const value = unwrap(property.initializer);
    assert.ok(code && ts.isArrayLiteralExpression(value), `Invalid tuple catalog ${code}`);
    assert.equal(value.elements.length, keys.length, `Unexpected tuple length for ${code}`);
    const entries = new Map();
    value.elements.forEach((element, index) => {
      const translation = unwrap(element);
      assert.ok(ts.isStringLiteralLike(translation));
      entries.set(keys[index], translation.text);
    });
    catalogs.set(code, entries);
  }
  return catalogs;
}

function objectKeys(file, variableName) {
  return new Set(objectLiteral(file, variableName).properties.map(propertyName).filter(Boolean));
}

function placeholders(value) {
  return [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
}

function codeFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'test' || entry.name.startsWith('.')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...codeFiles(absolute));
    else if (/\.tsx?$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

const english = catalog(I18N_FILE, 'en');
const french = catalog(I18N_FILE, 'fr');
const supported = objectKeys(SHARED_LANGUAGES_FILE, 'SUPPORTED_LANGUAGES');
const essentials = nestedCatalog(path.join(LOCALES_DIR, 'essential.ts'), 'essential');
const learnerPassportEssentials = nestedCatalog(path.join(LOCALES_DIR, 'essential.ts'), 'learnerPassportEssential');
const supportBridgeEssentials = nestedCatalog(path.join(LOCALES_DIR, 'essential.ts'), 'supportBridgeEssential');
const reviewCatalogs = nestedCatalog(path.join(LOCALES_DIR, 'review.ts'), 'review');
const authErrorCatalogs = nestedCatalog(path.join(LOCALES_DIR, 'auth-errors.ts'), 'authErrors');
const voicePhase2Catalogs = nestedCatalog(path.join(LOCALES_DIR, 'voice-phase2.ts'), 'voicePhase2');
const libraryV1Catalogs = nestedCatalog(path.join(LOCALES_DIR, 'library-v1.ts'), 'libraryV1');
const libraryV1Organization = tupleCatalog(path.join(LOCALES_DIR, 'library-v1.ts'), 'organizationLabels', ['lib.types', 'libraryV1.type.notebook']);
const libraryV1Failures = tupleCatalog(path.join(LOCALES_DIR, 'library-v1.ts'), 'failureLabels', ['libraryV1.error.fileUnreadable', 'libraryV1.error.storage']);
const researchWebV1 = tupleCatalog(path.join(LOCALES_DIR, 'research-web-v1.ts'), 'researchWebV1', ['research10.externalUnavailable', 'research10.externalUnavailableDetail']);
const learningDataControlGroups = [
  {
    file: 'learning-data-control-europe-v1.ts',
    locales: 'learningDataControlEuropeLocales',
    keys: 'learningDataControlKeys',
    values: 'learningDataControlEuropeValues',
  },
  {
    file: 'learning-data-control-asia-v1.ts',
    locales: 'learningDataControlAsiaLocales',
    keys: 'learningDataControlAsiaKeys',
    values: 'learningDataControlAsiaValues',
  },
  {
    file: 'learning-data-control-africa-v1.ts',
    locales: 'learningDataControlAfricaLocales',
    keys: 'learningDataControlAfricaKeys',
    values: 'learningDataControlAfricaValues',
  },
].map((group) => {
  const file = path.join(LOCALES_DIR, group.file);
  const keys = stringArray(file, group.keys);
  return {
    ...group,
    file,
    keys,
    locales: stringArray(file, group.locales),
    catalogs: tupleCatalog(file, group.values, keys),
  };
});
const learningDataControlKeys = learningDataControlGroups[0].keys;
const learningDataControlCatalogs = new Map();
for (const group of learningDataControlGroups) {
  for (const [code, translations] of group.catalogs) {
    assert.ok(!learningDataControlCatalogs.has(code), `Duplicate learning-data locale ${code}`);
    learningDataControlCatalogs.set(code, translations);
  }
}
const globalPathAliases = catalog(path.join(LOCALES_DIR, 'global-path-v1.ts'), 'aliases');
const overlayFiles = new Set([
  'auth-errors.ts',
  'essential.ts',
  'global-path-v1.ts',
  'index.ts',
  'learning-control-v1.ts',
  'learning-data-control-africa-v1.ts',
  'learning-data-control-asia-v1.ts',
  'learning-data-control-europe-v1.ts',
  'library-v1.ts',
  'research-web-v1.ts',
  'review.ts',
  'voice-phase2.ts',
]);

function registeredLocale(file) {
  const source = sourceFile(path.join(LOCALES_DIR, file));
  let registration;
  function visit(node) {
    if (
      ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'registerLocale'
      && ts.isStringLiteralLike(node.arguments[0])
      && ts.isIdentifier(node.arguments[2])
    ) {
      registration = {
        file,
        code: node.arguments[0].text,
        variableName: node.arguments[2].text,
      };
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(registration, `Missing registerLocale call in ${file}`);
  return registration;
}

const localeResources = fs.readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.ts') && !overlayFiles.has(file))
  .sort()
  .map(registeredLocale);

function effectiveCatalog(resource) {
  const { code, file, variableName } = resource;
  const translations = new Map([
    ...catalog(path.join(LOCALES_DIR, file), variableName),
    ...(essentials.get(code) ?? new Map()),
    ...(learnerPassportEssentials.get(code) ?? new Map()),
    ...(supportBridgeEssentials.get(code) ?? new Map()),
    ...(reviewCatalogs.get(code) ?? new Map()),
    ...(authErrorCatalogs.get(code) ?? new Map()),
    ...(voicePhase2Catalogs.get(code) ?? new Map()),
    ...(libraryV1Catalogs.get(code) ?? new Map()),
    ...(libraryV1Organization.get(code) ?? new Map()),
    ...(libraryV1Failures.get(code) ?? new Map()),
    ...(researchWebV1.get(code) ?? new Map()),
    ...(learningDataControlCatalogs.get(code) ?? new Map()),
  ]);
  for (const [key, sourceKey] of globalPathAliases) {
    const value = translations.get(sourceKey);
    assert.ok(value, `${code} alias source ${sourceKey} is missing`);
    translations.set(key, value);
  }
  return translations;
}

test('the UI registry exposes 34 unique targets without fake empty runtime resources', () => {
  assert.equal(supported.size, 34);
  const resourceCodes = new Set(['en', 'fr', ...localeResources.map(({ code }) => code)]);
  assert.equal(resourceCodes.size, 34);
  assert.ok(resourceCodes.has('nb'));
  assert.ok(!resourceCodes.has('no'));
  for (const code of resourceCodes) assert.ok(supported.has(code), `${code} is not a supported language`);
  assert.deepEqual(
    [...supported].filter((code) => !resourceCodes.has(code)).sort(),
    [],
  );

  const barrel = fs.readFileSync(path.join(LOCALES_DIR, 'index.ts'), 'utf8');
  for (const { file, code } of localeResources) {
    const basename = path.basename(file, '.ts');
    assert.match(barrel, new RegExp(`import ['\"]\\./${basename}['\"]`), `${code} is not registered by the locale barrel`);
  }
});

test('UI selectors expose only complete catalogs while learning selectors keep all targets', () => {
  const i18nSource = fs.readFileSync(I18N_FILE, 'utf8');
  const selector = fs.readFileSync(path.join(ROOT, 'apps/mobile/components/ds/language.tsx'), 'utf8');
  const languagesScreen = fs.readFileSync(path.join(ROOT, 'apps/mobile/app/languages/index.tsx'), 'utf8');
  assert.match(i18nSource, /Object\.keys\(source\)\.every/);
  assert.match(i18nSource, /registry\.keys\(\)\]\.filter\(isSelectableLocale\)/);
  assert.match(selector, /mode\s*===\s*['\"]ui['\"]\s*\?\s*supportedLocaleCodes\(\)\s*:\s*SUPPORTED_LANGUAGE_CODES/);
  assert.match(languagesScreen, /value=\{nativeCode\}[\s\S]{0,100}mode=['\"]learning['\"]/);
});

test('all 34 UI catalogs are complete and exposed', () => {
  const complete = ['en', 'fr'];
  for (const resource of localeResources) {
    const translations = effectiveCatalog(resource);
    if (
      translations.size === english.size
      && [...english.keys()].every((key) => translations.has(key))
    ) complete.push(resource.code);
  }
  assert.deepEqual(
    complete.sort(),
    [
      'en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'zh', 'ja', 'ko',
      'ar', 'hi', 'tr', 'nb', 'sv', 'vi', 'th', 'el', 'cs', 'ro', 'hu', 'da',
      'fi', 'id', 'uk', 'ln', 'sw', 'wo', 'ha', 'he', 'zh-Hant', 'bn',
    ].sort(),
  );
});

test('all 34 catalogs cover every learning-data control with exact contracts', () => {
  assert.equal(learningDataControlKeys.length, 54);
  assert.equal(new Set(learningDataControlKeys).size, 54);
  assert.equal(learningDataControlCatalogs.size, 32);
  for (const group of learningDataControlGroups) {
    assert.deepEqual(group.keys, learningDataControlKeys, `${path.basename(group.file)} key order`);
    assert.deepEqual([...group.catalogs.keys()], group.locales, `${path.basename(group.file)} locale order`);
  }

  const barrel = fs.readFileSync(path.join(LOCALES_DIR, 'index.ts'), 'utf8');
  for (const group of learningDataControlGroups) {
    const moduleName = path.basename(group.file, '.ts');
    assert.match(barrel, new RegExp(`import ['\"]\\./${moduleName}['\"]`));
  }

  const codes = ['en', 'fr', ...localeResources.map((resource) => resource.code)];
  assert.equal(codes.length, 34);
  assert.equal(new Set(codes).size, 34);
  for (const code of codes) {
    const resource = localeResources.find((candidate) => candidate.code === code);
    const translations = code === 'en'
      ? english
      : code === 'fr'
        ? french
        : effectiveCatalog(resource);
    assert.equal(translations.size, english.size, `${code} catalog coverage regressed`);
    for (const key of learningDataControlKeys) {
      const value = translations.get(key);
      assert.ok(value?.trim(), `${code} is missing learning-data key ${key}`);
      assert.deepEqual(placeholders(value), placeholders(english.get(key)), `${code}.${key}`);
      // French legitimately shares a few short loan-word labels with English
      // (for example "{count} session(s)"); generated locale overlays must not
      // use the entire English source value as filler.
      if (code !== 'en' && code !== 'fr') {
        assert.notEqual(value, english.get(key), `${code}.${key} uses English filler`);
      }
    }
    const prompt = translations.get('priv.learningReset.typePrompt');
    assert.equal((prompt.match(/RÉINITIALISER/g) ?? []).length, 1, `${code} confirmation literal`);
  }
});

test('French is complete and every generated catalog is a safe English subset', (t) => {
  assert.deepEqual([...french.keys()].sort(), [...english.keys()].sort());

  for (const resource of localeResources) {
    const { code } = resource;
    const translations = effectiveCatalog(resource);
    assert.ok(translations.size > 0, `${code} catalog is empty`);
    for (const [key, value] of translations) {
      assert.ok(english.has(key), `${code} contains unknown key ${key}`);
      assert.ok(value.trim().length > 0, `${code}.${key} is blank`);
    }
    const coverage = Math.round((translations.size / english.size) * 1000) / 10;
    t.diagnostic(`${code}: ${translations.size}/${english.size} keys (${coverage}%, English fallback for the rest)`);
  }
});

test('translated messages preserve every named placeholder', () => {
  for (const [key, value] of french) {
    assert.deepEqual(placeholders(value), placeholders(english.get(key)), `fr.${key}`);
  }
  for (const resource of localeResources) {
    const { code } = resource;
    const translations = effectiveCatalog(resource);
    for (const [key, value] of translations) {
      assert.deepEqual(placeholders(value), placeholders(english.get(key)), `${code}.${key}`);
    }
  }
});

test('all locales translate the language selector and global recovery controls', () => {
  const criticalKeys = [
    'app.tryAgain',
    'app.dismiss',
    'app.language',
    'languageSelector.uiLabel',
    'languageSelector.learningLabel',
    'languageSelector.choose',
    'languageSelector.search',
    'languageSelector.noResults',
    'state.loading',
    'state.error',
    'error.network',
  ];
  for (const resource of localeResources) {
    const { code } = resource;
    const translations = effectiveCatalog(resource);
    for (const key of criticalKeys) assert.ok(translations.has(key), `${code} is missing critical key ${key}`);
  }
});

test('all 34 locales translate the bounded Learner Passport surface', () => {
  const keys = [
    'passport.title',
    'passport.detail',
    'passport.originCountry',
    'passport.currentCountry',
    'passport.teachingLanguage',
    'passport.knownLanguages',
    'passport.timezone',
    'passport.progression',
    'passport.source.declared',
    'passport.source.observed',
    'landing12.passport.kicker',
    'landing12.passport.title',
    'landing12.passport.lead',
    'landing12.passport.demo',
  ];
  for (const code of ['en', 'fr', ...localeResources.map((resource) => resource.code)]) {
    const resource = localeResources.find((candidate) => candidate.code === code);
    const translations = code === 'en'
      ? english
      : code === 'fr'
        ? french
        : effectiveCatalog(resource);
    for (const key of keys) {
      assert.ok(translations.has(key), `${code} is missing Learner Passport key ${key}`);
      assert.deepEqual(placeholders(translations.get(key)), placeholders(english.get(key)), `${code}.${key}`);
    }
  }
});

test('all 34 locales translate the 20 newly referenced learner support keys', () => {
  const keys = [
    'report.category.bug',
    'report.category.usage_problem',
    'report.category.account',
    'report.category.ai_teacher',
    'report.category.document_scan',
    'report.category.language_translation',
    'report.captureSelected',
    'report.captureRemove',
    'report.captureRetry',
    'report.captureUploadError',
    'report.tracking',
    'report.myReports',
    'report.myReportsEmpty',
    'report.myReportsError',
    'report.refresh',
    'report.status.RECEIVED',
    'report.status.IN_REVIEW',
    'report.status.NEEDS_INFORMATION',
    'report.status.RESOLVED',
    'report.status.CLOSED',
  ];
  assert.equal(supportBridgeEssentials.size, 32);
  for (const code of ['en', 'fr', ...localeResources.map((resource) => resource.code)]) {
    const resource = localeResources.find((candidate) => candidate.code === code);
    const translations = code === 'en'
      ? english
      : code === 'fr'
        ? french
        : effectiveCatalog(resource);
    for (const key of keys) {
      assert.ok(translations.has(key), `${code} is missing learner support key ${key}`);
      assert.deepEqual(placeholders(translations.get(key)), placeholders(english.get(key)), `${code}.${key}`);
    }
  }
});

test('every concrete locale resource fully translates the Review experience', () => {
  const reviewKeys = [...english.keys()].filter((key) => key.startsWith('review9.'));
  assert.equal(reviewKeys.length, 83);
  for (const code of ['en', 'fr', ...localeResources.map((resource) => resource.code)]) {
    const resource = localeResources.find((candidate) => candidate.code === code);
    const translations = code === 'en'
      ? english
      : code === 'fr'
        ? french
        : effectiveCatalog(resource);
    for (const key of reviewKeys) {
      assert.ok(translations.has(key), `${code} is missing Review key ${key}`);
      assert.deepEqual(placeholders(translations.get(key)), placeholders(english.get(key)), `${code}.${key}`);
    }
  }
});

test('UI locale is account-scoped, server-synchronized and Web metadata remains global', () => {
  const i18nSource = fs.readFileSync(I18N_FILE, 'utf8');
  const authSource = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/auth-context.tsx'), 'utf8');
  assert.match(i18nSource, /ACCOUNT_STORAGE_PREFIX\s*=\s*`\$\{STORAGE_KEY\}\.account\.`/);
  assert.match(i18nSource, /onAccountLocaleChange\?:/);
  assert.match(authSource, /api<AuthUser>\(['\"]\/auth\/locale['\"]/);
  assert.match(authSource, /method:\s*['\"]PATCH['\"]/);
  assert.match(i18nSource, /document\.documentElement\.lang\s*=\s*locale/);
  assert.match(i18nSource, /document\.documentElement\.dir\s*=\s*localeDirection\(locale\)/);
});

test('Arabic and Hebrew are registered as RTL and all other locales remain LTR', () => {
  const languageObject = objectLiteral(SHARED_LANGUAGES_FILE, 'SUPPORTED_LANGUAGES');
  for (const property of languageObject.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const code = propertyName(property);
    const metadata = unwrap(property.initializer);
    assert.ok(ts.isObjectLiteralExpression(metadata));
    const rtl = metadata.properties.some((item) =>
      ts.isPropertyAssignment(item)
      && propertyName(item) === 'rtl'
      && item.initializer.kind === ts.SyntaxKind.TrueKeyword,
    );
    assert.equal(rtl, code === 'ar' || code === 'he', `${code} has unexpected RTL metadata`);
  }
});

test('every statically referenced translation key exists in the English source catalog', () => {
  for (const file of codeFiles(path.join(ROOT, 'apps/mobile'))) {
    const source = sourceFile(file);
    function visit(node) {
      if (
        ts.isCallExpression(node)
        && ts.isIdentifier(node.expression)
        && (node.expression.text === 't' || node.expression.text === 'tr')
        && node.arguments.length > 0
      ) {
        const key = unwrap(node.arguments[0]);
        if (ts.isStringLiteralLike(key)) {
          assert.ok(english.has(key.text), `${path.relative(ROOT, file)} references missing key ${key.text}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});
