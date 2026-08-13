import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  Collection,
  LibraryDocument,
  LibraryDocumentDetail,
  LibraryFacets,
  LibraryFilter,
} from '@second-brain/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { LibraryService } from './library.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { AssignCollectionDto } from './dto/assign-collection.dto';

const FILTERS: LibraryFilter[] = [
  'all',
  'favorites',
  'recent',
  'shared',
  'trash',
];

/** Smart Library (Sprint 6.1) — the Evernote-style organization surface over
 *  the Learning Memory Engine's documents. */
@UseGuards(JwtAccessGuard)
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  /** Documents for a shelf, with derived metadata + detected concepts. */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter') filter?: string,
    @Query('subject') subject?: string,
    @Query('language') language?: string,
    @Query('collectionId') collectionId?: string,
    @Query('q') q?: string,
  ): Promise<LibraryDocument[]> {
    return this.library.list(user.userId, {
      filter: this.toFilter(filter),
      subject,
      language,
      collectionId,
      q,
    });
  }

  /** Sidebar counts + subject/language/collection facets. */
  @Get('facets')
  facets(@CurrentUser() user: AuthenticatedUser): Promise<LibraryFacets> {
    return this.library.facets(user.userId);
  }

  @Get('collections')
  collections(@CurrentUser() user: AuthenticatedUser): Promise<Collection[]> {
    return this.library.listCollections(user.userId);
  }

  /** One document with full text + metadata (detail view). */
  @Get('documents/:id')
  getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LibraryDocumentDetail> {
    return this.library.getOne(user.userId, id);
  }

  @Post('collections')
  @HttpCode(HttpStatus.CREATED)
  createCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<Collection> {
    return this.library.createCollection(user.userId, dto.name);
  }

  @Patch('documents/:id/favorite')
  @HttpCode(HttpStatus.OK)
  favorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LibraryDocument> {
    return this.library.toggleFavorite(user.userId, id);
  }

  @Post('documents/:id/trash')
  @HttpCode(HttpStatus.OK)
  trash(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LibraryDocument> {
    return this.library.trash(user.userId, id);
  }

  @Post('documents/:id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LibraryDocument> {
    return this.library.restore(user.userId, id);
  }

  /** (Re)run AI enrichment — backfills documents ingested before Sprint 6.1. */
  @Post('documents/:id/enrich')
  @HttpCode(HttpStatus.OK)
  enrich(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LibraryDocument> {
    return this.library.enrichNow(user.userId, id);
  }

  @Patch('documents/:id/collection')
  @HttpCode(HttpStatus.OK)
  assignCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignCollectionDto,
  ): Promise<LibraryDocument> {
    return this.library.assignCollection(user.userId, id, dto.collectionId ?? null);
  }

  private toFilter(value?: string): LibraryFilter {
    return FILTERS.includes(value as LibraryFilter)
      ? (value as LibraryFilter)
      : 'all';
  }
}
