'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ScanService } = require('../dist/documents/scan.service.js');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const file = {
  originalname: 'page.jpg',
  mimetype: 'image/jpeg',
  size: 3,
  buffer: Buffer.from([1, 2, 3]),
};

test('scan retries with one request id share one provider call and one document', async () => {
  let reads = 0;
  let completions = 0;
  const pages = [{ pageNumber: 1, position: 0, ocrStatus: 'PENDING', ocrText: null }];
  const detail = { id: 'doc-1', title: 'Scan', content: 'Readable page text long enough.', status: 'pending' };
  const llm = {
    supportsVision: true,
    readImages: async () => {
      reads += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { text: detail.content };
    },
  };
  const documents = {
    findBySourceRef: async () => null,
    beginScan: async (_userId, _title, sourceRef) => {
      assert.equal(sourceRef, 'scan:scan-request-123');
      return { document: { ...detail, content: '', status: 'processing' }, created: true };
    },
    markScanCaptured: async () => ({ ...detail, content: '', charCount: 0, status: 'pending' }),
    recordScanPages: async () => undefined,
    scanPages: async () => pages,
    updatePageOcr: async (_documentId, pageNumber, input) => {
      Object.assign(pages.find((page) => page.pageNumber === pageNumber), {
        ocrStatus: input.status,
        ocrText: input.text ?? null,
      });
    },
    startScanReading: async () => ({
      document: { ...detail, content: '', charCount: 0, status: 'processing' },
      started: true,
    }),
    completeScan: async (_userId, id, input) => {
      completions += 1;
      assert.equal(id, detail.id);
      assert.match(input.content, /Readable page text long enough/);
      return detail;
    },
    failScan: async () => assert.fail('successful scan must not be failed'),
  };
  const imageSafety = {
    scanPage: async () => ({ mimeType: 'image/jpeg', buffer: Buffer.from([4, 5, 6]) }),
  };
  const privateMedia = { putScanPages: async () => undefined };
  const service = new ScanService(llm, documents, imageSafety, privateMedia);

  const [first, duplicate] = await Promise.all([
    service.fromImages('user-1', [file], 'Scan', 'scan-request-123'),
    service.fromImages('user-1', [file], 'Scan', 'scan-request-123'),
  ]);

  assert.equal(first, detail);
  assert.equal(duplicate, detail);
  assert.equal(reads, 1);
  assert.equal(completions, 1);
});

test('scan retry returns an already persisted owner-scoped result', async () => {
  const existing = { id: 'doc-existing', title: 'Existing scan', content: 'Existing content.', status: 'ready' };
  const llm = {
    supportsVision: true,
    readImages: async () => assert.fail('provider must not be called for a persisted retry'),
  };
  const documents = {
    findBySourceRef: async (userId, sourceRef) => {
      assert.equal(userId, 'user-2');
      assert.equal(sourceRef, 'scan:scan-request-456');
      return existing;
    },
  };
  const service = new ScanService(llm, documents, {
    scanPage: async () => assert.fail('bytes must not be decoded again for a persisted retry'),
  }, { putScanPages: async () => assert.fail('persisted retry must not rewrite pages') });

  assert.equal(
    await service.fromImages('user-2', [file], undefined, 'scan-request-456'),
    existing,
  );
});

test('a pending request-id retry OCRs only the persisted capture, never the new payload', async () => {
  const persistedPage = Buffer.from([9, 8, 7, 6]);
  const retryPayload = { ...file, buffer: Buffer.from([1, 1, 1]), size: 3 };
  const existing = {
    id: 'doc-pending', title: 'Original capture', sourceRef: 'scan:same-request',
    content: '', charCount: 0, status: 'pending', updatedAt: new Date().toISOString(),
  };
  let reads = 0;
  let normalizations = 0;
  let pageWrites = 0;
  const pages = [{ pageNumber: 1, position: 0, ocrStatus: 'PENDING', ocrText: null }];
  const service = new ScanService({
    supportsVision: true,
    readImages: async (images) => {
      reads += 1;
      assert.equal(images.length, 1);
      assert.deepEqual(Buffer.from(images[0].data, 'base64'), persistedPage);
      assert.notDeepEqual(Buffer.from(images[0].data, 'base64'), retryPayload.buffer);
      return { text: 'Text read strictly from the original persisted capture.' };
    },
  }, {
    findBySourceRef: async () => existing,
    startScanReading: async () => ({
      document: { ...existing, status: 'processing', stage: 'reading' },
      started: true,
    }),
    scanPages: async () => pages,
    recordScanPages: async () => undefined,
    updatePageOcr: async (_documentId, pageNumber, input) => {
      Object.assign(pages.find((page) => page.pageNumber === pageNumber), {
        ocrStatus: input.status,
        ocrText: input.text ?? null,
      });
    },
    completeScan: async (_userId, id, input) => {
      assert.equal(id, existing.id);
      assert.match(input.content, /original persisted capture/);
      return { ...existing, ...input, charCount: input.content.length, status: 'pending' };
    },
    failScan: async () => assert.fail('successful persisted OCR must not fail'),
  }, {
    scanPage: async () => { normalizations += 1; throw new Error('must not normalize retry bytes'); },
  }, {
    getScanPages: async (userId, documentId) => {
      assert.equal(userId, 'user-pending');
      assert.equal(documentId, existing.id);
      return [persistedPage];
    },
    putScanPages: async () => { pageWrites += 1; },
  });

  const result = await service.fromImages(
    'user-pending',
    [retryPayload],
    'Different retry title',
    'same-request',
  );

  assert.equal(result.title, existing.title);
  assert.equal(reads, 1);
  assert.equal(normalizations, 0);
  assert.equal(pageWrites, 0);
});

test('downstream indexing cannot turn a completed OCR retry into a failed scan', async () => {
  const existing = {
    id: 'doc-indexing',
    title: 'Indexed scan',
    content: 'OCR text is already durably stored.',
    charCount: 34,
    status: 'processing',
    updatedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
  };
  const documents = {
    findBySourceRef: async () => existing,
    failScan: async () => assert.fail('downstream processing must not fail a successful OCR attempt'),
  };
  const service = new ScanService({
    supportsVision: true,
    readImages: async () => assert.fail('provider must not be called after durable OCR completion'),
  }, documents, {
    scanPage: async () => assert.fail('persisted scan pages must not be decoded again'),
  }, { putScanPages: async () => assert.fail('persisted retry must not rewrite pages') });

  assert.equal(
    await service.fromImages('user-2', [file], undefined, 'scan-request-indexing'),
    existing,
  );
});

test('a terminal provider attempt is not replayed under the same request id', async () => {
  const service = new ScanService({
    supportsVision: true,
    readImages: async () => assert.fail('terminal provider operation must not be replayed'),
  }, {
    findBySourceRef: async () => ({
      id: 'doc-failed', title: 'Failed scan', content: '', status: 'failed',
      updatedAt: new Date().toISOString(),
    }),
  }, {
    scanPage: async () => assert.fail('terminal attempt must not decode pages again'),
  }, { putScanPages: async () => assert.fail('terminal retry must not rewrite pages') });

  await assert.rejects(
    service.fromImages('user-3', [file], undefined, 'scan-request-789'),
    (error) => error?.response?.code === 'SCAN_ATTEMPT_FAILED',
  );
});

test('capture is durably saved when the active provider has no Vision capability', async () => {
  let storedPages = 0;
  let providerReads = 0;
  let failureCode = null;
  const shell = {
    id: 'doc-captured', title: 'page', content: '', charCount: 0,
    status: 'processing', updatedAt: new Date().toISOString(),
  };
  const service = new ScanService({
    supportsVision: false,
    readImages: async () => { providerReads += 1; },
  }, {
    findBySourceRef: async () => null,
    beginScan: async () => ({ document: shell, created: true }),
    markScanCaptured: async () => ({ ...shell, status: 'pending' }),
    recordScanPages: async () => undefined,
    failScan: async (_userId, _documentId, code) => { failureCode = code; },
    get: async () => ({ ...shell, status: 'failed', error: failureCode }),
  }, {
    scanPage: async () => ({ mimeType: 'image/jpeg', buffer: Buffer.from([4, 5, 6]) }),
  }, {
    putScanPages: async (_userId, documentId, pages) => {
      assert.equal(documentId, shell.id);
      storedPages = pages.length;
    },
  });

  const result = await service.fromImages('user-4', [file], undefined, 'capture-only');
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'SCAN_OCR_UNAVAILABLE');
  assert.equal(storedPages, 1);
  assert.equal(providerReads, 0);
});

test('explicit failed OCR retry reads saved pages once and never uses reindex', async () => {
  let reads = 0;
  let claims = 0;
  let completions = 0;
  let reindexes = 0;
  const failed = {
    id: 'doc-retry', title: 'Saved scan', sourceRef: 'scan:request-retry',
    content: '', charCount: 0, status: 'failed', updatedAt: new Date().toISOString(),
  };
  const pageRows = [
    { pageNumber: 1, position: 0, ocrStatus: 'PENDING', ocrText: null },
    { pageNumber: 2, position: 1, ocrStatus: 'PENDING', ocrText: null },
  ];
  const completed = {
    ...failed,
    content: '--- Page 1 ---\nRecovered OCR content from saved page 1.\n\n--- Page 2 ---\nRecovered OCR content from saved page 2.',
    charCount: 113,
    status: 'pending',
  };
  const service = new ScanService({
    supportsVision: true,
    readImages: async (images) => {
      reads += 1;
      assert.equal(images.length, 1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { text: `Recovered OCR content from saved page ${reads}.` };
    },
  }, {
    get: async (userId, documentId) => {
      assert.equal(userId, 'user-retry');
      assert.equal(documentId, failed.id);
      return failed;
    },
    startScanRetry: async () => {
      claims += 1;
      return { document: { ...failed, status: 'processing' }, started: true };
    },
    scanPages: async () => pageRows,
    recordScanPages: async () => undefined,
    updatePageOcr: async (_documentId, pageNumber, input) => {
      Object.assign(pageRows.find((page) => page.pageNumber === pageNumber), {
        ocrStatus: input.status,
        ocrText: input.text ?? null,
      });
    },
    completeScan: async (_userId, documentId, input) => {
      completions += 1;
      assert.equal(documentId, failed.id);
      assert.equal(input.content, completed.content);
      return completed;
    },
    reindex: async () => { reindexes += 1; },
    failScan: async () => assert.fail('successful retry must not be failed'),
  }, {}, {
    getScanPages: async () => [Buffer.from([1, 2]), Buffer.from([3, 4])],
  });

  const [first, duplicate] = await Promise.all([
    service.retry('user-retry', failed.id),
    service.retry('user-retry', failed.id),
  ]);

  assert.equal(first, completed);
  assert.equal(duplicate, completed);
  assert.equal(reads, 2);
  assert.equal(claims, 1);
  assert.equal(completions, 1);
  assert.equal(reindexes, 0);
});

test('failed OCR retry preserves failed state and makes no provider call without Vision', async () => {
  let reads = 0;
  let pageReads = 0;
  let claims = 0;
  const failed = {
    id: 'doc-no-vision', title: 'Saved scan', sourceRef: 'scan:no-vision',
    content: '', charCount: 0, status: 'failed', updatedAt: new Date().toISOString(),
  };
  const service = new ScanService({
    supportsVision: false,
    readImages: async () => { reads += 1; },
  }, {
    get: async () => failed,
    startScanRetry: async () => { claims += 1; },
  }, {}, {
    getScanPages: async () => { pageReads += 1; return [Buffer.from([1])]; },
  });

  await assert.rejects(
    service.retry('user-no-vision', failed.id),
    (error) => error?.response?.code === 'SCAN_OCR_UNAVAILABLE',
  );
  assert.equal(reads, 0);
  assert.equal(pageReads, 0);
  assert.equal(claims, 0);
  assert.equal(failed.status, 'failed');
});

test('durable scan creation is serialized across API replicas', () => {
  const source = readFileSync(
    path.join(__dirname, '../src/documents/document.service.ts'),
    'utf8',
  );
  assert.match(source, /\$transaction\(async \(tx\)/);
  assert.match(source, /\$executeRaw`SELECT pg_advisory_xact_lock/);
  assert.doesNotMatch(source, /\$queryRaw`SELECT pg_advisory_xact_lock/);
  assert.match(source, /pg_advisory_xact_lock\(hashtextextended/);
  assert.match(source, /where: \{ userId, sourceRef, deletedAt: null \}/);
});

test('multipart buffering cannot exceed the aggregate scan ceiling', () => {
  const source = readFileSync(
    path.join(__dirname, '../src/documents/document.controller.ts'),
    'utf8',
  );
  assert.match(source, /MAX_SCAN_PAGE_BYTES = Math\.floor\(MAX_SCAN_TOTAL_BYTES \/ MAX_SCAN_IMAGES\)/);
  assert.match(source, /limits: \{ fileSize: MAX_SCAN_PAGE_BYTES \}/);
});
