import { Module } from '@nestjs/common';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { ComprehensionService } from './comprehension.service';
import { LessonModule } from '../lessons/lesson.module';
import { ConceptModule } from '../concepts/concept.module';

/** Session Orchestrator (task 3.7): composes the lesson engine (LessonModule)
 *  and the Digital Twin (MasteryService + LearningPathService, via
 *  ConceptModule) into one guided, AI-driven study loop. The AI Teacher's live
 *  comprehension check (Sprint 7.1) rides on top. */
@Module({
  imports: [LessonModule, ConceptModule],
  controllers: [SessionController],
  providers: [SessionService, ComprehensionService],
  exports: [SessionService],
})
export class SessionModule {}
