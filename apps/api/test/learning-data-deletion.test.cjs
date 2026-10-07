const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LearningDataDeletionService,
} = require('../dist/experience-sessions/learning-data-deletion.service.js');

function fakePrisma(overrides = {}) {
  const calls = [];
  const model = (name, methods) => Object.fromEntries(methods.map((method) => [
    method,
    async (args) => {
      calls.push([name, method, args]);
      return method.endsWith('Many') ? { count: 1 } : null;
    },
  ]));
  const prisma = {
    calls,
    experienceSession: model('experienceSession', ['findFirst', 'findMany', 'count', 'deleteMany', 'updateMany']),
    lesson: model('lesson', ['findFirst', 'findMany', 'count', 'deleteMany']),
    studySession: model('studySession', ['findMany', 'deleteMany']),
    document: model('document', ['findMany', 'updateMany']),
    homework: model('homework', ['findMany']),
    reviewable: model('reviewable', ['findMany', 'deleteMany']),
    tutorMessage: model('tutorMessage', ['count']),
    exerciseAttempt: model('exerciseAttempt', ['count']),
    card: model('card', ['count', 'deleteMany']),
    recommendation: model('recommendation', ['findMany', 'count', 'deleteMany']),
    academicWorkspace: model('academicWorkspace', ['findMany', 'updateMany']),
    documentChunk: model('documentChunk', ['deleteMany']),
    studyResource: model('studyResource', ['deleteMany']),
    conceptDocument: model('conceptDocument', ['deleteMany']),
    tutorSession: model('tutorSession', ['deleteMany']),
    goal: model('goal', ['findFirst', 'deleteMany']),
    async $executeRaw() { return 1; },
    async $transaction(fn) { return fn(prisma); },
  };
  for (const [name, methods] of Object.entries(overrides)) {
    Object.assign(prisma[name], methods);
  }
  return prisma;
}

function dependencies(prisma) {
  const qdrantCalls = [];
  const cacheCalls = [];
  return {
    service: new LearningDataDeletionService(
      prisma,
      { async deleteByDocument(collection, id) { qdrantCalls.push([collection, id]); } },
      {
        async invalidate(key) { cacheCalls.push(['key', key]); },
        async invalidatePrefix(prefix) { cacheCalls.push(['prefix', prefix]); },
      },
    ),
    qdrantCalls,
    cacheCalls,
  };
}

test('session preview and delete use exact links, purge derived activities, and move generated document to Trash', async () => {
  let sessionExists = true;
  const prisma = fakePrisma({
    experienceSession: {
      async findFirst() {
        return sessionExists ? {
          id: 'session-a', userId: 'user-a', title: 'Algebra', lessonId: 'lesson-a',
          tutorSessionId: null, studySessionId: null,
        } : null;
      },
      async findMany() { return [{ id: 'session-a' }]; },
      async deleteMany() { sessionExists = false; return { count: 1 }; },
    },
    lesson: {
      async findMany() { return [{ id: 'lesson-a', sourceDocumentId: 'doc-a' }]; },
      async count() { return 0; },
      async deleteMany() { return { count: 1 }; },
    },
    studySession: { async findMany() { return [{ id: 'study-a' }]; } },
    document: {
      async findMany() { return [{ id: 'doc-a', sourceRef: 'lesson:lesson-a', contentType: 'LESSON_AI' }]; },
    },
    homework: { async findMany() { return [{ id: 'homework-a' }]; } },
    reviewable: { async findMany() { return [{ id: 'review-a' }, { id: 'review-b' }]; } },
    tutorMessage: { async count() { return 0; } },
    exerciseAttempt: { async count() { return 3; } },
    card: { async count() { return 8; } },
    recommendation: { async findMany() { return [{ id: 'recommendation-a' }]; } },
    academicWorkspace: { async findMany() { return []; } },
  });
  const { service, qdrantCalls, cacheCalls } = dependencies(prisma);

  const preview = await service.previewSession('user-a', 'session-a');
  assert.equal(preview.counts.sessions, 1);
  assert.equal(preview.counts.lessons, 1);
  assert.equal(preview.counts.cards, 8);
  assert.equal(preview.counts.reviewItems, 2);
  assert.equal(preview.counts.exerciseAttempts, 3);
  assert.equal(preview.counts.documentsMovedToTrash, 1);
  assert.equal(preview.reversibleDocuments, true);

  const result = await service.deleteSession('user-a', 'session-a');
  assert.equal(result.deleted, true);
  assert.deepEqual(qdrantCalls, [['document_chunks', 'doc-a']]);
  assert.ok(prisma.calls.some(([model, method]) => model === 'document' && method === 'updateMany'));
  assert.ok(cacheCalls.some(([kind, value]) => kind === 'prefix' && value === 'research:web:'));

  const retry = await service.deleteSession('user-a', 'session-a');
  assert.deepEqual(retry, { deleted: false, alreadyDeleted: true, preview: null });
});

test('a source document referenced elsewhere is preserved and never purged', async () => {
  const prisma = fakePrisma({
    experienceSession: {
      async findFirst() { return { id: 'session-a', userId: 'user-a', title: null, lessonId: 'lesson-a', tutorSessionId: null, studySessionId: null }; },
      async findMany() { return [{ id: 'session-a' }]; },
    },
    lesson: {
      async findMany() { return [{ id: 'lesson-a', sourceDocumentId: 'doc-shared' }]; },
      async count() { return 1; },
    },
    studySession: { async findMany() { return []; } },
    document: { async findMany() { return [{ id: 'doc-shared', sourceRef: 'lesson:lesson-a', contentType: 'LESSON_AI' }]; } },
    homework: { async findMany() { return []; } },
    reviewable: { async findMany() { return []; } },
    tutorMessage: { async count() { return 0; } },
    exerciseAttempt: { async count() { return 0; } },
    card: { async count() { return 0; } },
    recommendation: { async findMany() { return []; } },
    academicWorkspace: { async findMany() { return []; } },
  });
  const { service, qdrantCalls } = dependencies(prisma);
  const preview = await service.previewSession('user-a', 'session-a');
  assert.equal(preview.counts.documentsMovedToTrash, 0);
  assert.equal(preview.sharedDocumentsPreserved, 1);
  await service.deleteSession('user-a', 'session-a');
  assert.deepEqual(qdrantCalls, []);
});

test('generated lesson documents stay active when a surviving session or workspace references them', async () => {
  const variants = [
    {
      name: 'direct session documentId',
      survivingSession: { documentId: 'doc-shared', sourceReferences: [] },
      workspaceSources: [],
    },
    {
      name: 'session sourceReferences',
      survivingSession: {
        documentId: null,
        sourceReferences: [{ kind: 'document', id: 'doc-shared', title: 'Saved source' }],
      },
      workspaceSources: [],
    },
    {
      name: 'workspace sources',
      survivingSession: null,
      workspaceSources: [{ kind: 'document', id: 'doc-shared', title: 'Workspace source' }],
    },
    {
      name: 'workspace research citation',
      survivingSession: null,
      workspaceSources: [{
        kind: 'research-source',
        id: 'research-a',
        citations: [{ id: 'citation-a', title: 'Citation', kind: 'document', documentId: 'doc-shared' }],
      }],
    },
  ];

  for (const variant of variants) {
    const prisma = fakePrisma({
      experienceSession: {
        async findFirst() {
          return {
            id: 'session-deleted', userId: 'user-a', title: null, lessonId: 'lesson-a',
            tutorSessionId: null, studySessionId: null,
          };
        },
        async findMany(args) {
          if (args.select?.documentId) return variant.survivingSession ? [variant.survivingSession] : [];
          return [{ id: 'session-deleted' }];
        },
      },
      lesson: {
        async findMany() { return [{ id: 'lesson-a', sourceDocumentId: 'doc-shared' }]; },
        async count() { return 0; },
      },
      studySession: { async findMany() { return []; } },
      document: {
        async findMany() {
          return [{ id: 'doc-shared', sourceRef: 'lesson:lesson-a', contentType: 'LESSON_AI' }];
        },
      },
      homework: { async findMany() { return []; } },
      reviewable: { async findMany() { return []; } },
      tutorMessage: { async count() { return 0; } },
      exerciseAttempt: { async count() { return 0; } },
      card: { async count() { return 0; } },
      recommendation: { async findMany() { return []; } },
      academicWorkspace: {
        async findMany() {
          return variant.workspaceSources.length
            ? [{ id: 'workspace-a', sources: variant.workspaceSources }]
            : [];
        },
      },
    });
    const { service, qdrantCalls } = dependencies(prisma);
    const preview = await service.previewSession('user-a', 'session-deleted');
    assert.equal(preview.counts.documentsMovedToTrash, 0, variant.name);
    assert.equal(preview.sharedDocumentsPreserved, 1, variant.name);
    await service.deleteSession('user-a', 'session-deleted');
    assert.deepEqual(qdrantCalls, [], variant.name);
  }
});

test('goal deletion removes only goal continuity/recommendations and preserves learning artifacts', async () => {
  let goalExists = true;
  const prisma = fakePrisma({
    goal: {
      async findFirst() { return goalExists ? { id: 'goal-a', userId: 'user-a', title: 'Exam' } : null; },
      async deleteMany() { goalExists = false; return { count: 1 }; },
    },
    recommendation: { async count() { return 1; } },
  });
  const { service } = dependencies(prisma);
  const result = await service.deleteGoal('user-a', 'goal-a');
  assert.equal(result.preview.counts.sessions, 0);
  assert.equal(result.preview.counts.lessons, 0);
  assert.equal(result.preview.counts.documentsMovedToTrash, 0);
  assert.equal(prisma.calls.some(([model, method]) => model === 'experienceSession' && method === 'deleteMany'), false);
  const detach = prisma.calls.find(([model, method]) => model === 'experienceSession' && method === 'updateMany');
  assert.deepEqual(detach?.[2], {
    where: { userId: 'user-a', goalId: 'goal-a' },
    data: { goalId: null, version: { increment: 1 } },
  });
  assert.equal(prisma.calls.some(([model]) => model === 'lesson' || model === 'document'), false);
  assert.equal((await service.deleteGoal('user-a', 'goal-a')).alreadyDeleted, true);
});

test('another user cannot preview a session deletion', async () => {
  const prisma = fakePrisma({
    experienceSession: { async findFirst() { return null; } },
  });
  const { service } = dependencies(prisma);
  await assert.rejects(() => service.previewSession('user-b', 'session-a'), /not found/i);
});
