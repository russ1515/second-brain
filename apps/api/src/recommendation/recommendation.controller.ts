import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { NextBestAction, RecommendationFeed } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RecommendationService } from './recommendation.service';
import { NextBestActionAdapter } from './next-best-action.adapter';

/** Recommendation Engine (Sprint 9.4): the personalized resource feed + the
 *  learner's accept / dismiss decision on each suggestion. */
@UseGuards(JwtAccessGuard)
@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly recommendations: RecommendationService,
    private readonly nextBestActionAdapter: NextBestActionAdapter,
  ) {}

  @Get()
  feed(@CurrentUser() user: AuthenticatedUser): Promise<RecommendationFeed> {
    return this.recommendations.feed(user.userId);
  }

  @Get('next-best-action')
  async nextBestAction(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NextBestAction | null> {
    const feed = await this.recommendations.feed(user.userId);
    return this.nextBestActionAdapter.fromRecommendations(feed.recommendations);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  async accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.recommendations.respond(user.userId, id, 'accepted');
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.recommendations.respond(user.userId, id, 'dismissed');
  }
}
