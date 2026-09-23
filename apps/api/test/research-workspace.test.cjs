'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ResearchService } = require('../dist/research/research.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function serviceWith({ results = [], brainItems = [], availability = 'unavailable', llmResult } = {}) {
  const calls = [];
  const retrieval = {
    resolveScope: async (userId, scope) => { calls.push({ kind: 'resolve', userId, scope }); return scope.documentIds ?? null; },
    search: async (userId, query, options) => { calls.push({ kind: 'search', userId, query, options }); return { query, results }; },
  };
  const brain = { search: async (userId, query, limit) => { calls.push({ kind: 'brain', userId, query, limit }); return { items: brainItems, nextCursor: null }; } };
  const llm = { generate: async () => ({ text: llmResult ?? JSON.stringify({ synthesis: 'Grounded result', keyPoints: ['Point'], sections: [], comparison: null }) }) };
  const prisma = { profile: { findUnique: async ({ where }) => { calls.push({ kind: 'profile', userId: where.userId }); return { preferredLanguage: 'en' }; } } };
  const provider = {
    name: availability === 'available' ? 'configured-test-provider' : 'disabled',
    availability: async () => ({ status: availability, checkedAt: new Date().toISOString(), capabilities: { webSearch: availability === 'available', sourceMetadata: false, dateFiltering: false, languageFiltering: false } }),
    search: async () => ({ sources: [], citations: [], provider: null }),
  };
  return { service: new ResearchService(retrieval, brain, llm, prisma, provider), calls };
}

test('quick research is grounded, bounded and strips comparison', async () => {
  const { service, calls } = serviceWith({
    results: [{ documentId: 'd1', documentTitle: 'Owned', chunkIndex: 0, content: 'Evidence', score: 0.9 }],
    llmResult: JSON.stringify({ synthesis: 'Answer [document:d1:0]', keyPoints: [], sections: [], comparison: { agreements: ['A'], divergences: [], specificities: [] } }),
  });
  const result = await service.run('user-1', { question: 'Question?', depth: 'quick', scopes: [{ kind: 'library' }] });
  assert.equal(result.citations.length, 1);
  assert.equal(result.comparison, null);
  assert.deepEqual(result.stages.map((stage) => stage.kind), ['sources-found', 'sources-read', 'synthesized']);
  assert.equal(calls.find((call) => call.kind === 'search').userId, 'user-1');
  assert.equal(calls.find((call) => call.kind === 'search').options.limit, 5);
});

test('sourced research distinguishes real comparison fields and citations', async () => {
  const { service } = serviceWith({
    results: [
      { documentId: 'd1', documentTitle: 'One', chunkIndex: 0, content: 'First', score: 0.9 },
      { documentId: 'd2', documentTitle: 'Two', chunkIndex: 2, content: 'Second', score: 0.8 },
    ],
    llmResult: JSON.stringify({ synthesis: 'Synthesis', keyPoints: ['K'], sections: [{ title: 'Section', body: 'Body', citationIds: ['document:d1:0', 'made-up'] }], comparison: { agreements: ['Shared'], divergences: ['Different'], specificities: [] } }),
  });
  const result = await service.run('user-1', { question: 'Compare', depth: 'sourced', scopes: [{ kind: 'library' }] });
  assert.deepEqual(result.sections[0].citationIds, ['document:d1:0']);
  assert.deepEqual(result.comparison.divergences, ['Different']);
  assert.ok(result.stages.some((stage) => stage.kind === 'compared'));
});

test('unconfigured Web never simulates sources or calls the language model', async () => {
  const { service } = serviceWith();
  const result = await service.run('user-1', { question: 'Latest evidence', depth: 'deep', scopes: [{ kind: 'web' }] });
  assert.equal(result.provider, null);
  assert.equal(result.citations.length, 0);
  assert.equal(result.synthesis, '');
  assert.equal(result.partial, true);
  assert.ok(result.limits.includes('research.provider.notConfigured'));
});

test('brain research keeps caller isolation and brain provenance', async () => {
  const { service, calls } = serviceWith({ brainItems: [{ id: 'c1', kind: 'concept', title: 'TCP', detail: 'Transport concept', updatedAt: new Date().toISOString(), destination: { kind: 'concept', id: 'c1' } }] });
  const result = await service.run('owner', { question: 'TCP', depth: 'sourced', scopes: [{ kind: 'brain' }] });
  assert.equal(calls.find((call) => call.kind === 'brain').userId, 'owner');
  assert.equal(result.citations[0].kind, 'brain');
  assert.equal(result.citations[0].conceptId, 'c1');
});

test('Lot 10 screens keep research, production, citations, autosave and transitions distinct', () => {
  const research = read('apps/mobile/app/research.tsx');
  const workspace = read('apps/mobile/app/library/workspace/[id].tsx');
  const home = read('apps/mobile/app/library/workspace/index.tsx');
  const assistant = read('apps/mobile/components/workspace/assistant.tsx');
  const schema = read('apps/api/prisma/schema.prisma');
  assert.match(research, /deep-research-plan/);
  assert.match(research, /SourcePreview/);
  assert.match(research, /experience-sessions/);
  assert.match(research, /research-source/);
  assert.match(workspace, /expectedRevision/);
  assert.match(workspace, /1_200/);
  assert.match(workspace, /workspace-editor/);
  assert.match(home, /WORKSPACE_TEMPLATES/);
  assert.match(assistant, /selectedText/);
  assert.match(assistant, /WORKSPACE_ASSIST_ACTIONS/);
  assert.match(schema, /model AcademicWorkspace/);
});

test('autosave is optimistic and workspace ownership is enforced in the backend', () => {
  const service = read('apps/api/src/workspaces/academic-workspace.service.ts');
  assert.match(service, /autosaveRevision: request\.expectedRevision/);
  assert.match(service, /workspace_revision_conflict/);
  assert.match(service, /findFirst\(\{ where: \{ id, userId \} \}\)/);
  assert.match(service, /assertOwnedSources/);
  assert.match(service, /MAX_ASSISTANT_HISTORY = 30/);
});
