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
import type { ConceptDetail, ConceptSummary } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ConceptService } from './concept.service';
import { CreateConceptDto } from './dto/create-concept.dto';
import { UpdateConceptDto } from './dto/update-concept.dto';
import { CreateConceptEdgeDto } from './dto/create-concept-edge.dto';
import { LinkCardDto } from './dto/link-card.dto';
import { LinkDocumentDto } from './dto/link-document.dto';

@UseGuards(JwtAccessGuard)
@Controller('concepts')
export class ConceptController {
  constructor(private readonly concepts: ConceptService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateConceptDto,
  ): Promise<ConceptDetail> {
    return this.concepts.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ConceptSummary[]> {
    return this.concepts.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConceptDetail> {
    return this.concepts.get(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateConceptDto,
  ): Promise<ConceptDetail> {
    return this.concepts.update(user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.concepts.remove(user.userId, id);
  }

  /** Add a directed edge from this concept to another. */
  @Post(':id/edges')
  @HttpCode(HttpStatus.CREATED)
  addEdge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateConceptEdgeDto,
  ): Promise<ConceptDetail> {
    return this.concepts.addEdge(user.userId, id, dto);
  }

  @Delete(':id/edges/:edgeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeEdge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('edgeId') edgeId: string,
  ): Promise<void> {
    await this.concepts.removeEdge(user.userId, id, edgeId);
  }

  /** Link a flashcard to this concept. */
  @Post(':id/cards')
  @HttpCode(HttpStatus.CREATED)
  linkCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LinkCardDto,
  ): Promise<ConceptDetail> {
    return this.concepts.linkCard(user.userId, id, dto.cardId);
  }

  @Delete(':id/cards/:cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('cardId') cardId: string,
  ): Promise<void> {
    await this.concepts.unlinkCard(user.userId, id, cardId);
  }

  /** Link a document to this concept. */
  @Post(':id/documents')
  @HttpCode(HttpStatus.CREATED)
  linkDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: LinkDocumentDto,
  ): Promise<ConceptDetail> {
    return this.concepts.linkDocument(user.userId, id, dto.documentId);
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlinkDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.concepts.unlinkDocument(user.userId, id, documentId);
  }
}
