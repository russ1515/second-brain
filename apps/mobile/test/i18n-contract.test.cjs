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
const reviewCatalogs = nestedCatalog(path.join(LOCALES_DIR, 'review.ts'), 'review');
const localeFiles = fs.readdirSync(LOCALES_DIR)
  .filter((file) => file.endsWith('.ts') && supported.has(path.basename(file, '.ts')))
  .sort();

function effectiveCatalog(file) {
  const code = path.basename(file, '.ts');
  return new Map([
    ...catalog(path.join(LOCALES_DIR, file), code),
    ...(essentials.get(code) ?? new Map()),
    ...(reviewCatalogs.get(code) ?? new Map()),
  ]);
}

test('the UI registry covers exactly the 27 shared languages', () => {
  assert.equal(supported.size, 27);
  const resourceCodes = new Set(['en', 'fr', ...localeFiles.map((file) => path.basename(file, '.ts'))]);
  assert.deepEqual([...resourceCodes].sort(), [...supported].sort());

  const barrel = fs.readFileSync(path.join(LOCALES_DIR, 'index.ts'), 'utf8');
  for (const file of localeFiles) {
    const code = path.basename(file, '.ts');
    assert.match(barrel, new RegExp(`import ['\"]\\./${code}['\"]`), `${code} is not registered by the locale barrel`);
  }
});

test('French is complete and every generated catalog is a safe English subset', (t) => {
  assert.deepEqual([...french.keys()].sort(), [...english.keys()].sort());

  for (const file of localeFiles) {
    const code = path.basename(file, '.ts');
    const translations = effectiveCatalog(file);
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
  for (const file of localeFiles) {
    const code = path.basename(file, '.ts');
    const translations = effectiveCatalog(file);
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
  for (const file of localeFiles) {
    const code = path.basename(file, '.ts');
    const translations = effectiveCatalog(file);
    for (const key of criticalKeys) assert.ok(translations.has(key), `${code} is missing critical key ${key}`);
  }
});

test('all 27 locales fully translate the Review experience', () => {
  const reviewKeys = [...english.keys()].filter((key) => key.startsWith('review9.'));
  assert.equal(reviewKeys.length, 83);
  for (const code of supported) {
    const translations = code === 'en'
      ? english
      : code === 'fr'
        ? french
        : effectiveCatalog(`${code}.ts`);
    for (const key of reviewKeys) {
      assert.ok(translations.has(key), `${code} is missing Review key ${key}`);
      assert.deepEqual(placeholders(translations.get(key)), placeholders(english.get(key)), `${code}.${key}`);
    }
  }
});

test('UI locale stays local and Web language/direction metadata is global', () => {
  const i18nSource = fs.readFileSync(I18N_FILE, 'utf8');
  const authSource = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/auth-context.tsx'), 'utf8');
  assert.doesNotMatch(i18nSource, /api\(['\"]\/auth\/locale/);
  assert.doesNotMatch(authSource, /api\(['\"]\/auth\/locale/);
  assert.match(i18nSource, /document\.documentElement\.lang\s*=\s*locale/);
  assert.match(i18nSource, /document\.documentElement\.dir\s*=\s*localeDirection\(locale\)/);
});

test('Arabic is registered as RTL and other current locales remain LTR', () => {
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
    assert.equal(rtl, code === 'ar', `${code} has unexpected RTL metadata`);
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
