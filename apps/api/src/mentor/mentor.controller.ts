import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { MentorBriefing, MentorOverview } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MentorService } from './mentor.service';

@UseGuards(JwtAccessGuard)
@Controller('mentor')
export class MentorController {
  constructor(private readonly mentor: MentorService) {}

  /** Streak, real stats, and wins. Milestones crossed since the last call come
   *  back in `newlyEarned` so the client can celebrate them once. */
  @Get()
  overview(@CurrentUser() user: AuthenticatedUser): Promise<MentorOverview> {
    return this.mentor.overview(user.userId);
  }

  /** Coaching grounded in the learner's actual numbers. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('briefing')
  @HttpCode(HttpStatus.OK)
  briefing(@CurrentUser() user: AuthenticatedUser): Promise<MentorBriefing> {
    return this.mentor.briefing(user.userId);
  }
}
