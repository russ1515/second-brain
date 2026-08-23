import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  CompleteOnboardingResponse,
  GenerateAssessmentResponse,
  OnboardingState,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OnboardingService } from './onboarding.service';
import { SaveOnboardingDto } from './dto/save-onboarding.dto';
import { GenerateAssessmentDto } from './dto/generate-assessment.dto';

/**
 * The Universal KYC (UI/UX Sprint 2). `GET` resumes an interrupted flow, `PUT`
 * saves progressively (section-by-section merge), `POST /assessment` runs the
 * quick diagnostic, and `POST /complete` produces + applies the system
 * configuration and marks onboarding done.
 */
@UseGuards(JwtAccessGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Resume point: the saved state, or a fresh not-started one. */
  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<OnboardingState> {
    return this.onboarding.get(user.userId);
  }

  /** Save a partial patch. Idempotent; safe to call on every step. */
  @Put()
  save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveOnboardingDto,
  ): Promise<OnboardingState> {
    return this.onboarding.save(user.userId, dto);
  }

  /** A short adaptive diagnostic for one subject (LLM, best-effort). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('assessment')
  @HttpCode(HttpStatus.OK)
  assessment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateAssessmentDto,
  ): Promise<GenerateAssessmentResponse> {
    return this.onboarding.generateAssessment(user.userId, dto);
  }

  /** Finish: build + apply the system configuration, mark completed. */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CompleteOnboardingResponse> {
    return this.onboarding.complete(user.userId);
  }
}
