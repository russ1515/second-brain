'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { ExperienceSessionService } = require('../dist/experience-sessions/experience-session.service.js');
const { ResearchService } = require('../dist/research/research.service.js');

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      if ('in' in expected) return expected.in.includes(actual);
    }
    return actual === expected;
  });
}

function authorityHarness() {
  const calls = [];
  const sessions = [{
    id: 'research-session',
    userId: 'owner',
    type: 'research',
    status: 'active',
    version: 1,
    productions: [{
      id: 'outline-1', kind: 'research-outline', title: 'Retained outline',
      createdAt: '2026-10-14T08:00:00.000Z', metadata: { safe: true },
    }],
    sourceReferences: [],
  }, {
    id: 'unmarked-session',
    userId: 'owner',
    type: 'research',
    status: 'active',
    version: 1,
    productions: [{
      id: 'client-snapshot', kind: 'research-result', title: 'Client snapshot',
      createdAt: '2026-10-14T08:00:00.000Z',
      metadata: {
        question: 'Forged', depth: 'sourced', scopes: [{ kind: 'library' }],
        synthesis: 'CLIENT_FORGED', sections: [], keyPoints: [], claims: [], comparison: null,
        citations: [], limits: [], stages: [], partial: false, provider: null, plan: null,
        queries: [], generatedAt: '2026-10-14T08:00:00.000Z',
      },
    }],
    sourceReferences: [],
  }, {
    id: 'wrong-type-session',
    userId: 'owner',
    type: 'learning',
    status: 'active',
    version: 1,
    productions: [],
    sourceReferences: [],
  }, {
    id: 'failed-research-session',
    userId: 'owner',
    type: 'research',
    status: 'failed',
    version: 1,
    productions: [],
    sourceReferences: [],
  }];

  const experienceSession = {
    findFirst: async ({ where, select }) => {
      const row = sessions.find((candidate) => matches(candidate, where)) ?? null;
      if (!row || !select) return row;
      return Object.fromEntries(Object.keys(select).map((key) => [key, row[key]]));
    },
    updateMany: async ({ where, data }) => {
      const row = sessions.find((candidate) => matches(candidate, where));
      if (!row) return { count: 0 };
      row.productions = structuredClone(data.productions);
      row.sourceReferences = structuredClone(data.sourceReferences);
      row.version += data.version.increment;
      calls.push({ kind: 'session-update', where, data: structuredClone(data) });
      return { count: 1 };
    },
  };
  const prisma = {
    experienceSession,
    profile: { findUnique: async () => { calls.push({ kind: 'profile' }); return { preferredLanguage: 'en' }; } },
  };
  const retrieval = {
    resolveScope: async () => { calls.push({ kind: 'retrieval-scope' }); return null; },
    search: async (userId, query, options) => {
      calls.push({ kind: 'retrieval', userId, query, options });
      return {
        query,
        results: [{
          documentId: 'document-owner', documentTitle: 'Owned evidence',
          chunkIndex: 3, pageNumber: 7, content: 'Canonical evidence passage.', score: 0.93,
        }],
      };
    },
  };
  const brain = { search: async () => { calls.push({ kind: 'brain' }); return { items: [], nextCursor: null }; } };
  const llm = {
    generate: async () => {
      calls.push({ kind: 'llm' });
      return { text: JSON.stringify({
        synthesis: 'Canonical answer [document:document-owner:3]',
        keyPoints: ['Canonical point'],
        claims: [{ text: 'Canonical claim', citationIds: ['document:document-owner:3'] }],
        sections: [], comparison: null,
      }) };
    },
  };
  const unavailableProvider = {
    name: 'disabled',
    availability: async () => {
      calls.push({ kind: 'provider-availability' });
      return {
        status: 'unavailable', checkedAt: new Date().toISOString(),
        capabilities: { webSearch: false, externalSearch: false, sourceMetadata: false, dateFiltering: false, languageFiltering: false },
      };
    },
    search: async () => { calls.push({ kind: 'provider-search' }); throw new Error('disabled provider must not run'); },
  };
  return {
    service: new ResearchService(retrieval, brain, llm, prisma, unavailableProvider, unavailableProvider),
    sessions,
    calls,
  };
}

test('Research run persists one server-authoritative result and Workspace reloads the canonical result', async () => {
  const { service, sessions, calls } = authorityHarness();
  const result = await service.run('owner', {
    question: 'What does my evidence establish?',
    depth: 'sourced',
    scopes: [{ kind: 'library' }],
    experienceSessionId: 'research-session',
  });

  const session = sessions.find((candidate) => candidate.id === 'research-session');
  assert.equal(session.version, 2);
  assert.equal(calls.filter((call) => call.kind === 'session-update').length, 1);
  assert.equal(session.productions.filter((item) => item.kind === 'research-outline').length, 1);
  assert.equal(session.productions.filter((item) => item.kind === 'research-result').length, 1);
  const production = session.productions.find((item) => item.kind === 'research-result');
  assert.equal(production.metadata.sourceAuthority, 'server:research-result:v1');
  assert.equal(production.metadata.synthesis, result.synthesis);
  assert.deepEqual(session.sourceReferences, [{
    kind: 'document', id: 'document-owner', title: 'Owned evidence',
  }]);

  const reloaded = await service.loadWorkspaceSource('owner', 'research-session');
  assert.deepEqual(reloaded, result);
  assert.equal(Object.hasOwn(reloaded, 'sourceAuthority'), false);
});

test('Workspace rejects unmarked client snapshots and foreign Research sessions', async () => {
  const { service } = authorityHarness();

  assert.equal(await service.loadWorkspaceSource('owner', 'unmarked-session'), null);
  assert.equal(await service.loadWorkspaceSource('intruder', 'research-session'), null);
  assert.equal(await service.loadWorkspaceSource('owner', 'missing-session'), null);
});

test('invalid or foreign Research session ids fail before locale, retrieval, provider or LLM work', async () => {
  const cases = [
    { userId: 'intruder', sessionId: 'research-session' },
    { userId: 'owner', sessionId: 'wrong-type-session' },
    { userId: 'owner', sessionId: 'failed-research-session' },
    { userId: 'owner', sessionId: 'missing-session' },
  ];
  for (const scenario of cases) {
    const { service, calls } = authorityHarness();
    await assert.rejects(
      service.run(scenario.userId, {
        question: 'Must not execute',
        depth: 'deep',
        scopes: [{ kind: 'web' }, { kind: 'library' }],
        experienceSessionId: scenario.sessionId,
      }),
      (error) => error instanceof BadRequestException,
    );
    assert.deepEqual(
      calls.filter((call) => [
        'profile', 'retrieval-scope', 'retrieval', 'brain',
        'provider-availability', 'provider-search', 'llm', 'session-update',
      ].includes(call.kind)),
      [],
    );
  }
});

test('generic ExperienceSession client cannot create or replace Research results and provenance', async () => {
  const researchRow = {
    id: 'research-session', userId: 'owner', type: 'research', status: 'active',
    workspaceRef: null, tutorSessionId: null, lessonId: null,
  };
  let writes = 0;
  const prisma = {
    experienceSession: {
      findFirst: async ({ where }) => matches(researchRow, where) ? researchRow : null,
      create: async () => { writes += 1; throw new Error('unexpected write'); },
      updateMany: async () => { writes += 1; throw new Error('unexpected write'); },
    },
  };
  const service = new ExperienceSessionService(prisma);
  const production = [{
    id: 'forged', kind: 'research-result', createdAt: new Date().toISOString(),
    metadata: { synthesis: 'client supplied' },
  }];
  const sourceReferences = [{ kind: 'external-source', id: 'https://untrusted.test', title: 'Untrusted' }];

  assert.throws(
    () => service.createFromClient('owner', { type: 'research', productions: production }),
    (error) => error instanceof BadRequestException,
  );
  assert.throws(
    () => service.createFromClient('owner', { type: 'research', sourceReferences }),
    (error) => error instanceof BadRequestException,
  );
  await assert.rejects(
    service.updateFromClient('owner', 'research-session', { productions: production }),
    (error) => error instanceof BadRequestException,
  );
  await assert.rejects(
    service.updateFromClient('owner', 'research-session', { sourceReferences }),
    (error) => error instanceof BadRequestException,
  );
  assert.equal(writes, 0);
});
