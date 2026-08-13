import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminController } from './admin.controller';
import { ReportsController } from './reports.controller';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { AdminGuard } from './admin.guard';

/** Platform back office (Sprint 8.5). Superadmin dashboard across all tenants +
 *  the user-facing report endpoint. Reuses the Subscription engine to change a
 *  user's plan. Prisma is @Global. */
@Module({
  imports: [SubscriptionModule],
  controllers: [AdminController, ReportsController],
  providers: [AdminService, AnalyticsService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
