'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const mobileRoot = path.resolve(__dirname, '..');

function loadSpeechApi(api) {
  const filename = path.join(mobileRoot, 'lib/speech-api.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const normalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => id === './client' ? { api } : normalRequire(id);
  compiled._compile(js, filename);
  return compiled.exports;
}

function createHarness() {
  const calls = [];
  const api = (_path, options) => new Promise((resolve, reject) => {
    const abort = () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    };
    calls.push({ options, resolve, reject });
    options.signal.addEventListener('abort', abort, { once: true });
    if (options.signal.aborted) abort();
  });
  return { api, calls };
}

const audio = { audioBase64: 'YQ==', mimeType: 'audio/mpeg' };

test('abortable narrations never share one caller-owned in-flight promise', async () => {
  const harness = createHarness();
  const speech = loadSpeechApi(harness.api);
  const firstOwner = new AbortController();
  const secondOwner = new AbortController();

  const first = speech.synthesize('same text', 'fr', firstOwner.signal);
  const second = speech.synthesize('same text', 'fr', secondOwner.signal);
  assert.equal(harness.calls.length, 2);

  firstOwner.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(harness.calls[1].options.signal.aborted, false);
  harness.calls[1].resolve(audio);
  assert.deepEqual(await second, audio);
});

test('Retry starts a new synthesis instead of reusing an aborted promise', async () => {
  const harness = createHarness();
  const speech = loadSpeechApi(harness.api);
  const stopped = new AbortController();

  const first = speech.synthesize('retry me', 'fr', stopped.signal, 'tts-stable-retry');
  stopped.abort();
  await assert.rejects(first, { name: 'AbortError' });

  const retryOwner = new AbortController();
  const retry = speech.synthesize('retry me', 'fr', retryOwner.signal, 'tts-stable-retry');
  assert.equal(harness.calls.length, 2);
  assert.notEqual(retry, first);
  assert.equal(harness.calls[1].options.signal.aborted, false);
  assert.equal(harness.calls[0].options.requestId, 'tts-stable-retry');
  assert.equal(harness.calls[1].options.requestId, 'tts-stable-retry');
  harness.calls[1].resolve(audio);
  assert.deepEqual(await retry, audio);
});

test('clearing account speech aborts requests and cannot poison the next account', async () => {
  const harness = createHarness();
  const speech = loadSpeechApi(harness.api);

  const previousAccount = speech.synthesize('private narration', 'fr');
  speech.clearSpeechCache();
  await assert.rejects(previousAccount, { name: 'AbortError' });
  assert.equal(harness.calls[0].options.signal.aborted, true);

  const nextAccount = speech.synthesize('private narration', 'fr');
  assert.equal(harness.calls.length, 2);
  assert.notEqual(nextAccount, previousAccount);
  assert.equal(harness.calls[1].options.signal.aborted, false);
  harness.calls[1].resolve(audio);
  assert.deepEqual(await nextAccount, audio);
});

test('non-cancellable duplicate calls retain bounded in-flight deduplication', async () => {
  const harness = createHarness();
  const speech = loadSpeechApi(harness.api);

  const first = speech.synthesize('shared safe request', 'fr');
  const second = speech.synthesize('shared safe request', 'fr');
  assert.equal(first, second);
  assert.equal(harness.calls.length, 1);
  harness.calls[0].resolve(audio);
  assert.deepEqual(await first, audio);
  assert.deepEqual(await second, audio);
});
