import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LearningPredictionView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PredictionService } from './prediction.service';

/** Learning Prediction Engine (Sprint 9.3): the learner's risk forecast. */
@UseGuards(JwtAccessGuard)
@Controller('foresight')
export class PredictionController {
  constructor(private readonly prediction: PredictionService) {}

  @Get()
  forecast(@CurrentUser() user: AuthenticatedUser): Promise<LearningPredictionView> {
    return this.prediction.forecast(user.userId);
  }
}
