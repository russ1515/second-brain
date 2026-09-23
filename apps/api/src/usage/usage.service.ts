import {
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type { UsageItem, UsageView } from '@second-brain/shared';
import { createQuotaError } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../subscription/entitlements.service';
import { USAGE_METRICS, metricDef } from './metrics';
import { QuotaService } from './quota.service';
import { RequestContextService } from '../common/request-context.service';

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
    @Optional() private readonly quotas?: QuotaService,
    @Optional() private readonly requestContext?: RequestContextService,
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
    const resource = metric === 'ai_questions' ? 'AI_TEXT' : metric === 'voice_minutes' ? 'VOICE_SECONDS' : null;
    const current = this.requestContext?.current();
    if (resource && this.quotas && current?.requestId) {
      const reservation = await this.quotas.reserve({
        userId, resource, feature: metric,
        units: metric === 'voice_minutes' ? amount * 60 : amount,
        idempotencyKey: `${current.requestId}:legacy:${metric}`,
      });
      this.requestContext?.rememberReservation(resource, reservation.id);
      return null;
    }
    const limit = await this.entitlements.quota(userId, metric); // null = unlimited
    if (limit !== null) {
      const used = await this.usedOf(userId, metric);
      if (used + amount > limit) {
        const resetAt = this.resetAt(metric);
        const retryAfter = resetAt
          ? Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1_000))
          : null;
        throw new ForbiddenException(
          createQuotaError({
            quotaType: metric,
            used,
            limit,
            resetAt: resetAt?.toISOString() ?? null,
            retryAfter,
            feature: metric,
            availableFeatures: [
              'library.read',
              'documents.view',
              'profile',
              'subscription',
              'usage',
            ],
            managementDestination: '/usage',
            // Commercial upgrade paths are backend data, not a Lot 0 constant.
            upgradePossible: null,
          }),
        );
      }
    }
    await this.record(userId, metric, amount);
    return limit === null ? null : limit - (await this.usedOf(userId, metric));
  }

  /** Release a previously reserved counter after an operation failed before it
   * produced a usable result. Best-effort callers may safely invoke it once. */
  async release(userId: string, metric: string, amount = 1): Promise<void> {
    const resource = metric === 'ai_questions' ? 'AI_TEXT' : metric === 'voice_minutes' ? 'VOICE_SECONDS' : null;
    const reservationId = resource ? this.requestContext?.reservationFor(resource) : undefined;
    if (reservationId && this.quotas) {
      await this.quotas.release(reservationId, 'caller_reported_failure');
      return;
    }
    const def = metricDef(metric);
    if (!def || def.type !== 'counter' || amount <= 0) return;
    const period = this.period();
    await this.prisma.usageCounter.updateMany({
      where: { userId, metric, period, used: { gte: amount } },
      data: { used: { decrement: amount } },
    });
  }

  /** The full usage snapshot for the settings screen. */
  async usage(userId: string): Promise<UsageView> {
    const entitlements = await this.entitlements.forUser(userId);
    const items: UsageItem[] = await Promise.all(USAGE_METRICS.map(async (def) => {
      const configuredLimit = entitlements.quotas[def.key];
      return {
        key: def.key,
        unit: def.unit,
        used: await this.usedOf(userId, def.key),
        limit: configuredLimit === undefined || configuredLimit < 0 ? null : configuredLimit,
        resetAt: this.resetAt(def.key)?.toISOString() ?? null,
      };
    }));
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

  /** Counter quotas reset monthly; live gauges do not have a reset timestamp. */
  private resetAt(metric: string): Date | null {
    if (metricDef(metric)?.type !== 'counter') return null;
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
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
