import { Module } from '@nestjs/common';
import { HomeworkController } from './homework.controller';
import { HomeworkService } from './homework.service';
import { ConceptModule } from '../concepts/concept.module';
import { DocumentModule } from '../documents/document.module';
import { LessonModule } from '../lessons/lesson.module';

/** Homework Engine (Sprint 3, task 3.5): personalised homework after each
 *  lesson, adapted to the learner's Digital Twin (ConceptMastery, via
 *  ConceptModule) and grounded in their Learning Memory (RetrievalService, via
 *  DocumentModule). Corrections reuse the lesson Examiner (LessonModule). */
@Module({
  imports: [ConceptModule, DocumentModule, LessonModule],
  controllers: [HomeworkController],
  providers: [HomeworkService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
