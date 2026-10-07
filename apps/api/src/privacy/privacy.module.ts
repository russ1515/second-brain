import { Module } from '@nestjs/common';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { LearningReportController } from './learning-report.controller';
import { LearningReportService } from './learning-report.service';
import { LearningResetController } from './learning-reset.controller';
import { LearningResetService } from './learning-reset.service';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

/** Privacy & GDPR (Sprint 8.7). Data export, consent, and account deletion.
 *  Prisma is @Global; nothing else is needed. */
@Module({
  imports: [OnboardingModule],
  controllers: [PrivacyController, LearningReportController, LearningResetController],
  providers: [PrivacyService, LearningReportService, LearningResetService],
})
export class PrivacyModule {}
