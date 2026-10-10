import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  LanguageMasteryAttemptService,
  type LanguageMasteryAttemptProjection,
} from './language-mastery-attempt.service';

/** Read-only owner projection. Decisions are never accepted from a client;
 * start/bind/evaluate remain internal orchestration operations. */
@UseGuards(JwtAccessGuard)
@Controller('languages/:profileId/mastery-attempts')
export class LanguageMasteryAttemptController {
  constructor(private readonly attempts: LanguageMasteryAttemptService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('profileId') profileId: string,
  ): Promise<LanguageMasteryAttemptProjection[]> {
    return this.attempts.projection(user.userId, profileId);
  }
}
