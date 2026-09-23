import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  CefrLevel,
  LanguageMode,
  StartConversationRequest,
  TutorSessionDetail,
} from '@second-brain/shared';
import { RLLE_CURRICULUM } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { TutorService } from '../tutor/tutor.service';
import { LanguageService } from './language.service';
import { immersionRatio, languageSystemPrompt, modeSpec } from './language-modes';
import { ExperienceSessionService } from '../experience-sessions/experience-session.service';

/**
 * Immersive conversation practice.
 *
 * Only the OPENING lives here: the session is an ordinary TutorSession tagged
 * with `languageProfileId`, so every following turn goes through the existing
 * POST /tutor/sessions/:id/messages (and the voice endpoint) and picks up the
 * Language Professor role automatically.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly tutor: TutorService,
    private readonly languages: LanguageService,
    private readonly experiences: ExperienceSessionService,
  ) {}

  async start(
    userId: string,
    profileId: string,
    request: StartConversationRequest = {},
  ): Promise<TutorSessionDetail> {
    const profile = await this.languages.requireOwned(userId, profileId);
    if (
      !request.courseSessionId &&
      (request.unitId || request.lessonId || request.courseStage)
    ) {
      throw new BadRequestException('A course session is required for lesson context.');
    }
    const courseContext = request.courseSessionId
      ? await this.resolveCourseContext(userId, profile.id, request)
      : null;
    const scenario = request.scenario ?? courseContext?.objective ?? undefined;
    const effectiveRequest: StartConversationRequest = { ...request, scenario };

    const session = await this.prisma.tutorSession.create({
      data: {
        userId,
        languageProfileId: profile.id,
        title: scenario?.trim()
          ? `${profile.language} — ${scenario.trim()}`.slice(0, 200)
          : `${profile.language} conversation`,
      },
    });

    const opening = await this.openingLine(profile, effectiveRequest, courseContext?.level ?? undefined);
    await this.prisma.tutorMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: opening },
    });

    const path = `/tutor/${session.id}`;
    const now = new Date().toISOString();
    await this.experiences.create(userId, {
      type: 'language',
      title: session.title ?? `${profile.language} conversation`,
      intent: 'practice-language',
      inputModality: request.inputModality ?? 'text',
      activeContexts: [
        {
          id: `language:${profile.id}`,
          kind: 'language',
          scope: 'experience-session',
          referenceId: profile.id,
          label: `${profile.language} · ${profile.cefrLevel}`,
          priority: 90,
          visibility: 'visible',
          metadata: {
            level: profile.cefrLevel,
            mode: profile.mode,
          },
        },
        {
          id: `tutor:${session.id}`,
          kind: 'tutor-session',
          scope: 'active-object',
          referenceId: session.id,
          label: session.title ?? undefined,
          priority: 100,
          visibility: 'visible',
        },
        ...(courseContext
          ? [
              {
                id: `language-course:${courseContext.session.id}`,
                kind: 'learning-path' as const,
                scope: 'experience-session' as const,
                referenceId: courseContext.session.id,
                label: courseContext.objective ?? `${profile.language} course`,
                priority: 95,
                visibility: 'visible' as const,
                metadata: {
                  courseSessionId: courseContext.session.id,
                  ...(courseContext.unitId ? { unitId: courseContext.unitId } : {}),
                  ...(courseContext.stage ? { stage: courseContext.stage } : {}),
                },
              },
              ...(courseContext.lessonId
                ? [{
                    id: `lesson:${courseContext.lessonId}`,
                    kind: 'lesson' as const,
                    scope: 'active-object' as const,
                    referenceId: courseContext.lessonId,
                    label: courseContext.objective ?? 'Language lesson',
                    priority: 98,
                    visibility: 'visible' as const,
                  }]
                : []),
            ]
          : []),
      ],
      currentStep: {
        id: 'conversation',
        label: request.scenario?.trim() || 'Conversation',
        state: 'active',
        metadata: {
          language: profile.language,
          level: profile.cefrLevel,
          goal: profile.goal,
          mode: profile.mode,
          immersionIntensity: request.immersionIntensity ?? 'mixed',
          correctionIntensity: request.correctionIntensity ?? 'balanced',
          ...(courseContext
            ? {
                courseSessionId: courseContext.session.id,
                unitId: courseContext.unitId,
                lessonId: courseContext.lessonId,
                courseStage: courseContext.stage,
                courseObjective: courseContext.objective,
                courseLevel: courseContext.level,
              }
            : {}),
        },
      },
      sourceReferences: courseContext
        ? [
            { kind: 'language-course', id: profile.id, title: profile.language },
            ...(courseContext.lessonId
              ? [{ kind: 'lesson' as const, id: courseContext.lessonId, title: courseContext.objective ?? undefined }]
              : []),
          ]
        : undefined,
      resumeTarget: { kind: 'route', path },
      nextBestAction: {
        title: 'Continue the conversation',
        primaryAction: {
          label: 'Continue',
          destination: { kind: 'route', path },
        },
        reason: 'This language practice session is still active.',
        estimatedDuration: 10,
        expectedImpact: {
          kind: 'continuity',
          label: 'Keep the conversation context and corrections',
        },
        signalsUsed: [
          {
            signal: 'active-language-session',
            humanLabel: 'Conversation in progress',
            evidence: `${profile.language} · ${profile.cefrLevel}`,
            source: 'language-session',
            timestamp: now,
          },
        ],
        alternatives: [],
        destination: { kind: 'route', path },
        validUntil: null,
        confidence: 1,
        source: { kind: 'session', id: session.id },
      },
      links: {
        tutorSessionId: session.id,
        languageProfileId: profile.id,
        ...(courseContext?.lessonId ? { lessonId: courseContext.lessonId } : {}),
      },
      idempotencyKey: `language-conversation:${session.id}`,
    });

    return this.tutor.getSession(userId, session.id);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async resolveCourseContext(
    userId: string,
    profileId: string,
    request: StartConversationRequest,
  ): Promise<{
    session: Awaited<ReturnType<ExperienceSessionService['get']>>;
    unitId: string | null;
    lessonId: string | null;
    stage: string | null;
    objective: string | null;
    level: CefrLevel | null;
  }> {
    const session = await this.experiences.get(userId, request.courseSessionId!);
    if (
      session.intent !== 'language-course' ||
      session.links.languageProfileId !== profileId ||
      !['active', 'paused'].includes(session.status)
    ) {
      throw new BadRequestException('The course context does not match this language profile.');
    }
    const rawState = session.currentStep?.metadata?.rlleCourse;
    const state = rawState && typeof rawState === 'object'
      ? rawState as Record<string, unknown>
      : null;
    const rawLesson = state?.currentLesson;
    const lesson = rawLesson && typeof rawLesson === 'object'
      ? rawLesson as Record<string, unknown>
      : null;
    const lessonId = typeof lesson?.lessonId === 'string' ? lesson.lessonId : null;
    const activeUnitId = typeof lesson?.unitId === 'string'
      ? lesson.unitId
      : typeof state?.currentUnitId === 'string'
        ? state.currentUnitId
        : null;
    const curriculumIds = Array.isArray(state?.curriculumIds)
      ? state.curriculumIds.filter((value): value is string => typeof value === 'string')
      : [];
    const unitId = request.unitId ?? activeUnitId;
    if (request.lessonId && request.lessonId !== lessonId) {
      throw new BadRequestException('The lesson context is not active in this course.');
    }
    if (request.unitId && !curriculumIds.includes(request.unitId)) {
      throw new BadRequestException('The unit context does not belong to this course.');
    }
    const objective = (!request.unitId || request.unitId === activeUnitId) && typeof lesson?.communicativeObjective === 'string'
      ? lesson.communicativeObjective.slice(0, 500)
      : null;
    const curriculumLevel = RLLE_CURRICULUM.find((unit) => unit.id === unitId)?.level;
    const level = (typeof lesson?.level === 'string' && request.unitId === activeUnitId && /^(A1|A2|B1|B2|C1|C2)$/.test(lesson.level)
      ? lesson.level
      : curriculumLevel ?? null) as CefrLevel | null;
    return {
      session,
      unitId,
      lessonId,
      stage: request.courseStage?.trim().slice(0, 80) || null,
      objective,
      level,
    };
  }

  private async openingLine(
    profile: LanguageProfile,
    request: StartConversationRequest,
    cefrLevel?: CefrLevel,
  ): Promise<string> {
    const scenario = request.scenario;
    const mode = profile.mode as LanguageMode;
    const spec = modeSpec(mode);
    const system = languageSystemPrompt({
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode,
      goal: profile.goal,
      cefrLevel: cefrLevel ?? profile.cefrLevel,
      immersionIntensity: request.immersionIntensity,
      correctionIntensity: request.correctionIntensity,
    });

    // Immersion (7.8) uses a CEFR-adaptive target ratio; other modes use the
    // static mode ratio.
    const effectiveRatio = request.immersionIntensity
      ? { guided: 0.55, mixed: 0.8, full: 1 }[request.immersionIntensity]
      : mode === 'immersion'
        ? immersionRatio(profile.cefrLevel)
        : spec.targetLanguageRatio;
    const setting = scenario?.trim()
      ? `The scenario is: "${scenario.trim()}". Set the scene in one line, then stay in it.`
      : 'Pick a simple everyday situation suited to their level and open it.';
    const ratio =
      effectiveRatio >= 1
        ? `Write ENTIRELY in ${profile.language}. Do not translate anything.`
        : `Write roughly ${Math.round(effectiveRatio * 100)}% in ` +
          `${profile.language}, glossing the rest as your mode requires.`;

    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Open a conversation practice session. ${setting} ${ratio} ` +
              `Greet me briefly and ask me ONE opening question so I have to ` +
              `reply. Keep it to 2-3 sentences.`,
          },
        ],
        { temperature: 0.6, operation: 'language-tutor' },
      );
      return result.text.trim();
    } catch (error) {
      this.logger.error('Learning operation failed.');
      throw new ServiceUnavailableException(
        'The teacher is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
