import { Injectable, Logger } from '@nestjs/common';
import type { MonitoringSnapshot } from '@second-brain/shared';
import { CacheService } from '../redis/cache.service';

/** Keep the last N latencies for percentile estimates without unbounded memory. */
const LATENCY_WINDOW = 1000;

interface AiAgg {
  calls: number;
  errors: number;
  totalMs: number;
}

/**
 * Metrics registry (Sprint 10.4 — Monitoring & Observability).
 *
 * An in-process collector for HTTP traffic, AI calls, cache effectiveness and
 * process memory. Read as a JSON snapshot by the Monitoring Dashboard and
 * exported in Prometheus text format at `GET /metrics` for Prometheus/Grafana.
 * `captureError` is the seam where a Sentry / OpenTelemetry sink plugs in when a
 * DSN/endpoint is configured — today it counts + logs.
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly startedAt = Date.now();

  private httpTotal = 0;
  private httpOk = 0;
  private httpClientErrors = 0;
  private httpServerErrors = 0;
  private latencies: number[] = [];

  private readonly ai = new Map<string, AiAgg>();

  private capturedErrors = 0;

  constructor(private readonly cache: CacheService) {}

  // ── recording ──────────────────────────────────────────────────────────────

  recordHttp(statusCode: number, ms: number): void {
    this.httpTotal++;
    if (statusCode >= 500) this.httpServerErrors++;
    else if (statusCode >= 400) this.httpClientErrors++;
    else this.httpOk++;
    this.latencies.push(ms);
    if (this.latencies.length > LATENCY_WINDOW) this.latencies.shift();
  }

  recordAiCall(model: string, ms: number, ok: boolean): void {
    const agg = this.ai.get(model) ?? { calls: 0, errors: 0, totalMs: 0 };
    agg.calls++;
    agg.totalMs += ms;
    if (!ok) agg.errors++;
    this.ai.set(model, agg);
  }

  /** The Sentry/OpenTelemetry seam: forward errors to an APM when wired. */
  captureError(err: unknown, context?: string): void {
    this.capturedErrors++;
    this.logger.warn(`captured error${context ? ` [${context}]` : ''}: ${(err as Error)?.message ?? err}`);
    // e.g. Sentry.captureException(err) — enabled once SENTRY_DSN is set.
  }

  // ── reading ────────────────────────────────────────────────────────────────

  snapshot(): MonitoringSnapshot {
    const cache = this.cache.stats();
    const aiCalls = [...this.ai.values()].reduce((s, a) => s + a.calls, 0);
    const aiErrors = [...this.ai.values()].reduce((s, a) => s + a.errors, 0);
    const aiTotalMs = [...this.ai.values()].reduce((s, a) => s + a.totalMs, 0);
    const mem = process.memoryUsage();

    return {
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      http: {
        total: this.httpTotal,
        ok: this.httpOk,
        clientErrors: this.httpClientErrors,
        serverErrors: this.httpServerErrors,
        errorRate: this.httpTotal ? this.httpServerErrors / this.httpTotal : 0,
        p50Ms: this.percentile(0.5),
        p95Ms: this.percentile(0.95),
      },
      ai: {
        calls: aiCalls,
        errors: aiErrors,
        avgMs: aiCalls ? Math.round(aiTotalMs / aiCalls) : 0,
        byModel: [...this.ai.entries()].map(([model, a]) => ({
          model,
          calls: a.calls,
          errors: a.errors,
          avgMs: a.calls ? Math.round(a.totalMs / a.calls) : 0,
        })),
      },
      cache: { hits: cache.hits, misses: cache.misses, hitRate: cache.hitRate },
      process: {
        rssMb: Math.round(mem.rss / 1_048_576),
        heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /** Prometheus text exposition format for Prometheus/Grafana scraping. */
  prometheus(): string {
    const s = this.snapshot();
    const lines: string[] = [];
    const metric = (name: string, help: string, type: string, value: number, labels = '') => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(`${name}${labels} ${value}`);
    };
    metric('sb_uptime_seconds', 'Process uptime.', 'gauge', s.uptimeSeconds);
    metric('sb_http_requests_total', 'Total HTTP requests.', 'counter', s.http.total);
    metric('sb_http_server_errors_total', '5xx responses.', 'counter', s.http.serverErrors);
    metric('sb_http_client_errors_total', '4xx responses.', 'counter', s.http.clientErrors);
    metric('sb_http_latency_p50_ms', 'HTTP latency p50.', 'gauge', s.http.p50Ms);
    metric('sb_http_latency_p95_ms', 'HTTP latency p95.', 'gauge', s.http.p95Ms);
    metric('sb_ai_calls_total', 'Total AI calls.', 'counter', s.ai.calls);
    metric('sb_ai_errors_total', 'Failed AI calls.', 'counter', s.ai.errors);
    metric('sb_ai_latency_avg_ms', 'Average AI call latency.', 'gauge', s.ai.avgMs);
    for (const m of s.ai.byModel) {
      metric('sb_ai_model_calls_total', 'AI calls per model.', 'counter', m.calls, `{model="${m.model}"}`);
    }
    metric('sb_cache_hits_total', 'Cache hits.', 'counter', s.cache.hits);
    metric('sb_cache_misses_total', 'Cache misses.', 'counter', s.cache.misses);
    metric('sb_cache_hit_rate', 'Cache hit rate 0..1.', 'gauge', Number(s.cache.hitRate.toFixed(3)));
    metric('sb_process_rss_mb', 'Resident memory (MB).', 'gauge', s.process.rssMb);
    metric('sb_process_heap_used_mb', 'Heap used (MB).', 'gauge', s.process.heapUsedMb);
    return lines.join('\n') + '\n';
  }

  private percentile(p: number): number {
    if (this.latencies.length === 0) return 0;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return Math.round(sorted[idx]);
  }
}
