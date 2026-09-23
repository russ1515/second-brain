import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserReportDto } from '../diagnostics/dto/diagnostics.dto';
import { UserReportService, type CreatedUserReport } from '../diagnostics/user-report.service';

/** User-facing reporting (Sprint 8.5). Any signed-in user can file a report; the
 *  triage happens in the admin dashboard. */
@UseGuards(JwtAccessGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: UserReportService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserReportDto,
  ): Promise<CreatedUserReport> {
    return this.reports.create(user.userId, dto);
  }
}
