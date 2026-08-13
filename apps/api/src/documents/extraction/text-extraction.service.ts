import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { extractFromHtml } from '@extractus/article-extractor';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { LlmService } from '../../llm/llm.service';
import { assertPublicHttpUrl } from './url-safety';
import { DOCUMENT_INTELLIGENCE_PROMPT } from './document-intelligence';

/** A file received via multipart upload (structural — avoids @types/multer). */
export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Result of extracting plain text from a source. */
export interface ExtractedText {
  text: string;
  /** A title derived from the source, when one is available. */
  title?: string;
}

const MAX_FETCH_BYTES = 5 * 1024 * 1024; // 5 MB
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'SecondBrainBot/0.1 (+https://secondbrain.local)';
/** Below this many characters of real text per page, a PDF is treated as scanned
 *  (image-only, no usable text layer) and sent through vision OCR instead. */
const MIN_PDF_CHARS_PER_PAGE = 100;

/** Turns uploaded files and web pages into plain text for ingestion. */
@Injectable()
export class TextExtractionService {
  private readonly logger = new Logger(TextExtractionService.name);

  constructor(private readonly llm: LlmService) {}

  /** Extract text from an uploaded PDF, .txt or .md file. */
  async extractFromFile(file: UploadedFileLike): Promise<ExtractedText> {
    const name = file.originalname.toLowerCase();
    const title = this.stripExtension(file.originalname);
    const isPdf = file.mimetype === 'application/pdf' || name.endsWith('.pdf');
    if (isPdf) {
      let parsed;
      try {
        parsed = await pdfParse(file.buffer);
      } catch (error) {
        // A corrupt/unreadable PDF is a client error, not a 500.
        throw new BadRequestException(
          `Could not read the PDF: ${(error as Error).message}`,
        );
      }
      const text = parsed.text.trim();
      const pages = parsed.numpages || 1;

      // A scanned PDF has (almost) no text layer — OCR it with the vision model
      // instead of filing an empty document. Best-effort: if OCR is unavailable
      // or returns less than pdf-parse did, keep the parsed text.
      if (text.length < pages * MIN_PDF_CHARS_PER_PAGE && this.llm.supportsVision) {
        const ocr = await this.ocrPdf(file.buffer, pages);
        if (ocr && ocr.length > text.length) {
          this.logger.log(
            `OCR'd scanned PDF "${file.originalname}" (${pages}p): ${text.length} -> ${ocr.length} chars.`,
          );
          return { text: ocr, title };
        }
      }
      return { text, title };
    }

    const isText =
      file.mimetype.startsWith('text/') ||
      /\.(txt|md|markdown)$/.test(name);
    if (isText) {
      return {
        text: file.buffer.toString('utf8').trim(),
        title: this.stripExtension(file.originalname),
      };
    }

    throw new UnsupportedMediaTypeException(
      'Only PDF, .txt and .md files are supported.',
    );
  }

  /** Fetch a web page (SSRF-guarded) and extract its main article text. */
  async extractFromUrl(rawUrl: string): Promise<ExtractedText> {
    const { finalUrl, contentType, body } = await this.fetchBounded(rawUrl);

    if (contentType.includes('text/html') || contentType === '') {
      try {
        const article = await extractFromHtml(body, finalUrl);
        const text = article?.content ? this.htmlToText(article.content) : '';
        if (text.trim().length > 0) {
          return { text, title: article?.title ?? undefined };
        }
      } catch (error) {
        this.logger.warn(
          `article-extractor failed for ${finalUrl}: ${(error as Error).message}`,
        );
      }
      // Fallback: strip tags from the raw HTML.
      const text = this.htmlToText(body);
      if (!text.trim()) {
        throw new BadRequestException('No readable content found at that URL.');
      }
      return { text };
    }

    if (contentType.startsWith('text/')) {
      return { text: body.trim() };
    }

    throw new UnsupportedMediaTypeException(
      'The URL did not return an HTML or text document.',
    );
  }

  // ── internals ──────────────────────────────────────────────────────────

  /** OCR a scanned (image-only) PDF via the vision model. Gemini reads a PDF as
   *  inline document data — the same path images take — so no separate OCR engine
   *  or page-rasterizer is needed. Never throws: returns null on any failure. */
  private async ocrPdf(buffer: Buffer, pages: number): Promise<string | null> {
    try {
      const result = await this.llm.readImages(
        [{ mimeType: 'application/pdf', data: buffer.toString('base64') }],
        DOCUMENT_INTELLIGENCE_PROMPT,
        { temperature: 0, maxOutputTokens: 8192 },
      );
      return result.text.trim() || null;
    } catch (error) {
      this.logger.warn(
        `PDF OCR failed (${pages}p): ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Fetch with SSRF re-validation on every hop, a byte cap and a timeout. */
  private async fetchBounded(
    startUrl: string,
  ): Promise<{ finalUrl: string; contentType: string; body: string }> {
    let current = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      await assertPublicHttpUrl(current);

      const res = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain,*/*' },
      }).catch((error: Error) => {
        throw new BadRequestException(`Could not fetch the URL: ${error.message}`);
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) {
          throw new BadRequestException('Redirect without a location.');
        }
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) {
        throw new BadRequestException(`The URL returned HTTP ${res.status}.`);
      }

      const declaredLength = Number(res.headers.get('content-length') ?? '0');
      if (declaredLength > MAX_FETCH_BYTES) {
        throw new PayloadTooLargeException('Remote document is too large.');
      }
      const body = await this.readCapped(res);
      return {
        finalUrl: current,
        contentType: (res.headers.get('content-type') ?? '').toLowerCase(),
        body,
      };
    }
    throw new BadRequestException('Too many redirects.');
  }

  /** Read a response body, aborting if it exceeds the byte cap. */
  private async readCapped(res: Response): Promise<string> {
    const reader = res.body?.getReader();
    if (!reader) {
      return res.text();
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FETCH_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeException('Remote document is too large.');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  /** Collapse HTML to readable plain text (tags removed, entities decoded). */
  private htmlToText(html: string): string {
    return html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|h[1-6]|li|br|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private stripExtension(filename: string): string {
    return filename.replace(/\.[^./\\]+$/, '');
  }
}
