/**
 * Monitoring & Observability (Sprint 10.4).
 *
 * The internal health snapshot the Monitoring Dashboard reads. Everything is
 * measured in-process (HTTP timings, AI calls, cache, memory) and also exported
 * in Prometheus text format at `GET /metrics` for Prometheus/Grafana to scrape.
 */

export interface AiModelStat {
  model: string;
  calls: number;
  errors: number;
  avgMs: number;
}

export interface MonitoringSnapshot {
  uptimeSeconds: number;
  http: {
    total: number;
    ok: number; // 2xx/3xx
    clientErrors: number; // 4xx
    serverErrors: number; // 5xx
    /** Share of requests that were 5xx, 0..1. */
    errorRate: number;
    p50Ms: number;
    p95Ms: number;
  };
  ai: {
    calls: number;
    errors: number;
    avgMs: number;
    byModel: AiModelStat[];
  };
  cache: {
    hits: number;
    misses: number;
    /** 0..1. */
    hitRate: number;
  };
  process: {
    rssMb: number;
    heapUsedMb: number;
  };
  generatedAt: string;
}
