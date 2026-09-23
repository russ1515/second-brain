import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { LearningDnaModule } from '../learning-dna/learning-dna.module';
import { MemoryModule } from '../memory/memory.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { PredictionModule } from '../prediction/prediction.module';
import { BrainController } from './brain.controller';
import { BrainService } from './brain.service';

@Module({
  imports: [ConceptModule, LearningDnaModule, MemoryModule, OnboardingModule, PredictionModule],
  controllers: [BrainController],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
