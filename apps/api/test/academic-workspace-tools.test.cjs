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
const serviceSource = fs.readFileSync(
  path.join(ROOT, 'apps/api/src/workspaces/academic-workspace.service.ts'),
  'utf8',
);

const EXPECTED_SHELLS = [
  'assignment',
  'thesis',
  'dissertation',
  'article',
  'report',
  'general',
];

const EXPECTED_TOOL_COUNTS = {
  assignment: 4,
  thesis: 5,
  dissertation: 5,
  article: 5,
  report: 5,
  general: 4,
};

const EXPECTED_TOOL_IDS = [
  'assignment-check-answer',
  'assignment-explain-error',
  'assignment-compare-instructions',
  'assignment-improve-clarity',
  'thesis-check-problem',
  'thesis-check-plan',
  'thesis-examine-section',
  'thesis-check-source-support',
  'thesis-find-sources',
  'dissertation-analyze-thesis',
  'dissertation-identify-counterargument',
  'dissertation-check-argument-logic',
  'dissertation-check-transition',
  'dissertation-check-dialectic',
  'article-check-scientific-structure',
  'article-check-abstract',
  'article-check-method-results',
  'article-check-discussion-results',
  'article-find-unsupported-claims',
  'report-check-objectives-results',
  'report-check-observations-recommendations',
  'report-identify-missing-sections',
  'report-improve-section-clarity',
  'report-check-overall-coherence',
  'general-analyze',
  'general-check-structure',
  'general-improve-clarity',
  'general-check-sources',
];

function registry() {
  assert.ok(
    Array.isArray(shared.WORKSPACE_TOOL_REGISTRY),
    'the shared package must export WORKSPACE_TOOL_REGISTRY',
  );
  return shared.WORKSPACE_TOOL_REGISTRY;
}

test('AW-7 registry is static, complete, unique and covers the six shells', () => {
  const tools = registry();
  assert.equal(tools.length, 28);
  assert.equal(new Set(tools.map((tool) => tool.toolId)).size, tools.length);
  assert.deepEqual(
    tools.map((tool) => tool.toolId).sort(),
    [...EXPECTED_TOOL_IDS].sort(),
  );

  for (const tool of tools) {
    assert.match(tool.toolId, /^[a-z][a-z0-9-]+$/);
    assert.equal(typeof tool.labelKey, 'string');
    assert.ok(tool.labelKey.length > 0);
    assert.ok(Array.isArray(tool.allowedShells) && tool.allowedShells.length > 0);
    assert.ok(Array.isArray(tool.allowedPhases) && tool.allowedPhases.length > 0);
    assert.ok(['ANALYZE', 'CHECK', 'SUGGEST', 'TRANSFORM'].includes(tool.operationType));
    assert.equal(typeof tool.requiresSources, 'boolean');
    assert.equal(typeof tool.requiresSelection, 'boolean');
    assert.equal(typeof tool.costClass, 'string');
    assert.ok(tool.costClass.length > 0);
    assert.equal(tool.allowedPhases.includes('DECONSTRUCTION'), false);
  }

  for (const shell of EXPECTED_SHELLS) {
    const count = tools.filter((tool) => tool.allowedShells.includes(shell)).length;
    assert.equal(count, EXPECTED_TOOL_COUNTS[shell], `${shell} must expose its V1 tool set only`);
  }

  assert.equal(shared.workspaceToolById('thesis-check-source-support').requiresSources, true);
  assert.equal(shared.workspaceToolById('article-find-unsupported-claims').requiresSources, true);
  assert.equal(shared.workspaceToolById('assignment-check-answer').requiresSelection, true);
  assert.equal(shared.workspaceToolById('report-improve-section-clarity').operationType, 'TRANSFORM');
});

test('AW-7 registry helpers reject unknown tools and incompatible shell or phase', () => {
  assert.equal(typeof shared.workspaceToolById, 'function');
  assert.equal(typeof shared.workspaceToolsFor, 'function');
  const assignment = shared.workspaceToolsFor('assignment', 'VERIFICATION');
  assert.ok(assignment.length > 0);
  assert.ok(assignment.every((tool) => tool.allowedShells.includes('assignment')));
  assert.ok(assignment.every((tool) => tool.allowedPhases.includes('VERIFICATION')));

  const example = assignment[0];
  assert.equal(shared.workspaceToolById(example.toolId)?.toolId, example.toolId);
  assert.equal(shared.workspaceToolsFor('article', 'VERIFICATION').some((tool) => tool.toolId === example.toolId), false);
  assert.equal(shared.workspaceToolsFor('assignment', 'DECONSTRUCTION').length, 0);
  assert.equal(shared.workspaceToolById('unknown-tool-id') == null, true);
});

test('AW-7 exposes authenticated list, execute, apply and reject routes', () => {
  assert.match(controllerSource, /@UseGuards\(JwtAccessGuard\)/);
  assert.match(controllerSource, /@Get\(':id\/tools'\)/);
  assert.match(controllerSource, /@Post\(':id\/tools\/:toolId'\)/);
  assert.match(controllerSource, /@Post\(':id\/tools\/:toolId\/apply'\)/);
  assert.match(controllerSource, /@Post\(':id\/tools\/:toolId\/reject'\)/);
});

test('AW-7 proposals reuse AW-6 and never mutate the draft implicitly', () => {
  assert.match(serviceSource, /sourceEngine\.(?:query|resolve)\(/);
  assert.match(serviceSource, /operation:\s*'workspace-assistant'/);
  assert.match(serviceSource, /toolId/);
  assert.match(serviceSource, /expectedRevision/);

  const executionStart = serviceSource.indexOf('async executeTool(');
  const executionEnd = serviceSource.indexOf('async applyToolProposal(', executionStart);
  assert.ok(executionStart >= 0 && executionEnd > executionStart, 'a bounded Workspace tool execution method must exist');
  const executionBlock = serviceSource.slice(executionStart, executionEnd);
  assert.doesNotMatch(executionBlock, /draftContent\s*:/);
  assert.doesNotMatch(executionBlock, /academicWorkspace\.update(?:Many)?\([\s\S]*draftContent/);
});

test('AW-7 keeps application on the existing revision-checked autosave path', () => {
  assert.match(controllerSource, /@Patch\(':id\/autosave'\)/);
  assert.match(serviceSource, /request\.expectedRevision\s*!==\s*row\.autosaveRevision/);
  assert.match(serviceSource, /workspace_revision_conflict|throwWorkspaceRevisionConflict/);
});

function status(error) {
  return typeof error?.getStatus === 'function' ? error.getStatus() : error?.status;
}

function responseCode(error) {
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
    documents: [
      { id: 'document-owner', userId: 'owner', deletedAt: null },
      { id: 'document-deleted', userId: 'owner', deletedAt: new Date() },
      { id: 'document-intruder', userId: 'intruder', deletedAt: null },
    ],
    collections: [],
    providerCalls: 0,
    sourceCalls: 0,
    providerError: null,
    sourceError: null,
    llmResponse: 'A bounded, actionable proposal supported by [W1].',
  };
  let transactionTail = Promise.resolve();

  const academicWorkspace = {
    findFirst: async ({ where }) => state.workspaces.find((row) => matchesWhere(row, where)) ?? null,
    findUnique: async ({ where }) => state.workspaces.find((row) => matchesWhere(row, where)) ?? null,
    updateMany: async ({ where, data }) => {
      const rows = state.workspaces.filter((row) => matchesWhere(row, where));
      rows.forEach((row) => applyData(row, data));
      return { count: rows.length };
    },
    update: async ({ where, data }) => {
      const row = state.workspaces.find((candidate) => matchesWhere(candidate, where));
      if (!row) throw new Error('WORKSPACE_NOT_FOUND');
      return applyData(row, data);
    },
  };
  const tx = {
    academicWorkspace,
    document: {
      count: async ({ where }) => state.documents.filter((row) => matchesWhere(row, where)).length,
      findMany: async ({ where }) => state.documents
        .filter((row) => matchesWhere(row, where))
        .map(({ userId }) => ({ userId })),
    },
    collection: {
      count: async ({ where }) => state.collections.filter((row) => matchesWhere(row, where)).length,
      findMany: async ({ where }) => state.collections
        .filter((row) => matchesWhere(row, where))
        .map(({ userId }) => ({ userId })),
    },
    experienceSession: {
      findFirst: async () => null,
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    $executeRaw: async () => 1,
  };
  const prisma = {
    ...tx,
    profile: { findUnique: async () => ({ preferredLanguage: 'en' }) },
    $transaction: (operation) => {
      const run = transactionTail.then(async () => {
        const snapshot = structuredClone(state.workspaces);
        try {
          return await operation(tx);
        } catch (error) {
          state.workspaces.splice(0, state.workspaces.length, ...snapshot);
          throw error;
        }
      });
      transactionTail = run.catch(() => undefined);
      return run;
    },
  };
  const citations = [{
    citationLabel: 'W1',
    sourceType: 'document',
    sourceId: 'document-owner',
    documentId: 'document-owner',
    title: 'Owned source',
    snippet: 'Server-owned evidence excerpt.',
    page: 2,
  }];
  const sourceEngine = {
    resolve: async (_userId, sources) => {
      state.sourceCalls += 1;
      if (state.sourceError) throw state.sourceError;
      const available = sources.length > 0 && sources.some((source) => source.id === 'document-owner');
      return {
        context: available ? '<workspace-evidence id="W1">Server-owned evidence excerpt.</workspace-evidence>' : '',
        citations: available ? citations : [],
        sources: sources.map((source) => ({
          ...source,
          availability: available ? 'available' : 'unavailable',
        })),
        usedContext: available,
      };
    },
    validateReply: (content, allowed) => ({
      content: content.replace(/\[W\d+\]/g, (label) => (
        allowed.some((citation) => `[${citation.citationLabel}]` === label) ? label : ''
      )).trim(),
      citations: allowed.filter((citation) => content.includes(`[${citation.citationLabel}]`)),
    }),
    query: async () => ({ sources: [], citations: [], context: '', usedContext: false }),
  };
  const llm = {
    generate: async () => {
      state.providerCalls += 1;
      if (state.providerError) throw state.providerError;
      return { text: state.llmResponse };
    },
  };
  return {
    state,
    service: new AcademicWorkspaceService(prisma, llm, sourceEngine),
  };
}

function seedWorkspace(state, {
  id = `workspace-${state.workspaces.length + 1}`,
  userId = 'owner',
  template = 'assignment',
  phase = 'WORK',
  sources = [{ kind: 'document', id: 'document-owner', title: 'Owned source' }],
  draftContent = 'Learner-authored draft.',
} = {}) {
  const plan = shared.workspaceDefaultPlan(template);
  const professor = shared.initialWorkspaceProfessorState(0, 'draft-fingerprint');
  professor.currentPhase = phase;
  const progress = shared.workspaceProgressFromPlan(plan, {
    version: 1,
    brief: { version: 1, fields: { subject: 'Academic test' } },
    professor,
    tools: shared.initialWorkspaceToolState(),
  });
  const row = {
    id,
    userId,
    title: 'AW-7 deterministic test',
    template,
    objective: 'Review existing learner work.',
    dueAt: null,
    status: 'active',
    mode: 'guide',
    sources,
    plan,
    draftFormat: 'markdown',
    draftContent,
    progress,
    assistantHistory: [],
    autosaveRevision: 0,
    experienceSessionId: null,
    resumeTarget: { kind: 'workspace', id, path: `/library/workspace/${id}` },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  state.workspaces.push(row);
  return row;
}

function executeRequest(overrides = {}) {
  return {
    requestId: 'aw7-tool-request-0001',
    expectedRevision: 0,
    selectedText: 'The selected learner paragraph.',
    ...overrides,
  };
}

test('AW-7 executes one representative tool for each shell without changing draft or phase', async () => {
  const { service, state } = createHarness();
  const scenarios = [
    ['assignment', 'WORK', 'assignment-check-answer'],
    ['memoire', 'METHOD', 'thesis-check-problem'],
    ['dissertation', 'WORK', 'dissertation-analyze-thesis'],
    ['article', 'METHOD', 'article-check-scientific-structure'],
    ['report', 'VERIFICATION', 'report-check-objectives-results'],
    ['other', 'WORK', 'general-analyze'],
  ];

  for (const [template, phase, toolId] of scenarios) {
    const row = seedWorkspace(state, { id: `workspace-${template}`, template, phase });
    const beforeDraft = row.draftContent;
    const result = await service.executeTool(
      'owner',
      row.id,
      toolId,
      executeRequest({ requestId: `aw7-${template}-request` }),
    );
    assert.equal(result.proposal.toolId, toolId);
    assert.equal(result.proposal.phase, phase);
    assert.equal(result.proposal.status, 'ready');
    assert.equal(result.proposal.citations[0].citationLabel, 'W1');
    assert.equal(row.draftContent, beforeDraft);
    assert.equal(row.progress.workflow.professor.currentPhase, phase);
  }

  assert.equal(state.providerCalls, scenarios.length);
});

test('AW-7 enforces ownership, known tool, shell, phase, selection and owned sources before provider use', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state, { template: 'assignment', phase: 'WORK' });

  await assert.rejects(service.listTools('intruder', row.id), (error) => status(error) === 404);
  await assert.rejects(
    service.executeTool('owner', row.id, 'unknown-tool', executeRequest()),
    (error) => status(error) === 400 && responseCode(error) === 'workspace_tool_unknown',
  );
  await assert.rejects(
    service.executeTool('owner', row.id, 'article-check-scientific-structure', executeRequest()),
    (error) => status(error) === 400 && responseCode(error) === 'workspace_tool_shell_not_allowed',
  );
  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-compare-instructions', executeRequest()),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_phase_not_allowed',
  );
  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest({ selectedText: '' })),
    (error) => status(error) === 400 && responseCode(error) === 'workspace_tool_selection_required',
  );

  const thesis = seedWorkspace(state, { id: 'workspace-thesis-no-source', template: 'memoire', phase: 'VERIFICATION', sources: [] });
  await assert.rejects(
    service.executeTool('owner', thesis.id, 'thesis-check-source-support', executeRequest({ requestId: 'aw7-no-source-request' })),
    (error) => status(error) === 400 && responseCode(error) === 'workspace_tool_sources_required',
  );

  const foreign = seedWorkspace(state, {
    id: 'workspace-foreign-source', template: 'memoire', phase: 'VERIFICATION',
    sources: [{ kind: 'document', id: 'document-intruder', title: 'Foreign source' }],
  });
  await assert.rejects(
    service.executeTool('owner', foreign.id, 'thesis-check-source-support', executeRequest({ requestId: 'aw7-foreign-source' })),
    (error) => status(error) === 400,
  );
  assert.equal(state.providerCalls, 0);
});

test('AW-7 never fabricates citations and a deleted source degrades before the provider', async () => {
  const { service, state } = createHarness();
  state.llmResponse = 'General model suggestion with invented [W999].';
  const unsourced = seedWorkspace(state, { sources: [] });
  const result = await service.executeTool(
    'owner', unsourced.id, 'assignment-check-answer', executeRequest(),
  );
  assert.deepEqual(result.proposal.citations, []);
  assert.equal(result.proposal.provenance.sourceGrounded, false);
  assert.equal(result.proposal.content.includes('[W999]'), false);

  const deleted = seedWorkspace(state, {
    id: 'workspace-deleted-source', template: 'memoire', phase: 'VERIFICATION',
    sources: [{ kind: 'document', id: 'document-deleted', title: 'Deleted source' }],
  });
  const deletedResult = await service.executeTool(
    'owner', deleted.id, 'thesis-check-source-support', executeRequest({ requestId: 'aw7-deleted-source' }),
  );
  assert.equal(deletedResult.proposal.status, 'source-unavailable');
  assert.equal(deletedResult.proposal.content, '');
  assert.deepEqual(deletedResult.proposal.citations, []);
  assert.equal(state.providerCalls, 1);
});

test('AW-7 reject is idempotent and leaves the learner draft untouched', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  await service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest());
  const original = row.draftContent;

  const rejected = await service.rejectToolProposal('owner', row.id, 'assignment-check-answer', {
    requestId: 'aw7-tool-request-0001',
  });
  const replay = await service.rejectToolProposal('owner', row.id, 'assignment-check-answer', {
    requestId: 'aw7-tool-request-0001',
  });
  assert.equal(rejected.proposalStatus, 'rejected');
  assert.deepEqual(replay, rejected);
  assert.equal(row.draftContent, original);
  assert.equal(row.autosaveRevision, 0);
});

test('AW-7 applies explicitly once and rejects stale proposals without overwriting newer work', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  await service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest());
  const apply = {
    requestId: 'aw7-tool-request-0001',
    expectedRevision: 0,
    draft: { format: 'markdown', content: 'Learner-approved proposal insertion.' },
  };
  const applied = await service.applyToolProposal('owner', row.id, 'assignment-check-answer', apply);
  const replay = await service.applyToolProposal('owner', row.id, 'assignment-check-answer', apply);
  assert.equal(applied.revision, 1);
  assert.equal(replay.revision, 1);
  assert.equal(row.autosaveRevision, 1);
  assert.equal(row.draftContent, apply.draft.content);

  const stale = seedWorkspace(state, { id: 'workspace-stale-proposal' });
  await service.executeTool(
    'owner', stale.id, 'assignment-check-answer', executeRequest({ requestId: 'aw7-stale-request' }),
  );
  stale.draftContent = 'A newer tab saved this text.';
  stale.autosaveRevision = 1;
  await assert.rejects(
    service.applyToolProposal('owner', stale.id, 'assignment-check-answer', {
      requestId: 'aw7-stale-request',
      expectedRevision: 1,
      draft: { format: 'markdown', content: 'Must not overwrite newer text.' },
    }),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_revision_conflict',
  );
  assert.equal(stale.draftContent, 'A newer tab saved this text.');
});

test('AW-7 apply preserves the existing completion evidence invariant', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  await service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest());

  row.status = 'completed';
  row.plan = row.plan.map((item) => ({ ...item, completed: true }));
  row.progress.workflow.brief.fields.requirements = 'Keep all required completion evidence.';
  row.progress = shared.workspaceProgressFromPlan(row.plan, row.progress.workflow);

  await assert.rejects(
    service.applyToolProposal('owner', row.id, 'assignment-check-answer', {
      requestId: 'aw7-tool-request-0001',
      expectedRevision: 0,
      draft: { format: 'markdown', content: '' },
    }),
    (error) => status(error) === 400,
  );
  assert.equal(row.status, 'completed');
  assert.equal(row.autosaveRevision, 0);
  assert.equal(row.draftContent, 'Learner-authored draft.');
});

test('AW-7 execution idempotency replays without a second provider or AW-6 retrieval', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const first = await service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest());
  const replay = await service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest());
  assert.equal(replay.proposal.id, first.proposal.id);
  assert.equal(state.providerCalls, 1);
  assert.equal(state.sourceCalls, 1);

  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest({ selectedText: 'Different input.' })),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_idempotency_conflict',
  );
  assert.equal(state.providerCalls, 1);
});

test('AW-7 compact receipts block replay after the 20-entry proposal journal is evicted', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  let first;
  for (let index = 0; index < 21; index += 1) {
    const request = executeRequest({ requestId: `aw7-durable-${String(index).padStart(4, '0')}` });
    const result = await service.executeTool('owner', row.id, 'assignment-check-answer', request);
    if (index === 0) first = { request, proposalId: result.proposal.id };
  }

  assert.equal(row.progress.workflow.tools.operations.length, 20);
  assert.equal(row.progress.workflow.tools.operations.some((item) => item.requestId === first.request.requestId), false);
  assert.equal(Object.keys(row.progress.workflow.tools.requestLedger).length, 21);
  const receipt = row.progress.workflow.tools.requestLedger[
    require('node:crypto').createHash('sha256').update(first.request.requestId).digest('hex')
  ];
  assert.deepEqual(Object.keys(receipt).sort(), ['requestFingerprint', 'status', 'toolId', 'updatedAt']);

  const providerCalls = state.providerCalls;
  const sourceCalls = state.sourceCalls;
  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-check-answer', first.request),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_idempotency_result_expired',
  );
  assert.equal(state.providerCalls, providerCalls);
  assert.equal(state.sourceCalls, sourceCalls);
});

test('AW-7 checks current phase authorization before replaying a completed request', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const request = executeRequest({ requestId: 'aw7-phase-replay-0001' });
  await service.executeTool('owner', row.id, 'assignment-improve-clarity', request);
  await service.transition('owner', row.id, {
    requestId: 'aw7-phase-to-review-0001',
    expectedPhase: 'WORK',
    requestedPhase: 'VERIFICATION',
    expectedRevision: 0,
  });

  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-improve-clarity', request),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_phase_not_allowed',
  );
  assert.equal(state.providerCalls, 1);
  assert.equal(state.sourceCalls, 1);
});

test('AW-7 rejects apply after WORK to COACHING to WORK at the same draft revision', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  const request = executeRequest({ requestId: 'aw7-phase-sequence-0001' });
  await service.executeTool('owner', row.id, 'assignment-check-answer', request);
  assert.equal(row.progress.workflow.tools.operations[0].phaseSequence, 0);
  assert.equal(row.progress.workflow.tools.operations[0].proposal.phaseSequence, 0);

  await service.transition('owner', row.id, {
    requestId: 'aw7-to-coaching-0001',
    expectedPhase: 'WORK',
    requestedPhase: 'COACHING',
    expectedRevision: 0,
  });
  row.progress.workflow.professor.evidence.push({
    id: 'aw7-coaching-evidence',
    phase: 'COACHING',
    phaseSequence: 1,
    assistantReplyId: 'aw7-coaching-reply',
    action: 'explain',
    createdAt: new Date().toISOString(),
    draftRevision: 0,
  });
  await service.transition('owner', row.id, {
    requestId: 'aw7-back-to-work-0001',
    expectedPhase: 'COACHING',
    requestedPhase: 'WORK',
    expectedRevision: 0,
  });
  assert.equal(row.progress.workflow.professor.currentPhase, 'WORK');
  assert.equal(row.progress.workflow.professor.phaseSequence, 2);
  assert.equal(row.autosaveRevision, 0);

  await assert.rejects(
    service.applyToolProposal('owner', row.id, 'assignment-check-answer', {
      requestId: request.requestId,
      expectedRevision: 0,
      draft: { format: 'markdown', content: 'An obsolete proposal must not apply.' },
    }),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_phase_conflict',
  );
  assert.equal(row.autosaveRevision, 0);
  assert.equal(row.draftContent, 'Learner-authored draft.');
});

test('AW-7 receipt normalization enforces the 256-entry cap and 30-day TTL', () => {
  const { service } = createHarness();
  const requestLedger = {};
  const now = Date.now();
  for (let index = 0; index < 300; index += 1) {
    requestLedger[index.toString(16).padStart(64, '0')] = {
      requestFingerprint: `fingerprint-${index}`,
      toolId: 'assignment-check-answer',
      status: 'completed',
      updatedAt: new Date(now - index * 1_000).toISOString(),
    };
  }
  const expiredKey = 'f'.repeat(64);
  requestLedger[expiredKey] = {
    requestFingerprint: 'expired',
    toolId: 'assignment-check-answer',
    status: 'completed',
    updatedAt: new Date(now - 31 * 24 * 60 * 60 * 1_000).toISOString(),
  };

  const normalized = service.toolState({
    completedSteps: [],
    workflow: {
      version: 1,
      brief: { version: 1, fields: {} },
      tools: { version: 1, operations: [], requestLedger },
    },
  });
  assert.equal(Object.keys(normalized.requestLedger).length, 256);
  assert.equal(normalized.requestLedger[expiredKey], undefined);
});

test('AW-7 provider failure preserves draft, revision, phase and blocks replay of the failed key', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  state.providerError = new Error('provider unavailable');

  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest()),
    /provider unavailable/,
  );
  assert.equal(row.draftContent, 'Learner-authored draft.');
  assert.equal(row.autosaveRevision, 0);
  assert.equal(row.progress.workflow.professor.currentPhase, 'WORK');
  assert.equal(row.progress.workflow.tools.operations[0].status, 'failed');

  await assert.rejects(
    service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest()),
    (error) => status(error) === 409 && responseCode(error) === 'workspace_tool_failed',
  );
  assert.equal(state.providerCalls, 1);
});

test('AW-7 tool journal remains visible and survives an AW-5 Professor transition', async () => {
  const { service, state } = createHarness();
  const row = seedWorkspace(state);
  await service.executeTool('owner', row.id, 'assignment-check-answer', executeRequest());
  const projected = await service.get('owner', row.id);
  assert.equal(projected.progress.workflow.tools.operations.length, 1);

  await service.transition('owner', row.id, {
    requestId: 'aw7-preserve-journal-transition',
    expectedPhase: 'WORK',
    requestedPhase: 'COACHING',
    expectedRevision: 0,
  });
  assert.equal(row.progress.workflow.tools.operations.length, 1);
  assert.equal(row.progress.workflow.tools.operations[0].requestId, 'aw7-tool-request-0001');
});
