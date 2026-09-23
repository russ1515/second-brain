import { api, type ApiProblem } from './api';

/**
 * Transport helpers for the operational diagnostic surfaces.
 *
 * The API is authoritative for access control and redaction.  The client is
 * deliberately defensive as well: it unwraps only documented, non-sensitive
 * summary fields and never treats a payload string as trusted instructions.
 */
export type DiagnosticRecord = Record<string, unknown>;

export type BugStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'INVESTIGATING'
  | 'FIX_IN_PROGRESS'
  | 'FIXED'
  | 'MONITORING'
  | 'RESOLVED'
  | 'REOPENED'
  | 'WONT_FIX'
  | 'DUPLICATE';

export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'WAITING_FOR_ENGINEERING' | 'RESOLVED' | 'CLOSED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type DataAvailability = 'AVAILABLE' | 'NOT_AVAILABLE' | 'NOT_INSTRUMENTED' | 'INSUFFICIENT_DATA';

export interface PageData {
  rows: DiagnosticRecord[];
  page: number;
  pageSize: number;
  total?: number;
  nextCursor?: string;
  availability: DataAvailability;
  /** Optional server aggregate. It is never inferred from a paginated list. */
  summary?: DiagnosticRecord;
}

const privateKeys = new Set([
  'stack', 'stacktrace', 'stackdetail', 'metadata', 'metadatasanitized', 'payload', 'rawpayload',
  'description', 'reportdescription', 'body', 'content', 'email', 'userid', 'sessionid', 'ip',
  'authorization', 'cookie', 'token', 'password', 'secret', 'apikey', 'rawmessage',
]);
const diagnosticCollectionKeys = new Set(['observed', 'correlated', 'hypotheses', 'evidence', 'nextchecks']);
const internalRelationKeys = new Set(['reportid', 'buggroupid', 'incidentid', 'assignedtoid', 'duplicateofid']);

export function isRecord(value: unknown): value is DiagnosticRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function recordRows(value: unknown, keys: readonly string[] = ['items', 'rows', 'bugs', 'incidents', 'cases', 'reports', 'events', 'diagnostics']): DiagnosticRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord);
    if (isRecord(value[key])) {
      const nested = recordRows(value[key], keys);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function recordValue(record: DiagnosticRecord | undefined, names: readonly string[]): unknown {
  if (!record) return undefined;
  for (const name of names) if (record[name] !== undefined && record[name] !== null) return record[name];
  return undefined;
}

export function recordString(record: DiagnosticRecord | undefined, names: readonly string[]): string | undefined {
  const value = recordValue(record, names);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function recordNumber(record: DiagnosticRecord | undefined, names: readonly string[]): number | undefined {
  const value = recordValue(record, names);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

/** Diagnostic collections are reduced to bounded, redacted display facts. */
export function recordTextList(record: DiagnosticRecord | undefined, names: readonly string[], maximum = 12): string[] {
  const value = recordValue(record, names);
  if (!Array.isArray(value)) return typeof value === 'string' && value.trim() ? [safeText(value)] : [];
  return value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, maximum).map((item) => safeText(item, 220));
}

export function normalizeIdentifier(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

/** Keep an opaque-but-useful identifier, never an API UUID or a user ID. */
export function publicReference(record: DiagnosticRecord | undefined, prefix: 'BUG' | 'INCIDENT' | 'CASE' | 'REPORT' = 'BUG'): string {
  const direct = recordString(record, ['publicId', 'reference', 'displayId', 'key', 'code']);
  if (direct) return safeText(direct, 72);
  const id = recordString(record, ['id', 'bugId', 'incidentId', 'caseId', 'reportId']);
  if (!id) return `${prefix} —`;
  // UUID-like values must not be promoted as an exposed user/system identifier.
  const compact = id.replace(/[^a-zA-Z0-9]/g, '');
  return compact.length >= 12 ? `${prefix}-${compact.slice(0, 8).toUpperCase()}` : safeText(id, 72);
}

/**
 * A last safety barrier for text that is already expected to be sanitized by
 * the server.  It makes accidental credential-like fragments unrenderable and
 * keeps error/report text bounded.  It is not a substitute for server-side
 * redaction before persistence.
 */
export function safeText(value: unknown, maximum = 180): string {
  if (typeof value !== 'string') return '—';
  const compact = value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!compact) return '—';
  const redacted = compact
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/ig, '$1[REDACTED]')
    .replace(/(cookie\s*[:=]\s*)([^\s,;]+)/ig, '$1[REDACTED]')
    .replace(/(password|passphrase|api[_ -]?key|secret|refresh[_ -]?token|access[_ -]?token|otp|totp)\s*[:=]\s*([^\s,;]+)/ig, '$1=[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/ig, 'Bearer [REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig, '[MASKED_EMAIL]');
  return redacted.length > maximum ? `${redacted.slice(0, Math.max(0, maximum - 1)).trimEnd()}…` : redacted;
}

/** Rendered tables have an allow-list instead of spreading server records. */
export function safeSummary(record: DiagnosticRecord): DiagnosticRecord {
  const result: DiagnosticRecord = {};
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    if (privateKeys.has(normalizedKey)) continue;
    if (normalizedKey === 'reportid' && typeof value === 'string') { result.reportReference = publicReference({ id: value }, 'REPORT'); continue; }
    if (normalizedKey === 'buggroupid' && typeof value === 'string') { result.bugReference = publicReference({ id: value }, 'BUG'); continue; }
    if (normalizedKey === 'incidentid' && typeof value === 'string') { result.incidentReference = publicReference({ id: value }, 'INCIDENT'); continue; }
    if (normalizedKey === 'assignedto' && typeof value === 'string') result.assignedToMasked = safeText(value, 96);
    if ((normalizedKey === 'user' || normalizedKey === 'identity') && typeof value === 'string') result.maskedIdentity = safeText(value, 96);
    if (internalRelationKeys.has(normalizedKey)) continue;
    if (typeof value === 'string') result[key] = safeText(value);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) result[key] = value;
    else if (diagnosticCollectionKeys.has(normalizedKey) && Array.isArray(value)) result[key] = value.slice(0, 50).map((entry) => safeDiagnosticEntry(entry)).filter((entry): entry is string => Boolean(entry));
    else if (normalizedKey === 'incident' && isRecord(value)) {
      result.incidentReference = publicReference(value, 'INCIDENT');
      const title = recordString(value, ['title']); if (title) result.incidentTitle = safeText(title, 180);
    } else if (normalizedKey === 'buggroup' && isRecord(value)) {
      result.bugReference = publicReference(value, 'BUG');
      const title = recordString(value, ['title']); if (title) result.bugTitle = safeText(title, 180);
    } else if (normalizedKey === 'report' && isRecord(value)) {
      result.reportReference = publicReference(value, 'REPORT');
      const category = recordString(value, ['category']); if (category) result.category = safeText(category, 96);
    }
  }
  return result;
}

function safeDiagnosticEntry(value: unknown): string | undefined {
  if (typeof value === 'string') return safeText(value, 220);
  if (!isRecord(value)) return undefined;
  const statement = recordString(value, ['statement', 'summary', 'label']);
  if (statement) return safeText(statement, 220);
  // Evidence IDs remain internal implementation details. Keep independently
  // checkable source attributes without exposing a raw event/user identifier.
  const fields = ['source', 'errorCode', 'provider', 'model', 'version', 'route', 'feature']
    .map((field) => recordString(value, [field]))
    .filter((field): field is string => Boolean(field));
  return fields.length ? safeText(fields.join(' · '), 220) : undefined;
}

function availability(value: unknown): DataAvailability {
  const normalized = normalizeIdentifier(value);
  if (normalized === 'NOT_INSTRUMENTED' || normalized === 'UNAVAILABLE') return 'NOT_INSTRUMENTED';
  if (normalized === 'NOT_AVAILABLE') return 'NOT_AVAILABLE';
  if (normalized === 'INSUFFICIENT_DATA' || normalized === 'EMPTY') return 'INSUFFICIENT_DATA';
  return 'AVAILABLE';
}

export function pageData(payload: unknown, keys?: readonly string[]): PageData {
  const root = isRecord(payload) ? payload : {};
  // Some established admin endpoints return a direct array while Sprint 5
  // endpoints return a paginated envelope. Both remain explicit data; neither
  // is converted into a fabricated empty/zero result.
  const data: DiagnosticRecord = Array.isArray(payload) ? { items: payload } : isRecord(root.data) ? root.data : root;
  const pagination = isRecord(data.pagination) ? data.pagination : data;
  return {
    rows: recordRows(data, keys).map(safeSummary),
    page: recordNumber(pagination, ['page']) ?? 1,
    pageSize: recordNumber(pagination, ['pageSize', 'limit']) ?? 25,
    total: recordNumber(pagination, ['total', 'totalCount']),
    nextCursor: recordString(pagination, ['nextCursor', 'cursor']),
    availability: availability(recordValue(data, ['availability', 'dataStatus', 'status'])),
    summary: isRecord(data.summary) ? safeSummary(data.summary) : isRecord(data.overview) ? safeSummary(data.overview) : isRecord(data.kpis) ? safeSummary(data.kpis) : undefined,
  };
}

function query(params: Record<string, string | number | undefined>): string {
  const values = Object.entries(params).filter((entry): entry is [string, string | number] => entry[1] !== undefined && entry[1] !== '');
  return values.length ? `?${new URLSearchParams(values.map(([key, value]) => [key, String(value)])).toString()}` : '';
}

export async function getBugs(params: Record<string, string | number | undefined> = {}): Promise<PageData> {
  return pageData(await api<unknown>(`/admin/bugs${query(params)}`), ['items', 'bugs', 'rows']);
}

export async function getBug(id: string): Promise<DiagnosticRecord | null> {
  const payload = await api<unknown>(`/admin/bugs/${encodeURIComponent(id)}`);
  const root = isRecord(payload) ? payload : null;
  const envelope = isRecord(root?.data) ? root.data : root;
  const data = isRecord(envelope?.bug) ? envelope.bug : envelope;
  return data ? safeSummary(data) : null;
}

export async function getBugEvents(id: string, params: Record<string, string | number | undefined> = {}): Promise<PageData> {
  return pageData(await api<unknown>(`/admin/bugs/${encodeURIComponent(id)}/events${query(params)}`), ['items', 'events', 'rows']);
}

export async function getBugUsers(id: string, params: Record<string, string | number | undefined> = {}): Promise<PageData> {
  return pageData(await api<unknown>(`/admin/bugs/${encodeURIComponent(id)}/users${query(params)}`), ['items', 'users', 'rows']);
}

export async function getBugDiagnostics(id: string): Promise<PageData> {
  return pageData(await api<unknown>(`/admin/bugs/${encodeURIComponent(id)}/diagnostics`), ['items', 'diagnostics', 'rows']);
}

export async function getIncidents(params: Record<string, string | number | undefined> = {}): Promise<PageData> {
  return pageData(await api<unknown>(`/admin/incidents${query(params)}`), ['items', 'incidents', 'rows']);
}

export async function getSupportCases(params: Record<string, string | number | undefined> = {}): Promise<PageData> {
  return pageData(await api<unknown>(`/admin/support/cases${query(params)}`), ['items', 'cases', 'reports', 'rows']);
}

/**
 * The admin Error Boundary records that a rendering failure happened without
 * exporting the Error object. A stack, error message, form value, user ID, and
 * any route parameter are intentionally excluded from client telemetry.
 */
export function captureAdminFrontendError(): void {
  if (typeof window === 'undefined') return;
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const staticSegments = new Set(['', 'dashboard', 'users', 'plans', 'usage', 'costs', 'bugs', 'incidents', 'support', 'infrastructure', 'payments', 'emails', 'documents', 'security', 'analytics', 'settings', 'login']);
  const route = window.location.pathname
    .split('/')
    .map((segment) => staticSegments.has(segment) ? segment : ':param')
    .join('/')
    .slice(0, 180) || '/';
  void api('/telemetry/errors', {
    method: 'POST',
    body: JSON.stringify({
      source: 'frontend',
      ingestId: `admin-render-${random}`,
      code: 'ADMIN_RENDER_FAILURE',
      message: 'Admin rendering failure observed.',
      route,
      feature: 'ADMIN_CONTROL_CENTER',
      platform: 'web',
      metadata: { surface: 'admin', capture: 'error_boundary' },
    }),
  }, false).catch(() => undefined);
}

async function action<T>(path: string, body: DiagnosticRecord): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) }, false);
}

export async function triageBug(id: string, reason: string): Promise<void> {
  await action(`/admin/bugs/${encodeURIComponent(id)}/triage`, { reason: safeText(reason, 600) });
}

export async function setBugStatus(id: string, status: BugStatus, reason: string, details: { fixReference?: string; targetRelease?: string } = {}): Promise<void> {
  await action(`/admin/bugs/${encodeURIComponent(id)}/status`, {
    status: status.toLowerCase(),
    reason: safeText(reason, 600),
    ...(details.fixReference?.trim() ? { fixReference: safeText(details.fixReference, 128) } : {}),
    ...(details.targetRelease?.trim() ? { targetRelease: safeText(details.targetRelease, 128) } : {}),
  });
}

export async function assignBug(id: string, assigneeId: string, reason: string): Promise<void> {
  await action(`/admin/bugs/${encodeURIComponent(id)}/assign`, { assigneeId: safeText(assigneeId, 140), reason: safeText(reason, 600) });
}

export async function markBugDuplicate(id: string, duplicateOf: string, reason: string): Promise<void> {
  await action(`/admin/bugs/${encodeURIComponent(id)}/duplicate`, { duplicateOfId: safeText(duplicateOf, 140), reason: safeText(reason, 600) });
}

export async function diagnoseBug(id: string, reason: string): Promise<void> {
  // The server builds minimal, sanitized diagnostic context.  Report/event text
  // is never sent from this client as an instruction or a prompt.
  await action(`/admin/bugs/${encodeURIComponent(id)}/diagnose`, { reason: safeText(reason, 600) });
}

export async function setIncidentStatus(id: string, status: IncidentStatus, reason: string): Promise<void> {
  await action(`/admin/incidents/${encodeURIComponent(id)}/status`, { status: status.toLowerCase(), note: safeText(reason, 600) });
}

export async function setSupportStatus(id: string, status: SupportStatus, reason: string): Promise<void> {
  await action(`/admin/support/cases/${encodeURIComponent(id)}/status`, { status: status.toLowerCase(), note: safeText(reason, 600) });
}

export async function assignSupportCase(id: string, assigneeId: string, reason: string): Promise<void> {
  await action(`/admin/support/cases/${encodeURIComponent(id)}/assign`, { assignedToId: safeText(assigneeId, 140), note: safeText(reason, 600) });
}

/** Do not echo backend bodies; request IDs support a safe human hand-off. */
export function safeProblem(problem: unknown): string {
  const apiProblem = problem as ApiProblem;
  const suffix = apiProblem?.requestId ? ` · request ${safeText(apiProblem.requestId, 80)}` : '';
  if (apiProblem?.status === 403) return `FORBIDDEN${suffix}`;
  if (apiProblem?.status === 401) return `AUTHENTICATION_REQUIRED${suffix}`;
  return `${safeText(apiProblem?.code ?? 'REQUEST_FAILED', 80)}${suffix}`;
}
