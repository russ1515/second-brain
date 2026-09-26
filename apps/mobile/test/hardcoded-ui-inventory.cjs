#!/usr/bin/env node

/**
 * Read-only AST inventory for potentially user-visible literals in the learner UI.
 *
 * This is deliberately an inventory, not a failing test: every hit still needs
 * human classification (UI copy, user data, fixture, brand, symbol, or targeted
 * learning content). It never reads locale catalogs and never rewrites sources.
 *
 * Usage:
 *   node apps/mobile/test/hardcoded-ui-inventory.cjs
 *   node apps/mobile/test/hardcoded-ui-inventory.cjs --json
 *   node apps/mobile/test/hardcoded-ui-inventory.cjs --all --json
 */

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');
const SCAN_ROOTS = [
  path.join(ROOT, 'apps/mobile/app'),
  path.join(ROOT, 'apps/mobile/components'),
];

const ALL_LITERALS = process.argv.includes('--all');
const AS_JSON = process.argv.includes('--json');

const DISPLAY_FIELDS = new Set([
  'accessibilityhint',
  'accessibilitylabel',
  'actionlabel',
  'answer',
  'body',
  'buttontext',
  'caption',
  'content',
  'cta',
  'definition',
  'description',
  'emptytext',
  'errortext',
  'example',
  'explanation',
  'feedback',
  'front',
  'goal',
  'helpertext',
  'hint',
  'instruction',
  'kicker',
  'label',
  'message',
  'name',
  'objective',
  'placeholder',
  'prompt',
  'question',
  'subtitle',
  'successtext',
  'summary',
  'term',
  'text',
  'title',
  'tooltip',
  'translation',
]);

const DISPLAY_ATTRIBUTES = new Set([
  ...DISPLAY_FIELDS,
  'alt',
  'aria-label',
  'correction',
  'detail',
  'error',
  'gloss',
  'nativeexplanation',
  'note',
  'phrase',
  'remaininglabel',
  'suggestion',
  'unlimitedlabel',
  'why',
]);

const UI_CALLS = new Set([
  'alert',
  'alert.alert',
  'confirm',
  'seterror',
  'setmessage',
  'setstatusmessage',
  'showtoast',
  'toast',
  'window.alert',
  'window.confirm',
]);

const TRANSLATION_CALLS = new Set(['t', 'tr']);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(absolute);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [absolute] : [];
    });
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function hasWords(value) {
  return /[\p{L}\p{N}]/u.test(value);
}

function keyName(node) {
  if (!node) return '';
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  return normalize(node.getText()).replace(/^['"]|['"]$/g, '');
}

function callName(expression) {
  if (ts.isIdentifier(expression)) return expression.text.toLowerCase();
  if (ts.isPropertyAccessExpression(expression)) {
    return `${callName(expression.expression)}.${expression.name.text.toLowerCase()}`;
  }
  return '';
}

function templateText(node) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (!ts.isTemplateExpression(node)) return '';
  let value = node.head.text;
  for (const span of node.templateSpans) {
    value += `\${${normalize(span.expression.getText())}}${span.literal.text}`;
  }
  return value;
}

function literalText(node) {
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isTemplateExpression(node)) return templateText(node);
  return null;
}

function isTranslationArgument(node) {
  const parent = node.parent;
  return Boolean(
    parent
      && ts.isCallExpression(parent)
      && parent.arguments[0] === node
      && TRANSLATION_CALLS.has(callName(parent.expression)),
  );
}

function nearestJsxOwner(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) return keyName(current.openingElement.tagName);
    if (ts.isJsxSelfClosingElement(current)) return keyName(current.tagName);
    if (ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return '';
}

function displayProperty(node) {
  const parent = node.parent;
  if (!parent) return '';
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    const field = keyName(parent.name);
    return DISPLAY_FIELDS.has(field.toLowerCase()) ? field : '';
  }
  if (ts.isPropertyDeclaration(parent) && parent.initializer === node) {
    const field = keyName(parent.name);
    return DISPLAY_FIELDS.has(field.toLowerCase()) ? field : '';
  }
  if (
    (ts.isVariableDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent))
      && parent.initializer === node
  ) {
    const field = keyName(parent.name);
    return DISPLAY_FIELDS.has(field.toLowerCase()) ? field : '';
  }
  return '';
}

function uiCall(node) {
  const parent = node.parent;
  if (!parent || !ts.isCallExpression(parent) || !parent.arguments.includes(node)) return '';
  const name = callName(parent.expression);
  return UI_CALLS.has(name) ? name : '';
}

function jsxAttribute(node) {
  const parent = node.parent;
  if (parent && ts.isJsxAttribute(parent) && parent.initializer === node) {
    return keyName(parent.name);
  }
  if (
    parent
      && ts.isJsxExpression(parent)
      && parent.expression === node
      && parent.parent
      && ts.isJsxAttribute(parent.parent)
  ) {
    return keyName(parent.parent.name);
  }
  return '';
}

function inJsxExpression(node) {
  let current = node.parent;
  while (current) {
    if (
      ts.isJsxAttribute(current)
        || ts.isJsxOpeningElement(current)
        || ts.isJsxSelfClosingElement(current)
        || ts.isJsxElement(current)
    ) {
      return '';
    }
    if (ts.isJsxExpression(current)) {
      return !ts.isJsxAttribute(current.parent) ? nearestJsxOwner(current) : '';
    }
    if (ts.isStatement(current) || ts.isSourceFile(current)) break;
    current = current.parent;
  }
  return '';
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function syntaxContext(node) {
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isPropertyAssignment(current)) return `property:${keyName(current.name)}`;
    if (ts.isVariableDeclaration(current)) return `variable:${keyName(current.name)}`;
    if (ts.isBindingElement(current)) return `binding:${keyName(current.name)}`;
    if (ts.isCallExpression(current)) return `call:${callName(current.expression)}`;
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current)) {
      return `function:${keyName(current.name)}`;
    }
    current = current.parent;
  }
  return '';
}

const findings = [];
const seen = new Set();

function addFinding(sourceFile, node, kind, owner, rawText) {
  const text = normalize(rawText);
  if (!text || !hasWords(text)) return;

  const start = node.getStart(sourceFile);
  const identity = `${sourceFile.fileName}:${start}`;
  if (seen.has(identity)) return;
  seen.add(identity);

  const position = sourceFile.getLineAndCharacterOfPosition(start);
  findings.push({
    file: relative(sourceFile.fileName),
    line: position.line + 1,
    column: position.character + 1,
    kind,
    owner,
    parent: ts.SyntaxKind[node.parent.kind],
    context: syntaxContext(node),
    text,
  });
}

for (const file of SCAN_ROOTS.flatMap(sourceFiles).sort()) {
  const source = fs.readFileSync(file, 'utf8');
  const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind);

  function visit(node) {
    if (ts.isJsxText(node)) {
      addFinding(sourceFile, node, 'jsx-text', nearestJsxOwner(node), node.getText(sourceFile));
    } else {
      const text = literalText(node);
      if (text !== null && !isTranslationArgument(node)) {
        const attribute = jsxAttribute(node);
        const jsxOwner = inJsxExpression(node);
        const property = displayProperty(node);
        const call = uiCall(node);

        if (attribute && (ALL_LITERALS || DISPLAY_ATTRIBUTES.has(attribute.toLowerCase()))) {
          addFinding(sourceFile, node, 'jsx-attribute', attribute, text);
        } else if (jsxOwner) {
          addFinding(sourceFile, node, 'jsx-expression', jsxOwner, text);
        } else if (property) {
          addFinding(sourceFile, node, 'display-property', property, text);
        } else if (call) {
          addFinding(sourceFile, node, 'ui-call', call, text);
        } else if (ALL_LITERALS) {
          addFinding(sourceFile, node, 'other-literal', keyName(node.parent && node.parent.name), text);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);

if (AS_JSON) {
  process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
} else {
  process.stdout.write('file\tline\tkind\towner\ttext\n');
  for (const finding of findings) {
    const text = finding.text.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    process.stdout.write(
      `${finding.file}\t${finding.line}\t${finding.kind}\t${finding.owner}\t${text}\n`,
    );
  }
  process.stderr.write(
    `\n${findings.length} candidate literal(s) across ${new Set(findings.map(({ file }) => file)).size} file(s).\n`,
  );
}
