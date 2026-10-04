import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { LearnerPassportController } from './learner-passport.controller';
import { LearnerPassportService } from './learner-passport.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/**
 * Universal KYC / Onboarding (UI/UX Sprint 2). The Passport reuses the same
 * stored answers and the existing observed learner profile from ConceptModule;
 * it does not introduce a parallel learner identity store. Exported for Auth,
 * Tutor and Planner consumers.
 */
@Module({
  imports: [ConceptModule],
  controllers: [OnboardingController, LearnerPassportController],
  providers: [OnboardingService, LearnerPassportService],
  exports: [OnboardingService, LearnerPassportService],
})
export class OnboardingModule {}
