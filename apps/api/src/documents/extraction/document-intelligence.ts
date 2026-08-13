/**
 * Document Intelligence (Sprint 6.3) — the one prompt that turns a photographed
 * page, a whiteboard, handwritten notes or a scanned PDF into STRUCTURED, AI-
 * usable markdown. Shared by the image scanner and the scanned-PDF OCR fallback
 * so both extract the same rich structure: headings, tables, lists, formulas and
 * figure descriptions.
 */
export const DOCUMENT_INTELLIGENCE_PROMPT = [
  'The following pages are study material — a document, a scanned/photographed',
  'page, a whiteboard, or handwritten notes. Transcribe ALL the content you can',
  'read, in natural reading order, as clean GitHub-flavoured markdown, preserving',
  'the document structure:',
  '- Titles and section headings -> markdown headings (#, ##, ###) matching their level.',
  '- Tables -> markdown tables (| col | col |), keeping rows and columns aligned.',
  '- Bullet or numbered lists -> markdown lists (-, or 1.).',
  '- Mathematical formulas and equations -> LaTeX, inline as $...$ and display as $$...$$.',
  '- Diagrams, charts, photos or figures that carry meaning the text does not ->',
  '  a short description on its own line as "[figure: ...]".',
  'Keep the ORIGINAL language — never translate. Do not summarise, add, or invent',
  'anything: transcribe only what is actually present. Output ONLY the markdown',
  'transcription — no preamble, no commentary, no code fences around the whole',
  'output. If you genuinely cannot read any content, output nothing at all.',
].join('\n');
