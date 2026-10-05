import { api, type ApiProblem } from './api';

/**
 * Defensive transport adapter for the commercial control centre.
 *
 * Commercial values are owned by the authenticated Admin API. The browser
 * deliberately keeps each field optional and never substitutes a missing
 * value with zero, a date, or a product decision.
 */
export const COMMERCIAL_SECTIONS = [
  'overview',
  'plans',
  'subscriptions',
  'payments',
  'usage',
  'features',
  'settings',
  'audit',
] as const;

export type CommercialSectionName = (typeof COMMERCIAL_SECTIONS)[number];
export type CommercialRecord = Record<string, unknown>;
export type CommercialSectionState = 'loading' | 'available' | 'empty' | 'forbidden' | 'unavailable' | 'error';

export interface CommercialSection {
  state: CommercialSectionState;
  items: CommercialRecord[];
  data?: CommercialRecord;
  reason?: string;
  code?: string;
  requestId?: string;
}

export interface PricingUpdate {
  priceMonthly: number;
  priceYearly: number;
  expectedVersion: number;
  reason: string;
}

function asRecord(value: unknown): CommercialRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as CommercialRecord : undefined;
}

function asRows(value: unknown): CommercialRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((row): row is CommercialRecord => Boolean(row))
    : [];
}

/** Exported narrow readers prevent view code from manufacturing values. */
export function commercialValue(record: CommercialRecord | undefined, keys: readonly string[]): unknown {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

export function commercialString(record: CommercialRecord | undefined, keys: readonly string[]): string | undefined {
  const value = commercialValue(record, keys);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function commercialNumber(record: CommercialRecord | undefined, keys: readonly string[]): number | undefined {
  const value = commercialValue(record, keys);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function sectionFromPayload(payload: unknown): CommercialSection {
  if (Array.isArray(payload)) {
    const items = asRows(payload);
    return { state: items.length ? 'available' : 'empty', items };
  }
  const root = asRecord(payload);
  if (!root) return { state: 'empty', items: [] };

  // The established contract uses `items`, while supporting a wrapped response
  // protects the UI from a deployment-order mismatch without treating a
  // missing collection as commercial data.
  const wrapped = asRecord(root.data);
  const items = asRows(root.items).length
    ? asRows(root.items)
    : asRows(wrapped?.items);
  // `overview` can be an aggregate object rather than a collection. It is
  // still authoritative data, so do not turn it into an artificial empty
  // result merely because it has no rows.
  const hasPayload = Object.keys(root).some((key) => key !== 'items' && root[key] !== undefined && root[key] !== null)
    || Object.keys(wrapped ?? {}).some((key) => key !== 'items' && wrapped?.[key] !== undefined && wrapped?.[key] !== null);
  return { state: items.length || hasPayload ? 'available' : 'empty', items, data: root };
}

function problemSection(problem: ApiProblem): CommercialSection {
  if (problem.status === 403) return { state: 'forbidden', items: [], reason: problem.message, code: problem.code, requestId: problem.requestId };
  if (problem.status === 404) return { state: 'unavailable', items: [], reason: problem.message, code: problem.code, requestId: problem.requestId };
  return { state: 'error', items: [], reason: problem.message, code: problem.code, requestId: problem.requestId };
}

export async function getCommercialSection(section: CommercialSectionName): Promise<CommercialSection> {
  try {
    return sectionFromPayload(await api<unknown>(`/admin/commercial/${section}`));
  } catch (error) {
    return problemSection(error as ApiProblem);
  }
}

/**
 * The API accepts integer USD minor units. Keeping that conversion in the UI
 * boundary avoids sending locale-formatted decimal strings to the backend.
 */
export async function updatePlanPricing(slug: string, update: PricingUpdate): Promise<CommercialRecord> {
  return api<CommercialRecord>(`/admin/commercial/plans/${encodeURIComponent(slug)}/pricing`, {
    method: 'PUT',
    body: JSON.stringify(update),
  });
}
