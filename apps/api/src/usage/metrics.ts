import type { UsageUnit } from '@second-brain/shared';

/**
 * The usage metric catalog (Sprint 8.3). This is the ONE place to add a new
 * limit: append an entry here and put a number under the same key in a plan's
 * `quotas`. Nothing else changes.
 *
 * - `counter`: consumption accumulated over the period, stored in UsageCounter
 *   (e.g. AI questions, voice minutes).
 * - `gauge`: a current value computed live from existing data (e.g. documents
 *   owned, storage used) — never stored as a counter.
 */
export type MetricType = 'counter' | 'gauge';

export interface MetricDef {
  key: string;
  unit: UsageUnit;
  type: MetricType;
}

export const USAGE_METRICS: readonly MetricDef[] = [
  { key: 'documents', unit: 'count', type: 'gauge' },
  { key: 'storage', unit: 'bytes', type: 'gauge' },
  { key: 'ai_questions', unit: 'count', type: 'counter' },
  { key: 'voice_minutes', unit: 'minutes', type: 'counter' },
] as const;

export function metricDef(key: string): MetricDef | undefined {
  return USAGE_METRICS.find((m) => m.key === key);
}
