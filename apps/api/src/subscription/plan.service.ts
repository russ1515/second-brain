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

  /** Create missing catalog rows only. Existing commercial configuration is
   *  immutable at boot and can only change through versioned admin workflows. */
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
          priceMonthly: seed.priceMonthly,
          priceYearly: seed.priceYearly,
          currency: seed.currency,
          publicV1: seed.publicV1,
          fallbackRatio: seed.fallbackRatio,
          versions: {
            create: {
              version: 1,
              priceMonthly: seed.priceMonthly,
              priceYearly: seed.priceYearly,
              currency: seed.currency,
              quotas: seed.quotas,
              features: {},
              fallbackRatio: seed.fallbackRatio,
              reason: 'Initial catalog seed',
            },
          },
        },
        update: {},
      });
    }
    this.logger.log('Plan catalog initialization completed.');
  }

  async list(publicOnly = true): Promise<PlanView[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true, ...(publicOnly ? { publicV1: true } : {}) },
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
