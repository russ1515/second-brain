const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const overlayPath = path.resolve(__dirname, '../lib/locales/learning-data-control-europe-v1.ts');
const i18nPath = path.resolve(__dirname, '../lib/i18n.tsx');

function parse(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function variableInitializer(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name) {
        let expression = declaration.initializer;
        while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression?.(expression))) {
          expression = expression.expression;
        }
        return expression;
      }
    }
  }
  throw new Error(`Variable ${name} not found`);
}

function literalText(node) {
  assert.ok(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
  return node.text;
}

function arrayValues(expression) {
  assert.ok(ts.isArrayLiteralExpression(expression));
  return expression.elements.map(literalText);
}

function objectStringMap(expression) {
  assert.ok(ts.isObjectLiteralExpression(expression));
  return new Map(expression.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property));
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text
      : property.name.getText();
    return [key, literalText(property.initializer)];
  }));
}

const expectedLocales = [
  'es', 'de', 'it', 'pt', 'tr', 'pl', 'ru', 'sv', 'nl',
  'el', 'cs', 'ro', 'hu', 'da', 'fi', 'nb', 'uk',
];
const learningKeys = [
  'delete', 'deleteGoal', 'openDetails', 'previewLoading', 'previewFailed', 'impact',
  'count.sessions', 'count.lessons', 'count.studySessions', 'count.messages',
  'count.exercises', 'count.reviews', 'count.cards', 'count.documents',
  'count.reminders', 'count.references', 'count.recommendations',
  'documentsTrash', 'sharedPreserved',
].map((suffix) => `learningControl.${suffix}`);
const trashKeys = [
  'permanent', 'permanentTitle', 'permanentDetail', 'empty',
  'emptyTitle', 'emptyDetail', 'emptyStateTitle', 'emptyStateDetail',
].map((suffix) => `library7.trash.${suffix}`);
const resetKeys = [
  'section', 'title', 'help', 'button', 'warning', 'scope', 'preserved',
  'pdfReminder', 'mfaPlaceholder', 'typePrompt', 'confirm',
].map((suffix) => `priv.learningReset.${suffix}`);
const reportKeys = [
  'title', 'help', 'button', 'done', 'generated', 'assessed',
  'completedSessions', 'assessmentSubmissions', 'averageAssessmentScore',
  'exerciseAttempts', 'correctAttempts', 'averageExerciseScore', 'noEvidence',
  'notAvailable', 'privacyNote', 'provenanceNote',
].map((suffix) => `priv.learningReport.${suffix}`);
const expectedKeys = [...learningKeys, ...trashKeys, ...resetKeys, ...reportKeys];

test('European learning-data control overlay is complete and preserves contracts', () => {
  const overlay = parse(overlayPath);
  const locales = arrayValues(variableInitializer(overlay, 'learningDataControlEuropeLocales'));
  const keys = arrayValues(variableInitializer(overlay, 'learningDataControlKeys'));
  assert.deepEqual(locales, expectedLocales);
  assert.deepEqual(keys, expectedKeys);
  assert.equal(new Set(keys).size, 54);

  const valuesObject = variableInitializer(overlay, 'learningDataControlEuropeValues');
  assert.ok(ts.isObjectLiteralExpression(valuesObject));
  const catalogs = new Map(valuesObject.properties.map((property) => {
    assert.ok(ts.isPropertyAssignment(property));
    return [property.name.getText().replaceAll(/["']/g, ''), arrayValues(property.initializer)];
  }));
  assert.deepEqual([...catalogs.keys()], expectedLocales);

  const english = objectStringMap(variableInitializer(parse(i18nPath), 'en'));
  const expectedPlaceholders = new Map([
    ...learningKeys.slice(6, 17).map((key) => [key, ['{count}']]),
    ['learningControl.sharedPreserved', ['{count}']],
    ['library7.trash.permanentDetail', ['{title}']],
    ['library7.trash.empty', ['{n}']],
    ['library7.trash.emptyDetail', ['{n}']],
  ]);

  for (const [locale, values] of catalogs) {
    assert.equal(values.length, keys.length, `${locale} must have 54 translated values`);
    values.forEach((value, index) => {
      const key = keys[index];
      assert.ok(value.trim(), `${locale}:${key} is empty`);
      assert.notEqual(value, english.get(key), `${locale}:${key} still uses the English source`);
      assert.deepEqual(
        [...value.matchAll(/\{[^}]+\}/g)].map((match) => match[0]).sort(),
        (expectedPlaceholders.get(key) ?? []).slice().sort(),
        `${locale}:${key} placeholder mismatch`,
      );
    });
    const prompt = values[keys.indexOf('priv.learningReset.typePrompt')];
    assert.equal((prompt.match(/RÉINITIALISER/g) ?? []).length, 1, `${locale} confirmation literal`);
  }

  assert.match(fs.readFileSync(overlayPath, 'utf8'), /extendLocale\(locale,/);
});
