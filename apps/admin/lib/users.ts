import { api, type ApiProblem } from './api';

/**
 * Transport adapter for the Sprint 3 user control centre.
 *
 * The server owns both authorization and the exact amount of data exposed. The
 * admin client consequently keeps fields optional and treats missing data as
 * unavailable instead of manufacturing zero values or profile information.
 */
export type UnknownRecord = Record<string, unknown>;

export type UserDirectoryQuery = {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  accountStatus?: string;
  plan?: string;
  subscriptionStatus?: string;
  quotaState?: string;
};

export type AdminUserRow = UnknownRecord & {
  id?: string;
  userId?: string;
  email?: string;
  name?: string | null;
  displayName?: string | null;
  accountStatus?: string;
  plan?: string;
  subscriptionStatus?: string;
  quotaState?: string;
  createdAt?: string;
  lastActiveAt?: string | null;
};

export type AdminUserList = {
  items: AdminUserRow[];
  page: number;
  pageSize: number;
  total?: number;
  totalPages?: number;
  summary?: UnknownRecord;
};

export type SectionState = 'loading' | 'available' | 'empty' | 'forbidden' | 'unavailable' | 'error';

export type AdminSection<T = UnknownRecord> = {
  state: SectionState;
  data?: T;
  reason?: string;
  code?: string;
  requestId?: string;
};

export type UserSectionName =
  | 'subscription'
  | 'quotas'
  | 'usage'
  | 'payments'
  | 'sessions'
  | 'security'
  | 'audit'
  | 'activity'
  | 'reports'
  | 'learner-profile'
  | 'support-notes';

export type UserAction =
  | 'suspend'
  | 'reactivate'
  | 'ban'
  | 'revoke-sessions'
  | 'deletion-request'
  | 'plan-override'
  | 'beta-access'
  | 'quota-adjustment';

function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : undefined;
}

function asRows(value: unknown): AdminUserRow[] {
  return Array.isArray(value) ? value.map(asRecord).filter((row): row is AdminUserRow => Boolean(row)) : [];
}

function number(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : '';
}

export function userIdOf(row: UnknownRecord | undefined): string | undefined {
  return string(row?.userId) ?? string(row?.id) ?? string(row?.user_id);
}

/** List results are normalized around the agreed server-pagination contract.
 * Temporary aliases avoid coupling components to a rollout field rename. */
export async function listAdminUsers(query: UserDirectoryQuery): Promise<AdminUserList> {
  const payload = await api<unknown>(`/admin/users${queryString(query)}`);
  const root = asRecord(payload);
  const nested = asRecord(root?.data);
  const source = root ?? nested;
  const items = asRows(root?.items ?? root?.users ?? nested?.items ?? nested?.users ?? payload);
  const page = number(source?.page) ?? number(nested?.page) ?? query.page;
  const pageSize = number(source?.pageSize) ?? number(source?.limit) ?? number(nested?.pageSize) ?? query.pageSize;
  return {
    items,
    page,
    pageSize,
    total: number(source?.total) ?? number(nested?.total),
    totalPages: number(source?.totalPages) ?? number(nested?.totalPages),
    summary: asRecord(source?.summary) ?? asRecord(nested?.summary),
  };
}

function sectionFromPayload(payload: unknown): AdminSection {
  const root = asRecord(payload);
  if (!root) return payload === undefined || payload === null ? { state: 'empty' } : { state: 'available', data: { value: payload } };
  const status = string(root.status)?.toLowerCase();
  if (status === 'unavailable') return { state: 'unavailable', reason: string(root.reason) ?? string(root.message) };
  if (status === 'forbidden') return { state: 'forbidden', reason: string(root.reason) ?? string(root.message) };
  if (status === 'error') return { state: 'error', reason: string(root.reason) ?? string(root.message) };
  const data = asRecord(root.data) ?? asRecord(root.section) ?? root;
  const items = data.items ?? data.events ?? data.rows;
  if (Array.isArray(items) && items.length === 0) return { state: 'empty', data };
  return { state: 'available', data };
}

function mapSectionProblem(problem: ApiProblem): AdminSection {
  if (problem.status === 403) return { state: 'forbidden', reason: problem.message, code: problem.code, requestId: problem.requestId };
  if (problem.status === 404) return { state: 'unavailable', reason: problem.message, code: problem.code, requestId: problem.requestId };
  return { state: 'error', reason: problem.message, code: problem.code, requestId: problem.requestId };
}

export async function getAdminUser(id: string): Promise<AdminSection> {
  try {
    return sectionFromPayload(await api<unknown>(`/admin/users/${encodeURIComponent(id)}`));
  } catch (error) {
    return mapSectionProblem(error as ApiProblem);
  }
}

export async function getAdminUserSection(
  id: string,
  section: UserSectionName,
  query: Record<string, string | number | undefined> = {},
): Promise<AdminSection> {
  try {
    return sectionFromPayload(await api<unknown>(`/admin/users/${encodeURIComponent(id)}/${section}${queryString(query)}`));
  } catch (error) {
    return mapSectionProblem(error as ApiProblem);
  }
}

/** Sensitive learner data is never requested through a URL parameter: reasons
 * can otherwise be retained by browser history, reverse proxies or access
 * logs. The server performs RBAC, records the access audit, and returns only
 * the authorized section. */
export async function requestAdminUserLearnerProfileAccess(id: string, reason: string): Promise<AdminSection> {
  try {
    return sectionFromPayload(await api<unknown>(`/admin/users/${encodeURIComponent(id)}/learner-profile/access`, {
      method: 'POST', body: JSON.stringify({ access: 'highly_restricted', reason }),
    }));
  } catch (error) {
    return mapSectionProblem(error as ApiProblem);
  }
}

/** Internal notes use their own paginated endpoint. They are intentionally not
 * folded into the detail response because their operational text deserves an
 * explicit, capability-gated user action. */
export async function createAdminSupportNote(id: string, body: string, reason: string): Promise<UnknownRecord> {
  return api<UnknownRecord>(`/admin/users/${encodeURIComponent(id)}/support-notes`, {
    method: 'POST', body: JSON.stringify({ body, reason }),
  });
}

/**
 * Sends exactly one semantic mutation. We intentionally do not fall back to a
 * different business action (for example a paid plan change) when an override
 * endpoint is unavailable: an ADMIN_OVERRIDE must never become a fake payment.
 */
export async function mutateAdminUser(
  id: string,
  action: UserAction,
  body: UnknownRecord,
): Promise<unknown> {
  const encodedId = encodeURIComponent(id);
  const paths: Record<UserAction, string> = {
    suspend: `/admin/users/${encodedId}/suspend`,
    reactivate: `/admin/users/${encodedId}/reactivate`,
    ban: `/admin/users/${encodedId}/ban`,
    'revoke-sessions': `/admin/users/${encodedId}/sessions/revoke`,
    'deletion-request': `/admin/users/${encodedId}/deletion-requests`,
    'plan-override': `/admin/users/${encodedId}/plan-override`,
    'beta-access': `/admin/users/${encodedId}/beta-access`,
    'quota-adjustment': `/admin/users/${encodedId}/quota-adjustment`,
  };
  return api(paths[action], { method: 'POST', body: JSON.stringify(body) });
}

export async function completeAdminStepUp(code: string): Promise<void> {
  await api('/auth/2fa/step-up', { method: 'POST', body: JSON.stringify({ code }) });
}

export function sectionRecord(section: AdminSection | undefined): UnknownRecord | undefined {
  return section?.data;
}

export function recordValue(record: UnknownRecord | undefined, names: string[]): unknown {
  if (!record) return undefined;
  for (const name of names) if (record[name] !== undefined && record[name] !== null) return record[name];
  return undefined;
}

export function recordString(record: UnknownRecord | undefined, names: string[]): string | undefined {
  return string(recordValue(record, names));
}

export function recordNumber(record: UnknownRecord | undefined, names: string[]): number | undefined {
  return number(recordValue(record, names));
}

export function recordRows(record: UnknownRecord | undefined, names = ['items', 'rows', 'events']): UnknownRecord[] {
  if (!record) return [];
  for (const name of names) {
    const rows = record[name];
    if (Array.isArray(rows)) return rows.map(asRecord).filter((row): row is UnknownRecord => Boolean(row));
  }
  return [];
}

export function nestedRecord(record: UnknownRecord | undefined, names: string[]): UnknownRecord | undefined {
  for (const name of names) {
    const candidate = asRecord(record?.[name]);
    if (candidate) return candidate;
  }
  return undefined;
}
