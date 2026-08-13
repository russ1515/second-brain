import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LearningDna } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LearningDnaService } from './learning-dna.service';

/** Learning DNA Engine (Sprint 9 ⭐): the learner's deep learning profile. */
@UseGuards(JwtAccessGuard)
@Controller('learning-dna')
export class LearningDnaController {
  constructor(private readonly dna: LearningDnaService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<LearningDna> {
    return this.dna.dna(user.userId);
  }
}
