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
    const plan = await this.prisma.plan.findUnique({ where: { id: sub.planId } });
    return {
      planSlug: sub.plan.slug as PlanSlug,
      status: sub.status as SubscriptionStatus,
      quotas: ((plan?.quotas ?? {}) as Record<string, number>) ?? {},
      features: ((plan?.features ?? {}) as Record<string, boolean>) ?? {},
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
