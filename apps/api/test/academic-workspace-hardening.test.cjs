'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { AcademicWorkspaceService } = require('../dist/workspaces/academic-workspace.service.js');
const {
  WORKSPACE_TEMPLATES,
} = require('@second-brain/shared');

function httpStatus(error) {
  return typeof error?.getStatus === 'function' ? error.getStatus() : error?.status;
}

function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('not' in expected) return actual !== expected.not;
      if ('in' in expected) return expected.in.includes(actual);
    }
    return actual === expected;
  });
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'increment' in value) {
      row[key] = (row[key] ?? 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
  row.updatedAt = new Date();
  return row;
}

function createHarness() {
  const state = {
    workspaces: [],
    sessions: [],
    llmCalls: 0,
  };
  let transactionTail = Promise.resolve();

  const academicWorkspace = {
    create: async ({ data }) => {
      const row = {
        status: 'active',
        mode: 'guide',
        autosaveRevision: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      state.workspaces.push(row);
      return row;
    },
    findFirst: async ({ where }) => state.workspaces.find((row) => matchesWhere(row, where)) ?? null,
    findUnique: async ({ where }) => state.workspaces.find((row) => matchesWhere(row, where)) ?? null,
    findMany: async ({ where = {}, orderBy, take, cursor, skip = 0 }) => {
      let rows = state.workspaces.filter((row) => matchesWhere(row, where));
      if (orderBy) {
        rows = [...rows].sort((left, right) => {
          const byUpdated = right.updatedAt.getTime() - left.updatedAt.getTime();
          return byUpdated || right.id.localeCompare(left.id);
        });
      }
      if (cursor?.id) {
        const index = rows.findIndex((row) => row.id === cursor.id);
        rows = index < 0 ? [] : rows.slice(index + skip);
      }
      return rows.slice(0, take ?? rows.length);
    },
    count: async ({ where }) => state.workspaces.filter((row) => matchesWhere(row, where)).length,
    update: async ({ where, data }) => {
      const row = state.workspaces.find((candidate) => matchesWhere(candidate, where));
      if (!row) throw new Error('WORKSPACE_NOT_FOUND');
      return applyData(row, data);
    },
    updateMany: async ({ where, data }) => {
      const rows = state.workspaces.filter((row) => matchesWhere(row, where));
      rows.forEach((row) => applyData(row, data));
      return { count: rows.length };
    },
  };

  const experienceSession = {
    create: async ({ data }) => {
      if (data.idempotencyKey && state.sessions.some((row) => (
        row.userId === data.userId && row.idempotencyKey === data.idempotencyKey
      ))) {
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      }
      const row = {
        version: 1,
        idempotencyKey: null,
        pausedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      state.sessions.push(row);
      return row;
    },
    findFirst: async ({ where }) => state.sessions.find((row) => matchesWhere(row, where)) ?? null,
    findUnique: async ({ where }) => {
      if (where.userId_idempotencyKey) {
        const key = where.userId_idempotencyKey;
        return state.sessions.find((row) => (
          row.userId === key.userId && row.idempotencyKey === key.idempotencyKey
        )) ?? null;
      }
      return state.sessions.find((row) => matchesWhere(row, where)) ?? null;
    },
    count: async ({ where }) => state.sessions.filter((row) => matchesWhere(row, where)).length,
    updateMany: async ({ where, data }) => {
      const rows = state.sessions.filter((row) => matchesWhere(row, where));
      rows.forEach((row) => applyData(row, data));
      return { count: rows.length };
    },
  };

  const tx = {
    academicWorkspace,
    experienceSession,
    document: { count: async () => 0 },
    collection: { count: async () => 0 },
    $executeRaw: async () => 1,
  };
  const prisma = {
    ...tx,
    profile: { findUnique: async () => ({ preferredLanguage: 'en' }) },
    $transaction: (operation) => {
      const run = transactionTail.then(async () => {
        const workspaceSnapshot = structuredClone(state.workspaces);
        const sessionSnapshot = structuredClone(state.sessions);
        try {
          return await operation(tx);
        } catch (error) {
          state.workspaces.splice(0, state.workspaces.length, ...workspaceSnapshot);
          state.sessions.splice(0, state.sessions.length, ...sessionSnapshot);
          throw error;
        }
      });
      transactionTail = run.catch(() => undefined);
      return run;
    },
  };
  const llm = {
    generate: async () => {
      state.llmCalls += 1;
      return { text: 'Technical assistant response.' };
    },
  };
  return { service: new AcademicWorkspaceService(prisma, llm), state, prisma, llm };
}

function request(overrides = {}) {
  return {
    title: 'Technical workspace',
    template: 'assignment',
    objective: 'Validate persistence without external providers.',
    sources: [],
    brief: {
      version: 1,
      fields: {
        subject: 'Persistence',
        requirements: 'Keep every confirmed change.',
      },
    },
    requestId: 'workspace-create-test-operation-1',
    ...overrides,
  };
}

test('same owner, idempotency key and payload create one workspace/session under a concurrent retry', async () => {
  const { service, state } = createHarness();
  const [first, retry] = await Promise.all([
    service.create('owner', request()),
    service.create('owner', request()),
  ]);

  assert.equal(first.id, retry.id);
  assert.equal(state.workspaces.length, 1);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].workspaceRef, first.id);
  assert.equal(state.sessions[0].idempotencyKey, `server:v2:workspace:${request().requestId}`);
});

test('reusing a creation idempotency key for a different payload is a conflict', async () => {
  const { service, state } = createHarness();
  await service.create('owner', request());

  await assert.rejects(
    service.create('owner', request({ title: 'Different academic work' })),
    (error) => httpStatus(error) === 409,
  );
  assert.equal(state.workspaces.length, 1);
  assert.equal(state.sessions.length, 1);
});

test('a legacy plan without item ids remains idempotent across an identical retry', async () => {
  const { service, state } = createHarness();
  const legacyPlan = [{
    title: 'Legacy outline section',
    order: 0,
    completed: false,
  }];
  const payload = request({
    requestId: 'workspace-create-legacy-plan-1',
    plan: legacyPlan,
  });

  const first = await service.create('owner', payload);
  const retry = await service.create('owner', payload);
  assert.equal(first.id, retry.id);
  assert.equal(first.plan[0].id, retry.plan[0].id);
  assert.match(first.plan[0].id, /^legacy-0-[a-f0-9]{16}$/u);
  assert.equal(state.workspaces.length, 1);
  assert.equal(state.sessions.length, 1);
});

test('concurrent autosaves accept one revision, reject the stale writer and acknowledge the exact winner', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());
  const attempts = await Promise.allSettled([
    service.autosave('owner', workspace.id, {
      workspaceId: workspace.id,
      expectedRevision: 0,
      draft: { format: 'markdown', content: 'Editor A confirmed content.' },
    }),
    service.autosave('owner', workspace.id, {
      workspaceId: workspace.id,
      expectedRevision: 0,
      draft: { format: 'markdown', content: 'Editor B stale content.' },
    }),
  ]);

  const accepted = attempts.flatMap((attempt, index) => (
    attempt.status === 'fulfilled' ? [{ index, result: attempt.value }] : []
  ));
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(httpStatus(rejected[0].reason), 409);
  assert.equal(accepted[0].result.revision, 1);

  const persisted = await service.get('owner', workspace.id);
  const expectedContent = accepted[0].index === 0
    ? 'Editor A confirmed content.'
    : 'Editor B stale content.';
  assert.equal(persisted.draft.content, expectedContent);
  assert.equal(persisted.autosaveRevision, accepted[0].result.revision);
  assert.equal(state.sessions[0].version, 2);
});

test('two metadata editors use the same revision token and cannot overwrite each other silently', async () => {
  const { service } = createHarness();
  const workspace = await service.create('owner', request());
  const attempts = await Promise.allSettled([
    service.update('owner', workspace.id, {
      title: 'Editor A title',
      expectedRevision: 0,
    }),
    service.update('owner', workspace.id, {
      title: 'Editor B title',
      expectedRevision: 0,
    }),
  ]);

  const accepted = attempts.filter((attempt) => attempt.status === 'fulfilled');
  const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(httpStatus(rejected[0].reason), 409);
  const persisted = await service.get('owner', workspace.id);
  assert.equal(persisted.title, accepted[0].value.title);
  assert.equal(persisted.autosaveRevision, 1);
});

test('a confirmed draft and resume target survive a new authenticated service instance', async () => {
  const { service, prisma, llm } = createHarness();
  const workspace = await service.create('owner', request());
  await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id,
    expectedRevision: 0,
    draft: { format: 'markdown', content: 'Confirmed before logout.' },
  });

  const afterLogin = new AcademicWorkspaceService(prisma, llm);
  const restored = await afterLogin.get('owner', workspace.id);
  assert.equal(restored.draft.content, 'Confirmed before logout.');
  assert.equal(restored.draft.revision, 1);
  assert.equal(restored.resumeTarget.path, `/library/workspace/${workspace.id}`);
});

test('legacy null or missing session links do not make an existing workspace unsavable', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());
  state.sessions[0].workspaceRef = null;

  const updated = await service.update('owner', workspace.id, {
    expectedRevision: 0,
    title: 'Recovered legacy workspace',
  });
  assert.equal(updated.title, 'Recovered legacy workspace');
  assert.equal(state.sessions[0].workspaceRef, workspace.id);

  state.sessions.splice(0, state.sessions.length);
  const saved = await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id,
    expectedRevision: updated.autosaveRevision,
    draft: { format: 'markdown', content: 'Still recoverable without its old wrapper.' },
  });
  assert.equal(saved.saved, true);
  assert.equal((await service.get('owner', workspace.id)).draft.content, 'Still recoverable without its old wrapper.');
});

test('wrong owner, type or workspace reference rolls back the dossier mutation instead of succeeding silently', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());

  for (const corrupt of [
    (session) => { session.userId = 'intruder'; },
    (session) => { session.type = 'learning'; },
    (session) => { session.workspaceRef = 'another-workspace'; },
  ]) {
    state.sessions[0].userId = 'owner';
    state.sessions[0].type = 'workspace';
    state.sessions[0].workspaceRef = workspace.id;
    corrupt(state.sessions[0]);
    await assert.rejects(
      service.update('owner', workspace.id, {
        expectedRevision: 0,
        title: 'Must roll back',
      }),
      (error) => httpStatus(error) === 409,
    );
    assert.equal(state.workspaces[0].title, 'Technical workspace');
    assert.equal(state.workspaces[0].autosaveRevision, 0);
  }

  state.sessions[0].userId = 'owner';
  state.sessions[0].type = 'workspace';
  state.sessions[0].workspaceRef = null;
  state.workspaces.push({
    ...structuredClone(state.workspaces[0]),
    id: 'other-workspace-claiming-the-same-session',
    userId: 'another-owner',
  });
  await assert.rejects(
    service.update('owner', workspace.id, {
      expectedRevision: 0,
      title: 'Ambiguous legacy link must roll back',
    }),
    (error) => httpStatus(error) === 409,
  );
  assert.equal(state.workspaces[0].title, 'Technical workspace');
  assert.equal(state.workspaces[0].autosaveRevision, 0);
  state.workspaces.pop();

  state.sessions[0].userId = 'owner';
  state.sessions[0].type = 'workspace';
  state.sessions[0].workspaceRef = 'another-workspace';
  await assert.rejects(
    service.autosave('owner', workspace.id, {
      workspaceId: workspace.id,
      expectedRevision: 0,
      draft: { format: 'markdown', content: 'Must also roll back.' },
    }),
    (error) => httpStatus(error) === 409,
  );
  assert.equal(state.workspaces[0].draftContent, '');
  assert.equal(state.workspaces[0].autosaveRevision, 0);
});

test('status timestamps keep their original transition time across ordinary edits', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({
    initialContent: 'A complete academic draft.',
  }));

  await service.update('owner', workspace.id, { status: 'paused' });
  const pausedAt = state.sessions[0].pausedAt.getTime();
  await service.update('owner', workspace.id, { title: 'Edited while paused' });
  assert.equal(state.sessions[0].pausedAt.getTime(), pausedAt);

  const active = await service.update('owner', workspace.id, { status: 'active' });
  assert.equal(state.sessions[0].pausedAt, null);
  const completed = await service.update('owner', workspace.id, {
    expectedRevision: active.autosaveRevision,
    status: 'completed',
    plan: active.plan.map((item) => ({ ...item, completed: true })),
    brief: active.progress.workflow.brief,
  });
  const completedAt = state.sessions[0].completedAt.getTime();
  await service.update('owner', workspace.id, {
    expectedRevision: completed.autosaveRevision,
    title: 'Edited after completion',
  });
  assert.equal(state.sessions[0].completedAt.getTime(), completedAt);
});

test('client progress cannot be forged and an incomplete workspace cannot self-finalize', async () => {
  const { service } = createHarness();
  const workspace = await service.create('owner', request());
  const forged = {
    currentStep: 'fabricated',
    completedSteps: ['fabricated'],
    totalSteps: 1,
  };

  await service.update('owner', workspace.id, { progress: forged }).catch((error) => {
    assert.ok([400, 409].includes(httpStatus(error)));
  });
  await service.update('owner', workspace.id, { status: 'completed' }).catch((error) => {
    assert.ok([400, 409].includes(httpStatus(error)));
  });

  const persisted = await service.get('owner', workspace.id);
  assert.notEqual(persisted.progress.currentStep, forged.currentStep);
  assert.deepEqual(persisted.progress.completedSteps, []);
  assert.equal(persisted.progress.totalSteps, workspace.plan.length);
  assert.notEqual(persisted.status, 'completed');
});

test('completion succeeds only after the existing required controls are actually satisfied', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({
    initialContent: 'A reviewed academic draft.',
  }));
  const completed = await service.update('owner', workspace.id, {
    expectedRevision: 0,
    status: 'completed',
    plan: workspace.plan.map((item) => ({ ...item, completed: true })),
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.progress.completedSteps.length, completed.plan.length);
  assert.equal(state.sessions[0].status, 'completed');

  await assert.rejects(
    service.update('owner', workspace.id, {
      expectedRevision: completed.autosaveRevision,
      plan: completed.plan.map((item, index) => index === 0 ? { ...item, completed: false } : item),
    }),
    (error) => httpStatus(error) === 400,
  );
  await assert.rejects(
    service.autosave('owner', workspace.id, {
      workspaceId: workspace.id,
      expectedRevision: completed.autosaveRevision,
      draft: { format: 'markdown', content: '' },
    }),
    (error) => httpStatus(error) === 400,
  );
  assert.equal((await service.get('owner', workspace.id)).status, 'completed');
});

test('archiving removes the dossier and its session from resumable work, while restoration remains possible', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());

  await service.update('owner', workspace.id, { status: 'archived' });
  assert.equal((await service.list('owner')).items.some((item) => item.id === workspace.id), false);
  assert.equal(state.sessions[0].status, 'abandoned');

  await service.update('owner', workspace.id, { status: 'active' });
  assert.equal((await service.list('owner')).items.some((item) => item.id === workspace.id), true);
  assert.equal(state.sessions[0].status, 'active');
});

test('workspace reads and mutations remain owner-scoped', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());

  await assert.rejects(service.get('intruder', workspace.id), (error) => httpStatus(error) === 404);
  await assert.rejects(
    service.update('intruder', workspace.id, { title: 'Stolen' }),
    (error) => httpStatus(error) === 404,
  );
  await assert.rejects(
    service.autosave('intruder', workspace.id, {
      workspaceId: workspace.id,
      expectedRevision: 0,
      draft: { format: 'markdown', content: 'Stolen' },
    }),
    (error) => httpStatus(error) === 404,
  );
  await assert.rejects(
    service.assist('intruder', workspace.id, { action: 'suggest', message: 'Read it' }),
    (error) => httpStatus(error) === 404,
  );
  assert.equal(state.llmCalls, 0);
  assert.equal(state.workspaces[0].title, 'Technical workspace');
  assert.equal(state.workspaces[0].draftContent, '');
});

test('all eight existing templates keep distinct persisted plans and resumable sessions', async () => {
  const { service, state } = createHarness();
  const signatures = new Set();

  for (const template of WORKSPACE_TEMPLATES) {
    const workspace = await service.create('owner', request({
      title: `Technical ${template}`,
      template,
      requestId: `workspace-create-template-${template}`,
    }));
    assert.equal(workspace.template, template);
    assert.ok(workspace.plan.length > 0);
    assert.equal(workspace.resumeTarget.path, `/library/workspace/${workspace.id}`);
    signatures.add(workspace.plan.map((item) => item.stepId).join('|'));
  }

  assert.equal(signatures.size, WORKSPACE_TEMPLATES.length);
  assert.equal(state.workspaces.length, WORKSPACE_TEMPLATES.length);
  assert.equal(state.sessions.length, WORKSPACE_TEMPLATES.length);
});
