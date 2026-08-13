import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ReviewableView, RevisionForecastView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RevisionEngineService } from './revision-engine.service';
import { RegisterReviewableDto } from './dto/register-reviewable.dto';
import { ReviewReviewableDto } from './dto/review-reviewable.dto';

/** The independent FSRS Revision Engine (task 5.1) — schedules any activity. */
@UseGuards(JwtAccessGuard)
@Controller('revision-engine')
export class RevisionEngineController {
  constructor(private readonly engine: RevisionEngineService) {}

  /** Register an activity (lesson, exercise, quiz, homework…) for review. */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterReviewableDto,
  ): Promise<ReviewableView> {
    return this.engine.register(user.userId, dto);
  }

  /** The full review queue, most urgent first, with FSRS signals. */
  @Get('queue')
  queue(@CurrentUser() user: AuthenticatedUser): Promise<ReviewableView[]> {
    return this.engine.queue(user.userId);
  }

  /** Only the items due for review now. */
  @Get('due')
  due(@CurrentUser() user: AuthenticatedUser): Promise<ReviewableView[]> {
    return this.engine.due(user.userId);
  }

  /** Predictive Revision — anticipate when recall will drop below the risk
   *  floor, so the AI acts before it's forgotten (task 5.5). */
  @Get('forecast')
  forecast(@CurrentUser() user: AuthenticatedUser): Promise<RevisionForecastView> {
    return this.engine.forecasts(user.userId);
  }

  /** Grade a reviewable (rating 1-4, or a 0..1 score) and reschedule it. */
  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewReviewableDto,
  ): Promise<ReviewableView> {
    return this.engine.review(user.userId, id, dto);
  }
}
