import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import sharp from 'sharp';
import {
  isIdentityScanQuadrilateral,
  warpPerspectiveRawInWorker,
  type ScanPageEdit,
} from './scan-page-transform';

export interface ImageUpload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface NormalizedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/webp';
  width: number;
  height: number;
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// BUSINESS_DECISION_REQUIRED: this provisional anti-decompression-bomb ceiling
// needs product/security ratification before production is declared final.
const MAX_INPUT_PIXELS = 40_000_000;
// BUSINESS_DECISION_REQUIRED: output size balances a crisp avatar with private
// storage and bandwidth. It is deliberately not exposed as a quota or plan rule.
const AVATAR_EDGE = 512;
// BUSINESS_DECISION_REQUIRED: enough detail for page OCR while bounding the
// decoded provider payload and base64 expansion.
const SCAN_MAX_EDGE = 2400;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

/** Decodes untrusted images before use. A declared multipart MIME type is never
 * considered proof: sharp must parse the bytes, enforce a pixel ceiling and
 * re-encode without EXIF/GPS metadata. */
@Injectable()
export class ImageSafetyService {
  async avatar(file: ImageUpload): Promise<NormalizedImage> {
    this.assertByteLimit(file);
    const image = await this.decode(file);
    try {
      const { data, info } = await image
        .rotate()
        .resize(AVATAR_EDGE, AVATAR_EDGE, { fit: 'cover', position: 'centre' })
        .webp({ quality: 84 })
        .toBuffer({ resolveWithObject: true });
      return { buffer: data, mimeType: 'image/webp', width: info.width, height: info.height };
    } catch {
      throw new BadRequestException('The avatar image could not be processed.');
    }
  }

  async scanPage(file: ImageUpload, edit?: ScanPageEdit): Promise<NormalizedImage> {
    this.assertByteLimit(file);
    const image = await this.decode(file);
    try {
      const prepared = image
        .rotate()
        .resize({
          width: SCAN_MAX_EDGE,
          height: SCAN_MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .toColourspace('srgb');

      if (!edit || isIdentityScanQuadrilateral(edit.corners)) {
        const { data, info } = await prepared
          .normalize()
          .sharpen()
          .jpeg({ quality: 90, mozjpeg: true })
          .toBuffer({ resolveWithObject: true });
        return { buffer: data, mimeType: 'image/jpeg', width: info.width, height: info.height };
      }

      // Arbitrary four-corner perspective is not an expo-image-manipulator or
      // libvips primitive. Decode once into a bounded raw page, inverse-map it
      // with the validated homography, then let sharp improve readability and
      // strip metadata during the final JPEG encode.
      const { data: raw, info: rawInfo } = await prepared
        .raw()
        .toBuffer({ resolveWithObject: true });
      const corrected = await warpPerspectiveRawInWorker({
        data: raw,
        width: rawInfo.width,
        height: rawInfo.height,
        channels: rawInfo.channels,
      }, edit.corners);
      const { data, info } = await sharp(corrected.data, {
        raw: {
          width: corrected.width,
          height: corrected.height,
          channels: corrected.channels as 1 | 2 | 3 | 4,
        },
        sequentialRead: true,
      })
        .normalize()
        .sharpen()
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      return { buffer: data, mimeType: 'image/jpeg', width: info.width, height: info.height };
    } catch {
      throw new BadRequestException('A scan page could not be processed.');
    }
  }

  private assertByteLimit(file: ImageUpload): void {
    if (!file.buffer?.length || file.size <= 0) {
      throw new BadRequestException('The image is empty.');
    }
    if (file.buffer.length > MAX_UPLOAD_BYTES || file.size > MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException('The image exceeds the existing 10 MB upload limit.');
    }
  }

  private async decode(file: ImageUpload): Promise<sharp.Sharp> {
    try {
      const image = sharp(file.buffer, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
        sequentialRead: true,
      });
      const metadata = await image.metadata();
      if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
        throw new UnsupportedMediaTypeException('Only JPEG, PNG, WebP and HEIF images are accepted.');
      }
      if (!metadata.width || !metadata.height) {
        throw new BadRequestException('The image dimensions are invalid.');
      }
      return image;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof UnsupportedMediaTypeException) throw error;
      throw new BadRequestException('The uploaded bytes are not a valid supported image.');
    }
  }
}
