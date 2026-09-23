import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type TutorMessage } from '@prisma/client';
import type {
  Citation,
  ContextItem,
  ContextItemInput,
  ExperienceSession,
  InputModality,
  KycTeacher,
  LanguageMode,
  ImmersionIntensity,
  LanguageCorrectionIntensity,
  LLMMessage,
  SendTutorMessageResponse,
  TeachingStrategy,
  TutorMessageView,
  TutorSessionDetail,
  TutorSessionSummary,
} from '@second-brain/shared';
import { createContext, parseTutorMessageBlocks } from '@second-brain/shared';
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
import {
  inferTeacherSubject,
  resolveTeacherRole,
  publicRole,
  type ResolvedRole,
} from '../teaching/teacher-role';
import type { CreateTutorSessionDto } from './dto/create-tutor-session.dto';
import { ExperienceSessionService } from '../experience-sessions/experience-session.service';

const HISTORY_LIMIT = 12;
const CONTEXT_LIMIT = 5;
const SESSION_LIST_LIMIT = 20;
const SESSION_MESSAGE_LIMIT = 100;

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
  immersionIntensity?: ImmersionIntensity;
  correctionIntensity?: LanguageCorrectionIntensity;
  recentVocabulary: string[];
  sessionDirective?: string;
  recentMistakes: string[];
}

interface TutorPersonalization {
  directive: string;
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
    private readonly experienceSessions: ExperienceSessionService,
  ) {}

  async createSession(
    userId: string,
    dto: CreateTutorSessionDto,
  ): Promise<TutorSessionSummary> {
    let focusName: string | null = null;
    if (dto.focusConceptId) {
      focusName = await this.requireOwnedConcept(userId, dto.focusConceptId);
    }
    await this.assertOwnedTutorReferences(userId, dto);
    const title = this.sessionTitle(dto.title, dto.objective, focusName);
    const session = await this.prisma.tutorSession.create({
      data: {
        userId,
        focusConceptId: dto.focusConceptId ?? null,
        languageProfileId: dto.languageProfileId ?? null,
        title,
      },
    });
    const experience = await this.ensureExperience(userId, session, {
      objective: dto.objective,
      intent: dto.intent,
      mode: dto.mode,
      inputModality: dto.inputModality,
      activeContexts: dto.activeContexts,
      documentId: dto.documentId,
      goalId: dto.goalId,
      languageProfileId: dto.languageProfileId,
    });
    return this.toSummary(session, 0, focusName, experience);
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
      take: SESSION_LIST_LIMIT,
      include: {
        _count: { select: { messages: true } },
        focusConcept: { select: { name: true } },
      },
    });
    const experiences = await this.experienceSessions.findByTutorSessions(
      userId,
      sessions.map((session) => session.id),
    );
    return sessions.map((s) =>
      this.toSummary(
        s,
        s._count.messages,
        s.focusConcept?.name ?? null,
        experiences.get(s.id) ?? null,
      ),
    );
  }

  async getSession(userId: string, id: string): Promise<TutorSessionDetail> {
    const session = await this.prisma.tutorSession.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: SESSION_MESSAGE_LIMIT },
        focusConcept: { select: { name: true } },
      },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Tutor session not found.');
    }
    const experience = await this.ensureExperience(userId, session, {
      objective: session.title ?? undefined,
      intent: 'learn',
      mode: 'conversation',
      inputModality: 'text',
    });
    const messages = [...session.messages].reverse();
    return {
      ...this.toSummary(
        session,
        messages.length,
        session.focusConcept?.name ?? null,
        experience,
      ),
      messages: messages.map((m) => this.toMessageView(m)),
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
    const experience = await this.ensureExperience(userId, session, {
      objective: session.title ?? undefined,
      intent: 'learn',
      mode: 'conversation',
      inputModality: viaVoice ? 'voice' : 'text',
    });

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
    const language = await this.loadLanguage(userId, session.languageProfileId, experience);
    const personalization = await this.loadPersonalization(userId);

    // Role engine (task 3.6): the same teacher auto-adopts the specialist role
    // for the subject. A language session already carries the richer Language
    // Professor prompt, so its subject is just the language name (for the label);
    // any other session gets its subject inferred locally once and cached.
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

    const historyDescending = await this.prisma.tutorMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
    });
    // A voice transcript survives a provider/quota failure. Retrying that exact
    // text reuses the unanswered turn instead of duplicating it.
    const pendingUser =
      historyDescending[0]?.role === 'user' && historyDescending[0].content === content
        ? historyDescending[0]
        : null;
    const history = historyDescending
      .filter((message) => message.id !== pendingUser?.id)
      .reverse();
    const persistedVoiceUser =
      viaVoice && !pendingUser
        ? await this.prisma.tutorMessage.create({
            data: { sessionId, role: 'user', content, viaVoice: true },
          })
        : pendingUser;

    // Bias retrieval toward the focused concept when present.
    const query = focus ? `${focus.name}. ${content}` : content;
    const directDocumentIds = experience.activeContexts.items
      .filter((item) => item.kind === 'document' && item.referenceId)
      .map((item) => item.referenceId as string);
    const collectionIds = experience.activeContexts.items
      .filter((item) => item.kind === 'document-collection' && item.referenceId)
      .map((item) => item.referenceId as string);
    const collectionDocuments = collectionIds.length > 0
      ? await this.prisma.document.findMany({
          where: { userId, deletedAt: null, collectionId: { in: collectionIds } },
          select: { id: true },
        })
      : [];
    const documentIds = [...new Set([
      ...directDocumentIds,
      ...collectionDocuments.map((document) => document.id),
    ])];
    const hasDocumentScope = directDocumentIds.length > 0 || collectionIds.length > 0;
    const { block, citations } = await this.retrieveContext(
      userId,
      query,
      hasDocumentScope ? documentIds : undefined,
    );
    const activeContextLabels = experience.activeContexts.items
      .filter((item) => item.visibility !== 'hidden')
      .slice(0, 8)
      .map((item) => `${item.kind}: ${item.label ?? item.referenceId ?? item.id}`)
      .join('; ');
    const contextParts = [
      block ? `Context from my notes:\n${block}` : '',
      activeContextLabels ? `My active context references: ${activeContextLabels}` : '',
      `My message: ${content}`,
    ].filter(Boolean);
    const augmented = contextParts.length > 1 ? contextParts.join('\n\n') : content;

    const locale = await resolveLocale(this.prisma, userId);
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.systemPrompt(
          focus,
          language,
          pace,
          role,
          strategy,
          locale,
          personalization.directive,
        ),
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: augmented },
    ];
    let answer: string;
    try {
      answer = await this.callLlm(messages);
    } catch (error) {
      // A failed provider call did not deliver the paid-for unit. Release the
      // reservation so transient 429/503 errors do not consume user quota.
      await this.usage.release(userId, 'ai_questions', 1).catch(() => undefined);
      throw error;
    }

    const subjectChanged = subject != null && subject !== session.subject;
    const strategyChanged = strategy !== session.strategy;

    const assistantCreate = this.prisma.tutorMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: answer,
        citations: this.citationsForStorage(citations),
        viaVoice,
      },
    });
    const sessionUpdate = this.prisma.tutorSession.update({
      where: { id: sessionId },
      data: {
        ...(session.title ? {} : { title: this.sessionTitle(undefined, content, null) }),
        ...(subjectChanged ? { subject } : {}),
        ...(strategyChanged ? { strategy, strategyReason } : {}),
      },
    });

    let assistant: TutorMessage;
    if (persistedVoiceUser) {
      [assistant] = await this.prisma.$transaction([assistantCreate, sessionUpdate]);
    } else {
      const ops = await this.prisma.$transaction([
        this.prisma.tutorMessage.create({
          data: { sessionId, role: 'user', content, viaVoice },
        }),
        assistantCreate,
        sessionUpdate,
      ]);
      assistant = ops[1];
    }

    // Continuity is useful metadata, but a transient state-write failure must
    // not hide an answer that was already safely persisted.
    await this.experienceSessions
      .updateState(userId, experience.id, {
        inputModality: viaVoice ? 'voice' : 'text',
        currentStep: {
          ...(experience.currentStep ?? { id: 'conversation' }),
          state: 'active',
        },
      })
      .catch((error) =>
        this.logger.warn('Learning operation failed.'),
      );

    return { message: this.toMessageView(assistant) };
  }

  /** Keep a recognised transcript when the response provider or quota gate
   *  fails. The exact unanswered text can then be retried without recording. */
  async preserveVoiceTranscript(
    userId: string,
    sessionId: string,
    transcript: string,
  ): Promise<void> {
    await this.requireOwned(userId, sessionId);
    const last = await this.prisma.tutorMessage.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
    if (last?.role === 'user' && last.content === transcript) return;
    await this.prisma.tutorMessage.create({
      data: { sessionId, role: 'user', content: transcript, viaVoice: true },
    });
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Load the profile behind a language session. Tolerates deletion (FK is
   *  SetNull) and reads via Prisma rather than LanguageService — that would make
   *  TutorModule depend on LanguageModule, which depends on this one. */
  private async loadLanguage(
    userId: string,
    languageProfileId: string | null,
    experience?: ExperienceSession,
  ): Promise<LanguageInfo | undefined> {
    if (!languageProfileId) return undefined;
    const profile = await this.prisma.languageProfile.findFirst({
      where: { id: languageProfileId, userId },
      include: {
        vocabDeck: {
          select: {
            cards: { select: { front: true }, orderBy: { createdAt: 'desc' }, take: 12 },
          },
        },
      },
    });
    if (!profile) return undefined;
    const metadata = experience?.currentStep?.metadata;
    const immersionIntensity = metadata?.immersionIntensity;
    const correctionIntensity = metadata?.correctionIntensity;
    const courseLevel = metadata?.courseLevel;
    const courseSessionId = typeof metadata?.courseSessionId === 'string'
      ? metadata.courseSessionId
      : null;
    const courseSession = courseSessionId
      ? await this.experienceSessions.get(userId, courseSessionId).catch(() => null)
      : null;
    const rawCourse = courseSession?.currentStep?.metadata?.rlleCourse;
    const course = rawCourse && typeof rawCourse === 'object'
      ? rawCourse as Record<string, unknown>
      : null;
    const rawMistakes = Array.isArray(course?.mistakeMemory) ? course.mistakeMemory : [];
    const recentMistakes = rawMistakes
      .slice(-3)
      .map((value) => {
        if (!value || typeof value !== 'object') return null;
        const item = value as Record<string, unknown>;
        const pattern = typeof item.pattern === 'string' ? item.pattern.trim() : '';
        const correction = typeof item.correction === 'string' ? item.correction.trim() : '';
        return pattern && correction
          ? `${pattern.slice(0, 160)} → ${correction.slice(0, 240)}`
          : null;
      })
      .filter((value): value is string => value !== null);
    const survivalSkills = Array.isArray(metadata?.survivalSkills)
      ? metadata.survivalSkills
          .filter((value): value is string => typeof value === 'string')
          .slice(0, 7)
      : [];
    const sessionSignals = [
      typeof metadata?.courseObjective === 'string'
        ? `Current course objective: ${metadata.courseObjective.slice(0, 500)}`
        : null,
      typeof metadata?.courseStage === 'string'
        ? `Current structured lesson stage: ${metadata.courseStage.slice(0, 80)}`
        : null,
      typeof metadata?.missionObjective === 'string'
        ? `Current real-life mission: ${metadata.missionObjective.slice(0, 500)}`
        : null,
      survivalSkills.length > 0
        ? `Relevant communication-survival strategies: ${survivalSkills.join(', ')}`
        : null,
      course && Array.isArray(course.completedUnitIds) && Array.isArray(course.curriculumIds)
        ? `Measured course units completed: ${course.completedUnitIds.length}/${course.curriculumIds.length}`
        : null,
    ].filter((value): value is string => value !== null);
    return {
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode: profile.mode as LanguageMode,
      goal: profile.goal,
      cefrLevel: typeof courseLevel === 'string' && /^(A1|A2|B1|B2|C1|C2)$/.test(courseLevel)
        ? courseLevel
        : profile.cefrLevel,
      recentVocabulary: profile.vocabDeck?.cards.map((card) => card.front) ?? [],
      recentMistakes,
      ...(sessionSignals.length > 0 ? { sessionDirective: sessionSignals.join('. ') } : {}),
      ...(immersionIntensity === 'guided' || immersionIntensity === 'mixed' || immersionIntensity === 'full'
        ? { immersionIntensity }
        : {}),
      ...(correctionIntensity === 'light' || correctionIntensity === 'balanced' || correctionIntensity === 'detailed'
        ? { correctionIntensity }
        : {}),
    };
  }

  /** Real declared + behavioural preferences shape delivery. They stay prompt
   *  guidance, not a repeated claim in every learner-facing answer. */
  private async loadPersonalization(userId: string): Promise<TutorPersonalization> {
    const [onboarding, dna] = await Promise.all([
      this.prisma.onboardingProfile.findUnique({
        where: { userId },
        select: { teacher: true, preferences: true },
      }),
      this.prisma.learningDna.findUnique({
        where: { userId },
        select: { traits: true, maturity: true },
      }),
    ]);
    const teacher = (onboarding?.teacher as KycTeacher | null) ?? null;
    const preferences = Array.isArray(onboarding?.preferences)
      ? onboarding.preferences
          .filter((value): value is string => typeof value === 'string' && /^[a-z][a-z0-9_-]{0,39}$/i.test(value))
          .slice(0, 6)
      : [];
    const dnaTraits = Array.isArray(dna?.traits)
      ? dna.traits
          .filter((trait): trait is { key: string; label: string; confidence: number } =>
            !!trait && typeof trait === 'object' &&
            typeof (trait as { key?: unknown }).key === 'string' &&
            typeof (trait as { label?: unknown }).label === 'string' &&
            typeof (trait as { confidence?: unknown }).confidence === 'number' &&
            (trait as { confidence: number }).confidence >= 30,
          )
          .slice(0, 5)
          .map((trait) => `${trait.key}=${trait.label}`)
      : [];
    const signals = [
      teacher?.tone ? `tone=${teacher.tone}` : null,
      teacher?.explanations ? `explanation length=${teacher.explanations}` : null,
      teacher?.intervention ? `intervention=${teacher.intervention}` : null,
      teacher?.correction ? `correction timing=${teacher.correction}` : null,
      preferences.length > 0 ? `preferred formats=${preferences.join(', ')}` : null,
      dna && dna.maturity > 0 ? `Learning DNA maturity=${dna.maturity}%` : null,
      dnaTraits.length > 0 ? `established Learning DNA traits=${dnaTraits.join(', ')}` : null,
    ].filter((value): value is string => value !== null);
    return {
      directive:
        signals.length > 0
          ? ` Adapt your delivery using these real learner settings and observed signals: ${signals.join('; ')}. Treat weak-evidence signals as guidance, not facts.`
          : '',
    };
  }

  private systemPrompt(
    focus?: FocusInfo,
    language?: LanguageInfo,
    pace?: TutorPace,
    role?: ResolvedRole,
    strategy?: TeachingStrategy | null,
    locale?: string,
    personalization?: string,
  ): string {
    // A language session swaps the persona; everything else is unchanged. With
    // no language profile this returns exactly the pre-language-engine prompt.
    const base = language
      ? `${languageSystemPrompt(language)} ${GROUNDING_RULES}`
      : TUTOR_SYSTEM;

    let prompt = base;
    if (language?.recentVocabulary.length) {
      prompt += ` The learner's recently saved vocabulary is: ${language.recentVocabulary.join(', ')}. Reuse it naturally when relevant; do not force every item into the exchange.`;
    }
    if (language?.sessionDirective) {
      prompt += ` ${language.sessionDirective}. Keep the exchange tied to this verified session context.`;
    }
    if (language?.recentMistakes.length) {
      prompt += ` Recently observed RLLE patterns to repair when relevant: ${language.recentMistakes.join('; ')}. Use them as bounded teaching guidance, never as permanent learner traits.`;
    }
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
    if (personalization) {
      prompt += personalization;
    }
    // Global Learning Locale: general sessions answer in the learner's locale.
    // Language-practice sessions are the exception — the language engine (mode,
    // CEFR, immersion, code-switching) governs their language instead.
    if (!language && locale) {
      prompt += localeDirective(locale);
    }
    prompt +=
      ' When structure helps the learner, use short Markdown sections with clear' +
      ' headings such as Explanation, Example, Question, Exercise, Summary, or' +
      ' Next step. Do not force every heading into every response and do not reveal' +
      ' hidden reasoning or chain-of-thought.';
    return prompt;
  }

  /**
   * Detect the subject the learner is studying so the teacher can auto-adopt
   * the right role (task 3.6). A language name is caught deterministically (no
   * LLM); common academic subjects use the same local catalogue. Ambiguous text
   * simply keeps the general teacher, avoiding a hidden request on first use.
   */
  private classifySubject(text: string): string | null {
    const cleaned = text.trim();
    if (!cleaned) return null;
    return inferTeacherSubject(cleaned.slice(0, 500));
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
    documentIds?: string[],
  ): Promise<{ block: string; citations: Citation[] }> {
    let results;
    try {
      ({ results } = await this.retrieval.search(userId, query, {
        limit: CONTEXT_LIMIT,
        ...(documentIds ? { documentIds } : {}),
      }));
    } catch (error) {
      this.logger.warn('Learning operation failed.');
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
      const result = await this.llm.generate(messages, {
        temperature: 0.4,
        operation: 'tutor',
      });
      return result.text.trim();
    } catch (error) {
      // Provider exception prose can contain request context or credentials;
      // it is intentionally not copied to application logs.
      this.logger.error('Tutor LLM call failed.');
      if (error instanceof ServiceUnavailableException) throw error;
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

  private async ensureExperience(
    userId: string,
    session: SessionRow,
    options: {
      objective?: string;
      intent?: string;
      mode?: string;
      inputModality?: InputModality;
      activeContexts?: ContextItemInput[];
      documentId?: string;
      goalId?: string;
      languageProfileId?: string;
    },
  ): Promise<ExperienceSession> {
    const contexts = [...(options.activeContexts ?? [])];
    const addContext = (item: ContextItemInput) => {
      if (!contexts.some((current) => current.kind === item.kind && current.referenceId === item.referenceId)) {
        contexts.push(item);
      }
    };
    if (session.focusConceptId) {
      addContext({
        id: `concept:${session.focusConceptId}`,
        kind: 'concept',
        scope: 'experience-session',
        referenceId: session.focusConceptId,
        label: session.focusConcept?.name ?? session.title ?? undefined,
        priority: 80,
        visibility: 'visible',
      });
    }
    if (options.documentId) {
      addContext({ id: `document:${options.documentId}`, kind: 'document', scope: 'active-object', referenceId: options.documentId, priority: 90, visibility: 'visible' });
    }
    if (options.goalId) {
      addContext({ id: `goal:${options.goalId}`, kind: 'goal', scope: 'experience-session', referenceId: options.goalId, priority: 60, visibility: 'visible' });
    }
    const languageProfileId = options.languageProfileId ?? session.languageProfileId ?? undefined;
    if (languageProfileId) {
      addContext({ id: `language:${languageProfileId}`, kind: 'language', scope: 'experience-session', referenceId: languageProfileId, priority: 70, visibility: 'visible' });
    }
    const documentId = options.documentId ?? this.firstContextReference(contexts, 'document');
    const goalId = options.goalId ?? this.firstContextReference(contexts, 'goal');
    const objective = options.objective?.trim() || session.title || undefined;
    return this.experienceSessions.ensureTutorSession(userId, {
      title: session.title ?? objective,
      intent: options.intent?.trim() || 'learn',
      inputModality: options.inputModality ?? 'text',
      activeContexts: contexts,
      currentStep: {
        id: options.mode?.trim() || 'conversation',
        ...(objective ? { label: objective } : {}),
        state: 'active',
      },
      sourceReferences: contexts
        .filter((item) => item.referenceId && ['document', 'document-collection', 'concept', 'lesson'].includes(item.kind))
        .map((item) => ({
          kind: item.kind === 'document-collection' ? 'document-collection' : item.kind as 'document' | 'concept' | 'lesson',
          id: item.referenceId as string,
          ...(item.label ? { title: item.label } : {}),
        })),
      resumeTarget: { kind: 'route', path: `/tutor/${session.id}` },
      links: {
        tutorSessionId: session.id,
        documentId: documentId ?? null,
        goalId: goalId ?? null,
        languageProfileId: languageProfileId ?? null,
      },
    });
  }

  private firstContextReference(
    contexts: readonly ContextItemInput[],
    kind: ContextItem['kind'],
  ): string | undefined {
    return contexts.find((item) => item.kind === kind && item.referenceId)?.referenceId;
  }

  private sessionTitle(
    explicit: string | undefined,
    objective: string | undefined,
    focusName: string | null,
  ): string {
    const source = explicit?.trim() || objective?.trim() || focusName?.trim() || 'Discussion';
    const compact = source.replace(/\s+/g, ' ').replace(/^[-–—:\s]+/, '').trim();
    return compact.length <= 80 ? compact : `${compact.slice(0, 77).trimEnd()}…`;
  }

  private async assertOwnedTutorReferences(
    userId: string,
    dto: CreateTutorSessionDto,
  ): Promise<void> {
    const contexts = dto.activeContexts ?? [];
    // Validate the bounded, secret-free context contract before persisting the
    // Tutor row, so malformed creation requests cannot leave orphans behind.
    try {
      createContext(userId, contexts);
    } catch {
      throw new BadRequestException('Tutor context is invalid.');
    }
    const ids = (kind: ContextItem['kind'], direct?: string) => [
      ...(direct ? [direct] : []),
      ...contexts.filter((item) => item.kind === kind && item.referenceId).map((item) => item.referenceId as string),
    ];
    const unique = (values: string[]) => [...new Set(values)];
    const documents = unique(ids('document', dto.documentId));
    const collections = unique(ids('document-collection'));
    const concepts = unique(ids('concept', dto.focusConceptId));
    const goals = unique(ids('goal', dto.goalId));
    const languages = unique(ids('language', dto.languageProfileId));
    const exams = unique(ids('exam'));
    const checks = await Promise.all([
      documents.length ? this.prisma.document.count({ where: { userId, id: { in: documents }, deletedAt: null } }) : 0,
      collections.length ? this.prisma.collection.count({ where: { userId, id: { in: collections } } }) : 0,
      concepts.length ? this.prisma.concept.count({ where: { userId, id: { in: concepts } } }) : 0,
      goals.length ? this.prisma.goal.count({ where: { userId, id: { in: goals } } }) : 0,
      languages.length ? this.prisma.languageProfile.count({ where: { userId, id: { in: languages } } }) : 0,
      exams.length ? this.prisma.exam.count({ where: { userId, id: { in: exams } } }) : 0,
    ]);
    if (
      checks[0] !== documents.length || checks[1] !== collections.length ||
      checks[2] !== concepts.length || checks[3] !== goals.length ||
      checks[4] !== languages.length || checks[5] !== exams.length
    ) {
      throw new BadRequestException('A Tutor context is invalid for this user.');
    }
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
    experienceSession: ExperienceSession | null = null,
  ): TutorSessionSummary {
    const strategy = (session.strategy as TeachingStrategy | null) ?? null;
    return {
      id: session.id,
      title: session.title,
      focusConceptId: session.focusConceptId,
      focusConceptName,
      subject: session.subject,
      role: publicRole(resolveTeacherRole(session.subject)),
      strategy,
      strategyReason: session.strategyReason ?? null,
      strategyReasonCode: strategy ? `strategy.reason.${strategy}` : null,
      messageCount,
      experienceSession,
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
      blocks: parseTutorMessageBlocks(
        message.content,
        message.citations != null
          ? (message.citations as unknown as Citation[])
          : [],
      ),
    };
  }
}
