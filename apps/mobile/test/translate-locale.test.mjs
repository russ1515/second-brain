import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  SUPPORTED_CODES,
  TranslationValidationError,
  acquireJobLock,
  assertRequestCeiling,
  buildPlan,
  createGeminiModel,
  createAttemptLedger,
  emojiSignature,
  generationConfigForModel,
  isRetryableProviderError,
  parseCli,
  processBatchesConcurrently,
  releaseJobLock,
  requestTranslation,
  runTranslation,
  structuredGenerationConfig,
  validateBatchResponse,
} from '../../../scripts/translate-locale.mjs';

function ledgerFixture(t, ids) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-translation-ledger-'));
  const manifestPath = path.join(directory, 'manifest.json');
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const manifest = { requestsAttempted: 0, requestsReserved: 0 };
  let idIndex = 0;
  const ledger = createAttemptLedger(manifest, manifestPath, {
    idFactory: () => ids[idIndex++],
    clock: () => '2026-09-24T12:00:00.000Z',
  });
  return { manifest, manifestPath, ledger };
}

function requestOptions(ledger, model, overrides = {}) {
  return {
    model,
    language: 'French',
    entries: [{ key: 'example.emoji', source: 'Hello 🧠' }],
    maxAttempts: 2,
    budget: { used: 0, max: 4, minIntervalMs: 0, nextRequestAt: 0 },
    ledger,
    attemptContext: { locale: 'fr', batchIndex: 0, batchChecksum: 'batch-checksum' },
    log: () => {},
    wait: async () => {},
    random: () => 0,
    now: () => 0,
    ...overrides,
  };
}

test('translation dry-run derives current catalog totals without a provider request', async () => {
  const plan = buildPlan(SUPPORTED_CODES, 60);
  assert.ok(plan.sourceKeyCount > 3_000);
  assert.equal(plan.english.get('tutor.fasterMsg'), "I've got this — can you go a bit faster?");
  assert.equal(plan.locales.length, SUPPORTED_CODES.length);
  assert.equal(plan.totalMissing, plan.locales.reduce((sum, locale) => sum + locale.missingKeyCount, 0));
  assert.equal(plan.minimumRequests, plan.locales.reduce((sum, locale) => sum + locale.minimumRequests, 0));

  for (const locale of plan.locales) {
    assert.equal(locale.effectiveKeyCount + locale.missingKeyCount, plan.sourceKeyCount, locale.code);
    assert.equal(locale.minimumRequests, Math.ceil(locale.missingKeyCount / 60), locale.code);
  }

  let providerFactoryCalls = 0;
  const manifestPath = path.join(os.tmpdir(), `second-brain-dry-run-${process.pid}-${Date.now()}.json`);
  assert.equal(fs.existsSync(manifestPath), false);
  const result = await runTranslation({
    apply: false,
    codes: SUPPORTED_CODES,
    batchSize: 60,
    maxRequests: 1,
    maxAttempts: 1,
    manifestPath,
    modelName: 'must-not-be-used',
    apiKey: undefined,
  }, {
    createModel: async () => {
      providerFactoryCalls += 1;
      throw new Error('provider factory must not run in dry-run');
    },
  });

  assert.equal(result.mode, 'dry-run');
  assert.equal(result.requestsAttempted, 0);
  assert.equal(providerFactoryCalls, 0);
  assert.equal(fs.existsSync(manifestPath), false);
});

test('provider batches require exact keys and preserve protected syntax', () => {
  const entries = [
    {
      key: 'example.one',
      source: '**Second Brain** keeps {count} at 90% — https://example.test/path',
    },
    {
      key: 'example.two',
      source: 'FSRS and Gemini use `safe_code`.',
    },
  ];
  const valid = JSON.stringify([
    {
      key: 'example.one',
      translation: '**Second Brain** conserve {count} à 90% — https://example.test/path',
    },
    {
      key: 'example.two',
      translation: 'FSRS et Gemini utilisent `code_sûr`.',
    },
  ]);
  assert.equal(validateBatchResponse(valid, entries).size, 2);

  const invalidTranslations = [
    ['', 'non-empty string'],
    ['**Second Brain** conserve {total} à 90% — https://example.test/path', 'placeholders'],
    ['**Second Brain** conserve {count} à 80% — https://example.test/path', 'numbers'],
    ['**Second Brain** conserve {count} à 90% — https://invalid.test/path', 'URLs'],
    ['Second Brain conserve {count} à 90% — https://example.test/path', 'markdown'],
    ['**Le produit** conserve {count} à 90% — https://example.test/path', 'product name'],
  ];

  for (const [translation, expectedMessage] of invalidTranslations) {
    const response = JSON.stringify([
      { key: 'example.one', translation },
      { key: 'example.two', translation: 'FSRS et Gemini utilisent `code_sûr`.' },
    ]);
    assert.throws(
      () => validateBatchResponse(response, entries),
      (error) => error instanceof TranslationValidationError && error.message.includes(expectedMessage),
    );
  }

  assert.throws(
    () => validateBatchResponse(JSON.stringify([
      { key: 'wrong.key', translation: 'Valeur' },
      { key: 'example.two', translation: 'FSRS et Gemini utilisent `code_sûr`.' },
    ]), entries),
    /key mismatch/,
  );

  const emojiEntries = [{ key: 'emoji', source: 'Keep 🧠 and 🧩' }];
  assert.throws(
    () => validateBatchResponse(JSON.stringify([{ key: 'emoji', translation: 'Garder 🧠' }]), emojiEntries),
    /emojis changed/,
  );
  const fenced = `\`\`\`json\n${JSON.stringify([{ key: 'emoji', translation: 'Garder 🧠 et 🧩' }])}\n\`\`\``;
  assert.equal(validateBatchResponse(fenced, emojiEntries).size, 1);
  assert.throws(() => validateBatchResponse(`${fenced}\n${fenced}`, emojiEntries));
});

test('structured generation config is bounded and all 71 emoji source strings are detected', () => {
  const config = structuredGenerationConfig();
  assert.equal(config.responseMimeType, 'application/json');
  assert.equal(config.responseSchema.type, 'array');
  assert.equal(config.responseSchema.items.type, 'object');
  assert.deepEqual(config.responseSchema.items.required, ['key', 'translation']);
  assert.equal(config.temperature, 0.1);
  assert.equal(config.maxOutputTokens, 16_384);

  const plan = buildPlan(['es'], 100);
  assert.equal([...plan.english.values()].filter((value) => emojiSignature(value).length > 0).length, 71);
  assert.equal(plan.locales[0].minimumRequests, Math.ceil(plan.locales[0].missingKeyCount / 100));
});

test('Google Gen AI adapter sends structured config and maps the provider response', async () => {
  let request;
  const client = {
    models: {
      async generateContent(input) {
        request = input;
        return {
          text: '[{"key":"example","translation":"Bonjour"}]',
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 6,
            thoughtsTokenCount: 1,
            totalTokenCount: 19,
          },
          modelVersion: 'gemini-3.5-flash-20260901',
        };
      },
    },
  };
  const model = await createGeminiModel(
    'test-placeholder-never-sent',
    'models/gemini-3.5-flash',
    { client },
  );
  const result = await model.generateContent('translate this batch');

  assert.equal(request.model, 'models/gemini-3.5-flash');
  assert.equal(request.contents, 'translate this batch');
  assert.deepEqual(request.config, {
    ...structuredGenerationConfig(),
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
  });
  assert.equal(result.response.text(), '[{"key":"example","translation":"Bonjour"}]');
  assert.deepEqual(result.response.usageMetadata, {
    promptTokenCount: 12,
    candidatesTokenCount: 6,
    thoughtsTokenCount: 1,
    totalTokenCount: 19,
  });
  assert.equal(result.response.model, 'models/gemini-3.5-flash');
  assert.equal(result.response.modelVersion, 'gemini-3.5-flash-20260901');
});

test('Google Gen AI SDK serializes the adapter request through a fake fetch', { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    requestUrl = String(url);
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      candidates: [{
        index: 0,
        finishReason: 'STOP',
        content: { role: 'model', parts: [{ text: '[]' }] },
      }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 1, totalTokenCount: 4 },
      modelVersion: 'fake-sdk-model-version',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    const model = await createGeminiModel('test-placeholder-never-sent', 'gemini-3.1-flash-lite');
    const result = await model.generateContent('fake-fetch prompt');

    assert.match(requestUrl, /\/models\/gemini-3\.1-flash-lite:generateContent$/);
    assert.deepEqual(requestBody.contents, [{
      role: 'user',
      parts: [{ text: 'fake-fetch prompt' }],
    }]);
    assert.deepEqual(requestBody.generationConfig, {
      temperature: 0.1,
      maxOutputTokens: 16_384,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            key: { type: 'STRING' },
            translation: { type: 'STRING' },
          },
          required: ['key', 'translation'],
        },
      },
      thinkingConfig: { thinkingLevel: 'MINIMAL' },
    });
    assert.equal(result.response.text(), '[]');
    assert.equal(result.response.usageMetadata.totalTokenCount, 4);
    assert.equal(result.response.modelVersion, 'fake-sdk-model-version');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('thinking is minimal only for Gemini 3.x models', () => {
  assert.deepEqual(
    generationConfigForModel('gemini-3.1-flash-lite').thinkingConfig,
    { thinkingLevel: 'MINIMAL' },
  );
  assert.deepEqual(
    generationConfigForModel('models/gemini-3.5-flash').thinkingConfig,
    { thinkingLevel: 'MINIMAL' },
  );
  assert.equal(generationConfigForModel('gemini-2.5-pro').thinkingConfig, undefined);
});

test('only 429 and 5xx provider failures are retryable', () => {
  assert.equal(isRetryableProviderError({ status: 429 }), true);
  assert.equal(isRetryableProviderError({ statusCode: 500 }), true);
  assert.equal(isRetryableProviderError({ response: { status: 599 } }), true);
  assert.equal(isRetryableProviderError({ status: 400 }), false);
  assert.equal(isRetryableProviderError({ status: 401 }), false);
  assert.equal(isRetryableProviderError(new Error('network disconnected')), false);
});

test('request ceiling validation is independent from changing catalog totals', () => {
  assert.doesNotThrow(() => assertRequestCeiling(17, 17));
  assert.throws(() => assertRequestCeiling(18, 17), /needs at least 18 requests/);
});

test('provider success reserves before send and finalizes usage exactly once', async (t) => {
  const { manifest, manifestPath, ledger } = ledgerFixture(t, ['success-attempt']);
  const model = {
    generateContent() {
      const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.equal(persisted.attemptAccounting.attempts[0].state, 'FINALIZATION_PENDING');
      assert.equal(persisted.attemptAccounting.attempts[0].phase, 'RESERVED');
      return Promise.resolve({
        response: {
          usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, totalTokenCount: 18 },
          text: () => JSON.stringify([{ key: 'example.emoji', translation: 'Bonjour 🧠' }]),
        },
      });
    },
  };
  const translations = await requestTranslation(requestOptions(ledger, model));
  assert.equal(translations.get('example.emoji'), 'Bonjour 🧠');
  assert.equal(manifest.requestsReserved, 1);
  assert.equal(manifest.requestsAttempted, 1);
  assert.equal(manifest.attemptAccounting.finalized, 1);
  assert.equal(manifest.attemptAccounting.released, 0);
  assert.equal(manifest.attemptAccounting.finalizationPending, 0);
  assert.equal(manifest.attemptAccounting.usageMetadata.totalTokenCount, 18);
  assert.deepEqual(manifest.attemptAccounting.audit.map((entry) => entry.event), ['RESERVE', 'SEND', 'FINALIZE']);
  assert.equal(manifest.attemptAccounting.attempts[0].state, 'FINALIZED');
});

test('retry finalizes the sent failure with unknown usage, then finalizes success', async (t) => {
  const { manifest, ledger } = ledgerFixture(t, ['retry-one', 'retry-two']);
  let calls = 0;
  const model = {
    generateContent() {
      calls += 1;
      if (calls === 1) return Promise.reject(Object.assign(new Error('server failure'), { status: 500 }));
      return Promise.resolve({
        response: {
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4, totalTokenCount: 7 },
          text: () => JSON.stringify([{ key: 'example.emoji', translation: 'Bonjour 🧠' }]),
        },
      });
    },
  };
  await requestTranslation(requestOptions(ledger, model));
  assert.equal(manifest.attemptAccounting.finalized, 2);
  assert.equal(manifest.attemptAccounting.released, 0);
  assert.equal(manifest.attemptAccounting.usageMetadata.unknownAttempts, 1);
  assert.equal(manifest.attemptAccounting.usageMetadata.reportedAttempts, 1);
  assert.equal(manifest.attemptAccounting.usageMetadata.totalTokenCount, 7);
  assert.deepEqual(manifest.attemptAccounting.attempts.map((attempt) => attempt.outcome), ['provider_error', 'success']);
});

test('malformed provider output is finalized, then retried within the attempt bound', async (t) => {
  const { manifest, ledger } = ledgerFixture(t, ['invalid-output', 'valid-output']);
  let calls = 0;
  const model = {
    generateContent() {
      calls += 1;
      return Promise.resolve({
        response: {
          usageMetadata: { totalTokenCount: calls },
          text: () => calls === 1
            ? '{not-json'
            : JSON.stringify([{ key: 'example.emoji', translation: 'Bonjour 🧠' }]),
        },
      });
    },
  };

  const translations = await requestTranslation(requestOptions(ledger, model));
  assert.equal(translations.get('example.emoji'), 'Bonjour 🧠');
  assert.equal(calls, 2);
  assert.equal(manifest.attemptAccounting.finalized, 2);
  assert.equal(manifest.attemptAccounting.finalizationPending, 0);
  assert.deepEqual(
    manifest.attemptAccounting.attempts.map((attempt) => attempt.outcome),
    ['validation_error', 'success'],
  );
});

test('bounded parallel batches serialize commits and preserve in-flight successes after failure', async () => {
  let releaseSuccessfulBatches;
  const successfulBatchesMayFinish = new Promise((resolve) => { releaseSuccessfulBatches = resolve; });
  let activeProviders = 0;
  let maxActiveProviders = 0;
  let activeCommits = 0;
  let maxActiveCommits = 0;
  const started = [];
  const committed = [];
  const fakeModel = {
    async translate(batch) {
      started.push(batch.id);
      activeProviders += 1;
      maxActiveProviders = Math.max(maxActiveProviders, activeProviders);
      try {
        if (batch.id === 1) {
          await Promise.resolve();
          releaseSuccessfulBatches();
          throw new TranslationValidationError('fake malformed response');
        }
        await successfulBatchesMayFinish;
        return new Map([[`key.${batch.id}`, `value.${batch.id}`]]);
      } finally {
        activeProviders -= 1;
      }
    },
  };

  const results = await processBatchesConcurrently({
    batches: [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }],
    concurrency: 3,
    translate: (batch) => fakeModel.translate(batch),
    commit: async (_translations, batch) => {
      activeCommits += 1;
      maxActiveCommits = Math.max(maxActiveCommits, activeCommits);
      await Promise.resolve();
      committed.push(batch.id);
      activeCommits -= 1;
    },
  });

  assert.equal(maxActiveProviders, 3);
  assert.equal(maxActiveCommits, 1);
  assert.deepEqual(started.sort(), [0, 1, 2]);
  assert.deepEqual(committed.sort(), [0, 2]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.equal(results[2].status, 'fulfilled');
  assert.equal(results[3], undefined);
});

test('a synchronous pre-send refusal releases exactly once', async (t) => {
  const { manifest, ledger } = ledgerFixture(t, ['released-attempt']);
  const refusal = Object.assign(new Error('local refusal'), { status: 400 });
  const model = { generateContent() { throw refusal; } };
  await assert.rejects(requestTranslation(requestOptions(ledger, model)), refusal);
  assert.equal(manifest.requestsReserved, 1);
  assert.equal(manifest.requestsAttempted, 0);
  assert.equal(manifest.attemptAccounting.finalized, 0);
  assert.equal(manifest.attemptAccounting.released, 1);
  assert.equal(manifest.attemptAccounting.finalizationPending, 0);
  assert.deepEqual(manifest.attemptAccounting.audit.map((entry) => entry.event), ['RESERVE', 'RELEASE']);
  assert.equal(manifest.attemptAccounting.attempts[0].state, 'RELEASED');
});

test('manifest paths are confined and the apply lock is exclusive', () => {
  const emptyEnv = path.join(os.tmpdir(), `missing-env-${process.pid}-${Date.now()}`);
  assert.throws(() => parseCli(['es', '--manifest', 'outside.json'], emptyEnv), /must be a .json file under/);
  const parsed = parseCli([
    'es',
    '--manifest',
    'apps/mobile/lib/locales/.translation-progress/test.json',
    '--model',
    'gemini-3.5-flash-lite',
    '--concurrency',
    '4',
  ], emptyEnv);
  assert.match(parsed.manifestPath, /\.translation-progress[\\/]test\.json$/);
  assert.equal(parsed.modelName, 'gemini-3.5-flash-lite');
  assert.equal(parsed.concurrency, 4);
  assert.equal(parsed.minIntervalMs, 0);
  assert.throws(
    () => parseCli(['es', '--concurrency', '9'], emptyEnv),
    /concurrency must be an integer from 1 to 8/,
  );
  assert.throws(
    () => parseCli(['es', '--concurrency', '2', '--min-interval-ms', '1'], emptyEnv),
    /minimum request interval must be 0/,
  );

  let lock;
  try {
    lock = acquireJobLock({}, { idFactory: () => 'test-lock-owner' });
    assert.throws(
      () => acquireJobLock({}, { idFactory: () => 'second-owner' }),
      /Another translation apply holds/,
    );
  } finally {
    if (lock) releaseJobLock(lock);
  }
});
