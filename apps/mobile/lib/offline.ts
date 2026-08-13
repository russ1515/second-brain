import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './client';
import { isOnline, onConnectivityChange } from './connectivity';

/**
 * Offline engine (Sprint 10.3).
 *
 * Two halves, both persisted in AsyncStorage so they survive a reload / app
 * restart:
 *
 *  • a READ cache — the last successful GET for a path, served when the network
 *    is unreachable so the learner keeps seeing their data offline;
 *  • a write OUTBOX — mutations made while offline are queued and replayed, in
 *    order, the moment the connection returns (auto-sync). Conflicts are handled
 *    on replay: a 4xx (the server rejected it — stale/duplicate/invalid) drops
 *    the entry; a network error keeps it for the next attempt.
 */

const CACHE_PREFIX = 'sb.cache.';
const OUTBOX_KEY = 'sb.outbox';
const LAST_SYNC_KEY = 'sb.lastSync';

// ── read cache ──────────────────────────────────────────────────────────────

export async function cacheRead<T>(path: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + path);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheWrite(path: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_PREFIX + path, JSON.stringify(value));
  } catch {
    // Best-effort — a cache write must never break a request.
  }
}

/**
 * A GET that survives being offline: fetch live (and cache it), or fall back to
 * the last cached copy when the network is unreachable. Returns whether the data
 * came from the cache so the UI can flag "showing saved data".
 */
export async function fetchWithCache<T>(path: string): Promise<{ data: T; fromCache: boolean }> {
  if (isOnline()) {
    try {
      const data = await api<T>(path);
      await cacheWrite(path, data);
      return { data, fromCache: false };
    } catch (err) {
      // A network failure (not an API error) → try the cache.
      if (err instanceof ApiError) throw err;
      const cached = await cacheRead<T>(path);
      if (cached !== null) return { data: cached, fromCache: true };
      throw err;
    }
  }
  const cached = await cacheRead<T>(path);
  if (cached !== null) return { data: cached, fromCache: true };
  throw new Error('Offline and no saved copy of this data yet.');
}

// ── write outbox ────────────────────────────────────────────────────────────

export interface OutboxEntry {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** Human label for the Sync Center. */
  label: string;
  createdAt: number;
}

async function readOutbox(): Promise<OutboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeOutbox(entries: OutboxEntry[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

/** Queue a write. If online, it's flushed immediately; if not, it waits. */
export async function enqueue(
  entry: Omit<OutboxEntry, 'id' | 'createdAt'>,
): Promise<void> {
  const entries = await readOutbox();
  entries.push({ ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now() });
  await writeOutbox(entries);
  notify();
  if (isOnline()) void flushOutbox();
}

export async function outboxCount(): Promise<number> {
  return (await readOutbox()).length;
}

export async function lastSyncAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  return raw ? Number(raw) : null;
}

let flushing = false;

/** Replay every queued write, in order. Drops entries the server rejects (4xx);
 *  keeps entries that fail on the network for the next attempt. */
export async function flushOutbox(): Promise<{ sent: number; dropped: number; kept: number }> {
  if (flushing || !isOnline()) return { sent: 0, dropped: 0, kept: 0 };
  flushing = true;
  let sent = 0;
  let dropped = 0;
  try {
    let entries = await readOutbox();
    const remaining: OutboxEntry[] = [];
    for (const entry of entries) {
      try {
        await api(entry.path, { method: entry.method, body: entry.body });
        sent++;
      } catch (err) {
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          // Conflict / stale / invalid — the server won't ever accept it. Drop.
          dropped++;
        } else {
          remaining.push(entry); // network hiccup — try again next time
        }
      }
    }
    await writeOutbox(remaining);
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    notify();
    return { sent, dropped, kept: remaining.length };
  } finally {
    flushing = false;
  }
}

// ── change notifications (for the Sync Center) ──────────────────────────────

const subscribers = new Set<() => void>();
function notify() {
  subscribers.forEach((s) => s());
}
export function onOutboxChange(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

// Auto-sync: flush the moment the connection returns.
onConnectivityChange((online) => {
  if (online) void flushOutbox();
});
