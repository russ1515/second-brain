import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { GoalsModule } from '../goals/goals.module';
import { SuccessController } from './success.controller';
import { SuccessPredictorService } from './success.service';

/** Academic Success Predictor (Sprint 9.6). A separate, replaceable engine that
 *  COMPOSES the exams' derived preparation (ExamsService) and the twin's
 *  per-concept evidence (MasteryService) into a per-exam success + confidence
 *  estimate — no mastery arithmetic is duplicated. */
@Module({
  imports: [ConceptModule, GoalsModule],
  controllers: [SuccessController],
  providers: [SuccessPredictorService],
  exports: [SuccessPredictorService],
})
export class SuccessModule {}
