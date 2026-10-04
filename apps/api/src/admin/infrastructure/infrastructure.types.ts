export const INFRASTRUCTURE_RANGE_KEYS = ['now', '1h', '24h', '7d'] as const;

export type InfrastructureRangeKey = (typeof INFRASTRUCTURE_RANGE_KEYS)[number];
export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
export type InfrastructureDataStatus = 'OBSERVED' | 'INSUFFICIENT_DATA' | 'NOT_INSTRUMENTED' | 'UNKNOWN';
export type AlertState = 'ACTIVE' | 'NO_ACTIVE_ALERT' | 'NOT_INSTRUMENTED' | 'BUSINESS_DECISION_REQUIRED';

export interface InfrastructureRange {
  key: InfrastructureRangeKey;
  from: string;
  to: string;
}

export interface SystemHealthComponent {
  key: string;
  status: SystemHealthStatus;
  dataStatus: InfrastructureDataStatus;
  observedAt: string | null;
  reason?: string;
}

export interface ProviderHealthSummary {
  provider: string;
  service: 'LLM' | 'EMBEDDINGS' | 'SPEECH' | 'SEARCH' | 'VISION' | 'OTHER';
  model: string | null;
  status: SystemHealthStatus;
  dataStatus: InfrastructureDataStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastObservedAt: string | null;
  /** Counts are a bounded lower-bound sample when true, never a full-period total. */
  sampled: boolean;
  recentAttempts: number | null;
  recentFailures: number | null;
  recentRetryOperations: number | null;
  averageLatencyMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
}

export interface InfrastructureAlert {
  key: string;
  component: string;
  state: AlertState;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null;
  observedAt: string | null;
  reason?: string;
}

export interface InfrastructureCorrelation {
  component: string;
  source: string;
  bugGroupId: string;
  incidentId: string | null;
  severity: string;
  occurrenceCount: number;
  affectedUsersCount: number;
  lastSeen: string;
}

export interface InfrastructureOverview {
  range: InfrastructureRange;
  generatedAt: string;
  overall: {
    status: SystemHealthStatus;
    dataStatus: InfrastructureDataStatus;
    reason?: string;
  };
  components: SystemHealthComponent[];
  performance: {
    currentProcess: {
      dataStatus: InfrastructureDataStatus;
      scope: 'CURRENT_PROCESS_ONLY';
      uptimeSeconds: number;
      requestCount: number;
      serverErrors: number;
      errorRate: number | null;
      p50Ms: number | null;
      p95Ms: number | null;
      processRssMb: number;
      processHeapUsedMb: number;
    };
    selectedRange: {
      dataStatus: InfrastructureDataStatus;
      errorEvents: number | null;
      httpErrorRate: null;
      slowRequests: null;
      reason?: string;
    };
  };
  providers: ProviderHealthSummary[];
  resources: {
    dataStatus: InfrastructureDataStatus;
    observedAt: string | null;
    reason?: string;
    host: {
      uptimeSeconds: number;
      cpuCores: number;
      load1: number;
      load5: number;
      load15: number;
      memoryTotalBytes: number;
      memoryAvailableBytes: number;
      diskTotalBytes: number;
      diskAvailableBytes: number;
    } | null;
    containers: {
      total: number;
      running: number;
      unhealthy: number;
      restarting: number;
    } | null;
  };
  alerts: InfrastructureAlert[];
  correlations: InfrastructureCorrelation[];
}
