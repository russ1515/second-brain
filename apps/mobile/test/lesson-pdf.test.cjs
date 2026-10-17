'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../lib/lesson-pdf.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const prints = [];
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const compiled = new Module(sourcePath, module);
compiled.filename = sourcePath;
compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const normalRequire = compiled.require.bind(compiled);
compiled.require = (id) => id === 'expo-print'
  ? { printAsync: async ({ html }) => { prints.push(html); } }
  : normalRequire(id);
compiled._compile(js, sourcePath);
const { lessonHtml, printLessonHtmlOnWeb, saveLessonAsPdf } = compiled.exports;

function lesson(overrides = {}) {
  return {
    id: 'lesson-1',
    topic: 'Biologie & cellules',
    objective: 'Comprendre <la cellule>',
    intro: 'Introduction complète.',
    explanation: 'Explication complète.\n\nDeuxième paragraphe.',
    examples: ['Exemple guidé'],
    questions: ['Pourquoi la membrane est-elle importante ?'],
    exercises: [{
      question: 'Choisis la bonne réponse.',
      answer: 'La membrane',
      type: 'qcm',
      options: ['Le noyau', 'La membrane'],
    }],
    homework: 'Travail à faire.',
    summary: 'Résumé final.',
    keyPoints: ['Point essentiel'],
    revisionSheet: 'Fiche complète.',
    conceptId: null,
    tutorSessionId: null,
    language: 'Français',
    languageProfileId: null,
    level: 'beginner',
    sourceDocumentId: null,
    cardCount: 3,
    createdAt: '2026-10-17T00:00:00.000Z',
    ...overrides,
  };
}

test('lesson PDF is built from the complete lesson model, not the viewport', async () => {
  const html = lessonHtml(lesson(), 'fr-FR', {
    questions: 'Questions guidées',
    correction: 'Correction',
  });
  for (const expected of [
    'Biologie &amp; cellules',
    'Comprendre &lt;la cellule&gt;',
    'Introduction complète.',
    'Explication complète.',
    'Exemple guidé',
    'Pourquoi la membrane est-elle importante ?',
    'Choisis la bonne réponse.',
    'Le noyau',
    'La membrane',
    'Travail à faire.',
    'Résumé final.',
    'Point essentiel',
    'Fiche complète.',
  ]) assert.match(html, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /@page \{ size: A4/);
  assert.match(html, /break-inside: avoid-page/);
  assert.doesNotMatch(html, /section, \.objective/);
  assert.doesNotMatch(html, /sidebar|tutor-send|audio controls|technical error/i);

  prints.length = 0;
  await saveLessonAsPdf(lesson(), 'fr-FR');
  assert.equal(prints.length, 1);
  assert.match(prints[0], /<!doctype html>/);
});

test('lesson PDF supports RTL metadata and keeps mixed-language blocks automatic', () => {
  const html = lessonHtml(lesson({
    topic: 'מבוא ללמידה',
    objective: 'להבין את הרעיון',
    explanation: 'זהו הסבר מלא בעברית.',
  }), 'he-IL', {
    objective: 'מטרה',
    explanation: 'הסבר',
  });
  assert.match(html, /<html lang="he-IL" dir="rtl">/);
  assert.match(html, /dir="auto"/);
  assert.match(html, /padding-inline-end/);
  assert.match(html, /Noto Sans Hebrew/);
});

test('web PDF prints the isolated lesson document instead of the application shell', async () => {
  const originalDocument = global.document;
  const originalWindow = global.window;
  let load;
  let afterPrint;
  let written = '';
  let printCalls = 0;
  let removed = 0;
  const frame = {
    style: {},
    setAttribute() {},
    addEventListener(type, listener) { if (type === 'load') load = listener; },
    remove() { removed += 1; },
    contentWindow: {
      addEventListener(type, listener) { if (type === 'afterprint') afterPrint = listener; },
      focus() {},
      print() { printCalls += 1; },
    },
    contentDocument: {
      readyState: 'loading',
      open() {},
      write(value) { written += value; },
      close() {},
    },
  };
  global.window = {
    clearTimeout() {},
    setTimeout(listener, delay) {
      if (delay === 0) queueMicrotask(listener);
      return 1;
    },
  };
  global.document = {
    createElement(tag) {
      assert.equal(tag, 'iframe');
      return frame;
    },
    body: { appendChild() { queueMicrotask(() => load()); } },
  };

  try {
    await printLessonHtmlOnWeb('<html><body>Complete lesson</body></html>');
    assert.equal(printCalls, 1);
    assert.match(written, /Complete lesson/);
    assert.doesNotMatch(written, /sidebar|composer|audio controls/i);
    afterPrint();
    assert.equal(removed, 1);
  } finally {
    global.document = originalDocument;
    global.window = originalWindow;
  }
});
