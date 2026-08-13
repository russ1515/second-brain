import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  ComprehensionResult,
  SessionPlan,
  SessionReport,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SessionService } from './session.service';
import { ComprehensionService } from './comprehension.service';
import { StartSessionDto } from './dto/start-session.dto';
import { ComprehensionDto } from './dto/comprehension.dto';

@UseGuards(JwtAccessGuard)
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessions: SessionService,
    private readonly comprehension: ComprehensionService,
  ) {}

  /** Open an orchestrated study session: pick the target and build the lesson. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartSessionDto,
  ): Promise<SessionPlan> {
    return this.sessions.start(user.userId, dto);
  }

  /** Close the session and report what moved (FSRS queue + Digital Twin). */
  @Post(':id/complete')
  @HttpCode(HttpStatus.CREATED)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SessionReport> {
    return this.sessions.complete(user.userId, id);
  }

  /** The teacher checks the student's answer to a question: detects a
   *  misunderstanding and re-explains more simply when needed (Sprint 7.1). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/comprehension')
  @HttpCode(HttpStatus.OK)
  comprehensionCheck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ComprehensionDto,
  ): Promise<ComprehensionResult> {
    return this.comprehension.assess(user.userId, id, dto.question, dto.answer);
  }
}
