import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { CardView, ReviewResult } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReviewService } from './review.service';
import { ReviewCardDto } from './dto/review-card.dto';

@UseGuards(JwtAccessGuard)
@Controller()
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  /** Cards currently due for review in a deck. */
  @Get('decks/:deckId/due')
  due(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deckId') deckId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<CardView[]> {
    return this.review.dueCards(user.userId, deckId, limit);
  }

  /** Grade a card, rescheduling it via FSRS. */
  @Post('cards/:id/review')
  @HttpCode(HttpStatus.OK)
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewCardDto,
  ): Promise<ReviewResult> {
    return this.review.review(user.userId, id, dto.rating);
  }
}
