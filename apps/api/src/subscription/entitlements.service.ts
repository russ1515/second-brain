import { Injectable } from '@nestjs/common';
import type {
  EntitlementsView,
  PlanSlug,
  SubscriptionStatus,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from './subscription.service';

/**
 * The single place the rest of the app asks "what is this user allowed to do?".
 *
 * It resolves the subscriber's effective quotas and feature flags from their
 * plan. The maps are empty until per-plan limits/benefits are defined, so today
 * every `hasFeature` is false and every `quota` is unlimited — but callers can
 * already be written against this API, and gating turns on the moment a plan's
 * quotas/features are populated. No business rule is hard-coded here.
 */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async forUser(userId: string): Promise<EntitlementsView> {
    const sub = await this.subscriptions.resolveForUser(userId);
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { accountStatus: true } });
    const paidStillEntitled =
      sub.plan.slug !== 'free' &&
      (sub.status === 'active' || sub.status === 'trialing' ||
        (sub.status === 'canceled' && !!sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()));
    const basePlan = paidStillEntitled || sub.plan.slug === 'free'
      ? await this.prisma.plan.findUnique({ where: { id: sub.planId } })
      : await this.prisma.plan.findUnique({ where: { slug: 'free' } });
    const overrides = await this.prisma.entitlementOverride.findMany({
      where: { userId, revokedAt: null, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
      orderBy: { startsAt: 'desc' },
    });
    // An admin plan override is an entitlement source, not a paid
    // Subscription: it never writes provider fields or invents a payment.  The
    // date predicate above makes beta/exception expiry automatic.
    const planOverride = overrides.find((override) =>
      override.kind === 'plan' &&
      typeof override.value === 'string' &&
      (override.value === 'pro' || override.value === 'pro_max'),
    );
    const plan = planOverride
      ? await this.prisma.plan.findUnique({ where: { slug: planOverride.value as 'pro' | 'pro_max' } })
      : basePlan;
    const quotas = { ...((plan?.quotas ?? {}) as Record<string, number>) };
    const features = { ...((plan?.features ?? {}) as Record<string, boolean>) };
    for (const override of overrides) {
      if (override.kind === 'quota' && typeof override.value === 'number') quotas[override.key] = override.value;
      if (override.kind === 'feature' && typeof override.value === 'boolean') features[override.key] = override.value;
    }
    if (account.accountStatus !== 'active') {
      for (const key of Object.keys(features)) features[key] = false;
      for (const key of Object.keys(quotas)) quotas[key] = 0;
    }
    return {
      planSlug: (plan?.slug ?? 'free') as PlanSlug,
      status: sub.status as SubscriptionStatus,
      quotas,
      features,
    };
  }

  /** Whether a feature flag is enabled on the user's plan (default false). */
  async hasFeature(userId: string, key: string): Promise<boolean> {
    const { features } = await this.forUser(userId);
    return features[key] === true;
  }

  /** The numeric quota for a key, or null when unlimited / not configured. */
  async quota(userId: string, key: string): Promise<number | null> {
    const { quotas } = await this.forUser(userId);
    const value = quotas[key];
    if (value === undefined || value < 0) return null; // unlimited / unset
    return value;
  }
}
