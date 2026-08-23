import { Module } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/**
 * Universal KYC / Onboarding (UI/UX Sprint 2). Depends only on the global
 * Prisma + LLM modules; the completion step seeds Profile / LanguageProfile /
 * Concept rows directly (dedup-safe), so it needs no other module and nothing
 * can form a cycle around it. Exported so AuthModule can surface
 * `onboardingCompleted` on `/auth/me`.
 */
@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
