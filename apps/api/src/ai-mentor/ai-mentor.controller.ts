import { Controller, Get, UseGuards } from '@nestjs/common';
import type { MentorGuidance } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AiMentorService } from './ai-mentor.service';

/** AI Mentor (Sprint 9.5): the mentor's strategic guidance for the learner. */
@UseGuards(JwtAccessGuard)
@Controller('ai-mentor')
export class AiMentorController {
  constructor(private readonly mentor: AiMentorService) {}

  @Get()
  guidance(@CurrentUser() user: AuthenticatedUser): Promise<MentorGuidance> {
    return this.mentor.guidance(user.userId);
  }
}
