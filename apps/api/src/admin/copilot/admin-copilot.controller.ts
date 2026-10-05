import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuditContext } from '../admin-audit.service';
import { AdminGuard } from '../admin.guard';
import { type AdminIdentity, RequireAdminCapabilities } from '../admin-rbac';
import { CapabilityGuard } from '../capability.guard';
import { AdminCopilotQueryDto } from './admin-copilot.dto';
import { AdminCopilotService } from './admin-copilot.service';

type CopilotRequest = {
  adminIdentity?: AdminIdentity;
  user?: { sessionId?: string };
  id?: string;
  ip?: string;
  headers?: { ['user-agent']?: string | string[] | undefined };
};

/**
 * Internal administration assistant. This controller deliberately has no
 * mutation route: it can only obtain bounded evidence through the server-side
 * allowlist in AdminCopilotService.
 */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@RequireAdminCapabilities('dashboard.read')
@Controller('admin/copilot')
export class AdminCopilotController {
  constructor(private readonly copilot: AdminCopilotService) {}

  @Get('capabilities')
  @Header('Cache-Control', 'no-store')
  capabilities(@Req() req: CopilotRequest) {
    return this.copilot.capabilities(req.adminIdentity as AdminIdentity);
  }

  @Post('query')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  query(@Body() body: AdminCopilotQueryDto, @Req() req: CopilotRequest) {
    return this.copilot.query(body, req.adminIdentity as AdminIdentity, this.auditContext(req));
  }

  private auditContext(req: CopilotRequest): AuditContext {
    const identity = req.adminIdentity as AdminIdentity;
    const userAgent = req.headers?.['user-agent'];
    return {
      actorId: identity.userId,
      actorRole: identity.roles.join(','),
      requestId: req.id,
      sessionId: req.user?.sessionId,
      ip: req.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}
