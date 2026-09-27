export type QrPayload =
  | { kind: 'url'; raw: string; url: string }
  | { kind: 'text'; raw: string }
  | { kind: 'blocked'; raw: string; reason: 'empty' | 'too-long' | 'dangerous-scheme' | 'invalid-url' };

const MAX_QR_CHARACTERS = 4096;
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** QR contents remain inert data until this classifier and an explicit user
 * confirmation allow an http(s) navigation. Unknown/custom schemes are not
 * handed to Linking and raw text is never interpreted as an AI instruction. */
export function classifyQrPayload(input: string): QrPayload {
  const raw = input.trim();
  if (!raw) return { kind: 'blocked', raw, reason: 'empty' };
  if (raw.length > MAX_QR_CHARACTERS) return { kind: 'blocked', raw, reason: 'too-long' };
  if (raw.startsWith('//')) return { kind: 'blocked', raw, reason: 'invalid-url' };

  const scheme = raw.match(SCHEME)?.[1]?.toLowerCase();
  if (!scheme) return { kind: 'text', raw };
  if (scheme !== 'http' && scheme !== 'https') {
    return { kind: 'blocked', raw, reason: 'dangerous-scheme' };
  }
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname) return { kind: 'blocked', raw, reason: 'invalid-url' };
    return { kind: 'url', raw, url: parsed.toString() };
  } catch {
    return { kind: 'blocked', raw, reason: 'invalid-url' };
  }
}

export function isRepeatedQr(previous: string | null, next: string): boolean {
  return previous === next;
}
