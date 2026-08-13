import { Module } from '@nestjs/common';
import { FsrsEngine } from './fsrs-engine';
import { RevisionEngineService } from './revision-engine.service';
import { RevisionEngineController } from './revision-engine.controller';

/** FSRS Revision Engine (Sprint 5, task 5.1). A standalone spaced-repetition
 *  engine that schedules ANY pedagogical activity — not just flashcards. Needs
 *  only PrismaService (global), so no other imports; exported so activity
 *  services can register/track their items for review. */
@Module({
  controllers: [RevisionEngineController],
  providers: [FsrsEngine, RevisionEngineService],
  exports: [FsrsEngine, RevisionEngineService],
})
export class RevisionModule {}
