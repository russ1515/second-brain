import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AdminModule } from '../admin/admin.module';
import { MetricsService } from './metrics.service';
import { MonitoringInterceptor } from './monitoring.interceptor';
import { MetricsController, MonitoringController } from './monitoring.controller';

/**
 * Monitoring & Observability (Sprint 10.4). @Global so MetricsService can be
 * injected anywhere (e.g. LlmService instruments AI calls). Registers the HTTP
 * metrics interceptor app-wide, the Prometheus `/metrics` scrape endpoint and
 * the admin monitoring snapshot.
 */
@Global()
@Module({
  imports: [AdminModule],
  controllers: [MetricsController, MonitoringController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MonitoringInterceptor },
  ],
  exports: [MetricsService],
})
export class MonitoringModule {}
