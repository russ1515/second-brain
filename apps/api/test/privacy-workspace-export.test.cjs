'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivacyService } = require('../dist/privacy/privacy.service.js');

function selected(row, select) {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => [key, row[key]]),
  );
}

function fixture({ workspaces = [], experienceSessions = [] } = {}) {
  const observed = {};
  const emptyModel = {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
  };
  const prisma = new Proxy({}, {
    get(_target, model) {
      if (model === 'academicWorkspace') {
        return {
          findMany: async (args) => {
            observed.academicWorkspace = args;
            return workspaces
              .filter((row) => row.userId === args.where.userId)
              .map((row) => selected(row, args.select));
          },
        };
      }
      if (model === 'experienceSession') {
        return {
          findMany: async (args) => {
            observed.experienceSession = args;
            return experienceSessions
              .filter((row) => row.userId === args.where.userId)
              .map((row) => selected(row, args.select));
          },
        };
      }
      return emptyModel;
    },
  });
  return {
    observed,
    service: new PrivacyService(
      prisma,
      {},
      { exportUserMedia: async () => ({ avatar: null, scans: [], reportScreenshots: [] }) },
    ),
  };
}

function workspace(id, userId, experienceSessionId = null) {
  return {
    id,
    userId,
    title: `Workspace ${id}`,
    template: 'memoire',
    objective: 'Controlled objective',
    dueAt: null,
    status: 'active',
    mode: 'guide',
    plan: [{ id: 'step-1', title: 'Frame', order: 0, completed: false }],
    sources: [{ kind: 'document', id: `document-${userId}`, title: 'Owned source' }],
    draftFormat: 'markdown',
    draftContent: `Draft ${id}`,
    assistantHistory: [],
    progress: {
      currentStep: 'step-1',
      completedSteps: [],
      totalSteps: 1,
      workflow: {
        version: 1,
        brief: { version: 1, fields: { subject: `Subject ${id}` } },
      },
    },
    autosaveRevision: 3,
    experienceSessionId,
    resumeTarget: { route: `/library/workspace/${id}` },
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:05:00.000Z'),
  };
}

function experienceSession(id, userId, workspaceRef) {
  return {
    id,
    userId,
    type: 'workspace',
    status: 'active',
    title: `Session ${id}`,
    intent: 'create',
    inputModality: 'text',
    activeContexts: [{ kind: 'workspace', id: workspaceRef }],
    currentStep: { id: 'step-1' },
    progress: { completedSteps: [] },
    productions: [{ kind: 'draft', id: workspaceRef }],
    sourceReferences: [],
    twinImpact: null,
    resumeTarget: { route: `/library/workspace/${workspaceRef}` },
    nextBestAction: null,
    tutorSessionId: null,
    studySessionId: null,
    documentId: null,
    lessonId: null,
    goalId: null,
    languageProfileId: null,
    workspaceRef,
    idempotencyKey: `server-only-${id}`,
    version: 2,
    startedAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:05:00.000Z'),
    pausedAt: null,
    completedAt: null,
  };
}

test('privacy export returns empty Academic Workspace collections for a user without dossiers', async () => {
  const { service, observed } = fixture();

  const exported = await service.exportData('owner-a');

  assert.deepEqual(exported.data.academicWorkspaces, []);
  assert.deepEqual(exported.data.experienceSessions, []);
  assert.deepEqual(observed.academicWorkspace.where, { userId: 'owner-a' });
  assert.deepEqual(observed.experienceSession.where, { userId: 'owner-a' });
});

test('privacy export includes one complete owned dossier and its owned linked session', async () => {
  const ownedWorkspace = workspace('workspace-a', 'owner-a', 'session-a');
  const ownedSession = experienceSession('session-a', 'owner-a', 'workspace-a');
  const { service, observed } = fixture({
    workspaces: [ownedWorkspace],
    experienceSessions: [ownedSession],
  });

  const exported = await service.exportData('owner-a');

  assert.equal(exported.data.academicWorkspaces.length, 1);
  assert.deepEqual(exported.data.academicWorkspaces[0].plan, ownedWorkspace.plan);
  assert.deepEqual(exported.data.academicWorkspaces[0].sources, ownedWorkspace.sources);
  assert.deepEqual(exported.data.academicWorkspaces[0].progress, ownedWorkspace.progress);
  assert.deepEqual(
    exported.data.academicWorkspaces[0].brief,
    ownedWorkspace.progress.workflow.brief,
  );
  assert.equal(exported.data.academicWorkspaces[0].draftContent, 'Draft workspace-a');
  assert.equal(exported.data.academicWorkspaces[0].autosaveRevision, 3);
  assert.equal(exported.data.experienceSessions[0].workspaceRef, 'workspace-a');
  assert.deepEqual(exported.data.experienceSessions[0].productions, ownedSession.productions);
  assert.equal(Object.hasOwn(exported.data.experienceSessions[0], 'idempotencyKey'), false);
  assert.equal(observed.experienceSession.select.idempotencyKey, undefined);
});

test('privacy export keeps multiple owned dossiers when a linked Experience Session is absent', async () => {
  const { service } = fixture({
    workspaces: [
      workspace('workspace-a', 'owner-a', 'session-a'),
      workspace('workspace-b', 'owner-a', 'missing-session'),
      workspace('workspace-c', 'owner-a'),
    ],
    experienceSessions: [
      experienceSession('session-a', 'owner-a', 'workspace-a'),
      experienceSession('session-unlinked', 'owner-a', 'legacy-workspace'),
    ],
  });

  const exported = await service.exportData('owner-a');

  assert.deepEqual(
    exported.data.academicWorkspaces.map((row) => row.id),
    ['workspace-a', 'workspace-b', 'workspace-c'],
  );
  assert.deepEqual(
    exported.data.experienceSessions.map((row) => row.id),
    ['session-a', 'session-unlinked'],
  );
  assert.equal(
    exported.data.experienceSessions.some((row) => row.id === 'missing-session'),
    false,
  );
  assert.equal(
    exported.data.academicWorkspaces.find((row) => row.id === 'workspace-b').experienceSessionId,
    null,
  );
  assert.equal(
    exported.data.experienceSessions.find((row) => row.id === 'session-unlinked').workspaceRef,
    null,
  );
});

test('privacy export strictly filters owners and fails closed on cross-owner legacy pointers', async () => {
  const { service } = fixture({
    workspaces: [
      workspace('owned-workspace', 'owner-a', 'foreign-session'),
      workspace('foreign-workspace', 'owner-b', 'foreign-session'),
    ],
    experienceSessions: [
      experienceSession('owned-session', 'owner-a', 'owned-workspace'),
      experienceSession('foreign-session', 'owner-b', 'foreign-workspace'),
    ],
  });

  const exported = await service.exportData('owner-a');

  assert.deepEqual(exported.data.academicWorkspaces.map((row) => row.id), ['owned-workspace']);
  assert.deepEqual(exported.data.experienceSessions.map((row) => row.id), ['owned-session']);
  assert.equal(exported.data.academicWorkspaces[0].experienceSessionId, null);
  assert.equal(exported.data.experienceSessions[0].workspaceRef, 'owned-workspace');
  assert.equal(JSON.stringify(exported).includes('foreign-workspace'), false);
  assert.equal(JSON.stringify(exported).includes('foreign-session'), false);
});
