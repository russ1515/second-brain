export type DashboardRange = 'today' | '7d' | '30d';

export type DashboardSectionStatus = 'available' | 'unavailable' | 'error';

export interface DashboardSection<T = unknown> {
  status: DashboardSectionStatus;
  data?: T;
  message?: string;
  updatedAt?: string;
}

/**
 * Dashboard API envelope. It deliberately keeps section payloads independent:
 * instrumentation can arrive incrementally without making a dashboard release
 * invent a zero or fail the rest of the page.
 */
export interface DashboardResponse {
  range?: DashboardRange;
  generatedAt?: string;
  sections?: Partial<Record<DashboardTransportSectionKey, DashboardSection>>;
  // Flat aliases make this client compatible with a short transition period.
  overview?: DashboardSection;
  plans?: DashboardSection;
  subscriptions?: DashboardSection;
  quotas?: DashboardSection;
  usage?: DashboardSection;
  learning?: DashboardSection;
  health?: DashboardSection;
  incidents?: DashboardSection;
  security?: DashboardSection;
  alerts?: DashboardSection;
  activity?: DashboardSection;
}

export type DashboardSectionKey =
  | 'overview'
  | 'plans'
  | 'quotas'
  | 'usage'
  | 'learning'
  | 'health'
  | 'incidents'
  | 'security'
  | 'alerts'
  | 'activity';

/** `subscriptions` is the backend's current aggregate name; `plans` remains
 * the client-facing dashboard block name. */
export type DashboardTransportSectionKey = DashboardSectionKey | 'subscriptions';

const aliases: Partial<Record<DashboardSectionKey, DashboardTransportSectionKey[]>> = {
  overview: ['overview'],
  plans: ['plans', 'subscriptions'],
  quotas: ['quotas'],
  usage: ['usage'],
  learning: ['learning'],
  health: ['health'],
  incidents: ['incidents'],
  security: ['security'],
  alerts: ['alerts'],
  activity: ['activity'],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSection(value: unknown): value is DashboardSection {
  return isRecord(value) && typeof value.status === 'string';
}

function normalizeStatus(value: unknown): DashboardSectionStatus {
  return value === 'available' || value === 'error' || value === 'unavailable' ? value : 'unavailable';
}

/**
 * Read a section without trusting optional, rolling-out dashboard data. A raw
 * payload without a section wrapper is considered real available data; absent
 * sections are explicitly unavailable instead of being represented as zero.
 */
export function getDashboardSection<T>(response: DashboardResponse | null, key: DashboardSectionKey): DashboardSection<T> {
  if (!response) return { status: 'unavailable' };
  const candidates = aliases[key] ?? [key];
  for (const candidate of candidates) {
    const value = response.sections?.[candidate] ?? response[candidate];
    if (isSection(value)) {
      return {
        status: normalizeStatus(value.status),
        data: value.data as T | undefined,
        message: typeof value.message === 'string' ? value.message : undefined,
        updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : undefined,
      };
    }
    if (value !== undefined) return { status: 'available', data: value as T };
  }
  return { status: 'unavailable' };
}

export function dashboardSectionStatus(value: unknown): DashboardSectionStatus {
  return isRecord(value) ? normalizeStatus(value.status) : 'unavailable';
}

export function dashboardRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

export function dashboardList(value: unknown, keys: string[] = ['items']): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  const record = dashboardRecord(value);
  if (!record) return [];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key].filter(isRecord);
    const nested = dashboardRecord(record[key]);
    if (!nested) continue;
    for (const nestedKey of ['items', 'resources', 'engines', 'components', 'events', 'activity']) {
      if (Array.isArray(nested[nestedKey])) return nested[nestedKey].filter(isRecord);
    }
  }
  return [];
}

export function dashboardNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

export function dashboardString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
