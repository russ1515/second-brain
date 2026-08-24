import type { AuthTokens } from '@second-brain/shared';
import { API_BASE_URL } from './api';
import { tr } from './i18n';
import { clearSession, loadSession, saveSession } from './storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set for endpoints that must not carry (or refresh) a session. */
  anonymous?: boolean;
}

/** Read the API's error shape without pretending we know it exactly. Server-side
 *  failures (5xx) — including the AI services' "temporarily unavailable" — carry
 *  English backend text, so we replace them with a LOCALIZED generic message so
 *  the UI never shows a raw, wrong-language error (§24 / one-language rule). */
function messageFrom(payload: unknown, status: number, fallback: string): string {
  if (status >= 500) return tr('error.serverBusy');
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message) && typeof message[0] === 'string') return message[0];
  }
  return fallback;
}

async function raw(
  path: string,
  options: RequestOptions,
  accessToken?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  return fetch(`${API_BASE_URL}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Exchange the refresh token for a new pair. Returns false if the session is
 *  truly gone (the API rotates refresh tokens and revokes reused ones). */
async function refresh(): Promise<string | null> {
  const session = await loadSession();
  if (!session) return null;

  const res = await raw('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: session.refreshToken },
  });
  if (!res.ok) {
    await clearSession();
    return null;
  }
  const tokens = (await res.json()) as AuthTokens;
  await saveSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  return tokens.accessToken;
}

/**
 * Authenticated request with one transparent refresh.
 *
 * Access tokens live 15 minutes, so a learner who leaves the classroom open
 * WILL hit a 401 mid-session. Retrying once after a refresh is the difference
 * between "the app randomly logs me out" and it just working.
 */
/**
 * Multipart upload with the same one-shot refresh as `api()`.
 *
 * Kept separate because the body must NOT be JSON-encoded and the browser has
 * to set its own `content-type` boundary — passing FormData through `api()`
 * would silently corrupt the upload.
 */
export async function apiUpload<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const send = async (accessToken?: string) => {
    const headers: Record<string, string> = {};
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers,
      body: form,
    });
  };

  const session = await loadSession();
  let res = await send(session?.accessToken);

  if (res.status === 401 && session) {
    const accessToken = await refresh();
    if (accessToken) res = await send(accessToken);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(payload, res.status, `Upload failed (${res.status})`));
  }
  return payload as T;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const session = options.anonymous ? null : await loadSession();
  let res = await raw(path, options, session?.accessToken);

  if (res.status === 401 && !options.anonymous && session) {
    const accessToken = await refresh();
    if (accessToken) {
      res = await raw(path, options, accessToken);
    }
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(payload, res.status, `Request failed (${res.status})`));
  }
  return payload as T;
}
