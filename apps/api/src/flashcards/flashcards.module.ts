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

/** Spaced-repetition (Phase 3): decks, cards, FSRS review, and LLM-generated
 *  cards from documents. */
@Module({
  controllers: [
    DeckController,
    CardController,
    ReviewController,
    SessionController,
    CardGenerationController,
  ],
  providers: [
    DeckService,
    CardService,
    ReviewService,
    SessionService,
    FsrsService,
    CardGenerationService,
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
