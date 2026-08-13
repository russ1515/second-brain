import { Controller, Get, UseGuards } from '@nestjs/common';
import type { InsightsCenter } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { InsightsCenterService } from './insights-center.service';

/** AI Insights Center (Sprint 9.7): the learner's full intelligence hub. */
@UseGuards(JwtAccessGuard)
@Controller('insights-center')
export class InsightsCenterController {
  constructor(private readonly center: InsightsCenterService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<InsightsCenter> {
    return this.center.center(user.userId);
  }
}
