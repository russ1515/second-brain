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
    $executeRaw: async (_strings, key) => events.push(`lock:${key}`),
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

function trashPurgeFixture({ trashed = true, ownerId = 'owner-1' } = {}) {
  const events = [];
  const state = {
    exists: true,
    userId: ownerId,
    deletedAt: trashed ? new Date('2026-10-06T00:00:00Z') : null,
    stage: null,
  };
  const saved = {};
  const tx = {
    $executeRaw: async (_strings, key) => events.push(`lock:${key}`),
    document: {
      findFirst: async ({ where }) => {
        if (!state.exists || where.userId !== state.userId || !state.deletedAt) return null;
        if (where.stage && state.stage !== where.stage) return null;
        return { id: 'document-1', stage: state.stage };
      },
      findMany: async () => state.exists && state.deletedAt ? [{ id: 'document-1' }] : [],
      update: async ({ data }) => {
        events.push('barrier'); Object.assign(state, data); return { id: 'document-1' };
      },
      deleteMany: async ({ where }) => {
        events.push('document-delete');
        if (!state.exists || where.userId !== state.userId || state.stage !== 'deleting') return { count: 0 };
        state.exists = false;
        return { count: 1 };
      },
      count: async () => state.exists ? 1 : 0,
    },
    studyResource: {
      findMany: async () => [{ deckId: 'generated-deck' }],
      count: async () => 0,
    },
    academicWorkspace: {
      findMany: async () => [{ id: 'workspace-1', sources: [
        { kind: 'document', id: 'document-1' },
        { kind: 'collection', id: 'shared-collection' },
      ] }],
      update: async ({ data }) => { events.push('workspace-pruned'); saved.workspace = data.sources; },
    },
    experienceSession: {
      findMany: async () => [{
        id: 'experience-1',
        sourceReferences: [
          { kind: 'document', id: 'document-1' },
          { kind: 'concept', id: 'shared-concept' },
        ],
        activeContexts: {
          version: 1,
          ownerUserId: ownerId,
          capturedAt: '2026-10-06T00:00:00.000Z',
          items: [
            { kind: 'document', referenceId: 'document-1' },
            { kind: 'concept', referenceId: 'shared-concept' },
          ],
        },
      }],
      update: async ({ data }) => { events.push('experience-pruned'); saved.experience = data; },
    },
    tutorMessage: {
      findMany: async () => [{ id: 'message-1', citations: [
        { documentId: 'document-1', chunkIndex: 0 },
        { documentId: 'other-document', chunkIndex: 1 },
      ] }],
      update: async ({ data }) => { events.push('citations-pruned'); saved.citations = data.citations; },
    },
    card: { deleteMany: async () => (events.push('exclusive-cards-delete'), { count: 2 }) },
    recommendation: {
      deleteMany: async ({ where }) => {
        assert.equal(where.userId, 'owner-1');
        assert.deepEqual(where.OR, [
          { targetKind: 'document', targetId: 'document-1' },
          { dedupeKey: 'document:document-1' },
        ]);
        events.push('document-recommendations-delete');
        return { count: 1 };
      },
    },
    deck: {
      findFirst: async () => ({
        id: 'generated-deck',
        _count: { cards: 0, languageProfiles: 0, planItems: 0 },
      }),
      deleteMany: async () => (events.push('empty-generated-deck-delete'), { count: 1 }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: async (operation, options) => {
      assert.deepEqual(options, { timeout: 60_000 });
      return operation(tx);
    },
  };
  const service = new DocumentService(
    prisma,
    {},
    { purgeVectors: async () => events.push('qdrant-and-chunks-purge') },
    {},
    {
      deleteScanPagesAnd: async (_userId, _documentId, finalize) => {
        events.push('private-media-tombstone');
        return finalize();
      },
    },
  );
  return { service, events, state, saved, prisma };
}

test('permanent Trash deletion purges exclusive data and prunes only invalid references', async () => {
  const { service, events, state, saved } = trashPurgeFixture();
  assert.equal(await service.permanentlyDeleteTrashed('owner-1', 'document-1'), true);
  assert.equal(state.exists, false);
  assert.ok(events.includes('qdrant-and-chunks-purge'));
  assert.ok(events.includes('private-media-tombstone'));
  assert.ok(events.includes('exclusive-cards-delete'));
  assert.ok(events.includes('document-recommendations-delete'));
  assert.ok(events.includes('document-delete'));
  assert.ok(events.includes('empty-generated-deck-delete'));
  assert.deepEqual(saved.workspace, [{ kind: 'collection', id: 'shared-collection' }]);
  assert.deepEqual(saved.experience.sourceReferences, [{ kind: 'concept', id: 'shared-concept' }]);
  assert.deepEqual(saved.experience.activeContexts.items, [
    { kind: 'concept', referenceId: 'shared-concept' },
  ]);
  assert.deepEqual(saved.citations, [{ documentId: 'other-document', chunkIndex: 1 }]);

  const destructiveEvents = events.length;
  assert.equal(await service.permanentlyDeleteTrashed('owner-1', 'document-1'), false);
  assert.equal(events.slice(destructiveEvents).includes('qdrant-and-chunks-purge'), false);
});

test('permanent Trash deletion cannot delete active or foreign documents', async () => {
  const active = trashPurgeFixture({ trashed: false });
  assert.equal(await active.service.permanentlyDeleteTrashed('owner-1', 'document-1'), false);
  assert.equal(active.state.exists, true);
  assert.equal(active.events.includes('qdrant-and-chunks-purge'), false);

  const foreign = trashPurgeFixture({ ownerId: 'owner-2' });
  assert.equal(await foreign.service.permanentlyDeleteTrashed('owner-1', 'document-1'), false);
  assert.equal(foreign.state.exists, true);
  assert.equal(foreign.events.includes('qdrant-and-chunks-purge'), false);
});

test('empty Trash uses the exact owner snapshot and rejects a stale confirmation count', async () => {
  const purged = [];
  const tx = {
    $executeRaw: async () => undefined,
    document: { findMany: async ({ where }) => {
      assert.equal(where.userId, 'owner-1');
      assert.deepEqual(where.deletedAt, { not: null });
      return [{ id: 'owned-a' }, { id: 'owned-b' }];
    } },
  };
  const prisma = {
    document: { count: async ({ where }) => {
      assert.equal(where.userId, 'owner-1');
      assert.deepEqual(where.id.in, ['owned-a', 'owned-b']);
      return 0;
    } },
    $transaction: async (operation, options) => {
      assert.deepEqual(options, { timeout: 60_000 });
      return operation(tx);
    },
  };
  const service = new DocumentService(prisma, {}, {}, {}, {});
  service.permanentlyDeleteTrashed = async (userId, id) => {
    assert.equal(userId, 'owner-1'); purged.push(id); return true;
  };
  assert.deepEqual(await service.emptyTrash('owner-1', 2), { deletedCount: 2 });
  assert.deepEqual(purged, ['owned-a', 'owned-b']);
  await assert.rejects(
    () => service.emptyTrash('owner-1', 1),
    (error) => error?.response?.code === 'TRASH_CONTENT_CHANGED' && error.response.actualCount === 2,
  );
  assert.deepEqual(purged, ['owned-a', 'owned-b']);
});

test('reindex refuses an empty OCR scan before ingestion', async () => {
  let ingestions = 0;
  const scan = { id: 'scan-empty', userId: 'owner-1', sourceRef: 'scan:a', content: '', charCount: 0, status: 'failed' };
  const prisma = { $transaction: async (operation) => operation({
    $executeRaw: async () => undefined,
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
    $executeRaw: async () => undefined,
    document: {
      findUnique: async () => ({ ...row }),
      findFirst: async () => ({ ...row }),
      update: async ({ data }) => (Object.assign(row, data), { ...row }),
      updateMany: async ({ data }) => (Object.assign(row, data), { count: 1 }),
    },
    documentPage: { findMany: async () => [], count: async () => 0 },
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
