import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  LearningResetRequirements,
  LearningResetResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ResetLearningDto } from './dto/learning-reset.dto';
import { LearningResetService } from './learning-reset.service';

/** Destructive learning-data controls. Account and commercial records remain
 * outside this controller's mutation boundary. */
@UseGuards(JwtAccessGuard)
@Controller('me/learning')
export class LearningResetController {
  constructor(private readonly reset: LearningResetService) {}

  @Get('reset-requirements')
  requirements(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LearningResetRequirements> {
    return this.reset.getRequirements(user.userId);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  execute(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ResetLearningDto,
  ): Promise<LearningResetResponse> {
    return this.reset.resetLearning(user.userId, user.sessionId, dto);
  }
}
