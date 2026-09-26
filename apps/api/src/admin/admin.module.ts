import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UsageModule } from '../usage/usage.module';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { ReportsController } from './reports.controller';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { AdminGuard } from './admin.guard';
import { AdminIdentityService } from './admin-identity.service';
import { CapabilityGuard } from './capability.guard';
import { AdminStepUpGuard } from './step-up.guard';
import { AdminAuditService } from './admin-audit.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { UserAdminService } from './users/user-admin.service';
import { CostCenterController } from './costs/cost-center.controller';
import { CostCenterService } from './costs/cost-center.service';
import { SafeTelemetryModule } from '../diagnostics/safe-telemetry.module';

/** Platform back office (Sprint 8.5). Superadmin dashboard across all tenants +
 *  the user-facing report endpoint. Reuses the Subscription engine to change a
 *  user's plan. Prisma is @Global. */
@Module({
  imports: [AuthModule, SubscriptionModule, UsageModule, SafeTelemetryModule],
  controllers: [AdminController, ReportsController, DashboardController, CostCenterController],
  providers: [AdminService, AnalyticsService, DashboardService, UserAdminService, CostCenterService, AdminGuard, AdminIdentityService, CapabilityGuard, AdminStepUpGuard, AdminAuditService],
  exports: [AdminService, AdminAuditService, AdminIdentityService, AdminGuard, CapabilityGuard, AdminStepUpGuard],
})
export class AdminModule {}
