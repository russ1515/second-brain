import { Injectable, Logger } from '@nestjs/common';
import {
  SUPPORTED_LANGUAGE_CODES,
  type CompleteOnboardingResponse,
  type GenerateAssessmentRequest,
  type GenerateAssessmentResponse,
  type KycAssessment,
  type KycEducation,
  type KycIdentity,
  type KycLanguageLearner,
  type KycLanguages,
  type KycTeacher,
  type LearningCategory,
  type KycMasteryLevel,
  type OnboardingAnswers,
  type OnboardingState,
  type OnboardingStatus,
  type SaveOnboardingRequest,
  type SystemConfiguration,
} from '@second-brain/shared';
import type { OnboardingProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';

const CATEGORY_LABELS: Record<LearningCategory, string> = {
  kindergarten: 'Maternelle',
  primary: 'Primaire',
  secondary: 'Secondaire',
  highschool: 'Lycée',
  university: 'Université',
  research: 'Recherche / Doctorat',
  professional: 'Formation professionnelle',
  language: 'Apprentissage d’une langue',
  personal: 'Apprentissage personnel',
};

/**
 * The Universal KYC engine (UI/UX Sprint 2).
 *
 * `save` is progressive — it merges a partial patch section-by-section so an
 * interrupted onboarding resumes exactly where it stopped (2.20). `complete`
 * turns the collected answers into a real SYSTEM CONFIGURATION (2.15): it
 * updates the Profile, seeds a LanguageProfile when relevant, and creates the
 * initial Digital Twin concepts — then reports honestly what it actually did.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** Current onboarding state, or a fresh not-started state if none exists. */
  async get(userId: string): Promise<OnboardingState> {
    const row = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
    });
    return row ? this.toState(row) : this.emptyState();
  }

  async isCompleted(userId: string): Promise<boolean> {
    const row = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { status: true },
    });
    return row?.status === 'completed';
  }

  /** Merge a partial patch. Object sections merge field-by-field; list sections
   *  (goals/subjects/preferences/academicSupport) are replaced wholesale since
   *  the client always sends the full current selection. */
  async save(
    userId: string,
    dto: SaveOnboardingRequest,
  ): Promise<OnboardingState> {
    const current = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
    });
    const answers = dto.answers ?? {};

    const merged = {
      identity: this.mergeObject(current?.identity, answers.identity),
      education: this.mergeObject(current?.education, answers.education),
      languages: this.mergeObject(current?.languages, answers.languages),
      languageLearner: this.mergeObject(
        current?.languageLearner,
        answers.languageLearner,
      ),
      teacher: this.mergeObject(current?.teacher, answers.teacher),
      assessment: this.mergeObject(current?.assessment, answers.assessment),
      // Lists: replace when provided, else keep what's stored.
      goals: answers.goals ?? (current?.goals as Prisma.InputJsonValue),
      subjects: answers.subjects ?? (current?.subjects as Prisma.InputJsonValue),
      preferences:
        answers.preferences ?? (current?.preferences as Prisma.InputJsonValue),
      academicSupport:
        answers.academicSupport ??
        (current?.academicSupport as Prisma.InputJsonValue),
      extra: this.mergeObject(current?.extra, answers.extra),
    };

    // `category` is promoted out of the education JSON: the gate/branching and
    // adaptive UI read it directly.
    const category =
      (answers.education?.category as LearningCategory | undefined) ??
      (current?.category ?? null);

    // A completed onboarding stays completed even if a later PATCH edits it
    // (e.g. from the Profile screen); a save only moves not_started → in_progress.
    const status: OnboardingStatus =
      current?.status === 'completed' ? 'completed' : 'in_progress';

    const row = await this.prisma.onboardingProfile.upsert({
      where: { userId },
      create: {
        userId,
        status,
        category,
        currentStep: dto.currentStep ?? 'identity',
        ...this.jsonData(merged),
      },
      update: {
        status,
        category,
        ...(dto.currentStep ? { currentStep: dto.currentStep } : {}),
        ...this.jsonData(merged),
      },
    });
    return this.toState(row);
  }

  /** A short adaptive diagnostic for one subject (2.12). Best-effort LLM; on
   *  failure the client falls back to a self-rating (aiGenerated=false). */
  async generateAssessment(
    _userId: string,
    dto: GenerateAssessmentRequest,
  ): Promise<GenerateAssessmentResponse> {
    const count = Math.min(Math.max(dto.count ?? 3, 1), 5);
    const subject = dto.subject.trim();
    try {
      const result = await this.llm.generate(
        [
          {
            role: 'system',
            content:
              'You design a SHORT diagnostic to gauge what a learner already ' +
              'knows about a subject. Pick the most foundational concepts. ' +
              'Reply with ONLY a JSON array of objects ' +
              '{"concept": string, "question": string} and nothing else. ' +
              'Questions must be answerable in one or two sentences.',
          },
          {
            role: 'user',
            content: `Subject: ${subject}. Give exactly ${count} concepts.`,
          },
        ],
        { temperature: 0.3 },
      );
      const items = this.parseAssessment(result.text).slice(0, count);
      if (items.length > 0) {
        return { subject, items, aiGenerated: true };
      }
    } catch (error) {
      this.logger.warn(
        `Assessment generation fell back to self-rating: ${(error as Error).message}`,
      );
    }
    // Fallback: no questions, the learner self-rates the subject as a whole.
    return { subject, items: [], aiGenerated: false };
  }

  /** Turn the KYC answers into a real system configuration + apply it (2.15). */
  async complete(userId: string): Promise<CompleteOnboardingResponse> {
    const row =
      (await this.prisma.onboardingProfile.findUnique({ where: { userId } })) ??
      (await this.prisma.onboardingProfile.create({
        data: { userId, status: 'in_progress', currentStep: 'twin' },
      }));

    const answers = this.readAnswers(row);
    const applied = {
      profileUpdated: false,
      languageProfileCreated: false,
      conceptsCreated: 0,
    };

    // 1) Profile: display name + interface language.
    const identity = answers.identity ?? {};
    const languages = answers.languages ?? {};
    const displayName = [identity.firstName, identity.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const preferredLanguage = SUPPORTED_LANGUAGE_CODES.includes(
      (languages.interface ?? '') as never,
    )
      ? (languages.interface as string)
      : undefined;
    if (displayName || preferredLanguage) {
      await this.prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          displayName: displayName || null,
          ...(preferredLanguage ? { preferredLanguage } : {}),
        },
        update: {
          ...(displayName ? { displayName } : {}),
          ...(preferredLanguage ? { preferredLanguage } : {}),
        },
      });
      applied.profileUpdated = true;
    }

    // 2) LanguageProfile: the language branch, or a foreign study language.
    const ll = answers.languageLearner ?? {};
    const targetLanguage =
      row.category === 'language' ? ll.targetLanguage : languages.study;
    if (targetLanguage && targetLanguage.trim()) {
      const created = await this.seedLanguageProfile(
        userId,
        targetLanguage.trim(),
        languages.native ?? null,
        ll,
      );
      applied.languageProfileCreated = created;
    }

    // 3) Digital Twin seed: concepts from the assessment + the subjects.
    const seededConcepts = this.conceptSeeds(answers);
    for (const seed of seededConcepts) {
      const ok = await this.seedConcept(userId, seed.concept);
      if (ok) applied.conceptsCreated += 1;
    }

    const updated = await this.prisma.onboardingProfile.update({
      where: { userId },
      data: {
        status: 'completed',
        currentStep: 'done',
        completedAt: new Date(),
      },
    });

    return {
      state: this.toState(updated),
      configuration: this.buildConfiguration(updated, seededConcepts, applied),
    };
  }

  // ── configuration + summary ────────────────────────────────────────────────

  private buildConfiguration(
    row: OnboardingProfile,
    seeds: { concept: string; level: KycMasteryLevel }[],
    applied: SystemConfiguration['applied'],
  ): SystemConfiguration {
    const a = this.readAnswers(row);
    const identity = a.identity ?? {};
    const education = a.education ?? {};
    const languages = a.languages ?? {};
    const teacher = a.teacher ?? {};
    const category = row.category as LearningCategory | null;

    const name =
      [identity.firstName, identity.lastName].filter(Boolean).join(' ').trim() ||
      null;
    const eduSummary =
      [
        category ? CATEGORY_LABELS[category] : null,
        education.field || education.domain || null,
      ]
        .filter(Boolean)
        .join(' — ') || null;

    return {
      learnerProfile: {
        name,
        category,
        categoryLabel: category ? CATEGORY_LABELS[category] : null,
      },
      educationProfile: {
        summary: eduSummary,
        year: education.year || education.specialty || null,
      },
      languageProfile: {
        native: languages.native || null,
        study:
          category === 'language'
            ? a.languageLearner?.targetLanguage || null
            : languages.study || null,
        others: languages.others ?? [],
        bilingualSupport: Boolean(languages.studyingInForeignLanguage),
      },
      goals: a.goals ?? [],
      subjects: a.subjects ?? [],
      teachingPreferences: {
        tone: teacher.tone ?? null,
        explanations: teacher.explanations ?? null,
        intervention: teacher.intervention ?? null,
        correction: teacher.correction ?? null,
      },
      initialMastery: seeds,
      applied,
    };
  }

  /** Concepts to seed: assessed concepts (with their level) first, then any
   *  subjects not already covered (as broad, medium-level nodes). */
  private conceptSeeds(
    answers: OnboardingAnswers,
  ): { concept: string; level: KycMasteryLevel }[] {
    const seeds: { concept: string; level: KycMasteryLevel }[] = [];
    const seen = new Set<string>();
    const push = (concept: string, level: KycMasteryLevel) => {
      const key = concept.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      seeds.push({ concept: concept.trim(), level });
    };
    for (const item of answers.assessment?.items ?? []) {
      if (item.concept) push(item.concept, item.level ?? 'medium');
    }
    for (const subject of answers.subjects ?? []) push(subject, 'medium');
    return seeds.slice(0, 20);
  }

  // ── side-effect helpers ────────────────────────────────────────────────────

  private async seedLanguageProfile(
    userId: string,
    language: string,
    nativeLanguage: string | null,
    ll: KycLanguageLearner,
  ): Promise<boolean> {
    const normalizedLanguage = language.toLowerCase().trim();
    const cefr = (ll.currentLevel ?? '').toUpperCase();
    const cefrLevel = /^(A1|A2|B1|B2|C1|C2)$/.test(cefr) ? cefr : 'A1';
    try {
      await this.prisma.languageProfile.create({
        data: {
          userId,
          language,
          normalizedLanguage,
          nativeLanguage,
          cefrLevel,
          goal: ll.mainGoal ?? null,
        },
      });
      return true;
    } catch (error) {
      // Already exists (unique clash) — a re-run must not fail the completion.
      if ((error as { code?: string }).code === 'P2002') return false;
      throw error;
    }
  }

  private async seedConcept(userId: string, name: string): Promise<boolean> {
    const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!normalizedName) return false;
    try {
      await this.prisma.concept.create({
        data: { userId, name: name.trim(), normalizedName },
      });
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') return false;
      throw error;
    }
  }

  // ── json plumbing ──────────────────────────────────────────────────────────

  private readAnswers(row: OnboardingProfile): OnboardingAnswers {
    return {
      identity: (row.identity as KycIdentity | null) ?? undefined,
      education: (row.education as KycEducation | null) ?? undefined,
      languages: (row.languages as KycLanguages | null) ?? undefined,
      languageLearner:
        (row.languageLearner as KycLanguageLearner | null) ?? undefined,
      goals: (row.goals as string[] | null) ?? undefined,
      subjects: (row.subjects as string[] | null) ?? undefined,
      preferences: (row.preferences as string[] | null) ?? undefined,
      teacher: (row.teacher as KycTeacher | null) ?? undefined,
      academicSupport: (row.academicSupport as string[] | null) ?? undefined,
      assessment: (row.assessment as KycAssessment | null) ?? undefined,
      extra: (row.extra as Record<string, unknown> | null) ?? undefined,
    };
  }

  private toState(row: OnboardingProfile): OnboardingState {
    return {
      status: row.status as OnboardingStatus,
      currentStep: row.currentStep as OnboardingState['currentStep'],
      answers: this.readAnswers(row),
      completedAt: row.completedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
    };
  }

  private emptyState(): OnboardingState {
    return {
      status: 'not_started',
      currentStep: 'welcome',
      answers: {},
      completedAt: null,
      updatedAt: null,
    };
  }

  /** Shallow-merge an incoming object section over the stored one. */
  private mergeObject(
    stored: unknown,
    incoming: unknown,
  ): Prisma.InputJsonValue | undefined {
    if (incoming === undefined) {
      return (stored as Prisma.InputJsonValue) ?? undefined;
    }
    const base =
      stored && typeof stored === 'object' ? (stored as object) : {};
    const patch =
      incoming && typeof incoming === 'object' ? (incoming as object) : {};
    return { ...base, ...patch } as Prisma.InputJsonValue;
  }

  /** Drop `undefined` values so Prisma leaves untouched columns as-is. */
  private jsonData(
    merged: Record<string, Prisma.InputJsonValue | undefined>,
  ): Record<string, Prisma.InputJsonValue> {
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  private parseAssessment(
    raw: string,
  ): { concept: string; question: string }[] {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) return [];
    try {
      const arr = JSON.parse(raw.slice(start, end + 1));
      if (!Array.isArray(arr)) return [];
      return arr
        .filter(
          (x): x is { concept: string; question: string } =>
            x &&
            typeof x.concept === 'string' &&
            typeof x.question === 'string',
        )
        .map((x) => ({
          concept: x.concept.trim(),
          question: x.question.trim(),
        }))
        .filter((x) => x.concept && x.question);
    } catch {
      return [];
    }
  }
}
