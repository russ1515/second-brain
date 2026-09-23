import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './client';
import { createClientRequestId } from './request-id';

const NOT_INSTRUMENTED = 'NOT_INSTRUMENTED';
const MAX_REPORTED_INGEST_IDS = 200;
/**
 * A learner can move from the error fallback to the report screen immediately.
 * Keep one opaque correlation hint in process memory long enough for that
 * journey, but never write it to device storage or retain it indefinitely.
 */
const RECENT_TELEMETRY_TTL_MS = 5 * 60 * 1_000;
const OPAQUE_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
export const REPORT_MIN_MESSAGE_LENGTH = 10;
export const REPORT_MAX_MESSAGE_LENGTH = 2_000;

// Static route names only. Dynamic segments are deliberately reduced to :id so
// telemetry never carries a document, session, user or conversation identifier.
const SAFE_ROUTE_SEGMENTS = new Set([
  'adaptive-path', 'ai-manager', 'analytics', 'brain', 'calendar', 'coach',
  'daily-session', 'design-system', 'examiner', 'exams', 'foresight', 'for-you',
  'goals', 'graph', 'health', 'homework', 'insights', 'insights-center',
  'language-manager', 'languages', 'learn', 'learning-dna', 'lesson', 'library',
  'mastery', 'memory', 'mentorship', 'monitoring', 'notifications', 'onboarding',
  'organizations', 'planner', 'plugins', 'predictions', 'privacy', 'profile',
  'progress', 'reading', 'recommendations', 'report-problem', 'research',
  'revision', 'revision-engine', 'scan', 'session', 'sign-in', 'strengths',
  'subscription', 'success', 'sync', 'tutor', 'twin-profile', 'usage', 'workspace',
  'writing', 'resource', 'course', 'lesson', 'missions', 'can-do',
]);

let currentRoute = '/';
let lastReportOriginRoute = '/';
const sentIngestIds = new Set<string>();
let recentTelemetry: { requestId: string; route: string; expiresAt: number } | null = null;

function safeValue(value: unknown, maxLength = 64): string {
  if (typeof value !== 'string') return NOT_INSTRUMENTED;
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, maxLength);
  return normalized || NOT_INSTRUMENTED;
}

export function sanitizeClientRoute(value?: string | null): string {
  if (!value) return '/';
  const path = value.trim().split(/[?#]/, 1)[0] ?? '';
  if (!path || path === '/') return '/';
  const segments = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .slice(0, 8)
    .map((segment) => SAFE_ROUTE_SEGMENTS.has(segment) ? segment : ':id');
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function setSafeCurrentRoute(route?: string | null): void {
  currentRoute = sanitizeClientRoute(route);
  if (currentRoute !== '/report-problem' && currentRoute !== '/sign-in') {
    lastReportOriginRoute = currentRoute;
  }
}

export function getSafeCurrentRoute(): string {
  return currentRoute;
}

export function getSafeReportOriginRoute(): string {
  return lastReportOriginRoute;
}

/**
 * Returns a previous, successfully ingested frontend telemetry request only
 * when it belongs to the same normalized route and has not expired. The
 * request id is an opaque correlation value, never an authentication value or
 * user identifier. It deliberately lives only in this module's memory.
 */
export function getRecentSafeTelemetryRequestId(route: string): string | undefined {
  const candidate = recentTelemetry;
  if (!candidate) return undefined;
  if (candidate.expiresAt <= Date.now()) {
    recentTelemetry = null;
    return undefined;
  }

  return candidate.route === sanitizeClientRoute(route)
    ? candidate.requestId
    : undefined;
}

export function featureForSafeRoute(route: string): string {
  const segment = sanitizeClientRoute(route).split('/').filter(Boolean)[0];
  return segment && segment !== ':id' ? `mobile_${segment}` : 'mobile_home';
}

export function clientAppVersion(): string {
  return safeValue(Constants.expoConfig?.version);
}

export function clientBuildVersion(): string {
  return safeValue(Constants.nativeBuildVersion);
}

export function clientPlatform(): string {
  return safeValue(Platform.OS);
}

/**
 * The server applies its own redaction. This client-side pass is deliberately
 * narrow defence in depth: it prevents obvious credentials and payment numbers
 * from leaving the device in a learner report by accident. The report remains
 * untrusted text; no client interpretation or diagnosis is attempted.
 */
export function sanitizeReportMessage(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g, '[redacted-token]')
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+\/-]{12,}\b/gi, '$1 [redacted-token]')
    .replace(/\b(api[_-]?key|secret|token|password|passcode)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[redacted-payment]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted-email]')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, REPORT_MAX_MESSAGE_LENGTH);
}

function rememberIngestId(ingestId: string): boolean {
  if (sentIngestIds.has(ingestId)) return false;
  sentIngestIds.add(ingestId);
  if (sentIngestIds.size > MAX_REPORTED_INGEST_IDS) {
    const first = sentIngestIds.values().next().value;
    if (first) sentIngestIds.delete(first);
  }
  return true;
}

function rememberSuccessfulTelemetry(requestId: string, route: string): void {
  // `requestId` is generated locally, but retain a conservative guard so this
  // in-memory channel can never become a vehicle for arbitrary content.
  if (!OPAQUE_REQUEST_ID_PATTERN.test(requestId)) return;
  recentTelemetry = {
    requestId,
    route: sanitizeClientRoute(route),
    expiresAt: Date.now() + RECENT_TELEMETRY_TTL_MS,
  };
}

export interface SafeClientErrorInput {
  /** Stable per failure instance so a boundary re-render cannot double-ingest. */
  ingestId?: string;
  /** An intentionally small, reviewed code — never Error.message or stack. */
  code?: 'MOBILE_RENDER_ERROR';
  route?: string | null;
}

/**
 * Best-effort frontend telemetry. It has no user content, error text, stack,
 * tokens, headers, query values, screenshots, audio, documents or media.
 * A failed telemetry call is intentionally silent and never changes the UI.
 */
export async function captureSafeClientError(input: SafeClientErrorInput = {}): Promise<boolean> {
  const ingestId = input.ingestId ?? createClientRequestId('ingest');
  if (!rememberIngestId(ingestId)) return false;

  const requestId = createClientRequestId('error');
  const route = sanitizeClientRoute(input.route ?? getSafeCurrentRoute());
  try {
    await api('/telemetry/errors', {
      method: 'POST',
      anonymous: true,
      requestId,
      body: {
        source: 'frontend',
        code: input.code ?? 'MOBILE_RENDER_ERROR',
        type: 'render_error',
        route,
        version: clientAppVersion(),
        platform: clientPlatform(),
        ingestId,
      },
    });
    rememberSuccessfulTelemetry(requestId, route);
    return true;
  } catch {
    return false;
  }
}
