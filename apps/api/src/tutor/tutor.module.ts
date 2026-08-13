import { Module } from '@nestjs/common';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';
import { VoiceService } from './voice.service';
import { DocumentModule } from '../documents/document.module';
import { ConceptModule } from '../concepts/concept.module';
import { LessonModule } from '../lessons/lesson.module';
import { UsageModule } from '../usage/usage.module';

/** Adaptive tutoring (Phase 5): grounded, twin-steered conversational tutor,
 *  plus the voice layer — spoken turns run through the same flow and always
 *  leave written material behind (LessonModule). SpeechService comes from the
 *  @Global SpeechModule. No cycle with LessonModule: LessonService reads tutor
 *  sessions via Prisma, never via TutorService. */
@Module({
  imports: [DocumentModule, ConceptModule, LessonModule, UsageModule],
  controllers: [TutorController],
  providers: [TutorService, VoiceService],
  exports: [TutorService],
})
export class TutorModule {}
