const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');
const files = {
  research: path.join(ROOT, 'apps/mobile/app/research.tsx'),
  language: path.join(ROOT, 'apps/mobile/app/languages/[id].tsx'),
  speak: path.join(ROOT, 'apps/mobile/components/speak-button.tsx'),
  posture: path.join(ROOT, 'apps/mobile/components/ds/ai.tsx'),
  profile: path.join(ROOT, 'apps/mobile/components/profile/components.tsx'),
  planner: path.join(ROOT, 'apps/mobile/app/planner.tsx'),
  session: path.join(ROOT, 'apps/mobile/app/session/[id].tsx'),
  coach: path.join(ROOT, 'apps/mobile/app/coach.tsx'),
  languagesIndex: path.join(ROOT, 'apps/mobile/app/languages/index.tsx'),
  composer: path.join(ROOT, 'apps/mobile/components/learn/universal-composer.tsx'),
  batchImport: path.join(ROOT, 'apps/mobile/components/document/batch-import.tsx'),
  i18n: path.join(ROOT, 'apps/mobile/lib/i18n.tsx'),
};

function source(file) {
  return fs.readFileSync(file, 'utf8');
}

function ast(file) {
  return ts.createSourceFile(
    file,
    source(file),
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

function literalSegments(file) {
  const parsed = ast(file);
  const segments = [];
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) segments.push(node.text);
    if (ts.isTemplateExpression(node)) {
      segments.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return segments;
}

function catalog(variableName) {
  const parsed = ast(files.i18n);
  let object;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === variableName
      && node.initializer
    ) {
      const initializer = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) object = initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(object, `Missing ${variableName} catalog`);

  const entries = new Map();
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property) || !property.name || !ts.isStringLiteralLike(property.initializer)) continue;
    const key = ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)
      ? property.name.text
      : null;
    if (key) entries.set(key, property.initializer.text);
  }
  return entries;
}

test('core learner UI literals stay behind i18n', () => {
  const forbidden = new Map([
    [files.research, [
      'Learn this researched topic',
      'A sourced synthesis is ready to turn into active learning.',
      'Connect the researched topic to learning',
    ]],
    [files.language, ['Write in ']],
    [files.speak, ['Listen', '⏹ Stop']],
    [files.posture, ['Posture: ']],
    [files.profile, ['Avatar ']],
    [files.planner, [' min']],
    [files.session, [' min']],
    [files.coach, [' min']],
    [files.languagesIndex, [' min']],
  ]);

  for (const [file, values] of forbidden) {
    const segments = literalSegments(file);
    for (const value of values) {
      assert.ok(
        !segments.some((segment) => segment.includes(value)),
        `${path.relative(ROOT, file)} reintroduced learner UI literal: ${value}`,
      );
    }
  }

  assert.match(source(files.research), /title:\s*t\('research10\.next'\)/);
  assert.match(source(files.research), /reason:\s*t\('research10\.next\.reason'\)/);
  assert.match(source(files.research), /label:\s*t\('research10\.action\.learn'\)/);
  assert.match(source(files.research), /expectedImpact:\s*\{[^}]*label:\s*'research-to-learning'/);
  assert.match(source(files.language), /t\('languages11\.writing\.instruction',\s*\{\s*language:/);
  assert.match(source(files.speak), /t\('lesson\.readAloud'\)/);
  assert.match(source(files.speak), /t\('learn\.oral\.stop'\)/);
  assert.match(source(files.posture), /t\('profile\.card\.posture'\)/);
  assert.match(source(files.profile), /t\('profile\.card\.avatar'\)/);
  for (const file of [files.planner, files.session, files.coach, files.languagesIndex]) {
    assert.match(source(file), /t\('h\.hero\.min'\)/);
  }
});

test('technical file-size symbols stay constant while their numbers follow formatLocale', () => {
  const composer = source(files.composer);
  const batchImport = source(files.batchImport);

  assert.match(composer, /formatSize\(attachment\.size, formatLocale\)/);
  assert.match(composer, /new Intl\.NumberFormat\(formatLocale/);
  assert.match(composer, /`\$\{format\(size, 0\)\} B`/);
  assert.match(composer, /`\$\{format\(Math\.round\(size \/ 1_024\), 0\)\} KB`/);
  assert.match(composer, /`\$\{format\(size \/ 1_048_576, 1\)\} MB`/);
  assert.match(batchImport, /new Intl\.NumberFormat\(formatLocale\)\.format/);
  assert.match(batchImport, /\} KB/);
});

test('the two new learner keys have English and French source copy', () => {
  const en = catalog('en');
  const fr = catalog('fr');
  assert.equal(en.get('research10.next.reason'), 'A sourced synthesis is ready to turn into active learning.');
  assert.equal(fr.get('research10.next.reason'), 'Une synthèse sourcée est prête à devenir un apprentissage actif.');
  assert.equal(en.get('languages11.writing.instruction'), 'Write in {language}.');
  assert.equal(fr.get('languages11.writing.instruction'), 'Écris en {language}.');
});
