import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  CompareResponse,
  DocumentPrerequisites,
  UnderstandResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { DocumentUnderstandingService } from './document-understanding.service';
import { UnderstandDto } from './dto/understand.dto';
import { CompareDto } from './dto/compare.dto';

/** AI Document Understanding (Sprint 6.5) — teacher-grade operations over a
 *  document, adapted to the learner's Digital Twin. */
@UseGuards(JwtAccessGuard)
@Controller('library/documents')
export class UnderstandingController {
  constructor(private readonly understanding: DocumentUnderstandingService) {}

  /** Summarise / rephrase / simplify / explain — twin-adapted. LLM-backed. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/understand')
  @HttpCode(HttpStatus.OK)
  understand(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UnderstandDto,
  ): Promise<UnderstandResponse> {
    return this.understanding.understand(user.userId, id, dto.mode);
  }

  /** Compare this document with another of the caller's, twin-adapted. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/compare')
  @HttpCode(HttpStatus.OK)
  compare(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompareDto,
  ): Promise<CompareResponse> {
    return this.understanding.compare(user.userId, id, dto.otherDocumentId);
  }

  /** The document's key notions + the prerequisites to review first, each with
   *  the learner's real mastery. Graph + twin data (no LLM). */
  @Get(':id/prerequisites')
  prerequisites(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DocumentPrerequisites> {
    return this.understanding.prerequisites(user.userId, id);
  }
}
