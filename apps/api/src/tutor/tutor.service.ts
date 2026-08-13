import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type TutorMessage } from '@prisma/client';
import type {
  Citation,
  LanguageMode,
  LLMMessage,
  SendTutorMessageResponse,
  TeachingStrategy,
  TutorMessageView,
  TutorSessionDetail,
  TutorSessionSummary,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RetrievalService } from '../documents/retrieval/retrieval.service';
import { MasteryService } from '../concepts/mastery.service';
import { LearningPathService } from '../concepts/learning-path.service';
// Pure function, not a provider: importing it keeps the Language Professor role
// in one place without making TutorModule depend on LanguageModule (which
// depends on this module for conversation).
import { languageSystemPrompt } from '../languages/language-modes';
import {
  selectStrategy,
  strategyDirective,
} from './teaching-strategy';
import { localeDirective, resolveLocale } from '../common/learning-locale';
import { UsageService } from '../usage/usage.service';
import { resolveTeacherRole, publicRole, type ResolvedRole } from '../teaching/teacher-role';
import type { CreateTutorSessionDto } from './dto/create-tutor-session.dto';

const HISTORY_LIMIT = 12;
const CONTEXT_LIMIT = 5;

/** Classifies what the learner is studying so the teacher can auto-adopt the
 *  matching specialist role (task 3.6). Kept to a bare label for the engine. */
const SUBJECT_CLASSIFIER_SYSTEM = [
  'You classify what a learner is studying. Reply with ONLY the school subject',
  'or the language being studied, as one or two words (e.g. "Biology",',
  '"Mathematics", "History", "Spanish", "French"). No sentence, no punctuation.',
  'If it is genuinely unclear or off-topic, reply exactly "General".',
].join(' ');

const TUTOR_PERSONA = [
  'You are the learner\'s personal teacher — a patient, human teacher, never a',
  'generic chatbot. Behave like a real teacher in a one-to-one lesson:',
  '(1) Explain calmly and step by step, assuming little prior knowledge and',
  'building up gradually with a concrete example.',
  '(2) Check understanding with one short guiding question instead of only',
  'handing over the answer.',
  '(3) Encourage warmly and specifically — acknowledge effort and progress.',
  '(4) Watch what the learner writes for misunderstandings; when you spot one,',
  'gently correct it and explain WHY it was wrong.',
  '(5) Adapt to the learner: if they struggle, simplify and slow down; if they',
  'grasp it quickly, go deeper.',
  '(6) End each reply by pointing to the next small step, so the learner always',
  'knows what to do next.',
  'Keep replies focused, human, and never overwhelming.',
].join(' ');

/**
 * Pace steering (Task 3.3 "ralentir / accélérer"). The learner can ask the
 * teacher to slow down or speed up; the request is appended to the system
 * prompt for that turn so the same teacher persona simply changes tempo.
 */
export type TutorPace = 'slower' | 'faster';

const PACE_DIRECTIVE: Record<TutorPace, string> = {
  slower:
    ' The learner asked you to SLOW DOWN. Re-explain the last point in smaller' +
    ' steps, with simpler words and a concrete everyday example. Introduce no' +
    ' new material this turn, and finish by checking they follow with one short' +
    ' question.',
  faster:
    ' The learner asked you to SPEED UP. Be concise, trust what they already' +
    ' understand, skip the basics, and move on to the next idea.',
};

/** Grounding/citation rules, shared by every persona the tutor can wear. */
const GROUNDING_RULES = [
  "When context passages from the learner's own notes are provided, prefer them",
  'and cite the ones you use with their [n] markers. You may draw on general',
  'knowledge to fill gaps, but make clear when you go beyond their notes. Keep',
  'replies focused.',
].join(' ');

/** The default (non-language) tutor prompt. Composed so it is byte-identical to
 *  the prompt this service used before the language engine existed. */
const TUTOR_SYSTEM = `${TUTOR_PERSONA} ${GROUNDING_RULES}`;

/** What the tutor knows about the focused concept + the learner's grasp of it. */
interface FocusInfo {
  name: string;
  mastery: number | null;
  level: string;
}

/** Set only for language-practice sessions; drives the Language Professor role. */
interface LanguageInfo {
  language: string;
  nativeLanguage: string | null;
  mode: LanguageMode;
  goal: string | null;
  /** CEFR level (7.3) — drives immersion depth (7.8). */
  cefrLevel: string | null;
}

/** Session row with the fields needed to build views/prompts. */
type SessionRow = {
  id: string;
  userId: string;
  title: string | null;
  focusConceptId: string | null;
  languageProfileId: string | null;
  subject: string | null;
  strategy: string | null;
  strategyReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  focusConcept?: { name: string } | null;
};

@Injectable()
export class TutorService {
  private readonly logger = new Logger(TutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
    private readonly mastery: MasteryService,
    private readonly learningPath: LearningPathService,
    private readonly usage: UsageService,
  ) {}

  async createSession(
    userId: string,
    dto: CreateTutorSessionDto,
  ): Promise<TutorSessionSummary> {
    let focusName: string | null = null;
    if (dto.focusConceptId) {
      focusName = await this.requireOwnedConcept(userId, dto.focusConceptId);
    }
    const session = await this.prisma.tutorSession.create({
      data: {
        userId,
        focusConceptId: dto.focusConceptId ?? null,
        title: dto.title?.trim() || focusName,
      },
    });
    return this.toSummary(session, 0, focusName);
  }

  /** Start a session on the learner's most actionable weak/at-risk concept and
   *  open it with a proactive, twin-aware tutor message. */
  async focusOnWeakSpot(userId: string): Promise<TutorSessionDetail> {
    const { items } = await this.learningPath.next(userId);
    const target = items.find((i) =>
      ['at_risk', 'in_progress', 'ready'].includes(i.status),
    );
    if (!target) {
      throw new UnprocessableEntityException(
        'Nothing to work on right now — add concepts, or your actionable ones are all mastered or blocked.',
      );
    }

    const session = await this.prisma.tutorSession.create({
      data: { userId, focusConceptId: target.conceptId, title: target.name },
    });

    const focus: FocusInfo = {
      name: target.name,
      mastery: target.mastery,
      level: target.level,
    };
    const { block, citations } = await this.retrieveContext(userId, target.name);
    const focusLocale = await resolveLocale(this.prisma, userId);
    const opening = await this.callLlm([
      {
        role: 'system',
        content: this.systemPrompt(focus, undefined, undefined, undefined, undefined, focusLocale),
      },
      {
        role: 'user',
        content:
          (block ? `Context from my notes:\n${block}\n\n` : '') +
          `Begin the session: in 2-3 sentences introduce what we'll work on for ` +
          `"${target.name}", then ask me ONE diagnostic question to gauge my ` +
          `current understanding.`,
      },
    ]);
    await this.prisma.tutorMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: opening,
        citations: this.citationsForStorage(citations),
      },
    });

    return this.getSession(userId, session.id);
  }

  /**
   * Resume the relationship (Sprint 7.2): open a natural conversation that
   * REMEMBERS what the learner studied recently — greets them by name, recalls
   * the last topic, and (Socratic method) asks them to recall a prerequisite of
   * it before going further. Falls back to a warm "what shall we learn?" opener
   * when there's no history yet.
   */
  async resumeConversation(userId: string): Promise<TutorSessionDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profile: { select: { displayName: true } } },
    });
    const name =
      user?.profile?.displayName?.trim() || user?.email?.split('@')[0] || 'there';

    // What did we do most recently? The last completed study session.
    const recent = await this.prisma.studySession.findFirst({
      where: { userId, status: 'done' },
      orderBy: { completedAt: 'desc' },
      select: { subject: true, conceptId: true },
    });
    const recentTopic = recent?.subject ?? null;

    // A prerequisite of the recent concept makes the best Socratic recall target.
    let recallName: string | null = null;
    if (recent?.conceptId) {
      const edge = await this.prisma.conceptEdge.findFirst({
        where: { userId, relation: 'prerequisite', targetId: recent.conceptId },
        select: { source: { select: { name: true } } },
      });
      recallName = edge?.source.name ?? null;
    }

    const session = await this.prisma.tutorSession.create({
      data: {
        userId,
        focusConceptId: recent?.conceptId ?? null,
        title: recentTopic ?? 'Conversation',
      },
    });

    let focus: FocusInfo | undefined;
    if (recent?.conceptId) {
      const m = await this.mastery
        .conceptMastery(userId, recent.conceptId)
        .catch(() => null);
      if (m) focus = { name: m.name, mastery: m.mastery, level: m.level };
    }

    const userPrompt = recentTopic
      ? `Open the conversation naturally, like a teacher greeting a returning ` +
        `student. (1) Greet them by name: ${name}. (2) Remind them that recently ` +
        `we worked on "${recentTopic}". (3) Applying the Socratic method, ask ONE ` +
        `short recall question ` +
        (recallName
          ? `about "${recallName}" (a prerequisite we should be solid on) `
          : `about the key idea of "${recentTopic}" `) +
        `to check they still remember it before we go further. Warm and natural, ` +
        `2-3 sentences, and end with the question.`
      : `Greet the learner warmly by name (${name}) as their personal teacher, ` +
        `and ask what they would like to learn or work on today. 1-2 sentences.`;

    const resumeLocale = await resolveLocale(this.prisma, userId);
    const opening = await this.callLlm([
      {
        role: 'system',
        content: this.systemPrompt(focus, undefined, undefined, undefined, undefined, resumeLocale),
      },
      { role: 'user', content: userPrompt },
    ]);
    await this.prisma.tutorMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: opening },
    });

    return this.getSession(userId, session.id);
  }

  async listSessions(userId: string): Promise<TutorSessionSummary[]> {
    const sessions = await this.prisma.tutorSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { messages: true } },
        focusConcept: { select: { name: true } },
      },
    });
    return sessions.map((s) =>
      this.toSummary(s, s._count.messages, s.focusConcept?.name ?? null),
    );
  }

  async getSession(userId: string, id: string): Promise<TutorSessionDetail> {
    const session = await this.prisma.tutorSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        focusConcept: { select: { name: true } },
      },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Tutor session not found.');
    }
    return {
      ...this.toSummary(
        session,
        session.messages.length,
        session.focusConcept?.name ?? null,
      ),
      messages: session.messages.map((m) => this.toMessageView(m)),
    };
  }

  async deleteSession(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await this.prisma.tutorSession.delete({ where: { id } });
  }

  async sendMessage(
    userId: string,
    sessionId: string,
    content: string,
    options?: { viaVoice?: boolean; pace?: TutorPace },
  ): Promise<SendTutorMessageResponse> {
    const viaVoice = options?.viaVoice ?? false;
    const pace = options?.pace;
    const session = await this.requireOwned(userId, sessionId);

    // Usage & Quotas (8.3): each answer counts as one AI question and is gated by
    // the plan's limit (throws 403 quota_exceeded when the cap is reached).
    await this.usage.consume(userId, 'ai_questions', 1);

    // Twin steering: if focused, load the learner's grasp of the concept.
    let focus: FocusInfo | undefined;
    if (session.focusConceptId) {
      const m = await this.mastery
        .conceptMastery(userId, session.focusConceptId)
        .catch(() => null); // concept may have been deleted (FK set null)
      if (m) {
        focus = { name: m.name, mastery: m.mastery, level: m.level };
      }
    }

    // Language steering: language-practice sessions get the Professor role.
    const language = await this.loadLanguage(session.languageProfileId);

    // Role engine (task 3.6): the same teacher auto-adopts the specialist role
    // for the subject. A language session already carries the richer Language
    // Professor prompt, so its subject is just the language name (for the label);
    // any other session gets its subject classified once and cached.
    let subject = session.subject;
    if (language) {
      subject = language.language;
    } else if (!subject) {
      subject = await this.classifySubject(
        [focus?.name, session.title, content].filter(Boolean).join('. '),
      );
    }
    const role = resolveTeacherRole(subject);

    // Teaching Strategy Engine (7.9, ITE): pick the pedagogical strategy once
    // from the learner's real context (subject, mastery, language) and cache it
    // on the session so the approach stays coherent across turns.
    let strategy = session.strategy as TeachingStrategy | null;
    let strategyReason = session.strategyReason;
    if (!strategy) {
      const sel = selectStrategy({
        subject,
        isLanguage: !!language,
        mastery: focus?.mastery ?? null,
      });
      strategy = sel.strategy;
      strategyReason = sel.reason;
    }

    const history = await this.prisma.tutorMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: HISTORY_LIMIT,
    });

    // Bias retrieval toward the focused concept when present.
    const query = focus ? `${focus.name}. ${content}` : content;
    const { block, citations } = await this.retrieveContext(userId, query);
    const augmented = block
      ? `Context from my notes:\n${block}\n\nMy message: ${content}`
      : content;

    const locale = await resolveLocale(this.prisma, userId);
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt(focus, language, pace, role, strategy, locale),
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: augmented },
    ];
    const answer = await this.callLlm(messages);

    const subjectChanged = subject != null && subject !== session.subject;
    const strategyChanged = strategy !== session.strategy;

    const ops = await this.prisma.$transaction([
      this.prisma.tutorMessage.create({
        data: { sessionId, role: 'user', content, viaVoice },
      }),
      this.prisma.tutorMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: answer,
          citations: this.citationsForStorage(citations),
          viaVoice,
        },
      }),
      this.prisma.tutorSession.update({
        where: { id: sessionId },
        data: {
          ...(session.title ? {} : { title: content.slice(0, 80) }),
          ...(subjectChanged ? { subject } : {}),
          ...(strategyChanged ? { strategy, strategyReason } : {}),
        },
      }),
    ]);

    return { message: this.toMessageView(ops[1]) };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Load the profile behind a language session. Tolerates deletion (FK is
   *  SetNull) and reads via Prisma rather than LanguageService — that would make
   *  TutorModule depend on LanguageModule, which depends on this one. */
  private async loadLanguage(
    languageProfileId: string | null,
  ): Promise<LanguageInfo | undefined> {
    if (!languageProfileId) return undefined;
    const profile = await this.prisma.languageProfile.findUnique({
      where: { id: languageProfileId },
    });
    if (!profile) return undefined;
    return {
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode: profile.mode as LanguageMode,
      goal: profile.goal,
      cefrLevel: profile.cefrLevel,
    };
  }

  private systemPrompt(
    focus?: FocusInfo,
    language?: LanguageInfo,
    pace?: TutorPace,
    role?: ResolvedRole,
    strategy?: TeachingStrategy | null,
    locale?: string,
  ): string {
    // A language session swaps the persona; everything else is unchanged. With
    // no language profile this returns exactly the pre-language-engine prompt.
    const base = language
      ? `${languageSystemPrompt(language)} ${GROUNDING_RULES}`
      : TUTOR_SYSTEM;

    let prompt = base;
    // Auto-adopt the specialist role for the subject (task 3.6). A language
    // profile already carries the richer Language Professor prompt, so the role
    // line is added only for non-language-profile sessions.
    if (role && !language) {
      prompt += role.persona;
    }
    if (focus) {
      const pct =
        focus.mastery === null
          ? 'not yet assessed'
          : `${Math.round(focus.mastery * 100)}%`;
      prompt +=
        ` This session focuses on the concept "${focus.name}". The learner's current` +
        ` mastery is ${focus.level} (${pct}). Actively target likely gaps in this` +
        ` concept, check understanding with questions, and steer the conversation` +
        ` back to it.`;
    }
    if (pace) {
      prompt += PACE_DIRECTIVE[pace];
    }
    // Teaching Strategy Engine (7.9): how the teacher CONDUCTS the session.
    if (strategy) {
      prompt += strategyDirective(strategy);
    }
    // Global Learning Locale: general sessions answer in the learner's locale.
    // Language-practice sessions are the exception — the language engine (mode,
    // CEFR, immersion, code-switching) governs their language instead.
    if (!language && locale) {
      prompt += localeDirective(locale);
    }
    return prompt;
  }

  /**
   * Detect the subject the learner is studying so the teacher can auto-adopt
   * the right role (task 3.6). A language name is caught deterministically (no
   * LLM); anything else is classified once, cheaply, into a bare subject label.
   * Best-effort: a failure just leaves the general teacher until the next turn.
   */
  private async classifySubject(text: string): Promise<string | null> {
    const cleaned = text.trim();
    if (!cleaned) return null;

    // Deterministic shortcut: if the text names a language, use it as-is.
    const quick = resolveTeacherRole(cleaned);
    if (quick.kind === 'language') return quick.language;

    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: SUBJECT_CLASSIFIER_SYSTEM },
          { role: 'user', content: cleaned.slice(0, 500) },
        ],
        { temperature: 0 },
      );
      const label = result.text
        .trim()
        .replace(/^["'.\s]+|["'.\s]+$/g, '')
        .split('\n')[0]
        .slice(0, 40)
        .trim();
      if (!label || /^general$/i.test(label)) return null;
      return label;
    } catch (error) {
      this.logger.warn(`Subject classification failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Grounding is an enhancement, not a precondition: the prompt already handles
   * an empty context and the tutor may draw on general knowledge. So a
   * vector-store hiccup must cost the citations, not the whole conversation
   * turn — the same failure that was observed 500ing lesson generation.
   */
  private async retrieveContext(
    userId: string,
    query: string,
  ): Promise<{ block: string; citations: Citation[] }> {
    let results;
    try {
      ({ results } = await this.retrieval.search(userId, query, {
        limit: CONTEXT_LIMIT,
      }));
    } catch (error) {
      this.logger.warn(
        `Grounding retrieval failed; replying ungrounded: ${(error as Error).message}`,
      );
      return { block: '', citations: [] };
    }
    const block = results
      .map((r, i) => `[${i + 1}] (from "${r.documentTitle}")\n${r.content}`)
      .join('\n\n');
    const citations: Citation[] = results.map((r) => ({
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      chunkIndex: r.chunkIndex,
      score: r.score,
    }));
    return { block, citations };
  }

  private async callLlm(messages: LLMMessage[]): Promise<string> {
    try {
      const result = await this.llm.generate(messages, { temperature: 0.4 });
      return result.text.trim();
    } catch (error) {
      this.logger.error(`Tutor LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The tutor is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  private citationsForStorage(
    citations: Citation[],
  ): Prisma.InputJsonValue | typeof Prisma.DbNull {
    return citations.length
      ? (citations as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull;
  }

  private async requireOwned(userId: string, id: string): Promise<SessionRow> {
    const session = await this.prisma.tutorSession.findUnique({ where: { id } });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Tutor session not found.');
    }
    return session;
  }

  /** Verify concept ownership; returns its name for the session title. */
  private async requireOwnedConcept(
    userId: string,
    conceptId: string,
  ): Promise<string> {
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
    });
    if (!concept || concept.userId !== userId) {
      throw new NotFoundException('Concept not found.');
    }
    return concept.name;
  }

  private toSummary(
    session: SessionRow,
    messageCount: number,
    focusConceptName: string | null,
  ): TutorSessionSummary {
    return {
      id: session.id,
      title: session.title,
      focusConceptId: session.focusConceptId,
      focusConceptName,
      subject: session.subject,
      role: publicRole(resolveTeacherRole(session.subject)),
      strategy: (session.strategy as TeachingStrategy | null) ?? null,
      strategyReason: session.strategyReason ?? null,
      messageCount,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  private toMessageView(message: TutorMessage): TutorMessageView {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      citations:
        message.citations != null
          ? (message.citations as unknown as Citation[])
          : undefined,
      viaVoice: message.viaVoice,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
