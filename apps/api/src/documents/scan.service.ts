import {
  BadRequestException,
  Injectable,
  Logger,
  NotImplementedException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { DocumentDetail, LLMImagePart } from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { DocumentService } from './document.service';
import { DOCUMENT_INTELLIGENCE_PROMPT } from './extraction/document-intelligence';
import type { UploadedFileLike } from './extraction/text-extraction.service';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_IMAGES = 8;
const MIN_TEXT_CHARS = 20;

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

  constructor(
    private readonly llm: LlmService,
    private readonly documents: DocumentService,
  ) {}

  async fromImages(
    userId: string,
    files: UploadedFileLike[],
    title?: string,
  ): Promise<DocumentDetail> {
    if (!this.llm.supportsVision) {
      throw new NotImplementedException(
        `The active LLM provider ("${this.llm.activeProvider}") cannot read images.`,
      );
    }
    if (files.length === 0) {
      throw new BadRequestException('No images were uploaded (field "images").');
    }
    if (files.length > MAX_IMAGES) {
      throw new BadRequestException(
        `Too many images (${files.length}); ${MAX_IMAGES} pages at a time is the limit.`,
      );
    }

    const images: LLMImagePart[] = files.map((file) => {
      const mimeType = (file.mimetype || '').toLowerCase();
      if (!ACCEPTED.includes(mimeType)) {
        throw new BadRequestException(
          `"${file.originalname}" is ${mimeType || 'of unknown type'}; accepted: ${ACCEPTED.join(', ')}.`,
        );
      }
      return { mimeType, data: file.buffer.toString('base64') };
    });

    let text: string;
    try {
      // Transcription, not invention: keep it as deterministic as the model allows.
      const result = await this.llm.readImages(images, DOCUMENT_INTELLIGENCE_PROMPT, {
        temperature: 0,
      });
      text = result.text.trim();
    } catch (error) {
      this.logger.error(`Scan failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not read that image. Please try again shortly.',
      );
    }

    // A blurry photo must say so, not silently file an empty document that then
    // pollutes retrieval.
    if (text.length < MIN_TEXT_CHARS) {
      throw new UnprocessableEntityException(
        'No readable text was found in that image. Try a sharper, better-lit photo.',
      );
    }

    return this.documents.createFromText(userId, {
      title: (title?.trim() || this.deriveTitle(text)).slice(0, 300),
      content: text,
    });
  }

  /** Name it after its first heading/line so the library is browsable. */
  private deriveTitle(text: string): string {
    const first = text
      .split('\n')
      .map((line) => line.replace(/^#+\s*/, '').trim())
      .find((line) => line.length > 0);
    return first ? `Scan — ${first.slice(0, 80)}` : 'Scanned notes';
  }
}
