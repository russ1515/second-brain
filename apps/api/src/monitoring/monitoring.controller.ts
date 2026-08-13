import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { MonitoringSnapshot } from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { AdminGuard } from '../admin/admin.guard';
import { MetricsService } from './metrics.service';

/** Prometheus scrape endpoint (Sprint 10.4). Public + un-throttled, per the
 *  Prometheus convention — it exposes aggregate operational counters only, no
 *  user data. Point a Prometheus server (and Grafana) at `GET /api/metrics`. */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @SkipThrottle()
  @Header('content-type', 'text/plain; version=0.0.4')
  scrape(): string {
    return this.metrics.prometheus();
  }
}

/** Internal Monitoring Dashboard data (Sprint 10.4). Admin-only. */
@UseGuards(JwtAccessGuard, AdminGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  snapshot(): MonitoringSnapshot {
    return this.metrics.snapshot();
  }
}
