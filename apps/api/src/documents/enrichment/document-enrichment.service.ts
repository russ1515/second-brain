import { Injectable, Logger } from '@nestjs/common';
import type { DocumentDifficulty } from '@second-brain/shared';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Only the first slice of a document is sent for enrichment — enough to judge
 *  subject/language/difficulty and write a summary without a huge prompt. */
const MAX_CONTENT_CHARS = 6000;

const DIFFICULTIES: DocumentDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
];

const SYSTEM_PROMPT = [
  'You analyse a study document and return metadata about it.',
  'Return ONLY a JSON object (no markdown, no code fences, no commentary) with:',
  '"summary" (2-3 sentences, in the SAME language as the document, capturing what',
  'it teaches), "subject" (a short academic subject in English, e.g. "Biology",',
  '"Linear Algebra", "History"), "language" (the English name of the language the',
  'document is written in, e.g. "English", "French"), "author" (the author\'s name',
  'if the text clearly identifies one, else null — never guess), and "difficulty"',
  '(one of "beginner", "intermediate", "advanced" for the level of a learner who',
  'could follow it).',
].join(' ');

interface RawEnrichment {
  summary?: unknown;
  subject?: unknown;
  language?: unknown;
  author?: unknown;
  difficulty?: unknown;
}

interface Enrichment {
  summary: string | null;
  subject: string | null;
  language: string | null;
  author: string | null;
  difficulty: DocumentDifficulty | null;
}

/**
 * Derives the Smart Library's automatic metadata for a document via the LLM
 * seam: a one-paragraph summary, subject, language, author (only when named),
 * and difficulty. Best-effort — a failure records nothing and never disturbs
 * ingestion; the fields simply stay null and the document reads "not enriched".
 */
@Injectable()
export class DocumentEnrichmentService {
  private readonly logger = new Logger(DocumentEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** Enrich one document. Never throws. */
  async enrich(documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, content: true },
    });
    if (!doc || !doc.content.trim()) return;

    let enrichment: Enrichment | null = null;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `Analyse this document (titled "${doc.title}"):\n\n` +
              doc.content.slice(0, MAX_CONTENT_CHARS),
          },
        ],
        { temperature: 0.2 },
      );
      enrichment = this.parse(result.text);
    } catch (error) {
      this.logger.warn(
        `Enrichment LLM call failed for ${documentId}: ${(error as Error).message}`,
      );
      return;
    }
    if (!enrichment) {
      this.logger.warn(`Enrichment returned nothing usable for ${documentId}.`);
      return;
    }

    await this.prisma.document
      .update({
        where: { id: documentId },
        data: { ...enrichment, enrichedAt: new Date() },
      })
      .catch((error) => {
        this.logger.warn(
          `Could not persist enrichment for ${documentId}: ${(error as Error).message}`,
        );
      });
  }

  // ── internals ──────────────────────────────────────────────────────────

  private parse(raw: string): Enrichment | null {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    let parsed: RawEnrichment;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1)) as RawEnrichment;
    } catch {
      return null;
    }

    return {
      summary: this.str(parsed.summary, 2000),
      subject: this.str(parsed.subject, 120),
      language: this.str(parsed.language, 60),
      author: this.str(parsed.author, 200),
      difficulty: this.difficulty(parsed.difficulty),
    };
  }

  /** Trim to a clean string, or null. Rejects the model's stringy "null"/"unknown". */
  private str(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(null|none|unknown|n\/a|unspecified)$/i.test(trimmed)) return null;
    return trimmed.slice(0, max);
  }

  private difficulty(value: unknown): DocumentDifficulty | null {
    if (typeof value !== 'string') return null;
    const lower = value.trim().toLowerCase();
    return DIFFICULTIES.find((d) => d === lower) ?? null;
  }
}
