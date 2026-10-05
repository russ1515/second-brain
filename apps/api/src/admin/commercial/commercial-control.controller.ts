import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuditContext } from '../admin-audit.service';
import { AdminGuard } from '../admin.guard';
import type { AdminIdentity } from '../admin-rbac';
import { RequireAdminCapabilities } from '../admin-rbac';
import { CapabilityGuard } from '../capability.guard';
import {
  CommercialAuditQueryDto,
  CommercialSubscriptionQueryDto,
  CommercialUsageQueryDto,
  UpdatePlanPricingDto,
} from '../dto/commercial-control.dto';
import { AdminStepUpGuard } from '../step-up.guard';
import { CommercialControlService } from './commercial-control.service';

type CommercialRequest = {
  adminIdentity?: AdminIdentity;
  user?: { sessionId?: string };
  id?: string;
  ip?: string;
  headers?: { ['user-agent']?: string | string[] | undefined };
};

/**
 * Commercial state is intentionally exposed as a separate, narrowly scoped
 * control center. All mutations stay server-validated, RBAC-gated, step-up
 * protected and atomically audited.
 */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@Controller('admin/commercial')
export class CommercialControlController {
  constructor(private readonly commercial: CommercialControlService) {}

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('plans.read')
  overview() {
    return this.commercial.overview();
  }

  @Get('plans')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('plans.read')
  plans() {
    return this.commercial.plans();
  }

  @Put('plans/:slug/pricing')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminStepUpGuard)
  @RequireAdminCapabilities('plans.manage', 'provider_pricing.manage')
  updatePricing(
    @Param('slug') slug: string,
    @Body() body: UpdatePlanPricingDto,
    @Req() req: CommercialRequest,
  ) {
    return this.commercial.updatePricing(slug, body, this.auditContext(req));
  }

  @Get('subscriptions')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('subscriptions.read')
  subscriptions(@Query() query: CommercialSubscriptionQueryDto, @Req() req: CommercialRequest) {
    return this.commercial.subscriptions(req.adminIdentity as AdminIdentity, query);
  }

  @Get('payments')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('payments.read')
  payments(@Query() query: CommercialSubscriptionQueryDto, @Req() req: CommercialRequest) {
    return this.commercial.payments(req.adminIdentity as AdminIdentity, query);
  }

  @Get('usage')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('usage.read')
  usage(@Query() query: CommercialUsageQueryDto, @Req() req: CommercialRequest) {
    return this.commercial.usage(req.adminIdentity as AdminIdentity, query);
  }

  @Get('features')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('feature_flags.read')
  features() {
    return this.commercial.features();
  }

  @Get('settings')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('settings.read')
  settings() {
    return this.commercial.settings();
  }

  @Get('audit')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('audit.read')
  audit(@Query() query: CommercialAuditQueryDto) {
    return this.commercial.auditLog(query);
  }

  private auditContext(req: CommercialRequest): AuditContext {
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
