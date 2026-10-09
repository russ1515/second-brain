'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const libraryPath = path.resolve(__dirname, '../app/library.tsx');
const documentPath = path.resolve(__dirname, '../app/library/[id].tsx');
const library = fs.readFileSync(libraryPath, 'utf8');
const documentView = fs.readFileSync(documentPath, 'utf8');

test('Library keeps the annotated primary actions and removes the crossed-out toolbar controls', () => {
  assert.match(library, /label=\{t\('library7\.import'\)\}/);
  assert.match(library, /label=\{t\('library7\.scan'\)\}/);
  assert.doesNotMatch(library, /label=\{t\('library7\.batch'\)\}/);
  assert.doesNotMatch(library, /label=\{t\('library7\.ask'\)\}/);
  assert.doesNotMatch(library, /options=\{\['newest', 'oldest', 'title'\]/);
  assert.match(library, /sort: 'newest'/);
});

test('an import returns to the Library list instead of opening another experience automatically', () => {
  assert.match(
    library,
    /<ImportPanel onDone=\{\(\) => \{ setPanel\(null\); void load\(false\); \}\}/,
  );
  assert.doesNotMatch(library, /<ImportPanel[^>]+router\.push\(`\/library\/\$\{id\}`\)/);
});

test('only a ready source opens the waiting document Professor while pipeline states stay inspectable', () => {
  assert.match(library, /document\.status === 'ready' && !document\.deletedAt/);
  assert.match(
    library,
    /pathname: '\/tutor', params: \{ documentId: document\.id, title: document\.title, mode: 'teach', intent: 'learn-document' \}/,
  );
  assert.match(library, /router\.push\(`\/library\/\$\{document\.id\}`\)/);
  assert.ok((library.match(/<Pressable onPress=\{onOpen\}/g) ?? []).length >= 2);
});

test('all document Learn actions use the bounded document Professor mode', () => {
  assert.doesNotMatch(library, /mode: 'discuss', intent: 'learn-document'/);
  assert.doesNotMatch(documentView, /mode: 'discuss', intent: 'learn-document'/);
  assert.ok((documentView.match(/mode: 'teach', intent: 'learn-document'/g) ?? []).length >= 2);
  assert.match(documentView, /disabled=\{document\.status !== 'ready' \|\| Boolean\(document\.deletedAt\)\}/);
  assert.match(documentView, /if \(document\.status !== 'ready' \|\| document\.deletedAt\) return null/);
});
