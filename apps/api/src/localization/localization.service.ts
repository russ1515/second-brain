import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RedisService } from '../redis/redis.service';
import {
  DEFAULT_LOCALE,
  localeToLanguage,
  resolveLocale,
} from '../common/learning-locale';
import { toSupportedLanguage } from '@second-brain/shared';

const TTL_SECONDS = 30 * 86_400; // translations of stable strings live a month

/**
 * Runtime localization for GENERATED analysis (scalable i18n).
 *
 * The deterministic engines (Coach, Mentor, Insights, Prediction, …) build their
 * prose in English. Rather than hand-translate every template into 25 languages,
 * this service translates the assembled strings into the learner's Learning
 * Locale on the fly and CACHES each per (locale, text) in Redis — so a templated
 * sentence is translated once and shared across all users. English (the source)
 * is a pass-through. Any failure falls back to the original English so a call is
 * never broken by translation.
 */
@Injectable()
export class LocalizationService {
  private readonly logger = new Logger(LocalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly redis: RedisService,
  ) {}

  /** Resolve the user's locale, then translate the strings into it. */
  async localizeForUser(userId: string, texts: string[]): Promise<string[]> {
    const locale = await resolveLocale(this.prisma, userId);
    return this.translate(texts, locale);
  }

  /** Translate strings into `locale` (Redis-cached; English = pass-through). */
  async translate(texts: string[], locale: string): Promise<string[]> {
    const code = toSupportedLanguage(locale);
    if (!code || code === DEFAULT_LOCALE) return texts; // source language

    const out = [...texts];
    const keys = texts.map((t) => (t?.trim() ? this.key(code, t) : ''));

    // Batch cache read.
    const cached = await this.mget(keys);
    const misses: { index: number; text: string }[] = [];
    texts.forEach((text, i) => {
      if (!text?.trim()) return;
      if (cached[i]) out[i] = cached[i] as string;
      else misses.push({ index: i, text });
    });

    if (misses.length === 0) return out;

    // One LLM call for all misses; on failure keep the English source.
    try {
      const translated = await this.callLlm(
        misses.map((m) => m.text),
        localeToLanguage(code),
      );
      await Promise.all(
        misses.map(async (m, i) => {
          const t = translated[i];
          if (t && t.trim()) {
            out[m.index] = t;
            await this.set(this.key(code, m.text), t);
          }
        }),
      );
    } catch (err) {
      this.logger.warn(`translation to ${code} failed: ${(err as Error).message}`);
    }
    return out;
  }

  // ── Redis helpers (best-effort — never break the caller) ────────────────────

  private async mget(keys: string[]): Promise<(string | null)[]> {
    const real = keys.filter((k) => k);
    if (real.length === 0) return keys.map(() => null);
    try {
      const values = await this.redis.connection.mget(...real);
      const byKey = new Map(real.map((k, i) => [k, values[i]]));
      return keys.map((k) => (k ? (byKey.get(k) ?? null) : null));
    } catch {
      return keys.map(() => null);
    }
  }

  private async set(key: string, value: string): Promise<void> {
    try {
      await this.redis.connection.set(key, value, 'EX', TTL_SECONDS);
    } catch {
      // best-effort
    }
  }

  // ── LLM translation ─────────────────────────────────────────────────────────

  private async callLlm(texts: string[], language: string): Promise<string[]> {
    // Input is a JSON array of strings; output must be a JSON array of the same
    // length/order — no numbering, so nothing leaks into the translations.
    const result = await this.llm.generate(
      [
        {
          role: 'system',
          content:
            `You are a professional UI + educational-copy translator. The user message ` +
            `is a JSON array of strings. Translate EACH element into ${language}, natural ` +
            `and fluent. PRESERVE markdown, emojis, numbers, percentages, quotes and ` +
            `placeholders exactly. Do NOT add numbering, keys or commentary. Return ONLY a ` +
            `JSON array of strings, same length and order, translations only.`,
        },
        { role: 'user', content: JSON.stringify(texts) },
      ],
      { temperature: 0.2 },
    );
    const arr = this.parseJsonArray(result.text);
    if (arr.length !== texts.length) throw new Error('translation length mismatch');
    return arr;
  }

  private parseJsonArray(raw: string): string[] {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('no JSON array in translation');
    const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
    if (!Array.isArray(parsed)) throw new Error('translation is not an array');
    return parsed.map((x) => String(x));
  }

  private key(locale: string, text: string): string {
    return `i18n:tr:${locale}:${createHash('sha1').update(text).digest('hex').slice(0, 16)}`;
  }
}
