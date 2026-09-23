import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import type {
  GradeReviewSessionItemResponse,
  ReviewHomeView,
  ReviewSessionView,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  GradeReviewSessionItemDto,
  ReviewContextDto,
  StartReviewSessionDto,
} from './dto/review-experience.dto';
import { ReviewExperienceService } from './review-experience.service';

@UseGuards(JwtAccessGuard)
@Controller('review')
export class ReviewExperienceController {
  constructor(private readonly review: ReviewExperienceService) {}

  @Get('home')
  home(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ReviewContextDto,
  ): Promise<ReviewHomeView> {
    return this.review.home(user.userId, query);
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartReviewSessionDto,
  ): Promise<ReviewSessionView> {
    return this.review.start(user.userId, dto);
  }

  @Get('sessions/:id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ReviewSessionView> {
    return this.review.session(user.userId, id);
  }

  @Post('sessions/:id/review')
  @HttpCode(HttpStatus.OK)
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GradeReviewSessionItemDto,
  ): Promise<GradeReviewSessionItemResponse> {
    return this.review.grade(user.userId, id, dto);
  }
}
