import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { AdminGuard } from '../admin.guard';
import { CapabilityGuard } from '../capability.guard';
import { RequireAdminCapabilities } from '../admin-rbac';
import { SystemHealthService } from './system-health.service';

/**
 * Read-only, internal infrastructure view. Operational state is deliberately
 * observed here; this controller has no action endpoints.
 */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@RequireAdminCapabilities('infrastructure.read')
@Controller('admin/infrastructure')
export class InfrastructureController {
  constructor(private readonly systemHealth: SystemHealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  overview(@Query('range') range?: string | string[]) {
    return this.systemHealth.overview(range);
  }
}
