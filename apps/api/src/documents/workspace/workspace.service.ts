import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Document } from '@prisma/client';
import type {
  DocumentDifficulty,
  LearnerLevel,
  WorkAnalysis,
  WorkspaceMessage,
  WorkspaceMode,
} from '@second-brain/shared';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MasteryService } from '../../concepts/mastery.service';

const MAX_CONTENT_CHARS = 8000;
const MAX_HISTORY = 16;
const DIFFICULTIES: DocumentDifficulty[] = ['beginner', 'intermediate', 'advanced'];

const ANALYSIS_PROMPT = [
  'You are Second Brain, an AI teacher analysing a piece of academic work (an',
  'assignment, lab, essay, problem set, case study, exam paper, etc.).',
  'Return ONLY a JSON object (no markdown, no code fences) with these keys:',
  '"objectives" (string[]), "skillsEvaluated" (string[]), "knowledgeMobilized"',
  '(string[]), "prerequisites" (string[]), "difficulty" ("beginner"|',
  '"intermediate"|"advanced"), "successCriteria" (string[]), "keyNotions"',
  '(string[]), and "likelyDifficult" (array of {"concept","reason"}).',
  'For "likelyDifficult", use the learner profile provided to flag the concepts',
  'THIS learner will most likely struggle with, and say why. Keep each string',
  'short. Base everything on the document; write in the document\'s language.',
].join(' ');

/** Mode → the teacher's stance. */
const MODE_STANCE: Record<WorkspaceMode, string> = {
  guide: [
    'MODE: PEDAGOGICAL GUIDANCE. Your goal is the student\'s autonomy and deep',
    'understanding. Do NOT give the full solution. Explain and reformulate the',
    'instructions, identify the key notions, recall the prerequisites, break the',
    'work into logical steps, and guide the student\'s reasoning by asking',
    'questions that check their understanding. Help them build the solution',
    'THEMSELVES — nudge, do not do it for them.',
  ].join(' '),
  accompany: [
    'MODE: ACCOMPANIED RESOLUTION. Solve the work WITH the student, one step at a',
    'time. For the current step: explain the reasoning, justify each decision,',
    'detail the calculations or proof, mention possible methods, warn about common',
    'errors, and end by checking the student follows before moving on. Do not dump',
    'the whole solution at once.',
  ].join(' '),
  solve: [
    'MODE: COMPLETE EXPLAINED SOLUTION. Give a full solution, but NEVER just the',
    'final answer. Include: a detailed explanation of every step, the reasoning',
    'that led to the result, the methods used, the theoretical notions involved,',
    'the most common errors, the key points to remember, tips to reproduce the',
    'method autonomously, and 2 similar practice exercises at the end.',
  ].join(' '),
};

/**
 * AI Academic Workspace (Sprint 6.7) — the student works on an academic
 * document alongside the AI teacher. It first analyses the work (objectives,
 * skills, prerequisites, success criteria, and the concepts THIS learner will
 * find hard, from the Digital Twin), then accompanies them in one of three
 * modes. Grounded in the document, adapted to the twin; the conversation is
 * held by the client and replayed each turn (stateless here).
 */
@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly mastery: MasteryService,
  ) {}

  async analyze(userId: string, documentId: string): Promise<WorkAnalysis> {
    const doc = await this.own(userId, documentId);
    const profile = await this.learnerProfile(userId, documentId);

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: ANALYSIS_PROMPT },
          {
            role: 'user',
            content:
              `Learner profile: ${profile.summary}\n\n` +
              `Academic work titled "${doc.title}":\n\n${doc.content.slice(0, MAX_CONTENT_CHARS)}`,
          },
        ],
        { temperature: 0.2 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Work analysis failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }

    return { ...this.parseAnalysis(raw), level: profile.level };
  }

  async assist(
    userId: string,
    documentId: string,
    mode: WorkspaceMode,
    messages: WorkspaceMessage[],
  ): Promise<string> {
    const doc = await this.own(userId, documentId);
    const profile = await this.learnerProfile(userId, documentId);

    const system = [
      'You are Second Brain, the student\'s AI teacher in their Academic Workspace.',
      MODE_STANCE[mode],
      `Adapt to a ${profile.level} learner. ${profile.summary}`,
      'Everything is grounded in the work below. Respond in its language, in clean',
      'markdown. The point is always to turn the work into real learning.',
      `\n\n--- THE WORK ("${doc.title}") ---\n${doc.content.slice(0, MAX_CONTENT_CHARS)}`,
    ].join(' ');

    const history = messages.slice(-MAX_HISTORY).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    // Seed the very first turn so the teacher opens the session in-mode.
    if (history.length === 0) {
      history.push({ role: 'user', content: this.opener(mode) });
    }

    try {
      const result = await this.llm.generate(
        [{ role: 'system', content: system }, ...history],
        { temperature: 0.4 },
      );
      return result.text.trim();
    } catch (error) {
      this.logger.error(`Workspace assist failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  // ── internals ──────────────────────────────────────────────────────────

  private opener(mode: WorkspaceMode): string {
    switch (mode) {
      case 'guide':
        return 'Help me understand and get started on this work — guide me, do not solve it for me.';
      case 'accompany':
        return "Let's solve this together, step by step. Start with the first step.";
      case 'solve':
        return 'Give me the complete, fully explained solution to this work.';
    }
  }

  private async own(userId: string, id: string): Promise<Document> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    return doc;
  }

  /** A short natural-language learner profile from the twin + this doc's concepts. */
  private async learnerProfile(
    userId: string,
    documentId: string,
  ): Promise<{ summary: string; level: LearnerLevel }> {
    const twin = await this.mastery.twin(userId);
    const level = this.levelOf(twin.summary.averageMastery);

    const conceptIds = (
      await this.prisma.conceptDocument.findMany({
        where: { documentId },
        select: { conceptId: true },
      })
    ).map((l) => l.conceptId);
    const relevant = twin.concepts.filter(
      (c) => conceptIds.includes(c.conceptId) && c.mastery !== null,
    );
    const mastered = relevant.filter((c) => (c.mastery ?? 0) >= 0.8).map((c) => c.name);
    const weak = relevant.filter((c) => (c.mastery ?? 0) < 0.5).map((c) => c.name);

    const parts = [`The learner is at ${level} level.`];
    if (mastered.length > 0) parts.push(`They have mastered: ${mastered.join(', ')}.`);
    if (weak.length > 0) parts.push(`They still struggle with: ${weak.join(', ')}.`);
    if (mastered.length === 0 && weak.length === 0) {
      parts.push('No prior mastery data for this topic yet.');
    }
    return { summary: parts.join(' '), level };
  }

  private levelOf(averageMastery: number | null): LearnerLevel {
    if (averageMastery === null) return 'new';
    if (averageMastery < 0.5) return 'beginner';
    if (averageMastery < 0.8) return 'intermediate';
    return 'advanced';
  }

  private parseAnalysis(raw: string): Omit<WorkAnalysis, 'level'> {
    const empty: Omit<WorkAnalysis, 'level'> = {
      objectives: [],
      skillsEvaluated: [],
      knowledgeMobilized: [],
      prerequisites: [],
      difficulty: null,
      successCriteria: [],
      keyNotions: [],
      likelyDifficult: [],
    };
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return empty;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return empty;
    }
    return {
      objectives: this.strArray(parsed.objectives),
      skillsEvaluated: this.strArray(parsed.skillsEvaluated),
      knowledgeMobilized: this.strArray(parsed.knowledgeMobilized),
      prerequisites: this.strArray(parsed.prerequisites),
      difficulty: this.difficulty(parsed.difficulty),
      successCriteria: this.strArray(parsed.successCriteria),
      keyNotions: this.strArray(parsed.keyNotions),
      likelyDifficult: this.difficultArray(parsed.likelyDifficult),
    };
  }

  private strArray(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim().slice(0, 300));
  }

  private difficultArray(v: unknown): { concept: string; reason: string }[] {
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is { concept: unknown; reason: unknown } =>
          !!x && typeof x === 'object',
      )
      .map((x) => ({
        concept: typeof x.concept === 'string' ? x.concept.trim().slice(0, 200) : '',
        reason: typeof x.reason === 'string' ? x.reason.trim().slice(0, 300) : '',
      }))
      .filter((x) => x.concept.length > 0);
  }

  private difficulty(v: unknown): DocumentDifficulty | null {
    if (typeof v !== 'string') return null;
    const lower = v.trim().toLowerCase();
    return DIFFICULTIES.find((d) => d === lower) ?? null;
  }
}
