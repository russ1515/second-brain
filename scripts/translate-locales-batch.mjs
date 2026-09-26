// Safe asynchronous UI-dictionary translation with the Gemini Batch API.
//
// Dry-run is the default and performs no provider request and no file write:
//   node scripts/translate-locales-batch.mjs --all
//
// Every state-changing phase is explicit and independently resumable:
//   --submit        creates exactly one remote batch job
//   --poll          reads the remote job and persists only validated results
//   --apply-results writes validated translations into locale catalogs
//
// The progress manifest never contains the API key, prompts, source strings or
// raw provider responses. Validated translations live in a separate, checksummed
// result spool below .translation-progress until they are applied.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LANGS,
  SUPPORTED_CODES,
  TranslationPipelineError,
  TranslationValidationError,
  acquireJobLock,
  buildPlan,
  buildPrompt,
  createAttemptLedger,
  generationConfigForModel,
  normalizeUsageMetadata,
  releaseJobLock,
  validateBatchResponse,
  writeLocale,
} from './translate-locale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROGRESS_DIR = path.join(ROOT, 'apps/mobile/lib/locales/.translation-progress');
const DEFAULT_MANIFEST = path.join(PROGRESS_DIR, 'batch-manifest.json');
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 100;
const INLINE_REQUEST_LIMIT_BYTES = 20 * 1024 * 1024;
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const SCHEMA_VERSION = 1;
const PROMPT_VERSION = 'keyed-ui-translation-v2';

export const TERMINAL_BATCH_STATES = Object.freeze(new Set([
  'JOB_STATE_SUCCEEDED',
  'JOB_STATE_PARTIALLY_SUCCEEDED',
  'JOB_STATE_FAILED',
  'JOB_STATE_CANCELLED',
  'JOB_STATE_EXPIRED',
  // Kept for forward compatibility if a Developer API state reaches the SDK
  // before its BATCH_STATE_* -> JOB_STATE_* normalization is updated.
  'BATCH_STATE_PARTIALLY_SUCCEEDED',
  'BATCH_STATE_SUCCEEDED',
  'BATCH_STATE_FAILED',
  'BATCH_STATE_CANCELLED',
  'BATCH_STATE_EXPIRED',
]));

function invariant(condition, message) {
  if (!condition) throw new TranslationPipelineError(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isoTimestamp(clock = Date.now) {
  const value = clock();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

function saveJson(file, value, clock = Date.now) {
  value.updatedAt = isoTimestamp(clock);
  const content = `${JSON.stringify(value, null, 2)}\n`;
  atomicWrite(file, content);
  return sha256(content);
}

function readJson(file, label) {
  invariant(fs.existsSync(file), `${label} does not exist: ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new TranslationPipelineError(`${label} is not valid JSON`);
  }
}

function parseDotEnv(file) {
  if (!fs.existsSync(file)) return new Map();
  const values = new Map();
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2
      && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ) value = value.slice(1, -1);
    values.set(match[1], value);
  }
  return values;
}

function configuredValue(name, dotEnv, fallback) {
  const processValue = process.env[name];
  if (typeof processValue === 'string' && processValue.trim()) return processValue.trim();
  const fileValue = dotEnv.get(name);
  if (typeof fileValue === 'string' && fileValue.trim()) return fileValue.trim();
  return fallback;
}

function optionValue(argv, index, name) {
  if (argv[index] === name) {
    invariant(argv[index + 1] && !argv[index + 1].startsWith('--'), `${name} requires a value`);
    return { value: argv[index + 1], consumed: 2 };
  }
  if (argv[index].startsWith(`${name}=`)) {
    return { value: argv[index].slice(name.length + 1), consumed: 1 };
  }
  return null;
}

function positiveInteger(value, label, maximum) {
  const parsed = Number(value);
  invariant(Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum, `${label} must be an integer from 1 to ${maximum}`);
  return parsed;
}

function safeProgressPath(value, fallback = DEFAULT_MANIFEST) {
  const candidate = path.resolve(ROOT, value ?? fallback);
  const relative = path.relative(PROGRESS_DIR, candidate);
  invariant(
    relative !== ''
    && !relative.startsWith('..')
    && !path.isAbsolute(relative)
    && path.extname(candidate).toLowerCase() === '.json',
    `Batch translation files must be .json files under ${path.relative(ROOT, PROGRESS_DIR).replaceAll('\\', '/')}/`,
  );
  return candidate;
}

function resultPathForManifest(manifestPath) {
  const extension = path.extname(manifestPath);
  return safeProgressPath(`${manifestPath.slice(0, -extension.length)}.results${extension}`);
}

function assertPinnedStableModel(modelName) {
  const modelId = String(modelName).replace(/^models\//, '');
  invariant(/^gemini-\d+(?:\.\d+)?-[a-z0-9-]+$/.test(modelId), 'Batch model must be an explicitly versioned Gemini model');
  invariant(!/(?:latest|preview|experimental|\bexp\b)/i.test(modelId), 'Batch model must not use a latest, preview or experimental alias');
}

export function parseBatchCli(argv, envFile = path.join(ROOT, '.env')) {
  const dotEnv = parseDotEnv(envFile);
  const codes = [];
  let all = false;
  let json = false;
  let help = false;
  let action = 'dry-run';
  let batchValue;
  let manifestValue;
  let modelValue;

  for (let index = 0; index < argv.length;) {
    const argument = argv[index];
    if (argument === '--all') {
      all = true;
      index += 1;
    } else if (argument === '--json') {
      json = true;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      help = true;
      index += 1;
    } else if (['--submit', '--poll', '--apply-results'].includes(argument)) {
      invariant(action === 'dry-run', 'Choose only one of --submit, --poll or --apply-results');
      action = argument.slice(2);
      index += 1;
    } else {
      const batch = optionValue(argv, index, '--batch');
      const manifest = optionValue(argv, index, '--manifest');
      const model = optionValue(argv, index, '--model');
      if (batch) {
        batchValue = batch.value;
        index += batch.consumed;
      } else if (manifest) {
        manifestValue = manifest.value;
        index += manifest.consumed;
      } else if (model) {
        modelValue = model.value;
        index += model.consumed;
      } else if (argument.startsWith('--')) {
        throw new TranslationPipelineError(`Unknown option: ${argument}`);
      } else {
        codes.push(argument);
        index += 1;
      }
    }
  }

  invariant(!(all && codes.length), 'Use either --all or explicit locale codes, not both');
  const selected = all ? [...SUPPORTED_CODES] : [...new Set(codes)];
  if (!help && (action === 'dry-run' || action === 'submit')) {
    invariant(selected.length > 0, 'Select locale codes or use --all for dry-run and submit');
  }
  if (!help && (action === 'poll' || action === 'apply-results')) {
    invariant(!all && selected.length === 0, `${action} reads locale scope from its immutable manifest; do not pass locale codes`);
  }
  for (const code of selected) invariant(LANGS[code], `Unsupported locale code: ${code}`);

  const modelName = modelValue ?? configuredValue('TRANSLATE_BATCH_MODEL', dotEnv, DEFAULT_MODEL);
  assertPinnedStableModel(modelName);
  return {
    action,
    codes: selected,
    json,
    help,
    batchSize: positiveInteger(batchValue ?? configuredValue('TRANSLATE_BATCH', dotEnv, DEFAULT_BATCH_SIZE), 'batch size', MAX_BATCH_SIZE),
    manifestPath: safeProgressPath(manifestValue ?? configuredValue('TRANSLATE_BATCH_MANIFEST', dotEnv, DEFAULT_MANIFEST)),
    modelName,
    apiKey: configuredValue('GEMINI_API_KEY', dotEnv, undefined),
  };
}

function splitEntries(plan, locale) {
  const requests = [];
  for (let start = 0, batchIndex = 0; start < locale.missingKeys.length; start += plan.batchSize, batchIndex += 1) {
    const keys = locale.missingKeys.slice(start, start + plan.batchSize);
    const entries = keys.map((key) => ({ key, source: plan.english.get(key) }));
    requests.push({
      id: `${locale.code}-b${String(batchIndex).padStart(3, '0')}`,
      locale: locale.code,
      language: locale.language,
      batchIndex,
      entries,
      keyCount: keys.length,
      keyChecksum: sha256(JSON.stringify(keys)),
    });
  }
  return requests;
}

function publicRequest(request) {
  return {
    id: request.id,
    locale: request.locale,
    batchIndex: request.batchIndex,
    keyCount: request.keyCount,
    keyChecksum: request.keyChecksum,
    status: 'pending',
  };
}

function mappingChecksum(requests) {
  return sha256(JSON.stringify(requests.map(({ id, locale, batchIndex, keyCount, keyChecksum }) => ({
    id,
    locale,
    batchIndex,
    keyCount,
    keyChecksum,
  }))));
}

/** Build deterministic inlined requests without performing any I/O. */
export function buildBatchSubmission(plan, modelName) {
  assertPinnedStableModel(modelName);
  const requests = plan.locales.flatMap((locale) => splitEntries(plan, locale));
  const generationConfig = generationConfigForModel(modelName);
  const inlinedRequests = requests.map((request) => ({
    contents: [{ role: 'user', parts: [{ text: buildPrompt(request.language, request.entries) }] }],
    config: generationConfig,
    metadata: { requestId: request.id },
  }));
  const payloadBytes = Buffer.byteLength(JSON.stringify(inlinedRequests), 'utf8');
  invariant(payloadBytes < INLINE_REQUEST_LIMIT_BYTES, `Inline Batch payload is ${payloadBytes} bytes; it must stay below ${INLINE_REQUEST_LIMIT_BYTES}`);
  return {
    requests,
    inlinedRequests,
    requestCount: requests.length,
    payloadBytes,
    mappingChecksum: mappingChecksum(requests),
  };
}

function planSummary(plan, submission) {
  return {
    sourceKeyCount: plan.sourceKeyCount,
    sourceChecksum: plan.sourceChecksum,
    totalMissing: plan.totalMissing,
    requestCount: submission.requestCount,
    payloadBytes: submission.payloadBytes,
    mappingChecksum: submission.mappingChecksum,
    locales: plan.locales.map((locale) => ({
      code: locale.code,
      effectiveKeyCount: locale.effectiveKeyCount,
      missingKeyCount: locale.missingKeyCount,
      requestCount: Math.ceil(locale.missingKeyCount / plan.batchSize),
    })),
  };
}

function makeManifest(plan, submission, options, clock) {
  const now = isoTimestamp(clock);
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'second-brain-ui-translation-batch',
    status: 'prepared',
    createdAt: now,
    updatedAt: now,
    promptVersion: PROMPT_VERSION,
    source: {
      keyCount: plan.sourceKeyCount,
      checksum: plan.sourceChecksum,
      fileChecksum: plan.sourceFileChecksum,
      overlayFileChecksums: plan.overlayFileChecksums,
    },
    provider: { name: 'gemini', model: options.modelName },
    batch: {
      jobName: null,
      state: null,
      submittedAt: null,
      lastPolledAt: null,
      pollCount: 0,
      requestCount: submission.requestCount,
      inlinePayloadBytes: submission.payloadBytes,
      mappingChecksum: submission.mappingChecksum,
    },
    limits: { batchSize: options.batchSize, inlineRequestLimitBytes: INLINE_REQUEST_LIMIT_BYTES },
    locales: Object.fromEntries(plan.locales.map((locale) => [locale.code, {
      initialFileChecksum: locale.persistedFileChecksum,
      expectedFileChecksum: locale.persistedFileChecksum,
      initialMissingChecksum: locale.missingChecksum,
      initialMissingKeyCount: locale.missingKeyCount,
      appliedRequestCount: 0,
      appliedKeyCount: 0,
    }])),
    requests: submission.requests.map(publicRequest),
    // This is local maintenance bookkeeping, not the product's commercial quota or billing ledger.
    maintenanceAccounting: { scope: 'local-maintenance-only-non-commercial' },
    results: null,
  };
}

function assertManifest(manifest) {
  invariant(manifest?.schemaVersion === SCHEMA_VERSION, 'Unsupported Batch manifest schema');
  invariant(manifest?.kind === 'second-brain-ui-translation-batch', 'Not a Second Brain translation Batch manifest');
  invariant(Array.isArray(manifest.requests), 'Batch manifest request map is missing');
  invariant(
    new Set(manifest.requests.map((request) => request.id)).size === manifest.requests.length,
    'Batch manifest contains duplicate request IDs',
  );
  invariant(manifest.batch?.mappingChecksum === mappingChecksum(manifest.requests), 'Batch manifest request mapping checksum changed');
  invariant(manifest.provider?.model, 'Batch manifest model is missing');
  assertPinnedStableModel(manifest.provider.model);
}

function assertPlanSnapshot(manifest, plan, { catalogs = true } = {}) {
  invariant(plan.sourceKeyCount === manifest.source.keyCount, 'Source key count changed since Batch submission');
  invariant(plan.sourceChecksum === manifest.source.checksum, 'Source catalog changed since Batch submission');
  invariant(plan.sourceFileChecksum === manifest.source.fileChecksum, 'Source file changed since Batch submission');
  invariant(
    JSON.stringify(plan.overlayFileChecksums) === JSON.stringify(manifest.source.overlayFileChecksums),
    'Locale overlays changed since Batch submission',
  );
  if (catalogs) {
    for (const locale of plan.locales) {
      const snapshot = manifest.locales[locale.code];
      invariant(snapshot, `Missing locale snapshot ${locale.code}`);
      invariant(locale.persistedFileChecksum === snapshot.expectedFileChecksum, `${locale.code} catalog changed outside this Batch job`);
    }
  }
}

async function createClient(apiKey, dependencies) {
  if (dependencies.client) return dependencies.client;
  invariant(apiKey, 'GEMINI_API_KEY is required for --submit and --poll');
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey });
}

function safeJobFailure(job) {
  const code = job?.error?.code;
  return {
    kind: 'batch_job_error',
    code: typeof code === 'number' || typeof code === 'string' ? String(code).slice(0, 64) : null,
  };
}

function safeProviderFailure(error) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  return {
    kind: error instanceof TranslationValidationError ? error.name : 'provider_error',
    httpStatus: Number.isInteger(status) ? status : null,
  };
}

function responseText(response) {
  let text = typeof response?.text === 'function' ? response.text() : response?.text;
  // Batch responses are currently deserialized by @google/genai into a plain
  // GenerateContentResponse-shaped object, without the convenience `text`
  // getter used by models.generateContent(). Reconstruct it from the first
  // candidate while excluding reasoning/thought parts.
  if (typeof text !== 'string') {
    const parts = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      text = parts
        .filter((part) => part?.thought !== true && typeof part?.text === 'string')
        .map((part) => part.text)
        .join('');
    }
  }
  invariant(typeof text === 'string' && text.length > 0, 'Batch response has no text result');
  return text;
}

function reconstructSubmission(manifest, plan) {
  const submission = buildBatchSubmission(plan, manifest.provider.model);
  invariant(submission.mappingChecksum === manifest.batch.mappingChecksum, 'Batch request mapping no longer matches its manifest');
  invariant(submission.requestCount === manifest.batch.requestCount, 'Batch request count no longer matches its manifest');
  return submission;
}

async function submit(options, dependencies) {
  invariant(!fs.existsSync(options.manifestPath), 'Batch manifest already exists; refusing a duplicate submission');
  const plan = buildPlan(options.codes, options.batchSize);
  const submission = buildBatchSubmission(plan, options.modelName);
  invariant(submission.requestCount > 0, 'All selected locales are already complete; no Batch job is needed');
  const clock = dependencies.clock ?? Date.now;
  // Client construction and credential validation are local, pre-send work.
  // Do them before reserving so a local setup refusal cannot strand a pending
  // maintenance reservation.
  const client = await createClient(options.apiKey, dependencies);
  const manifest = makeManifest(plan, submission, options, clock);
  saveJson(options.manifestPath, manifest, clock);

  const ledger = createAttemptLedger(manifest, options.manifestPath, {
    clock,
    idFactory: dependencies.idFactory,
  });
  const attemptId = ledger.reserve({
    locale: 'multi-locale',
    batchIndex: 0,
    batchChecksum: submission.mappingChecksum,
    attemptNumber: 1,
    requestOrdinal: 1,
  });
  const request = {
    model: options.modelName,
    src: submission.inlinedRequests,
    config: { displayName: `second-brain-i18n-${isoTimestamp(clock).slice(0, 10).replaceAll('-', '')}` },
  };

  let pending;
  try {
    pending = client.batches.create(request);
  } catch (error) {
    ledger.release(attemptId, error);
    manifest.status = 'submit_failed_before_send';
    saveJson(options.manifestPath, manifest, clock);
    throw error;
  }
  ledger.markSent(attemptId);

  try {
    const job = await pending;
    invariant(typeof job?.name === 'string' && job.name.length > 0, 'Provider did not return a Batch job name');
    ledger.finalize(attemptId, { outcome: 'accepted', usageMetadata: job.usageMetadata });
    manifest.batch.jobName = job.name;
    manifest.batch.state = job.state ?? 'JOB_STATE_UNSPECIFIED';
    manifest.batch.submittedAt = isoTimestamp(clock);
    manifest.status = 'submitted';
    saveJson(options.manifestPath, manifest, clock);
    return { mode: 'submit', jobName: job.name, state: manifest.batch.state, plan: planSummary(plan, submission) };
  } catch (error) {
    const attempt = manifest.attemptAccounting?.attempts?.find((candidate) => candidate.id === attemptId);
    if (attempt?.state === 'FINALIZATION_PENDING') {
      ledger.finalize(attemptId, { outcome: 'submit_error', error });
    }
    manifest.status = 'submit_failed';
    manifest.failure = safeProviderFailure(error);
    saveJson(options.manifestPath, manifest, clock);
    throw error;
  }
}

function requestErrorResult(descriptor, error) {
  return {
    requestId: descriptor.id,
    locale: descriptor.locale,
    batchIndex: descriptor.batchIndex,
    keyCount: descriptor.keyCount,
    keyChecksum: descriptor.keyChecksum,
    status: 'error',
    failure: error,
  };
}

function captureResults(job, manifest, submission, clock) {
  const responses = Array.isArray(job?.dest?.inlinedResponses) ? job.dest.inlinedResponses : [];
  const results = [];
  for (let index = 0; index < submission.requests.length; index += 1) {
    const request = submission.requests[index];
    const descriptor = manifest.requests[index];
    const inlined = responses[index];
    if (!inlined) {
      results.push(requestErrorResult(descriptor, { kind: 'missing_inlined_response' }));
      continue;
    }
    if (inlined.metadata?.requestId && inlined.metadata.requestId !== descriptor.id) {
      results.push(requestErrorResult(descriptor, { kind: 'metadata_mismatch' }));
      continue;
    }
    if (inlined.error) {
      results.push(requestErrorResult(descriptor, safeJobFailure(inlined)));
      continue;
    }
    try {
      const translations = validateBatchResponse(responseText(inlined.response), request.entries);
      results.push({
        requestId: descriptor.id,
        locale: descriptor.locale,
        batchIndex: descriptor.batchIndex,
        keyCount: descriptor.keyCount,
        keyChecksum: descriptor.keyChecksum,
        status: 'validated',
        usageMetadata: normalizeUsageMetadata(inlined.response?.usageMetadata),
        items: [...translations].map(([key, translation]) => ({ key, translation })),
      });
    } catch (error) {
      results.push(requestErrorResult(descriptor, safeProviderFailure(error)));
    }
  }
  return {
    schemaVersion: 1,
    kind: 'second-brain-ui-translation-batch-results',
    createdAt: isoTimestamp(clock),
    updatedAt: isoTimestamp(clock),
    sourceChecksum: manifest.source.checksum,
    mappingChecksum: manifest.batch.mappingChecksum,
    jobName: manifest.batch.jobName,
    jobState: job.state,
    requests: results,
  };
}

async function poll(options, dependencies) {
  const clock = dependencies.clock ?? Date.now;
  const manifest = readJson(options.manifestPath, 'Batch manifest');
  assertManifest(manifest);
  invariant(manifest.batch.jobName, 'Batch manifest has no submitted job');
  if (manifest.results?.checksum) {
    return { mode: 'poll', state: manifest.batch.state, terminal: true, cached: true, results: manifest.results };
  }
  const codes = Object.keys(manifest.locales);
  const plan = buildPlan(codes, manifest.limits.batchSize);
  assertPlanSnapshot(manifest, plan);
  const submission = reconstructSubmission(manifest, plan);
  const client = await createClient(options.apiKey, dependencies);
  const job = await client.batches.get({ name: manifest.batch.jobName });
  const state = job?.state ?? 'JOB_STATE_UNSPECIFIED';
  manifest.batch.state = state;
  manifest.batch.lastPolledAt = isoTimestamp(clock);
  manifest.batch.pollCount += 1;

  if (!TERMINAL_BATCH_STATES.has(state)) {
    manifest.status = 'running';
    saveJson(options.manifestPath, manifest, clock);
    return { mode: 'poll', state, terminal: false };
  }

  const resultPath = resultPathForManifest(options.manifestPath);
  const resultSpool = captureResults(job, manifest, submission, clock);
  const resultChecksum = saveJson(resultPath, resultSpool, clock);
  const successfulRequests = resultSpool.requests.filter((request) => request.status === 'validated').length;
  const failedRequests = resultSpool.requests.length - successfulRequests;
  manifest.results = {
    file: path.relative(ROOT, resultPath).replaceAll('\\', '/'),
    checksum: resultChecksum,
    successfulRequests,
    failedRequests,
    capturedAt: isoTimestamp(clock),
  };
  manifest.status = state === 'JOB_STATE_SUCCEEDED' && failedRequests === 0 ? 'results_ready' : 'results_ready_partial';
  if (['JOB_STATE_FAILED', 'JOB_STATE_CANCELLED', 'JOB_STATE_EXPIRED'].includes(state)) {
    manifest.failure = safeJobFailure(job);
  }
  saveJson(options.manifestPath, manifest, clock);
  return { mode: 'poll', state, terminal: true, results: manifest.results };
}

function loadResultSpool(manifest, manifestPath) {
  invariant(manifest.results?.file && manifest.results?.checksum, 'No captured Batch results; run --poll after the job is terminal');
  const resultPath = safeProgressPath(manifest.results.file);
  const raw = fs.readFileSync(resultPath, 'utf8');
  invariant(sha256(raw) === manifest.results.checksum, 'Batch result spool checksum changed');
  const spool = readJson(resultPath, 'Batch result spool');
  invariant(spool?.kind === 'second-brain-ui-translation-batch-results', 'Invalid Batch result spool');
  invariant(spool.sourceChecksum === manifest.source.checksum, 'Batch result source checksum changed');
  invariant(spool.mappingChecksum === manifest.batch.mappingChecksum, 'Batch result mapping checksum changed');
  invariant(spool.jobName === manifest.batch.jobName, 'Batch result job name changed');
  invariant(Array.isArray(spool.requests), 'Batch result request map is missing');
  invariant(spool.requests.length === manifest.requests.length, 'Batch result request count changed');
  const resultIds = spool.requests.map((request) => request.requestId);
  invariant(new Set(resultIds).size === resultIds.length, 'Batch result contains duplicate request IDs');
  invariant(
    resultIds.every((id) => manifest.requests.some((request) => request.id === id)),
    'Batch result contains an unknown request ID',
  );
  invariant(path.dirname(resultPath) === path.dirname(manifestPath), 'Batch result spool must remain beside its manifest');
  return spool;
}

function validateStoredResult(result, descriptor, english) {
  invariant(result.requestId === descriptor.id, `Result request ID mismatch for ${descriptor.id}`);
  invariant(result.locale === descriptor.locale && result.batchIndex === descriptor.batchIndex, `Result mapping mismatch for ${descriptor.id}`);
  invariant(Array.isArray(result.items) && result.items.length === descriptor.keyCount, `Result item count mismatch for ${descriptor.id}`);
  const keys = result.items.map((item) => item.key);
  invariant(sha256(JSON.stringify(keys)) === descriptor.keyChecksum, `Result key checksum mismatch for ${descriptor.id}`);
  const entries = result.items.map((item) => {
    invariant(english.has(item.key), `Result contains unknown source key ${item.key}`);
    return { key: item.key, source: english.get(item.key) };
  });
  return validateBatchResponse(JSON.stringify(result.items), entries);
}

async function applyResults(options, dependencies) {
  const clock = dependencies.clock ?? Date.now;
  const manifest = readJson(options.manifestPath, 'Batch manifest');
  assertManifest(manifest);
  const spool = loadResultSpool(manifest, options.manifestPath);
  const codes = Object.keys(manifest.locales);
  const plan = buildPlan(codes, manifest.limits.batchSize);
  assertPlanSnapshot(manifest, plan, { catalogs: false });
  const byRequest = new Map(spool.requests.map((request) => [request.requestId, request]));
  const validByLocale = new Map();
  let validationFailures = 0;

  for (const descriptor of manifest.requests) {
    if (descriptor.status === 'applied' || descriptor.status === 'provider_error' || descriptor.status === 'validation_error') continue;
    const result = byRequest.get(descriptor.id);
    if (!result || result.status !== 'validated') {
      descriptor.status = 'provider_error';
      descriptor.failure = result?.failure ?? { kind: 'missing_result' };
      continue;
    }
    try {
      const translations = validateStoredResult(result, descriptor, plan.english);
      if (!validByLocale.has(descriptor.locale)) validByLocale.set(descriptor.locale, []);
      validByLocale.get(descriptor.locale).push({ descriptor, translations });
    } catch (error) {
      descriptor.status = 'validation_error';
      descriptor.failure = safeProviderFailure(error);
      validationFailures += 1;
    }
  }

  const writeCatalog = dependencies.writeLocale ?? writeLocale;
  let appliedRequests = 0;
  let appliedKeys = 0;
  for (const localePlan of plan.locales) {
    const pending = validByLocale.get(localePlan.code) ?? [];
    if (!pending.length) continue;
    const snapshot = manifest.locales[localePlan.code];
    const merged = new Map(localePlan.base);
    for (const { translations } of pending) {
      for (const [key, value] of translations) {
        invariant(!merged.has(key) || merged.get(key) === value, `${localePlan.code}.${key} conflicts with an existing translation`);
        merged.set(key, value);
      }
    }

    invariant(
      localePlan.persistedFileChecksum === snapshot.expectedFileChecksum,
      `${localePlan.code} catalog changed outside this Batch job`,
    );
    const writtenChecksum = await writeCatalog(localePlan.code, merged);
    invariant(typeof writtenChecksum === 'string' && writtenChecksum.length > 0, `${localePlan.code} writer did not return a checksum`);
    snapshot.expectedFileChecksum = writtenChecksum;

    for (const { descriptor, translations } of pending) {
      descriptor.status = 'applied';
      descriptor.appliedAt = isoTimestamp(clock);
      snapshot.appliedRequestCount += 1;
      snapshot.appliedKeyCount += translations.size;
      appliedRequests += 1;
      appliedKeys += translations.size;
    }
    saveJson(options.manifestPath, manifest, clock);
  }

  const remaining = manifest.requests.filter((request) => request.status === 'pending').length;
  const failures = manifest.requests.filter((request) => ['provider_error', 'validation_error'].includes(request.status)).length;
  manifest.status = remaining === 0 && failures === 0 ? 'complete' : 'applied_partial';
  saveJson(options.manifestPath, manifest, clock);
  return {
    mode: 'apply-results',
    status: manifest.status,
    appliedRequests,
    appliedKeys,
    validationFailures,
    failedRequests: failures,
    remainingRequests: remaining,
  };
}

/** Run one explicit Batch phase. Dependencies are injectable for zero-network tests. */
export async function runBatchTranslation(options, dependencies = {}) {
  assertPinnedStableModel(options.modelName);
  if (options.action === 'dry-run') {
    const plan = buildPlan(options.codes, options.batchSize);
    const submission = buildBatchSubmission(plan, options.modelName);
    return { mode: 'dry-run', providerCalls: 0, plan: planSummary(plan, submission) };
  }

  invariant(['submit', 'poll', 'apply-results'].includes(options.action), `Unsupported Batch action ${options.action}`);
  const acquire = dependencies.acquireLock ?? acquireJobLock;
  const release = dependencies.releaseLock ?? releaseJobLock;
  const lock = acquire({ manifestPath: options.manifestPath }, dependencies);
  try {
    if (options.action === 'submit') return await submit(options, dependencies);
    if (options.action === 'poll') return await poll(options, dependencies);
    return await applyResults(options, dependencies);
  } finally {
    release(lock);
  }
}

function usage() {
  return `Usage:
  node scripts/translate-locales-batch.mjs --all
  node scripts/translate-locales-batch.mjs es de
  node scripts/translate-locales-batch.mjs --submit --all --manifest apps/mobile/lib/locales/.translation-progress/batch.json
  node scripts/translate-locales-batch.mjs --poll --manifest apps/mobile/lib/locales/.translation-progress/batch.json
  node scripts/translate-locales-batch.mjs --apply-results --manifest apps/mobile/lib/locales/.translation-progress/batch.json

Dry-run is the default. Exactly one explicit phase may be selected.
Options: --all, --submit, --poll, --apply-results, --batch N, --model NAME,
         --manifest PATH, --json, --help`;
}

async function main() {
  const options = parseBatchCli(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const result = await runBatchTranslation(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (result.mode === 'dry-run') {
    console.log(`DRY RUN: ${result.plan.totalMissing} translations in ${result.plan.requestCount} inlined requests (${result.plan.payloadBytes} bytes).`);
    console.log('No provider request, manifest or catalog write was performed.');
  } else if (result.mode === 'submit') {
    console.log(`SUBMITTED: ${result.jobName} (${result.state}).`);
  } else if (result.mode === 'poll') {
    console.log(`POLL: ${result.state}; terminal=${result.terminal}.`);
  } else {
    console.log(`APPLY: ${result.appliedKeys} keys from ${result.appliedRequests} requests; status=${result.status}.`);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(`Batch translation stopped: ${error instanceof TranslationPipelineError ? error.message : (error?.name || 'provider error')}`);
    process.exitCode = 1;
  });
}
