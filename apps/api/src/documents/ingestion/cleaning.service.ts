import { Injectable } from '@nestjs/common';

/** Control chars to strip (all except \t=9 and \n=10), zero-width chars and BOM.
 *  Built from code points so the source stays plain ASCII (no invisible chars). */
const STRIP = new RegExp(
  '[' +
    '\\u0000-\\u0008' + // C0 controls before \t
    '\\u000B\\u000C' + // vertical tab, form feed (keep \n between them)
    '\\u000E-\\u001F' + // remaining C0 controls
    '\\u007F' + // DEL
    '\\u200B-\\u200D' + // zero-width space / non-joiner / joiner
    '\\uFEFF' + // byte-order mark
    ']',
  'g',
);

/**
 * Nettoyage (Sprint 6.2) - normalises raw extracted / OCR'd text before it is
 * segmented and embedded. Conservative on purpose: it fixes the artefacts that
 * hurt chunking and retrieval (control chars, PDF line-break hyphenation, ragged
 * whitespace) without rewriting the author's words.
 */
@Injectable()
export class CleaningService {
  clean(raw: string): string {
    let text = raw;

    // Normalise line endings.
    text = text.replace(/\r\n?/g, '\n');

    // Strip control / zero-width chars and the BOM.
    text = text.replace(STRIP, '');

    // Re-join words split across a line break by a hyphen ("photosyn-\nthesis").
    text = text.replace(/(\p{L})-\n(\p{L})/gu, '$1$2');

    // A single newline inside a paragraph (soft wrap) -> a space; blank lines
    // (paragraph breaks) are preserved.
    text = text.replace(/([^\n])\n([^\n])/g, '$1 $2');

    // Collapse runs of spaces/tabs, and 3+ blank lines down to one blank line.
    text = text.replace(/[ \t]{2,}/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim trailing spaces on each line, and the whole thing.
    text = text.replace(/[ \t]+\n/g, '\n').trim();

    return text;
  }
}
