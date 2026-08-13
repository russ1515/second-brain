import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CardView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CardService } from './card.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class CardController {
  constructor(private readonly cards: CardService) {}

  /** Add a card to a deck. */
  @Post('decks/:deckId/cards')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Body() dto: CreateCardDto,
  ): Promise<CardView> {
    return this.cards.create(user.userId, deckId, dto);
  }

  /** List the cards in a deck. */
  @Get('decks/:deckId/cards')
  listByDeck(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
  ): Promise<CardView[]> {
    return this.cards.listByDeck(user.userId, deckId);
  }

  @Get('cards/:id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CardView> {
    return this.cards.get(user.userId, id);
  }

  @Patch('cards/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
  ): Promise<CardView> {
    return this.cards.update(user.userId, id, dto);
  }

  @Delete('cards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.cards.remove(user.userId, id);
  }
}
