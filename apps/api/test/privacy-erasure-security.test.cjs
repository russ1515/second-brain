'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');

const { PrivacyService } = require('../dist/privacy/privacy.service.js');
const { IngestionService } = require('../dist/documents/ingestion/ingestion.service.js');

test('privacy export omits persisted answer keys and grading rubrics', async () => {
  const captured = {};
  const genericModel = {
    findMany: async () => [],
    findUnique: async () => null,
  };
  const prisma = new Proxy({}, {
    get(_target, property) {
      if (property === 'assessment' || property === 'readingExercise') {
        return {
          findMany: async (args) => {
            captured[property] = args;
            return [];
          },
        };
      }
      return genericModel;
    },
  });

  let exportedDocuments;
  const service = new PrivacyService(prisma, {}, {
    exportUserMedia: async (_userId, documentIds) => {
      exportedDocuments = documentIds;
      return { avatar: null, scans: [], reportScreenshots: [] };
    },
  });
  const result = await service.exportData('owner-1');

  assert.equal(captured.assessment.where.userId, 'owner-1');
  assert.equal(captured.assessment.select.questions, undefined);
  assert.equal(captured.readingExercise.where.userId, 'owner-1');
  assert.equal(captured.readingExercise.select.questions, undefined);
  assert.equal(captured.readingExercise.select.result, true);
  assert.deepEqual(exportedDocuments, []);
  assert.deepEqual(result.data.privateMedia, { avatar: null, scans: [], reportScreenshots: [] });
});

function accountDeletionFixture(passwordHash, {
  qdrantFails = false,
  sqlFails = false,
  initialStatus = 'active',
  administrativeRequest = false,
} = {}) {
  const events = [];
  const stagedAt = new Date('2026-09-27T09:00:00.000Z');
  let accountStatus = initialStatus;
  let updatedAt = initialStatus === 'active'
    ? new Date('2026-09-27T08:00:00.000Z')
    : stagedAt;
  const prisma = {
    user: {
      findUnique: async () => ({ passwordHash }),
      delete: async () => {
        events.push('sql-delete');
        if (sqlFails) throw new Error('sql owner delete failed');
      },
    },
    $transaction: async (operation, options) => {
      events.push('transaction-start');
      assert.deepEqual(options, { timeout: 60_000 });
      try {
        const value = await operation({
          $executeRaw: async (_strings, lockKey) => { events.push(`lock:${lockKey}`); },
          accountDeletionRequest: {
            findFirst: async () => administrativeRequest ? { id: 'admin-request' } : null,
          },
          user: {
            findUnique: async () => ({ id: 'owner-1', accountStatus, updatedAt }),
            findFirst: async (args) => {
              events.push('staged-recheck');
              return accountStatus === args.where.accountStatus && updatedAt.getTime() === args.where.updatedAt.getTime()
                ? { id: 'owner-1' }
                : null;
            },
            update: async (args) => {
              events.push(`status:${args.data.accountStatus}`);
              accountStatus = args.data.accountStatus;
              updatedAt = stagedAt;
              return { updatedAt };
            },
            updateMany: async (args) => {
              events.push(`restore:${args.data.accountStatus}`);
              accountStatus = args.data.accountStatus;
              return { count: 1 };
            },
          },
        });
        events.push('transaction-commit');
        return value;
      } catch (error) {
        events.push('transaction-rollback');
        throw error;
      }
    },
  };
  const qdrant = {
    deleteByUser: async () => {
      events.push('vector-purge');
      if (qdrantFails) throw new Error('qdrant unavailable');
    },
  };
  const media = {
    deleteUserMediaAnd: async (_userId, finalize) => {
      events.push('media-lock');
      return finalize();
    },
  };
  return {
    service: new PrivacyService(prisma, qdrant, media),
    events,
    accountStatus: () => accountStatus,
  };
}

test('account erasure commits deletion_pending before vector and owner deletion', async () => {
  const passwordHash = await argon2.hash('correct horse battery staple');
  const { service, events } = accountDeletionFixture(passwordHash);

  await service.deleteAccount('owner-1', 'correct horse battery staple');

  assert.deepEqual(events, [
    'transaction-start',
    'lock:account-data:owner-1',
    'status:deletion_pending',
    'transaction-commit',
    'transaction-start',
    'lock:account-data:owner-1',
    'staged-recheck',
    'vector-purge',
    'media-lock',
    'sql-delete',
    'transaction-commit',
  ]);
});

test('Qdrant failure restores active before any other account data is removed', async () => {
  const passwordHash = await argon2.hash('correct horse battery staple');
  const { service, events, accountStatus } = accountDeletionFixture(passwordHash, {
    qdrantFails: true,
  });

  await assert.rejects(
    () => service.deleteAccount('owner-1', 'correct horse battery staple'),
    (error) => error?.response?.code === 'PRIVACY_ERASURE_UNAVAILABLE',
  );

  assert.deepEqual(events, [
    'transaction-start',
    'lock:account-data:owner-1',
    'status:deletion_pending',
    'transaction-commit',
    'transaction-start',
    'lock:account-data:owner-1',
    'staged-recheck',
    'vector-purge',
    'restore:active',
    'transaction-commit',
  ]);
  assert.equal(accountStatus(), 'active');
});

test('SQL failure after vector purge leaves the account deletion_pending', async () => {
  const passwordHash = await argon2.hash('correct horse battery staple');
  const { service, events, accountStatus } = accountDeletionFixture(passwordHash, {
    sqlFails: true,
  });

  await assert.rejects(
    () => service.deleteAccount('owner-1', 'correct horse battery staple'),
    /sql owner delete failed/,
  );

  assert.deepEqual(events, [
    'transaction-start',
    'lock:account-data:owner-1',
    'status:deletion_pending',
    'transaction-commit',
    'transaction-start',
    'lock:account-data:owner-1',
    'staged-recheck',
    'vector-purge',
    'media-lock',
    'sql-delete',
    'transaction-rollback',
  ]);
  assert.equal(accountStatus(), 'deletion_pending');
});

test('document ingestion revalidates ownership under the same account-data lock before Qdrant upsert', async () => {
  const events = [];
  const row = {
    id: 'document-1',
    userId: 'owner-1',
    content: 'A short source document.',
    status: 'pending',
    stage: null,
    deletedAt: null,
  };
  const documentModel = {
    findUnique: async () => ({ ...row }),
    findFirst: async (args) => {
      events.push('owner-recheck');
      assert.equal(args.where.user.accountStatus, 'active');
      return { ...row };
    },
    update: async ({ data }) => (Object.assign(row, data), { ...row }),
    updateMany: async ({ data }) => (Object.assign(row, data), { count: 1 }),
  };
  const prisma = {
    document: documentModel,
    documentChunk: {
      deleteMany: async () => undefined,
    },
    $transaction: async (operation) => operation({
      $queryRaw: async (_strings, lockKey) => { events.push(`lock:${lockKey}`); },
      document: documentModel,
      documentChunk: {
        deleteMany: async () => undefined,
        createMany: async () => { events.push('sql-chunks'); },
      },
    }),
  };
  const qdrant = {
    ensureCollection: async () => undefined,
    deleteByDocument: async () => undefined,
    upsert: async () => { events.push('vector-upsert'); },
  };
  const service = new IngestionService(
    prisma,
    { chunk: () => ['A short source document.'] },
    { clean: (value) => value },
    { dimensions: 1, embedDocuments: async () => [[0.5]] },
    qdrant,
    { extractFromDocument: async () => undefined },
    { linkToExisting: async () => undefined },
  );

  await service.ingest(row.id);

  assert.equal(events.filter((event) => event === 'lock:account-data:owner-1').length, 2);
  assert.equal(events.filter((event) => event === 'lock:document-ingestion:document-1').length, 2);
  assert.ok(events.indexOf('owner-recheck') < events.indexOf('vector-upsert'));
  assert.ok(events.indexOf('vector-upsert') < events.indexOf('sql-chunks'));
});
