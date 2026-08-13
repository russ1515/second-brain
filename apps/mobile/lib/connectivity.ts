import { useEffect, useState } from 'react';

/**
 * Connectivity (Sprint 10.3 — Offline & Sync).
 *
 * A tiny online/offline signal. On web it reads `navigator.onLine` and the
 * `online`/`offline` events; this file is the seam to swap in NetInfo on a real
 * device build (nothing else imports the platform detail). Listeners are
 * notified on every transition so the sync engine can flush the outbox the
 * instant the connection returns.
 */
type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

function nav(): { onLine: boolean } | undefined {
  return typeof navigator !== 'undefined' ? (navigator as { onLine: boolean }) : undefined;
}

export function isOnline(): boolean {
  const n = nav();
  return n ? n.onLine : true; // assume online when we can't tell
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => listeners.forEach((l) => l(true)));
  window.addEventListener('offline', () => listeners.forEach((l) => l(false)));
}

/** Subscribe to connectivity changes. Returns an unsubscribe function. */
export function onConnectivityChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: the current online state, live. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => onConnectivityChange(setOnline), []);
  return online;
}
