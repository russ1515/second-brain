'use strict';

require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { DocumentService } = require('../dist/documents/document.service.js');
const { IngestionService } = require('../dist/documents/ingestion/ingestion.service.js');

function removalFixture({ ownerExists = true, qdrantFails = false, sqlDeleteFails = false, alreadyDeleted = false } = {}) {
  const events = [];
  const state = { deletedAt: alreadyDeleted ? new Date('2026-09-20T00:00:00Z') : null, status: 'ready', stage: null };
  const tx = {
    $queryRaw: async (_strings, key) => events.push(`lock:${key}`),
    document: {
      findFirst: async (args) => {
        if (args.select?.deletedAt) {
          events.push('owner-recheck');
          return ownerExists ? { id: 'document-1', deletedAt: state.deletedAt } : null;
        }
        events.push('staged-recheck');
        return state.deletedAt && state.stage === 'deleting' ? { id: 'document-1' } : null;
      },
      update: async ({ data }) => {
        events.push('barrier');
        assert.equal(data.stage, 'deleting');
        assert.equal(data.status, 'processing');
        assert.ok(data.deletedAt instanceof Date);
        Object.assign(state, data);
        return { id: 'document-1', ...state };
      },
    },
    documentChunk: {
      deleteMany: async () => (events.push('chunk-delete'), { count: 2 }),
    },
  };
  const prisma = {
    document: {
      delete: async () => {
        events.push('sql-hard-delete');
        if (sqlDeleteFails) throw new Error('sql delete unavailable');
        return { id: 'document-1' };
      },
    },
    documentChunk: tx.documentChunk,
    $transaction: async (operation, options) => {
      events.push('tx-start');
      assert.deepEqual(options, { timeout: 60_000 });
      try {
        const result = await operation(tx);
        events.push('tx-commit');
        return result;
      } catch (error) {
        events.push('tx-rollback');
        throw error;
      }
    },
  };
  const ingestion = new IngestionService(prisma, {}, {}, {}, {
    deleteByDocument: async () => {
      events.push('qdrant-purge');
      if (qdrantFails) throw new Error('qdrant unavailable');
    },
  }, {}, {});
  const media = {
    deleteScanPagesAnd: async (_userId, _documentId, finalize) => {
      events.push('media-tombstone');
      return finalize();
    },
  };
  return { service: new DocumentService(prisma, {}, ingestion, {}, media), events, state };
}

test('document removal commits a barrier before cleanup under a second account lock', async () => {
  const { service, events } = removalFixture();
  await service.remove('owner-1', 'document-1');
  assert.deepEqual(events, [
    'tx-start', 'lock:account-data:owner-1', 'owner-recheck', 'barrier', 'tx-commit',
    'tx-start', 'lock:account-data:owner-1', 'staged-recheck', 'qdrant-purge',
    'chunk-delete', 'media-tombstone', 'sql-hard-delete', 'tx-commit',
  ]);
});

test('ownership failure performs no destructive cleanup', async () => {
  const { service, events } = removalFixture({ ownerExists: false });
  await assert.rejects(() => service.remove('owner-1', 'document-1'), { name: 'NotFoundException' });
  assert.deepEqual(events, ['tx-start', 'lock:account-data:owner-1', 'owner-recheck', 'tx-rollback']);
});

test('Qdrant failure leaves the committed deletion barrier retryable', async () => {
  const { service, events, state } = removalFixture({ qdrantFails: true });
  await assert.rejects(() => service.remove('owner-1', 'document-1'), /qdrant unavailable/);
  assert.ok(state.deletedAt);
  assert.equal(state.stage, 'deleting');
  assert.deepEqual(events.slice(-5), [
    'tx-start', 'lock:account-data:owner-1', 'staged-recheck', 'qdrant-purge', 'tx-rollback',
  ]);
});

test('SQL failure happens after purge and leaves the deletion barrier retryable', async () => {
  const { service, events, state } = removalFixture({ sqlDeleteFails: true });
  await assert.rejects(() => service.remove('owner-1', 'document-1'), /sql delete unavailable/);
  assert.ok(state.deletedAt);
  assert.equal(state.stage, 'deleting');
  assert.deepEqual(events.slice(-5), [
    'qdrant-purge', 'chunk-delete', 'media-tombstone', 'sql-hard-delete', 'tx-rollback',
  ]);
});

test('retry accepts an already soft-deleted document and restages cleanup', async () => {
  const { service, events } = removalFixture({ alreadyDeleted: true });
  await service.remove('owner-1', 'document-1');
  assert.equal(events.filter((event) => event === 'barrier').length, 1);
  assert.ok(events.includes('sql-hard-delete'));
});

test('reindex refuses an empty OCR scan before ingestion', async () => {
  let ingestions = 0;
  const scan = { id: 'scan-empty', userId: 'owner-1', sourceRef: 'scan:a', content: '', charCount: 0, status: 'failed' };
  const prisma = { $transaction: async (operation) => operation({
    $queryRaw: async () => undefined,
    document: { findFirst: async () => scan },
  }) };
  const service = new DocumentService(prisma, {}, { ingest: async () => { ingestions += 1; } }, {}, {});
  await assert.rejects(
    () => service.reindex('owner-1', 'scan-empty'),
    (error) => error?.response?.code === 'SCAN_OCR_RETRY_REQUIRED',
  );
  assert.equal(ingestions, 0);
});

test('a durable ingestion claim suppresses a concurrent retry provider call', async () => {
  const row = { id: 'document-1', userId: 'owner-1', content: 'Durable source text.', charCount: 20, status: 'pending', stage: null, deletedAt: null };
  let providerCalls = 0;
  let announce;
  let release;
  const started = new Promise((resolve) => { announce = resolve; });
  const blocked = new Promise((resolve) => { release = resolve; });
  const tx = {
    $queryRaw: async () => undefined,
    document: {
      findUnique: async () => ({ ...row }),
      findFirst: async () => ({ ...row }),
      update: async ({ data }) => (Object.assign(row, data), { ...row }),
      updateMany: async ({ data }) => (Object.assign(row, data), { count: 1 }),
    },
    documentChunk: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 1 }) },
  };
  const prisma = { ...tx, $transaction: async (operation) => operation(tx) };
  const service = new IngestionService(
    prisma,
    { chunk: () => ['Durable source text.'] },
    { clean: (value) => value },
    { dimensions: 2, embedDocuments: async () => { providerCalls += 1; announce(); await blocked; return [[0.1, 0.2]]; } },
    { ensureCollection: async () => undefined, deleteByDocument: async () => undefined, upsert: async () => undefined },
    { extractFromDocument: async () => undefined },
    { linkToExisting: async () => undefined },
  );
  const first = service.ingest(row.id);
  await started;
  await service.ingest(row.id);
  release();
  await first;
  assert.equal(providerCalls, 1);
  assert.equal(row.status, 'ready');
});
