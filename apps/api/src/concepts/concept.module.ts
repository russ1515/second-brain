import { Module } from '@nestjs/common';
import { ConceptController } from './concept.controller';
import { ConceptExtractionController } from './concept-extraction.controller';
import { MasteryController } from './mastery.controller';
import { ConceptService } from './concept.service';
import { ConceptExtractionService } from './concept-extraction.service';
import { MasteryService } from './mastery.service';
import { LearningPathService } from './learning-path.service';
import { RootCauseService } from './root-cause.service';
import { LearnerProfileService } from './learner-profile.service';
import { InsightsService } from './insights.service';
import { RecommendationsService } from './recommendations.service';
import { FlashcardsModule } from '../flashcards/flashcards.module';

/** Digital Twin (Phase 4): concept nodes, knowledge-graph edges, concept↔card/
 *  document links, LLM concept extraction, per-concept mastery, learning paths,
 *  and root-cause gap detection for the Examiner. */
@Module({
  imports: [FlashcardsModule], // for FsrsService (retrievability)
  controllers: [
    ConceptController,
    ConceptExtractionController,
    MasteryController,
  ],
  providers: [
    ConceptService,
    ConceptExtractionService,
    MasteryService,
    LearningPathService,
    RootCauseService,
    LearnerProfileService,
    InsightsService,
    RecommendationsService,
  ],
  exports: [
    ConceptService,
    ConceptExtractionService,
    MasteryService,
    LearningPathService,
    RootCauseService,
    LearnerProfileService,
    InsightsService,
    RecommendationsService,
  ],
})
export class ConceptModule {}
