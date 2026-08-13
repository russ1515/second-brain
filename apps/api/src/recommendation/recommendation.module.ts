import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { RevisionModule } from '../revision/revision.module';
import { RecommendationController } from './recommendation.controller';
import { RecommendationService } from './recommendation.service';

/** Recommendation Engine (Sprint 9.4). A separate, replaceable engine that
 *  COMPOSES the learning path (LearningPathService), the FSRS queue
 *  (RevisionEngineService) and the library (Prisma) into a personalized,
 *  multi-type resource feed — no ranking logic is duplicated. */
@Module({
  imports: [ConceptModule, RevisionModule],
  controllers: [RecommendationController],
  providers: [RecommendationService],
  exports: [RecommendationService],
})
export class RecommendationModule {}
