const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OpenAIProvider,
  OpenAIProviderError,
} = require('../dist/llm/providers/openai.provider.js');
const { AiOrchestratorService } = require('../dist/llm/ai-orchestrator.service.js');
const { LlmService, normalizeLlmMeasurement } = require('../dist/llm/llm.service.js');

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test('OpenAI Responses adapter serializes safely and canonicalizes separately priced usage', async () => {
  const calls = [];
  const provider = new OpenAIProvider('test-key', 'configured-test-model', async (url, init) => {
    calls.push({ url, init });
    return jsonResponse({
      id: 'response-test-opaque-id',
      model: 'returned-test-model',
      output: [{
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'bounded fixture reply' }],
      }],
      usage: {
        input_tokens: 100,
        input_tokens_details: { cached_tokens: 20, cache_write_tokens: 0 },
        output_tokens: 10,
        output_tokens_details: { reasoning_tokens: 4 },
        total_tokens: 110,
      },
    });
  });

  const result = await provider.generate([
    { role: 'system', content: 'You are a bounded test assistant.' },
    { role: 'user', content: 'Reply with one short fixture sentence.' },
    { role: 'assistant', content: 'Earlier context.' },
  ], { maxOutputTokens: 12, temperature: 0.2 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.model, 'configured-test-model');
  assert.equal(body.store, false);
  assert.equal(body.instructions, 'You are a bounded test assistant.');
  assert.equal(body.max_output_tokens, 12);
  assert.equal(body.temperature, 0.2);
  assert.deepEqual(body.input, [
    { role: 'user', content: [{ type: 'input_text', text: 'Reply with one short fixture sentence.' }] },
    { role: 'assistant', content: [{ type: 'output_text', text: 'Earlier context.' }] },
  ]);
  assert.equal(result.text, 'bounded fixture reply');
  assert.equal(result.provider, 'openai');
  assert.equal(result.model, 'returned-test-model');
  assert.equal(result.providerRequestId, 'response-test-opaque-id');
  // OpenAI input_tokens includes cached tokens. Only the ordinary 80 tokens
  // may be charged at the ordinary input rate; reasoning is included in output.
  assert.deepEqual(result.usage, {
    inputTokens: 80,
    cachedTokens: 20,
    outputTokens: 10,
    totalTokens: 110,
    cacheWriteTokens: 0,
    reasoningTokens: 4,
    unpricedUsageReason: undefined,
  });
  const measurement = normalizeLlmMeasurement(result);
  assert.equal(measurement.inputTokens, 80);
  assert.equal(measurement.cachedInputTokens, 20);
  assert.equal(measurement.outputTokens, 10);
  assert.equal(measurement.reasoningTokens, undefined);
  assert.equal(measurement.providerRequestId, 'response-test-opaque-id');
  assert.deepEqual(measurement.metadata, {
    providerUsageTotalUnits: 110,
    openaiCacheWriteUnits: 0,
    openaiReasoningUnits: 4,
  });
});

test('OpenAI adapter refuses missing credentials and never exposes a provider error body', async () => {
  let missingKeyFetchCalled = false;
  const missingKey = new OpenAIProvider('', 'configured-test-model', async () => {
    missingKeyFetchCalled = true;
    return jsonResponse({});
  });
  await assert.rejects(
    () => missingKey.generate([{ role: 'user', content: 'fixture' }]),
    (error) => error instanceof OpenAIProviderError && error.code === 'OPENAI_CREDENTIAL_MISSING',
  );
  assert.equal(missingKeyFetchCalled, false);

  const errorMarker = 'UNSAFE_PROVIDER_BODY_MUST_NOT_ESCAPE';
  const rejected = new OpenAIProvider('test-key', 'configured-test-model', async () =>
    jsonResponse({ error: { message: errorMarker } }, 401));
  await assert.rejects(
    () => rejected.generate([{ role: 'user', content: 'fixture' }]),
    (error) => {
      assert.equal(error instanceof OpenAIProviderError, true);
      assert.equal(error.code, 'OPENAI_RESPONSE_HTTP_401');
      assert.equal(String(error.message).includes(errorMarker), false);
      return true;
    },
  );
});

test('OpenAI remains the only executable route until echo is explicitly selected', () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'x';
  try {
    const openai = {
      name: 'openai',
      generate: async () => ({ text: 'fixture', provider: 'openai', model: 'fixture-model' }),
    };
    const config = { get: (key) => key === 'llm.model' ? 'fixture-model' : undefined };
    const metrics = { snapshot: () => ({ ai: { byModel: {} } }) };
    const orchestrator = new AiOrchestratorService(openai, config, metrics);
    for (const strategy of ['quality', 'cost', 'speed', 'balanced']) {
      orchestrator.setStrategy(strategy);
      assert.equal(orchestrator.pickProvider().name, 'openai');
      assert.equal(orchestrator.view().selection[strategy], 'openai');
    }
    const echo = orchestrator.view().providers.find((provider) => provider.name === 'echo');
    assert.equal(echo.available, false);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('temporary OpenAI provider-gate mode enforces a single bounded Tutor attempt', async () => {
  let calls = 0;
  let receivedOptions;
  const primary = {
    name: 'openai',
    generate: async (_messages, options) => {
      calls += 1;
      receivedOptions = options;
      const error = new Error('fixture unavailable');
      error.status = 503;
      throw error;
    },
  };
  const orchestrator = { pickProvider: () => primary, supportsVision: false };
  const metrics = { recordAiCall: () => undefined, captureError: () => undefined };
  const config = {
    get: (key) => key === 'llm.openAiProviderGate'
      ? { enabled: true, maxOutputTokens: 7 }
      : undefined,
  };
  const service = new LlmService(orchestrator, metrics, undefined, config);
  await assert.rejects(
    () => service.generate([{ role: 'user', content: 'fixture' }], {
      operation: 'tutor', maxOutputTokens: 99,
    }),
  );
  assert.equal(calls, 1);
  assert.equal(receivedOptions.maxOutputTokens, 7);
});
