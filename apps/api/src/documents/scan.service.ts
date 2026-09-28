import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { DocumentDetail, LLMImagePart } from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { DocumentService } from './document.service';
import { DOCUMENT_INTELLIGENCE_PROMPT } from './extraction/document-intelligence';
import type { UploadedFileLike } from './extraction/text-extraction.service';
import { ImageSafetyService } from '../media/image-safety.service';
import { PrivateMediaService } from '../media/private-media.service';
import { randomUUID } from 'node:crypto';
import type { ScanPageEdit } from '../media/scan-page-transform';

const MAX_IMAGES = 8;
const MIN_TEXT_CHARS = 20;
const STALE_SCAN_MS = 5 * 60_000;

/**
 * Turning a photo of a page into a real document.
 *
 * No OCR engine: the LLM seam is multimodal, so a scan is just another way to
 * get text, and once extracted it goes through the SAME `createFromText`
 * pipeline as everything else — chunked, embedded, searchable, and usable as
 * lesson grounding. Nothing downstream knows a camera was involved.
 */
@Injectable()
export class ScanService {
  private readonly logger = new Logger(ScanService.name);
  /** Coalesce simultaneous HTTP retries in this API replica. The durable
   * sourceRef lookup below also covers a retry after a successful response was
   * lost or after the process restarted. */
  private readonly inFlight = new Map<string, Promise<DocumentDetail>>();

  constructor(
    private readonly llm: LlmService,
    private readonly documents: DocumentService,
    private readonly imageSafety: ImageSafetyService,
    private readonly privateMedia: PrivateMediaService,
  ) {}

  async fromImages(
    userId: string,
    files: UploadedFileLike[],
    title?: string,
    requestId?: string,
    pageEdits?: ScanPageEdit[],
  ): Promise<DocumentDetail> {
    this.assertFiles(files, pageEdits);
    const operationId = requestId?.trim() || randomUUID();
    const sourceRef = `scan:${operationId}`;
    const key = `${userId}:${operationId}`;
    const active = this.inFlight.get(key);
    if (active) return active;

    const pending = this.processIdempotent(userId, files, title, sourceRef, pageEdits)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }

  /** Retry OCR from the already persisted private pages. This is called only by
   * the authenticated, explicit retry route; it never runs in the background.
   * Reindex is intentionally not involved because failed OCR has no text yet. */
  async retry(userId: string, documentId: string): Promise<DocumentDetail> {
    const key = `${userId}:retry:${documentId}`;
    const active = this.inFlight.get(key);
    if (active) return active;
    const pending = this.retryPersisted(userId, documentId)
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }

  private async retryPersisted(
    userId: string,
    documentId: string,
  ): Promise<DocumentDetail> {
    let existing = await this.documents.get(userId, documentId);
    if (
      !existing.sourceRef?.startsWith('scan:') ||
      existing.charCount > 0 ||
      existing.content.trim().length > 0
    ) {
      throw new BadRequestException({
        code: 'SCAN_OCR_RETRY_NOT_APPLICABLE',
        message: 'This document is not a failed OCR scan.',
      });
    }
    if (existing.status === 'processing') {
      const updatedAt = Date.parse(existing.updatedAt);
      const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_SCAN_MS;
      if (!stale) {
        throw new ConflictException({
          code: 'SCAN_IN_PROGRESS',
          message: 'This scan is still processing.',
          documentId,
        });
      }
      const recovered = await this.documents.failStaleScanReading(
        userId,
        documentId,
        new Date(Date.now() - STALE_SCAN_MS),
      );
      existing = await this.documents.get(userId, documentId);
      if (!recovered) return this.resolveExisting(userId, existing);
    }
    if (existing.status !== 'failed' && existing.status !== 'pending') {
      throw new ConflictException({
        code: 'SCAN_OCR_RETRY_NOT_READY',
        message: 'This scan is not ready for an OCR retry.',
        documentId,
      });
    }
    if (!this.llm.supportsVision) {
      throw new ServiceUnavailableException({
        code: 'SCAN_OCR_UNAVAILABLE',
        message: 'Scan reading is not available. The saved pages were preserved.',
      });
    }

    // Read first, then atomically claim. Cross-replica contenders may both read
    // private bytes, but only the updateMany winner is allowed to call Vision.
    const pages = await this.privateMedia.getScanPages(userId, documentId);
    const reading = await this.documents.startScanRetry(userId, documentId);
    if (!reading.started) return this.resolveExisting(userId, reading.document);
    try {
      const text = await this.readText(pages.map((buffer) => ({
        mimeType: 'image/jpeg',
        data: buffer.toString('base64'),
      })));
      return await this.documents.completeScan(userId, documentId, {
        title: (existing.title.trim() || this.deriveTitle(text)).slice(0, 300),
        content: text,
      });
    } catch (error) {
      await this.documents.failScan(userId, documentId).catch(() => undefined);
      throw this.publicError(error);
    }
  }

  private async processIdempotent(
    userId: string,
    files: UploadedFileLike[],
    title: string | undefined,
    sourceRef: string,
    pageEdits: ScanPageEdit[] | undefined,
  ): Promise<DocumentDetail> {
    const existing = await this.documents.findBySourceRef(userId, sourceRef);
    if (existing) {
      if (existing.status !== 'pending') return this.resolveExisting(userId, existing);
      // Never OCR the newly submitted retry bytes against the already durable
      // document shell. They may be different pages. The persisted capture is
      // authoritative, so a retry always rereads those exact normalized pages.
      if (!this.llm.supportsVision) return existing;
      const persistedPages = await this.privateMedia.getScanPages(userId, existing.id);
      const reading = await this.documents.startScanReading(userId, existing.id);
      if (!reading.started) return this.resolveExisting(userId, reading.document);
      try {
        const text = await this.readText(persistedPages.map((buffer) => ({
          mimeType: 'image/jpeg',
          data: buffer.toString('base64'),
        })));
        return await this.documents.completeScan(userId, existing.id, {
          title: (existing.title.trim() || this.deriveTitle(text)).slice(0, 300),
          content: text,
        });
      } catch (error) {
        await this.documents.failScan(userId, existing.id).catch(() => undefined);
        throw this.publicError(error);
      }
    }

    // Validate and normalize before creating a durable shell: invalid local
    // bytes have not consumed provider quota and can safely be corrected.
    const images = await this.normalize(files, pageEdits);
    const captureTitle = title?.trim() || this.captureTitle(files);
    const started = await this.documents.beginScan(userId, captureTitle, sourceRef);
    if (!started.created) return this.resolveExisting(userId, started.document);
    let capturedDocument = started.document;
    if (started.created) {
      try {
        await this.privateMedia.putScanPages(
          userId,
          started.document.id,
          images.map((image) => image.buffer),
        );
      } catch (error) {
        await this.documents.failScan(userId, started.document.id).catch(() => undefined);
        throw this.publicError(error);
      }
      capturedDocument = await this.documents.markScanCaptured(userId, started.document.id);
    }
    // Capture is a durable, useful operation by itself. Echo or any provider
    // without Vision leaves it honestly queued instead of discarding the pages
    // or attempting a paid fallback.
    if (!this.llm.supportsVision) return capturedDocument;

    const reading = await this.documents.startScanReading(userId, capturedDocument.id);
    if (!reading.started) return this.resolveExisting(userId, reading.document);
    try {
      const text = await this.readText(images.map(({ mimeType, data }) => ({ mimeType, data })));
      return await this.documents.completeScan(userId, started.document.id, {
        title: (title?.trim() || this.deriveTitle(text)).slice(0, 300),
        content: text,
      });
    } catch (error) {
      await this.documents.failScan(userId, started.document.id).catch(() => undefined);
      throw this.publicError(error);
    }
  }

  private async resolveExisting(
    userId: string,
    existing: DocumentDetail,
  ): Promise<DocumentDetail> {
    // Once OCR text is durably stored, the scan operation succeeded. The
    // downstream ingestion pipeline is allowed to move the same document back
    // through `processing` (or even `failed`) independently; a lost-response
    // retry must return that document and must never mark it as a failed scan.
    if (existing.charCount > 0 && existing.content.trim().length > 0) {
      return existing;
    }
    if (existing.status === 'failed') {
      throw new ConflictException({
        code: 'SCAN_ATTEMPT_FAILED',
        message: 'This scan attempt ended. Start a new attempt to retry safely.',
        documentId: existing.id,
      });
    }
    if (existing.status === 'processing') {
      const updatedAt = Date.parse(existing.updatedAt);
      const stale = Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_SCAN_MS;
      if (stale) {
        await this.documents.failStaleScanReading(
          userId,
          existing.id,
          new Date(Date.now() - STALE_SCAN_MS),
        );
        throw new ConflictException({
          code: 'SCAN_ATTEMPT_FAILED',
          message: 'The interrupted scan was closed. Retry reading the saved pages.',
          documentId: existing.id,
        });
      }
      throw new ConflictException({
        code: 'SCAN_IN_PROGRESS',
        message: 'This scan is still processing.',
        documentId: existing.id,
      });
    }
    return existing;
  }

  private assertFiles(files: UploadedFileLike[], pageEdits?: ScanPageEdit[]): void {
    if (files.length === 0) {
      throw new BadRequestException('No images were uploaded (field "images").');
    }
    if (files.length > MAX_IMAGES) {
      throw new BadRequestException(
        `Too many images (${files.length}); ${MAX_IMAGES} pages at a time is the limit.`,
      );
    }
    if (pageEdits && pageEdits.length !== files.length) {
      throw new BadRequestException('Scan page edits must match the uploaded page count.');
    }
  }

  private async normalize(
    files: UploadedFileLike[],
    pageEdits?: ScanPageEdit[],
  ): Promise<Array<LLMImagePart & { buffer: Buffer }>> {
    // Decode and re-encode every page. This validates the actual bytes instead
    // of trusting multipart MIME. Sequential work bounds decoded memory when a
    // scan contains several high-resolution pages.
    const images: Array<LLMImagePart & { buffer: Buffer }> = [];
    for (let index = 0; index < files.length; index += 1) {
      const image = await this.imageSafety.scanPage(files[index], pageEdits?.[index]);
      images.push({
        mimeType: image.mimeType,
        data: image.buffer.toString('base64'),
        buffer: image.buffer,
      });
    }
    return images;
  }

  private async readText(images: LLMImagePart[]): Promise<string> {
    try {
      // Transcription, not invention: keep it as deterministic as the model allows.
      const result = await this.llm.readImages(images, DOCUMENT_INTELLIGENCE_PROMPT, {
        temperature: 0,
        operation: 'vision',
      });
      const text = result.text.trim();
      // A blurry photo must say so, not silently file an empty document that
      // then pollutes retrieval.
      if (text.length < MIN_TEXT_CHARS) {
        throw new UnprocessableEntityException(
          'No readable text was found in that image. Try a sharper, better-lit photo.',
        );
      }
      return text;
    } catch (error) {
      this.logger.error('Document scan failed.');
      throw this.publicError(error);
    }
  }

  private publicError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    return new ServiceUnavailableException(
      'Could not read that image. Please try again shortly.',
    );
  }

  /** Name it after its first heading/line so the library is browsable. */
  private deriveTitle(text: string): string {
    const first = text
      .split('\n')
      .map((line) => line.replace(/^#+\s*/, '').trim())
      .find((line) => line.length > 0);
    return first?.slice(0, 100) || new Date().toISOString().slice(0, 16).replace('T', ' ');
  }

  private captureTitle(files: UploadedFileLike[]): string {
    const original = files[0]?.originalname?.trim();
    return (original?.replace(/\.[^.]+$/, '') || new Date().toISOString().slice(0, 16).replace('T', ' '))
      .slice(0, 300);
  }
}
