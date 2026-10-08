import { Module } from '@nestjs/common';
import { EvidenceProgressService } from './evidence-progress.service';
import { LearningCompletionService } from './learning-completion.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';

@Module({
  imports: [FlashcardsModule],
  providers: [LearningCompletionService, EvidenceProgressService],
  exports: [LearningCompletionService, EvidenceProgressService],
})
export class LearningEvidenceModule {}
