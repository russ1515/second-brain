import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { MentorModule } from '../mentor/mentor.module';
import { InsightsCenterController } from './insights-center.controller';
import { InsightsCenterService } from './insights-center.service';

/** AI Insights Center (Sprint 9.7). A separate, replaceable engine that COMPOSES
 *  strengths/weaknesses + the twin (MasteryService), the 4.6 insights
 *  (InsightsService), the learning path (LearningPathService) and the streak
 *  (MentorService) into one explained intelligence hub — no scores duplicated. */
@Module({
  imports: [ConceptModule, MentorModule],
  controllers: [InsightsCenterController],
  providers: [InsightsCenterService],
  exports: [InsightsCenterService],
})
export class InsightsCenterModule {}
