import { Body, Controller, Get, Header, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuditContext } from '../admin-audit.service';
import { AdminGuard } from '../admin.guard';
import { CapabilityGuard } from '../capability.guard';
import { RequireAdminCapabilities, type AdminIdentity } from '../admin-rbac';
import { AdminStepUpGuard } from '../step-up.guard';
import { CostCenterService, type CreateBudgetInput, type CreatePricingInput } from './cost-center.service';

type CostRequest = {
  adminIdentity?: AdminIdentity;
  user?: { sessionId?: string };
  id?: string;
  ip?: string;
  headers?: { ['user-agent']?: string | string[] | undefined };
};

/** Admin-only financial telemetry. These routes observe data; they never route,
 * price, quota, or alter a learner automatically. */
@UseGuards(JwtAccessGuard, AdminGuard, CapabilityGuard)
@RequireAdminCapabilities('costs.read')
@Controller('admin/costs')
export class CostCenterController {
  constructor(private readonly costs: CostCenterService) {}

  @Get('overview') @Header('Cache-Control', 'no-store')
  overview(@Query() query: Record<string, unknown>) { return this.costs.overview(query); }

  @Get('plans') @Header('Cache-Control', 'no-store')
  plans(@Query() query: Record<string, unknown>) { return this.costs.plans(query); }

  @Get('features') @Header('Cache-Control', 'no-store')
  features(@Query() query: Record<string, unknown>) { return this.costs.features(query); }

  @Get('providers') @Header('Cache-Control', 'no-store')
  providers(@Query() query: Record<string, unknown>) { return this.costs.providers(query); }

  @Get('models') @Header('Cache-Control', 'no-store')
  models(@Query() query: Record<string, unknown>) { return this.costs.models(query); }

  @Get('users') @Header('Cache-Control', 'no-store')
  users(@Query() query: Record<string, unknown>) { return this.costs.users(query); }

  @Get('voice') @Header('Cache-Control', 'no-store')
  voice(@Query() query: Record<string, unknown>) { return this.costs.voice(query); }

  @Get('documents') @Header('Cache-Control', 'no-store')
  documents(@Query() query: Record<string, unknown>) { return this.costs.documents(query); }

  @Get('research') @Header('Cache-Control', 'no-store')
  research(@Query() query: Record<string, unknown>) { return this.costs.research(query); }

  @Get('languages') @Header('Cache-Control', 'no-store')
  languages(@Query() query: Record<string, unknown>) { return this.costs.languages(query); }

  @Get('anomalies') @Header('Cache-Control', 'no-store')
  anomalies(@Query() query: Record<string, unknown>) { return this.costs.anomalies(query); }

  @Get('instrumentation') @Header('Cache-Control', 'no-store')
  instrumentation(@Query() query: Record<string, unknown>) { return this.costs.instrumentation(query); }

  @Get('pricing')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('costs.read', 'provider_pricing.read')
  pricing(@Query() query: Record<string, unknown>) { return this.costs.pricing(query); }

  @Post('pricing')
  @UseGuards(AdminStepUpGuard)
  @RequireAdminCapabilities('costs.read', 'provider_pricing.manage')
  createPricing(@Req() req: CostRequest, @Body() body: CreatePricingInput) {
    return this.costs.createPricing(body, this.auditContext(req));
  }

  @Get('budgets')
  @Header('Cache-Control', 'no-store')
  @RequireAdminCapabilities('costs.read', 'budgets.read')
  budgets(@Query() query: Record<string, unknown>) { return this.costs.budgets(query); }

  @Post('budgets')
  @UseGuards(AdminStepUpGuard)
  @RequireAdminCapabilities('costs.read', 'budgets.manage')
  createBudget(@Req() req: CostRequest, @Body() body: CreateBudgetInput) {
    return this.costs.createBudget(body, this.auditContext(req));
  }

  private auditContext(req: CostRequest): AuditContext {
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
