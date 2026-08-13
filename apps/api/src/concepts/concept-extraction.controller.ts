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
import type { ExtractConceptsResponse } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ConceptExtractionService } from './concept-extraction.service';
import { ExtractConceptsDto } from './dto/extract-concepts.dto';

@UseGuards(JwtAccessGuard)
@Controller('documents')
export class ConceptExtractionController {
  constructor(private readonly extraction: ConceptExtractionService) {}

  /** Extract concepts (+ prerequisite edges) from a document via the LLM. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':documentId/extract-concepts')
  @HttpCode(HttpStatus.CREATED)
  extract(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() dto: ExtractConceptsDto,
  ): Promise<ExtractConceptsResponse> {
    return this.extraction.extractFromDocument(user.userId, documentId, dto);
  }
}
