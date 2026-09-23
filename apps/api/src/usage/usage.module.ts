import { Module } from '@nestjs/common';
import { SubscriptionModule } from '../subscription/subscription.module';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';
import { QuotaService } from './quota.service';
import { ProviderMeteringService } from './provider-metering.service';
import { SafeTelemetryModule } from '../diagnostics/safe-telemetry.module';

/** Usage & Quotas engine (Sprint 8.3). Reuses the Subscription engine (8.1) for
 *  per-plan limits. `UsageService` is exported so features can `record`/`consume`
 *  usage at the point of use (e.g. the tutor counts AI questions). */
@Module({
  imports: [SubscriptionModule, SafeTelemetryModule],
  controllers: [UsageController],
  providers: [UsageService, QuotaService, ProviderMeteringService],
  exports: [UsageService, QuotaService, ProviderMeteringService],
})
export class UsageModule {}
