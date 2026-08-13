import { Module } from '@nestjs/common';
import { JourneyController } from './journey.controller';
import { DailyPlanService } from './daily-plan.service';
import { JourneyScheduler } from './journey.scheduler';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { ConceptModule } from '../concepts/concept.module';
import { MentorModule } from '../mentor/mentor.module';

/** Daily learning journey (Phase 5, Educational Engine): builds the learner's
 *  day from real state (FSRS due work, the twin's learning path, language
 *  vocabulary) and nudges them at each local slot, in the Mentor's voice.
 *  NotificationService comes from the @Global NotificationModule. */
@Module({
  imports: [FlashcardsModule, ConceptModule, MentorModule],
  controllers: [JourneyController],
  providers: [DailyPlanService, JourneyScheduler],
  exports: [DailyPlanService, JourneyScheduler],
})
export class JourneyModule {}
