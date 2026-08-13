import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import type {
  EntitlementsView,
  PlanView,
  SubscriptionView,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { EntitlementsService } from './entitlements.service';
import { ChangePlanDto } from './dto/change-plan.dto';

/** Subscription Engine (Sprint 8.1): read the plan catalog, the current user's
 *  subscription, and their effective entitlements. Changing plan here is a plain
 *  state change — payment authorization is added by the Payments task. */
@UseGuards(JwtAccessGuard)
@Controller()
export class SubscriptionController {
  constructor(
    private readonly plans: PlanService,
    private readonly subscriptions: SubscriptionService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('plans')
  listPlans(): Promise<PlanView[]> {
    return this.plans.list();
  }

  @Get('subscription')
  async mine(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SubscriptionView> {
    const sub = await this.subscriptions.resolveForUser(user.userId);
    return this.subscriptions.toView(sub);
  }

  @Get('subscription/entitlements')
  entitlementsFor(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EntitlementsView> {
    return this.entitlements.forUser(user.userId);
  }

  @Put('subscription/plan')
  @HttpCode(HttpStatus.OK)
  async changePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePlanDto,
  ): Promise<SubscriptionView> {
    const sub = await this.subscriptions.setPlan(user.userId, dto.slug);
    return this.subscriptions.toView(sub);
  }
}
