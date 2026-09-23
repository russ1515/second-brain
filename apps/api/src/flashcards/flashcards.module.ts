import { Module } from '@nestjs/common';
import { DeckController } from './deck.controller';
import { CardController } from './card.controller';
import { ReviewController } from './review.controller';
import { SessionController } from './session.controller';
import { CardGenerationController } from './card-generation.controller';
import { DeckService } from './deck.service';
import { CardService } from './card.service';
import { ReviewService } from './review.service';
import { SessionService } from './session.service';
import { FsrsService } from './fsrs.service';
import { CardGenerationService } from './card-generation.service';
import { ExperienceSessionModule } from '../experience-sessions/experience-session.module';
import { RevisionModule } from '../revision/revision.module';
import { ReviewExperienceController } from './review-experience.controller';
import { ReviewExperienceService } from './review-experience.service';

/** Spaced-repetition (Phase 3): decks, cards, FSRS review, and LLM-generated
 *  cards from documents. */
@Module({
  imports: [ExperienceSessionModule, RevisionModule],
  controllers: [
    DeckController,
    CardController,
    ReviewController,
    SessionController,
    CardGenerationController,
    ReviewExperienceController,
  ],
  providers: [
    DeckService,
    CardService,
    ReviewService,
    SessionService,
    FsrsService,
    CardGenerationService,
    ReviewExperienceService,
  ],
  exports: [
    DeckService,
    CardService,
    ReviewService,
    SessionService,
    FsrsService,
    CardGenerationService,
  ],
})
export class FlashcardsModule {}
