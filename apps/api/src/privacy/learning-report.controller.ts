import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { LearningReportView } from '@second-brain/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { LearningReportService } from './learning-report.service';

@UseGuards(JwtAccessGuard)
@Controller('me')
export class LearningReportController {
  constructor(private readonly reports: LearningReportService) {}

  @Get('learning-report')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Query('locale') locale?: string,
  ): Promise<LearningReportView> {
    return this.reports.get(user.userId, locale);
  }
}
