import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { UsageItem, UsageView } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../subscription/entitlements.service';
import { USAGE_METRICS, metricDef } from './metrics';

/**
 * Usage & Quotas engine (Sprint 8.3). Records consumption of periodic counters,
 * computes gauge metrics live, and reads limits from the subscriber's plan via
 * EntitlementsService. `consume()` enforces a limit before allowing an action;
 * `record()` just accounts for it. Extensible: metrics come from the catalog and
 * limits from `Plan.quotas` — no code change beyond a catalog entry.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Current reset bucket: calendar month "YYYY-MM". */
  private period(): string {
    return new Date().toISOString().slice(0, 7);
  }

  /** Account for consumption of a COUNTER metric. No-op for gauges/unknown keys. */
  async record(userId: string, metric: string, amount = 1): Promise<void> {
    const def = metricDef(metric);
    if (!def || def.type !== 'counter' || amount <= 0) return;
    const period = this.period();
    await this.prisma.usageCounter.upsert({
      where: { userId_metric_period: { userId, metric, period } },
      create: { userId, metric, period, used: amount },
      update: { used: { increment: amount } },
    });
  }

  /** Enforce the limit, then record. Throws 403 when the action would exceed the
   *  plan quota. Returns the remaining allowance (null = unlimited). */
  async consume(userId: string, metric: string, amount = 1): Promise<number | null> {
    const limit = await this.entitlements.quota(userId, metric); // null = unlimited
    if (limit !== null) {
      const used = await this.usedOf(userId, metric);
      if (used + amount > limit) {
        throw new ForbiddenException({
          error: 'quota_exceeded',
          metric,
          used,
          limit,
          message: `You have reached your ${metric.replace('_', ' ')} limit for this plan.`,
        });
      }
    }
    await this.record(userId, metric, amount);
    return limit === null ? null : limit - (await this.usedOf(userId, metric));
  }

  /** The full usage snapshot for the settings screen. */
  async usage(userId: string): Promise<UsageView> {
    const items: UsageItem[] = [];
    for (const def of USAGE_METRICS) {
      items.push({
        key: def.key,
        unit: def.unit,
        used: await this.usedOf(userId, def.key),
        limit: await this.entitlements.quota(userId, def.key),
      });
    }
    return { period: this.period(), items };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Used amount for a metric: live for gauges, counter value for counters. */
  private async usedOf(userId: string, metric: string): Promise<number> {
    const def = metricDef(metric);
    if (!def) return 0;
    if (def.type === 'gauge') return this.gauge(userId, metric);
    const row = await this.prisma.usageCounter.findUnique({
      where: { userId_metric_period: { userId, metric, period: this.period() } },
    });
    return row?.used ?? 0;
  }

  /** Live-computed gauges from existing data. */
  private async gauge(userId: string, metric: string): Promise<number> {
    switch (metric) {
      case 'documents':
        return this.prisma.document.count({
          where: { userId, deletedAt: null },
        });
      case 'storage': {
        // Approximated as the extracted-text size (charCount ≈ bytes for text).
        const agg = await this.prisma.document.aggregate({
          _sum: { charCount: true },
          where: { userId, deletedAt: null },
        });
        return agg._sum.charCount ?? 0;
      }
      default:
        return 0;
    }
  }
}
