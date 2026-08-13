import { Controller, Get, UseGuards } from '@nestjs/common';
import type { SuccessForecast } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SuccessPredictorService } from './success.service';

/** Academic Success Predictor (Sprint 9.6): per-exam success forecast. */
@UseGuards(JwtAccessGuard)
@Controller('success')
export class SuccessController {
  constructor(private readonly predictor: SuccessPredictorService) {}

  @Get()
  forecast(@CurrentUser() user: AuthenticatedUser): Promise<SuccessForecast> {
    return this.predictor.forecast(user.userId);
  }
}
