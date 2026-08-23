import { IsIn, IsObject, IsOptional } from 'class-validator';
import type {
  OnboardingAnswers,
  OnboardingStep,
  SaveOnboardingRequest,
} from '@second-brain/shared';

const STEPS: OnboardingStep[] = [
  'welcome',
  'identity',
  'category',
  'academic',
  'goals',
  'subjects',
  'languages',
  'mobility',
  'language_learner',
  'preferences',
  'teacher',
  'academic_support',
  'assessment',
  'twin',
  'adaptation',
  'done',
];

/**
 * A partial patch of the KYC (UI/UX Sprint 2). The answer sections are stored
 * as JSON and validated structurally by the shared types + the service's
 * merge logic — we validate the envelope (a known step, an object of answers)
 * rather than every optional field, keeping the KYC extensible (2.21).
 */
export class SaveOnboardingDto implements SaveOnboardingRequest {
  @IsOptional()
  @IsIn(STEPS)
  currentStep?: OnboardingStep;

  @IsOptional()
  @IsObject()
  answers?: OnboardingAnswers;
}
