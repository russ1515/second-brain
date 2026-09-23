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
