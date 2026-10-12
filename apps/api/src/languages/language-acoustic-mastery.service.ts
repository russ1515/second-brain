import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../config/feature-flags.service';
import {
  ACOUSTIC_ASSESSMENT_CONTRACT_VERSION,
  LANGUAGE_MASTERY_POLICY_VERSION,
  LANGUAGE_MASTERY_THRESHOLD,
  RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
  RLLE_LANGUAGE_MASTERY_UNIT_MAP,
  decideLanguageMilestoneMastery,
  getRlleLanguageMasteryContentSupplementsForUnit,
  missingLanguageTrainingFormats,
  rlleMilestoneEvidenceScopeKey,
  toSupportedLanguage,
  type AcousticAssessmentReason,
  type AcousticAssessmentResult,
  type GradedAnswer,
  type LanguageAutonomyEvidence,
  type LanguageMasteryDecision,
  type LanguageTrainingEvidence,
  type SupportedLanguageCode,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SpeechService } from '../speech/speech.service';
import { ExaminerService } from '../examiner/examiner.service';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import {
  LanguageMasteryAttemptService,
  type LanguageMasteryAttemptCriterion,
  type LanguageMasteryAttemptProjection,
} from './language-mastery-attempt.service';
import { languageMasteryStrictRuntimeAvailable } from './language-mastery-readiness';

interface AcousticMasteryRequest {
  experienceSessionId: string;
  lessonId: string;
  targetId: string;
  idempotencyKey: string;
  exerciseIndex: number;
  remediationPlanId?: string;
}

interface StoredCourseSnapshot {
  currentLesson: {
    lessonId: string;
    unitId: string;
    status: string;
  } | null;
  milestoneMastery: Record<string, { trainingEvidence?: LanguageTrainingEvidence[] }>;
}

export interface AcousticMasteryResponse {
  attemptId: string;
  outcome: 'evaluated' | 'not-evaluable';
  decision: LanguageMasteryDecision;
  criteria: LanguageMasteryAttemptCriterion[];
  assessmentSubmissionId: string | null;
  completionId: string | null;
  scripted: AcousticAssessmentResult;
  spontaneous: AcousticAssessmentResult;
  coverage: {
    languageCode: SupportedLanguageCode;
    providerLocale: string | null;
    verified: boolean;
  };
  replayed: boolean;
}

interface AcousticCoverageConfig {
  transcriptionLanguageCodes: SupportedLanguageCode[];
  synthesisLanguageCodes: SupportedLanguageCode[];
  pronunciationAssessmentLanguageCodes: SupportedLanguageCode[];
  pronunciationAssessmentLocales?: Record<string, string>;
}

/**
 * Native-audio bridge for the one mastery milestone whose evidence modality is
 * acoustic. It intentionally sits beside STT/TTS: a transcript never enters
 * this service and raw audio is never persisted.
 */
@Injectable()
export class LanguageAcousticMasteryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly speech: SpeechService,
    private readonly examiner: ExaminerService,
    private readonly attempts: LanguageMasteryAttemptService,
  ) {}

  async assess(
    userId: string,
    profileId: string,
    request: AcousticMasteryRequest,
    scriptedAudio: UploadedFileLike,
    spontaneousAudio: UploadedFileLike,
  ): Promise<AcousticMasteryResponse> {
    this.requireAudio(scriptedAudio);
    this.requireAudio(spontaneousAudio);
    const profile = await this.prisma.languageProfile.findFirst({
      where: { id: profileId, userId },
    });
    if (!profile) throw new NotFoundException('Language profile not found.');
    const languageCode = toSupportedLanguage(profile.language);
    if (!languageCode) {
      throw new BadRequestException('The target language is not in the supported language registry.');
    }
    const session = await this.prisma.experienceSession.findFirst({
      where: {
        id: this.required(request.experienceSessionId, 'course session', 200),
        userId,
        languageProfileId: profileId,
        intent: 'language-course',
      },
      select: { id: true, currentStep: true },
    });
    if (!session) throw new NotFoundException('Active language course session not found.');
    const state = this.courseSnapshot(session.currentStep);
    const active = state.currentLesson;
    if (
      !active
      || active.status !== 'active'
      || active.lessonId !== request.lessonId
    ) {
      throw new NotFoundException('Active language lesson not found.');
    }
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: request.lessonId, userId, languageProfileId: profileId },
      select: { id: true, contentVersion: true, exercises: true, topic: true },
    });
    if (!lesson) throw new NotFoundException('Versioned language lesson not found.');
    const mapping = RLLE_LANGUAGE_MASTERY_UNIT_MAP.find(
      (candidate) => candidate.unitId === active.unitId,
    );
    const milestone = mapping?.milestones.find(
      (candidate) => candidate.id === request.targetId,
    );
    if (!mapping || !milestone || milestone.oralRole !== 'audio-native-assessment') {
      throw new BadRequestException('The requested target is not a native-acoustic milestone for this lesson.');
    }
    const supplement = getRlleLanguageMasteryContentSupplementsForUnit(active.unitId)
      .find((candidate) => candidate.id === milestone.contentDefinitionId);
    const acoustic = supplement?.evaluation.acousticAssessment;
    if (
      !supplement
      || !acoustic?.required
      || acoustic.transcriptionSufficient
      || !acoustic.modes.includes('scripted-reference')
      || !acoustic.modes.includes('spontaneous')
    ) {
      throw new ConflictException('The versioned acoustic rubric is incomplete.');
    }
    const exercise = this.exercise(lesson.exercises, request.exerciseIndex);
    const referenceText = typeof exercise.audioText === 'string'
      ? exercise.audioText.normalize('NFC').trim().replace(/\s+/g, ' ')
      : '';
    if (exercise.languageFormat !== 'voice-pronunciation' || !referenceText) {
      throw new BadRequestException('A server-authored pronunciation reference is required.');
    }

    const training = state.milestoneMastery[active.unitId]?.trainingEvidence ?? [];
    if (!request.remediationPlanId) {
      const missing = missingLanguageTrainingFormats(training);
      if (missing.length > 0) {
        throw new BadRequestException(
          `Complete every required training format before acoustic assessment: ${missing.join(', ')}.`,
        );
      }
    }

    // Apply the exact same server-authoritative gate as the course projection
    // before starting a journal or reserving provider quota. A crafted direct
    // request cannot bypass a disabled strict-mastery feature flag.
    const coverage = this.coverage(languageCode);
    if (!coverage.verified) {
      throw new ServiceUnavailableException(
        'Native pronunciation assessment is unavailable for this language.',
      );
    }

    const journal = await this.attempts.start(userId, {
      languageProfileId: profileId,
      experienceSessionId: session.id,
      lessonId: lesson.id,
      idempotencyKey: this.required(request.idempotencyKey, 'idempotency key', 200),
      scopeKind: 'milestone',
      scopeKey: rlleMilestoneEvidenceScopeKey({ languageCode, milestone }),
      targetId: milestone.id,
      mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
      policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
      masteryContentVersion: milestone.contentVersion,
      contentDefinitionId: milestone.contentDefinitionId,
      sourceContentVersion: lesson.contentVersion,
      languageCode,
      cefrLevel: milestone.level,
      pillar: milestone.pillar,
      remediationPlanId: request.remediationPlanId ?? null,
    });
    if (journal.status === 'evaluated' && journal.decision) {
      const repaired = await this.repairTerminalSideEffects(userId, journal);
      const canonicalSubmission = repaired.assessmentSubmissionId
        ? await this.examiner.findAcousticLanguageMasterySubmission(
            userId,
            repaired.attemptId,
          )
        : null;
      const recovered = canonicalSubmission
        ? this.recoveredSubmission(
            supplement.evaluation.criteria.map((item) => item.id),
            canonicalSubmission.results,
          )
        : null;
      const scriptedResult = recovered?.scripted ?? this.neutralResult(
        languageCode,
        repaired.verdict === 'not-evaluable'
          ? 'provider-not-evaluable'
          : 'assessment-request-invalid',
        'scripted-reference',
      );
      const spontaneousResult = recovered?.spontaneous ?? this.neutralResult(
        languageCode,
        repaired.verdict === 'not-evaluable'
          ? 'provider-not-evaluable'
          : 'assessment-request-invalid',
        'spontaneous',
      );
      return {
        attemptId: repaired.attemptId,
        outcome: repaired.verdict === 'not-evaluable' ? 'not-evaluable' : 'evaluated',
        decision: repaired.decision!,
        criteria: repaired.criteria,
        assessmentSubmissionId: repaired.assessmentSubmissionId,
        completionId: repaired.completionId,
        scripted: scriptedResult,
        spontaneous: spontaneousResult,
        coverage: this.coverage(languageCode),
        replayed: true,
      };
    }

    // A process can stop after the canonical submission insert but before the
    // mastery journal append. Recover that exact evidence before considering a
    // new billable provider call; the stable operation key must never buy the
    // same assessment twice merely to finish local persistence.
    if (journal.status === 'assessment_bound') {
      const existing = await this.examiner.findAcousticLanguageMasterySubmission(
        userId,
        journal.attemptId,
      );
      if (existing) {
        const recovered = this.recoveredSubmission(
          supplement.evaluation.criteria.map((item) => item.id),
          existing.results,
        );
        if (!recovered) {
          throw new ConflictException(
            'Persisted acoustic evidence cannot be reconciled with the versioned rubric.',
          );
        }
        const decision = this.decision(training, recovered.criteria);
        let persisted = await this.attempts.appendOutcome(userId, {
          attemptId: journal.attemptId,
          assessmentSubmissionId: existing.id,
          decision,
          criteria: recovered.criteria,
        });
        persisted = await this.repairTerminalSideEffects(userId, persisted);
        return {
          attemptId: persisted.attemptId,
          outcome: 'evaluated',
          decision,
          criteria: recovered.criteria,
          assessmentSubmissionId: existing.id,
          completionId: persisted.completionId,
          scripted: recovered.scripted,
          spontaneous: recovered.spontaneous,
          coverage: this.coverage(languageCode),
          replayed: true,
        };
      }
    }

    // Stress/rhythm is a mandatory authored criterion even though the map
    // classifies provider "prosody" as an optional transport dimension. Ask
    // the adapter for every dimension that can satisfy this rubric; a locale
    // that cannot return one remains honestly NOT_EVALUABLE below.
    const requestedDimensions = [
      ...new Set([
        ...acoustic.requiredDimensions,
        ...acoustic.optionalDimensions,
      ]),
    ];
    let scripted: AcousticAssessmentResult;
    let spontaneous: AcousticAssessmentResult;
    if (!coverage.verified || !coverage.providerLocale) {
      scripted = this.neutralResult(
        languageCode,
        'locale-mode-not-verified',
        'scripted-reference',
      );
      spontaneous = this.neutralResult(
        languageCode,
        'locale-mode-not-verified',
        'spontaneous',
      );
    } else {
      scripted = await this.speech.assessPronunciation(
        scriptedAudio.buffer,
        {
          mimeType: scriptedAudio.mimetype || 'application/octet-stream',
          locale: coverage.providerLocale,
          mode: 'scripted-reference',
          rubricVersion: supplement.contentVersion,
          requiredDimensions: requestedDimensions,
          referenceText,
        },
      );
      spontaneous = scripted.outcome === 'evaluated'
        ? await this.speech.assessPronunciation(
            spontaneousAudio.buffer,
            {
              mimeType: spontaneousAudio.mimetype || 'application/octet-stream',
              locale: coverage.providerLocale,
              mode: 'spontaneous',
              rubricVersion: supplement.contentVersion,
              requiredDimensions: requestedDimensions,
            },
          )
        : this.neutralResult(
            languageCode,
            scripted.reason ?? 'provider-not-evaluable',
            'spontaneous',
          );
    }

    const scored = this.criteria(supplement.evaluation.criteria.map((item) => item.id), scripted, spontaneous);
    if (!scored) {
      const autonomy: LanguageAutonomyEvidence = {
        id: journal.attemptId,
        completed: true,
        helpUsed: false,
        answerLeak: false,
        items: [{
          id: milestone.criterionId,
          responseMode: 'voice',
          state: 'not-evaluable',
          awardedPoints: null,
          maximumPoints: null,
        }],
      };
      const decision = decideLanguageMilestoneMastery({ training, autonomy });
      const criteria = supplement.evaluation.criteria.map((item) => ({
        id: item.id,
        met: false,
        score: null,
      }));
      const persisted = await this.attempts.appendNotEvaluable(userId, {
        attemptId: journal.attemptId,
        decision,
        criteria,
      });
      return {
        attemptId: persisted.attemptId,
        outcome: 'not-evaluable',
        decision,
        criteria,
        assessmentSubmissionId: null,
        completionId: null,
        scripted,
        spontaneous,
        coverage,
        replayed: false,
      };
    }

    const decision = this.decision(training, scored);
    const assessment = await this.examiner.createAcousticLanguageMasteryAssessment(userId, {
      attemptId: journal.attemptId,
      profileId,
      courseSessionId: session.id,
      unitId: active.unitId,
      lessonId: lesson.id,
      contentVersion: lesson.contentVersion,
      policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
      criterionIds: scored.map((item) => item.id),
      topic: `${lesson.topic} — native pronunciation`,
      difficulty: milestone.level === 'A1' || milestone.level === 'A2'
        ? 'beginner'
        : milestone.level === 'B1' || milestone.level === 'B2'
          ? 'intermediate'
          : 'advanced',
    });
    await this.attempts.bindAssessment(userId, journal.attemptId, assessment.id);
    const normalizedEvidence = { scripted, spontaneous };
    const results = scored.map<GradedAnswer>((criterion, index) => ({
      questionId: assessment.questions[index]!.id,
      prompt: assessment.questions[index]!.prompt,
      learnerAnswer: '[audio not retained]',
      awarded: criterion.score!,
      max: 1,
      verdict: criterion.met ? 'correct' : criterion.score! > 0 ? 'partial' : 'incorrect',
      why: criterion.met
        ? 'The normalized native-audio evidence meets this versioned criterion.'
        : 'The normalized native-audio evidence is below this versioned criterion.',
      how: criterion.met
        ? 'Keep practising the same pattern in new situations.'
        : 'Practise this exact acoustic dimension, then record a new independent attempt.',
      errorMade: criterion.met ? null : 'The acoustic criterion is below the mastery threshold.',
      howToAvoid: criterion.met ? null : 'Use targeted listening and production practice before retrying.',
      // Persist only the normalized provider-independent contract. No raw
      // audio, transcript, reference text or vendor body is retained.
      acousticEvidence: normalizedEvidence,
    } as GradedAnswer));
    const evidenceHash = createHash('sha256')
      .update(JSON.stringify(normalizedEvidence))
      .digest('hex');
    const submission = await this.examiner.recordAcousticLanguageMasterySubmission(
      userId,
      assessment.id,
      {
        attemptId: journal.attemptId,
        evidenceHash,
        results,
        summary: decision.verdict === 'mastered'
          ? 'Native pronunciation evidence meets every versioned criterion.'
          : 'Native pronunciation evidence identifies specific acoustic dimensions to reinforce.',
        advice: decision.verdict === 'mastered'
          ? 'Continue with varied spontaneous speaking practice.'
          : 'Repeat targeted practice, then submit new scripted and spontaneous recordings.',
      },
    );
    let persisted = await this.attempts.appendOutcome(userId, {
      attemptId: journal.attemptId,
      assessmentSubmissionId: submission.id,
      decision,
      criteria: scored,
    });
    persisted = await this.repairTerminalSideEffects(userId, persisted);
    return {
      attemptId: persisted.attemptId,
      outcome: 'evaluated',
      decision,
      criteria: scored,
      assessmentSubmissionId: submission.id,
      completionId: persisted.completionId,
      scripted,
      spontaneous,
      coverage,
      replayed: false,
    };
  }

  private decision(
    training: readonly LanguageTrainingEvidence[],
    criteria: readonly LanguageMasteryAttemptCriterion[],
  ): LanguageMasteryDecision {
    const autonomy: LanguageAutonomyEvidence = {
      id: 'native-acoustic-evidence',
      completed: true,
      helpUsed: false,
      answerLeak: false,
      items: criteria.map((item) => ({
        id: item.id,
        responseMode: 'voice',
        state: 'evaluated',
        awardedPoints: item.score,
        maximumPoints: 1,
      })),
    };
    let decision = decideLanguageMilestoneMastery({ training, autonomy });
    // The aggregate can exceed 90% while one authored mandatory dimension is
    // below threshold. Mandatory criteria are conjunctive and never disappear
    // into an average.
    if (decision.verdict === 'mastered' && criteria.some((item) => !item.met)) {
      decision = { ...decision, verdict: 'not-mastered', reason: 'below-threshold' };
    }
    return decision;
  }

  private async repairTerminalSideEffects(
    userId: string,
    journal: LanguageMasteryAttemptProjection,
  ): Promise<LanguageMasteryAttemptProjection> {
    if (journal.status !== 'evaluated' || !journal.decision) return journal;
    if (journal.verdict === 'mastered' && !journal.completionId) {
      return this.attempts.publishCompletion(userId, journal.attemptId);
    }
    if (journal.verdict === 'not-mastered' && !journal.remediation?.planId) {
      await this.attempts.startRemediationPlan(userId, {
        failedAttemptId: journal.attemptId,
        idempotencyKey: `milestone-failure:${journal.attemptId}`,
      });
      return this.attempts.get(userId, journal.attemptId);
    }
    return journal;
  }

  private recoveredSubmission(
    criterionIds: readonly string[],
    results: readonly GradedAnswer[],
  ): {
    criteria: LanguageMasteryAttemptCriterion[];
    scripted: AcousticAssessmentResult;
    spontaneous: AcousticAssessmentResult;
  } | null {
    if (criterionIds.length !== 3 || results.length !== criterionIds.length) return null;
    const criteria: LanguageMasteryAttemptCriterion[] = [];
    let evidenceJson: string | null = null;
    let evidence: Record<string, unknown> | null = null;
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index]!;
      if (
        result.learnerAnswer !== '[audio not retained]'
        || !Number.isFinite(result.awarded)
        || !Number.isFinite(result.max)
        || result.max <= 0
        || result.awarded < 0
        || result.awarded > result.max
      ) return null;
      const score = result.awarded / result.max;
      criteria.push({
        id: criterionIds[index]!,
        score,
        met: score >= LANGUAGE_MASTERY_THRESHOLD,
      });
      const candidate = (result as GradedAnswer & { acousticEvidence?: unknown })
        .acousticEvidence;
      if (!this.isRecord(candidate)) return null;
      const serialized = JSON.stringify(candidate);
      if (evidenceJson !== null && evidenceJson !== serialized) return null;
      evidenceJson = serialized;
      evidence = candidate;
    }
    if (!evidence) return null;
    const scripted = this.storedAcousticResult(
      evidence.scripted,
      'scripted-reference',
    );
    const spontaneous = this.storedAcousticResult(
      evidence.spontaneous,
      'spontaneous',
    );
    return scripted && spontaneous ? { criteria, scripted, spontaneous } : null;
  }

  private storedAcousticResult(
    value: unknown,
    mode: AcousticAssessmentResult['mode'],
  ): AcousticAssessmentResult | null {
    if (
      !this.isRecord(value)
      || value.contractVersion !== ACOUSTIC_ASSESSMENT_CONTRACT_VERSION
      || value.mode !== mode
      || value.outcome !== 'evaluated'
      || value.reason !== null
      || typeof value.rubricVersion !== 'string'
      || typeof value.requestedLocale !== 'string'
      || !Array.isArray(value.dimensions)
      || value.dimensions.length === 0
    ) return null;
    for (const dimension of value.dimensions) {
      if (
        !this.isRecord(dimension)
        || !['accuracy', 'fluency', 'prosody'].includes(String(dimension.kind))
        || typeof dimension.rawValue !== 'number'
        || !Number.isFinite(dimension.rawValue)
        || !this.isRecord(dimension.range)
        || typeof dimension.range.min !== 'number'
        || typeof dimension.range.max !== 'number'
        || !Number.isFinite(dimension.range.min)
        || !Number.isFinite(dimension.range.max)
        || dimension.range.min >= dimension.range.max
        || dimension.rawValue < dimension.range.min
        || dimension.rawValue > dimension.range.max
      ) return null;
    }
    return value as unknown as AcousticAssessmentResult;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  private coverage(languageCode: SupportedLanguageCode): AcousticMasteryResponse['coverage'] {
    const configured = this.config.get<AcousticCoverageConfig>('speech.languageMasteryV1');
    const providerLocale = configured?.pronunciationAssessmentLocales?.[languageCode] ?? null;
    return {
      languageCode,
      providerLocale,
      verified: languageMasteryStrictRuntimeAvailable({
        featureEnabled: this.featureFlags.enabled('languageMasteryV1'),
        languageCode,
        coverage: configured,
        supportsSynthesis: this.speech.supportsSynthesis,
        supportsPronunciationAssessment: this.speech.supportsPronunciationAssessment,
        pronunciationAssessmentProvider:
          this.speech.activePronunciationAssessmentProvider,
      }),
    };
  }

  private criteria(
    criterionIds: string[],
    scripted: AcousticAssessmentResult,
    spontaneous: AcousticAssessmentResult,
  ): LanguageMasteryAttemptCriterion[] | null {
    if (scripted.outcome !== 'evaluated' || spontaneous.outcome !== 'evaluated') return null;
    const scriptedAccuracy = this.dimension(scripted, 'accuracy');
    const spontaneousAccuracy = this.dimension(spontaneous, 'accuracy');
    const scriptedFluency = this.dimension(scripted, 'fluency');
    const spontaneousFluency = this.dimension(spontaneous, 'fluency');
    const scriptedProsody = this.dimension(scripted, 'prosody');
    const spontaneousProsody = this.dimension(spontaneous, 'prosody');
    // The authored rubric includes stress/rhythm. If the verified locale does
    // not expose prosody, that mandatory criterion is not evaluable; accuracy
    // or an STT transcript must never silently stand in for it.
    if (
      scriptedAccuracy === null
      || spontaneousAccuracy === null
      || scriptedFluency === null
      || spontaneousFluency === null
      || scriptedProsody === null
      || spontaneousProsody === null
      || criterionIds.length !== 3
    ) return null;
    const scores = [
      Math.min(scriptedAccuracy, spontaneousAccuracy),
      Math.min(scriptedProsody, spontaneousProsody),
      Math.min(spontaneousAccuracy, spontaneousFluency),
    ];
    return criterionIds.map((id, index) => ({
      id,
      score: scores[index]!,
      met: scores[index]! >= LANGUAGE_MASTERY_THRESHOLD,
    }));
  }

  private dimension(
    result: AcousticAssessmentResult,
    kind: 'accuracy' | 'fluency' | 'prosody',
  ): number | null {
    const item = result.dimensions.find((candidate) => candidate.kind === kind);
    if (!item) return null;
    const ratio = (item.rawValue - item.range.min) / (item.range.max - item.range.min);
    return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : null;
  }

  private neutralResult(
    languageCode: SupportedLanguageCode,
    reason: AcousticAssessmentReason,
    mode: AcousticAssessmentResult['mode'],
  ): AcousticAssessmentResult {
    return {
      contractVersion: ACOUSTIC_ASSESSMENT_CONTRACT_VERSION,
      rubricVersion: LANGUAGE_MASTERY_POLICY_VERSION,
      provider: this.speech.activePronunciationAssessmentProvider,
      providerModel: null,
      providerAdapterVersion: null,
      requestedLocale: languageCode,
      providerLocale: null,
      mode,
      referenceTextFingerprint: null,
      providerRequestId: null,
      audioSeconds: null,
      outcome: 'not-evaluable',
      dimensions: [],
      reason,
    };
  }

  private courseSnapshot(value: unknown): StoredCourseSnapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ConflictException('Language course state is unavailable.');
    }
    const metadata = (value as Record<string, unknown>).metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new ConflictException('Language course metadata is unavailable.');
    }
    const state = (metadata as Record<string, unknown>).rlleCourse;
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new ConflictException('Language course state is unavailable.');
    }
    const candidate = state as Partial<StoredCourseSnapshot>;
    if (!candidate.milestoneMastery || typeof candidate.milestoneMastery !== 'object') {
      throw new ConflictException('Language mastery state is unavailable.');
    }
    return candidate as StoredCourseSnapshot;
  }

  private exercise(value: unknown, index: number): Record<string, unknown> {
    if (!Number.isInteger(index) || index < 0 || !Array.isArray(value)) {
      throw new BadRequestException('A valid pronunciation exercise index is required.');
    }
    const exercise = value[index];
    if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
      throw new BadRequestException('Versioned pronunciation exercise not found.');
    }
    return exercise as Record<string, unknown>;
  }

  private requireAudio(file: UploadedFileLike): void {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
      throw new BadRequestException('Both scripted and spontaneous audio recordings are required.');
    }
    const mimeType = String(file.mimetype ?? '')
      .split(';', 1)[0]!
      .trim()
      .toLowerCase();
    const buffer = file.buffer;
    const isWav = (mimeType === 'audio/wav' || mimeType === 'audio/x-wav')
      && buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WAVE';
    const isOgg = mimeType === 'audio/ogg'
      && buffer.length >= 4
      && buffer.toString('ascii', 0, 4) === 'OggS';
    const isWebm = mimeType === 'audio/webm'
      && buffer.length >= 4
      && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isMp4 = ['audio/mp4', 'audio/m4a', 'audio/x-m4a'].includes(mimeType)
      && buffer.length >= 12
      && buffer.toString('ascii', 4, 8) === 'ftyp';
    if (!isWav && !isOgg && !isWebm && !isMp4) {
      throw new BadRequestException(
        'The uploaded recording is not a supported audio container.',
      );
    }
  }

  private required(value: string, label: string, max: number): string {
    const normalized = value?.trim();
    if (!normalized || normalized.length > max) {
      throw new BadRequestException(`A valid ${label} is required.`);
    }
    return normalized;
  }
}
