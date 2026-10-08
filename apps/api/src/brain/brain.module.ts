import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { LearningDnaModule } from '../learning-dna/learning-dna.module';
import { MemoryModule } from '../memory/memory.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { PredictionModule } from '../prediction/prediction.module';
import { BrainController } from './brain.controller';
import { BrainService } from './brain.service';
import { LearningEvidenceModule } from '../learning-evidence/learning-evidence.module';

@Module({
  imports: [ConceptModule, LearningDnaModule, MemoryModule, OnboardingModule, PredictionModule, LearningEvidenceModule],
  controllers: [BrainController],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
