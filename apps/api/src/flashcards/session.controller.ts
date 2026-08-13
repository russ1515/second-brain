import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { ReviewQueue, ReviewStats } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SessionService } from './session.service';

@UseGuards(JwtAccessGuard)
@Controller('review')
export class SessionController {
  constructor(private readonly session: SessionService) {}

  /** The day's cross-deck study queue. */
  @Get('queue')
  queue(
    @CurrentUser() user: AuthenticatedUser,
    @Query('newLimit') newLimit?: string,
    @Query('reviewLimit') reviewLimit?: string,
  ): Promise<ReviewQueue> {
    return this.session.queue(user.userId, {
      newLimit: this.optInt(newLimit),
      reviewLimit: this.optInt(reviewLimit),
    });
  }

  /** Study dashboard counts. */
  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser): Promise<ReviewStats> {
    return this.session.stats(user.userId);
  }

  /** Parse an optional numeric query param; invalid or absent → undefined (default). */
  private optInt(value?: string): number | undefined {
    if (value === undefined) {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
