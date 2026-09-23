export type ApiProblem = Error & { status?: number; code?: string; requestId?: string };

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api';
const configuredApiTimeout = Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS ?? '30000');
// Keep failures bounded, but allow real authenticated PostgreSQL requests
// (notably Argon2-backed login and MFA step-up) to complete on slower staging
// hosts instead of aborting a valid security flow after twelve seconds.
const API_TIMEOUT_MS = Number.isFinite(configuredApiTimeout) && configuredApiTimeout >= 5_000 && configuredApiTimeout <= 60_000
  ? configuredApiTimeout
  : 30_000;
let accessToken: string | null = null;

/** Backend prose is never safe to render in an administrative browser. */
function safeFailureMessage(status: number): string {
  if (status === 401) return 'Authentication is required.';
  if (status === 403) return 'You do not have permission for this action.';
  if (status === 404) return 'The requested resource was not found.';
  if (status === 409) return 'The request conflicts with the current state.';
  if (status === 429) return 'Too many requests. Please try again shortly.';
  if (status >= 500) return 'The service is temporarily unavailable.';
  return `Request could not be processed (${status}).`;
}

function safeErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const value = (body as { code?: unknown }).code;
  return typeof value === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(value) ? value : undefined;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof sessionStorage !== 'undefined') {
    if (token) sessionStorage.setItem('sb-admin-access', token);
    else sessionStorage.removeItem('sb-admin-access');
  }
}

export function restoreAccessToken(): string | null {
  accessToken = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('sb-admin-access');
  return accessToken;
}

export async function api<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json', 'X-Request-Id': requestId,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
    const returnedRequestId = response.headers.get('x-request-id') ?? requestId;
    const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      const problem = new Error(safeFailureMessage(response.status)) as ApiProblem;
      problem.status = response.status;
      problem.code = safeErrorCode(body);
      problem.requestId = returnedRequestId;
      if (response.status === 401) setAccessToken(null);
      throw problem;
    }
    return body as T;
  } catch (error) {
    if (retry && (!init.method || init.method === 'GET') && !(error as ApiProblem).status) {
      return api<T>(path, init, false);
    }
    const problem = error as ApiProblem;
    problem.code ??= problem.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
    problem.requestId ??= requestId;
    throw problem;
  } finally {
    clearTimeout(timeout);
  }
}

export const adminEnvironment = (process.env.EXPO_PUBLIC_ADMIN_ENVIRONMENT ?? 'DEVELOPMENT').toUpperCase();
export { API_URL };
