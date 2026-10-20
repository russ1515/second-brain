import { createHash } from 'node:crypto';
import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PERFORMANCE_BUDGETS, PronunciationFeedbackBuilder, createContext, toSupportedLanguage,
  type PhoneticAssessmentResult,
} from '@second-brain/shared';
import { accountDataLockKey } from '../common/account-data-lock';
import { resolveLanguageTeachingRoles } from '../common/language-teaching';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import { PrismaService } from '../prisma/prisma.service';
import { PhoneticAssessmentEngine } from './phonetic-assessment.engine';
import {
  PHONETIC_ATTEMPT_INTENT, PHONETIC_ATTEMPT_KEY_PREFIX,
  readPhoneticAttempt, withPhoneticAttemptComparisons,
  type PhoneticAttemptView, type StoredPhoneticAttempt,
} from './phonetic-attempt-projection';

export interface CreatePhoneticAttemptInput {
  lessonId: string;
  exerciseIndex: number;
  idempotencyKey: string;
  locale?: string;
  parentAttemptId?: string;
  targetWordIndex?: number;
}

/** Owns experimental observations only. This service has no Examiner,
 * LearningCompletion, mastery journal, STT, LLM or metered-provider dependency.
 * Each attempt is a separate server-owned JSON envelope on the existing
 * ExperienceSession model; no existing lesson/assessment data is rewritten. */
@Injectable()
export class PhoneticAttemptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PhoneticAssessmentEngine,
  ) {}

  async list(userId: string, profileId: string): Promise<PhoneticAttemptView[]> {
    await this.requireOwnedProfile(this.prisma, userId, profileId);
    const rows = await this.prisma.experienceSession.findMany({
      where: { userId, languageProfileId: profileId, type: 'language',
        intent: PHONETIC_ATTEMPT_INTENT,
        idempotencyKey: { startsWith: PHONETIC_ATTEMPT_KEY_PREFIX } },
      orderBy: { startedAt: 'desc' }, take: 30,
      select: { id: true, userId: true, languageProfileId: true, lessonId: true,
        currentStep: true, startedAt: true, idempotencyKey: true },
    });
    return withPhoneticAttemptComparisons(rows.flatMap((row) => {
      const attempt = readPhoneticAttempt(row, userId, profileId);
      return attempt ? [attempt] : [];
    }));
  }

  async capability(userId: string, profileId: string, lessonId: string) {
    const profile = await this.requireOwnedProfile(this.prisma, userId, profileId);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: this.required(lessonId, 200), userId, languageProfileId: profileId },
      select: { id: true, exercises: true },
    });
    if (!lesson) throw new NotFoundException('Owned language lesson not found.');
    const target = toSupportedLanguage(profile.normalizedLanguage) ?? toSupportedLanguage(profile.language);
    const engine = await this.engine.capabilities();
    const supported = target === 'en';
    return {
      ...engine,
      available: engine.available && supported,
      capability: supported ? engine.capability : 'PRACTICE_ONLY',
      ...(!supported ? { reason: 'UNSUPPORTED_LANGUAGE' } : {}),
      references: Array.isArray(lesson.exercises) ? lesson.exercises.flatMap((exercise, exerciseIndex) => {
        if (!isRecord(exercise) || exercise.languageFormat !== 'voice-pronunciation'
          || typeof exercise.audioText !== 'string') return [];
        const referenceText = normalizeReference(exercise.audioText);
        return referenceText && referenceText.length <= 500
          ? [{ lessonId: lesson.id, exerciseIndex, referenceText }] : [];
      }).slice(0, 128) : [],
      bounds: { minDurationMs: 150, maxDurationMs: 30_000, maxUploadBytes: 4 * 1024 * 1024 },
    };
  }

  /** Explicit recovery of a lost process, never an automatic inference retry.
   * Two minutes exceeds the engine's bounded 60-second execution. */
  async recoverInterrupted(userId: string, profileId: string, attemptId: string): Promise<PhoneticAttemptView> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      await this.requireOwnedProfile(tx, userId, profileId);
      const row = await tx.experienceSession.findFirst({ where: {
        id: this.required(attemptId, 200), userId, languageProfileId: profileId,
        intent: PHONETIC_ATTEMPT_INTENT,
      } });
      const view = row ? readPhoneticAttempt(row, userId, profileId) : null;
      if (!row || !view) throw new NotFoundException('Pronunciation attempt not found.');
      if (view.state !== 'processing') return view;
      if (Date.now() - row.startedAt.getTime() < 120_000) {
        throw new ConflictException({ code: 'PHONETIC_ATTEMPT_IN_PROGRESS',
          message: 'The bounded acoustic job may still be running.' });
      }
      const stored = readState(row.currentStep)!;
      const updated = await tx.experienceSession.update({ where: { id: row.id }, data: {
        currentStep: envelope({ ...stored, state: 'technical_error', result: null,
          failureCode: 'PROCESSING_INTERRUPTED' }),
        status: 'failed', completedAt: new Date(), version: { increment: 1 },
      } });
      return readPhoneticAttempt(updated, userId, profileId)!;
    });
  }

  async assess(
    userId: string,
    profileId: string,
    input: CreatePhoneticAttemptInput,
    audio: UploadedFileLike,
  ): Promise<PhoneticAttemptView> {
    if (!audio || !Buffer.isBuffer(audio.buffer) || audio.buffer.length === 0) {
      throw new BadRequestException({ code: 'EMPTY_RECORDING', message: 'A pronunciation recording is required.' });
    }
    if (audio.buffer.length > 4 * 1024 * 1024) {
      throw new BadRequestException({ code: 'AUDIO_TOO_LARGE', message: 'The recording exceeds the safe upload bound.' });
    }
    if (!Number.isInteger(input.exerciseIndex) || input.exerciseIndex < 0 || input.exerciseIndex > 127) {
      throw new BadRequestException('A valid pronunciation exercise index is required.');
    }
    const key = this.required(input.idempotencyKey, 200);
    if (key.length < 8) throw new BadRequestException('A valid attempt key is required.');
    const lessonId = this.required(input.lessonId, 200);
    const profile = await this.requireOwnedProfile(this.prisma, userId, profileId);
    const roles = await resolveLanguageTeachingRoles(this.prisma, userId, profile);
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, userId, languageProfileId: profileId },
      select: { id: true, contentVersion: true, exercises: true },
    });
    if (!lesson) throw new NotFoundException('Owned language lesson not found.');
    const exercise = Array.isArray(lesson.exercises)
      ? lesson.exercises[input.exerciseIndex] : null;
    if (!isRecord(exercise) || exercise.languageFormat !== 'voice-pronunciation'
      || typeof exercise.audioText !== 'string') {
      throw new BadRequestException('A server-authored pronunciation exercise is required.');
    }
    const fullReference = normalizeReference(exercise.audioText);
    let expectedText = fullReference;
    if (!expectedText || expectedText.length > 500) {
      throw new BadRequestException('The pronunciation reference exceeds the supported bound.');
    }
    let parentAttemptId: string | undefined;
    let targetWordIndex: number | undefined;
    if (input.parentAttemptId !== undefined || input.targetWordIndex !== undefined) {
      parentAttemptId = this.required(input.parentAttemptId!, 200);
      targetWordIndex = input.targetWordIndex;
      if (!Number.isInteger(targetWordIndex) || targetWordIndex! < 0 || targetWordIndex! > 127) {
        throw new BadRequestException('A server-suggested retry word is required.');
      }
      const parentRow = await this.prisma.experienceSession.findFirst({ where: {
        id: parentAttemptId, userId, languageProfileId: profileId, lessonId,
        intent: PHONETIC_ATTEMPT_INTENT,
      } });
      const parent = parentRow ? readPhoneticAttempt(parentRow, userId, profileId) : null;
      if (!parent || parent.exerciseIndex !== input.exerciseIndex || parent.contentVersion !== lesson.contentVersion
        || parent.parentAttemptId || parent.result?.expectedText !== fullReference) {
        throw new BadRequestException('The retry must belong to the same owned pronunciation exercise and version.');
      }
      const target = parent.retryTargets.find((candidate) => candidate.wordIndex === targetWordIndex);
      if (!target) throw new BadRequestException('This word has no server-suggested acoustic retry evidence.');
      expectedText = target.word;
    }
    const targetLanguage = toSupportedLanguage(profile.normalizedLanguage)
      ?? toSupportedLanguage(profile.language);
    if (!targetLanguage) throw new BadRequestException('Unsupported target language.');
    let locale: string;
    try {
      const selected = new Intl.Locale(input.locale?.trim() || targetLanguage);
      if (selected.language !== new Intl.Locale(targetLanguage).language) throw new Error();
      locale = selected.baseName;
    } catch {
      throw new BadRequestException('The pronunciation locale must match the target language.');
    }
    const source = { profileId, lessonId, exerciseIndex: input.exerciseIndex,
      contentVersion: lesson.contentVersion, targetLanguage, locale, expectedText,
      supportLanguageCode: roles.supportLanguageCode };
    const lineage = parentAttemptId === undefined ? {} : { parentAttemptId, targetWordIndex };
    const inputHash = hash(JSON.stringify({ ...source, ...lineage }) + '\u0000' + hash(audio.buffer));
    const idempotencyKey = PHONETIC_ATTEMPT_KEY_PREFIX + hash(`${profileId}\u0000${key}`);
    const claimed = await this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      await this.requireOwnedProfile(tx, userId, profileId);
      const stillOwned = await tx.lesson.findFirst({
        where: { id: lessonId, userId, languageProfileId: profileId,
          contentVersion: lesson.contentVersion }, select: { id: true },
      });
      if (!stillOwned) throw new NotFoundException('Owned versioned language lesson not found.');
      if (parentAttemptId) {
        const parent = await tx.experienceSession.findFirst({ where: {
          id: parentAttemptId, userId, languageProfileId: profileId, lessonId,
          intent: PHONETIC_ATTEMPT_INTENT,
        } });
        if (!parent || !readPhoneticAttempt(parent, userId, profileId)?.retryTargets
          .some((target) => target.wordIndex === targetWordIndex && target.word === expectedText)) {
          throw new NotFoundException('The parent acoustic observation was removed or changed.');
        }
      }
      const existing = await tx.experienceSession.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
      });
      if (existing) {
        const view = readPhoneticAttempt(existing, userId, profileId);
        const state = readState(existing.currentStep);
        if (!view || state?.inputHash !== inputHash) {
          throw new ConflictException('This attempt key already belongs to different acoustic evidence.');
        }
        if (view.state === 'processing') {
          throw new ConflictException({ code: 'PHONETIC_ATTEMPT_IN_PROGRESS',
            message: 'This recording is already being assessed. No second inference was started.' });
        }
        return { row: existing, state: state!, fresh: false };
      }
      const state: StoredPhoneticAttempt = {
        schemaVersion: 1, source: 'server-phonetic-v1', ...source, ...lineage,
        inputHash, state: 'processing', result: null, audioRetained: false,
      };
      const row = await tx.experienceSession.create({ data: {
        userId, type: 'language', status: 'active',
        intent: PHONETIC_ATTEMPT_INTENT, inputModality: 'voice',
        languageProfileId: profileId, lessonId, idempotencyKey,
        activeContexts: createContext(userId) as unknown as Prisma.InputJsonValue,
        productions: [], sourceReferences: [],
        currentStep: envelope(state),
      } });
      return { row, state, fresh: true };
    });
    if (!claimed.fresh) return readPhoneticAttempt(claimed.row, userId, profileId)!;

    let result: PhoneticAssessmentResult | null = null;
    let state: StoredPhoneticAttempt['state'] = 'complete';
    try {
      result = await this.engine.assess({
        audio: audio.buffer, mimeType: audio.mimetype || 'application/octet-stream',
        expectedText, targetLanguage, locale, learnerLevel: profile.cefrLevel,
        lessonId, exerciseId: `${lessonId}:v${lesson.contentVersion}:${input.exerciseIndex}`
          + (targetWordIndex === undefined ? '' : `:word:${targetWordIndex}`),
      });
      // Defense in depth: a future adapter cannot publish a pedagogical score
      // or turn this uncalibrated attempt into completion evidence.
      if (result.masteryEligible !== false || result.calibrationStatus !== 'UNCALIBRATED'
        || [result.overallAcousticScore, result.accuracyScore, result.completenessScore,
          result.fluencyScore, result.prosodyScore].some((score) => score !== null)) {
        throw new Error('UNCALIBRATED_RESULT_INVALID');
      }
      result = { ...result, supportLanguageCode: roles.supportLanguageCode,
        feedback: new PronunciationFeedbackBuilder().build(result, {
          supportLanguageCode: roles.supportLanguageCode, targetLanguage,
        }) };
      if (JSON.stringify(envelope({ ...claimed.state, state, result })).length
        > PERFORMANCE_BUDGETS.maxSessionJsonCharsPerField) throw new Error('EVIDENCE_SIZE_LIMIT');
    } catch {
      // Do not log model output, audio, reference text or arbitrary error data.
      state = 'technical_error'; result = null;
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockOwner(tx, userId);
      const current = await tx.experienceSession.findFirst({
        where: { id: claimed.row.id, userId, languageProfileId: profileId,
          lessonId, intent: PHONETIC_ATTEMPT_INTENT, idempotencyKey },
      });
      // A deletion/reset during inference wins. Never recreate removed proof.
      if (!current || !(await tx.languageProfile.findFirst({
        where: { id: profileId, userId }, select: { id: true },
      }))) throw new NotFoundException('The pronunciation attempt was removed during processing.');
      const stored = readState(current.currentStep);
      if (!stored || stored.inputHash !== inputHash || stored.state !== 'processing') {
        throw new ConflictException('The pronunciation attempt changed during processing.');
      }
      const updated = await tx.experienceSession.update({
        where: { id: current.id }, data: {
          currentStep: envelope({ ...stored, state, result,
            ...(state === 'technical_error' ? { failureCode: 'ENGINE_ERROR' as const } : {}) }),
          status: state === 'technical_error' || result?.status === 'TECHNICAL_ERROR' ? 'failed' : 'completed',
          completedAt: new Date(), version: { increment: 1 },
        },
      });
      return readPhoneticAttempt(updated, userId, profileId)!;
    });
  }

  private async requireOwnedProfile(
    db: PrismaService | Prisma.TransactionClient, userId: string, profileId: string,
  ) {
    const profile = await db.languageProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true, language: true, normalizedLanguage: true, cefrLevel: true,
        nativeLanguage: true, teachingLanguageSource: true },
    });
    if (!profile) throw new NotFoundException('Language profile not found.');
    return profile;
  }

  private async lockOwner(tx: Prisma.TransactionClient, userId: string) {
    const lockKey = accountDataLockKey(userId);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
  }

  private required(value: string, max: number) {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || normalized.length > max) throw new BadRequestException('Invalid pronunciation input.');
    return normalized;
  }
}

function hash(value: string | Buffer): string { return createHash('sha256').update(value).digest('hex'); }
function normalizeReference(value: string): string { return value.normalize('NFC').trim().replace(/\s+/g, ' '); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function readState(step: unknown): StoredPhoneticAttempt | null {
  if (!isRecord(step) || !isRecord(step.metadata)
    || !isRecord(step.metadata.phoneticAssessment)) return null;
  return step.metadata.phoneticAssessment as unknown as StoredPhoneticAttempt;
}
function envelope(state: StoredPhoneticAttempt): Prisma.InputJsonValue {
  return { key: 'phonetic-attempt', metadata: { phoneticAssessment: state } } as unknown as Prisma.InputJsonValue;
}
