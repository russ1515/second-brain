import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Document } from '@prisma/client';
import type {
  StudyResource,
  StudyResourceType,
} from '@second-brain/shared';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CardGenerationService } from '../../flashcards/card-generation.service';

const MAX_CONTENT_CHARS = 8000;
/** How many flashcards to generate for a flashcards resource. */
const FLASHCARD_COUNT = 10;

/** The LLM task per (text) resource type. Flashcards are handled separately. */
const RESOURCE_TASK: Record<Exclude<StudyResourceType, 'flashcards'>, string> = {
  summary:
    'Write a clear, structured summary of the document capturing its key points, as markdown.',
  revision_sheet:
    'Create a concise revision sheet (fiche de révision): key definitions, formulas and must-remember points, as markdown bullet lists and small tables.',
  quiz:
    'Create a quiz of 6 multiple-choice questions, each with 4 options (A–D) and the correct answer marked, as markdown.',
  exercises:
    'Create 5 practice exercises of increasing difficulty, each followed by a short worked solution, as markdown.',
  open_questions:
    'Create 6 open-ended reflection questions that test deep understanding of the material. Do NOT provide answers.',
  course_plan:
    'Create a structured course plan / lesson outline to learn this material: numbered sections with sub-points and a one-line objective each, as markdown.',
};

/** Human title prefix per type (English; the body follows the doc's language). */
const TITLE: Record<StudyResourceType, string> = {
  summary: 'Summary',
  revision_sheet: 'Revision sheet',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  exercises: 'Exercises',
  open_questions: 'Open questions',
  course_plan: 'Course plan',
};

/**
 * AI Study Resources Generator (Sprint 6.6) — turns a document into study
 * resources (summary, revision sheet, flashcards, quiz, exercises, open
 * questions, course plan) and SAVES them. Text resources are LLM-generated
 * markdown persisted as `StudyResource`; flashcards reuse the existing
 * CardGenerationService (real FSRS cards) with a StudyResource pointer.
 */
@Injectable()
export class StudyResourceService {
  private readonly logger = new Logger(StudyResourceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly cards: CardGenerationService,
  ) {}

  async generate(
    userId: string,
    documentId: string,
    type: StudyResourceType,
  ): Promise<StudyResource> {
    const doc = await this.own(userId, documentId);

    if (type === 'flashcards') {
      return this.generateFlashcards(userId, doc);
    }

    const system = [
      'You are Second Brain, an AI teacher creating study material from a document.',
      RESOURCE_TASK[type],
      'Base everything ONLY on the document — do not invent facts. Respond in the',
      "SAME language as the document. Output only the resource as clean markdown.",
    ].join(' ');

    let body: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Document titled "${doc.title}":\n\n${doc.content.slice(0, MAX_CONTENT_CHARS)}`,
          },
        ],
        { temperature: 0.3 },
      );
      body = result.text.trim();
    } catch (error) {
      this.logger.error(`Resource LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }

    return this.persist(userId, doc, type, body, null);
  }

  async list(userId: string, documentId: string): Promise<StudyResource[]> {
    await this.own(userId, documentId);
    const rows = await this.prisma.studyResource.findMany({
      where: { userId, documentId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async get(userId: string, id: string): Promise<StudyResource> {
    const row = await this.prisma.studyResource.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Resource not found.');
    }
    return this.toView(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.prisma.studyResource.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Resource not found.');
    }
    await this.prisma.studyResource.delete({ where: { id } });
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async generateFlashcards(
    userId: string,
    doc: Document,
  ): Promise<StudyResource> {
    const result = await this.cards.generateFromDocument(userId, doc.id, {
      count: FLASHCARD_COUNT,
    });
    const note = `${result.created} flashcard${result.created === 1 ? '' : 's'} generated from "${doc.title}". Review them in the FSRS queue.`;
    return this.persist(userId, doc, 'flashcards', note, result.deckId);
  }

  private async persist(
    userId: string,
    doc: Document,
    type: StudyResourceType,
    content: string,
    deckId: string | null,
  ): Promise<StudyResource> {
    const row = await this.prisma.studyResource.create({
      data: {
        userId,
        documentId: doc.id,
        type,
        title: `${TITLE[type]} — ${doc.title}`.slice(0, 300),
        content,
        deckId,
      },
    });
    return this.toView(row);
  }

  private async own(userId: string, id: string): Promise<Document> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    return doc;
  }

  private toView(row: {
    id: string;
    documentId: string;
    type: string;
    title: string;
    content: string;
    deckId: string | null;
    createdAt: Date;
  }): StudyResource {
    return {
      id: row.id,
      documentId: row.documentId,
      type: row.type as StudyResourceType,
      title: row.title,
      content: row.content,
      deckId: row.deckId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
