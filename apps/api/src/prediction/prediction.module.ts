import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { MentorModule } from '../mentor/mentor.module';
import { RevisionModule } from '../revision/revision.module';
import { PredictionController } from './prediction.controller';
import { PredictionService } from './prediction.service';

/** Learning Prediction Engine (Sprint 9.3). A separate, replaceable engine that
 *  COMPOSES the twin (MasteryService, LearningPathService), the mentor's streak
 *  (MentorService) and the FSRS forecast/queue (RevisionEngineService) to
 *  anticipate trajectory risks — no logic is duplicated. */
@Module({
  imports: [ConceptModule, MentorModule, RevisionModule],
  controllers: [PredictionController],
  providers: [PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
