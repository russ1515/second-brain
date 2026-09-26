import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildBatchSubmission,
  parseBatchCli,
  runBatchTranslation,
} from '../../../scripts/translate-locales-batch.mjs';
import { buildPlan } from '../../../scripts/translate-locale.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PROGRESS = path.join(ROOT, 'apps/mobile/lib/locales/.translation-progress');
// Keep repository-backed Batch fixtures on a deliberately incomplete locale.
// Spanish is now complete, so using it correctly produces no Batch request.
const TEST_LOCALE = 'ja';

function checksum(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fixture(t, name) {
  fs.mkdirSync(PROGRESS, { recursive: true });
  const id = `${name}-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const manifestPath = path.join(PROGRESS, `${id}.json`);
  const resultPath = path.join(PROGRESS, `${id}.results.json`);
  t.after(() => {
    fs.rmSync(manifestPath, { force: true });
    fs.rmSync(resultPath, { force: true });
  });
  return { manifestPath, resultPath };
}

function options(manifestPath, action, overrides = {}) {
  return {
    action,
    codes: action === 'submit' || action === 'dry-run' ? [TEST_LOCALE] : [],
    batchSize: 100,
    manifestPath,
    modelName: 'gemini-3.5-flash-lite',
    apiKey: 'test-placeholder-never-sent',
    ...overrides,
  };
}

function dependencies(client, overrides = {}) {
  return {
    client,
    acquireLock: () => ({ test: true }),
    releaseLock: () => {},
    idFactory: () => 'test-submit-attempt',
    clock: () => '2026-09-24T15:00:00.000Z',
    ...overrides,
  };
}

function entriesFromInlineRequest(request) {
  const prompt = request.contents[0].parts[0].text;
  return JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
}

function translatedResponse(request, mutate = (items) => items) {
  const items = entriesFromInlineRequest(request).map(({ key, source }) => ({ key, translation: source }));
  return {
    metadata: request.metadata,
    response: {
      candidates: [{
        content: {
          parts: [
            { thought: true, text: 'private reasoning must be ignored' },
            { text: JSON.stringify(mutate(items)) },
          ],
        },
      }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
    },
  };
}

async function submittedFixture(t, name = 'submitted') {
  const paths = fixture(t, name);
  let createInput;
  const client = {
    batches: {
      create(input) {
        createInput = input;
        return Promise.resolve({ name: `batches/${name}`, state: 'JOB_STATE_QUEUED' });
      },
      get() {
        throw new Error('not configured');
      },
    },
  };
  await runBatchTranslation(options(paths.manifestPath, 'submit'), dependencies(client));
  return { ...paths, client, createInput };
}

test('Batch dry-run plans inlined requests and performs zero calls or writes', async (t) => {
  const { manifestPath } = fixture(t, 'dry-run');
  let calls = 0;
  const plan = buildPlan([TEST_LOCALE], 100);
  const submission = buildBatchSubmission(plan, 'gemini-3.5-flash-lite');
  assert.equal(submission.requestCount, Math.ceil(plan.totalMissing / 100));
  assert.ok(submission.payloadBytes > 0 && submission.payloadBytes < 20 * 1024 * 1024);
  assert.equal(submission.inlinedRequests[0].metadata.requestId, `${TEST_LOCALE}-b000`);
  assert.equal(submission.inlinedRequests[0].config.responseMimeType, 'application/json');

  const result = await runBatchTranslation(options(manifestPath, 'dry-run'), {
    client: { batches: { create: () => { calls += 1; }, get: () => { calls += 1; } } },
  });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.providerCalls, 0);
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(manifestPath), false);
});

test('CLI requires explicit phases, confined manifests and a pinned stable model', () => {
  const missingEnv = path.join(PROGRESS, 'definitely-missing.env');
  const dry = parseBatchCli(['es'], missingEnv);
  assert.equal(dry.action, 'dry-run');
  assert.equal(dry.modelName, 'gemini-3.5-flash-lite');
  assert.throws(() => parseBatchCli(['--submit', '--poll', 'es'], missingEnv), /only one/);
  assert.throws(() => parseBatchCli(['--poll', 'es'], missingEnv), /reads locale scope/);
  assert.throws(() => parseBatchCli(['es', '--model', 'gemini-flash-lite-latest'], missingEnv), /explicitly versioned|latest/);
  assert.throws(() => parseBatchCli(['es', '--manifest', 'outside.json'], missingEnv), /under apps\/mobile\/lib\/locales\/\.translation-progress/);
});

test('submit sends the exact official Batch shape once and refuses duplicate submission', async (t) => {
  const { manifestPath } = fixture(t, 'submit-once');
  let createCalls = 0;
  let sent;
  const client = {
    batches: {
      create(input) {
        createCalls += 1;
        const persisted = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        assert.equal(persisted.attemptAccounting.attempts[0].state, 'FINALIZATION_PENDING');
        assert.equal(persisted.attemptAccounting.attempts[0].phase, 'RESERVED');
        sent = input;
        return Promise.resolve({ name: 'batches/test-job', state: 'JOB_STATE_QUEUED' });
      },
    },
  };

  const result = await runBatchTranslation(options(manifestPath, 'submit'), dependencies(client));
  assert.equal(result.jobName, 'batches/test-job');
  assert.equal(createCalls, 1);
  assert.equal(sent.model, 'gemini-3.5-flash-lite');
  assert.ok(Array.isArray(sent.src) && sent.src.length > 0);
  assert.deepEqual(Object.keys(sent.src[0]).sort(), ['config', 'contents', 'metadata']);
  assert.match(sent.config.displayName, /^second-brain-i18n-\d{8}$/);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.batch.jobName, 'batches/test-job');
  assert.equal(manifest.maintenanceAccounting.scope, 'local-maintenance-only-non-commercial');
  assert.deepEqual(manifest.attemptAccounting.audit.map((entry) => entry.event), ['RESERVE', 'SEND', 'FINALIZE']);
  assert.equal(manifest.attemptAccounting.attempts[0].state, 'FINALIZED');
  assert.equal(JSON.stringify(manifest).includes('test-placeholder-never-sent'), false);
  assert.equal(JSON.stringify(manifest).includes('You are a professional UI translator'), false);

  await assert.rejects(
    runBatchTranslation(options(manifestPath, 'submit'), dependencies(client)),
    /already exists/,
  );
  assert.equal(createCalls, 1);
});

test('submit releases only a synchronous pre-send refusal and finalizes an asynchronous failure', async (t) => {
  const beforeSend = fixture(t, 'submit-sync-refusal');
  const syncClient = {
    batches: {
      create() {
        throw Object.assign(new Error('local SDK refusal'), { status: 400 });
      },
    },
  };
  await assert.rejects(
    runBatchTranslation(options(beforeSend.manifestPath, 'submit'), dependencies(syncClient)),
    /local SDK refusal/,
  );
  const released = JSON.parse(fs.readFileSync(beforeSend.manifestPath, 'utf8'));
  assert.deepEqual(released.attemptAccounting.audit.map((entry) => entry.event), ['RESERVE', 'RELEASE']);
  assert.equal(released.attemptAccounting.attempts[0].state, 'RELEASED');

  const afterSend = fixture(t, 'submit-async-failure');
  const asyncClient = {
    batches: {
      create() {
        return Promise.reject(Object.assign(new Error('remote failure'), { status: 503 }));
      },
    },
  };
  await assert.rejects(
    runBatchTranslation(options(afterSend.manifestPath, 'submit'), dependencies(asyncClient)),
    /remote failure/,
  );
  const finalized = JSON.parse(fs.readFileSync(afterSend.manifestPath, 'utf8'));
  assert.deepEqual(finalized.attemptAccounting.audit.map((entry) => entry.event), ['RESERVE', 'SEND', 'FINALIZE']);
  assert.equal(finalized.attemptAccounting.attempts[0].state, 'FINALIZED');
  assert.equal(finalized.attemptAccounting.attempts[0].failure.httpStatus, 503);
});

test('poll persists nonterminal state, then captures only validated terminal results', async (t) => {
  const state = await submittedFixture(t, 'poll-state');
  let poll = 0;
  state.client.batches.get = async ({ name }) => {
    assert.equal(name, 'batches/poll-state');
    poll += 1;
    if (poll === 1) return { name, state: 'JOB_STATE_RUNNING' };
    return {
      name,
      state: 'JOB_STATE_PARTIALLY_SUCCEEDED',
      dest: {
        inlinedResponses: state.createInput.src.map((request, index) => (
          index === 1
            ? { metadata: request.metadata, error: { code: 500, message: 'raw provider message must not persist' } }
            : translatedResponse(request)
        )),
      },
    };
  };

  const running = await runBatchTranslation(options(state.manifestPath, 'poll'), dependencies(state.client));
  assert.equal(running.state, 'JOB_STATE_RUNNING');
  assert.equal(running.terminal, false);
  assert.equal(fs.existsSync(state.resultPath), false);

  const terminal = await runBatchTranslation(options(state.manifestPath, 'poll'), dependencies(state.client));
  assert.equal(terminal.state, 'JOB_STATE_PARTIALLY_SUCCEEDED');
  assert.equal(terminal.terminal, true);
  assert.equal(terminal.results.failedRequests, 1);
  const spool = JSON.parse(fs.readFileSync(state.resultPath, 'utf8'));
  assert.equal(spool.requests[0].status, 'validated');
  assert.equal(spool.requests[1].status, 'error');
  assert.equal(JSON.stringify(spool).includes('raw provider message'), false);
  assert.equal(JSON.stringify(spool).includes('You are a professional UI translator'), false);

  const cached = await runBatchTranslation(options(state.manifestPath, 'poll'), dependencies(state.client));
  assert.equal(cached.cached, true);
  assert.equal(poll, 2);
});

test('apply preserves successful requests when another provider item failed and is idempotent', async (t) => {
  const state = await submittedFixture(t, 'apply-partial');
  state.client.batches.get = async () => ({
    name: 'batches/apply-partial',
    state: 'JOB_STATE_PARTIALLY_SUCCEEDED',
    dest: {
      inlinedResponses: state.createInput.src.map((request, index) => (
        index === 0 ? { metadata: request.metadata, error: { code: 503 } } : translatedResponse(request)
      )),
    },
  });
  await runBatchTranslation(options(state.manifestPath, 'poll'), dependencies(state.client));

  const writes = [];
  const applyDependencies = dependencies(state.client, {
    writeLocale(code, catalog) {
      writes.push({ code, catalog: new Map(catalog) });
      return `fake-checksum-${writes.length}`;
    },
  });
  const applied = await runBatchTranslation(options(state.manifestPath, 'apply-results'), applyDependencies);
  assert.equal(applied.failedRequests, 1);
  assert.equal(applied.appliedRequests, state.createInput.src.length - 1);
  assert.ok(applied.appliedKeys > 0);
  assert.equal(writes.length, 1);

  const again = await runBatchTranslation(options(state.manifestPath, 'apply-results'), applyDependencies);
  assert.equal(again.appliedRequests, 0);
  assert.equal(writes.length, 1);
  const manifest = JSON.parse(fs.readFileSync(state.manifestPath, 'utf8'));
  assert.equal(manifest.requests[0].status, 'provider_error');
  assert.ok(manifest.requests.slice(1).every((request) => request.status === 'applied'));
});

test('apply revalidates stored translations and preserves other valid batches', async (t) => {
  const state = await submittedFixture(t, 'apply-validation');
  state.client.batches.get = async () => ({
    name: 'batches/apply-validation',
    state: 'JOB_STATE_SUCCEEDED',
    dest: { inlinedResponses: state.createInput.src.map((request) => translatedResponse(request)) },
  });
  await runBatchTranslation(options(state.manifestPath, 'poll'), dependencies(state.client));

  const spool = JSON.parse(fs.readFileSync(state.resultPath, 'utf8'));
  spool.requests[0].items[0].translation = '';
  const spoolContent = `${JSON.stringify(spool, null, 2)}\n`;
  fs.writeFileSync(state.resultPath, spoolContent, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(state.manifestPath, 'utf8'));
  manifest.results.checksum = checksum(spoolContent);
  fs.writeFileSync(state.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  let writes = 0;
  const applied = await runBatchTranslation(options(state.manifestPath, 'apply-results'), dependencies(state.client, {
    writeLocale() {
      writes += 1;
      return 'validated-partial-checksum';
    },
  }));
  assert.equal(applied.validationFailures, 1);
  assert.equal(applied.appliedRequests, state.createInput.src.length - 1);
  assert.equal(writes, 1);
  const after = JSON.parse(fs.readFileSync(state.manifestPath, 'utf8'));
  assert.equal(after.requests[0].status, 'validation_error');
  assert.ok(after.requests.slice(1).every((request) => request.status === 'applied'));
});

test('apply rejects a changed result checksum before any catalog write', async (t) => {
  const state = await submittedFixture(t, 'apply-checksum');
  state.client.batches.get = async () => ({
    name: 'batches/apply-checksum',
    state: 'JOB_STATE_SUCCEEDED',
    dest: { inlinedResponses: state.createInput.src.map((request) => translatedResponse(request)) },
  });
  await runBatchTranslation(options(state.manifestPath, 'poll'), dependencies(state.client));
  fs.appendFileSync(state.resultPath, ' ', 'utf8');
  let writes = 0;
  await assert.rejects(
    runBatchTranslation(options(state.manifestPath, 'apply-results'), dependencies(state.client, {
      writeLocale() {
        writes += 1;
        return 'must-not-write';
      },
    })),
    /spool checksum changed/,
  );
  assert.equal(writes, 0);
});
