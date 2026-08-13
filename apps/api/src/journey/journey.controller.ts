import {
  BadRequestException,
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
  DailyPlanItemView,
  DailyPlanView,
  JourneySettings,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { DailyPlanService } from './daily-plan.service';
import { isValidTimezone } from './local-time';
import { UpdateJourneySettingsDto } from './dto/update-journey-settings.dto';

@UseGuards(JwtAccessGuard)
@Controller('journey')
export class JourneyController {
  constructor(
    private readonly plans: DailyPlanService,
    private readonly prisma: PrismaService,
  ) {}

  /** Today's plan in the learner's local day, generated on first read. */
  @Get('today')
  today(@CurrentUser() user: AuthenticatedUser): Promise<DailyPlanView> {
    return this.plans.today(user.userId);
  }

  /** Re-plan the remainder of today against current state. Done/skipped items
   *  are preserved. */
  @Post('today/refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() user: AuthenticatedUser): Promise<DailyPlanView> {
    return this.plans.refresh(user.userId);
  }

  @Post('items/:id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DailyPlanItemView> {
    return this.plans.completeItem(user.userId, id, 'done');
  }

  @Post('items/:id/skip')
  @HttpCode(HttpStatus.OK)
  skip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DailyPlanItemView> {
    return this.plans.completeItem(user.userId, id, 'skipped');
  }

  @Get('settings')
  async settings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JourneySettings> {
    return { timezone: await this.plans.timezoneOf(user.userId) };
  }

  /** The learner's timezone decides when their day starts and when they are
   *  nudged, so it is validated here rather than trusted. */
  @Put('settings')
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateJourneySettingsDto,
  ): Promise<JourneySettings> {
    if (!isValidTimezone(dto.timezone)) {
      throw new BadRequestException(
        `"${dto.timezone}" is not a valid IANA timezone (e.g. "Europe/Paris").`,
      );
    }
    const profile = await this.prisma.profile.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, timezone: dto.timezone },
      update: { timezone: dto.timezone },
      select: { timezone: true },
    });
    return { timezone: profile.timezone };
  }
}
