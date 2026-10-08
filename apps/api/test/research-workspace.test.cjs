'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ResearchService } = require('../dist/research/research.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function serviceWith({ results = [], brainItems = [], availability = 'unavailable', webSources = [], llmResult, planQueries } = {}) {
  const calls = [];
  const retrieval = {
    resolveScope: async (userId, scope) => { calls.push({ kind: 'resolve', userId, scope }); return scope.documentIds ?? null; },
    search: async (userId, query, options) => { calls.push({ kind: 'search', userId, query, options }); return { query, results }; },
  };
  const brain = { search: async (userId, query, limit) => { calls.push({ kind: 'brain', userId, query, limit }); return { items: brainItems, nextCursor: null }; } };
  const llm = { generate: async (messages) => {
    calls.push({ kind: 'llm', messages });
    if (messages[0]?.content?.includes('small, adaptive research plan')) {
      return { text: JSON.stringify({ queries: planQueries ?? ['Question?', 'Evidence?', 'Contradictions?'] }) };
    }
    return { text: llmResult ?? JSON.stringify({ synthesis: 'Grounded result', keyPoints: ['Point'], claims: [], sections: [], comparison: null }) };
  } };
  const prisma = { profile: { findUnique: async ({ where }) => { calls.push({ kind: 'profile', userId: where.userId }); return { preferredLanguage: 'en' }; } } };
  const provider = {
    name: availability === 'available' ? 'configured-test-provider' : 'disabled',
    availability: async () => ({ status: availability, checkedAt: new Date().toISOString(), capabilities: { webSearch: availability === 'available', externalSearch: false, sourceMetadata: false, dateFiltering: false, languageFiltering: false } }),
    search: async (request) => { calls.push({ kind: 'web', request }); return { query: request.query, sources: webSources, citations: [], provider: 'configured-test-provider', retrievedAt: new Date().toISOString() }; },
  };
  const externalProvider = {
    name: 'disabled',
    availability: async () => ({ status: 'unavailable', checkedAt: new Date().toISOString(), capabilities: { webSearch: false, externalSearch: false, sourceMetadata: false, dateFiltering: false, languageFiltering: false } }),
    search: async () => { throw new Error('must not search disabled external provider'); },
  };
  return { service: new ResearchService(retrieval, brain, llm, prisma, provider, externalProvider), calls };
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
    llmResult: JSON.stringify({ synthesis: 'Synthesis [document:d1:0] [made-up]', keyPoints: ['K'], claims: [{ text: 'Grounded claim', citationIds: ['document:d1:0', 'made-up'] }], sections: [{ title: 'Section', body: 'Body', citationIds: ['document:d1:0', 'made-up'] }], comparison: { agreements: ['Shared'], divergences: ['Different'], specificities: [] } }),
  });
  const result = await service.run('user-1', { question: 'Compare', depth: 'sourced', scopes: [{ kind: 'library' }] });
  assert.deepEqual(result.sections[0].citationIds, ['document:d1:0']);
  assert.deepEqual(result.claims[0].citationIds, ['document:d1:0']);
  assert.equal(result.synthesis.includes('[made-up]'), false);
  assert.deepEqual(result.comparison.divergences, ['Different']);
  assert.ok(result.stages.some((stage) => stage.kind === 'compared'));
});

test('unconfigured Web never simulates sources or calls the language model', async () => {
  const { service, calls } = serviceWith();
  const result = await service.run('user-1', { question: 'Latest evidence', depth: 'deep', scopes: [{ kind: 'web' }] });
  assert.equal(result.provider, null);
  assert.equal(result.citations.length, 0);
  assert.equal(result.synthesis, '');
  assert.equal(result.partial, true);
  assert.ok(result.limits.includes('NO_PROVIDER'));
  assert.equal(calls.some((call) => call.kind === 'llm'), false);
});

test('deep Web research executes one bounded adaptive plan and multiple real queries', async () => {
  const webSources = [{
    id: 'source-1', title: 'Official evidence', url: 'https://example.gov/evidence', domain: 'example.gov',
    provider: 'test-web', publishedAt: null, retrievedAt: new Date().toISOString(), snippet: 'Evidence',
    rank: 1, quality: 'primary', relevance: null, confidence: null,
  }];
  const { service, calls } = serviceWith({
    availability: 'available', webSources,
    planQueries: ['Main question', 'Primary evidence', 'Competing evidence', 'Uncertainty'],
  });
  const result = await service.run('user-1', { question: 'Main question', depth: 'deep', scopes: [{ kind: 'web' }] });
  assert.equal(result.plan.queries.length, 4);
  assert.equal(calls.filter((call) => call.kind === 'web').length, 4);
  assert.equal(calls.filter((call) => call.kind === 'llm').length, 2);
  assert.ok(result.citations.every((citation) => citation.kind === 'web'));
});

test('external connectors are independent from public Web availability', async () => {
  const { service } = serviceWith({ availability: 'available' });
  const available = await service.availability();
  assert.equal(available.web.status, 'available');
  assert.equal(available.external.status, 'unavailable');
  const result = await service.run('user-1', { question: 'Dataset evidence', depth: 'sourced', scopes: [{ kind: 'external' }] });
  assert.ok(result.limits.includes('EXTERNAL_PROVIDER_REQUIRED'));
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
  const tutor = read('apps/api/src/tutor/tutor.service.ts');
  const schema = read('apps/api/prisma/schema.prisma');
  assert.match(research, /deep-research-plan/);
  assert.match(research, /SourcePreview/);
  assert.match(research, /experience-sessions/);
  assert.match(research, /research-source/);
  assert.match(workspace, /expectedRevision/);
  assert.match(workspace, /1_200/);
  assert.match(workspace, /workspace-editor/);
  assert.ok(workspace.indexOf('{editor}{assistantPanel}') >= 0);
  assert.doesNotMatch(workspace, /workspace10\.next|width: 340|activeArea === 'assistant'/);
  assert.match(home, /WORKSPACE_TEMPLATES/);
  assert.match(assistant, /selectedText/);
  assert.match(assistant, /WORKSPACE_ASSIST_ACTIONS/);
  assert.match(assistant, /workspace-assistant-history/);
  assert.match(assistant, /globalPath\.insertProposal/);
  assert.match(assistant, /globalPath\.replaceSelection/);
  assert.match(assistant, /globalPath\.anotherProposal/);
  assert.match(assistant, /globalPath\.undoInsertion/);
  assert.match(research, /CitationLinks/);
  assert.match(tutor, /researchContextBlock/);
  assert.match(tutor, /type: 'research'/);
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
