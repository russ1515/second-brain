import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { AdminGuard } from '../admin.guard';
import { CapabilityGuard } from '../capability.guard';
import { RequireAdminCapabilities, type AdminIdentity } from '../admin-rbac';
import { DashboardService } from './dashboard.service';

type DashboardRequest = { adminIdentity?: AdminIdentity };

/** Read-only aggregate Control Center API; no browser-side data fan-out. */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@RequireAdminCapabilities('dashboard.read')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  index(@Req() req: DashboardRequest, @Query('range') range?: string | string[]) {
    return this.dashboard.dashboard(this.identity(req), range);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  overview(@Req() req: DashboardRequest, @Query('range') range?: string | string[]) {
    return this.dashboard.namedSection('overview', this.identity(req), range);
  }

  @Get('health')
  @Header('Cache-Control', 'no-store')
  health(@Req() req: DashboardRequest, @Query('range') range?: string | string[]) {
    return this.dashboard.namedSection('health', this.identity(req), range);
  }

  @Get('alerts')
  @Header('Cache-Control', 'no-store')
  alerts(@Req() req: DashboardRequest, @Query('range') range?: string | string[]) {
    return this.dashboard.namedSection('alerts', this.identity(req), range);
  }

  @Get('activity')
  @Header('Cache-Control', 'no-store')
  activity(@Req() req: DashboardRequest, @Query('range') range?: string | string[]) {
    return this.dashboard.namedSection('activity', this.identity(req), range);
  }

  private identity(req: DashboardRequest): AdminIdentity {
    // AdminGuard has already resolved the persistent role assignment.
    return req.adminIdentity as AdminIdentity;
  }
}
