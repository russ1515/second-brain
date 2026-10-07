'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DocumentService } = require('../dist/documents/document.service.js');
const { LibraryService } = require('../dist/documents/library/library.service.js');
const { resolveDocumentPipeline } = require('../../../packages/shared/dist/document.js');

function documentRow(overrides = {}) {
  const now = new Date('2026-10-06T00:00:00.000Z');
  return {
    id: 'doc-1', userId: 'user-1', title: 'Course.pdf', source: 'file',
    sourceRef: 'Course.pdf', content: '', charCount: 0, status: 'processing',
    stage: 'reading', error: null, contentType: 'PDF', mimeType: 'application/pdf',
    sizeBytes: 4, fingerprint: 'fingerprint', pageCount: 0, deletedAt: null,
    isFavorite: false, collectionId: null, summary: null, subject: null,
    language: null, author: null, difficulty: null, enrichedAt: null,
    createdAt: now, updatedAt: now, ...overrides,
  };
}

function fileHarness({ extractionFails = false } = {}) {
  const events = [];
  let row = documentRow();
  const prisma = {
    document: {
      findFirst: async ({ where }) => where.fingerprint ? null : { ...row },
      create: async ({ data }) => {
        events.push('db-shell'); row = { ...row, ...data }; return { ...row };
      },
      update: async ({ data }) => {
        row = { ...row, ...data, updatedAt: new Date() }; return { ...row };
      },
    },
  };
  const media = {
    putDocumentOriginal: async () => { events.push('original-saved'); },
    getDocumentOriginal: async () => ({
      buffer: Buffer.from('PDF!'), mimeType: 'application/pdf', modifiedAt: new Date(),
    }),
  };
  const extraction = {
    extractFromFile: async () => {
      events.push('extract');
      if (extractionFails) throw new Error('unreadable');
      return { text: 'Readable source text.', title: 'Course', pageCount: 3 };
    },
  };
  let ingestions = 0;
  const service = new DocumentService(
    prisma,
    extraction,
    { ingest: async () => { ingestions += 1; } },
    { enrich: async () => undefined },
    media,
  );
  return { service, events, row: () => row, ingestions: () => ingestions };
}

test('file import durably stores the original before extraction and records PDF pages', async () => {
  const harness = fileHarness();
  const result = await harness.service.createFromFile('user-1', {
    originalname: 'Course.pdf', mimetype: 'application/pdf', size: 4,
    buffer: Buffer.from('PDF!'),
  });
  assert.deepEqual(harness.events, ['db-shell', 'original-saved', 'extract']);
  assert.equal(result.status, 'pending');
  assert.equal(result.pageCount, 3);
  assert.equal(result.contentType, 'PDF');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.ingestions(), 1);
});

test('unreadable file remains a retryable failed library row with its original preserved', async () => {
  const harness = fileHarness({ extractionFails: true });
  const result = await harness.service.createFromFile('user-1', {
    originalname: 'Course.pdf', mimetype: 'application/pdf', size: 4,
    buffer: Buffer.from('PDF!'),
  });
  assert.deepEqual(harness.events, ['db-shell', 'original-saved', 'extract']);
  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'FILE_EXTRACTION_FAILED');
  assert.equal(harness.ingestions(), 0);
});

test('page order accepts every owned page exactly once and survives a reload', async () => {
  const pages = [
    { id: 'p1', documentId: 'doc-1', pageNumber: 1, position: 0, mimeType: 'image/jpeg', originalName: null, rotation: 0, ocrStatus: 'READY', ocrText: 'one', ocrError: null },
    { id: 'p2', documentId: 'doc-1', pageNumber: 2, position: 1, mimeType: 'image/jpeg', originalName: null, rotation: 0, ocrStatus: 'READY', ocrText: 'two', ocrError: null },
  ];
  const doc = documentRow({ contentType: 'NOTEBOOK', sourceRef: 'scan:x', pageCount: 2 });
  const prisma = {
    document: {
      findFirst: async ({ where }) => where.userId === 'user-1' ? { id: doc.id } : null,
      findUnique: async () => doc,
    },
    documentPage: {
      findMany: async (args) => args.select ? pages.map(({ id }) => ({ id })) : [...pages].sort((a, b) => a.position - b.position),
      update: async ({ where, data }) => {
        pages.find((page) => page.id === where.id).position = data.position;
        return pages.find((page) => page.id === where.id);
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };
  const service = new DocumentService(prisma, {}, {}, {}, {});
  const reordered = await service.reorderPages('user-1', 'doc-1', ['p2', 'p1']);
  assert.deepEqual(reordered.map((page) => page.id), ['p2', 'p1']);
  await assert.rejects(() => service.reorderPages('user-1', 'doc-1', ['p1', 'p1']), /exactly once/);
  await assert.rejects(() => service.reorderPages('user-2', 'doc-1', ['p2', 'p1']), /Document not found/);
});

test('library search remains owner-scoped and includes collection, extracted text and page OCR', async () => {
  let query;
  const service = new LibraryService({
    document: { findMany: async (args) => { query = args.where; return []; } },
    collection: { findMany: async () => [] },
  }, {}, {});
  await service.listPaged('owner-a', { q: 'Bismarck', contentType: 'NOTEBOOK' });
  assert.equal(query.userId, 'owner-a');
  assert.equal(query.deletedAt, null);
  assert.equal(query.contentType, 'NOTEBOOK');
  assert.ok(query.OR.some((clause) => clause.content?.contains === 'Bismarck'));
  assert.ok(query.OR.some((clause) => clause.pages?.some?.ocrText?.contains === 'Bismarck'));
  assert.ok(query.OR.some((clause) => clause.collection?.name?.contains === 'Bismarck'));
});

test('partial state is terminal, explicit and retryable rather than an infinite spinner', () => {
  const state = resolveDocumentPipeline('partial', null);
  assert.equal(state.phase, 'partial');
  assert.equal(state.canRetry, true);
  assert.deepEqual(state.progress, { mode: 'determinate', percent: 100 });
});

test('V1 library UI exposes explicit menu, private viewers, page retry, drag order and bounded multi-page import', () => {
  const root = path.resolve(__dirname, '../../..');
  const library = fs.readFileSync(path.join(root, 'apps/mobile/app/library.tsx'), 'utf8');
  const detail = fs.readFileSync(path.join(root, 'apps/mobile/app/library/[id].tsx'), 'utf8');
  const scan = fs.readFileSync(path.join(root, 'apps/mobile/app/scan.tsx'), 'utf8');
  assert.match(library, /label="⋮"/);
  assert.match(library, /CONTENT_TYPES/);
  assert.match(library, /confirmTrash/);
  assert.match(detail, /apiBinary/);
  assert.match(detail, /retry-ocr/);
  assert.match(detail, /application\/pdf/);
  assert.match(scan, /MAX_PAGES = 50/);
  assert.match(scan, /draggable/);
  assert.match(scan, /NOTEBOOK/);
});

test('Trash UI confirms irreversible owner-scoped purge and exact-count emptying', () => {
  const root = path.resolve(__dirname, '../../..');
  const library = fs.readFileSync(path.join(root, 'apps/mobile/app/library.tsx'), 'utf8');
  const cache = fs.readFileSync(path.join(root, 'apps/mobile/lib/library-cache.ts'), 'utf8');
  assert.match(library, /\/library\/documents\/\$\{target\.id\}\/permanent/);
  assert.match(library, /api<\{ deletedCount: number \}>\('\/library\/trash'/);
  assert.match(library, /body: \{ expectedCount \}/);
  assert.match(library, /library7\.trash\.permanentDetail/);
  assert.match(library, /library7\.trash\.emptyDetail/);
  assert.match(library, /invalidateLibraryCache/);
  assert.match(cache, /AsyncStorage\.multiRemove/);
});
