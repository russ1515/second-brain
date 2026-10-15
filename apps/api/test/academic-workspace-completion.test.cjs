'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shared = require('@second-brain/shared');
const { AcademicWorkspaceService } = require('../dist/workspaces/academic-workspace.service.js');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const controllerSource = fs.readFileSync(
  path.join(ROOT, 'apps/api/src/workspaces/academic-workspace.controller.ts'),
  'utf8',
);

function status(error) {
  return typeof error?.getStatus === 'function' ? error.getStatus() : error?.status;
}

function code(error) {
  const response = typeof error?.getResponse === 'function' ? error.getResponse() : undefined;
  return response && typeof response === 'object' ? response.code : undefined;
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
    providerCalls: 0,
    sourceCalls: 0,
  };
  let transactionTail = Promise.resolve();
  const academicWorkspace = {
    findFirst: async ({ where }) => state.workspaces.find((row) => matchesWhere(row, where)) ?? null,
    findMany: async ({ where = {}, orderBy, take = 100, cursor, skip = 0 }) => {
      let rows = state.workspaces.filter((row) => matchesWhere(row, where));
      if (orderBy) rows = [...rows].sort((left, right) => right.updatedAt - left.updatedAt);
      if (cursor) {
        const index = rows.findIndex((row) => row.id === cursor.id);
        rows = index < 0 ? [] : rows.slice(index + skip);
      }
      return rows.slice(0, take);
    },
    updateMany: async ({ where, data }) => {
      const rows = state.workspaces.filter((row) => matchesWhere(row, where));
      rows.forEach((row) => applyData(row, data));
      return { count: rows.length };
    },
  };
  const experienceSession = {
    create: async ({ data }) => {
      if (state.sessions.some((row) => row.userId === data.userId && row.idempotencyKey && row.idempotencyKey === data.idempotencyKey)) {
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        throw error;
      }
      const row = {
        version: 1,
        pausedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      state.sessions.push(row);
      return row;
    },
    findUnique: async ({ where }) => state.sessions.find((row) => matchesWhere(row, where)) ?? null,
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
    $executeRaw: async () => 1,
  };
  const prisma = {
    ...tx,
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
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
  const sourceEngine = {
    resolve: async (_userId, sources) => {
      state.sourceCalls += 1;
      return {
        query: '',
        context: '',
        citations: [],
        usedContext: false,
        sources: sources.map((source) => ({
          kind: source.kind,
          id: source.id,
          title: source.title || source.id,
          availability: source.id.includes('deleted') ? 'unavailable' : 'available',
          ...(source.id.includes('deleted') ? { reason: 'deleted' } : {}),
        })),
      };
    },
    validateReply: (content, citations) => ({ content, citations }),
  };
  const llm = {
    generate: async () => {
      state.providerCalls += 1;
      return { text: 'Deterministic verification evidence.' };
    },
  };
  return { state, service: new AcademicWorkspaceService(prisma, llm, sourceEngine) };
}

function fullBrief() {
  return {
    version: 1,
    fields: Object.fromEntries(shared.WORKSPACE_BRIEF_FIELDS.map((field) => [field, `Required ${field}`])),
  };
}

function seedWorkspace(state, {
  id = `workspace-${state.workspaces.length + 1}`,
  userId = 'owner',
  template = 'assignment',
  phase = 'FINALIZATION',
  title = 'Final academic work',
  draftContent = '# Final section\n\nLearner-authored content.',
  sources = [],
  assistantHistory = [],
  configureTools,
} = {}) {
  const plan = shared.workspaceDefaultPlan(template).map((item) => ({ ...item, completed: true }));
  const professor = shared.initialWorkspaceProfessorState(0, 'seed-fingerprint');
  professor.currentPhase = phase;
  const tools = shared.initialWorkspaceToolState();
  if (configureTools) configureTools(tools);
  const progress = shared.workspaceProgressFromPlan(plan, {
    version: 1,
    brief: fullBrief(),
    professor,
    tools,
  });
  const sessionId = `session-${id}`;
  const row = {
    id,
    userId,
    title,
    template,
    objective: 'Complete the learner academic work.',
    dueAt: null,
    status: 'active',
    mode: 'guide',
    sources,
    plan,
    draftFormat: 'markdown',
    draftContent,
    assistantHistory,
    progress,
    autosaveRevision: 0,
    experienceSessionId: sessionId,
    resumeTarget: { kind: 'workspace', id, path: `/library/workspace/${id}` },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.workspaces.push(row);
  state.sessions.push({
    id: sessionId,
    userId,
    type: 'workspace',
    status: 'active',
    workspaceRef: id,
    version: 1,
    pausedAt: null,
    completedAt: null,
    updatedAt: new Date(),
  });
  return row;
}

function finalizeRequest(overrides = {}) {
  return { requestId: 'aw8-finalize-0001', expectedRevision: 0, ...overrides };
}

test('AW-8 exposes authenticated completion, finalization, export, archive and restore routes', () => {
  assert.match(controllerSource, /@UseGuards\(JwtAccessGuard\)/);
  assert.match(controllerSource, /@Get\(':id\/completion'\)/);
  assert.match(controllerSource, /@Post\(':id\/finalize'\)/);
  assert.match(controllerSource, /@Post\(':id\/exports'\)/);
  assert.match(controllerSource, /@Post\(':id\/archive'\)/);
  assert.match(controllerSource, /@Post\(':id\/restore'\)/);
});

test('AW-8 finalizes and deterministically exports all six shells without a provider call', async () => {
  const { service, state } = createHarness();
  for (const template of ['assignment', 'memoire', 'dissertation', 'article', 'report', 'other']) {
    const row = seedWorkspace(state, { id: `workspace-${template}`, template });
    const finalized = await service.finalize('owner', row.id, finalizeRequest({
      requestId: `aw8-finalize-${template}`,
    }));
    assert.equal(finalized.status, 'completed');
    assert.equal(finalized.revision, 1);
    assert.equal(finalized.snapshot.shell, shared.workspaceShellFromTemplate(template));
    assert.equal(finalized.snapshot.version, 1);
    assert.equal(row.autosaveRevision, 1);
    const exported = await service.export('owner', row.id, {
      requestId: `aw8-export-${template}`,
      snapshotId: finalized.snapshot.id,
      format: 'markdown',
      locale: 'fr',
    });
    assert.match(exported.content, /Learner-authored content/);
  }
  assert.equal(state.providerCalls, 0);
});

test('AW-8 rejects stale, foreign and wrong-phase finalization and blocks PATCH bypasses', async () => {
  const { service, state } = createHarness();
  const wrongPhase = seedWorkspace(state, { phase: 'WORK' });
  await assert.rejects(
    service.finalize('owner', wrongPhase.id, finalizeRequest()),
    (error) => status(error) === 400 && code(error) === 'workspace_finalization_gate_failed',
  );
  const ready = seedWorkspace(state, { id: 'workspace-ready' });
  ready.autosaveRevision = 3;
  await assert.rejects(
    service.finalize('owner', ready.id, finalizeRequest({ expectedRevision: 2 })),
    (error) => status(error) === 409 && code(error) === 'workspace_revision_conflict',
  );
  const legacyUpdated = await service.update('owner', ready.id, { title: 'Legacy client mutation' });
  assert.equal(legacyUpdated.autosaveRevision, 4);
  await assert.rejects(
    service.finalize('owner', ready.id, finalizeRequest({
      requestId: 'aw8-finalize-stale-after-legacy-patch',
      expectedRevision: 3,
    })),
    (error) => status(error) === 409 && code(error) === 'workspace_revision_conflict',
  );
  await assert.rejects(service.finalize('intruder', ready.id, finalizeRequest({ expectedRevision: 3 })), (error) => status(error) === 404);
  await assert.rejects(service.update('owner', ready.id, { status: 'completed' }), (error) => status(error) === 400);
  await assert.rejects(service.update('owner', ready.id, { status: 'archived' }), (error) => status(error) === 400);
});

test('AW-8 atomically saves a dirty draft, advances revision and rejects a stale editor', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const finalized = await service.finalize('owner', row.id, finalizeRequest({
    draft: { format: 'markdown', content: '# Saved final\n\nNewest local content.' },
  }));
  assert.equal(finalized.snapshot.draft.content, '# Saved final\n\nNewest local content.');
  assert.equal(finalized.snapshot.revision, 1);
  assert.equal(row.draftContent, finalized.snapshot.draft.content);
  assert.equal(row.autosaveRevision, 1);
  await assert.rejects(
    service.autosave('owner', row.id, {
      workspaceId: row.id,
      expectedRevision: 0,
      draft: { format: 'markdown', content: 'Stale tab content.' },
    }),
    (error) => status(error) === 409,
  );
  assert.equal(row.draftContent, finalized.snapshot.draft.content);
});

test('AW-8 finalization is idempotent, avoids false versions and preserves old snapshots', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const request = finalizeRequest();
  const first = await service.finalize('owner', row.id, request);
  const replay = await service.finalize('owner', row.id, request);
  assert.equal(replay.snapshot.id, first.snapshot.id);
  assert.equal(row.progress.workflow.completion.snapshots.length, 1);
  assert.equal(row.autosaveRevision, 1);

  const duplicate = await service.finalize('owner', row.id, {
    requestId: 'aw8-finalize-no-change',
    expectedRevision: 1,
  });
  assert.equal(duplicate.snapshot.id, first.snapshot.id);
  assert.equal(row.progress.workflow.completion.snapshots.length, 1);
  assert.equal(row.autosaveRevision, 1);

  const originalContent = first.snapshot.draft.content;
  const resumed = await service.update('owner', row.id, { status: 'active', expectedRevision: 1 });
  assert.equal(resumed.professor.currentPhase, 'WORK');
  const saved = await service.autosave('owner', row.id, {
    workspaceId: row.id,
    expectedRevision: resumed.autosaveRevision,
    draft: { format: 'markdown', content: '# Version two\n\nA later learner revision.' },
  });
  await assert.rejects(
    service.finalize('owner', row.id, {
      requestId: 'aw8-finalize-before-verification',
      expectedRevision: saved.revision,
    }),
    (error) => status(error) === 400 && code(error) === 'workspace_finalization_gate_failed',
  );
  await service.transition('owner', row.id, {
    requestId: 'aw8-revision-work-verification',
    expectedPhase: 'WORK',
    requestedPhase: 'VERIFICATION',
    expectedRevision: saved.revision,
  });
  await service.assist('owner', row.id, {
    requestId: 'aw8-revision-verification-evidence',
    expectedPhase: 'VERIFICATION',
    expectedRevision: saved.revision,
    action: 'check-coherence',
    message: 'Verify the revised learner work.',
  });
  await service.transition('owner', row.id, {
    requestId: 'aw8-revision-verification-finalization',
    expectedPhase: 'VERIFICATION',
    requestedPhase: 'FINALIZATION',
    expectedRevision: saved.revision,
  });
  const second = await service.finalize('owner', row.id, {
    requestId: 'aw8-finalize-version-two',
    expectedRevision: saved.revision,
  });
  assert.equal(second.snapshot.version, 2);
  assert.equal(second.snapshot.revision, saved.revision + 1);
  const current = state.workspaces.find((item) => item.id === row.id);
  assert.equal(current.progress.workflow.completion.snapshots[0].draft.content, originalContent);
  assert.equal(current.progress.workflow.completion.snapshots[1].draft.content, current.draftContent);
});

test('AW-8 keeps a completed Workspace read-only until an explicit revisioned resume', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const finalized = await service.finalize('owner', row.id, finalizeRequest());
  const readonlyError = (error) => status(error) === 409 && code(error) === 'workspace_completed_read_only';

  await assert.rejects(service.update('owner', row.id, {
    expectedRevision: finalized.revision,
    title: 'Mutation without resume',
  }), readonlyError);
  await assert.rejects(service.autosave('owner', row.id, {
    workspaceId: row.id,
    expectedRevision: finalized.revision,
    draft: { format: 'markdown', content: 'Mutation without resume.' },
  }), readonlyError);
  await assert.rejects(service.finalize('owner', row.id, {
    requestId: 'aw8-completed-dirty-finalize',
    expectedRevision: finalized.revision,
    draft: { format: 'markdown', content: 'Mutation hidden in finalization.' },
  }), readonlyError);
  await assert.rejects(service.assist('owner', row.id, {
    requestId: 'aw8-completed-assist',
    expectedPhase: 'FINALIZATION',
    expectedRevision: finalized.revision,
    action: 'suggest',
    message: 'Mutate without resume.',
  }), readonlyError);
  await assert.rejects(service.transition('owner', row.id, {
    requestId: 'aw8-completed-transition',
    expectedPhase: 'FINALIZATION',
    requestedPhase: 'DECONSTRUCTION',
    expectedRevision: finalized.revision,
  }), readonlyError);
  await assert.rejects(service.executeTool('owner', row.id, 'assignment-check-answer', {
    requestId: 'aw8-completed-tool',
    expectedRevision: finalized.revision,
    selectedText: 'Read-only final text.',
  }), readonlyError);
  assert.equal(state.providerCalls, 0);

  const resumed = await service.update('owner', row.id, {
    status: 'active',
    expectedRevision: finalized.revision,
  });
  assert.equal(resumed.status, 'active');
  assert.equal(resumed.autosaveRevision, finalized.revision + 1);
  const saved = await service.autosave('owner', row.id, {
    workspaceId: row.id,
    expectedRevision: resumed.autosaveRevision,
    draft: { format: 'markdown', content: '# Revised work\n\nLearner revision after explicit resume.' },
  });
  assert.equal(saved.revision, resumed.autosaveRevision + 1);
  assert.equal(row.progress.workflow.completion.snapshots.length, 1);
});

test('AW-8 snapshots only verified AW-6 history and applied AW-7 citations', async () => {
  const { service, state } = createHarness();
  const citation = (label, sourceId) => ({
    citationLabel: label,
    sourceType: 'document',
    sourceId,
    documentId: sourceId,
    title: `Source ${sourceId}`,
    snippet: `Verified ${sourceId}`,
    page: 2,
  });
  const row = seedWorkspace(state, {
    sources: [{ kind: 'document', id: 'document-owned', title: 'Owned' }],
    assistantHistory: [{
      id: 'reply-1', role: 'assistant', content: 'Grounded [W1].', createdAt: new Date().toISOString(),
      citations: [citation('W1', 'history-source')],
    }],
    configureTools: (tools) => {
      tools.operations.push(
        {
          requestId: 'applied-tool', requestFingerprint: 'a', toolId: 'assignment-check-answer', status: 'applied',
          phase: 'FINALIZATION', phaseSequence: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), baseRevision: 0,
          proposal: {
            id: 'proposal-applied', requestId: 'applied-tool', toolId: 'assignment-check-answer', content: 'Applied',
            baseRevision: 0, phase: 'FINALIZATION', phaseSequence: 0, status: 'ready',
            provenance: { userContent: true, sourceGrounded: true, modelSuggestion: true },
            citations: [citation('W2', 'applied-source')], createdAt: new Date().toISOString(),
          },
        },
        {
          requestId: 'pending-tool', requestFingerprint: 'b', toolId: 'assignment-check-answer', status: 'completed',
          phase: 'FINALIZATION', phaseSequence: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), baseRevision: 0,
          proposal: {
            id: 'proposal-pending', requestId: 'pending-tool', toolId: 'assignment-check-answer', content: 'Not applied',
            baseRevision: 0, phase: 'FINALIZATION', phaseSequence: 0, status: 'ready',
            provenance: { userContent: true, sourceGrounded: true, modelSuggestion: true },
            citations: [citation('W999', 'unapplied-source')], createdAt: new Date().toISOString(),
          },
        },
        {
          requestId: 'deleted-tool', requestFingerprint: 'c', toolId: 'assignment-check-answer', status: 'applied',
          phase: 'FINALIZATION', phaseSequence: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), baseRevision: 0,
          proposal: {
            id: 'proposal-deleted', requestId: 'deleted-tool', toolId: 'assignment-check-answer', content: 'Deleted evidence',
            baseRevision: 0, phase: 'FINALIZATION', phaseSequence: 0, status: 'ready',
            provenance: { userContent: true, sourceGrounded: true, modelSuggestion: true },
            citations: [citation('W3', 'document-deleted')], createdAt: new Date().toISOString(),
          },
          appliedAt: new Date().toISOString(), appliedRevision: 0, applicationFingerprint: 'deleted',
        },
      );
    },
  });
  const result = await service.finalize('owner', row.id, finalizeRequest());
  assert.deepEqual(result.snapshot.citations.map((item) => item.sourceId).sort(), ['applied-source', 'history-source']);
  assert.equal(result.snapshot.citations.some((item) => item.sourceId === 'unapplied-source'), false);
  assert.equal(result.snapshot.citations.some((item) => item.sourceId === 'document-deleted'), false);
});

test('AW-8 exports UTF-8/RTL safely and strips hostile HTML and URL schemes', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state, {
    title: 'بحث أكاديمي',
    draftContent: '# مقدمة\n\n<script>alert(1)</script>\n\n[خطر](javascript:alert(2))\n\nنص عربي موثوق.',
  });
  const finalized = await service.finalize('owner', row.id, finalizeRequest());
  const pdf = await service.export('owner', row.id, {
    requestId: 'aw8-export-pdf-rtl', snapshotId: finalized.snapshot.id, format: 'pdf', locale: 'ar',
  });
  assert.equal(pdf.mimeType, 'application/pdf');
  assert.match(pdf.html, /<html lang="ar" dir="rtl">/);
  assert.match(pdf.html, /&lt;script&gt;/);
  assert.doesNotMatch(pdf.html, /<script|<iframe|javascript:/i);
  assert.match(pdf.html, /نص عربي موثوق/);
  const markdown = await service.export('owner', row.id, {
    requestId: 'aw8-export-markdown-rtl', snapshotId: finalized.snapshot.id, format: 'markdown', locale: 'ar',
  });
  assert.match(markdown.content, /نص عربي موثوق/);
  assert.doesNotMatch(markdown.content, /javascript:/i);
  assert.equal(state.providerCalls, 0);
});

test('AW-8 archive closes Resume; restore creates a new session and preserves immutable snapshots', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const originalSessionId = row.experienceSessionId;
  const finalized = await service.finalize('owner', row.id, finalizeRequest());
  const archived = await service.archive('owner', row.id, {
    requestId: 'aw8-archive-0001', expectedRevision: finalized.revision,
  });
  assert.equal(archived.revision, 2);
  assert.equal(row.status, 'archived');
  assert.equal(state.sessions.find((item) => item.id === originalSessionId).status, 'abandoned');
  assert.equal((await service.list('owner')).items.some((item) => item.id === row.id), false);
  await assert.rejects(
    service.autosave('owner', row.id, {
      workspaceId: row.id, expectedRevision: 2, draft: { format: 'markdown', content: 'Archived mutation.' },
    }),
    (error) => status(error) === 409 && code(error) === 'workspace_archived_read_only',
  );
  const restored = await service.restore('owner', row.id, {
    requestId: 'aw8-restore-0001', expectedRevision: 2,
  });
  const current = state.workspaces.find((item) => item.id === row.id);
  assert.equal(restored.revision, 3);
  assert.equal(current.status, 'active');
  assert.notEqual(current.experienceSessionId, originalSessionId);
  assert.equal(state.sessions.find((item) => item.id === originalSessionId).status, 'abandoned');
  assert.equal(state.sessions.find((item) => item.id === current.experienceSessionId).status, 'active');
  assert.equal(current.progress.workflow.completion.snapshots.length, 1);
  assert.equal(current.progress.workflow.completion.snapshots[0].id, finalized.snapshot.id);
  assert.equal((await service.list('owner')).items.some((item) => item.id === current.id), true);
  await assert.rejects(
    service.autosave('owner', row.id, {
      workspaceId: row.id, expectedRevision: 1, draft: { format: 'markdown', content: 'Pre-archive stale tab.' },
    }),
    (error) => status(error) === 409,
  );
});

test('AW-8 keeps deleted sources explicit without fabricating a replacement', async () => {
  const { service, state } = createHarness();
  const internalSourceId = '550e8400-e29b-41d4-a716-446655440000-deleted';
  const row = seedWorkspace(state, {
    sources: [{ kind: 'document', id: internalSourceId }],
  });
  const finalized = await service.finalize('owner', row.id, finalizeRequest());
  assert.equal(finalized.snapshot.sourceStates[0].availability, 'unavailable');
  assert.equal(finalized.snapshot.sourceStates[0].reason, 'deleted');
  assert.deepEqual(finalized.snapshot.citations, []);
  const exported = await service.export('owner', row.id, {
    requestId: 'aw8-export-deleted-source', snapshotId: finalized.snapshot.id, format: 'markdown', locale: 'fr',
  });
  assert.doesNotMatch(exported.content, new RegExp(internalSourceId));
  assert.equal(state.providerCalls, 0);
});
