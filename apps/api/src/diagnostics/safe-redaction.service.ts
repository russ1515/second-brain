import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const SENSITIVE_KEY = /(?:pass(?:word|code)?|secret|token|authorization|cookie|recovery|totp|otp|api.?key|smtp|credential|card|cvv|payment)/i;
const JSON_SECRET_ASSIGNMENT = /(["'](?:password|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|totp|one[ _-]?time[ _-]?password|otp|recovery[ _-]?code|smtp(?:_[a-z]+)?|authorization|cookie)["']\s*:\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^,}\]\s]+)/gi;
const SECRET_ASSIGNMENT = /\b(password|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|totp|one[ _-]?time[ _-]?password|\botp\b|recovery[ _-]?code|smtp(?:_[a-z]+)?|authorization|cookie)\b\s*(?:[:=]|is)\s*[^\s,;]+/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const PROVIDER_SECRET = /\b(?:sk|pk|rk|whsec|xox[baprs]|AKIA)[A-Za-z0-9_-]{8,}\b/gi;
const PAN = /\b(?:\d[ -]?){13,19}\b/g;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const URL_WITH_QUERY = /\bhttps?:\/\/[^\s<>{}"']+/gi;
const WINDOWS_PATH = /[A-Za-z]:\\(?:[^\r\n:]+\\)*[^\r\n:]+/g;
const UNIX_PATH = /(?:^|\s)\/(?:[^\s/]+\/){2,}[^\s]*/g;

export interface SafeStack {
  fingerprint: string | null;
  detail: string | null;
}

/**
 * Redacts before persistence or model context construction.  This is purposefully
 * conservative: diagnostic telemetry may lose incidental prose, but never needs
 * passwords, tokens, full emails, IPs, URLs with query strings or private payloads.
 */
@Injectable()
export class SafeRedactionService {
  text(value: unknown, maxLength = 1_024): string | null {
    if (typeof value !== 'string') return null;
    return value
      // JSON-shaped failures are common in provider and validation errors.
      // Redact their value before the looser prose-oriented pattern below.
      .replace(JSON_SECRET_ASSIGNMENT, '$1"[REDACTED]"')
      .replace(BEARER, 'Bearer [REDACTED]')
      // Bearer must run first: the generic assignment pattern would otherwise
      // consume only its first token and leave a non-JWT bearer credential.
      .replace(SECRET_ASSIGNMENT, '$1=[REDACTED]')
      .replace(JWT, '[REDACTED_JWT]')
      .replace(PROVIDER_SECRET, '[REDACTED_CREDENTIAL]')
      .replace(PAN, '[REDACTED_CARD]')
      .replace(EMAIL, '[REDACTED_EMAIL]')
      .replace(IPV4, '[REDACTED_IP]')
      .replace(URL_WITH_QUERY, (url) => {
        try {
          const parsed = new URL(url);
          return parsed.search ? `${parsed.origin}${parsed.pathname}?…` : `${parsed.origin}${parsed.pathname}`;
        } catch {
          return '[REDACTED_URL]';
        }
      })
      .replace(WINDOWS_PATH, '[REDACTED_PATH]')
      .replace(UNIX_PATH, ' [REDACTED_PATH]')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  metadata(value: unknown, depth = 0): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 3) return null;
    const entries = Object.entries(value as Record<string, unknown>).slice(0, 30);
    return Object.fromEntries(entries.map(([key, child]) => [
      this.safeKey(key),
      this.value(SENSITIVE_KEY.test(key) ? '[REDACTED]' : child, depth + 1),
    ]));
  }

  stack(value: unknown): SafeStack {
    const raw = typeof value === 'string' ? value : '';
    if (!raw) return { fingerprint: null, detail: null };
    const normalized = raw
      .split(/\r?\n/)
      .slice(0, 12)
      .map((line) => this.text(line, 240) ?? '')
      .map((line) => line.replace(/:\d+(?::\d+)?/g, ':line'))
      .filter(Boolean)
      .join('\n');
    return {
      fingerprint: normalized ? this.hash(normalized) : null,
      detail: normalized || null,
    };
  }

  fingerprint(parts: Record<string, unknown>): string {
    const normalized = [
      this.token(parts.source),
      this.token(parts.errorCode),
      this.token(parts.errorType),
      this.token(parts.route),
      this.token(parts.feature),
      this.token(parts.provider),
      this.token(parts.model),
      this.token(parts.stackFingerprint),
    ].join('|');
    return this.hash(normalized);
  }

  boundedIdentifier(value: unknown, maxLength = 128): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return /^[A-Za-z0-9._:/-]{1,128}$/.test(trimmed) ? trimmed.slice(0, maxLength) : null;
  }

  route(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const route = value.trim().split('?')[0];
    return /^\/[A-Za-z0-9_./:-]{0,200}$/.test(route) ? route : null;
  }

  maskedIdentity(userId: string | null | undefined): string | null {
    if (!userId) return null;
    return `user_${this.hash(userId).slice(0, 10)}`;
  }

  private value(value: unknown, depth: number): unknown {
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') return this.text(value, 512);
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => this.value(item, depth + 1));
    if (value && typeof value === 'object' && depth <= 3) return this.metadata(value, depth + 1);
    return null;
  }

  private safeKey(value: string): string {
    return value.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64) || 'field';
  }

  private token(value: unknown): string {
    return this.boundedIdentifier(value, 128) ?? '';
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
