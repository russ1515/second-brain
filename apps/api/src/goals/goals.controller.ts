import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { ExamView, Goal } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { GoalsService } from './goals.service';
import { ExamsService } from './exams.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateExamDto } from './dto/create-exam.dto';

/** Goals & Exams (Sprint 5 persistence + Study screens). */
@UseGuards(JwtAccessGuard)
@Controller()
export class GoalsController {
  constructor(
    private readonly goals: GoalsService,
    private readonly exams: ExamsService,
  ) {}

  // ── Goals ──────────────────────────────────────────────────────────────────

  @Get('goals')
  listGoals(@CurrentUser() user: AuthenticatedUser): Promise<Goal[]> {
    return this.goals.list(user.userId);
  }

  @Post('goals')
  @HttpCode(HttpStatus.CREATED)
  createGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGoalDto,
  ): Promise<Goal> {
    return this.goals.create(user.userId, dto);
  }

  /** Toggle a goal done / pending. */
  @Patch('goals/:id/toggle')
  toggleGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<Goal> {
    return this.goals.toggle(user.userId, id);
  }

  @Delete('goals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeGoal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.goals.remove(user.userId, id);
  }

  // ── Exams ──────────────────────────────────────────────────────────────────

  @Get('exams')
  listExams(@CurrentUser() user: AuthenticatedUser): Promise<ExamView[]> {
    return this.exams.list(user.userId);
  }

  @Post('exams')
  @HttpCode(HttpStatus.CREATED)
  createExam(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExamDto,
  ): Promise<ExamView> {
    return this.exams.create(user.userId, dto);
  }

  @Delete('exams/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.exams.remove(user.userId, id);
  }
}
