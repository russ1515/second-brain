import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { CoachPlan, ProactiveBriefing } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CoachService } from './coach.service';
import { AcademicCoachService } from './academic-coach.service';
import { UpdateCoachDto } from './dto/update-coach.dto';

@UseGuards(JwtAccessGuard)
@Controller('coach')
export class CoachController {
  constructor(
    private readonly coach: CoachService,
    private readonly academic: AcademicCoachService,
  ) {}

  /** The proactive briefing shown when the learner opens the app. */
  @Get('today')
  today(@CurrentUser() user: AuthenticatedUser): Promise<ProactiveBriefing> {
    return this.coach.today(user.userId);
  }

  /** The personalised, adaptive coaching plan (Sprint 9.2). */
  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser): Promise<CoachPlan> {
    return this.academic.plan(user.userId);
  }

  /** Override one or more coach dimensions — a learner decision. */
  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCoachDto,
  ): Promise<CoachPlan> {
    return this.academic.update(user.userId, dto);
  }
}
