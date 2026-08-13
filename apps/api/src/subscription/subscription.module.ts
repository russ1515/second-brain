import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { EntitlementsService } from './entitlements.service';

/** Subscription Engine (Sprint 8.1). Generic plan catalog + per-user
 *  subscriptions + entitlement resolution. Prisma is @Global; nothing else is
 *  needed. `EntitlementsService` is exported so future modules can gate features
 *  and quotas by plan. */
@Module({
  controllers: [SubscriptionController],
  providers: [PlanService, SubscriptionService, EntitlementsService],
  exports: [PlanService, SubscriptionService, EntitlementsService],
})
export class SubscriptionModule {}
