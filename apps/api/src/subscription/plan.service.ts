import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Plan } from '@prisma/client';
import type {
  FeatureMap,
  PlanAudience,
  PlanSlug,
  PlanView,
  QuotaMap,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_SEED } from './plan.constants';

/** Owns the plan catalog: seeds the six plans on boot (idempotent) and reads
 *  them. Plans are data, so quotas/features/prices can be edited later without a
 *  migration. */
@Injectable()
export class PlanService implements OnModuleInit {
  private readonly logger = new Logger(PlanService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Seed/refresh the catalog. Upserts by slug so it is safe to run every boot:
   *  new plans are created, existing names/tiers are corrected, and quotas or
   *  features set elsewhere are left untouched (only created on first insert). */
  async onModuleInit(): Promise<void> {
    for (const seed of PLAN_SEED) {
      await this.prisma.plan.upsert({
        where: { slug: seed.slug },
        create: {
          slug: seed.slug,
          name: seed.name,
          tier: seed.tier,
          audience: seed.audience,
          quotas: seed.quotas,
        },
        // Quotas are example limits (Sprint 8.3): refreshed each boot for now.
        // When admin editing of quotas exists, drop `quotas` from this update.
        update: {
          name: seed.name,
          tier: seed.tier,
          audience: seed.audience,
          quotas: seed.quotas,
        },
      });
    }
    this.logger.log(`Plan catalog seeded (${PLAN_SEED.length} plans).`);
  }

  async list(): Promise<PlanView[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { tier: 'asc' },
    });
    return plans.map((p) => this.toView(p));
  }

  /** Load a plan by slug, or null. */
  bySlug(slug: PlanSlug): Promise<Plan | null> {
    return this.prisma.plan.findUnique({ where: { slug } });
  }

  toView(plan: Plan): PlanView {
    return {
      id: plan.id,
      slug: plan.slug as PlanSlug,
      name: plan.name,
      tier: plan.tier,
      audience: plan.audience as PlanAudience,
      quotas: (plan.quotas ?? {}) as QuotaMap,
      features: (plan.features ?? {}) as FeatureMap,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      currency: plan.currency,
      isActive: plan.isActive,
    };
  }
}
