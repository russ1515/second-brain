'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('document pipeline exposes only persisted stages and no synthetic percentage', () => {
  const reading = shared.resolveDocumentPipeline('processing', 'cleaning');
  const extracting = shared.resolveDocumentPipeline('processing', 'segmenting');
  const indexing = shared.resolveDocumentPipeline('processing', 'embedding');
  const connecting = shared.resolveDocumentPipeline('processing', 'graphing');
  assert.equal(reading.phase, 'reading');
  assert.equal(extracting.phase, 'extracting');
  assert.equal(indexing.phase, 'indexing');
  assert.equal(connecting.phase, 'connecting');
  assert.deepEqual(connecting.progress, { mode: 'indeterminate' });
});

test('document pipeline has honest queued, completed, and retryable failed states', () => {
  assert.equal(shared.resolveDocumentPipeline('pending', null).phase, 'queued');
  assert.deepEqual(shared.resolveDocumentPipeline('ready', null).progress, { mode: 'determinate', percent: 100 });
  assert.equal(shared.resolveDocumentPipeline('failed', 'indexing').canRetry, true);
});

test('captured pages remain a scan through page three and group as a notebook from page four', () => {
  assert.equal(shared.NOTEBOOK_CAPTURE_MIN_PAGES, 4);
  assert.equal(shared.resolveCapturedDocumentContentType(1), 'SCAN');
  assert.equal(shared.resolveCapturedDocumentContentType(1, 'PHOTO'), 'PHOTO');
  assert.equal(shared.resolveCapturedDocumentContentType(2), 'SCAN');
  assert.equal(shared.resolveCapturedDocumentContentType(3, 'NOTEBOOK'), 'SCAN');
  assert.equal(shared.resolveCapturedDocumentContentType(4), 'NOTEBOOK');
  assert.equal(shared.resolveCapturedDocumentContentType(50, 'SCAN'), 'NOTEBOOK');
});

test('batch summary preserves partial success and uses real settled item counts', () => {
  const summary = shared.summarizeDocumentBatch([
    { status: 'ready' },
    { status: 'ready' },
    { status: 'processing' },
    { status: 'failed' },
  ]);
  assert.deepEqual(summary, {
    total: 4,
    completed: 2,
    processing: 1,
    failed: 1,
    waiting: 0,
    percent: 75,
  });
});
