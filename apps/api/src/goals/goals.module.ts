import { Module } from '@nestjs/common';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';
import { ExamsService } from './exams.service';
import { ConceptModule } from '../concepts/concept.module';
import { ExperienceSessionModule } from '../experience-sessions/experience-session.module';

/** Goals & Exams (Sprint 5). Persists the learner's objectives and exams; exam
 *  "preparation" is derived from ConceptMastery (ConceptModule). */
@Module({
  imports: [ConceptModule, ExperienceSessionModule],
  controllers: [GoalsController],
  providers: [GoalsService, ExamsService],
  exports: [GoalsService, ExamsService],
})
export class GoalsModule {}
