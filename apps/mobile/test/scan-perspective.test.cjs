'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadGeometry() {
  const source = read('apps/mobile/lib/capture/scan-geometry.ts');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Math }, { filename: 'scan-geometry.ts' });
  return module.exports;
}

test('scan geometry keeps an ordered convex four-corner page', () => {
  const geometry = loadGeometry();
  const quad = geometry.defaultScanQuadrilateral();
  assert.equal(geometry.isValidScanQuadrilateral(quad), true);
  assert.ok(geometry.scanQuadrilateralArea(quad) > 0.8);
  assert.equal(geometry.isValidScanQuadrilateral({
    ...quad,
    topRight: { x: -0.1, y: 0.1 },
  }), false);
  assert.equal(geometry.isValidScanQuadrilateral({
    topLeft: { x: 0.1, y: 0.1 },
    topRight: { x: 0.9, y: 0.9 },
    bottomRight: { x: 0.9, y: 0.1 },
    bottomLeft: { x: 0.1, y: 0.9 },
  }), false);

  const rejected = geometry.moveScanCorner(quad, 'topLeft', { x: 0.99, y: 0.99 });
  assert.equal(JSON.stringify(rejected), JSON.stringify(quad), 'a handle cannot cross the opposite edges');
  const moved = geometry.moveScanCorner(quad, 'topLeft', { x: 0.12, y: 0.08 });
  assert.equal(moved.topLeft.x, 0.12);
  assert.equal(moved.topLeft.y, 0.08);
});

test('scan geometry maps handles onto the actual contained image, not letterboxing', () => {
  const { containedImageRect } = loadGeometry();
  assert.equal(JSON.stringify(containedImageRect(400, 300, 1000, 1000)),
    JSON.stringify({ x: 50, y: 0, width: 300, height: 300 }));
  assert.equal(JSON.stringify(containedImageRect(400, 300, 1600, 800)),
    JSON.stringify({ x: 0, y: 50, width: 400, height: 200 }));
});

test('scan UI sends ordered page edits and exposes four draggable corners before submit', () => {
  const screen = read('apps/mobile/app/scan.tsx');
  const editor = read('apps/mobile/components/capture/scan-corner-editor.tsx');
  assert.match(screen, /const MAX_PAGES = 50/);
  assert.match(screen, /<ScanCornerEditor/);
  assert.match(screen, /isValidScanQuadrilateral\(page\.corners\)/);
  assert.match(screen, /form\.append\('pageEdits', JSON\.stringify\(pages\.map/);
  assert.match(screen, /form\.append\('contentType', resolveCapturedDocumentContentType\(pages\.length, requestedContentType\)\)/);
  assert.match(screen, /for \(const page of pages\)[\s\S]*manipulateAsync[\s\S]*await appendPickedDocument/);
  assert.match(screen, /draggable/);
  assert.match(screen, /testID="scan-submit"/);
  assert.doesNotMatch(screen, /CROP_STEPS/);
  assert.match(screen, /scan\.perspectiveLimit/);
  assert.match(editor, /SCAN_CORNERS\.map/);
  assert.match(editor, /PanResponder\.create/);
  assert.match(editor, /accessibilityRole="adjustable"/);
  assert.match(editor, /accessibilityActions=/);
  assert.match(editor, /onAccessibilityAction=/);
  assert.match(editor, /ArrowLeft/);
  assert.match(editor, /ArrowRight/);
  assert.match(editor, /ArrowUp/);
  assert.match(editor, /ArrowDown/);
  assert.match(editor, /tabIndex:/);
  assert.match(editor, /onFocus=/);
  assert.match(editor, /moveScanCorner\(current, corner/);
  for (const corner of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
    assert.match(read('apps/mobile/lib/capture/scan-geometry.ts'), new RegExp(corner));
  }
});
