import { Module } from '@nestjs/common';
import { MentorController } from './mentor.controller';
import { MentorService } from './mentor.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';
import { ConceptModule } from '../concepts/concept.module';

/** The Mentor role (Phase 5, Educational Engine): streaks, motivation, wins and
 *  strategy — all derived from real activity. Reuses SessionService (FSRS stats)
 *  and LearningPathService (the twin). Depends on no other role, so JourneyModule
 *  can import it to give the daily nudge the Mentor's voice. */
@Module({
  imports: [FlashcardsModule, ConceptModule],
  controllers: [MentorController],
  providers: [MentorService],
  exports: [MentorService],
})
export class MentorModule {}
