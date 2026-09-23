import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminAuditService, type AuditContext } from '../admin/admin-audit.service';
import { AdminGuard } from '../admin/admin.guard';
import { CapabilityGuard } from '../admin/capability.guard';
import { RequireAdminCapabilities, type AdminIdentity } from '../admin/admin-rbac';
import { AdminStepUpGuard } from '../admin/step-up.guard';
import {
  AssignBugDto,
  BugListQueryDto,
  CreateIncidentControlDto,
  CreateSupportCaseDto,
  MarkDuplicateDto,
  RunDiagnosticDto,
  SupportCaseListQueryDto,
  UpdateBugStatusDto,
  UpdateIncidentStatusControlDto,
  UpdateSupportCaseDto,
} from './dto/diagnostics.dto';
import { BugCenterService } from './bug-center.service';

type AdminRequest = {
  user?: AuthenticatedUser;
  adminIdentity?: AdminIdentity;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
};

function page(value: string | undefined, fallback: number, maximum = 100): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : fallback;
}

@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@Controller('admin/bugs')
export class DiagnosticsController {
  constructor(private readonly bugs: BugCenterService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('bugs.read')
  list(@Query() query: BugListQueryDto) {
    return this.bugs.list(query);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('bugs.read')
  overview() {
    return this.bugs.overview();
  }

  @Get(':id/events/sensitive')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('error_events.sensitive')
  sensitiveEvents(@Param('id') id: string, @Query('page') current?: string, @Query('pageSize') size?: string) {
    return this.bugs.events(id, page(current, 1), page(size, 50), true);
  }

  @Get(':id/events')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('error_events.read')
  events(@Param('id') id: string, @Query('page') current?: string, @Query('pageSize') size?: string) {
    return this.bugs.events(id, page(current, 1), page(size, 50), false);
  }

  @Get(':id/users')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('bugs.read')
  users(@Param('id') id: string, @Query('page') current?: string, @Query('pageSize') size?: string) {
    return this.bugs.affectedUsers(id, page(current, 1), page(size, 50));
  }

  @Get(':id/diagnostics')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('diagnostics.read')
  diagnostics(@Param('id') id: string) {
    return this.bugs.diagnosticsFor(id);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('bugs.read')
  detail(@Param('id') id: string) {
    return this.bugs.detail(id);
  }

  @Post(':id/triage')
  @RequireAdminCapabilities('bugs.manage')
  @UseGuards(AdminStepUpGuard)
  triage(@Param('id') id: string, @Body() dto: RunDiagnosticDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.triage(id, dto.reason, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  @Post(':id/status')
  @RequireAdminCapabilities('bugs.manage')
  @UseGuards(AdminStepUpGuard)
  status(@Param('id') id: string, @Body() dto: UpdateBugStatusDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.setStatus(id, dto, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  @Post(':id/assign')
  @RequireAdminCapabilities('bugs.manage')
  @UseGuards(AdminStepUpGuard)
  assign(@Param('id') id: string, @Body() dto: AssignBugDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.assign(id, dto, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  @Post(':id/duplicate')
  @RequireAdminCapabilities('bugs.manage')
  @UseGuards(AdminStepUpGuard)
  duplicate(@Param('id') id: string, @Body() dto: MarkDuplicateDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.markDuplicate(id, dto, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  @Post(':id/diagnose')
  @RequireAdminCapabilities('bugs.diagnose', 'diagnostics.run')
  @UseGuards(AdminStepUpGuard)
  diagnose(@Param('id') id: string, @Body() dto: RunDiagnosticDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.diagnose(id, req.adminIdentity as AdminIdentity, this.auditContext(actor, req), dto.kind ?? 'rule_based', dto.reason);
  }

  private auditContext(actor: AuthenticatedUser, req: AdminRequest): AuditContext {
    const userAgent = req.headers?.['user-agent'];
    return {
      actorId: actor.userId,
      actorRole: req.adminIdentity?.roles.join(','),
      sessionId: actor.sessionId,
      requestId: typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
      ip: req.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}

@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@Controller('admin/support')
export class SupportCenterController {
  constructor(private readonly bugs: BugCenterService) {}

  @Get('cases')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('support.read')
  list(@Query() query: SupportCaseListQueryDto, @Req() req: AdminRequest) {
    return this.bugs.listSupport(query, req.adminIdentity?.userId);
  }

  @Post('cases')
  @RequireAdminCapabilities('support.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSupportCaseDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.createSupport(dto, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  @Post('cases/:id/status')
  @RequireAdminCapabilities('support.manage')
  @UseGuards(AdminStepUpGuard)
  status(@Param('id') id: string, @Body() dto: UpdateSupportCaseDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.updateSupport(id, dto, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  @Post('cases/:id/assign')
  @RequireAdminCapabilities('support.manage')
  @UseGuards(AdminStepUpGuard)
  assign(@Param('id') id: string, @Body() dto: UpdateSupportCaseDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    return this.bugs.updateSupport(id, dto, req.adminIdentity as AdminIdentity, this.auditContext(actor, req));
  }

  private auditContext(actor: AuthenticatedUser, req: AdminRequest): AuditContext {
    const userAgent = req.headers?.['user-agent'];
    return { actorId: actor.userId, actorRole: req.adminIdentity?.roles.join(','), sessionId: actor.sessionId, requestId: typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined, ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent };
  }
}

/** Additional incident routes leave the existing historic list/create paths compatible. */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@Controller('admin/incidents')
export class IncidentControlController {
  constructor(private readonly bugs: BugCenterService) {}

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('incidents.read')
  detail(@Param('id') id: string) {
    return this.bugs.incidentDetail(id);
  }

  @Post(':id/status')
  @RequireAdminCapabilities('incidents.manage')
  @UseGuards(AdminStepUpGuard)
  status(@Param('id') id: string, @Body() dto: UpdateIncidentStatusControlDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    const userAgent = req.headers?.['user-agent'];
    return this.bugs.updateIncidentStatus(id, dto, req.adminIdentity as AdminIdentity, {
      actorId: actor.userId, actorRole: req.adminIdentity?.roles.join(','), sessionId: actor.sessionId,
      requestId: typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
      ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    });
  }

  @Post('control')
  @RequireAdminCapabilities('incidents.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateIncidentControlDto, @CurrentUser() actor: AuthenticatedUser, @Req() req: AdminRequest) {
    const userAgent = req.headers?.['user-agent'];
    return this.bugs.createIncident(dto, req.adminIdentity as AdminIdentity, {
      actorId: actor.userId, actorRole: req.adminIdentity?.roles.join(','), sessionId: actor.sessionId,
      requestId: typeof req.headers?.['x-request-id'] === 'string' ? req.headers['x-request-id'] : undefined,
      ip: req.ip, userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    });
  }
}
