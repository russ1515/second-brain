import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { LearningDnaController } from './learning-dna.controller';
import { LearningDnaService } from './learning-dna.service';

/** Learning DNA Engine (Sprint 9 ⭐, transversal). A separate, replaceable engine
 *  that COMPOSES the behavioural profile (LearnerProfileService) and raw
 *  memory/practice signals into one shared, persisted learning profile — the
 *  deep "how you learn" fingerprint, distinct from the twin's current state.
 *  Exported so other engines can read the same DNA without recomputing it. */
@Module({
  imports: [ConceptModule],
  controllers: [LearningDnaController],
  providers: [LearningDnaService],
  exports: [LearningDnaService],
})
export class LearningDnaModule {}
