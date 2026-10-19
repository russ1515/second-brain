'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { AcademicWorkspaceService } = require('../dist/workspaces/academic-workspace.service.js');
const { LlmService } = require('../dist/llm/llm.service.js');
const {
  WORKSPACE_TEMPLATES,
  workspaceProgressFromPlan,
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

function createHarness(options = {}) {
  const state = {
    workspaces: [],
    sessions: [],
    documents: [
      { id: 'document-owner', userId: 'owner', deletedAt: null },
      { id: 'document-intruder', userId: 'intruder', deletedAt: null },
    ],
    collections: [
      { id: 'collection-owner', userId: 'owner' },
      { id: 'collection-intruder', userId: 'intruder' },
    ],
    llmCalls: 0,
    llmMessages: [],
    llmOptions: [],
    llmResponder: options.llmResponder ?? null,
    llmResponse: 'Technical assistant response.',
    llmError: null,
    llmBarrier: null,
    sourceCalls: 0,
    sourceError: null,
    sourceResolution: null,
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
    document: { count: async ({ where }) => state.documents.filter((row) => matchesWhere(row, where)).length },
    collection: { count: async ({ where }) => state.collections.filter((row) => matchesWhere(row, where)).length },
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
    generate: async (messages, generateOptions) => {
      state.llmCalls += 1;
      state.llmMessages.push(structuredClone(messages));
      state.llmOptions.push(structuredClone(generateOptions));
      if (state.llmBarrier) await state.llmBarrier;
      if (state.llmError) throw state.llmError;
      return { text: state.llmResponder ? await state.llmResponder(messages, generateOptions, state) : state.llmResponse };
    },
  };
  const sourceEngine = {
    resolve: async (_userId, sources, request) => {
      state.sourceCalls += 1;
      if (state.sourceError) throw state.sourceError;
      return state.sourceResolution ?? ({
        query: request.query,
        usedContext: false,
        citations: [],
        sources: sources.map((source) => ({
          kind: source.kind,
          id: source.id,
          title: source.id,
          availability: 'available',
        })),
        context: '',
      });
    },
    query: async () => ({ query: '', usedContext: false, citations: [], sources: [], context: '' }),
    validateReply: (content, citations) => {
      const available = new Map(citations.map((citation) => [citation.citationLabel, citation]));
      const used = new Set();
      const validated = content.replace(/\[(W\d+)\]/g, (_match, label) => {
        if (!available.has(label)) return '';
        used.add(label);
        return `[${label}]`;
      }).trim();
      return { content: validated, citations: citations.filter((citation) => used.has(citation.citationLabel)) };
    },
  };
  return {
    service: new AcademicWorkspaceService(prisma, llm, sourceEngine, options.learnerPassport, {
      get: (key) => options.config?.[key],
    }),
    state,
    prisma,
    llm,
    sourceEngine,
  };
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

function prepareForAuthoritativeFinalization(state, workspaceId) {
  const row = state.workspaces.find((item) => item.id === workspaceId);
  row.draftContent ||= 'A complete learner-authored academic draft.';
  row.plan = row.plan.map((item) => ({ ...item, completed: true }));
  row.progress = workspaceProgressFromPlan(row.plan, {
    ...row.progress.workflow,
    professor: {
      ...row.progress.workflow.professor,
      currentPhase: 'FINALIZATION',
    },
  });
  return row;
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

test('creation persists initial capture content and owned sources while rejecting foreign sources atomically', async () => {
  const { service, state } = createHarness();
  const initialContent = 'Captured notes ready for the academic workspace.';
  const ownedSources = [
    { kind: 'document', id: 'document-owner', title: 'Owned PDF' },
    { kind: 'collection', id: 'collection-owner', title: 'Owned collection' },
  ];

  const workspace = await service.create('owner', request({
    requestId: 'workspace-create-owned-capture-1',
    initialContent,
    sources: ownedSources,
  }));

  assert.equal(workspace.draft.content, initialContent);
  assert.deepEqual(workspace.sources, ownedSources.map(({ kind, id }) => ({ kind, id })));
  assert.equal(state.workspaces[0].draftContent, initialContent);
  assert.deepEqual(state.sessions[0].sourceReferences, [
    { kind: 'document', id: 'document-owner' },
    { kind: 'document-collection', id: 'collection-owner' },
  ]);

  await assert.rejects(
    service.create('owner', request({
      requestId: 'workspace-create-foreign-capture-1',
      sources: [{ kind: 'document', id: 'document-intruder', title: 'Foreign PDF' }],
    })),
    (error) => httpStatus(error) === 400,
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

test('legacy source display metadata does not break an otherwise identical creation retry', async () => {
  const { service, state } = createHarness();
  const payload = request({
    requestId: 'workspace-create-legacy-source-metadata-1',
    sources: [{ kind: 'document', id: 'document-owner' }],
  });

  const first = await service.create('owner', payload);
  state.workspaces[0].sources = [{
    kind: 'document',
    id: 'document-owner',
    title: 'Legacy client-owned title',
  }];
  const retry = await service.create('owner', payload);

  assert.equal(retry.id, first.id);
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
  const { service, prisma, llm, sourceEngine } = createHarness();
  const workspace = await service.create('owner', request());
  await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id,
    expectedRevision: 0,
    draft: { format: 'markdown', content: 'Confirmed before logout.' },
  });

  const afterLogin = new AcademicWorkspaceService(prisma, llm, sourceEngine);
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
  prepareForAuthoritativeFinalization(state, workspace.id);
  const completed = await service.finalize('owner', workspace.id, {
    requestId: 'aw8-hardening-finalize-timestamps',
    expectedRevision: active.autosaveRevision,
  });
  const completedAt = state.sessions[0].completedAt.getTime();
  await assert.rejects(service.update('owner', workspace.id, {
    expectedRevision: completed.revision,
    title: 'Edited after completion',
  }), (error) => httpStatus(error) === 409);
  await service.finalize('owner', workspace.id, {
    requestId: 'aw8-hardening-finalize-timestamps-no-change',
    expectedRevision: completed.revision,
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
  prepareForAuthoritativeFinalization(state, workspace.id);
  const completed = await service.finalize('owner', workspace.id, {
    requestId: 'aw8-hardening-finalize-controls',
    expectedRevision: 0,
  });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.snapshot.plan.filter((item) => item.completed).length, completed.snapshot.plan.length);
  assert.equal(state.sessions[0].status, 'completed');

  await assert.rejects(
    service.update('owner', workspace.id, {
      expectedRevision: completed.revision,
      plan: completed.snapshot.plan.map((item, index) => index === 0 ? { ...item, completed: false } : item),
    }),
    (error) => httpStatus(error) === 409,
  );
  await assert.rejects(
    service.autosave('owner', workspace.id, {
      workspaceId: workspace.id,
      expectedRevision: completed.revision,
      draft: { format: 'markdown', content: '' },
    }),
    (error) => httpStatus(error) === 409,
  );
  assert.equal((await service.get('owner', workspace.id)).status, 'completed');
});

test('archiving removes the dossier and its session from resumable work, while restoration remains possible', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());
  prepareForAuthoritativeFinalization(state, workspace.id);
  const finalized = await service.finalize('owner', workspace.id, {
    requestId: 'aw8-hardening-finalize-archive',
    expectedRevision: workspace.autosaveRevision,
  });
  const archived = await service.archive('owner', workspace.id, {
    requestId: 'aw8-hardening-archive',
    expectedRevision: finalized.revision,
  });
  assert.equal((await service.list('owner')).items.some((item) => item.id === workspace.id), false);
  assert.equal(state.sessions[0].status, 'abandoned');

  await service.restore('owner', workspace.id, {
    requestId: 'aw8-hardening-restore',
    expectedRevision: archived.revision,
  });
  assert.equal((await service.list('owner')).items.some((item) => item.id === workspace.id), true);
  assert.equal(state.sessions.some((item) => item.workspaceRef === workspace.id && item.status === 'active'), true);
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

test('assistant refuses absent attached evidence without an LLM call and persists the honest exchange', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({
    requestId: 'workspace-create-no-evidence-1',
    sources: [{ kind: 'document', id: 'document-owner' }],
  }));

  const response = await service.assist('owner', workspace.id, {
    action: 'compare-sources',
    message: 'What do my sources prove?',
  });

  assert.equal(state.llmCalls, 0);
  assert.equal(response.reply.content, '');
  assert.equal(response.reply.evidenceStatus, 'none');
  assert.deepEqual(response.citations, []);
  assert.equal(response.sources.length, 1);
  assert.deepEqual(state.workspaces[0].assistantHistory.map((entry) => entry.role), ['user', 'assistant']);
  assert.equal(state.workspaces[0].assistantHistory.at(-1).evidenceStatus, 'none');
  assert.deepEqual(state.workspaces[0].assistantHistory.at(-1).citations, []);
});

test('assistant persists only server-resolved citations that its answer actually references', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({
    requestId: 'workspace-create-cited-answer-1',
    sources: [{ kind: 'document', id: 'document-owner' }],
  }));
  const citation = {
    sourceType: 'document', sourceId: 'document-owner', documentId: 'document-owner',
    title: 'Owned PDF', chunkIndex: 2, snippet: 'Verified evidence.', citationLabel: 'W1', relevance: 0.9,
  };
  state.sourceResolution = {
    query: 'verified claim', usedContext: true, citations: [citation],
    sources: [{ kind: 'document', id: 'document-owner', title: 'Owned PDF', availability: 'available' }],
    context: '<workspace-evidence label="W1">Verified evidence.</workspace-evidence>',
  };
  state.llmResponse = 'Verified claim [W1]. Invented claim [W99].';

  const response = await service.assist('owner', workspace.id, {
    action: 'suggest', message: 'verified claim',
  });

  assert.equal(state.llmCalls, 1);
  assert.equal(response.reply.content, 'Verified claim [W1]. Invented claim .');
  assert.equal(response.reply.evidenceStatus, 'grounded');
  assert.deepEqual(response.citations, [citation]);
  assert.deepEqual(state.workspaces[0].assistantHistory.at(-1).citations, [citation]);
});

test('assistant strips request-scoped workspace citation labels from restored history', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({
    requestId: 'workspace-create-history-citation-1',
    sources: [{ kind: 'document', id: 'document-owner' }],
  }));
  const citation = {
    sourceType: 'document', sourceId: 'document-owner', documentId: 'document-owner',
    title: 'Owned PDF', chunkIndex: 2, snippet: 'Verified evidence.', citationLabel: 'W1', relevance: 0.9,
  };
  state.sourceResolution = {
    query: 'verified claim', usedContext: true, citations: [citation],
    sources: [{ kind: 'document', id: 'document-owner', title: 'Owned PDF', availability: 'available' }],
    context: '<workspace-evidence label="W1">Verified evidence.</workspace-evidence>',
  };
  state.llmResponse = 'First verified claim [W1].';
  await service.assist('owner', workspace.id, { action: 'suggest', message: 'first request' });

  state.llmResponse = 'Second verified claim [W1].';
  await service.assist('owner', workspace.id, { action: 'suggest', message: 'second request' });

  const secondCall = state.llmMessages.at(-1);
  const restoredAssistant = secondCall.slice(1, -1).find((message) => (
    message.role === 'assistant' && message.content.includes('First verified claim')
  ));
  assert.ok(restoredAssistant);
  assert.equal(restoredAssistant.content, 'First verified claim.');
  assert.equal(restoredAssistant.content.includes('[W1]'), false);
});

test('attaching owned capture sources synchronizes the resumable session and rejects foreign sources atomically', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request());

  const updated = await service.update('owner', workspace.id, {
    expectedRevision: workspace.autosaveRevision,
    sources: [
      { kind: 'document', id: 'document-owner', title: 'Owned PDF' },
      { kind: 'collection', id: 'collection-owner', title: 'Owned collection' },
    ],
  });
  assert.equal(updated.sources.length, 2);
  assert.deepEqual(state.sessions[0].sourceReferences, [
    { kind: 'document', id: 'document-owner' },
    { kind: 'document-collection', id: 'collection-owner' },
  ]);

  await assert.rejects(
    service.update('owner', workspace.id, {
      expectedRevision: updated.autosaveRevision,
      sources: [{ kind: 'document', id: 'document-intruder', title: 'Foreign PDF' }],
    }),
    (error) => httpStatus(error) === 400,
  );
  assert.equal(state.workspaces[0].sources.length, 2);
  assert.equal(state.sessions[0].sourceReferences.length, 2);
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

test('AW-5 server owns the complete Professor cycle and rejects skipped phases', async () => {
  const { service } = createHarness();
  let workspace = await service.create('owner', request({
    requestId: 'workspace-aw5-cycle-create',
  }));
  let revision = workspace.autosaveRevision;
  assert.equal(workspace.professor.currentPhase, 'CAPTURE');

  await assert.rejects(
    service.transition('owner', workspace.id, {
      requestId: 'transition-skip-capture',
      expectedPhase: 'CAPTURE',
      requestedPhase: 'WORK',
      expectedRevision: revision,
    }),
    (error) => httpStatus(error) === 400,
  );
  await assert.rejects(
    service.transition('owner', workspace.id, {
      requestId: 'transition-capture-finalization-forbidden',
      expectedPhase: 'CAPTURE',
      requestedPhase: 'FINALIZATION',
      expectedRevision: revision,
    }),
    (error) => httpStatus(error) === 400,
  );
  await assert.rejects(
    service.transition('owner', workspace.id, {
      requestId: 'transition-capture-completed-forbidden',
      expectedPhase: 'CAPTURE',
      requestedPhase: 'COMPLETED',
      expectedRevision: revision,
    }),
    (error) => httpStatus(error) === 400,
  );

  let moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-capture-comprehension',
    expectedPhase: 'CAPTURE', requestedPhase: 'COMPREHENSION', expectedRevision: revision,
  });
  revision = moved.revision;
  let turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-comprehension-turn', expectedPhase: 'COMPREHENSION', expectedRevision: revision,
    action: 'explain', message: 'Reformulate the assignment and confirm the constraints.',
  });
  revision = turn.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-comprehension-method',
    expectedPhase: 'COMPREHENSION', requestedPhase: 'METHOD', expectedRevision: revision,
  });
  revision = moved.revision;
  await assert.rejects(
    service.transition('owner', workspace.id, {
      requestId: 'transition-method-deconstruction-forbidden',
      expectedPhase: 'METHOD', requestedPhase: 'DECONSTRUCTION', expectedRevision: revision,
    }),
    (error) => httpStatus(error) === 400,
  );
  turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-method-turn', expectedPhase: 'METHOD', expectedRevision: revision,
    action: 'structure', message: 'Help me choose the method for this assignment.',
  });
  revision = turn.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-method-work',
    expectedPhase: 'METHOD', requestedPhase: 'WORK', expectedRevision: revision,
  });
  revision = moved.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-work-coaching',
    expectedPhase: 'WORK', requestedPhase: 'COACHING', expectedRevision: revision,
  });
  revision = moved.revision;
  turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-coaching-turn', expectedPhase: 'COACHING', expectedRevision: revision,
    action: 'challenge', message: 'I am blocked on the opening argument.',
  });
  revision = turn.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-coaching-work',
    expectedPhase: 'COACHING', requestedPhase: 'WORK', expectedRevision: revision,
  });
  revision = moved.revision;
  const saved = await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id,
    expectedRevision: revision,
    draft: { format: 'markdown', content: 'Learner-authored draft for verification.' },
  });
  revision = saved.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-work-verification',
    expectedPhase: 'WORK', requestedPhase: 'VERIFICATION', expectedRevision: revision,
  });
  revision = moved.revision;
  turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-verification-turn', expectedPhase: 'VERIFICATION', expectedRevision: revision,
    action: 'check-coherence', message: 'Verify my draft against the real brief.',
  });
  revision = turn.revision;

  workspace = await service.get('owner', workspace.id);
  workspace = await service.update('owner', workspace.id, {
    expectedRevision: revision,
    plan: workspace.plan.map((item) => ({ ...item, completed: true })),
  });
  revision = workspace.autosaveRevision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-verification-finalization',
    expectedPhase: 'VERIFICATION', requestedPhase: 'FINALIZATION', expectedRevision: revision,
  });
  revision = moved.revision;
  turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-finalization-turn', expectedPhase: 'FINALIZATION', expectedRevision: revision,
    action: 'suggest', message: 'Identify only the remaining real final-review points.',
  });
  revision = turn.revision;

  await assert.rejects(
    service.transition('owner', workspace.id, {
      requestId: 'transition-finalization-work-without-edit',
      expectedPhase: 'FINALIZATION', requestedPhase: 'WORK', expectedRevision: revision,
    }),
    (error) => httpStatus(error) === 400,
  );
  const edited = await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id,
    expectedRevision: revision,
    draft: { format: 'markdown', content: 'Learner-authored draft with a real final edit.' },
  });
  revision = edited.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-finalization-work-after-edit',
    expectedPhase: 'FINALIZATION', requestedPhase: 'WORK', expectedRevision: revision,
  });
  revision = moved.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-work-verification-second',
    expectedPhase: 'WORK', requestedPhase: 'VERIFICATION', expectedRevision: revision,
  });
  revision = moved.revision;
  turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-verification-second-turn', expectedPhase: 'VERIFICATION', expectedRevision: revision,
    action: 'check-coherence', message: 'Verify the edited version.',
  });
  revision = turn.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-verification-finalization-second',
    expectedPhase: 'VERIFICATION', requestedPhase: 'FINALIZATION', expectedRevision: revision,
  });
  revision = moved.revision;
  turn = await service.assist('owner', workspace.id, {
    requestId: 'aw5-finalization-second-turn', expectedPhase: 'FINALIZATION', expectedRevision: revision,
    action: 'suggest', message: 'Confirm the remaining final-review points.',
  });
  revision = turn.revision;
  moved = await service.transition('owner', workspace.id, {
    requestId: 'transition-finalization-deconstruction',
    expectedPhase: 'FINALIZATION', requestedPhase: 'DECONSTRUCTION', expectedRevision: revision,
  });
  assert.equal(moved.professor.currentPhase, 'DECONSTRUCTION');
  assert.equal(moved.professor.transitions.length, 11);
  assert.equal((await service.get('owner', workspace.id)).professor.currentPhase, 'DECONSTRUCTION');
  await assert.rejects(
    service.transition('intruder', workspace.id, {
      requestId: 'transition-intruder-rejected',
      expectedPhase: 'DECONSTRUCTION', requestedPhase: 'WORK', expectedRevision: moved.revision,
    }),
    (error) => httpStatus(error) === 404,
  );
});

test('AW-5 accepts an empty objective with a captured brief and persists Method only after an evidenced explanation', async () => {
  const { service, state } = createHarness();
  const capturedBrief = 'Explain why two fractions can represent the same quantity, then compare 1/2 and 2/4.';
  const workspace = await service.create('owner', request({
    requestId: 'workspace-aw5-empty-objective-create',
    objective: '',
    brief: { version: 1, fields: { requirements: capturedBrief } },
  }));
  assert.equal(workspace.objective, '');
  assert.equal(workspace.professor.currentPhase, 'CAPTURE');

  const comprehension = await service.transition('owner', workspace.id, {
    requestId: 'aw5-empty-objective-to-comprehension',
    expectedPhase: 'CAPTURE', requestedPhase: 'COMPREHENSION',
    expectedRevision: workspace.autosaveRevision,
  });
  assert.equal(comprehension.professor.currentPhase, 'COMPREHENSION');
  const methodTransition = {
    requestId: 'aw5-empty-objective-to-method',
    expectedPhase: 'COMPREHENSION', requestedPhase: 'METHOD',
    expectedRevision: comprehension.revision,
  };
  await assert.rejects(
    service.transition('owner', workspace.id, methodTransition),
    (error) => httpStatus(error) === 400
      && error.getResponse().code === 'workspace_professor_transition_criteria_not_met',
  );
  assert.equal((await service.get('owner', workspace.id)).professor.currentPhase, 'COMPREHENSION');
  assert.equal(state.llmCalls, 0);

  const explanationRequest = {
    requestId: 'aw5-empty-objective-explain',
    expectedPhase: 'COMPREHENSION', expectedRevision: comprehension.revision,
    action: 'explain',
  };
  await assert.rejects(
    service.assist('intruder', workspace.id, explanationRequest),
    (error) => httpStatus(error) === 404,
  );
  assert.equal(state.llmCalls, 0);

  const explanation = await service.assist('owner', workspace.id, explanationRequest);
  assert.equal(explanation.reply.content, state.llmResponse);
  assert.equal(state.llmCalls, 1);
  assert.ok(state.llmMessages[0].at(-1).content.includes(capturedBrief));
  const evidence = explanation.professor.evidence;
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].phase, 'COMPREHENSION');
  assert.equal(evidence[0].phaseSequence, comprehension.professor.phaseSequence);
  assert.equal(evidence[0].assistantReplyId, explanation.reply.id);

  const method = await service.transition('owner', workspace.id, {
    ...methodTransition, expectedRevision: explanation.revision,
  });
  assert.equal(method.professor.currentPhase, 'METHOD');
  const resumed = await service.get('owner', workspace.id);
  assert.equal(resumed.objective, '');
  assert.equal(resumed.professor.currentPhase, 'METHOD');
  assert.equal(resumed.assistantHistory.at(-1).id, explanation.reply.id);
  assert.equal(resumed.assistantHistory.at(-1).content, state.llmResponse);

  const sourceCalls = state.sourceCalls;
  const replay = await service.assist('owner', workspace.id, explanationRequest);
  assert.equal(replay.reply.id, explanation.reply.id);
  assert.equal(state.llmCalls, 1);
  assert.equal(state.sourceCalls, sourceCalls);
  const afterReplay = await service.get('owner', workspace.id);
  assert.equal(afterReplay.professor.currentPhase, 'METHOD');
  assert.equal(afterReplay.professor.evidence.length, 1);
  assert.equal(afterReplay.assistantHistory.length, 2);
  await assert.rejects(
    service.get('intruder', workspace.id),
    (error) => httpStatus(error) === 404,
  );
});

test('AW-5 transition retries converge once while competing request ids conflict', async () => {
  const { service } = createHarness();
  const idempotentWorkspace = await service.create('owner', request({
    requestId: 'workspace-aw5-transition-idempotency',
  }));
  const transition = {
    requestId: 'aw5-transition-same-logical-request',
    expectedPhase: 'CAPTURE', requestedPhase: 'COMPREHENSION', expectedRevision: 0,
  };
  const [first, retry] = await Promise.all([
    service.transition('owner', idempotentWorkspace.id, transition),
    service.transition('owner', idempotentWorkspace.id, transition),
  ]);
  assert.equal(first.professor.currentPhase, 'COMPREHENSION');
  assert.equal(retry.professor.currentPhase, 'COMPREHENSION');
  assert.equal((await service.get('owner', idempotentWorkspace.id)).professor.transitions.length, 1);
  await assert.rejects(
    service.transition('owner', idempotentWorkspace.id, { ...transition, expectedRevision: 1 }),
    (error) => httpStatus(error) === 409,
  );

  const competingWorkspace = await service.create('owner', request({
    requestId: 'workspace-aw5-transition-competing',
  }));
  const outcomes = await Promise.allSettled([
    service.transition('owner', competingWorkspace.id, {
      requestId: 'aw5-transition-winner-a',
      expectedPhase: 'CAPTURE', requestedPhase: 'COMPREHENSION', expectedRevision: 0,
    }),
    service.transition('owner', competingWorkspace.id, {
      requestId: 'aw5-transition-winner-b',
      expectedPhase: 'CAPTURE', requestedPhase: 'COMPREHENSION', expectedRevision: 0,
    }),
  ]);
  assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((item) => item.status === 'rejected' && httpStatus(item.reason) === 409).length, 1);
  assert.equal((await service.get('owner', competingWorkspace.id)).professor.transitions.length, 1);
});

test('AW-5 assist reservation is merge-safe with autosave and replays without retrieval or double billing', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({ requestId: 'workspace-aw5-race-create' }));
  let release;
  state.llmBarrier = new Promise((resolve) => { release = resolve; });
  const first = service.assist('owner', workspace.id, {
    requestId: 'aw5-race-professor-turn', expectedPhase: 'CAPTURE', expectedRevision: 0,
    action: 'explain', message: 'Clarify the task while I keep editing.',
  });
  while (state.llmCalls === 0) await new Promise((resolve) => setImmediate(resolve));

  await assert.rejects(
    service.assist('owner', workspace.id, {
      requestId: 'aw5-race-professor-turn', expectedPhase: 'CAPTURE', expectedRevision: 0,
      action: 'explain', message: 'Clarify the task while I keep editing.',
    }),
    (error) => httpStatus(error) === 409,
  );
  assert.equal(state.llmCalls, 1);

  const saved = await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id,
    expectedRevision: 0,
    draft: { format: 'markdown', content: 'A newer learner edit made during the Professor turn.' },
  });
  assert.equal(saved.revision, 1);
  release();
  const response = await first;
  state.llmBarrier = null;
  // Professor state/history is merge-only metadata and must not consume the
  // draft autosave revision. This preserves the editor conflict token while
  // still synchronizing the ExperienceSession below.
  assert.equal(response.revision, 1);
  assert.equal(state.llmCalls, 1);
  const persisted = await service.get('owner', workspace.id);
  assert.equal(persisted.draft.content, 'A newer learner edit made during the Professor turn.');
  assert.deepEqual(persisted.assistantHistory.map((entry) => entry.role), ['user', 'assistant']);
  assert.equal(persisted.professor.evidence.at(-1).draftRevision, 0);
  assert.equal(state.sessions[0].version, 3);

  const sourceCalls = state.sourceCalls;
  state.sourceError = new Error('source deleted after completed turn');
  const replay = await service.assist('owner', workspace.id, {
    requestId: 'aw5-race-professor-turn', expectedPhase: 'CAPTURE', expectedRevision: 0,
    action: 'explain', message: 'Clarify the task while I keep editing.',
  });
  assert.equal(replay.reply.id, response.reply.id);
  assert.deepEqual(replay.sources, []);
  assert.equal(state.sourceCalls, sourceCalls);
  assert.equal(state.llmCalls, 1);
});

test('AW-5 provider failure leaves phase and history untouched and the same key never calls twice', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({ requestId: 'workspace-aw5-failure-create' }));
  state.llmError = new Error('provider unavailable');
  const turn = {
    requestId: 'aw5-failed-professor-turn', expectedPhase: 'CAPTURE', expectedRevision: 0,
    action: 'explain', message: 'This provider call must fail safely.',
  };
  await assert.rejects(service.assist('owner', workspace.id, turn));
  assert.equal(state.llmCalls, 1);
  let persisted = await service.get('owner', workspace.id);
  assert.equal(persisted.professor.currentPhase, 'CAPTURE');
  assert.equal(persisted.professor.assistOperations.at(-1).status, 'failed');
  assert.deepEqual(persisted.assistantHistory, []);
  assert.equal(persisted.autosaveRevision, 0);
  assert.equal(state.sessions[0].version, 1);

  state.llmError = null;
  await assert.rejects(
    service.assist('owner', workspace.id, turn),
    (error) => httpStatus(error) === 409,
  );
  persisted = await service.get('owner', workspace.id);
  assert.equal(state.llmCalls, 1);
  assert.deepEqual(persisted.assistantHistory, []);
});

test('AW-5 rejects a corrupt resumable session before retrieval or a billable provider call', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({ requestId: 'workspace-aw5-session-preflight' }));
  state.sessions[0].type = 'research';

  await assert.rejects(
    service.assist('owner', workspace.id, {
      requestId: 'aw5-session-preflight-turn', expectedPhase: 'CAPTURE', expectedRevision: 0,
      action: 'explain', message: 'This request must stop before provider use.',
    }),
    (error) => httpStatus(error) === 409,
  );
  assert.equal(state.sourceCalls, 0);
  assert.equal(state.llmCalls, 0);
  assert.deepEqual(state.workspaces[0].progress.workflow.professor.assistOperations, []);
});

test('AW-5 stale pending reservation becomes failed without automatic provider replay', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({ requestId: 'workspace-aw5-stale-create' }));
  const staleTurn = {
    requestId: 'aw5-stale-professor-turn', expectedPhase: 'CAPTURE', expectedRevision: 0,
    action: 'explain', message: 'A process died after reserving this turn.',
  };
  state.workspaces[0].progress.workflow.professor.assistOperations = [{
    requestId: staleTurn.requestId,
    requestFingerprint: service.assistRequestFingerprint(staleTurn),
    phase: 'CAPTURE',
    phaseSequence: 0,
    status: 'pending',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    reservedRevision: 0,
  }];

  assert.equal((await service.get('owner', workspace.id)).professor.assistOperations[0].status, 'failed');
  await assert.rejects(
    service.assist('owner', workspace.id, staleTurn),
    (error) => httpStatus(error) === 409,
  );
  assert.equal(state.llmCalls, 0);
  assert.equal(state.workspaces[0].progress.workflow.professor.assistOperations[0].status, 'failed');

  const retry = await service.assist('owner', workspace.id, {
    ...staleTurn,
    requestId: 'aw5-stale-professor-turn-retry',
  });
  assert.equal(retry.reply.role, 'assistant');
  assert.equal(state.llmCalls, 1);
});

test('AW-5 legacy phase fallback is deterministic and read-only', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({ requestId: 'workspace-aw5-legacy-create' }));
  delete state.workspaces[0].progress.workflow.professor;

  const empty = await service.get('owner', workspace.id);
  assert.equal(empty.professor.currentPhase, 'CAPTURE');
  assert.equal(empty.progress.workflow.professor.currentPhase, 'CAPTURE');
  assert.equal(empty.professor.legacyFallback, true);
  assert.equal(state.workspaces[0].progress.workflow.professor, undefined);

  state.workspaces[0].draftContent = 'Existing legacy learner draft.';
  const authored = await service.get('owner', workspace.id);
  assert.equal(authored.professor.currentPhase, 'WORK');
  assert.equal(authored.progress.workflow.professor.currentPhase, 'WORK');
  assert.equal(authored.professor.legacyFallback, true);
  assert.equal(state.workspaces[0].progress.workflow.professor, undefined);
});

test('AW-5 reuses one state machine while giving the six shells distinct Professor context', async () => {
  const { service, state } = createHarness();
  const representatives = [
    ['assignment', 'assignment workflow'],
    ['memoire', 'long-form thesis workflow'],
    ['dissertation', 'dissertation workflow'],
    ['article', 'academic article workflow'],
    ['report', 'report workflow'],
    ['other', 'learner-defined deliverable'],
  ];

  for (const [template, expectedDirective] of representatives) {
    const workspace = await service.create('owner', request({
      template,
      requestId: `workspace-aw5-six-shell-${template}`,
    }));
    await service.assist('owner', workspace.id, {
      requestId: `aw5-six-shell-turn-${template}`,
      expectedPhase: 'CAPTURE',
      expectedRevision: 0,
      action: 'explain',
      message: `Clarify the ${template} brief.`,
    });
    const messages = state.llmMessages.at(-1);
    assert.match(messages[0].content, new RegExp(expectedDirective, 'i'));
    assert.match(messages.at(-1).content, /Professor phase: CAPTURE/);
  }

  assert.equal(state.llmCalls, representatives.length);
  assert.equal(new Set(state.llmMessages.map((messages) => messages[0].content)).size, representatives.length);
});

test('AW-5 Deconstruction is a bounded transferable retrospective, never export or grading', () => {
  const { service } = createHarness();
  const deconstruction = service.professorPhaseDirective('DECONSTRUCTION');
  assert.match(deconstruction, /transferable retrospective/i);
  assert.match(deconstruction, /method, choices, errors and corrections, source roles and concepts/i);
  assert.match(deconstruction, /Do not copy the document/i);
  assert.match(deconstruction, /invent sources/i);
  assert.match(deconstruction, /invent a grade/i);

  const finalization = service.professorPhaseDirective('FINALIZATION');
  assert.match(finalization, /not export/i);
  assert.match(finalization, /institutional approval/i);
});

test('AW-5 bounded journal retains exactly the replayable conversation window', async () => {
  const { service, state } = createHarness();
  const workspace = await service.create('owner', request({ requestId: 'workspace-aw5-bounded-create' }));
  let revision = 0;
  const replies = new Map();
  for (let index = 1; index <= 16; index += 1) {
    const requestId = `aw5-bounded-turn-${String(index).padStart(2, '0')}`;
    const response = await service.assist('owner', workspace.id, {
      requestId, expectedPhase: 'CAPTURE', expectedRevision: revision,
      action: 'explain', message: `Bounded context turn ${index}.`,
    });
    revision = response.revision;
    replies.set(requestId, response.reply.id);
  }
  const persisted = await service.get('owner', workspace.id);
  assert.equal(persisted.assistantHistory.length, 30);
  assert.equal(persisted.professor.assistOperations.length, 15);
  assert.equal(persisted.professor.assistOperations[0].requestId, 'aw5-bounded-turn-02');
  const calls = state.llmCalls;
  const replay = await service.assist('owner', workspace.id, {
    requestId: 'aw5-bounded-turn-02', expectedPhase: 'CAPTURE', expectedRevision: 0,
    action: 'explain', message: 'Bounded context turn 2.',
  });
  assert.equal(replay.reply.id, replies.get('aw5-bounded-turn-02'));
  assert.equal(state.llmCalls, calls);
});

test('AW-5 Workspace Professor never performs an automatic paid provider retry', () => {
  const service = Object.create(LlmService.prototype);
  const policy = service.policy('workspace-assistant', 'openai');
  assert.equal(policy.retries, 0);
  assert.equal(policy.backoffMs, 0);
});

function autopilotState(workspace) {
  return workspace.progress.workflow.autopilot;
}

const PHYSICS_WORK_DRAFT = '# Introduction\n\n'
  + 'Kinetic energy: it is associated with the motion of an object. Potential energy is associated with its position or configuration. '
  + 'For gravitational potential energy, the chosen reference height determines the numerical value.\n\n'
  + '# Method\n\n'
  + 'The kinetic-energy relation is Ec = 1/2 mv². Gravitational potential energy is Ep = mgh, where g is gravitational acceleration and h is height. '
  + 'The supplied data are m = 2 kg and v = 5 m/s. Substituting these data into the first relation gives a result in joules.\n\n'
  + '# Calculation\n\n'
  + 'v² = (5 m/s)² = 25 m²/s². Ec = 1/2 × 2 kg × 25 m²/s² = 25 J. '
  + 'For potential energy, height is not supplied, so no numerical value is asserted.\n\n'
  + '# Conclusion\n\n'
  + 'The object has 25 J of kinetic energy. This calculation concerns motion; potential energy instead depends on position or configuration. '
  + 'The missing height remains an explicit limit rather than an invented input.';

const WORK_KIND_BY_TEMPLATE = {
  assignment: 'ANSWER_DRAFT', memoire: 'CURRENT_SECTION_DRAFT', tfc: 'CURRENT_SECTION_DRAFT',
  dissertation: 'ARGUMENTATIVE_DRAFT', article: 'SCIENTIFIC_SECTION_DRAFT', report: 'REPORT_SECTION_DRAFT',
  other: 'ADAPTIVE_DRAFT', 'academic-research': 'ADAPTIVE_DRAFT',
};

function autopilotReply(_messages, _options, state) {
  const row = state.workspaces.at(-1);
  const phase = row.progress.workflow.professor.currentPhase;
  const output = { text: `Verified technical ${phase.toLowerCase()} explanation.` };
  if (phase === 'COMPREHENSION') {
    output.briefFields = {
      subject: 'Kinetic and potential energy',
      requirements: 'Explain formulas and compute the kinetic energy of 2 kg at 5 m/s.',
    };
  }
  if (phase === 'METHOD') {
    output.plan = [
      { title: 'Define kinetic and potential energy', stepId: 'drafting' },
      { title: 'Calculate and verify kinetic energy', stepId: 'drafting' },
      { title: 'State the conclusion and missing height', stepId: 'drafting' },
    ];
  }
  if (phase === 'WORK' || phase === 'COACHING') {
    output.draft = PHYSICS_WORK_DRAFT;
    output.workOutputKind = WORK_KIND_BY_TEMPLATE[row.template];
    output.workEvidence = [{
      requirement: row.progress.workflow.brief.fields.requirements || row.progress.workflow.brief.fields.userInstructions || row.progress.workflow.brief.fields.subject,
      excerpt: 'Kinetic energy: it is associated with the motion of an object.',
    }];
  }
  if (phase === 'VERIFICATION') output.checkedPlanItemIds = row.plan.map((item) => item.id);
  if (phase === 'FINALIZATION') output.deconstruction = 'We identified the formula, substituted measured inputs, verified 25 J, and kept the unavailable height explicit.';
  return JSON.stringify(output);
}

async function autopilotCommand(service, workspace, action, suffix, extra = {}) {
  return service.autopilot('owner', workspace.id, {
    requestId: `autopilot-test-${suffix}`,
    expectedRevision: workspace.autosaveRevision,
    action,
    ...extra,
  });
}

async function autopilotFixture(options = {}, overrides = {}) {
  const harness = createHarness({ llmResponder: autopilotReply, ...options });
  const workspace = await harness.service.create('owner', request({
    requestId: `autopilot-create-${overrides.template ?? 'assignment'}`,
    objective: '',
    brief: { version: 1, fields: {
      subject: 'University physics',
      requirements: 'Explain kinetic/potential energy, formulas, the 2 kg / 5 m/s calculation, method and conclusion.',
    } },
    ...overrides,
  }));
  return { ...harness, workspace };
}

test('Autopilot requires one consent, preserves the capture and completes the authoritative five-call cycle', async () => {
  const { service, state, workspace: created } = await autopilotFixture({}, {
    brief: { version: 1, fields: {
      subject: 'University physics',
      requirements: 'Explain the formulas and calculate kinetic energy for 2 kg at 5 m/s.',
      userInstructions: 'Original captured instructions must never be erased.',
    } },
  });
  assert.equal(autopilotState(created).status, 'IDLE');
  await assert.rejects(autopilotCommand(service, created, 'start', 'without-consent'), (error) => httpStatus(error) === 400);
  let workspace = await autopilotCommand(service, created, 'start', 'consented', { consent: true });
  assert.equal(autopilotState(workspace).status, 'RUNNING');
  assert.equal(state.llmCalls, 0);
  const phases = ['METHOD', 'WORK', 'VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'];
  for (const [index, phase] of phases.entries()) {
    workspace = await autopilotCommand(service, workspace, 'step', `happy-${index}`);
    assert.equal(workspace.professor.currentPhase, phase, JSON.stringify(autopilotState(workspace)));
  }
  assert.equal(state.llmCalls, 5);
  assert.equal(autopilotState(workspace).aiSteps, 5);
  assert.equal(autopilotState(workspace).status, 'COMPLETED');
  assert.equal(workspace.status, 'completed');
  assert.match(workspace.draft.content, /25 J/);
  assert.equal(workspace.brief.fields.userInstructions, 'Original captured instructions must never be erased.');
  assert.equal(workspace.professor.transitions.length, 6);
  assert.equal(workspace.completion.snapshots.at(-1).draft.content, workspace.draft.content);
  assert.equal(state.llmOptions.every((option) => option.operation === 'workspace-assistant'), true);
  assert.ok(state.llmMessages.every((messages) => messages[0].content.includes('explicitly consented')));
});

test('Autopilot metadata is resumable across a new service instance without resetting counters or phase', async () => {
  const { service, state, prisma, llm, sourceEngine, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'resume-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'resume-first');
  workspace = await autopilotCommand(service, workspace, 'pause', 'resume-pause');
  const reconnected = new AcademicWorkspaceService(prisma, llm, sourceEngine);
  const restored = await reconnected.get('owner', workspace.id);
  assert.equal(restored.professor.currentPhase, 'METHOD');
  assert.equal(autopilotState(restored).aiSteps, 1);
  assert.equal(autopilotState(restored).status, 'PAUSED');
  workspace = await autopilotCommand(reconnected, restored, 'resume', 'resume-command');
  workspace = await autopilotCommand(reconnected, workspace, 'step', 'resume-next');
  assert.equal(workspace.professor.currentPhase, 'WORK');
  assert.equal(autopilotState(workspace).aiSteps, 2);
  assert.equal(state.llmCalls, 2);
});

test('Autopilot rejects foreign ownership, stale commands and missing consent before any paid step', async () => {
  const { service, state, workspace } = await autopilotFixture();
  await assert.rejects(service.autopilot('intruder', workspace.id, {
    requestId: 'autopilot-foreign-command', expectedRevision: workspace.autosaveRevision, action: 'start', consent: true,
  }), (error) => httpStatus(error) === 404);
  await assert.rejects(service.autopilot('owner', workspace.id, {
    requestId: 'autopilot-stale-command', expectedRevision: 99, action: 'start', consent: true,
  }), (error) => httpStatus(error) === 409);
  await assert.rejects(autopilotCommand(service, workspace, 'step', 'unconsented-step'), (error) => httpStatus(error) === 409);
  assert.equal(state.llmCalls, 0);
  assert.equal(state.sourceCalls, 0);
});

test('Autopilot concurrent retry and completed replay never duplicate a provider call or transition', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  const workspace = await autopilotCommand(service, created, 'start', 'race-start', { consent: true });
  let release;
  state.llmBarrier = new Promise((resolve) => { release = resolve; });
  const payload = { requestId: 'autopilot-concurrent-step', expectedRevision: workspace.autosaveRevision, action: 'step' };
  const first = service.autopilot('owner', workspace.id, payload);
  while (state.llmCalls === 0) await new Promise((resolve) => setImmediate(resolve));
  await service.autopilot('owner', workspace.id, payload);
  await autopilotCommand(service, await service.get('owner', workspace.id), 'step', 'competing-step');
  assert.equal(state.llmCalls, 1);
  release();
  const completed = await first;
  const transitions = completed.professor.transitions.length;
  await service.autopilot('owner', workspace.id, payload);
  const persisted = await service.get('owner', workspace.id);
  assert.equal(state.llmCalls, 1);
  assert.equal(persisted.professor.transitions.length, transitions);
  assert.equal(autopilotState(persisted).aiSteps, 1);
});

test('Autopilot pause during a provider call prevents its mutation and next transition', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'pause-start', { consent: true });
  let release;
  state.llmBarrier = new Promise((resolve) => { release = resolve; });
  const pending = autopilotCommand(service, workspace, 'step', 'pause-running-step');
  while (state.llmCalls === 0) await new Promise((resolve) => setImmediate(resolve));
  workspace = await service.get('owner', workspace.id);
  await autopilotCommand(service, workspace, 'pause', 'pause-during-provider');
  release();
  await pending;
  const stopped = await service.get('owner', workspace.id);
  assert.equal(autopilotState(stopped).status, 'PAUSED');
  assert.equal(stopped.professor.currentPhase, 'COMPREHENSION');
  assert.equal(stopped.draft.content, '');
  assert.equal(state.llmCalls, 1);
});

test('Autopilot provider failure and invalid structured output pause safely without automatic replay', async () => {
  for (const invalidOutput of [false, true]) {
    const { service, state, workspace: created } = await autopilotFixture();
    let workspace = await autopilotCommand(service, created, 'start', `error-start-${invalidOutput}`, { consent: true });
    if (invalidOutput) state.llmResponder = () => 'Unverified non-JSON provider output';
    else state.llmError = new Error('TECHNICAL_PROVIDER_FAILURE');
    const payload = { requestId: `autopilot-failed-${invalidOutput}`, expectedRevision: workspace.autosaveRevision, action: 'step' };
    workspace = await service.autopilot('owner', workspace.id, payload);
    assert.equal(autopilotState(workspace).status, 'PAUSED_ERROR');
    assert.equal(workspace.professor.currentPhase, 'COMPREHENSION');
    assert.equal(workspace.draft.content, '');
    assert.equal(workspace.professor.evidence.length, 0);
    await service.autopilot('owner', workspace.id, payload);
    assert.equal(state.llmCalls, 1);
    assert.equal(autopilotState(workspace).aiSteps, 1);
  }
});

test('Autopilot enforces its durable configured step limit before provider and resume cannot reset it', async () => {
  const { service, state, workspace: created } = await autopilotFixture({ config: { WORKSPACE_AUTOPILOT_MAX_AI_STEPS: 1 } });
  let workspace = await autopilotCommand(service, created, 'start', 'cap-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'cap-one');
  workspace = await autopilotCommand(service, workspace, 'step', 'cap-two');
  assert.equal(autopilotState(workspace).status, 'NEEDS_INPUT');
  assert.equal(autopilotState(workspace).errorCode, 'STOP_AUTOPILOT_REVIEW_REQUIRED');
  assert.equal(autopilotState(workspace).aiSteps, 1);
  assert.equal(state.llmCalls, 1);
  await assert.rejects(autopilotCommand(service, workspace, 'resume', 'cap-resume'), (error) => httpStatus(error) === 409);
  assert.equal(state.llmCalls, 1);
});

test('Autopilot missing attached source asks once, performs no provider call and records no fabricated evidence', async () => {
  const { service, state, workspace: created } = await autopilotFixture({}, {
    sources: [{ kind: 'document', id: 'document-owner' }],
  });
  let workspace = await autopilotCommand(service, created, 'start', 'source-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'source-missing');
  assert.equal(autopilotState(workspace).status, 'NEEDS_INPUT');
  assert.equal(state.llmCalls, 0);
  assert.equal(workspace.professor.evidence.length, 0);
  assert.equal(workspace.professor.currentPhase, 'COMPREHENSION');
  assert.equal(workspace.draft.content, '');
});

test('Autopilot preserves AW-6 citation validation and source ownership for automatic steps', async () => {
  const { service, state, workspace: created } = await autopilotFixture({}, {
    sources: [{ kind: 'document', id: 'document-owner' }],
  });
  state.sourceResolution = {
    query: 'technical source', usedContext: true, context: 'Owned technical passage [W1].',
    citations: [{ sourceKind: 'document', sourceId: 'document-owner', documentId: 'document-owner', documentTitle: 'Owned document', citationLabel: 'W1', chunkIndex: 0, content: 'Owned technical passage.' }],
    sources: [{ kind: 'document', id: 'document-owner', title: 'Owned document', availability: 'available' }],
  };
  const responder = state.llmResponder;
  state.llmResponder = (...args) => {
    const output = { ...JSON.parse(responder(...args)), text: 'Verified [W1], invented [W99].' };
    if (output.draft) output.draft += ' Valid source [W1], invented source [W99].';
    return JSON.stringify(output);
  };
  let workspace = await autopilotCommand(service, created, 'start', 'grounded-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'grounded-step');
  const reply = workspace.assistantHistory.find((entry) => entry.role === 'assistant');
  assert.match(reply.content, /\[W1\]/);
  assert.doesNotMatch(reply.content, /W99/);
  assert.deepEqual(reply.citations.map((citation) => citation.documentId), ['document-owner']);
  assert.equal(state.llmCalls, 1);
  workspace = await autopilotCommand(service, workspace, 'step', 'grounded-method');
  workspace = await autopilotCommand(service, workspace, 'step', 'grounded-work');
  assert.match(workspace.draft.content, /\[W1\]/);
  assert.doesNotMatch(workspace.draft.content, /W99/);
  assert.equal(state.llmCalls, 3);
});

test('Autopilot correction loops stop for review rather than repeatedly coaching the same failure', async () => {
  const { service, state, workspace: created } = await autopilotFixture({ config: { WORKSPACE_AUTOPILOT_MAX_CORRECTION_LOOPS: 1 } });
  const responder = state.llmResponder;
  state.llmResponder = (...args) => {
    const output = JSON.parse(responder(...args));
    if (state.workspaces[0].progress.workflow.professor.currentPhase === 'VERIFICATION') output.issues = ['A real unresolved issue remains.'];
    return JSON.stringify(output);
  };
  let workspace = await autopilotCommand(service, created, 'start', 'loop-start', { consent: true });
  for (let step = 0; step < 6 && autopilotState(workspace).status === 'RUNNING'; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `loop-${step}`);
  assert.equal(autopilotState(workspace).status, 'NEEDS_INPUT', JSON.stringify(autopilotState(workspace)));
  assert.equal(autopilotState(workspace).errorCode, 'STOP_AUTOPILOT_REVIEW_REQUIRED');
  assert.equal(autopilotState(workspace).correctionLoops, 1);
  assert.equal(state.llmCalls, 6);
  assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
});

test('Autopilot draft contribution has revision-checked undo and cannot erase a later user edit', async () => {
  const { service, workspace: created } = await autopilotFixture({}, { initialContent: 'Original learner text.' });
  let workspace = await autopilotCommand(service, created, 'start', 'undo-start', { consent: true });
  for (let step = 0; step < 3; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `undo-${step}`);
  assert.match(workspace.draft.content, /25 J/);
  workspace = await autopilotCommand(service, workspace, 'pause', 'undo-pause');
  const appliedRevision = workspace.autosaveRevision;
  workspace = await autopilotCommand(service, workspace, 'undo', 'undo-once');
  assert.equal(workspace.draft.content, 'Original learner text.');
  assert.equal(workspace.autosaveRevision, appliedRevision + 1);
  assert.equal(autopilotState(workspace).status, 'PAUSED');
  assert.equal(autopilotState(workspace).undo, undefined);
  await assert.rejects(autopilotCommand(service, workspace, 'undo', 'undo-again'), (error) => httpStatus(error) === 409);

  const second = await autopilotFixture({}, { initialContent: 'Original second learner text.' });
  let stale = await autopilotCommand(second.service, second.workspace, 'start', 'undo-stale-start', { consent: true });
  for (let step = 0; step < 3; step += 1) stale = await autopilotCommand(second.service, stale, 'step', `undo-stale-${step}`);
  stale = await autopilotCommand(second.service, stale, 'pause', 'undo-stale-pause');
  await second.service.autosave('owner', stale.id, { workspaceId: stale.id, expectedRevision: stale.autosaveRevision, draft: { format: 'markdown', content: 'Newer user edit must remain.' } });
  stale = await second.service.get('owner', stale.id);
  await assert.rejects(autopilotCommand(second.service, stale, 'undo', 'undo-stale-refused'), (error) => httpStatus(error) === 409);
  assert.equal((await second.service.get('owner', stale.id)).draft.content, 'Newer user edit must remain.');
});

test('Autopilot routes six shells through the existing Professor while keeping explicit user and institution instructions', async () => {
  for (const template of ['assignment', 'memoire', 'dissertation', 'article', 'report', 'other']) {
    const { service, state, workspace: created } = await autopilotFixture({}, {
      template,
      brief: { version: 1, fields: { subject: 'Physics', requirements: 'Keep my explicit institution instructions.', userInstructions: 'Never invent observations.' } },
    });
    let workspace = await autopilotCommand(service, created, 'start', `shell-${template}`, { consent: true });
    for (let step = 0; step < 3; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `shell-${template}-${step}`);
    assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
    assert.equal(state.llmCalls, 3);
    assert.equal(workspace.brief.fields.requirements, 'Keep my explicit institution instructions.');
    assert.equal(workspace.brief.fields.userInstructions, 'Never invent observations.');
    assert.ok(state.llmMessages.every((messages) => messages[0].content.includes('existing Professor')));
  }
});

test('Autopilot can pause for a manual question then resume without replacing the manual action contract', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'question-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'question-first');
  workspace = await autopilotCommand(service, workspace, 'pause', 'question-pause');
  state.llmResponder = null;
  state.llmResponse = 'A real stubbed manual explanation for this deterministic test.';
  const answer = await service.assist('owner', workspace.id, {
    requestId: 'autopilot-manual-question', expectedPhase: 'METHOD', expectedRevision: workspace.autosaveRevision,
    action: 'explain', message: 'Why this method?',
  });
  assert.equal(answer.reply.content, state.llmResponse);
  workspace = await service.get('owner', workspace.id);
  assert.equal(autopilotState(workspace).status, 'PAUSED');
  workspace = await autopilotCommand(service, workspace, 'resume', 'question-resume');
  assert.equal(autopilotState(workspace).status, 'RUNNING');
  assert.equal(state.llmCalls, 2);
});

test('Autopilot separates captured homework instructions from the editable answer without duplicating the capture', async () => {
  const { service, state } = createHarness({ llmResponder: autopilotReply });
  const instruction = 'Explain the energy formulas and calculate 2 kg moving at 5 m/s.';
  const workspace = await service.create('owner', request({
    requestId: 'autopilot-capture-separation', initialContent: instruction, autopilotConsent: true,
  }));
  assert.equal(autopilotState(workspace).status, 'RUNNING');
  assert.equal(workspace.draft.content, '');
  assert.equal(workspace.brief.fields.userInstructions, instruction);
  assert.equal(state.llmCalls, 0);
});

test('Autopilot verification refuses invented plan IDs and cannot manufacture completion flags', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'bad-ids-start', { consent: true });
  for (let step = 0; step < 3; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `bad-ids-${step}`);
  state.llmResponder = () => JSON.stringify({ text: 'Invalid verification result', checkedPlanItemIds: ['not-a-real-plan-id'] });
  workspace = await autopilotCommand(service, workspace, 'step', 'bad-ids-verify');
  assert.equal(autopilotState(workspace).status, 'PAUSED_ERROR');
  assert.equal(autopilotState(workspace).errorCode, 'workspace_autopilot_invalid_verification');
  assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
  assert.equal(workspace.plan.some((item) => item.completed), false);
  assert.equal(workspace.status, 'active');
  assert.equal(state.llmCalls, 4);
});

test('Autopilot missing verified plan work stays unfinished instead of filling completion flags', async () => {
  const { service, state, workspace: created } = await autopilotFixture({ config: { WORKSPACE_AUTOPILOT_MAX_CORRECTION_LOOPS: 0 } });
  let workspace = await autopilotCommand(service, created, 'start', 'incomplete-start', { consent: true });
  for (let step = 0; step < 3; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `incomplete-${step}`);
  const verifiedId = workspace.plan[0].id;
  state.llmResponder = () => JSON.stringify({ text: 'Only the first section was verified.', checkedPlanItemIds: [verifiedId], issues: ['Remaining sections are absent.'] });
  workspace = await autopilotCommand(service, workspace, 'step', 'incomplete-verify');
  assert.equal(autopilotState(workspace).status, 'NEEDS_INPUT');
  assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
  assert.equal(workspace.plan.filter((item) => item.completed).length, 1);
  assert.equal(workspace.status, 'active');
  assert.equal(workspace.completion.snapshots.length, 0);
});

test('Autopilot undo survives its own verification revision but invalidates all derived verification', async () => {
  const { service, workspace: created } = await autopilotFixture({}, { initialContent: 'Prior learner answer.' });
  let workspace = await autopilotCommand(service, created, 'start', 'verify-undo-start', { consent: true });
  for (let step = 0; step < 4; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `verify-undo-${step}`);
  assert.equal(workspace.professor.currentPhase, 'FINALIZATION');
  assert.ok(workspace.plan.every((item) => item.completed));
  workspace = await autopilotCommand(service, workspace, 'pause', 'verify-undo-pause');
  workspace = await autopilotCommand(service, workspace, 'undo', 'verify-undo-restore');
  assert.equal(workspace.draft.content, 'Prior learner answer.');
  assert.equal(workspace.plan.some((item) => item.completed), false);
  assert.equal(workspace.status, 'active');
  assert.equal(workspace.completion.snapshots.length, 0);
  await assert.rejects(service.finalize('owner', workspace.id, {
    requestId: 'autopilot-undo-cannot-finalize', expectedRevision: workspace.autosaveRevision,
  }), (error) => httpStatus(error) === 400);
});

test('Autopilot completed snapshot stays immutable when the learner explicitly continues editing', async () => {
  const { service, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'snapshot-start', { consent: true });
  for (let step = 0; step < 5; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `snapshot-${step}`);
  const snapshot = structuredClone(workspace.completion.snapshots.at(-1));
  workspace = await service.update('owner', workspace.id, { status: 'active', expectedRevision: workspace.autosaveRevision });
  assert.equal(workspace.professor.currentPhase, 'WORK');
  assert.equal(workspace.status, 'active');
  await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id, expectedRevision: workspace.autosaveRevision,
    draft: { format: 'markdown', content: `${workspace.draft.content}\n\nLearner follow-up.` },
  });
  workspace = await service.get('owner', workspace.id);
  assert.deepEqual(workspace.completion.snapshots.at(-1), snapshot);
  assert.equal(autopilotState(workspace).aiSteps, 5);
});

test('Autopilot stale pending state is shown as a safe pause after reload without replaying the provider', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'stale-start', { consent: true });
  const stored = state.workspaces[0].progress.workflow.autopilot;
  stored.activeRequest = {
    requestId: 'autopilot-stale-operation', status: 'pending', phase: 'CAPTURE', revision: workspace.autosaveRevision,
    createdAt: new Date(Date.now() - 180_000).toISOString(),
  };
  stored.aiSteps = 1;
  workspace = await service.get('owner', workspace.id);
  assert.equal(autopilotState(workspace).status, 'PAUSED_ERROR');
  assert.equal(autopilotState(workspace).activeRequest, undefined);
  assert.equal(autopilotState(workspace).aiSteps, 1);
  assert.equal(state.llmCalls, 0);
});

test('Autopilot resumes a paid result retained during pause exactly once without another call or draft append', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'pending-result-start', { consent: true });
  for (let step = 0; step < 2; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `pending-result-${step}`);
  assert.equal(workspace.professor.currentPhase, 'WORK');
  let release;
  state.llmBarrier = new Promise((resolve) => { release = resolve; });
  const pending = autopilotCommand(service, workspace, 'step', 'pending-result-work');
  while (state.llmCalls < 3) await new Promise((resolve) => setImmediate(resolve));
  workspace = await service.get('owner', workspace.id);
  await autopilotCommand(service, workspace, 'pause', 'pending-result-pause');
  release();
  await pending;
  workspace = await service.get('owner', workspace.id);
  assert.equal(autopilotState(workspace).status, 'PAUSED');
  assert.equal(workspace.draft.content, '');
  assert.ok(autopilotState(workspace).pendingResult, 'Paid result must be saved for continuation');
  const consumed = autopilotState(workspace).aiSteps;
  state.llmBarrier = null;
  workspace = await autopilotCommand(service, workspace, 'resume', 'pending-result-resume');
  const payload = { requestId: 'autopilot-pending-result-apply', expectedRevision: workspace.autosaveRevision, action: 'step' };
  workspace = await service.autopilot('owner', workspace.id, payload);
  assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
  assert.equal(state.llmCalls, 3);
  assert.equal(autopilotState(workspace).aiSteps, consumed);
  const saved = workspace.draft.content;
  await service.autopilot('owner', workspace.id, payload);
  assert.equal((await service.get('owner', workspace.id)).draft.content, saved);
  assert.equal((saved.match(/Kinetic energy:/g) ?? []).length, 1);
  assert.equal(state.llmCalls, 3);
});

test('Autopilot long-form work cannot mark a whole thesis or article complete from one generated section', async () => {
  for (const template of ['memoire', 'tfc', 'article', 'academic-research']) {
    const { service, state, workspace: created } = await autopilotFixture({}, {
      template,
      brief: { version: 1, fields: {
        subject: 'Energy', researchQuestion: 'How does kinetic energy depend on velocity?',
        methodology: 'Analyze the supplied formulas and state evidential limits.',
        requirements: 'Work section by section without inventing research results.',
        deliverable: 'A sectioned technical review',
      } },
    });
    let workspace = await autopilotCommand(service, created, 'start', `longform-${template}`, { consent: true });
    const originalPlanLength = workspace.plan.length;
    for (let step = 0; step < 4; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `longform-${template}-${step}`);
    assert.equal(state.llmCalls, 4);
    assert.equal(workspace.plan.length, originalPlanLength, 'The full long-form structure must be preserved');
    assert.equal(workspace.plan.filter((item) => item.completed).length, 1, 'Only the server-selected section can be validated');
    assert.equal(workspace.status, 'active');
    assert.equal(workspace.completion.snapshots.length, 0);
    assert.notEqual(workspace.professor.currentPhase, 'FINALIZATION');
    assert.notEqual(autopilotState(workspace).status, 'COMPLETED');
  }
});

test('Autopilot bounds the complete provider prompt before spending and preserves the draft on a byte limit', async () => {
  const { service, state, workspace: created } = await autopilotFixture({ config: { WORKSPACE_AUTOPILOT_MAX_PROMPT_BYTES: 2_000 } }, {
    brief: { version: 1, fields: { subject: 'Physics', requirements: 'A'.repeat(6_000) } },
  });
  let workspace = await autopilotCommand(service, created, 'start', 'bytes-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'bytes-step');
  assert.ok(['NEEDS_INPUT', 'PAUSED_ERROR'].includes(autopilotState(workspace).status));
  assert.equal(autopilotState(workspace).errorCode, 'STOP_AUTOPILOT_REVIEW_REQUIRED');
  assert.equal(state.llmCalls, 0);
  assert.equal(workspace.professor.currentPhase, 'COMPREHENSION');
  assert.equal(workspace.professor.evidence.length, 0);
  assert.equal(workspace.draft.content, '');
});

test('Autopilot preserves long captured instructions exactly and stops an oversized prompt without losing the capture', async () => {
  for (const length of [12_000, 62_000]) {
    const { service, state } = createHarness({
      llmResponder: autopilotReply,
      config: { WORKSPACE_AUTOPILOT_MAX_PROMPT_BYTES: 60_000 },
    });
    const instruction = 'Original technical instructions. '.repeat(Math.ceil(length / 33)).slice(0, length);
    const created = await service.create('owner', request({
      requestId: `autopilot-long-capture-${length}`,
      objective: '',
      autopilotConsent: true,
      // The capture UI sends this field directly, without duplicating it in initialContent.
      brief: { version: 1, fields: {
        subject: 'University physics', requirements: 'Keep the entire original instructions.',
        userInstructions: instruction,
      } },
    }));
    assert.equal(instruction.length, length);
    assert.equal(created.brief.fields.userInstructions, instruction);
    assert.equal(created.draft.content, '');
    const reloaded = await service.get('owner', created.id);
    assert.equal(reloaded.brief.fields.userInstructions, instruction);
    assert.equal(reloaded.draft.content, '');
    assert.equal(state.llmCalls, 0);
    if (length > 60_000) {
      const stopped = await autopilotCommand(service, reloaded, 'step', `long-capture-stop-${length}`);
      assert.ok(['NEEDS_INPUT', 'PAUSED_ERROR'].includes(autopilotState(stopped).status));
      assert.equal(autopilotState(stopped).errorCode, 'STOP_AUTOPILOT_REVIEW_REQUIRED');
      assert.equal(stopped.brief.fields.userInstructions, instruction);
      assert.equal(stopped.draft.content, '');
      assert.equal(stopped.professor.evidence.length, 0);
      assert.equal(state.llmCalls, 0);
    }
  }
});

test('Autopilot places its consented orchestration directive after strategy and Passport while manual pedagogy remains unchanged', async () => {
  const { strategyDirective, selectStrategy } = require('../dist/tutor/teaching-strategy.js');
  const { autopilotProfessorDirective } = require('../dist/workspaces/workspace-autopilot.js');
  const passport = {
    learningPreferences: ['visual'], ageBand: null,
    directive: 'PASSPORT_TEST_SENTINEL: preserve all examination restrictions and the real academic rubric.',
  };
  const learnerPassport = { tutorContext: async () => passport };
  const expectedStrategy = strategyDirective(selectStrategy({
    subject: 'University physics', isLanguage: false, mastery: null,
    learningStyle: passport.learningPreferences.join(' '), ageBand: passport.ageBand,
  }).strategy);
  const automatic = await autopilotFixture({ learnerPassport });
  let workspace = await autopilotCommand(automatic.service, automatic.workspace, 'start', 'priority-auto-start', { consent: true });
  workspace = await autopilotCommand(automatic.service, workspace, 'step', 'priority-auto-step');
  const system = automatic.state.llmMessages[0].find((message) => message.role === 'system').content;
  const directive = autopilotProfessorDirective('COMPREHENSION', 'assignment');
  assert.ok(system.includes(expectedStrategy), 'Autopilot must reuse the existing teacher strategy');
  assert.ok(system.includes(passport.directive), 'Passport and examination restrictions remain present');
  assert.ok(system.endsWith(directive), 'Consent-specific orchestration must be the final system instruction');
  assert.ok(system.lastIndexOf(directive) > system.indexOf(expectedStrategy));
  assert.ok(system.lastIndexOf(directive) > system.indexOf(passport.directive));
  assert.match(directive, /override ONLY optional pedagogical intake/);
  assert.match(directive, /Do not put optional prior-knowledge, confidence, preference or understanding questions in needsInput/);
  assert.match(directive, /priority NEVER overrides mandatory examination conditions/);
  assert.equal(workspace.professor.currentPhase, 'METHOD');

  const manual = await autopilotFixture({ learnerPassport });
  manual.state.llmResponder = null;
  await manual.service.assist('owner', manual.workspace.id, {
    requestId: 'autopilot-priority-manual-turn', action: 'explain',
    expectedPhase: 'CAPTURE', expectedRevision: manual.workspace.autosaveRevision,
    message: 'Explain this task in the existing guided manual mode.',
  });
  const manualSystem = manual.state.llmMessages[0].find((message) => message.role === 'system').content;
  assert.ok(manualSystem.includes(expectedStrategy), 'Manual strategy and pedagogical arc must not be rewritten');
  assert.ok(manualSystem.includes(passport.directive));
  assert.ok(!manualSystem.includes(directive), 'Manual mode cannot inherit consent-specific Autopilot overrides');
  assert.equal(autopilotState(await manual.service.get('owner', manual.workspace.id)).status, 'IDLE');
});

test('Autopilot still pauses for genuinely essential clarification without moving past comprehension', async () => {
  const clarification = 'Which measured height is required by the supplied numerical potential-energy question?';
  const { service, state, workspace: created } = await autopilotFixture({
    llmResponder: () => JSON.stringify({
      text: 'The requested numerical potential energy cannot be computed from mass alone.',
      needsInput: clarification,
    }),
  });
  let workspace = await autopilotCommand(service, created, 'start', 'essential-start', { consent: true });
  workspace = await autopilotCommand(service, workspace, 'step', 'essential-step');
  assert.equal(autopilotState(workspace).status, 'NEEDS_INPUT');
  assert.equal(autopilotState(workspace).errorCode, 'workspace_autopilot_clarification_required');
  assert.equal(autopilotState(workspace).reason, clarification);
  assert.equal(workspace.professor.currentPhase, 'COMPREHENSION');
  assert.equal(workspace.draft.content, '');
  assert.equal(state.llmCalls, 1);
  await assert.rejects(autopilotCommand(service, workspace, 'step', 'essential-cannot-force-next'), (error) => httpStatus(error) === 409);
  assert.equal(state.llmCalls, 1);
});

test('WORK production saves the usable physics artifact in the revisioned editable draft and preserves instructions', async () => {
  const instructions = 'Explain kinetic and potential energy, their formulas, and compute kinetic energy for 2 kg at 5 m/s with method and conclusion.';
  const { service, state, workspace: created } = await autopilotFixture({}, {
    autopilotConsent: true,
    brief: { version: 1, fields: { subject: 'University physics', requirements: instructions, userInstructions: instructions } },
  });
  let workspace = created;
  for (let step = 0; step < 2; step += 1) {
    workspace = await autopilotCommand(service, workspace, 'step', `work-production-prepare-${step}`);
    assert.equal(workspace.draft.content, '', 'Comprehension and Method are not an answer draft');
  }
  const beforeWork = workspace.autosaveRevision;
  workspace = await autopilotCommand(service, workspace, 'step', 'work-production-artifact');
  assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
  assert.equal(workspace.draft.content, PHYSICS_WORK_DRAFT);
  assert.equal(workspace.autosaveRevision, beforeWork + 1);
  assert.equal(workspace.brief.fields.userInstructions, instructions);
  assert.equal(workspace.brief.fields.requirements, instructions);
  assert.match(workspace.draft.content, /Ec = 1\/2 × 2 kg × 25 m²\/s² = 25 J/);
  assert.equal(state.llmCalls, 3);
  const resumed = await service.get('owner', workspace.id);
  assert.equal(resumed.draft.content, PHYSICS_WORK_DRAFT);
  assert.equal(resumed.autosaveRevision, workspace.autosaveRevision);
  const editedContent = `${resumed.draft.content}\n\nLearner-confirmed annotation.`;
  const saved = await service.autosave('owner', resumed.id, {
    workspaceId: resumed.id, expectedRevision: resumed.autosaveRevision,
    draft: { format: 'markdown', content: editedContent },
  });
  assert.equal(saved.revision, resumed.autosaveRevision + 1);
  assert.equal((await service.get('owner', resumed.id)).draft.content, editedContent);
  assert.equal((await service.get('owner', resumed.id)).brief.fields.userInstructions, instructions);
});

test('WORK production replaces only identified automatic legacy commentary, preserves unknown learner text and supports undo', async () => {
  // Exact observed output retained in deliverables/autopilot-v1-20261019/delivery-proof.json.
  const legacyDraft = 'The assignment asks for explanations of kinetic and potential energy along with their formulas. '
    + 'For kinetic energy, calculate the energy of a 2 kg mass moving at 5 m/s, including the calculation steps, units, and a concluding statement. '
    + 'For potential energy, provide only the formula Ep = mgh without performing any calculation, since the height is not given. '
    + 'The instructions stress the importance of not inventing missing data, ensuring accuracy and scientific rigor by working strictly with the provided information. '
    + 'The draft will present clear explanations, the kinetic energy calculation, and the potential energy formula, followed by a brief explanation of the approach.';
  for (const knownAutomatic of [true, false]) {
    const { service, state, workspace: created } = await autopilotFixture({}, { initialContent: legacyDraft });
    let workspace = await autopilotCommand(service, created, 'start', `work-legacy-start-${knownAutomatic}`, { consent: true });
    for (let step = 0; step < 2; step += 1) {
      workspace = await autopilotCommand(service, workspace, 'step', `work-legacy-prepare-${knownAutomatic}-${step}`);
    }
    const originalRequirements = workspace.brief.fields.requirements;
    if (knownAutomatic) {
      // Reconstruct only a persisted pre-hotfix history entry in the in-memory harness.
      // An exact historical automatic draft is evidence of provenance, not permission to overwrite a learner edit.
      const row = state.workspaces[0];
      row.assistantHistory.push({
        ...row.assistantHistory.at(-1), id: 'legacy-automatic-description',
        content: 'Earlier automatic descriptive output.',
        autopilot: { runId: 'legacy-automatic-run', output: { text: 'Earlier automatic descriptive output.', draft: legacyDraft } },
      });
    }
    workspace = await autopilotCommand(service, workspace, 'step', `work-legacy-produce-${knownAutomatic}`);
    assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
    assert.equal(workspace.draft.content, knownAutomatic ? PHYSICS_WORK_DRAFT : `${legacyDraft}\n\n${PHYSICS_WORK_DRAFT}`);
    assert.equal(workspace.brief.fields.requirements, originalRequirements);
    assert.equal(state.llmCalls, 3);
    workspace = await autopilotCommand(service, workspace, 'pause', `work-legacy-pause-${knownAutomatic}`);
    const phaseBeforeUndo = workspace.professor.currentPhase;
    workspace = await autopilotCommand(service, workspace, 'undo', `work-legacy-undo-${knownAutomatic}`);
    assert.equal(workspace.draft.content, legacyDraft, 'Undo restores the exact saved text in both provenance cases');
    assert.equal(workspace.professor.currentPhase, phaseBeforeUndo, 'Undo does not invent a new Professor transition');
    assert.equal(workspace.plan.some((item) => item.completed), false);
    assert.equal(workspace.brief.fields.requirements, originalRequirements);
    assert.equal(autopilotState(workspace).status, 'PAUSED');
    assert.equal(state.llmCalls, 3, 'Undo never calls the provider');
  }
});

test('WORK production rejects descriptive or method-only draft fields before evidence, application or phase advance', async () => {
  const candidates = [
    'Le devoir demande une introduction, une explication des notions, les formules des énergies et un calcul avec les données. '
      + 'Le résultat attendu comporte une méthode et une conclusion. Ce travail devra montrer la distinction entre mouvement et position, '
      + 'puis appliquer la formule aux valeurs indiquées dans la consigne.',
    'Tu devrais expliquer le sujet. Tu devrais donner les formules. Tu devrais relever les données. '
      + 'Tu devrais choisir la relation appropriée, remplacer les variables et effectuer le calcul. '
      + 'Tu devrais ensuite contrôler les unités et présenter une conclusion dans une réponse organisée.',
  ];
  for (const [index, draft] of candidates.entries()) {
    const { service, state, workspace: created } = await autopilotFixture();
    const responder = state.llmResponder;
    state.llmResponder = (...args) => {
      const output = JSON.parse(responder(...args));
      if (state.workspaces[0].progress.workflow.professor.currentPhase === 'WORK') {
        output.draft = draft;
        output.workEvidence = [{ requirement: 'method and conclusion', excerpt: draft.slice(0, 100) }];
      }
      return JSON.stringify(output);
    };
    let workspace = await autopilotCommand(service, created, 'start', `work-invalid-start-${index}`, { consent: true });
    for (let step = 0; step < 3; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `work-invalid-${index}-${step}`);
    assert.ok(['PAUSED_ERROR', 'NEEDS_INPUT'].includes(autopilotState(workspace).status));
    assert.equal(workspace.professor.currentPhase, 'WORK');
    assert.equal(workspace.draft.content, '');
    assert.equal(workspace.professor.evidence.some((item) => item.phase === 'WORK'), false);
    assert.equal(workspace.plan.some((item) => item.completed), false);
    assert.equal(state.llmCalls, 3);
    await assert.rejects(service.transition('owner', workspace.id, {
      requestId: `work-invalid-no-verification-${index}`, expectedPhase: 'WORK', requestedPhase: 'VERIFICATION',
      expectedRevision: workspace.autosaveRevision,
    }), (error) => httpStatus(error) === 400);
    await assert.rejects(service.finalize('owner', workspace.id, {
      requestId: `work-invalid-no-finalization-${index}`, expectedRevision: workspace.autosaveRevision,
    }), (error) => httpStatus(error) === 400);
  }
});

test('WORK production uses compare-and-swap and never overwrites a learner autosave completed during generation', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  let workspace = await autopilotCommand(service, created, 'start', 'work-cas-start', { consent: true });
  for (let step = 0; step < 2; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `work-cas-${step}`);
  const instructions = workspace.brief.fields.requirements;
  let release;
  state.llmBarrier = new Promise((resolve) => { release = resolve; });
  const pending = autopilotCommand(service, workspace, 'step', 'work-cas-generation');
  while (state.llmCalls < 3) await new Promise((resolve) => setImmediate(resolve));
  await service.autosave('owner', workspace.id, {
    workspaceId: workspace.id, expectedRevision: workspace.autosaveRevision,
    draft: { format: 'markdown', content: 'The learner saved a newer answer while the provider was working.' },
  });
  release();
  await pending;
  workspace = await service.get('owner', workspace.id);
  assert.equal(workspace.draft.content, 'The learner saved a newer answer while the provider was working.');
  assert.equal(workspace.brief.fields.requirements, instructions);
  assert.equal(workspace.professor.currentPhase, 'WORK');
  assert.equal(autopilotState(workspace).status, 'PAUSED_ERROR');
  assert.equal(state.llmCalls, 3);
});

test('WORK production reaches Verification with the real draft and AW-7 coaches that draft rather than a plan description', async () => {
  const { service, state, workspace: created } = await autopilotFixture();
  const responder = state.llmResponder;
  let verificationCount = 0;
  state.llmResponder = (...args) => {
    const output = JSON.parse(responder(...args));
    if (state.workspaces[0].progress.workflow.professor.currentPhase === 'VERIFICATION' && verificationCount++ === 0) {
      output.issues = ['Clarify the final units statement while preserving the actual calculation.'];
    }
    return JSON.stringify(output);
  };
  let workspace = await autopilotCommand(service, created, 'start', 'work-aw7-start', { consent: true });
  for (let step = 0; step < 3; step += 1) workspace = await autopilotCommand(service, workspace, 'step', `work-aw7-${step}`);
  const draftBeforeCheck = workspace.draft.content;
  assert.match(draftBeforeCheck, /25 J/);
  workspace = await autopilotCommand(service, workspace, 'step', 'work-aw7-verify');
  assert.equal(workspace.professor.currentPhase, 'COACHING');
  const verificationPrompt = state.llmMessages[3].find((message) => message.role === 'user').content;
  assert.ok(verificationPrompt.includes(`Current draft:\n${draftBeforeCheck}`));
  assert.match(verificationPrompt, /25 J/);
  workspace = await autopilotCommand(service, workspace, 'step', 'work-aw7-coach');
  const coachingPrompt = state.llmMessages.at(-1).find((message) => message.role === 'user').content;
  assert.match(coachingPrompt, /Workspace tool:/);
  assert.ok(coachingPrompt.includes(draftBeforeCheck));
  assert.match(coachingPrompt, /25 J/);
  assert.ok(workspace.progress.workflow.tools.operations.some((operation) => operation.status === 'applied'));
  assert.match(workspace.draft.content, /25 J/);
  assert.equal(workspace.professor.currentPhase, 'VERIFICATION');
});

test('WORK production contract leaves manual Work explanations as commentary without automatically writing an answer', async () => {
  const { service, state } = createHarness();
  let workspace = await service.create('owner', request({ requestId: 'work-manual-create' }));
  const move = async (requestedPhase, suffix) => {
    await service.transition('owner', workspace.id, {
      requestId: `work-manual-transition-${suffix}`, expectedPhase: workspace.professor.currentPhase,
      requestedPhase, expectedRevision: workspace.autosaveRevision,
    });
    workspace = await service.get('owner', workspace.id);
  };
  await move('COMPREHENSION', 'from-capture');
  for (const [phase, action] of [['COMPREHENSION', 'explain'], ['METHOD', 'structure']]) {
    await service.assist('owner', workspace.id, {
      requestId: `work-manual-explain-${phase.toLowerCase()}`, expectedPhase: phase,
      expectedRevision: workspace.autosaveRevision, action, message: 'Give guidance only; do not write the answer.',
    });
    await move(phase === 'COMPREHENSION' ? 'METHOD' : 'WORK', phase.toLowerCase());
  }
  state.llmResponse = 'Tu peux choisir une méthode, relever les données et rédiger ton propre calcul.';
  const reply = await service.assist('owner', workspace.id, {
    requestId: 'work-manual-commentary', expectedPhase: 'WORK', expectedRevision: workspace.autosaveRevision,
    action: 'explain', message: 'Explain without drafting for me.',
  });
  assert.equal(reply.reply.content, state.llmResponse);
  workspace = await service.get('owner', workspace.id);
  assert.equal(workspace.draft.content, '');
  assert.equal(autopilotState(workspace).status, 'IDLE');
  assert.equal(workspace.professor.currentPhase, 'WORK');
});
