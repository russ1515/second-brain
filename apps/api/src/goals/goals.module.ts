import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { ExamsService } from './exams.service';
import { ConceptModule } from '../concepts/concept.module';

/** Goals & Exams (Sprint 5). Persists the learner's objectives and exams; exam
 *  "preparation" is derived from ConceptMastery (ConceptModule). */
@Module({
  imports: [ConceptModule],
  controllers: [GoalsController],
  providers: [GoalsService, ExamsService],
  exports: [GoalsService, ExamsService],
})
export class GoalsModule {}
