import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Subscription } from '@prisma/client';
import type {
  PlanSlug,
  SubscriptionStatus,
  SubscriptionView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PlanService } from './plan.service';
import { DEFAULT_PLAN_SLUG } from './plan.constants';

type SubscriptionWithPlan = Subscription & { plan: { slug: string; name: string } };

/** A subscriber's link to a plan. Every user has exactly one subscription; it is
 *  lazily provisioned on the Free plan the first time it is read, so no auth or
 *  registration code needs to change. Changing plans here is a plain state change
 *  — payment authorization is added by the Payments task, not this one. */
@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlanService,
  ) {}

  /** The user's subscription, provisioning a Free one if none exists yet. */
  async resolveForUser(userId: string): Promise<SubscriptionWithPlan> {
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: { select: { slug: true, name: true } } },
    });
    if (existing) return existing;

    const free = await this.plans.bySlug(DEFAULT_PLAN_SLUG);
    if (!free) {
      // The catalog seeds on boot; this only fires if seeding hasn't run.
      throw new NotFoundException('Plan catalog is not initialised yet.');
    }
    // Several dashboard endpoints resolve entitlements in parallel for a new
    // account. An upsert makes first-use provisioning atomic instead of racing
    // two create() calls against the unique userId constraint.
    return this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, planId: free.id, status: 'free', planVersion: free.configurationVersion },
      update: {},
      include: { plan: { select: { slug: true, name: true } } },
    });
  }

  /** The direct client route is only allowed to return to Free. Paid plans are
   *  activated exclusively by BillingService after a verified provider event. */
  async setPlan(userId: string, slug: PlanSlug): Promise<SubscriptionWithPlan> {
    if (slug !== DEFAULT_PLAN_SLUG) {
      throw new ForbiddenException(
        'Paid plans can only be activated through verified billing checkout.',
      );
    }
    const plan = await this.plans.bySlug(slug);
    if (!plan || !plan.isActive) {
      throw new NotFoundException(`Unknown plan "${slug}".`);
    }
    await this.resolveForUser(userId); // ensure a row exists
    return this.prisma.subscription.update({
      where: { userId },
      data: {
        planId: plan.id,
        status: 'free',
        planVersion: plan.configurationVersion,
        cancelAtPeriodEnd: false,
        // A paid entitlement is never replaced mid-cycle by a fresh Free cycle.
        // The billing workflow schedules paid cancellation at period end.
        provider: null,
        providerSubscriptionId: null,
      },
      include: { plan: { select: { slug: true, name: true } } },
    });
  }

  toView(sub: SubscriptionWithPlan): SubscriptionView {
    return {
      id: sub.id,
      planSlug: sub.plan.slug as PlanSlug,
      planName: sub.plan.name,
      status: sub.status as SubscriptionStatus,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    };
  }
}
