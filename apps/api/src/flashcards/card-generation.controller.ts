import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { GenerateCardsResponse } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CardGenerationService } from './card-generation.service';
import { GenerateCardsDto } from './dto/generate-cards.dto';

@UseGuards(JwtAccessGuard)
@Controller('documents')
export class CardGenerationController {
  constructor(private readonly generation: CardGenerationService) {}

  /** Generate flashcards from a document's content via the LLM. */
  // LLM-backed and cost-bearing, so rate-limited tighter than the global throttler.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':documentId/generate-cards')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() dto: GenerateCardsDto,
  ): Promise<GenerateCardsResponse> {
    return this.generation.generateFromDocument(user.userId, documentId, dto);
  }
}
