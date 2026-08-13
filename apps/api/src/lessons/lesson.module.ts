import { Module } from '@nestjs/common';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { AssessmentService } from './assessment.service';
import { DocumentModule } from '../documents/document.module';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { ConceptModule } from '../concepts/concept.module';
import { RevisionModule } from '../revision/revision.module';

/** Written-first learning engine + the Examiner (Phase 5, Educational Engine).
 *  Turns topics / concepts / tutoring interactions into complete written
 *  lessons, indexes them into long-term memory, generates FSRS flashcards, and
 *  marks the learner's answers with root-cause gap detection. Reuses the
 *  document, flashcard and concept layers. */
@Module({
  imports: [DocumentModule, FlashcardsModule, ConceptModule, RevisionModule],
  controllers: [LessonController],
  providers: [LessonService, AssessmentService],
  exports: [LessonService, AssessmentService],
})
export class LessonModule {}
