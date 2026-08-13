/** Usage & Quotas engine (Sprint 8.3). Generic, extensible: a metric is defined
 *  once in the catalog and its limit lives in the plan's `quotas` map, so a new
 *  limit is added without any schema or contract change. */

export type UsageUnit = 'count' | 'bytes' | 'minutes';

/** The metrics shipped today. New keys can be added freely — consumers should
 *  treat the key as an open string, not an exhaustive enum. */
export type UsageMetricKey =
  | 'documents'
  | 'storage'
  | 'ai_questions'
  | 'voice_minutes';

export interface UsageItem {
  key: string;
  unit: UsageUnit;
  /** Amount consumed this period (counters) or currently in use (gauges). */
  used: number;
  /** Plan limit; null means unlimited / not capped. */
  limit: number | null;
}

export interface UsageView {
  /** Reset bucket the counters belong to (e.g. "2026-08"). */
  period: string;
  items: UsageItem[];
}

/** Report consumption of a client-metered metric (e.g. voice minutes recorded
 *  on-device). Server-side metrics are recorded by the backend itself. */
export interface RecordUsageRequest {
  metric: string;
  amount?: number;
}
