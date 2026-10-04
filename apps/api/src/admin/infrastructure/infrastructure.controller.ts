import { Controller, Get, Header, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import { AdminAuditService, type AuditContext } from '../admin-audit.service';
import { AdminGuard } from '../admin.guard';
import { CapabilityGuard } from '../capability.guard';
import { RequireAdminCapabilities, type AdminIdentity } from '../admin-rbac';
import { SystemHealthService } from './system-health.service';

type InfrastructureRequest = {
  user?: { userId: string; sessionId?: string };
  adminIdentity?: AdminIdentity;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

/**
 * Read-only, internal infrastructure view. Operational state is deliberately
 * observed here; this controller has no action endpoints.
 */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@RequireAdminCapabilities('infrastructure.read')
@Controller('admin/infrastructure')
export class InfrastructureController {
  constructor(
    private readonly systemHealth: SystemHealthService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async overview(@Query('range') range?: string | string[], @Req() req?: InfrastructureRequest) {
    const overview = await this.systemHealth.overview(range);
    await this.audit.record(this.auditContext(req), {
      action: 'infrastructure.overview.read',
      targetType: 'Infrastructure',
      targetId: 'system-health',
      metadata: {
        range: overview.range.key,
        overallStatus: overview.overall.status,
        dataStatus: overview.overall.dataStatus,
      },
    });
    return overview;
  }

  private auditContext(req?: InfrastructureRequest): AuditContext {
    const identity = req?.adminIdentity;
    const userAgent = req?.headers?.['user-agent'];
    return {
      actorId: identity?.userId ?? req?.user?.userId,
      actorRole: identity?.roles.join(','),
      sessionId: req?.user?.sessionId,
      requestId: typeof req?.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
      ip: req?.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
