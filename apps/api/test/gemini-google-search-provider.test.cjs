'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  GeminiGoogleSearchProvider,
} = require('../dist/research/providers/gemini-google-search.provider.js');
const {
  ResearchProviderError,
} = require('../dist/research/providers/research-provider.error.js');

test('Gemini Google Search uses one bounded grounded request and trusts only grounding metadata', async () => {
  let request;
  const provider = new GeminiGoogleSearchProvider('private-key', 'configured-model', {
    generateContent: async (params) => {
      request = params;
      return {
        responseId: 'gemini-grounded-1',
        modelVersion: 'configured-model-001',
        text: 'Grounded answer. Invented prose URL: https://invented.invalid',
        usageMetadata: {
          promptTokenCount: 100,
          cachedContentTokenCount: 10,
          candidatesTokenCount: 25,
        },
        candidates: [{
          groundingMetadata: {
            webSearchQueries: ['official evidence', 'official evidence', 'competing evidence'],
            groundingChunks: [
              { web: { uri: 'https://www.who.int/report#finding', title: 'WHO report' } },
              { web: { uri: 'file:///etc/passwd', title: 'Unsafe' } },
            ],
            groundingSupports: [{
              segment: { text: 'The official evidence supports this claim.' },
              groundingChunkIndices: [0],
              confidenceScores: [0.9],
            }],
          },
        }],
      };
    },
  });

  const result = await provider.search({
    query: 'Current evidence', maxResults: 5, mode: 'sourced', language: 'fr',
  });

  assert.deepEqual(request.config.tools, [{ googleSearch: {} }]);
  assert.equal(request.config.httpOptions.retryOptions.attempts, 1);
  assert.match(request.config.systemInstruction, /untrusted source data/);
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].url, 'https://www.who.int/report');
  assert.equal(result.sources[0].provider, 'gemini-google-search');
  assert.equal(result.sources[0].quality, 'institutional');
  assert.equal(result.sources[0].snippet, null);
  assert.equal(result.citations[0].excerpt, undefined);
  assert.deepEqual(result.groundedClaims, [{
    text: 'The official evidence supports this claim.',
    sourceIds: [result.sources[0].id],
  }]);
  assert.equal(result.sources.some((source) => source.url.includes('invented.invalid')), false);
  assert.deepEqual(result.usage, {
    providerRequestId: 'gemini-grounded-1',
    model: 'configured-model-001',
    inputTokens: 90,
    cachedInputTokens: 10,
    outputTokens: 25,
    searchUnits: 2,
  });
});

test('Gemini Web reports unavailable config without constructing a network client', async () => {
  const provider = new GeminiGoogleSearchProvider('', 'configured-model');
  const availability = await provider.availability();
  assert.equal(availability.status, 'unavailable');
  assert.equal(availability.reasonCode, 'research.provider.unavailable_config');
  assert.equal(availability.capabilities.webSearch, false);
  await assert.rejects(
    () => provider.search({ query: 'Question', maxResults: 5 }),
    (error) => error instanceof ResearchProviderError && error.code === 'NO_PROVIDER',
  );
});

test('Gemini prose without grounding metadata never becomes evidence', async () => {
  const provider = new GeminiGoogleSearchProvider('private-key', 'configured-model', {
    generateContent: async () => ({
      text: 'Use https://invented.invalid as a source.',
      candidates: [{ content: { parts: [{ text: 'Generated prose only' }] } }],
    }),
  });
  await assert.rejects(
    () => provider.search({ query: 'Question', maxResults: 5 }),
    (error) => error instanceof ResearchProviderError && error.code === 'NO_RESULTS',
  );
});

test('Gemini provider failures expose stable codes and never inspect provider bodies', async () => {
  const provider = new GeminiGoogleSearchProvider('private-key', 'configured-model', {
    generateContent: async () => { throw Object.assign(new Error('rate limited'), { status: 429 }); },
  });
  await assert.rejects(
    () => provider.search({ query: 'Question', maxResults: 5 }),
    (error) => error instanceof ResearchProviderError && error.code === 'RATE_LIMIT',
  );
});
