import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  AdminStats,
  AdminUsersResponse,
  AiUsageView,
  AnalyticsOverview,
  AuditLogView,
  IncidentView,
  ReportView,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import {
  CreateIncidentDto,
  ResolveReportDto,
  SetUserPlanDto,
  UpdateIncidentStatusDto,
} from './dto/admin.dto';

/** Platform back office (Sprint 8.5). Superadmin-only — JwtAccessGuard then
 *  AdminGuard on every route. */
@UseGuards(JwtAccessGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.admin.stats();
  }

  @Get('analytics')
  analyticsOverview(): Promise<AnalyticsOverview> {
    return this.analytics.overview();
  }

  @Get('users')
  users(): Promise<AdminUsersResponse> {
    return this.admin.listUsers();
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.admin.suspendUser(actor.userId, id, true);
  }

  @Post('users/:id/reactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.admin.suspendUser(actor.userId, id, false);
  }

  @Put('users/:id/plan')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setPlan(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetUserPlanDto,
  ): Promise<void> {
    await this.admin.setUserPlan(actor.userId, id, dto.slug);
  }

  @Get('ai-usage')
  aiUsage(): Promise<AiUsageView> {
    return this.admin.aiUsage();
  }

  @Get('incidents')
  incidents(): Promise<IncidentView[]> {
    return this.admin.listIncidents();
  }

  @Post('incidents')
  @HttpCode(HttpStatus.CREATED)
  createIncident(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateIncidentDto,
  ): Promise<IncidentView> {
    return this.admin.createIncident(actor.userId, dto);
  }

  @Put('incidents/:id/status')
  updateIncident(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ): Promise<IncidentView> {
    return this.admin.updateIncidentStatus(actor.userId, id, dto.status);
  }

  @Get('audit-logs')
  auditLogs(): Promise<AuditLogView[]> {
    return this.admin.listAuditLogs();
  }

  @Get('reports')
  reports(): Promise<ReportView[]> {
    return this.admin.listReports();
  }

  @Put('reports/:id/resolve')
  resolveReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ): Promise<ReportView> {
    return this.admin.resolveReport(actor.userId, id, dto.status);
  }
}
