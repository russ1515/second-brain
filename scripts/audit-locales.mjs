// Offline quality audit for the learner UI translation catalogs.
//
// The default mode is deliberately non-blocking while a translation run is in
// progress:
//   node scripts/audit-locales.mjs
//
// Enable the release gate explicitly once the catalogs are expected complete:
//   node scripts/audit-locales.mjs --strict
//
// This module performs no network request and never writes to a catalog.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SUPPORTED_CODES,
  localeCatalogDescriptor,
  readCatalog,
  readNestedCatalog,
  readStringArray,
  readTupleCatalog,
} from './translate-locale.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N_FILE = path.join(ROOT, 'apps/mobile/lib/i18n.tsx');
const LOCALES_DIR = path.join(ROOT, 'apps/mobile/lib/locales');
const ESSENTIAL_FILE = path.join(LOCALES_DIR, 'essential.ts');
const REVIEW_FILE = path.join(LOCALES_DIR, 'review.ts');
const AUTH_ERRORS_FILE = path.join(LOCALES_DIR, 'auth-errors.ts');
const VOICE_PHASE2_FILE = path.join(LOCALES_DIR, 'voice-phase2.ts');
const LIBRARY_V1_FILE = path.join(LOCALES_DIR, 'library-v1.ts');
const RESEARCH_WEB_V1_FILE = path.join(LOCALES_DIR, 'research-web-v1.ts');
const LEARNING_DATA_CONTROL_EUROPE_FILE = path.join(LOCALES_DIR, 'learning-data-control-europe-v1.ts');
const LEARNING_DATA_CONTROL_ASIA_FILE = path.join(LOCALES_DIR, 'learning-data-control-asia-v1.ts');
const LEARNING_DATA_CONTROL_AFRICA_FILE = path.join(LOCALES_DIR, 'learning-data-control-africa-v1.ts');
const GLOBAL_PATH_V1_FILE = path.join(LOCALES_DIR, 'global-path-v1.ts');

export const ALL_LOCALE_CODES = Object.freeze(['en', 'fr', ...SUPPORTED_CODES]);
export const PROTECTED_BRANDS = Object.freeze([
  'Second Brain',
  'FSRS',
  'Gemini',
  'OpenAI',
  'ChatGPT',
  'YouTube',
  'Google',
  'Microsoft',
  'Apple',
  'Qdrant',
  'PostgreSQL',
  'Redis',
  'Claude',
  'Stripe',
  'Expo',
  'React Native',
]);

const EMOJI_PATTERN = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu;
const ISSUE_KINDS = Object.freeze([
  'missing',
  'unknown',
  'blank',
  'placeholders',
  'numbers',
  'urls',
  'markdown',
  'emojis',
  'brands',
]);
const MAX_SUSPICIOUS_IDENTITY_RATIO = 0.10;

function occurrences(value, expression) {
  return [...value.matchAll(expression)].map((match) => match[0]).sort();
}

function countMatches(value, expression) {
  return [...value.matchAll(expression)].length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function protectedBrandExpression(brand) {
  // CJK and Korean particles are commonly attached directly to a Latin brand
  // (for example `Second Brainへ` or `FSRS로`). Only reject ASCII word
  // continuations, which still prevents `Expo` from matching `Exporter`.
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(brand)}(?![A-Za-z0-9])`, 'g');
}

function normalizedNumbers(value) {
  return [...value.matchAll(/\d+(?:[.,]\d+)*(?:\s*%)?/g)]
    .map((match) => match[0].replace(/\s+(?=%)/g, '').replaceAll(',', '.'))
    .sort();
}

function containsMultiset(container, required) {
  const available = new Map();
  for (const item of container) available.set(item, (available.get(item) ?? 0) + 1);
  for (const item of required) {
    const count = available.get(item) ?? 0;
    if (count === 0) return false;
    available.set(item, count - 1);
  }
  return true;
}

function signature(value) {
  return {
    placeholders: [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort(),
    numbers: normalizedNumbers(value),
    urls: occurrences(value, /https?:\/\/[^\s)\]}>'"]+/g),
    markdown: {
      boldStars: countMatches(value, /\*\*/g),
      boldUnderscores: countMatches(value, /__/g),
      strikethrough: countMatches(value, /~~/g),
      codeRuns: occurrences(value, /`+/g).map((token) => token.length),
      links: countMatches(value, /\[[^\]]+\]\([^)]+\)/g),
      images: countMatches(value, /!\[[^\]]*\]\([^)]+\)/g),
      headings: occurrences(value, /^\s{0,3}#{1,6}\s/gm).map((token) => token.trim().length),
      bullets: countMatches(value, /^\s*[-*+]\s/gm),
      blockquotes: countMatches(value, /^\s*>\s?/gm),
    },
    emojis: [...value.matchAll(EMOJI_PATTERN)].map((match) => match[0]).sort(),
    brands: Object.fromEntries(PROTECTED_BRANDS.map((brand) => [
      brand,
      countMatches(value, protectedBrandExpression(brand)),
    ])),
  };
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isShortCode(token) {
  if ([...token].length <= 3) return true;
  if (/^[\p{Lu}\d][\p{Lu}\d._+/#-]{0,7}$/u.test(token)) return true;
  if (/^(?:v|r)?\d+(?:[._-]\d+)*$/i.test(token)) return true;
  if (/^[\w.+-]+\/[\w.+-]+$/u.test(token)) return true;
  return false;
}

/**
 * Identical strings are review diagnostics, never integrity failures. Suppress
 * protected brands, placeholders, URLs, numbers, emoji and very short codes so
 * the report focuses on sentences that probably still need translation.
 */
export function isSuspiciousEnglishIdentity(source) {
  const trimmed = source.trim();
  if (!trimmed || !/\p{L}/u.test(trimmed)) return false;

  let remainder = trimmed;
  remainder = remainder.replace(/https?:\/\/[^\s)\]}>'"]+/g, ' ');
  remainder = remainder.replace(/\{[^{}]+\}/g, ' ');
  remainder = remainder.replace(EMOJI_PATTERN, ' ');
  remainder = remainder.replace(/\d+(?:[.,]\d+)*(?:\s*%)?/g, ' ');
  for (const brand of PROTECTED_BRANDS) {
    remainder = remainder.replace(protectedBrandExpression(brand), ' ');
  }
  remainder = remainder.replace(/[*_~`#>[\]()!]/g, ' ');

  const tokens = remainder
    .split(/[\s,;:!?|]+/u)
    .map((token) => token.replace(/^[.'"-]+|[.'"-]+$/g, ''))
    .filter(Boolean);
  if (tokens.length === 0) return false;
  if (tokens.length === 1 && isShortCode(tokens[0])) return false;
  return true;
}

function emptyIssueBuckets() {
  return Object.fromEntries(ISSUE_KINDS.map((kind) => [kind, []]));
}

function sourceLayerIssues(source, layers) {
  const issues = emptyIssueBuckets();
  for (const layer of layers) {
    for (const [key, value] of layer.entries) {
      if (!source.has(key)) issues.unknown.push({ key, layer: layer.name });
      if (typeof value !== 'string' || value.trim().length === 0) {
        issues.blank.push({ key, layer: layer.name });
      }
    }
  }
  return issues;
}

/** Audit already-parsed catalogs. Exported to keep the validation testable. */
export function auditCatalogSet({ english, catalogs, layersByLocale = new Map(), expectedCodes }) {
  const sourceKeys = new Set(english.keys());
  const localeReports = [];

  for (const code of expectedCodes) {
    const catalog = catalogs.get(code) ?? new Map();
    const layers = layersByLocale.get(code) ?? [{ name: code, entries: catalog }];
    const issues = sourceLayerIssues(english, layers);
    const identicalToEnglish = [];

    for (const key of sourceKeys) {
      if (!catalog.has(key)) {
        issues.missing.push({ key });
        continue;
      }
      const translated = catalog.get(key);
      if (typeof translated !== 'string' || translated.trim().length === 0) continue;

      const sourceValue = english.get(key);
      const sourceSignature = signature(sourceValue);
      const translatedSignature = signature(translated);
      for (const kind of ['placeholders', 'numbers', 'urls', 'markdown', 'emojis', 'brands']) {
        // A translated phrase can legitimately spell an English word as a
        // digit ("a week" -> "1 week"). What must never disappear or change
        // is a numeric value explicitly present in the source. Locale spacing
        // around percentages and decimal comma/dot are normalized above.
        const valid = kind === 'numbers'
          ? containsMultiset(translatedSignature.numbers, sourceSignature.numbers)
          : same(sourceSignature[kind], translatedSignature[kind]);
        if (!valid) {
          issues[kind].push({
            key,
            source: sourceValue,
            translation: translated,
            expected: sourceSignature[kind],
            actual: translatedSignature[kind],
          });
        }
      }

      if (
        code !== 'en'
        && translated.trim() === sourceValue.trim()
        && isSuspiciousEnglishIdentity(sourceValue)
      ) {
        identicalToEnglish.push({ key, value: translated });
      }
    }

    const translatedKnownKeys = [...catalog.keys()].filter((key) => sourceKeys.has(key)).length;
    const coveragePercent = english.size === 0
      ? 100
      : Math.round((translatedKnownKeys / english.size) * 100_000) / 1_000;
    // Individual unchanged words can be legitimate. A catalog where at least
    // 10% of known strings are suspicious English identities is not a reviewed
    // translation, though, and must not pass the final gate.
    const identicalRatio = code === 'en' || translatedKnownKeys === 0
      ? 0
      : identicalToEnglish.length / translatedKnownKeys;
    const identicalErrorCount = identicalRatio >= MAX_SUSPICIOUS_IDENTITY_RATIO
      ? identicalToEnglish.length
      : 0;
    const errorCount = ISSUE_KINDS.reduce((sum, kind) => sum + issues[kind].length, 0)
      + identicalErrorCount;
    const nonMissingErrorCount = ISSUE_KINDS
      .filter((kind) => kind !== 'missing')
      .reduce((sum, kind) => sum + issues[kind].length, 0)
      + identicalErrorCount;
    localeReports.push({
      code,
      keyCount: catalog.size,
      sourceKeyCount: english.size,
      translatedKnownKeys,
      coveragePercent,
      errorCount,
      nonMissingErrorCount,
      issues,
      identicalToEnglish,
      identicalRatio,
      identicalErrorCount,
    });
  }

  const sourceBlank = [...english]
    .filter(([, value]) => typeof value !== 'string' || value.trim().length === 0)
    .map(([key]) => key);
  const catalogErrorCount = localeReports.reduce((sum, locale) => sum + locale.errorCount, 0);
  const errorCount = catalogErrorCount + (expectedCodes.includes('en') ? 0 : sourceBlank.length);
  return {
    generatedAt: new Date().toISOString(),
    sourceKeyCount: english.size,
    localeCount: localeReports.length,
    sourceBlank,
    errorCount,
    nonMissingErrorCount: localeReports.reduce(
      (sum, locale) => sum + locale.nonMissingErrorCount,
      0,
    ),
    readyForFinalGate: errorCount === 0,
    identicalDiagnosticCount: localeReports.reduce(
      (sum, locale) => sum + locale.identicalToEnglish.length,
      0,
    ),
    locales: localeReports,
  };
}

/** Read and audit the repository without modifying it. */
export function auditRepository() {
  const english = readCatalog(I18N_FILE, 'en');
  const french = readCatalog(I18N_FILE, 'fr');
  const essentials = readNestedCatalog(ESSENTIAL_FILE, 'essential');
  const learnerPassportEssentials = readNestedCatalog(ESSENTIAL_FILE, 'learnerPassportEssential');
  const supportBridgeEssentials = readNestedCatalog(ESSENTIAL_FILE, 'supportBridgeEssential');
  const reviews = readNestedCatalog(REVIEW_FILE, 'review');
  const authErrors = readNestedCatalog(AUTH_ERRORS_FILE, 'authErrors');
  const voicePhase2 = readNestedCatalog(VOICE_PHASE2_FILE, 'voicePhase2');
  const libraryV1 = readNestedCatalog(LIBRARY_V1_FILE, 'libraryV1');
  const libraryOrganization = readTupleCatalog(LIBRARY_V1_FILE, 'organizationLabels', ['lib.types', 'libraryV1.type.notebook']);
  const libraryFailures = readTupleCatalog(LIBRARY_V1_FILE, 'failureLabels', ['libraryV1.error.fileUnreadable', 'libraryV1.error.storage']);
  const researchWebV1 = readTupleCatalog(RESEARCH_WEB_V1_FILE, 'researchWebV1', ['research10.externalUnavailable', 'research10.externalUnavailableDetail']);
  const learningDataControlKeys = readStringArray(LEARNING_DATA_CONTROL_EUROPE_FILE, 'learningDataControlKeys');
  const learningDataControlEurope = readTupleCatalog(LEARNING_DATA_CONTROL_EUROPE_FILE, 'learningDataControlEuropeValues', learningDataControlKeys);
  const learningDataControlAsia = readTupleCatalog(LEARNING_DATA_CONTROL_ASIA_FILE, 'learningDataControlAsiaValues', learningDataControlKeys);
  const learningDataControlAfrica = readTupleCatalog(LEARNING_DATA_CONTROL_AFRICA_FILE, 'learningDataControlAfricaValues', learningDataControlKeys);
  const globalPathAliases = readCatalog(GLOBAL_PATH_V1_FILE, 'aliases');
  const catalogs = new Map([
    ['en', english],
    ['fr', french],
  ]);
  const layersByLocale = new Map([
    ['en', [{ name: 'i18n.tsx:en', entries: english }]],
    ['fr', [{ name: 'i18n.tsx:fr', entries: french }]],
  ]);

  for (const code of SUPPORTED_CODES) {
    const { file, variableName } = localeCatalogDescriptor(code);
    // A newly registered locale is intentionally reported as 0% coverage until
    // its first real catalog is generated. Never synthesize an empty runtime
    // resource merely to make the registry look complete.
    const base = fs.existsSync(file) ? readCatalog(file, variableName) : new Map();
    const essential = essentials.get(code) ?? new Map();
    const learnerPassportEssential = learnerPassportEssentials.get(code) ?? new Map();
    const supportBridgeEssential = supportBridgeEssentials.get(code) ?? new Map();
    const review = reviews.get(code) ?? new Map();
    const authError = authErrors.get(code) ?? new Map();
    const voice = voicePhase2.get(code) ?? new Map();
    const library = libraryV1.get(code) ?? new Map();
    const organization = libraryOrganization.get(code) ?? new Map();
    const failures = libraryFailures.get(code) ?? new Map();
    const researchWeb = researchWebV1.get(code) ?? new Map();
    const learningDataControl = new Map([
      ...(learningDataControlEurope.get(code) ?? new Map()),
      ...(learningDataControlAsia.get(code) ?? new Map()),
      ...(learningDataControlAfrica.get(code) ?? new Map()),
    ]);
    const beforeAliases = new Map([
      ...base,
      ...essential,
      ...learnerPassportEssential,
      ...supportBridgeEssential,
      ...review,
      ...authError,
      ...voice,
      ...library,
      ...organization,
      ...failures,
      ...researchWeb,
      ...learningDataControl,
    ]);
    const globalPath = new Map(
      [...globalPathAliases].flatMap(([target, source]) => {
        const value = beforeAliases.get(source);
        return typeof value === 'string' && value.trim().length > 0 ? [[target, value]] : [];
      }),
    );
    catalogs.set(code, new Map([...beforeAliases, ...globalPath]));
    layersByLocale.set(code, [
      { name: path.relative(LOCALES_DIR, file).replaceAll('\\', '/'), entries: base },
      { name: 'essential.ts', entries: essential },
      { name: 'essential.ts:learnerPassportEssential', entries: learnerPassportEssential },
      { name: 'essential.ts:supportBridgeEssential', entries: supportBridgeEssential },
      { name: 'review.ts', entries: review },
      { name: 'auth-errors.ts', entries: authError },
      { name: 'voice-phase2.ts', entries: voice },
      { name: 'library-v1.ts', entries: library },
      { name: 'library-v1.ts:organizationLabels', entries: organization },
      { name: 'library-v1.ts:failureLabels', entries: failures },
      { name: 'research-web-v1.ts', entries: researchWeb },
      { name: 'learning-data-control-v1', entries: learningDataControl },
      { name: 'global-path-v1.ts', entries: globalPath },
    ]);
  }

  return auditCatalogSet({
    english,
    catalogs,
    layersByLocale,
    expectedCodes: ALL_LOCALE_CODES,
  });
}

export function gateStatus(report, strict) {
  return {
    strict,
    blocking: strict && !report.readyForFinalGate,
    exitCode: strict && !report.readyForFinalGate ? 1 : 0,
  };
}

function compactIssues(locale) {
  return ISSUE_KINDS
    .map((kind) => `${kind}=${locale.issues[kind].length}`)
    .join(' ');
}

export function formatHumanReport(report, { strict = false, diagnosticLimit = 8 } = {}) {
  const lines = [
    `Second Brain learner locale audit — ${report.localeCount} locales, ${report.sourceKeyCount} source keys`,
    `Mode: ${strict ? 'FINAL GATE (blocking)' : 'progress audit (non-blocking)'}`,
  ];
  if (report.sourceBlank.length > 0) lines.push(`English source blanks: ${report.sourceBlank.join(', ')}`);

  for (const locale of report.locales) {
    const state = locale.errorCount === 0 ? 'PASS' : 'INCOMPLETE';
    lines.push(
      `${locale.code.padEnd(2)} ${state.padEnd(10)} ${String(locale.translatedKnownKeys).padStart(4)}/${locale.sourceKeyCount} (${locale.coveragePercent.toFixed(1)}%) nonMissing=${locale.nonMissingErrorCount} ${compactIssues(locale)}`,
    );
    if (locale.identicalToEnglish.length > 0) {
      const sample = locale.identicalToEnglish
        .slice(0, diagnosticLimit)
        .map((entry) => entry.key)
        .join(', ');
      const remainder = locale.identicalToEnglish.length - Math.min(diagnosticLimit, locale.identicalToEnglish.length);
      lines.push(`   review-identical=${locale.identicalToEnglish.length}: ${sample}${remainder > 0 ? ` (+${remainder})` : ''}`);
    }
  }

  lines.push(
    `Integrity errors: ${report.errorCount}`,
    `Non-missing integrity errors: ${report.nonMissingErrorCount}`,
    `Identical-to-English review diagnostics: ${report.identicalDiagnosticCount}`,
    report.readyForFinalGate
      ? 'FINAL_LOCALE_GATE_READY: YES'
      : `FINAL_LOCALE_GATE_READY: NO${strict ? ' — validation failed' : ' — rerun with --strict only after translation is complete'}`,
  );
  return lines.join('\n');
}

function parseArgs(argv) {
  const allowed = new Set(['--strict', '--json']);
  const unknown = argv.filter((argument) => !allowed.has(argument));
  if (unknown.length > 0) throw new Error(`Unknown locale-audit option: ${unknown.join(', ')}`);
  return { strict: argv.includes('--strict'), json: argv.includes('--json') };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = auditRepository();
    process.stdout.write(`${options.json ? JSON.stringify(report, null, 2) : formatHumanReport(report, options)}\n`);
    process.exitCode = gateStatus(report, options.strict).exitCode;
  } catch (error) {
    process.stderr.write(`Locale audit failed to run: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
