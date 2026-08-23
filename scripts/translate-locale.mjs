// Automated UI-dictionary translator (full-localization Step 2).
//
// Reads the English source catalog out of apps/mobile/lib/i18n.tsx, translates
// every key into a target language via Gemini, and writes
// apps/mobile/lib/locales/<code>.ts (a registerLocale() resource). Resumable:
// re-running only translates keys still missing from the existing output, so a
// rate-limit / crash can be picked up where it stopped.
//
// Usage:  node scripts/translate-locale.mjs es de   (one or more codes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I18N = path.join(ROOT, 'apps/mobile/lib/i18n.tsx');
const OUT_DIR = path.join(ROOT, 'apps/mobile/lib/locales');
// Batch size is tunable: a language whose output the model keeps truncating
// (invalid JSON on every retry) can be resumed with a smaller TRANSLATE_BATCH.
const BATCH = Number(process.env.TRANSLATE_BATCH) || 60;

// code → { name (native), language (English name for the prompt) }
const LANGS = {
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
};

function readEnv(name) {
  const env = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const m = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
}

/** Extract the `const en = { … } as const;` object into a key→value map. */
function parseEnglish() {
  const src = fs.readFileSync(I18N, 'utf8');
  const start = src.indexOf('const en = {');
  const end = src.indexOf('} as const;', start);
  const body = src.slice(src.indexOf('{', start) + 1, end);
  const re = /'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',?/g;
  const out = {};
  let m;
  while ((m = re.exec(body))) {
    const key = m[1].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const val = m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    out[key] = val;
  }
  return out;
}

/** Load already-translated keys from an existing output file (resumability). */
function loadExisting(code) {
  const file = path.join(OUT_DIR, `${code}.ts`);
  if (!fs.existsSync(file)) return {};
  const src = fs.readFileSync(file, 'utf8');
  // Anchor on the object literal (`= {`), NOT the import's `{ registerLocale }`.
  const s = src.indexOf('= {');
  const e = src.lastIndexOf('}');
  if (s === -1 || e === -1) return {};
  try {
    return JSON.parse(src.slice(s + 2, e + 1));
  } catch {
    return {};
  }
}

function writeLocale(code, catalog) {
  const { name } = LANGS[code];
  const body = JSON.stringify(catalog, null, 2);
  const file = `import { registerLocale } from '../i18n';

/** ${LANGS[code].language} UI locale — machine-generated (Step 2), review recommended.
 *  Regenerate/extend with: node scripts/translate-locale.mjs ${code} */
const ${code}: Record<string, string> = ${body};

registerLocale('${code}', ${JSON.stringify(name)}, ${code});
`;
  fs.writeFileSync(path.join(OUT_DIR, `${code}.ts`), file, 'utf8');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(model, language, texts) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await model.generateContent(
        `You are a professional UI translator for a learning app. Translate each ` +
          `string in this JSON array into ${language}. Keep it natural and concise. ` +
          `PRESERVE exactly: placeholders like {name}/{s}/{m}, markdown, emojis, numbers, ` +
          `percentages, and product names (Second Brain, FSRS, Gemini). Do NOT add keys, ` +
          `numbering or commentary. Return ONLY a JSON array of strings, same length and ` +
          `order.\n\n${JSON.stringify(texts)}`,
      );
      const raw = res.response.text();
      const arr = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
      if (Array.isArray(arr) && arr.length === texts.length) return arr.map(String);
      throw new Error(`length mismatch (${arr.length} vs ${texts.length})`);
    } catch (err) {
      // Honour the server's requested retry delay on a 429, else back off.
      const m = /retry in ([\d.]+)s/i.exec(err.message || '');
      const wait = m ? Math.ceil(parseFloat(m[1]) * 1000) + 1500 : Math.min(60000, 3000 * (attempt + 1));
      process.stdout.write(`  retry ${attempt + 1} (${(err.message || '').slice(0, 60)}); waiting ${wait}ms\n`);
      await sleep(wait);
    }
  }
  throw new Error('batch failed after retries');
}

async function run() {
  const codes = process.argv.slice(2).filter((c) => LANGS[c]);
  if (codes.length === 0) {
    console.error('Usage: node scripts/translate-locale.mjs <code>...  e.g. es de');
    process.exit(1);
  }
  const apiKey = readEnv('GEMINI_API_KEY');
  const modelName = readEnv('LLM_MODEL') || 'gemini-flash-lite-latest';
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });

  const en = parseEnglish();
  const keys = Object.keys(en);
  console.log(`Source: ${keys.length} English keys.`);

  for (const code of codes) {
    const { language } = LANGS[code];
    const catalog = loadExisting(code);
    const missing = keys.filter((k) => catalog[k] === undefined);
    console.log(`\n[${code}] ${language}: ${keys.length - missing.length} done, ${missing.length} to translate.`);

    try {
      for (let i = 0; i < missing.length; i += BATCH) {
        const chunk = missing.slice(i, i + BATCH);
        const translated = await translateBatch(model, language, chunk.map((k) => en[k]));
        chunk.forEach((k, j) => (catalog[k] = translated[j]));
        writeLocale(code, catalog); // persist after every batch (resumable)
        process.stdout.write(`  [${code}] ${Math.min(i + BATCH, missing.length)}/${missing.length}\n`);
        // Proactive throttle: ~13 req/min, under the free-tier 15/min limit.
        await sleep(4500);
      }
      console.log(`[${code}] done → apps/mobile/lib/locales/${code}.ts (${Object.keys(catalog).length} keys)`);
    } catch (err) {
      // One language failing (quota exhausted) must not abort the rest — it's
      // resumable, so re-running later fills whatever is still missing.
      console.error(`[${code}] stopped early (${err.message}); ${Object.keys(catalog).length}/${keys.length} saved — re-run to resume.`);
    }
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
