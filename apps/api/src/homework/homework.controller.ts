import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { HomeworkView, SubmitAttemptResponse } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { HomeworkService } from './homework.service';
import { SubmitAttemptDto } from '../lessons/dto/submit-attempt.dto';

@UseGuards(JwtAccessGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  /** The personalised homework for a lesson (generated lazily on first read). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('lesson/:lessonId')
  forLesson(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ): Promise<HomeworkView> {
    return this.homework.forLesson(user.userId, lessonId);
  }

  /** Regenerate homework, re-adapted to the learner's current mastery. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('lesson/:lessonId/regenerate')
  @HttpCode(HttpStatus.CREATED)
  regenerate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId') lessonId: string,
  ): Promise<HomeworkView> {
    return this.homework.regenerate(user.userId, lessonId);
  }

  /** Answer one homework exercise; the Examiner marks it and corrects. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/exercises/:index/attempt')
  @HttpCode(HttpStatus.CREATED)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Body() dto: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponse> {
    return this.homework.submitAttempt(user.userId, id, index, dto.answer);
  }
}
