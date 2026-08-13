import { Injectable } from '@nestjs/common';

const CHUNK_SIZE = 1000; // target characters per chunk
const CHUNK_OVERLAP = 150; // characters shared with the previous chunk

/** Splits document text into overlapping, word-boundary-aligned chunks for
 *  embedding. Overlap preserves context that would otherwise be cut mid-idea. */
@Injectable()
export class ChunkingService {
  chunk(
    text: string,
    { size = CHUNK_SIZE, overlap = CHUNK_OVERLAP } = {},
  ): string[] {
    const clean = text.replace(/\r\n/g, '\n').trim();
    if (clean.length === 0) {
      return [];
    }
    if (clean.length <= size) {
      return [clean];
    }

    const chunks: string[] = [];
    let start = 0;
    while (start < clean.length) {
      let end = Math.min(start + size, clean.length);
      if (end < clean.length) {
        // Back off to the nearest whitespace so we don't cut a word in half,
        // but only if that keeps at least half a chunk.
        const breakAt = Math.max(
          clean.lastIndexOf(' ', end),
          clean.lastIndexOf('\n', end),
        );
        if (breakAt > start + size / 2) {
          end = breakAt;
        }
      }
      const piece = clean.slice(start, end).trim();
      if (piece.length > 0) {
        chunks.push(piece);
      }
      if (end >= clean.length) {
        break;
      }
      start = Math.max(end - overlap, start + 1);
    }
    return chunks;
  }
}
