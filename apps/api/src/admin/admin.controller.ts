import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
  Req,
  ParseEnumPipe,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AdminStats,
  AiUsageView,
  AnalyticsOverview,
  AuditLogView,
  IncidentView,
  ReportView,
} from '@second-brain/shared';
import { AdminRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { PrivateBetaAccessService } from '../auth/private-beta-access.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminGuard } from './admin.guard';
import { CapabilityGuard } from './capability.guard';
import { AdminStepUpGuard } from './step-up.guard';
import { RequireAdminCapabilities, type AdminIdentity } from './admin-rbac';
import type { AuditContext } from './admin-audit.service';
import { AdminService } from './admin.service';
import { AnalyticsService } from './analytics.service';
import { UserAdminService } from './users/user-admin.service';
import {
  CreateIncidentDto,
  IncidentListQueryDto,
  ResolveReportDto,
  UpdateIncidentStatusDto,
  AdminReasonDto,
  BanUserDto,
  AssignAdminRoleDto,
} from './dto/admin.dto';
import {
  AdminPaginationQueryDto,
  BetaAccessDto,
  CreateSupportNoteDto,
  LearnerProfileAccessDto,
  PlanOverrideDto,
  ProfileReviewDto,
  QuotaAdjustmentDto,
  StagingQuotaCapDto,
  UserDirectoryQueryDto,
} from './dto/user-admin.dto';
import {
  GrantPrivateBetaAccessDto,
  RevokePrivateBetaAccessDto,
} from './dto/private-beta-access.dto';

/** Platform back office (Sprint 8.5). Superadmin-only — JwtAccessGuard then
 *  AdminGuard on every route. */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly analytics: AnalyticsService,
    private readonly usersDirectory: UserAdminService,
    private readonly privateBeta: PrivateBetaAccessService,
  ) {}

  @Get('session')
  @RequireAdminCapabilities('dashboard.read')
  session(@Req() req: AdminHttpRequest) {
    return { identity: req.adminIdentity, mfaVerifiedAt: req.user?.mfaVerifiedAt?.toISOString() ?? null };
  }

  @Get('stats')
  @RequireAdminCapabilities('dashboard.read')
  stats(): Promise<AdminStats> {
    return this.admin.stats();
  }

  @Get('analytics')
  @RequireAdminCapabilities('dashboard.read')
  analyticsOverview(): Promise<AnalyticsOverview> {
    return this.analytics.overview();
  }

  @Get('users')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @RequireAdminCapabilities('users.read')
  users(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: UserDirectoryQueryDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.list(req.adminIdentity as AdminIdentity, query, this.auditContext(actor, req));
  }

  @Get('users/:id')
  @RequireAdminCapabilities('users.read')
  userDetail(@Param('id') id: string, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.detail(id, req.adminIdentity as AdminIdentity, this.auditContext(req.user as AuthenticatedUser, req));
  }

  @Get('users/:id/subscription')
  @RequireAdminCapabilities('subscriptions.read')
  userSubscription(@Param('id') id: string, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.subscription(id, req.adminIdentity as AdminIdentity);
  }

  @Get('users/:id/quotas')
  @RequireAdminCapabilities('quotas.read')
  userQuotas(@Param('id') id: string, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.quotas(id, req.adminIdentity as AdminIdentity);
  }

  @Get('users/:id/usage')
  @RequireAdminCapabilities('usage.read')
  userUsage(@Param('id') id: string, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.usage(id, req.adminIdentity as AdminIdentity);
  }

  @Get('users/:id/payments')
  @RequireAdminCapabilities('payments.read')
  userPayments(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.payments(id, req.adminIdentity as AdminIdentity, query);
  }

  @Get('users/:id/sessions')
  @RequireAdminCapabilities('security.read')
  userSessions(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.sessions(id, req.adminIdentity as AdminIdentity, query);
  }

  @Get('users/:id/security')
  @RequireAdminCapabilities('security.read')
  userSecurity(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.security(id, req.adminIdentity as AdminIdentity, query);
  }

  @Get('users/:id/audit')
  @RequireAdminCapabilities('audit.read')
  userAudit(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.auditLog(id, req.adminIdentity as AdminIdentity, query);
  }

  @Get('users/:id/activity')
  @RequireAdminCapabilities('audit.read')
  userActivity(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.activity(id, req.adminIdentity as AdminIdentity, query);
  }

  @Get('users/:id/reports')
  @RequireAdminCapabilities('bugs.read')
  userReports(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.reports(id, req.adminIdentity as AdminIdentity, query);
  }

  /** GET intentionally exposes only the standard profile summary. */
  @Get('users/:id/learner-profile')
  @RequireAdminCapabilities('learner_profile.read')
  userLearnerProfile(@Param('id') id: string, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.learnerProfile(id, req.adminIdentity as AdminIdentity, { access: 'standard' });
  }

  @Get('users/:id/learner-profile/reviews')
  @RequireAdminCapabilities('users.manage')
  userLearnerProfileReviews(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.profileReviews(id, req.adminIdentity as AdminIdentity, query);
  }

  /** Reasons never travel in a query string: proxies and browser history can log URLs. */
  @Post('users/:id/learner-profile/access')
  @RequireAdminCapabilities('learner_profile.read')
  @UseGuards(AdminStepUpGuard)
  elevatedLearnerProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LearnerProfileAccessDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.learnerProfile(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  @Post('users/:id/learner-profile/review')
  @RequireAdminCapabilities('users.manage', 'learner_profile.read')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  reviewLearnerProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ProfileReviewDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.reviewProfile(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  @Get('users/:id/support-notes')
  @RequireAdminCapabilities('users.manage')
  userSupportNotes(@Param('id') id: string, @Query() query: AdminPaginationQueryDto, @Req() req: AdminHttpRequest) {
    return this.usersDirectory.supportNotes(id, req.adminIdentity as AdminIdentity, query);
  }

  @Post('users/:id/support-notes')
  @RequireAdminCapabilities('users.manage')
  @HttpCode(HttpStatus.CREATED)
  createSupportNote(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateSupportNoteDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.createSupportNote(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  @Post('users/:id/suspend')
  @RequireAdminCapabilities('users.suspend')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminReasonDto,
    @Req() req: AdminHttpRequest,
  ): Promise<void> {
    await this.admin.suspendUser(this.auditContext(actor, req), id, true, dto.reason);
  }

  @Post('users/:id/reactivate')
  @RequireAdminCapabilities('users.suspend')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async reactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminReasonDto,
    @Req() req: AdminHttpRequest,
  ): Promise<void> {
    await this.admin.suspendUser(this.auditContext(actor, req), id, false, dto.reason);
  }

  @Post('users/:id/ban')
  @RequireAdminCapabilities('users.ban')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async ban(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: BanUserDto, @Req() req: AdminHttpRequest): Promise<void> {
    await this.admin.banUser(this.auditContext(actor, req), id, dto);
  }

  @Post('users/:id/sessions/revoke')
  @RequireAdminCapabilities('users.sessions.revoke')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSessions(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: AdminReasonDto, @Req() req: AdminHttpRequest): Promise<void> {
    await this.admin.revokeSessions(this.auditContext(actor, req), id, dto.reason);
  }

  @Post('users/:id/sessions/:sessionId/revoke')
  @RequireAdminCapabilities('users.sessions.revoke')
  @UseGuards(AdminStepUpGuard)
  revokeSession(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: AdminReasonDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.revokeSession(id, sessionId, req.adminIdentity as AdminIdentity, dto.reason, this.auditContext(actor, req));
  }

  @Post('users/:id/deletion-requests')
  @RequireAdminCapabilities('users.delete_request')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  requestDeletion(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: AdminReasonDto, @Req() req: AdminHttpRequest) {
    return this.admin.requestDeletion(this.auditContext(actor, req), id, dto.reason);
  }

  @Post('users/:id/plan-override')
  @RequireAdminCapabilities('subscriptions.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  planOverride(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PlanOverrideDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.planOverride(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  @Post('users/:id/beta-access')
  @RequireAdminCapabilities('subscriptions.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  betaAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BetaAccessDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.betaAccess(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  /** A private-beta grant is independent of the legacy plan-beta endpoint:
   * it never changes a plan, price, subscription or quota. */
  @Post('users/:id/private-beta-access')
  @RequireAdminCapabilities('security.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  grantPrivateBetaAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GrantPrivateBetaAccessDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.privateBeta.grant(id, dto, this.auditContext(actor, req));
  }

  @Post('users/:id/private-beta-access/:grantId/revoke')
  @RequireAdminCapabilities('security.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.OK)
  revokePrivateBetaAccess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('grantId') grantId: string,
    @Body() dto: RevokePrivateBetaAccessDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.privateBeta.revoke(id, grantId, dto.reason, this.auditContext(actor, req));
  }

  @Post('users/:id/quota-adjustment')
  @RequireAdminCapabilities('quotas.adjust')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  quotaAdjustment(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: QuotaAdjustmentDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.quotaAdjustment(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  @Post('users/:id/staging-quota-cap')
  @RequireAdminCapabilities('quotas.adjust')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  createStagingQuotaCap(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: StagingQuotaCapDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.createStagingQuotaCap(id, req.adminIdentity as AdminIdentity, dto, this.auditContext(actor, req));
  }

  @Post('users/:id/staging-quota-cap/:capId/revoke')
  @RequireAdminCapabilities('quotas.adjust')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.OK)
  revokeStagingQuotaCap(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Param('capId') capId: string,
    @Body() dto: AdminReasonDto,
    @Req() req: AdminHttpRequest,
  ) {
    return this.usersDirectory.revokeStagingQuotaCap(
      id,
      capId,
      req.adminIdentity as AdminIdentity,
      dto.reason,
      this.auditContext(actor, req),
    );
  }

  @Post('users/:id/roles')
  @RequireAdminCapabilities('admin.roles.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  assignRole(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: AssignAdminRoleDto, @Req() req: AdminHttpRequest) {
    return this.admin.assignRole(this.auditContext(actor, req), id, dto.role, dto.reason);
  }

  @Post('users/:id/roles/:role/revoke')
  @RequireAdminCapabilities('admin.roles.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeRole(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('role', new ParseEnumPipe(AdminRole)) role: AdminRole, @Body() dto: AdminReasonDto, @Req() req: AdminHttpRequest): Promise<void> {
    await this.admin.revokeRole(this.auditContext(actor, req), id, role, dto.reason);
  }

  @Get('ai-usage')
  @RequireAdminCapabilities('usage.read')
  aiUsage(): Promise<AiUsageView> {
    return this.admin.aiUsage();
  }

  @Get('incidents')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('incidents.read')
  incidents(@Query() query: IncidentListQueryDto) {
    return this.admin.listIncidents(query);
  }

  @Post('incidents')
  @RequireAdminCapabilities('incidents.manage')
  @UseGuards(AdminStepUpGuard)
  @HttpCode(HttpStatus.CREATED)
  createIncident(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateIncidentDto,
  ): Promise<IncidentView> {
    return this.admin.createIncident(actor.userId, dto);
  }

  @Put('incidents/:id/status')
  @RequireAdminCapabilities('incidents.manage')
  @UseGuards(AdminStepUpGuard)
  updateIncident(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
  ): Promise<IncidentView> {
    return this.admin.updateIncidentStatus(actor.userId, id, dto.status);
  }

  @Get('audit-logs')
  @RequireAdminCapabilities('audit.read')
  auditLogs(): Promise<AuditLogView[]> {
    return this.admin.listAuditLogs();
  }

  @Get('reports')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('support.read')
  reports(): Promise<ReportView[]> {
    return this.admin.listReports();
  }

  @Put('reports/:id/resolve')
  @RequireAdminCapabilities('support.manage')
  resolveReport(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ): Promise<ReportView> {
    return this.admin.resolveReport(actor.userId, id, dto.status);
  }

  private auditContext(actor: AuthenticatedUser, req: AdminHttpRequest): AuditContext {
    const role = req.adminIdentity?.roles.join(',');
    const userAgent = req.headers?.['user-agent'];
    return {
      actorId: actor.userId, actorRole: role, sessionId: actor.sessionId,
      requestId: String(req.headers?.['x-request-id'] ?? ''), ip: req.ip,
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
    };
  }
}

interface AdminHttpRequest {
  user?: AuthenticatedUser;
  adminIdentity?: AdminIdentity;
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
}
