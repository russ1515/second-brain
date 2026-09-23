import { api, type ApiProblem } from './api';

/**
 * Transport adapter for the Sprint 4 Cost Center.
 *
 * Cost telemetry is deliberately treated as partial rollout data. A missing
 * price or an endpoint that has not yet been instrumented must stay visible to
 * an administrator; this module consequently never turns an absent number into
 * zero.
 */
export type CostRange = 'today' | '7d' | '30d' | '90d';
export type CostStatus = 'MEASURED' | 'ESTIMATED' | 'UNKNOWN' | 'NOT_AVAILABLE' | 'NOT_INSTRUMENTED' | 'INSUFFICIENT_DATA';
export type CostSectionState = 'loading' | 'available' | 'empty' | 'forbidden' | 'unavailable' | 'error';
export type CostRecord = Record<string, unknown>;

export interface CostFilters {
  range: CostRange;
  plan?: string;
  feature?: string;
  provider?: string;
  model?: string;
  status?: CostStatus;
}

export interface CostSection<T = unknown> {
  state: CostSectionState;
  data?: T;
  reason?: string;
  code?: string;
  requestId?: string;
}

export const COST_SECTION_KEYS = [
  'overview', 'plans', 'features', 'providers', 'models', 'users', 'voice',
  'documents', 'research', 'languages', 'anomalies', 'instrumentation', 'pricing',
] as const;

export type CostSectionKey = (typeof COST_SECTION_KEYS)[number];
export type CostCenterSections = Record<CostSectionKey, CostSection>;

function asRecord(value: unknown): CostRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as CostRecord : undefined;
}

function string(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function queryString(filters: CostFilters): string {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  for (const [key, value] of Object.entries(filters)) {
    if (key !== 'range' && value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Accept both the explicit Cost Center envelope and a direct payload while
 * preserving provider domain statuses such as UNKNOWN and NOT_INSTRUMENTED. */
export function costSectionFromPayload(payload: unknown): CostSection {
  if (payload === undefined || payload === null) return { state: 'empty' };
  const root = asRecord(payload);
  if (!root) return { state: 'available', data: payload };

  const transportState = string(root.state)?.toLowerCase() ?? string(root.status)?.toLowerCase();
  if (transportState === 'forbidden') return { state: 'forbidden', reason: string(root.reason) ?? string(root.message) };
  if (transportState === 'unavailable') return { state: 'unavailable', reason: string(root.reason) ?? string(root.message) };
  if (transportState === 'error') return { state: 'error', reason: string(root.reason) ?? string(root.message) };

  // A domain cost status is data, not an unavailable API response.
  const data = root.data ?? root.section ?? payload;
  if (Array.isArray(data) && data.length === 0) return { state: 'empty', data };
  const record = asRecord(data);
  const rows = record?.items ?? record?.rows ?? record?.events ?? record?.results;
  const hasTelemetrySummary = record?.cost !== undefined
    || record?.coverage !== undefined
    || record?.total !== undefined
    || record?.summary !== undefined;
  if (Array.isArray(rows) && rows.length === 0 && !hasTelemetrySummary && Object.keys(record ?? {}).length <= 4) return { state: 'empty', data };
  return { state: 'available', data };
}

function problemSection(problem: ApiProblem): CostSection {
  if (problem.status === 403) return { state: 'forbidden', reason: problem.message, code: problem.code, requestId: problem.requestId };
  if (problem.status === 404) return { state: 'unavailable', reason: problem.message, code: problem.code, requestId: problem.requestId };
  return { state: 'error', reason: problem.message, code: problem.code, requestId: problem.requestId };
}

export async function getCostSection(key: CostSectionKey, filters: CostFilters): Promise<CostSection> {
  try {
    return costSectionFromPayload(await api<unknown>(`/admin/costs/${key}${queryString(filters)}`));
  } catch (error) {
    return problemSection(error as ApiProblem);
  }
}

/** Fetch independently so an undeployed secondary analytical endpoint cannot
 * hide reliable provider-cost telemetry from the rest of the page. */
export async function getCostCenter(filters: CostFilters): Promise<CostCenterSections> {
  const results = await Promise.all(COST_SECTION_KEYS.map(async (key) => [key, await getCostSection(key, filters)] as const));
  return Object.fromEntries(results) as CostCenterSections;
}
