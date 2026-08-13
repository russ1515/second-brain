import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import type { DayPlan } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StudyPlannerService } from './study-planner.service';

/** AI Study Planner (task 5.2): assembles the day from the other engines. */
@UseGuards(JwtAccessGuard)
@Controller('planner')
export class StudyPlannerController {
  constructor(private readonly planner: StudyPlannerService) {}

  /** Today's time-blocked plan, from the learner's focus window. */
  @Get('today')
  today(@CurrentUser() user: AuthenticatedUser): Promise<DayPlan> {
    return this.planner.today(user.userId);
  }

  /** Rebuild the rest of the day from now — the plan is alive. */
  @Post('replan')
  @HttpCode(HttpStatus.OK)
  replan(@CurrentUser() user: AuthenticatedUser): Promise<DayPlan> {
    return this.planner.replan(user.userId);
  }
}
