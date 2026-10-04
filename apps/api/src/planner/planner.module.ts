import { Module } from '@nestjs/common';
import { StudyPlannerController } from './study-planner.controller';
import { StudyPlannerService } from './study-planner.service';
import { ConceptModule } from '../concepts/concept.module';
import { RevisionModule } from '../revision/revision.module';
import { OnboardingModule } from '../onboarding/onboarding.module';

/** AI Study Planner (Sprint 5, task 5.2). The conductor: it assembles the day
 *  from the Adaptive Path + Digital Twin + ConceptMastery (ConceptModule) and
 *  FSRS due items (RevisionModule). It generates nothing of its own. */
@Module({
  imports: [ConceptModule, RevisionModule, OnboardingModule],
  controllers: [StudyPlannerController],
  providers: [StudyPlannerService],
  exports: [StudyPlannerService],
})
export class PlannerModule {}
