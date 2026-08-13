import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  CardView,
  ExerciseAttemptView,
  LessonSummary,
  LessonView,
  SubmitAttemptResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LessonService } from './lesson.service';
import { AssessmentService } from './assessment.service';
import { GenerateLessonDto } from './dto/generate-lesson.dto';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';

@UseGuards(JwtAccessGuard)
@Controller('lessons')
export class LessonController {
  constructor(
    private readonly lessons: LessonService,
    private readonly assessment: AssessmentService,
  ) {}

  /** Generate a complete written lesson (+ flashcards, indexed to memory). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateLessonDto,
  ): Promise<LessonView> {
    return this.lessons.generate(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<LessonSummary[]> {
    return this.lessons.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LessonView> {
    return this.lessons.get(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.lessons.remove(user.userId, id);
  }

  /**
   * Answer one of the lesson's exercises and have the Examiner mark it:
   * detailed correction + personalised feedback, and — on a mistake — the
   * root-cause prerequisite blamed via the knowledge graph.
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/exercises/:index/attempt')
  @HttpCode(HttpStatus.CREATED)
  attempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('index') index: string,
    @Body() dto: SubmitAttemptDto,
  ): Promise<SubmitAttemptResponse> {
    return this.assessment.submit(
      user.userId,
      id,
      this.parseIndex(index),
      dto.answer,
    );
  }

  /** This lesson's exam history, newest first. */
  @Get(':id/attempts')
  attempts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExerciseAttemptView[]> {
    return this.assessment.history(user.userId, id);
  }

  /** The flashcards this lesson generated (standard-flow step 9). */
  @Get(':id/flashcards')
  flashcards(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CardView[]> {
    return this.lessons.flashcards(user.userId, id);
  }

  /** Nest 10's ParseIntPipe 400s on absent params; parse explicitly instead. */
  private parseIndex(raw: string): number {
    const index = Number(raw);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Exercise index must be a non-negative integer.');
    }
    return index;
  }
}
