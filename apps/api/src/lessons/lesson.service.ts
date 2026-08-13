import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type Lesson } from '@prisma/client';
import type {
  CardView,
  ExerciseType,
  LessonExercise,
  LessonSummary,
  LessonView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RetrievalService } from '../documents/retrieval/retrieval.service';
import { DocumentService } from '../documents/document.service';
import { CardGenerationService } from '../flashcards/card-generation.service';
import { toCardView } from '../flashcards/card.mapper';
import { ConceptService } from '../concepts/concept.service';
import { MasteryService } from '../concepts/mastery.service';
import { RevisionEngineService } from '../revision/revision-engine.service';
import type { GenerateLessonDto } from './dto/generate-lesson.dto';

const CONTEXT_LIMIT = 5;
const FLASHCARD_COUNT = 8;

const SYSTEM_PROMPT = [
  'You are a master teacher building a complete written lesson for a learner.',
  'Teach progressively, assuming no prior knowledge, building step by step.',
  'When context passages from the learner\'s own notes are provided, ground the',
  'lesson in them. Respond with ONLY a JSON object (no markdown, no code fences)',
  'with these string/array fields, forming a standard teaching flow:',
  '"objective" (what the learner will be able to do), "intro", "explanation"',
  '(the main teaching, may use markdown), "examples" (array of worked examples),',
  '"questions" (array of 3-5 guided, open-ended comprehension questions that make',
  'the learner think — NOT graded, distinct from the exercises), "exercises"',
  '(a MIX of 4-6 items, each {"type","question","answer","options"?}: include at',
  'least one "qcm" (multiple choice — give an "options" array of 3-4 choices and',
  'set "answer" to the exact text of the correct option), one or more "open"',
  '(short open-ended), one or more "exercise" (a concrete application to solve),',
  'and one "case" (a realistic practical scenario to reason through). For every',
  'item "answer" is the model answer used as the correction),',
  '"homework", "summary", "keyPoints" (array of 3-5 concise key takeaways — the',
  'essential points to remember, one short sentence each), "revisionSheet" (a',
  'condensed study sheet).',
].join(' ');

/**
 * Steering supplied by other services (not by API clients).
 *
 * Deliberately NOT part of GenerateLessonDto: `directive` is injected into the
 * system prompt, so exposing it on the public endpoint would hand callers a
 * prompt-steering knob for no product reason.
 */
export interface InternalLessonOptions {
  /** Language profile this lesson belongs to (language engine). */
  languageProfileId?: string;
  /** Extra teaching directive appended to the system prompt (e.g. the language
   *  mode's pedagogical contract). */
  directive?: string;
}

/** Structured lesson shape returned by the LLM. */
interface RawLesson {
  objective: string;
  intro: string;
  explanation: string;
  examples: string[];
  questions: string[];
  exercises: LessonExercise[];
  homework: string;
  summary: string;
  keyPoints: string[];
  revisionSheet: string;
}

/** Written-first learning engine: turns a topic/concept/session into a complete
 *  written lesson, indexes it into long-term memory, and spins up flashcards. */
@Injectable()
export class LessonService {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
    private readonly documents: DocumentService,
    private readonly cardGeneration: CardGenerationService,
    private readonly concepts: ConceptService,
    private readonly mastery: MasteryService,
    private readonly revision: RevisionEngineService,
  ) {}

  async generate(
    userId: string,
    dto: GenerateLessonDto,
    internal: InternalLessonOptions = {},
  ): Promise<LessonView> {
    const { topic, conceptId, tutorSessionId } = await this.resolveTopic(
      userId,
      dto,
    );

    // Ground the lesson in the learner's existing notes when available.
    const context = await this.retrieveContext(userId, topic);
    // "Difficulty auto-adapts — mastery down → simplify; mastery up → increase
    // complexity." An explicit level always wins; this only fills the gap.
    const level = dto.level ?? (await this.levelFromMastery(userId, conceptId));
    const raw = await this.generateLesson(
      topic,
      context,
      { ...dto, level },
      internal.directive,
    );

    const lesson = await this.prisma.lesson.create({
      data: {
        userId,
        tutorSessionId: tutorSessionId ?? null,
        conceptId: conceptId ?? null,
        languageProfileId: internal.languageProfileId ?? null,
        language: dto.language?.trim() || null,
        level: level ?? null,
        topic,
        objective: raw.objective,
        intro: raw.intro,
        explanation: raw.explanation,
        examples: raw.examples as unknown as Prisma.InputJsonValue,
        questions: raw.questions as unknown as Prisma.InputJsonValue,
        exercises: raw.exercises as unknown as Prisma.InputJsonValue,
        homework: raw.homework,
        summary: raw.summary,
        keyPoints: raw.keyPoints as unknown as Prisma.InputJsonValue,
        revisionSheet: raw.revisionSheet,
      },
    });

    // Index into long-term memory via the existing document pipeline (chunk+embed).
    const doc = await this.documents.createFromText(userId, {
      title: `Lesson — ${topic}`.slice(0, 300),
      content: this.assemblePlainText(topic, raw),
    });
    await this.prisma.lesson.update({
      where: { id: lesson.id },
      data: { sourceDocumentId: doc.id },
    });

    // Auto-generate flashcards for FSRS revision, and wire everything to the
    // concept when one is targeted. Best-effort: never fail the lesson over these.
    let cardCount = 0;
    if (dto.flashcards !== false) {
      cardCount = await this.spinUpFlashcards(userId, doc.id, conceptId);
    }
    if (conceptId) {
      await this.concepts
        .linkDocument(userId, conceptId, doc.id)
        .catch((e) => this.logger.warn(`link doc→concept failed: ${e.message}`));
    }

    // Register the lesson itself for spaced repetition — a course is a
    // reviewable activity, not just its flashcards (task 5.1).
    await this.revision.track(userId, 'lesson', lesson.id, `Lesson — ${topic}`.slice(0, 200));

    return this.toView({ ...lesson, sourceDocumentId: doc.id }, cardCount);
  }

  async list(userId: string): Promise<LessonSummary[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return lessons.map((l) => ({
      id: l.id,
      topic: l.topic,
      objective: l.objective,
      conceptId: l.conceptId,
      language: l.language,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async get(userId: string, id: string): Promise<LessonView> {
    const lesson = await this.requireOwned(userId, id);
    const cardCount = lesson.sourceDocumentId
      ? await this.prisma.card.count({
          where: { userId, sourceDocumentId: lesson.sourceDocumentId },
        })
      : 0;
    return this.toView(lesson, cardCount);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await this.prisma.lesson.delete({ where: { id } });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async resolveTopic(
    userId: string,
    dto: GenerateLessonDto,
  ): Promise<{ topic: string; conceptId?: string; tutorSessionId?: string }> {
    if (dto.topic?.trim()) {
      return {
        topic: dto.topic.trim(),
        conceptId: await this.validateConcept(userId, dto.conceptId),
        tutorSessionId: await this.validateSession(userId, dto.tutorSessionId),
      };
    }
    if (dto.conceptId) {
      const concept = await this.prisma.concept.findUnique({
        where: { id: dto.conceptId },
      });
      if (!concept || concept.userId !== userId) {
        throw new NotFoundException('Concept not found.');
      }
      return {
        topic: concept.name,
        conceptId: concept.id,
        tutorSessionId: await this.validateSession(userId, dto.tutorSessionId),
      };
    }
    if (dto.tutorSessionId) {
      const session = await this.prisma.tutorSession.findUnique({
        where: { id: dto.tutorSessionId },
      });
      if (!session || session.userId !== userId) {
        throw new NotFoundException('Tutor session not found.');
      }
      if (!session.title) {
        throw new BadRequestException(
          'That session has no topic yet — provide a topic explicitly.',
        );
      }
      return { topic: session.title, tutorSessionId: session.id };
    }
    throw new BadRequestException(
      'Provide a topic, conceptId, or tutorSessionId.',
    );
  }

  private async validateConcept(
    userId: string,
    conceptId?: string,
  ): Promise<string | undefined> {
    if (!conceptId) return undefined;
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
    });
    if (!concept || concept.userId !== userId) {
      throw new NotFoundException('Concept not found.');
    }
    return concept.id;
  }

  private async validateSession(
    userId: string,
    sessionId?: string,
  ): Promise<string | undefined> {
    if (!sessionId) return undefined;
    const session = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Tutor session not found.');
    }
    return session.id;
  }

  /**
   * Pitch a concept lesson at the learner's current grasp of it (spec: "Active +
   * adaptive"). Returns undefined when there is no concept or no evidence yet —
   * guessing a level from nothing would be worse than letting the model choose.
   */
  private async levelFromMastery(
    userId: string,
    conceptId?: string,
  ): Promise<GenerateLessonDto['level']> {
    if (!conceptId) return undefined;
    const m = await this.mastery
      .conceptMastery(userId, conceptId)
      .catch(() => null);
    if (!m || m.mastery === null || m.reviewedCount === 0) return undefined;
    if (m.level === 'strong') return 'advanced';
    if (m.level === 'developing') return 'intermediate';
    return 'beginner';
  }

  /**
   * Grounding is an enhancement, not a precondition: the lesson prompt already
   * handles an empty context. So a vector-store hiccup must degrade the lesson
   * to ungrounded, not destroy it — observed for real as a Qdrant
   * `Request Timeout` turning a whole lesson generation into a 500.
   */
  private async retrieveContext(userId: string, topic: string): Promise<string> {
    let results;
    try {
      ({ results } = await this.retrieval.search(userId, topic, {
        limit: CONTEXT_LIMIT,
      }));
    } catch (error) {
      this.logger.warn(
        `Grounding retrieval failed; generating an ungrounded lesson: ${
          (error as Error).message
        }`,
      );
      return '';
    }
    return results
      .map((r, i) => `[${i + 1}] (from "${r.documentTitle}")\n${r.content}`)
      .join('\n\n');
  }

  private async generateLesson(
    topic: string,
    context: string,
    dto: GenerateLessonDto,
    directive?: string,
  ): Promise<RawLesson> {
    const level = dto.level ? ` Pitch it at a ${dto.level} level.` : '';
    const language = dto.language
      ? ` This is a ${dto.language} language lesson; teach ${dto.language}.`
      : '';
    const system = directive ? `${SYSTEM_PROMPT} ${directive}` : SYSTEM_PROMPT;
    let text: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Create a complete written lesson on: "${topic}".${level}${language}` +
              (context ? `\n\nGround it in my notes where relevant:\n${context}` : ''),
          },
        ],
        { temperature: 0.4 },
      );
      text = result.text;
    } catch (error) {
      this.logger.error(`Lesson LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The teacher is temporarily unavailable. Please try again shortly.',
      );
    }
    return this.parseLesson(text);
  }

  private parseLesson(raw: string): RawLesson {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    let parsed: Record<string, unknown> = {};
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        parsed = {};
      }
    }
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const objective = str(parsed.objective);
    const explanation = str(parsed.explanation);
    if (!objective && !explanation) {
      throw new UnprocessableEntityException(
        'The teacher did not return a usable lesson. Try again.',
      );
    }
    const examples = Array.isArray(parsed.examples)
      ? parsed.examples.filter((e): e is string => typeof e === 'string')
      : [];
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
          .map((q) => q.trim())
      : [];
    const keyPoints = Array.isArray(parsed.keyPoints)
      ? parsed.keyPoints
          .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
          .map((p) => p.trim())
      : [];
    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises
          .filter(
            (e): e is LessonExercise =>
              !!e &&
              typeof (e as LessonExercise).question === 'string' &&
              typeof (e as LessonExercise).answer === 'string',
          )
          .map((e) => this.normalizeExercise(e))
      : [];
    return {
      objective,
      intro: str(parsed.intro),
      explanation,
      examples,
      questions,
      exercises,
      homework: str(parsed.homework),
      summary: str(parsed.summary),
      keyPoints,
      revisionSheet: str(parsed.revisionSheet),
    };
  }

  /** Keep only known exercise types and valid QCM options. */
  private normalizeExercise(e: LessonExercise): LessonExercise {
    const types: ExerciseType[] = ['qcm', 'open', 'exercise', 'case'];
    const type = types.includes(e.type as ExerciseType) ? e.type : 'exercise';
    const base: LessonExercise = {
      question: e.question,
      answer: e.answer,
      type,
    };
    if (type === 'qcm' && Array.isArray(e.options)) {
      const options = e.options.filter(
        (o): o is string => typeof o === 'string' && o.trim().length > 0,
      );
      // A QCM needs choices to be a QCM; otherwise it's just an exercise.
      if (options.length >= 2) return { ...base, options };
      return { ...base, type: 'exercise' };
    }
    return base;
  }

  private assemblePlainText(topic: string, l: RawLesson): string {
    const parts = [
      `# ${topic}`,
      `Objective: ${l.objective}`,
      l.intro,
      `## Explanation\n${l.explanation}`,
      l.examples.length ? `## Examples\n${l.examples.join('\n\n')}` : '',
      l.questions.length ? `## Questions\n${l.questions.join('\n')}` : '',
      l.keyPoints.length ? `## Key takeaways\n${l.keyPoints.map((p) => `- ${p}`).join('\n')}` : '',
      l.summary ? `## Summary\n${l.summary}` : '',
      l.revisionSheet ? `## Revision sheet\n${l.revisionSheet}` : '',
    ];
    return parts.filter(Boolean).join('\n\n');
  }

  private async spinUpFlashcards(
    userId: string,
    documentId: string,
    conceptId?: string,
  ): Promise<number> {
    try {
      const result = await this.cardGeneration.generateFromDocument(
        userId,
        documentId,
        { count: FLASHCARD_COUNT },
      );
      if (conceptId) {
        for (const card of result.cards) {
          await this.concepts
            .linkCard(userId, conceptId, card.id)
            .catch(() => undefined);
        }
      }
      return result.created;
    } catch (error) {
      this.logger.warn(
        `Flashcard generation for lesson failed: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /** The flashcards this lesson generated (standard-flow step 9). They are the
   *  cards created from the lesson's indexed document. */
  async flashcards(userId: string, lessonId: string): Promise<CardView[]> {
    const lesson = await this.requireOwned(userId, lessonId);
    if (!lesson.sourceDocumentId) return [];
    const cards = await this.prisma.card.findMany({
      where: { userId, sourceDocumentId: lesson.sourceDocumentId },
      orderBy: { createdAt: 'asc' },
    });
    return cards.map(toCardView);
  }

  private async requireOwned(userId: string, id: string): Promise<Lesson> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson || lesson.userId !== userId) {
      throw new NotFoundException('Lesson not found.');
    }
    return lesson;
  }

  private toView(lesson: Lesson, cardCount: number): LessonView {
    return {
      id: lesson.id,
      topic: lesson.topic,
      objective: lesson.objective,
      intro: lesson.intro,
      explanation: lesson.explanation,
      examples: (lesson.examples as unknown as string[]) ?? [],
      questions: (lesson.questions as unknown as string[]) ?? [],
      exercises: (lesson.exercises as unknown as LessonExercise[]) ?? [],
      homework: lesson.homework,
      summary: lesson.summary,
      keyPoints: (lesson.keyPoints as unknown as string[]) ?? [],
      revisionSheet: lesson.revisionSheet,
      conceptId: lesson.conceptId,
      tutorSessionId: lesson.tutorSessionId,
      language: lesson.language,
      languageProfileId: lesson.languageProfileId,
      level: (lesson.level as LessonView['level']) ?? null,
      sourceDocumentId: lesson.sourceDocumentId,
      cardCount,
      createdAt: lesson.createdAt.toISOString(),
    };
  }
}
