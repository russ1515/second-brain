/**
 * Public, privacy-safe contract for the Control Center dashboard.  The UI must
 * treat every section independently: a dependency being unavailable must never
 * turn a successful aggregate into a fabricated zero or fail the whole page.
 */
export const DASHBOARD_RANGE_KEYS = ['today', '7d', '30d'] as const;

export type DashboardRangeKey = (typeof DASHBOARD_RANGE_KEYS)[number];
export type DashboardSectionStatus = 'available' | 'unavailable' | 'error';
export type DashboardAvailabilityReason =
  | 'NOT_INSTRUMENTED'
  | 'UNAVAILABLE'
  | 'FORBIDDEN_SECTION'
  | 'BUSINESS_DECISION_REQUIRED';

export interface DashboardRange {
  key: DashboardRangeKey;
  from: string;
  to: string;
  timezone: 'UTC';
}

export interface DashboardSection<T> {
  status: DashboardSectionStatus;
  data: T | null;
  reason?: DashboardAvailabilityReason;
}

export interface DashboardKpi {
  key: string;
  value: number;
  /** A comparison is intentionally null until a complete, like-for-like period exists. */
  change: { absolute: number; percentage: number | null } | null;
  period: string;
  definitionKey: string;
}

export interface DashboardResponse {
  range: DashboardRange;
  generatedAt: string;
  sections: Record<string, DashboardSection<unknown>>;
}
