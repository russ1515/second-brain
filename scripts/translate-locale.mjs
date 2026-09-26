// Safe, resumable UI-dictionary translator.
//
// Dry-run is the default and performs no provider request and no write:
//   node scripts/translate-locale.mjs --all
//   node scripts/translate-locale.mjs es de
//
// Network calls and catalog writes require the explicit --apply flag. Keep runs
// bounded with --max-requests and --max-attempts; a low request ceiling is the
// default so a 25-language run has to state its budget deliberately.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'apps/mobile/lib/i18n.tsx');
const OUT_DIR = path.join(ROOT, 'apps/mobile/lib/locales');
const ESSENTIAL_FILE = path.join(OUT_DIR, 'essential.ts');
const REVIEW_FILE = path.join(OUT_DIR, 'review.ts');
const PROGRESS_DIR = path.join(OUT_DIR, '.translation-progress');
const DEFAULT_MANIFEST = path.join(PROGRESS_DIR, 'manifest.json');
const JOB_LOCK = path.join(PROGRESS_DIR, 'apply.lock');

const DEFAULT_BATCH_SIZE = 60;
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_MIN_INTERVAL_MS = 4500;
const DEFAULT_CONCURRENCY = 1;
const MAX_BATCH_SIZE = 100;
const MAX_CONCURRENCY = 8;
const MAX_OUTPUT_TOKENS = 16384;
const TEMPERATURE = 0.1;
const PROMPT_VERSION = 'keyed-ui-translation-v2';
const BRANDS = ['Second Brain', 'FSRS', 'Gemini'];
const EMOJI_PATTERN = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu;

// code -> { name (native), language (English name for the prompt) }
export const LANGS = Object.freeze({
  es: { name: 'Español', language: 'Spanish' },
  de: { name: 'Deutsch', language: 'German' },
  it: { name: 'Italiano', language: 'Italian' },
  pt: { name: 'Português', language: 'Portuguese' },
  nl: { name: 'Nederlands', language: 'Dutch' },
  pl: { name: 'Polski', language: 'Polish' },
  ru: { name: 'Русский', language: 'Russian' },
  zh: { name: '中文', language: 'Chinese (Simplified)' },
  ja: { name: '日本語', language: 'Japanese' },
  ko: { name: '한국어', language: 'Korean' },
  ar: { name: 'العربية', language: 'Arabic' },
  hi: { name: 'हिन्दी', language: 'Hindi' },
  tr: { name: 'Türkçe', language: 'Turkish' },
  sv: { name: 'Svenska', language: 'Swedish' },
  vi: { name: 'Tiếng Việt', language: 'Vietnamese' },
  th: { name: 'ไทย', language: 'Thai' },
  el: { name: 'Ελληνικά', language: 'Greek' },
  cs: { name: 'Čeština', language: 'Czech' },
  ro: { name: 'Română', language: 'Romanian' },
  hu: { name: 'Magyar', language: 'Hungarian' },
  da: { name: 'Dansk', language: 'Danish' },
  fi: { name: 'Suomi', language: 'Finnish' },
  id: { name: 'Bahasa Indonesia', language: 'Indonesian' },
  no: { name: 'Norsk', language: 'Norwegian' },
  uk: { name: 'Українська', language: 'Ukrainian' },
});

export const SUPPORTED_CODES = Object.freeze(Object.keys(LANGS));

export class TranslationPipelineError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranslationPipelineError';
  }
}

export class TranslationValidationError extends TranslationPipelineError {
  constructor(message) {
    super(message);
    this.name = 'TranslationValidationError';
  }
}

function invariant(condition, message) {
  if (!condition) throw new TranslationPipelineError(message);
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current)
    || ts.isSatisfiesExpression?.(current)
    || ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(property) {
  if (!property.name) return null;
  if (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) {
    return property.name.text;
  }
  return null;
}

function sourceFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function objectLiteral(file, variableName) {
  const source = sourceFile(file);
  let result;

  function visit(node) {
    if (
      ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === variableName
      && node.initializer
    ) {
      const initializer = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) result = initializer;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  invariant(result, `Missing object literal ${variableName} in ${path.relative(ROOT, file)}`);
  return result;
}

/** Parse a TypeScript object literal containing only string values. */
export function readCatalog(file, variableName) {
  const object = objectLiteral(file, variableName);
  const entries = new Map();

  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = propertyName(property);
    const value = unwrap(property.initializer);
    invariant(key, `Unsupported catalog key in ${path.relative(ROOT, file)}`);
    invariant(ts.isStringLiteralLike(value), `Non-string translation for ${key}`);
    invariant(!entries.has(key), `Duplicate translation key ${key}`);
    entries.set(key, value.text);
  }

  return entries;
}

/** Parse a code -> translation-object TypeScript literal. */
export function readNestedCatalog(file, variableName) {
  const object = objectLiteral(file, variableName);
  const catalogs = new Map();

  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const code = propertyName(property);
    const value = unwrap(property.initializer);
    invariant(code && ts.isObjectLiteralExpression(value), `Invalid nested catalog ${code ?? '<unknown>'}`);
    const entries = new Map();
    for (const entry of value.properties) {
      invariant(ts.isPropertyAssignment(entry), `Invalid entry in nested catalog ${code}`);
      const key = propertyName(entry);
      const translation = unwrap(entry.initializer);
      invariant(key && ts.isStringLiteralLike(translation), `Invalid translation in nested catalog ${code}`);
      invariant(!entries.has(key), `Duplicate translation key ${code}.${key}`);
      entries.set(key, translation.text);
    }
    catalogs.set(code, entries);
  }

  return catalogs;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function catalogChecksum(catalog) {
  return sha256(JSON.stringify([...catalog.entries()]));
}

function batchesFor(count, batchSize) {
  return count === 0 ? 0 : Math.ceil(count / batchSize);
}

/** Build the complete, side-effect-free translation plan. */
export function buildPlan(codes, batchSize = DEFAULT_BATCH_SIZE) {
  const english = readCatalog(I18N, 'en');
  const essentials = readNestedCatalog(ESSENTIAL_FILE, 'essential');
  const reviews = readNestedCatalog(REVIEW_FILE, 'review');
  const locales = [];

  for (const code of codes) {
    invariant(LANGS[code], `Unsupported locale code: ${code}`);
    const file = path.join(OUT_DIR, `${code}.ts`);
    const base = readCatalog(file, code);
    const essential = essentials.get(code) ?? new Map();
    const review = reviews.get(code) ?? new Map();
    const effective = new Map([...base, ...essential, ...review]);
    const missingKeys = [...english.keys()].filter((key) => !effective.has(key));

    for (const key of effective.keys()) {
      invariant(english.has(key), `${code} contains unknown translation key ${key}`);
    }

    locales.push({
      code,
      language: LANGS[code].language,
      file,
      base,
      effective,
      persistedFileChecksum: sha256(fs.readFileSync(file)),
      baseKeyCount: base.size,
      effectiveKeyCount: effective.size,
      missingKeys,
      missingKeyCount: missingKeys.length,
      minimumRequests: batchesFor(missingKeys.length, batchSize),
      missingChecksum: sha256(JSON.stringify(missingKeys)),
    });
  }

  return {
    english,
    sourceKeyCount: english.size,
    sourceChecksum: catalogChecksum(english),
    sourceFileChecksum: sha256(fs.readFileSync(I18N)),
    overlayFileChecksums: {
      essential: sha256(fs.readFileSync(ESSENTIAL_FILE)),
      review: sha256(fs.readFileSync(REVIEW_FILE)),
    },
    batchSize,
    locales,
    totalMissing: locales.reduce((sum, locale) => sum + locale.missingKeyCount, 0),
    minimumRequests: locales.reduce((sum, locale) => sum + locale.minimumRequests, 0),
  };
}

function publicPlan(plan) {
  return {
    source: path.relative(ROOT, I18N).replaceAll('\\', '/'),
    sourceKeyCount: plan.sourceKeyCount,
    sourceChecksum: plan.sourceChecksum,
    sourceFileChecksum: plan.sourceFileChecksum,
    overlayFileChecksums: plan.overlayFileChecksums,
    batchSize: plan.batchSize,
    totalMissing: plan.totalMissing,
    minimumRequests: plan.minimumRequests,
    locales: plan.locales.map((locale) => ({
      code: locale.code,
      baseKeyCount: locale.baseKeyCount,
      effectiveKeyCount: locale.effectiveKeyCount,
      missingKeyCount: locale.missingKeyCount,
      minimumRequests: locale.minimumRequests,
      missingChecksum: locale.missingChecksum,
    })),
  };
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
    ) {
      value = value.slice(1, -1);
    }
    values.set(match[1], value);
  }
  return values;
}

function configuredValue(name, dotEnv, fallback) {
  const processValue = process.env[name];
  if (typeof processValue === 'string' && processValue.trim() !== '') return processValue.trim();
  const fileValue = dotEnv.get(name);
  if (typeof fileValue === 'string' && fileValue.trim() !== '') return fileValue.trim();
  return fallback;
}

function configuredFrom(names, dotEnv, fallback) {
  for (const name of names) {
    const processValue = process.env[name];
    if (typeof processValue === 'string' && processValue.trim() !== '') return processValue.trim();
  }
  for (const name of names) {
    const fileValue = dotEnv.get(name);
    if (typeof fileValue === 'string' && fileValue.trim() !== '') return fileValue.trim();
  }
  return fallback;
}

function positiveInteger(value, label, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  invariant(Number.isSafeInteger(parsed) && parsed > 0 && parsed <= max, `${label} must be an integer from 1 to ${max}`);
  return parsed;
}

function nonNegativeInteger(value, label, { max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  invariant(Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= max, `${label} must be an integer from 0 to ${max}`);
  return parsed;
}

function optionValue(argv, index, name) {
  const argument = argv[index];
  if (argument === name) {
    invariant(argv[index + 1] && !argv[index + 1].startsWith('--'), `${name} requires a value`);
    return { value: argv[index + 1], consumed: 2 };
  }
  if (argument.startsWith(`${name}=`)) {
    return { value: argument.slice(name.length + 1), consumed: 1 };
  }
  return null;
}

function safeManifestPath(value) {
  const candidate = path.resolve(ROOT, value ?? DEFAULT_MANIFEST);
  const relative = path.relative(PROGRESS_DIR, candidate);
  invariant(
    relative !== ''
    && !relative.startsWith('..')
    && !path.isAbsolute(relative)
    && path.extname(candidate).toLowerCase() === '.json',
    `Translation manifest must be a .json file under ${path.relative(ROOT, PROGRESS_DIR).replaceAll('\\', '/')}/`,
  );
  return candidate;
}

export function parseCli(argv, envFile = path.join(ROOT, '.env')) {
  const dotEnv = parseDotEnv(envFile);
  const codes = [];
  let apply = false;
  let all = false;
  let json = false;
  let help = false;
  let batchValue;
  let maxRequestsValue;
  let maxAttemptsValue;
  let minIntervalValue;
  let concurrencyValue;
  let manifestValue;
  let modelValue;

  for (let index = 0; index < argv.length;) {
    const argument = argv[index];
    if (argument === '--apply') {
      apply = true;
      index += 1;
    } else if (argument === '--all') {
      all = true;
      index += 1;
    } else if (argument === '--json') {
      json = true;
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      help = true;
      index += 1;
    } else {
      const batch = optionValue(argv, index, '--batch');
      const maxRequests = optionValue(argv, index, '--max-requests');
      const maxAttempts = optionValue(argv, index, '--max-attempts');
      const minInterval = optionValue(argv, index, '--min-interval-ms');
      const concurrency = optionValue(argv, index, '--concurrency');
      const manifest = optionValue(argv, index, '--manifest');
      const model = optionValue(argv, index, '--model');
      if (batch) {
        batchValue = batch.value;
        index += batch.consumed;
      } else if (maxRequests) {
        maxRequestsValue = maxRequests.value;
        index += maxRequests.consumed;
      } else if (maxAttempts) {
        maxAttemptsValue = maxAttempts.value;
        index += maxAttempts.consumed;
      } else if (minInterval) {
        minIntervalValue = minInterval.value;
        index += minInterval.consumed;
      } else if (concurrency) {
        concurrencyValue = concurrency.value;
        index += concurrency.consumed;
      } else if (manifest) {
        manifestValue = manifest.value;
        index += manifest.consumed;
      } else if (model) {
        modelValue = model.value;
        index += model.consumed;
      } else if (argument.startsWith('--')) {
        throw new Error(`Unknown option: ${argument}`);
      } else {
        codes.push(argument);
        index += 1;
      }
    }
  }

  invariant(!(all && codes.length > 0), 'Use either --all or explicit locale codes, not both');
  const selected = all ? [...SUPPORTED_CODES] : [...new Set(codes)];
  if (!help) invariant(selected.length > 0, 'Select one or more locale codes, or use --all');
  for (const code of selected) invariant(LANGS[code], `Unsupported locale code: ${code}`);

  const batchSize = positiveInteger(
    batchValue ?? configuredValue('TRANSLATE_BATCH', dotEnv, DEFAULT_BATCH_SIZE),
    'batch size',
    { max: MAX_BATCH_SIZE },
  );
  const maxRequests = positiveInteger(
    maxRequestsValue ?? configuredValue('TRANSLATE_MAX_REQUESTS', dotEnv, DEFAULT_MAX_REQUESTS),
    'max requests',
    { max: 10000 },
  );
  const maxAttempts = positiveInteger(
    maxAttemptsValue ?? configuredValue('TRANSLATE_MAX_ATTEMPTS', dotEnv, DEFAULT_MAX_ATTEMPTS),
    'max attempts',
    { max: 8 },
  );
  const concurrency = positiveInteger(
    concurrencyValue ?? configuredValue('TRANSLATE_CONCURRENCY', dotEnv, DEFAULT_CONCURRENCY),
    'concurrency',
    { max: MAX_CONCURRENCY },
  );
  const minIntervalMs = nonNegativeInteger(
    minIntervalValue ?? configuredValue(
      'TRANSLATE_MIN_INTERVAL_MS',
      dotEnv,
      concurrency > 1 ? 0 : DEFAULT_MIN_INTERVAL_MS,
    ),
    'minimum request interval',
    { max: 60000 },
  );
  invariant(
    concurrency === 1 || minIntervalMs === 0,
    'minimum request interval must be 0 when concurrency is greater than 1',
  );

  return {
    apply,
    json,
    help,
    codes: selected,
    batchSize,
    maxRequests,
    maxAttempts,
    minIntervalMs,
    concurrency,
    manifestPath: safeManifestPath(manifestValue ?? configuredValue('TRANSLATE_MANIFEST', dotEnv, DEFAULT_MANIFEST)),
    modelName: modelValue ?? configuredFrom(['TRANSLATE_MODEL', 'LLM_MODEL'], dotEnv, 'gemini-flash-lite-latest'),
    apiKey: configuredValue('GEMINI_API_KEY', dotEnv, undefined),
  };
}

function occurrences(value, expression) {
  return [...value.matchAll(expression)].map((match) => match[0]).sort();
}

function placeholders(value) {
  return [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
}

function numbersAndPercentages(value) {
  return occurrences(value, /\d+(?:[.,]\d+)*(?:\s*%)?/g);
}

function urls(value) {
  return occurrences(value, /https?:\/\/[^\s)\]}>"']+/g);
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length;
}

function markdownSignature(value) {
  return {
    boldStars: countMatches(value, /\*\*/g),
    boldUnderscores: countMatches(value, /__/g),
    strikethrough: countMatches(value, /~~/g),
    codeRuns: occurrences(value, /`+/g).map((token) => token.length),
    links: countMatches(value, /\[[^\]]+\]\([^)]+\)/g),
    headings: occurrences(value, /^\s{0,3}#{1,6}\s/gm).map((token) => token.trim().length),
    bullets: countMatches(value, /^\s*[-*+]\s/gm),
  };
}

function brandSignature(value) {
  return Object.fromEntries(BRANDS.map((brand) => [brand, countMatches(value, new RegExp(brand.replace(' ', '\\s'), 'g'))]));
}

export function emojiSignature(value) {
  return [...value.matchAll(EMOJI_PATTERN)].map((match) => match[0]);
}

function sameSignature(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateTranslation(key, source, translation) {
  if (typeof translation !== 'string' || translation.trim().length === 0) {
    throw new TranslationValidationError(`${key}: translation must be a non-empty string`);
  }
  if (!sameSignature(placeholders(source), placeholders(translation))) {
    throw new TranslationValidationError(`${key}: named placeholders changed`);
  }
  if (!sameSignature(numbersAndPercentages(source), numbersAndPercentages(translation))) {
    throw new TranslationValidationError(`${key}: numbers or percentages changed`);
  }
  if (!sameSignature(urls(source), urls(translation))) {
    throw new TranslationValidationError(`${key}: URLs changed`);
  }
  if (!sameSignature(markdownSignature(source), markdownSignature(translation))) {
    throw new TranslationValidationError(`${key}: basic markdown changed`);
  }
  if (!sameSignature(brandSignature(source), brandSignature(translation))) {
    throw new TranslationValidationError(`${key}: protected product name changed`);
  }
  if (!sameSignature(emojiSignature(source), emojiSignature(translation))) {
    throw new TranslationValidationError(`${key}: emojis changed`);
  }
}

function unwrapSingleJsonFence(raw) {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  const match = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  if (!match || match[1].includes('```')) {
    throw new TranslationValidationError('Provider response contains an invalid or multiple JSON fence');
  }
  return match[1].trim();
}

/** Parse and strictly validate a provider batch response. */
export function validateBatchResponse(raw, entries) {
  let parsed;
  try {
    parsed = JSON.parse(unwrapSingleJsonFence(raw));
  } catch {
    throw new TranslationValidationError('Provider response is not a JSON array');
  }
  if (!Array.isArray(parsed) || parsed.length !== entries.length) {
    throw new TranslationValidationError(`Provider response length mismatch (${parsed?.length ?? 'not-array'} vs ${entries.length})`);
  }

  const translations = new Map();
  for (let index = 0; index < entries.length; index += 1) {
    const expected = entries[index];
    const item = parsed[index];
    if (
      !item
      || typeof item !== 'object'
      || Array.isArray(item)
      || Object.keys(item).sort().join(',') !== 'key,translation'
      || item.key !== expected.key
    ) {
      throw new TranslationValidationError(`Provider response key mismatch at index ${index}`);
    }
    if (translations.has(item.key)) {
      throw new TranslationValidationError(`Provider response contains duplicate key ${item.key}`);
    }
    validateTranslation(item.key, expected.source, item.translation);
    translations.set(item.key, item.translation);
  }
  return translations;
}

export function buildPrompt(language, entries) {
  return [
    `You are a professional UI translator for a learning app. Translate every source into ${language}.`,
    'Use each key as functional context, but do not translate or alter keys.',
    'Keep translations natural and concise.',
    'Preserve exactly all named placeholders, numbers, percentages, URLs, basic markdown, emojis,',
    'and protected product names: Second Brain, FSRS, Gemini.',
    'Return ONLY a JSON array in the same order. Every item must contain exactly:',
    '{"key":"the unchanged key","translation":"the translated source"}',
    '',
    JSON.stringify(entries),
  ].join('\n');
}

export function structuredGenerationConfig() {
  return {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          translation: { type: 'string' },
        },
        required: ['key', 'translation'],
      },
    },
    temperature: TEMPERATURE,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  };
}

function httpStatus(error) {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.cause?.status,
    error?.cause?.statusCode,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isInteger(value) && value >= 100 && value <= 599) return value;
  }
  const match = /(?:status|code)\D{0,5}(\d{3})/i.exec(String(error?.message ?? ''));
  return match ? Number(match[1]) : undefined;
}

export function isRetryableProviderError(error) {
  const status = httpStatus(error);
  return status === 429 || (status >= 500 && status <= 599);
}

function retryDelay(error, attempt, random = Math.random) {
  const header = error?.response?.headers?.get?.('retry-after') ?? error?.headers?.['retry-after'];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000) + Math.floor(random() * 1000);
  const messageMatch = /retry in ([\d.]+)s/i.exec(String(error?.message ?? ''));
  if (messageMatch) return Math.ceil(Number(messageMatch[1]) * 1000) + Math.floor(random() * 1000);
  return Math.min(60000, 2000 * (2 ** Math.max(0, attempt - 1))) + Math.floor(random() * 1000);
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function safeProviderError(error) {
  if (error instanceof TranslationPipelineError) return error.message;
  const status = httpStatus(error);
  return status ? `HTTP ${status}` : (error?.name || 'provider error');
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, content, 'utf8');
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
}

export function acquireJobLock(details = {}, dependencies = {}) {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  const idFactory = dependencies.idFactory ?? crypto.randomUUID;
  const clock = dependencies.clock ?? Date.now;
  const token = idFactory();
  let descriptor;
  try {
    descriptor = fs.openSync(JOB_LOCK, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new TranslationPipelineError(
        `Another translation apply holds ${path.relative(ROOT, JOB_LOCK).replaceAll('\\', '/')}; inspect it before any manual cleanup`,
      );
    }
    throw error;
  }

  try {
    fs.writeFileSync(descriptor, `${JSON.stringify({
      token,
      pid: process.pid,
      createdAt: isoTimestamp(clock),
      manifest: details.manifestPath ? path.relative(ROOT, details.manifestPath).replaceAll('\\', '/') : null,
      sourceChecksum: details.sourceChecksum ?? null,
    }, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
  } catch (error) {
    fs.closeSync(descriptor);
    fs.rmSync(JOB_LOCK, { force: true });
    throw error;
  }
  fs.closeSync(descriptor);
  return { path: JOB_LOCK, token };
}

export function releaseJobLock(lock) {
  invariant(lock?.path === JOB_LOCK && typeof lock.token === 'string', 'Invalid translation job lock handle');
  const persisted = JSON.parse(fs.readFileSync(JOB_LOCK, 'utf8'));
  invariant(persisted.token === lock.token, 'Translation job lock ownership changed; refusing to remove it');
  fs.rmSync(JOB_LOCK, { force: false });
}

export function writeLocale(code, catalog) {
  const body = JSON.stringify(Object.fromEntries(catalog), null, 2);
  const source = `import { registerLocale } from '../i18n';

/** ${LANGS[code].language} UI locale — machine-generated, native review required.
 *  Extend safely with: node scripts/translate-locale.mjs --apply ${code} */
const ${code}: Record<string, string> = ${body};

registerLocale('${code}', ${JSON.stringify(LANGS[code].name)}, ${code});
`;
  atomicWrite(path.join(OUT_DIR, `${code}.ts`), source);
  return sha256(source);
}

function isoTimestamp(clock = Date.now) {
  const value = clock();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function saveManifest(file, manifest, clock = Date.now) {
  manifest.updatedAt = isoTimestamp(clock);
  atomicWrite(file, `${JSON.stringify(manifest, null, 2)}\n`);
}

export function normalizeUsageMetadata(metadata) {
  const normalized = {};
  if (!metadata || typeof metadata !== 'object') return normalized;
  for (const [key, value] of Object.entries(metadata)) {
    if (/TokenCount$/.test(key) && Number.isSafeInteger(value) && value >= 0) normalized[key] = value;
  }
  return normalized;
}

function emptyAttemptAccounting() {
  return {
    scope: 'local-maintenance-only-non-commercial',
    reserved: 0,
    sent: 0,
    finalized: 0,
    released: 0,
    finalizationPending: 0,
    usageMetadata: {
      finalizedAttempts: 0,
      reportedAttempts: 0,
      unknownAttempts: 0,
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
    },
    attempts: [],
    audit: [],
  };
}

function makeManifest(plan, options) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    promptVersion: PROMPT_VERSION,
    mode: 'apply',
    status: 'running',
    startedAt: now,
    updatedAt: now,
    source: {
      file: path.relative(ROOT, I18N).replaceAll('\\', '/'),
      keyCount: plan.sourceKeyCount,
      checksum: plan.sourceChecksum,
      fileChecksum: plan.sourceFileChecksum,
      overlayFileChecksums: plan.overlayFileChecksums,
    },
    provider: {
      name: 'gemini',
      model: options.modelName,
      generationConfig: structuredGenerationConfig(),
    },
    limits: {
      batchSize: options.batchSize,
      maxRequests: options.maxRequests,
      maxAttemptsPerBatch: options.maxAttempts,
      minimumRequestIntervalMs: options.minIntervalMs,
      concurrency: options.concurrency ?? DEFAULT_CONCURRENCY,
    },
    requestsAttempted: 0,
    requestsReserved: 0,
    attemptAccounting: emptyAttemptAccounting(),
    locales: Object.fromEntries(plan.locales.map((locale) => [locale.code, {
      status: locale.missingKeyCount === 0 ? 'complete' : 'pending',
      initialBaseKeyCount: locale.baseKeyCount,
      initialEffectiveKeyCount: locale.effectiveKeyCount,
      initialMissingKeyCount: locale.missingKeyCount,
      initialMissingChecksum: locale.missingChecksum,
      initialFileChecksum: locale.persistedFileChecksum,
      completedBatches: 0,
      completedKeys: 0,
      remainingKeys: locale.missingKeyCount,
      lastBatchChecksum: null,
    }])),
  };
}

function attemptFailure(error) {
  return {
    kind: error instanceof TranslationPipelineError ? error.name : 'provider_error',
    httpStatus: httpStatus(error) ?? null,
    retryable: isRetryableProviderError(error),
  };
}

/**
 * Local maintenance ledger. It is not a commercial billing ledger. Every
 * reservation is durably FINALIZATION_PENDING until one terminal transition.
 */
export function createAttemptLedger(manifest, manifestPath, dependencies = {}) {
  const idFactory = dependencies.idFactory ?? crypto.randomUUID;
  const clock = dependencies.clock ?? Date.now;
  const accounting = manifest.attemptAccounting ?? (manifest.attemptAccounting = emptyAttemptAccounting());
  manifest.requestsAttempted ??= 0;
  manifest.requestsReserved ??= 0;

  function timestamp() {
    return isoTimestamp(clock);
  }

  function find(attemptId) {
    const attempt = accounting.attempts.find((candidate) => candidate.id === attemptId);
    invariant(attempt, `Unknown provider attempt ${attemptId}`);
    return attempt;
  }

  function audit(event, attempt) {
    accounting.audit.push({
      sequence: accounting.audit.length + 1,
      at: timestamp(),
      event,
      attemptId: attempt.id,
      state: attempt.state,
      phase: attempt.phase,
    });
  }

  function persist() {
    accounting.finalizationPending = accounting.attempts.filter(
      (attempt) => attempt.state === 'FINALIZATION_PENDING',
    ).length;
    saveManifest(manifestPath, manifest, clock);
  }

  return {
    reserve(context) {
      const id = idFactory();
      invariant(typeof id === 'string' && id.length > 0, 'Provider attempt ID must be non-empty');
      invariant(!accounting.attempts.some((attempt) => attempt.id === id), `Duplicate provider attempt ID ${id}`);
      const attempt = {
        id,
        state: 'FINALIZATION_PENDING',
        phase: 'RESERVED',
        reservedAt: timestamp(),
        locale: context.locale,
        batchIndex: context.batchIndex,
        batchChecksum: context.batchChecksum,
        attemptNumber: context.attemptNumber,
        requestOrdinal: context.requestOrdinal,
      };
      accounting.attempts.push(attempt);
      accounting.reserved += 1;
      manifest.requestsReserved += 1;
      audit('RESERVE', attempt);
      persist();
      return id;
    },

    markSent(attemptId) {
      const attempt = find(attemptId);
      invariant(attempt.state === 'FINALIZATION_PENDING' && attempt.phase === 'RESERVED', `${attemptId} cannot transition to SENT`);
      attempt.phase = 'SENT';
      attempt.sentAt = timestamp();
      accounting.sent += 1;
      manifest.requestsAttempted += 1;
      audit('SEND', attempt);
      persist();
    },

    finalize(attemptId, { usageMetadata, outcome, error } = {}) {
      const attempt = find(attemptId);
      invariant(attempt.state === 'FINALIZATION_PENDING' && attempt.phase === 'SENT', `${attemptId} cannot be finalized`);
      const usage = normalizeUsageMetadata(usageMetadata);
      const reported = Object.keys(usage).length > 0;
      attempt.state = 'FINALIZED';
      attempt.phase = 'TERMINAL';
      attempt.finalizedAt = timestamp();
      attempt.outcome = outcome ?? 'unknown';
      attempt.usageState = reported ? 'reported' : 'unknown';
      attempt.usageMetadata = reported ? usage : null;
      if (error) attempt.failure = attemptFailure(error);
      accounting.finalized += 1;
      accounting.usageMetadata.finalizedAttempts += 1;
      accounting.usageMetadata[reported ? 'reportedAttempts' : 'unknownAttempts'] += 1;
      for (const [key, value] of Object.entries(usage)) {
        accounting.usageMetadata[key] = (accounting.usageMetadata[key] ?? 0) + value;
      }
      audit('FINALIZE', attempt);
      persist();
    },

    release(attemptId, error) {
      const attempt = find(attemptId);
      invariant(attempt.state === 'FINALIZATION_PENDING' && attempt.phase === 'RESERVED', `${attemptId} cannot be released`);
      attempt.state = 'RELEASED';
      attempt.phase = 'TERMINAL';
      attempt.releasedAt = timestamp();
      attempt.outcome = 'not_sent';
      if (error) attempt.failure = attemptFailure(error);
      accounting.released += 1;
      audit('RELEASE', attempt);
      persist();
    },
  };
}

export function generationConfigForModel(modelName) {
  const config = structuredGenerationConfig();
  const modelId = String(modelName).split('/').at(-1)?.toLowerCase() ?? '';
  if (/^gemini-3(?:[.-]|$)/.test(modelId)) {
    config.thinkingConfig = { thinkingLevel: 'MINIMAL' };
  }
  return config;
}

/**
 * Adapt the current Google Gen AI SDK to the small legacy-shaped interface
 * consumed by requestTranslation. The optional client makes the boundary
 * testable without issuing a provider request.
 */
export async function createGeminiModel(apiKey, modelName, dependencies = {}) {
  let client = dependencies.client;
  if (!client) {
    const { GoogleGenAI } = await import('@google/genai');
    client = new GoogleGenAI({ apiKey });
  }

  const config = generationConfigForModel(modelName);
  return {
    async generateContent(prompt) {
      const providerResponse = await client.models.generateContent({
        model: modelName,
        contents: prompt,
        config,
      });
      return {
        response: {
          text: () => providerResponse?.text ?? '',
          usageMetadata: providerResponse?.usageMetadata,
          model: modelName,
          modelVersion: providerResponse?.modelVersion,
        },
      };
    },
  };
}

export async function requestTranslation({
  model,
  language,
  entries,
  maxAttempts,
  budget,
  ledger,
  attemptContext,
  log,
  wait = sleep,
  random = Math.random,
  now = Date.now,
}) {
  const prompt = buildPrompt(language, entries);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    invariant(budget.used < budget.max, `Request ceiling reached (${budget.max})`);
    const throttleDelay = Math.max(0, budget.nextRequestAt - now());
    if (throttleDelay > 0) await wait(throttleDelay);
    const requestOrdinal = budget.used + 1;
    budget.used = requestOrdinal;
    budget.nextRequestAt = now() + budget.minIntervalMs;
    const attemptId = ledger.reserve({
      ...attemptContext,
      attemptNumber: attempt,
      requestOrdinal,
    });

    let providerPromise;
    try {
      providerPromise = model.generateContent(prompt);
    } catch (error) {
      // Synchronous refusal means no provider request left this process.
      ledger.release(attemptId, error);
      if (!isRetryableProviderError(error) || attempt === maxAttempts) throw error;
      const delay = retryDelay(error, attempt, random);
      log(`  retry ${attempt}/${maxAttempts - 1} after ${safeProviderError(error)}; waiting ${delay}ms`);
      await wait(delay);
      continue;
    }

    try {
      ledger.markSent(attemptId);
    } catch (ledgerError) {
      Promise.resolve(providerPromise).catch(() => {});
      throw ledgerError;
    }

    let response;
    try {
      response = await providerPromise;
    } catch (error) {
      // Once generateContent returned a promise, conservatively treat the call
      // as potentially billable and FINALIZE even for HTTP failures.
      ledger.finalize(attemptId, {
        usageMetadata: error?.response?.usageMetadata ?? error?.usageMetadata,
        outcome: 'provider_error',
        error,
      });
      if (!isRetryableProviderError(error) || attempt === maxAttempts) throw error;
      const delay = retryDelay(error, attempt, random);
      log(`  retry ${attempt}/${maxAttempts - 1} after ${safeProviderError(error)}; waiting ${delay}ms`);
      await wait(delay);
      continue;
    }

    const usageMetadata = response?.response?.usageMetadata;
    try {
      if (typeof response?.response?.text !== 'function') {
        throw new TranslationValidationError('Provider response is missing readable text');
      }
      let raw;
      try {
        raw = response.response.text();
      } catch {
        throw new TranslationValidationError('Provider response text could not be read');
      }
      if (typeof raw !== 'string') {
        throw new TranslationValidationError('Provider response text is not a string');
      }
      const translations = validateBatchResponse(raw, entries);
      ledger.finalize(attemptId, { usageMetadata, outcome: 'success' });
      return translations;
    } catch (error) {
      ledger.finalize(attemptId, {
        usageMetadata,
        outcome: error instanceof TranslationValidationError ? 'validation_error' : 'response_error',
        error,
      });
      if (error instanceof TranslationValidationError && attempt < maxAttempts) {
        const delay = retryDelay(error, attempt, random);
        log(`  retry ${attempt}/${maxAttempts - 1} after ${safeProviderError(error)}; waiting ${delay}ms`);
        await wait(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Unreachable translation retry state');
}

function assertPlanInputsUnchanged(plan) {
  invariant(
    sha256(fs.readFileSync(I18N)) === plan.sourceFileChecksum,
    'English source changed during translation; stop and rebuild the plan',
  );
  invariant(
    sha256(fs.readFileSync(ESSENTIAL_FILE)) === plan.overlayFileChecksums.essential
    && sha256(fs.readFileSync(REVIEW_FILE)) === plan.overlayFileChecksums.review,
    'Locale overlays changed during translation; stop and rebuild the plan',
  );
  for (const locale of plan.locales) {
    invariant(
      sha256(fs.readFileSync(locale.file)) === locale.persistedFileChecksum,
      `${locale.code} catalog changed during translation; stop and rebuild the plan`,
    );
  }
}

/**
 * Translate batches with bounded parallelism while serializing every durable
 * catalog commit. A terminal failure stops new work, but already in-flight
 * successful batches are still committed before this function returns.
 */
export async function processBatchesConcurrently({
  batches,
  concurrency = DEFAULT_CONCURRENCY,
  translate,
  commit,
}) {
  invariant(Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= MAX_CONCURRENCY,
    `concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`);
  invariant(Array.isArray(batches), 'batches must be an array');
  invariant(typeof translate === 'function', 'translate must be a function');
  invariant(typeof commit === 'function', 'commit must be a function');

  const results = new Array(batches.length);
  let nextIndex = 0;
  let stopScheduling = false;
  // A rejected commit is caught on the tail so later in-flight successes can
  // still attempt their own commit; each worker awaits its own real promise.
  let commitTail = Promise.resolve();

  async function worker() {
    while (!stopScheduling) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= batches.length) return;
      const batch = batches[index];
      try {
        const value = await translate(batch, index);
        const durableCommit = commitTail.then(() => commit(value, batch, index));
        commitTail = durableCommit.catch(() => {});
        await durableCommit;
        results[index] = { status: 'fulfilled', value };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
        stopScheduling = true;
      }
    }
  }

  const workerCount = Math.min(concurrency, batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  await commitTail;
  return results;
}

export function assertRequestCeiling(minimumRequests, maxRequests) {
  invariant(
    minimumRequests <= maxRequests,
    `Plan needs at least ${minimumRequests} requests, above the explicit ceiling ${maxRequests}`,
  );
}

/** Execute a dry-run plan or an explicitly authorized apply run. */
export async function runTranslation(options, dependencies = {}) {
  const log = dependencies.log ?? (() => {});
  const plan = buildPlan(options.codes, options.batchSize);

  if (!options.apply) {
    return {
      mode: 'dry-run',
      requestsAttempted: 0,
      plan: publicPlan(plan),
    };
  }

  invariant(options.apiKey, 'GEMINI_API_KEY is required for --apply (process.env takes priority over .env)');
  invariant(
    !/(?:^|[-_.])latest(?:$|[-_.])/i.test(options.modelName),
    'A pinned TRANSLATE_MODEL is required for --apply; mutable "latest" aliases are not reproducible',
  );
  assertRequestCeiling(plan.minimumRequests, options.maxRequests);

  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  invariant(Number.isSafeInteger(concurrency) && concurrency >= 1 && concurrency <= MAX_CONCURRENCY,
    `concurrency must be an integer from 1 to ${MAX_CONCURRENCY}`);
  invariant(
    concurrency === 1 || options.minIntervalMs === 0,
    'minimum request interval must be 0 when concurrency is greater than 1',
  );

  const manifestPath = safeManifestPath(options.manifestPath);
  const lock = acquireJobLock({ manifestPath, sourceChecksum: plan.sourceChecksum }, dependencies);
  const manifest = makeManifest(plan, options);
  try {
    assertPlanInputsUnchanged(plan);
    const budget = {
      used: 0,
      max: options.maxRequests,
      minIntervalMs: options.minIntervalMs,
      nextRequestAt: 0,
    };
    saveManifest(manifestPath, manifest, dependencies.clock);
    const ledger = createAttemptLedger(manifest, manifestPath, {
      idFactory: dependencies.attemptIdFactory,
      clock: dependencies.clock,
    });

    try {
      const factory = dependencies.createModel ?? createGeminiModel;
      const model = await factory(options.apiKey, options.modelName);

      for (const locale of plan.locales) {
        const progress = manifest.locales[locale.code];
        if (locale.missingKeyCount === 0) continue;
        progress.status = 'running';
        saveManifest(manifestPath, manifest, dependencies.clock);
        log(`[${locale.code}] ${locale.missingKeyCount} effective keys missing`);

        const batches = [];
        for (let offset = 0; offset < locale.missingKeys.length; offset += options.batchSize) {
          const keys = locale.missingKeys.slice(offset, offset + options.batchSize);
          batches.push({
            index: Math.floor(offset / options.batchSize),
            entries: keys.map((key) => ({ key, source: plan.english.get(key) })),
          });
        }

        const results = await processBatchesConcurrently({
          batches,
          concurrency,
          translate: async (batch) => {
            assertPlanInputsUnchanged({ ...plan, locales: [] });
            return requestTranslation({
              model,
              language: locale.language,
              entries: batch.entries,
              maxAttempts: options.maxAttempts,
              budget,
              ledger,
              attemptContext: {
                locale: locale.code,
                batchIndex: batch.index,
                batchChecksum: sha256(JSON.stringify(batch.entries)),
              },
              log,
              wait: dependencies.wait,
              random: dependencies.random,
              now: dependencies.now,
            });
          },
          commit: (translations, batch) => {
            assertPlanInputsUnchanged({ ...plan, locales: [] });
            invariant(
              sha256(fs.readFileSync(locale.file)) === locale.persistedFileChecksum,
              `${locale.code} catalog changed during translation; refusing to overwrite concurrent edits`,
            );
            for (const [key, translation] of translations) {
              locale.base.set(key, translation);
              locale.effective.set(key, translation);
            }
            locale.persistedFileChecksum = writeLocale(locale.code, locale.base);

            progress.completedBatches += 1;
            progress.completedKeys += batch.entries.length;
            progress.remainingKeys = locale.missingKeyCount - progress.completedKeys;
            progress.lastBatchChecksum = sha256(JSON.stringify([...translations.entries()]));
            saveManifest(manifestPath, manifest, dependencies.clock);
            log(`  [${locale.code}] ${progress.completedKeys}/${locale.missingKeyCount}`);
          },
        });

        const failed = results.find((result) => result?.status === 'rejected');
        if (failed) {
          progress.status = 'failed';
          saveManifest(manifestPath, manifest, dependencies.clock);
          throw failed.reason;
        }

        invariant(
          locale.effective.size === plan.sourceKeyCount
          && [...plan.english.keys()].every((key) => locale.effective.has(key)),
          `${locale.code} did not reach complete effective coverage`,
        );
        progress.status = 'complete';
        saveManifest(manifestPath, manifest, dependencies.clock);
      }

      manifest.status = 'complete';
      saveManifest(manifestPath, manifest, dependencies.clock);
      return {
        mode: 'apply',
        requestsAttempted: budget.used,
        manifestPath,
        plan: publicPlan(plan),
      };
    } catch (error) {
      manifest.status = 'failed';
      manifest.failure = safeProviderError(error);
      saveManifest(manifestPath, manifest, dependencies.clock);
      throw error;
    }
  } finally {
    releaseJobLock(lock);
  }
}

function usage() {
  return `Usage:
  node scripts/translate-locale.mjs --all [--json]
  node scripts/translate-locale.mjs es de [--json]
  node scripts/translate-locale.mjs --apply es [--model gemini-3.5-flash-lite] [--max-requests 40] [--max-attempts 4] [--concurrency 4]

Dry-run is the default. --apply is required for every provider call and write.
Options: --all, --apply, --batch N, --max-requests N, --max-attempts N,
         --concurrency N (1-${MAX_CONCURRENCY}), --min-interval-ms N, --model NAME,
         --manifest PATH, --json, --help
Parallel mode requires --min-interval-ms 0 (used by default when concurrency > 1).`;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const log = options.json ? (message) => console.error(message) : (message) => console.log(message);
  const result = await runTranslation(options, { log });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const plan = result.plan;
  console.log(`${result.mode === 'dry-run' ? 'DRY RUN' : 'APPLY'}: ${plan.sourceKeyCount} source keys (${plan.sourceChecksum})`);
  for (const locale of plan.locales) {
    console.log(
      `[${locale.code}] ${locale.effectiveKeyCount}/${plan.sourceKeyCount} effective; `
      + `${locale.missingKeyCount} missing; ${locale.minimumRequests} minimum requests`,
    );
  }
  console.log(`Total: ${plan.totalMissing} translations; ${plan.minimumRequests} minimum requests; ${result.requestsAttempted} requests made.`);
  if (result.mode === 'dry-run') console.log('No provider request or file write was performed. Re-run with --apply to execute.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    // Do not print provider payloads, prompts, environment values or raw errors.
    console.error(`Translation stopped: ${safeProviderError(error)}`);
    process.exitCode = 1;
  });
}
