import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { UsageView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsageService } from './usage.service';
import { RecordUsageDto } from './dto/record-usage.dto';

/** Usage & Quotas (Sprint 8.3). Read the usage snapshot; report client-metered
 *  consumption (e.g. voice minutes counted on-device). Server-side metrics are
 *  recorded by the backend at the point of use. */
@UseGuards(JwtAccessGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Get()
  mine(@CurrentUser() user: AuthenticatedUser): Promise<UsageView> {
    return this.usage.usage(user.userId);
  }

  @Post('record')
  @HttpCode(HttpStatus.NO_CONTENT)
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordUsageDto,
  ): Promise<void> {
    await this.usage.record(user.userId, dto.metric, dto.amount ?? 1);
  }
}
