import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  PayloadTooLargeException,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type {
  AskResponse,
  DocumentDetail,
  DocumentSummary,
  Page,
  SearchResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DocumentService } from './document.service';
import { ScanService } from './scan.service';
import { RetrievalService } from './retrieval/retrieval.service';
import { RagService } from './rag/rag.service';
import { CreateTextDocumentDto } from './dto/create-text-document.dto';
import { CreateUrlDocumentDto } from './dto/create-url-document.dto';
import { SearchDto } from './dto/search.dto';
import { AskDto } from './dto/ask.dto';
import type { UploadedFileLike } from './extraction/text-extraction.service';
import { parseScanPageEdits } from '../media/scan-page-transform';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
/** Pages per scan. Mirrors ScanService's own cap. */
const MAX_SCAN_IMAGES = 50;
// BUSINESS_DECISION_REQUIRED: a bounded request total prevents eight valid
// per-file uploads from exhausting API memory. This is a security ceiling, not
// a commercial plan quota.
const MAX_SCAN_TOTAL_BYTES = 100 * 1024 * 1024;
// Multer's memory storage buffers files before the controller can validate the
// aggregate. Capping every one of the 50 possible pages to its share of the
// ceiling makes that aggregate ceiling effective while bytes are received.
const MAX_SCAN_PAGE_BYTES = Math.floor(MAX_SCAN_TOTAL_BYTES / MAX_SCAN_IMAGES);

@UseGuards(JwtAccessGuard)
@Controller('documents')
export class DocumentController {
  constructor(
    private readonly documents: DocumentService,
    private readonly scan: ScanService,
    private readonly retrieval: RetrievalService,
    private readonly rag: RagService,
  ) {}

  /** Semantic search across the caller's own documents. */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchDto,
  ): Promise<SearchResponse> {
    const documentIds = await this.retrieval.resolveScope(user.userId, {
      documentId: dto.documentId,
      documentIds: dto.documentIds,
      collectionId: dto.collectionId,
      subject: dto.subject,
    });
    return this.retrieval.search(user.userId, dto.query, {
      limit: dto.limit,
      minScore: dto.minScore,
      ...(documentIds ? { documentIds } : {}),
    });
  }

  /** Ask a question answered from the caller's own documents, with citations. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('ask')
  @HttpCode(HttpStatus.OK)
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskDto,
  ): Promise<AskResponse> {
    return this.rag.ask(user.userId, dto.question, {
      limit: dto.limit,
      minScore: dto.minScore,
      documentId: dto.documentId,
      documentIds: dto.documentIds,
      collectionId: dto.collectionId,
      subject: dto.subject,
    });
  }

  /** Ingest pasted text / markdown. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createFromText(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTextDocumentDto,
  ): Promise<DocumentDetail> {
    return this.documents.createFromText(user.userId, dto);
  }

  /** Ingest an uploaded PDF / .txt / .md file (multipart field `file`). */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  createFromFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('title') title?: string,
    @Body('allowDuplicate') allowDuplicate?: string,
  ): Promise<DocumentDetail> {
    if (!file) {
      throw new BadRequestException('No file was uploaded (field "file").');
    }
    return this.documents.createFromFile(user.userId, file, title, allowDuplicate === 'true');
  }

  /**
   * Ingest photographed / scanned pages (multipart field `images`, up to 50).
   * The pages are transcribed by the vision-capable LLM and then travel the
   * ordinary text pipeline — chunked, embedded, and usable as lesson grounding.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('scan')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('images', MAX_SCAN_IMAGES, {
      limits: { fileSize: MAX_SCAN_PAGE_BYTES },
    }),
  )
  createFromImages(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() images: UploadedFileLike[] | undefined,
    @Body('title') title?: string,
    @Body('pageEdits') pageEdits?: string,
    @Body('subject') subject?: string,
    @Body('language') language?: string,
    @Body('collectionId') collectionId?: string,
    @Body('contentType') contentType?: string,
    @Headers('x-request-id') requestId?: string,
  ): Promise<DocumentDetail> {
    if (!images?.length) {
      throw new BadRequestException('No images were uploaded (field "images").');
    }
    const totalBytes = images.reduce(
      (total, image) => total + Math.max(image.size || 0, image.buffer?.length || 0),
      0,
    );
    if (totalBytes > MAX_SCAN_TOTAL_BYTES) {
      throw new PayloadTooLargeException('The scan exceeds the 100 MB request safety limit.');
    }
    const edits = parseScanPageEdits(pageEdits, images.length);
    return this.scan.fromImages(user.userId, images, title, requestId, edits, {
      subject,
      language,
      collectionId,
      contentType: contentType === 'PHOTO' || contentType === 'SCAN' || contentType === 'NOTEBOOK'
        ? contentType
        : undefined,
    });
  }

  /** Ingest a web page by URL (fetched and extracted server-side). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('from-url')
  @HttpCode(HttpStatus.CREATED)
  createFromUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUrlDocumentDto,
  ): Promise<DocumentDetail> {
    return this.documents.createFromUrl(user.userId, dto.url, dto.title);
  }

  /** List the caller's documents. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<DocumentSummary[]> {
    return this.documents.list(user.userId);
  }

  /** One page of the caller's documents (Sprint 10.1). Declared before `:id`
   *  so "paged" isn't captured as a document id. */
  @Get('paged')
  listPaged(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<Page<DocumentSummary>> {
    const parsed = limit ? Number.parseInt(limit, 10) : undefined;
    return this.documents.listPaged(user.userId, parsed, cursor);
  }

  /** Fetch one document with its full content. */
  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DocumentDetail> {
    return this.documents.get(user.userId, id);
  }

  @Get(':id/original')
  async original(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const media = await this.documents.getOriginal(user.userId, id);
    response.set({
      'Content-Type': media.mimeType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'Last-Modified': media.modifiedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(media.buffer);
  }

  @Get(':id/pages/:pageId/content')
  async pageContent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('pageId') pageId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const media = await this.documents.getPageMedia(user.userId, id, pageId);
    response.set({
      'Content-Type': media.mimeType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline',
      'Last-Modified': media.modifiedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(media.buffer);
  }

  @Patch(':id/pages/order')
  reorderPages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('pageIds') pageIds?: unknown,
  ) {
    if (!Array.isArray(pageIds) || !pageIds.every((value) => typeof value === 'string')) {
      throw new BadRequestException('pageIds must be an array of page identifiers.');
    }
    return this.documents.reorderPages(user.userId, id, pageIds);
  }

  /** Re-run the embedding pipeline for a document (e.g. after a failure). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/retry-scan')
  @HttpCode(HttpStatus.ACCEPTED)
  retryScan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DocumentDetail> {
    return this.scan.retry(user.userId, id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/pages/:pageId/retry-ocr')
  @HttpCode(HttpStatus.ACCEPTED)
  retryScanPage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('pageId') pageId: string,
  ): Promise<DocumentDetail> {
    return this.scan.retryPage(user.userId, id, pageId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/retry-extraction')
  @HttpCode(HttpStatus.ACCEPTED)
  retryExtraction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DocumentDetail> {
    return this.documents.retryFileExtraction(user.userId, id);
  }

  /** Re-run the embedding pipeline only when extracted text already exists. */
  @Post(':id/reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  reindex(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DocumentDetail> {
    return this.documents.reindex(user.userId, id);
  }

  /** Delete a document. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.documents.remove(user.userId, id);
  }
}
