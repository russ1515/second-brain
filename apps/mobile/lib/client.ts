import type { AuthTokens } from '@second-brain/shared';
import { isQuotaError } from '@second-brain/shared';
import { API_BASE_URL } from './api';
import { tr } from './i18n';
import { createClientRequestId } from './request-id';
import { clearSession, loadSession, saveSession } from './storage';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly payload: unknown = null,
    /** Opaque correlation id only; never an access token or session value. */
    readonly requestId?: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Set for endpoints that must not carry (or refresh) a session. */
  anonymous?: boolean;
  /** Override only for genuinely long-running endpoints. */
  timeoutMs?: number;
  /** Lets query owners cancel obsolete reads without reporting a timeout. */
  signal?: AbortSignal;
  /** Stable across a logical retry so support can correlate one client action. */
  requestId?: string;
}

const DEFAULT_TIMEOUT_MS = 45_000;
const UPLOAD_TIMEOUT_MS = 90_000;

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  externalSignal?: AbortSignal,
  requestId?: string,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const cancel = () => controller.abort();
  externalSignal?.addEventListener('abort', cancel, { once: true });
  if (externalSignal?.aborted) controller.abort();
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as { name?: string })?.name === 'AbortError') {
      if (externalSignal?.aborted && !timedOut) throw error;
      throw new ApiError(0, tr('error.timeout'), null, requestId);
    }
    throw new ApiError(0, tr('error.network'), null, requestId);
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', cancel);
  }
}

/** Read the API's error shape without pretending we know it exactly. Server-side
 *  failures (5xx) — including the AI services' "temporarily unavailable" — carry
 *  English backend text, so we replace them with a LOCALIZED generic message so
 *  the UI never shows a raw, wrong-language error (§24 / one-language rule). */
function messageFrom(payload: unknown, status: number, fallback: string): string {
  if (status >= 500) return tr('error.serverBusy');
  if (isQuotaError(payload)) return tr('state.quota-limited');
  // API error prose is untrusted transport data: it can contain a provider
  // detail, a document fragment, or a secret.  Keep validation feedback on
  // the server/auditable channels and never render that prose in the client.
  return fallback;
}

async function raw(
  path: string,
  options: RequestOptions,
  accessToken?: string,
  requestId = createClientRequestId(),
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  headers['x-request-id'] = requestId;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  return fetchWithTimeout(`${API_BASE_URL}/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal, requestId);
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
    const requestId = uploadRequestId;
    const headers: Record<string, string> = {};
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;
    headers['x-request-id'] = requestId;
    return fetchWithTimeout(`${API_BASE_URL}/api${path}`, {
      method: 'POST',
      headers,
      body: form,
    }, UPLOAD_TIMEOUT_MS, undefined, requestId);
  };

  const uploadRequestId = createClientRequestId('upload');
  const session = await loadSession();
  let res = await send(session?.accessToken);

  if (res.status === 401 && session) {
    const accessToken = await refresh();
    if (accessToken) res = await send(accessToken);
  }

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(payload, res.status, `Upload failed (${res.status})`), payload, uploadRequestId);
  }
  return payload as T;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const requestId = options.requestId ?? createClientRequestId();
  const session = options.anonymous ? null : await loadSession();
  let res = await raw(path, options, session?.accessToken, requestId);

  if (res.status === 401 && !options.anonymous && session) {
    const accessToken = await refresh();
    if (accessToken) {
      res = await raw(path, options, accessToken, requestId);
    }
  }

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(payload, res.status, `Request failed (${res.status})`), payload, requestId);
  }
  return payload as T;
}
