'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} = require('@nestjs/common');

const { AuthService } = require('../dist/auth/auth.service.js');
const { OrganizationService } = require('../dist/organizations/organization.service.js');
const { SubscriptionService } = require('../dist/subscription/subscription.service.js');
const { DocumentService } = require('../dist/documents/document.service.js');
const { CleaningService } = require('../dist/documents/ingestion/cleaning.service.js');
const { ChunkingService } = require('../dist/documents/ingestion/chunking.service.js');
const { RetrievalService } = require('../dist/documents/retrieval/retrieval.service.js');
const { RagService } = require('../dist/documents/rag/rag.service.js');
const { TutorService } = require('../dist/tutor/tutor.service.js');
const {
  inferTeacherSubject,
  resolveTeacherRole,
} = require('../dist/teaching/teacher-role.js');
const { LocalizationService } = require('../dist/localization/localization.service.js');
const { localeDirective } = require('../dist/common/learning-locale.js');
const { LlmService } = require('../dist/llm/llm.service.js');
const { SpeechService } = require('../dist/speech/speech.service.js');
const { PrivacyService } = require('../dist/privacy/privacy.service.js');
const { QdrantService } = require('../dist/qdrant/qdrant.service.js');
const {
  AppleIapProvider,
  GooglePlayProvider,
} = require('../dist/payments/providers/store-payment.providers.js');

test('auth: malformed refresh tokens fail without a database lookup', async () => {
  let touched = false;
  const prisma = { session: { findUnique: async () => { touched = true; } } };
  const service = new AuthService(prisma, {}, {}, {}, {});

  await assert.rejects(
    service.refresh('not-a-refresh-token'),
    (error) => error instanceof UnauthorizedException && error.getStatus() === 401,
  );
  assert.equal(touched, false);
});

test('auth: password-reset request does not reveal a missing account', async () => {
  let where;
  let issued = false;
  const prisma = {
    user: {
      findUnique: async (args) => {
        where = args.where;
        return null;
      },
    },
  };
  const service = new AuthService(prisma, {}, {}, {}, {
    issue: async () => { issued = true; },
  });

  await assert.doesNotReject(service.requestPasswordReset('  Missing@Example.COM '));
  assert.deepEqual(where, { email: 'missing@example.com' });
  assert.equal(issued, false);
});

test('permissions: organization membership hides tenants and enforces role rank', async () => {
  const missing = new OrganizationService({
    membership: { findUnique: async () => null },
  });
  await assert.rejects(
    missing.requireMember('outsider', 'org-a'),
    (error) => error instanceof NotFoundException,
  );

  const student = new OrganizationService({
    membership: { findUnique: async () => ({ role: 'student' }) },
  });
  await assert.rejects(
    student.requireMember('student', 'org-a', 'teacher'),
    (error) => error instanceof ForbiddenException,
  );
});

test('subscription: first-use provisioning is atomic and paid direct changes are refused', async () => {
  let upsertArgs;
  const prisma = {
    subscription: {
      findUnique: async () => null,
      upsert: async (args) => {
        upsertArgs = args;
        return { id: 'sub-1', userId: 'u1', plan: { slug: 'free', name: 'Free' } };
      },
    },
  };
  const plans = {
    bySlug: async () => ({ id: 'free-plan', slug: 'free', isActive: true }),
  };
  const service = new SubscriptionService(prisma, plans);

  await service.resolveForUser('u1');
  assert.equal(upsertArgs.where.userId, 'u1');
  assert.equal(upsertArgs.create.planId, 'free-plan');
  await assert.rejects(
    service.setPlan('u1', 'pro'),
    (error) => error instanceof ForbiddenException,
  );
});

test('documents: cleaning/chunking are deterministic and ownership is enforced', async () => {
  const cleaned = new CleaningService().clean('  photo-\r\nsynthesis\u0000   works  ');
  assert.equal(cleaned, 'photosynthesis works');
  const chunks = new ChunkingService().chunk('one two three four five six', {
    size: 12,
    overlap: 3,
  });
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.trim() === chunk));

  const service = new DocumentService(
    { document: { findUnique: async () => ({ id: 'd1', userId: 'other' }) } },
    {},
    {},
    {},
  );
  await assert.rejects(
    service.get('u1', 'd1'),
    (error) => error instanceof NotFoundException,
  );
});

test('RAG: vector lookup is hard-scoped by owner and rechecked in PostgreSQL', async () => {
  let qdrantOptions;
  const retrieval = new RetrievalService(
    { embedQuery: async () => [0.1, 0.2] },
    {
      search: async (_collection, _vector, options) => {
        qdrantOptions = options;
        return [
          { id: 'v1', score: 0.9, payload: { documentId: 'mine', chunkIndex: 0, content: 'safe' } },
          { id: 'v2', score: 0.8, payload: { documentId: 'other', chunkIndex: 0, content: 'private' } },
        ];
      },
    },
    {
      document: {
        findMany: async () => [{ id: 'mine', title: 'My notes' }],
      },
    },
  );

  const result = await retrieval.search('u1', 'question');
  assert.deepEqual(qdrantOptions.filter.must[0], {
    key: 'userId',
    match: { value: 'u1' },
  });
  assert.deepEqual(result.results.map((item) => item.documentId), ['mine']);
});

test('RAG: empty context avoids the LLM and localizes the refusal', async () => {
  let llmCalls = 0;
  const service = new RagService(
    {
      resolveScope: async () => null,
      search: async () => ({ query: 'q', results: [] }),
    },
    { generate: async () => { llmCalls += 1; } },
    { profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) } },
  );
  const result = await service.ask('u1', 'q');
  assert.equal(llmCalls, 0);
  assert.match(result.answer, /Je n’ai rien trouvé/);
});

test('tutor: subject inference is local and provider failures release quota', async () => {
  assert.equal(inferTeacherSubject('Aide-moi avec une équation en algèbre'), 'Mathematics');
  assert.equal(inferTeacherSubject('Je veux comprendre ce sujet'), null);
  assert.equal(resolveTeacherRole('Spanish').kind, 'language');

  const now = new Date();
  const session = {
    id: 's1',
    userId: 'u1',
    title: null,
    focusConceptId: null,
    languageProfileId: null,
    subject: null,
    strategy: null,
    strategyReason: null,
    createdAt: now,
    updatedAt: now,
  };
  let consumed = 0;
  let released = 0;
  const service = new TutorService(
    {
      tutorSession: { findUnique: async () => session },
      tutorMessage: { findMany: async () => [] },
      profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
      onboardingProfile: { findUnique: async () => null },
      learningDna: { findUnique: async () => null },
    },
    { generate: async () => { throw new ServiceUnavailableException('provider down'); } },
    { search: async () => ({ query: 'q', results: [] }) },
    {},
    {},
    {
      consume: async () => { consumed += 1; },
      release: async () => { released += 1; },
    },
    {
      ensureTutorSession: async () => ({
        id: 'e1', currentStep: null,
        activeContexts: { version: 1, ownerUserId: 'u1', capturedAt: now.toISOString(), items: [] },
      }),
      updateState: async () => undefined,
    },
  );

  await assert.rejects(service.sendMessage('u1', 's1', 'mathématiques'));
  assert.equal(consumed, 1);
  assert.equal(released, 1);
});

test('locale/i18n: static UI copy is catalogued and directives follow the locale', async () => {
  const service = new LocalizationService({});
  assert.deepEqual(
    await service.translate(['Still learning', 'Unknown canonical copy'], 'fr'),
    ['Encore en apprentissage', 'Unknown canonical copy'],
  );
  assert.match(localeDirective('fr'), /EXCLUSIVELY in French/);
});

test('LLM: identical in-flight calls are deduplicated and classification is capped', async () => {
  let calls = 0;
  let receivedOptions;
  let release;
  const provider = {
    name: 'controlled',
    generate: (_messages, options) => {
      calls += 1;
      receivedOptions = options;
      return new Promise((resolve) => { release = resolve; });
    },
  };
  const service = new LlmService(
    { pickProvider: () => provider, supportsVision: false },
    { recordAiCall: () => {}, captureError: () => {} },
  );
  const messages = [{ role: 'user', content: 'classify' }];
  const first = service.generate(messages, {
    operation: 'classification',
    maxOutputTokens: 999,
  });
  const second = service.generate(messages, {
    operation: 'classification',
    maxOutputTokens: 999,
  });
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  assert.equal(receivedOptions.maxOutputTokens, 96);
  release({ text: 'Mathematics' });
  await first;
});

test('LLM: exhausted quota opens the circuit without retry multiplication', async () => {
  let calls = 0;
  const quotaError = Object.assign(new Error('RESOURCE_EXHAUSTED daily quota'), {
    status: 429,
  });
  const provider = {
    name: 'quota-provider',
    generate: async () => {
      calls += 1;
      throw quotaError;
    },
  };
  const service = new LlmService(
    { pickProvider: () => provider, supportsVision: false },
    { recordAiCall: () => {}, captureError: () => {} },
  );
  await assert.rejects(service.generate([{ role: 'user', content: 'one' }]));
  await assert.rejects(service.generate([{ role: 'user', content: 'two' }]));
  assert.equal(calls, 1);
});

test('voice: synthesis is deduplicated in flight and cached after success', async () => {
  let calls = 0;
  let release;
  const value = { audioBase64: 'UklGRg==', mimeType: 'audio/wav' };
  const service = new SpeechService({
    name: 'controlled-speech',
    transcribe: async () => ({ text: '' }),
    synthesize: async () => {
      calls += 1;
      return new Promise((resolve) => { release = resolve; });
    },
  });
  const first = service.synthesize('Bonjour', { language: 'fr' });
  const second = service.synthesize('Bonjour', { language: 'fr' });
  assert.strictEqual(first, second);
  release(value);
  assert.deepEqual(await first, value);
  assert.deepEqual(await service.synthesize('Bonjour', { language: 'fr' }), value);
  assert.equal(calls, 1);
});

test('billing: incomplete mobile-store verifiers fail closed', async () => {
  const request = {
    userId: 'u1',
    receipt: 'controlled-test-receipt',
    planSlug: 'pro',
    interval: 'month',
  };
  await assert.rejects(
    Promise.resolve().then(() => new AppleIapProvider().verifyMobilePurchase(request)),
    (error) => error instanceof ServiceUnavailableException,
  );
  await assert.rejects(
    Promise.resolve().then(() => new GooglePlayProvider().verifyMobilePurchase(request)),
    (error) => error instanceof ServiceUnavailableException,
  );
});

test('privacy: export covers domain data without selecting authentication secrets', async () => {
  const calls = [];
  const delegates = new Map();
  const prisma = new Proxy({}, {
    get(_target, model) {
      if (!delegates.has(model)) {
        delegates.set(model, new Proxy({}, {
          get(_delegate, operation) {
            return async (args) => {
              calls.push({ model, operation, args });
              if (model === 'user') return { id: 'u1', email: 'test@example.com' };
              if (operation === 'findUnique') return null;
              return [];
            };
          },
        }));
      }
      return delegates.get(model);
    },
  });
  const result = await new PrivacyService(prisma, {}).exportData('u1');
  assert.ok(Object.hasOwn(result.data, 'documentChunks'));
  assert.ok(Object.hasOwn(result.data, 'learningDna'));
  assert.ok(Object.hasOwn(result.data, 'groupMemberships'));
  const accountCall = calls.find((call) => call.model === 'user');
  assert.equal(accountCall.args.select.passwordHash, undefined);
  assert.equal(accountCall.args.select.twoFactorSecret, undefined);
});

test('privacy: Qdrant failure prevents relational account deletion', async () => {
  const passwordHash = await argon2.hash('controlled-password');
  let sqlDeleted = false;
  const service = new PrivacyService(
    {
      user: {
        findUnique: async () => ({ passwordHash }),
        delete: async () => { sqlDeleted = true; },
      },
    },
    { deleteByUser: async () => { throw new Error('qdrant unavailable'); } },
  );
  await assert.rejects(
    service.deleteAccount('controlled-user', 'controlled-password'),
    (error) => error instanceof ServiceUnavailableException,
  );
  assert.equal(sqlDeleted, false);
});

test('privacy: Qdrant erasure uses the owner filter before SQL deletion', async () => {
  const calls = [];
  // Bypass the network-owning constructor: this is a controlled filter unit test.
  const qdrant = Object.create(QdrantService.prototype);
  qdrant.client = {
    collectionExists: async () => ({ exists: true }),
    delete: async (name, options) => { calls.push({ name, options }); },
  };
  await qdrant.deleteByUser('document_chunks', 'controlled-user');
  assert.deepEqual(calls[0].options.filter.must[0], {
    key: 'userId',
    match: { value: 'controlled-user' },
  });
  assert.equal(calls[0].options.wait, true);
});
