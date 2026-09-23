'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { LibraryService } = require('../dist/documents/library/library.service.js');
const { RetrievalService } = require('../dist/documents/retrieval/retrieval.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function row(id, createdAt) {
  return {
    id, userId: 'user-1', title: `Document ${id}`, source: 'file', sourceRef: `${id}.pdf`,
    content: 'Owned content', charCount: 13, status: 'ready', stage: null, error: null,
    createdAt, updatedAt: createdAt, isFavorite: false, deletedAt: null,
    collectionId: null, summary: 'Summary', subject: 'Science', language: 'English',
    author: null, difficulty: 'beginner', enrichedAt: createdAt,
  };
}

test('paged library is bounded, user-isolated, and returns a cursor without loading all documents', async () => {
  const calls = [];
  const now = new Date('2026-09-10T10:00:00.000Z');
  const prisma = {
    document: { findMany: async (args) => { calls.push(args); return [row('d2', now), row('d1', now)]; } },
    conceptDocument: { findMany: async () => [] },
    collection: { findMany: async () => [] },
  };
  const service = new LibraryService(prisma, {}, {});
  const page = await service.listPaged('user-1', { filter: 'all', q: 'science' }, 'newest', 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, 'd2');
  assert.equal(calls[0].take, 2);
  assert.equal(calls[0].where.userId, 'user-1');
  assert.equal(calls[0].where.deletedAt, null);
});

test('explicit Ask Library selection keeps only caller-owned document ids', async () => {
  const prisma = {
    document: { findMany: async (args) => {
      assert.equal(args.where.userId, 'user-1');
      assert.deepEqual(args.where.id.in, ['owned', 'foreign']);
      return [{ id: 'owned' }];
    } },
  };
  const service = new RetrievalService({}, {}, prisma);
  assert.deepEqual(await service.resolveScope('user-1', { documentIds: ['owned', 'foreign'] }), ['owned']);
});

test('retrieval always combines selected documents with the authenticated user filter', async () => {
  let filter;
  const embeddings = { embedQuery: async () => [0.1, 0.2] };
  const qdrant = { search: async (_collection, _vector, options) => {
    filter = options.filter;
    return [{ score: 0.9, payload: { userId: 'user-1', documentId: 'owned', chunkIndex: 0, content: 'passage' } }];
  } };
  const prisma = { document: { findMany: async () => [{ id: 'owned', title: 'Owned' }] } };
  const service = new RetrievalService(embeddings, qdrant, prisma);
  const result = await service.search('user-1', 'question', { documentIds: ['owned'] });
  assert.deepEqual(filter.must, [
    { key: 'userId', match: { value: 'user-1' } },
    { key: 'documentId', match: { any: ['owned'] } },
  ]);
  assert.equal(result.results[0].documentTitle, 'Owned');
});

test('Lot 7 UI keeps one importer, real pipeline, offline cache, citations, batch retry, and context transitions', () => {
  const library = read('apps/mobile/app/library.tsx');
  const detail = read('apps/mobile/app/library/[id].tsx');
  const ask = read('apps/mobile/app/library/ask.tsx');
  const batch = read('apps/mobile/components/document/batch-import.tsx');
  const pipeline = read('apps/mobile/components/document/document-pipeline.tsx');
  const sources = read('apps/mobile/components/ds/sources.tsx');
  const cache = read('apps/mobile/lib/library-cache.ts');
  assert.match(library, /pickDocuments/);
  assert.match(library, /loadLibraryCache/);
  assert.match(library, /LibraryEmpty/);
  assert.match(pipeline, /resolveDocumentPipeline/);
  assert.match(batch, /Promise\.all\(\[worker\(\), worker\(\)\]\)/);
  assert.match(batch, /reindex/);
  assert.match(detail, /documentId: document\.id/);
  assert.match(detail, /pathname: '\/tutor'/);
  assert.match(detail, /pathname: '\/brain'/);
  assert.match(detail, /library\/workspace/);
  assert.match(ask, /documentIds: selectedIds/);
  assert.match(sources, /testID="source-preview"/);
  assert.match(cache, /\$\{PREFIX\}\.\$\{userId\}/);
});

test('responsive, i18n, quota and reduced-motion contracts remain visible in source', () => {
  const library = read('apps/mobile/app/library.tsx');
  const askPanel = read('apps/mobile/components/document/grounded-ask.tsx');
  const pipeline = read('apps/mobile/components/document/document-pipeline.tsx');
  const i18n = read('apps/mobile/lib/i18n.tsx');
  assert.match(library, /desktop \? 'row' : 'column'/);
  assert.match(askPanel, /isQuotaError/);
  assert.match(askPanel, /animationType=\{reducedMotion \? 'none' : 'slide'\}/);
  assert.match(pipeline, /reducedMotion/);
  assert.match(i18n, /'library7\.owned': 'What I own'/);
  assert.match(i18n, /'library7\.owned': 'Ce que je possède'/);
});
