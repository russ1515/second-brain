import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildPronunciationFeedback,
  type PhoneticAssessmentResult,
  type PhoneticPhonemeEvidence,
  type PhoneticWordEvidence,
} from '@second-brain/shared';

export interface PhoneticEngineInput {
  audio: Buffer;
  mimeType: string;
  expectedText: string;
  targetLanguage: string;
  locale: string;
  learnerLevel: string;
  lessonId: string;
  exerciseId: string;
}
export interface PhoneticRuntimeCapability {
  enabled: boolean;
  available: boolean;
  capability: 'PRACTICE_ONLY' | 'ACOUSTIC_UNCALIBRATED';
  diagnosticStatus: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE';
  reason?: string;
  supportedFormats?: string[];
}
const SCORE_FIELDS = ['overallAcousticScore', 'accuracyScore', 'completenessScore', 'fluencyScore', 'prosodyScore'] as const;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 256 * 1024;
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

/** Experimental local audio orchestration, NOT the calibrated SpeechService
 * mastery provider. Disabled unless an operator explicitly configures it.
 * Never calls STT, TTS, an LLM or any paid provider; never logs audio/text. */
@Injectable()
export class PhoneticAssessmentEngine {
  private busy = false;
  private capabilityCache: { checkedAt: number; value: PhoneticRuntimeCapability } | null = null;
  constructor(private readonly config: ConfigService) {}

  /** Readiness is a private, bounded, no-audio probe of the exact installed
   * version/artifacts. A configured path alone is not runtime availability. */
  async capabilities(): Promise<PhoneticRuntimeCapability> {
    const enabled = this.config.get<string>('PHONETIC_ENGINE_ENABLED') === 'true';
    const off = (reason: string): PhoneticRuntimeCapability => ({ enabled,
      available: false, capability: 'PRACTICE_ONLY',
      diagnosticStatus: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE', reason });
    if (!enabled) return off('FEATURE_DISABLED');
    const python = this.config.get<string>('PHONETIC_ENGINE_PYTHON');
    const script = this.config.get<string>('PHONETIC_ENGINE_SCRIPT');
    if (!python || !script || !isAbsolute(python) || !isAbsolute(script)) return off('LOCAL_ENGINE_NOT_CONFIGURED');
    if (this.capabilityCache && Date.now() - this.capabilityCache.checkedAt < 60_000) return this.capabilityCache.value;
    if (this.busy) return off('LOCAL_ENGINE_BUSY');
    this.busy = true;
    let value: PhoneticRuntimeCapability;
    try {
      const raw = await this.run(python, script, null);
      if (!object(raw) || raw.operation !== 'capabilities' || raw.available !== true
        || raw.engineVersion !== 'sb-phonetic-v1-pocketsphinx-5.0.4'
        || raw.language !== 'en' || raw.locale !== 'en-US' || raw.masteryEligible !== false
        || raw.calibrationStatus !== 'UNCALIBRATED'
        || raw.modelArtifactSha256 !== '1d60fb00c87c143d94a49ebd275f4aeec78996596b183655b8d01c3cdab20870'
        || raw.lexiconSha256 !== 'b5ef92f6b9584f30fb8552acce799e5ff432d0b19bd81488a9a6b20a6bd2d644') {
        value = off('ENGINE_READINESS_NOT_VERIFIED');
      } else {
        const formats = Array.isArray(raw.supportedFormats) ? raw.supportedFormats.filter((format) =>
          ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mp4'].includes(String(format))) as string[] : ['audio/wav'];
        value = { enabled: true, available: true, capability: 'ACOUSTIC_UNCALIBRATED',
          diagnosticStatus: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE', supportedFormats: formats };
      }
    } catch { value = off('ENGINE_READINESS_FAILED'); }
    finally { this.busy = false; }
    this.capabilityCache = { checkedAt: Date.now(), value };
    return value;
  }

  async assess(input: PhoneticEngineInput): Promise<PhoneticAssessmentResult> {
    if (!input.audio?.length || input.audio.length > MAX_AUDIO_BYTES
      || !input.expectedText?.trim() || input.expectedText.length > 500
      || !/^[a-zA-Z-]{2,20}$/.test(input.targetLanguage)
      || !/^[a-zA-Z-]{2,20}$/.test(input.locale)) {
      return this.unavailable(input, 'INVALID_INPUT');
    }
    const enabled = this.config.get<string>('PHONETIC_ENGINE_ENABLED') === 'true';
    const python = this.config.get<string>('PHONETIC_ENGINE_PYTHON');
    const script = this.config.get<string>('PHONETIC_ENGINE_SCRIPT');
    if (!enabled || !python || !script || !isAbsolute(python) || !isAbsolute(script)) {
      return this.unavailable(input, 'LOCAL_ENGINE_NOT_CONFIGURED');
    }
    if (this.busy) return this.unavailable(input, 'LOCAL_ENGINE_BUSY');
    this.busy = true;
    try {
      const raw = await this.run(python, script, input);
      return validatePhoneticEngineResult(raw, input);
    } catch {
      // Child stderr, filenames, transcripts and arbitrary model exceptions are
      // intentionally not surfaced or logged. Stable diagnostics only.
      return this.unavailable(input, 'LOCAL_ENGINE_FAILED', true);
    } finally { this.busy = false; }
  }

  private run(python: string, script: string, input: PhoneticEngineInput | null): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = spawn(python, [script], {
        windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Do not pass API/SMTP/DB/tunnel secrets to inference. PYTHONPATH is
          // an operator dependency path, not client supplied.
          PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
          PYTHONPATH: this.config.get<string>('PHONETIC_ENGINE_PYTHONPATH'),
          PHONETIC_FFMPEG_EXECUTABLE: this.config.get<string>('PHONETIC_FFMPEG_EXECUTABLE'),
          PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1',
          OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1', MKL_NUM_THREADS: '1',
        },
      });
      const chunks: Buffer[] = [];
      let bytes = 0;
      let stderrBytes = 0;
      let settled = false;
      const finish = (err?: Error, value?: unknown) => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        if (err) { child.kill(); reject(err); } else resolve(value);
      };
      const timer = setTimeout(() => finish(new Error('LOCAL_ENGINE_TIMEOUT')), 60_000);
      child.on('error', () => finish(new Error('LOCAL_ENGINE_START_FAILED')));
      child.stdin.on('error', () => finish(new Error('LOCAL_ENGINE_INPUT_FAILED')));
      child.stdout.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_OUTPUT_BYTES) finish(new Error('LOCAL_ENGINE_OUTPUT_LIMIT'));
        else chunks.push(chunk);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > 64 * 1024) finish(new Error('LOCAL_ENGINE_DIAGNOSTIC_LIMIT'));
        // Never log model/audio content.
      });
      child.on('close', (code) => {
        if (settled) return;
        if (code !== 0) return finish(new Error('LOCAL_ENGINE_EXIT'));
        try { finish(undefined, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { finish(new Error('LOCAL_ENGINE_OUTPUT_INVALID')); }
      });
      child.stdin.end(JSON.stringify(input ? {
        audioBase64: input.audio.toString('base64'), mimeType: input.mimeType,
        expectedText: input.expectedText, targetLanguage: input.targetLanguage,
        locale: input.locale, learnerLevel: input.learnerLevel,
        lessonId: input.lessonId, exerciseId: input.exerciseId,
      } : { operation: 'capabilities' }));
    });
  }

  private unavailable(input: PhoneticEngineInput, code: string, technical = false): PhoneticAssessmentResult {
    return {
      status: technical ? 'TECHNICAL_ERROR' : 'NOT_EVALUABLE', language: input.targetLanguage,
      locale: null, engineVersion: 'sb-phonetic-v1-disabled', expectedText: input.expectedText,
      overallAcousticScore: null, accuracyScore: null, completenessScore: null, fluencyScore: null, prosodyScore: null,
      words: [], phonemes: [], errors: [{ code }], evidence: {}, confidence: null,
      calibrationStatus: 'UNCALIBRATED', masteryEligible: false, capability: 'PRACTICE_ONLY',
      feedback: [{ kind: 'UNCALIBRATED_NOTICE', certainty: 'TECHNICAL_OBSERVATION' }],
    };
  }
}

/** Exported for deterministic hostile-adapter tests. No provider flags or
 * arbitrary JSON fields may turn an experimental observation into a grade. */
export function validatePhoneticEngineResult(raw: unknown, input: PhoneticEngineInput): PhoneticAssessmentResult {
  if (!object(raw) || !['EVIDENCE_AVAILABLE', 'NOT_EVALUABLE', 'TECHNICAL_ERROR'].includes(String(raw.status))
    || raw.language !== input.targetLanguage || raw.expectedText !== input.expectedText
    || typeof raw.engineVersion !== 'string' || raw.engineVersion.length > 120
    || raw.calibrationStatus !== 'UNCALIBRATED' || raw.masteryEligible !== false
    || raw.confidence !== null || SCORE_FIELDS.some((field) => raw[field] !== null)
    || !Array.isArray(raw.words) || raw.words.length > 128
    || !Array.isArray(raw.phonemes) || raw.phonemes.length > 1024
    || !Array.isArray(raw.errors) || raw.errors.length > 128 || !object(raw.evidence)) {
    throw new Error('PHONETIC_CONTRACT_INVALID');
  }
  const available = raw.status === 'EVIDENCE_AVAILABLE';
  const expectedWords = input.expectedText.normalize('NFKC').replace(/’/g, "'").toLowerCase()
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
  if (available && (raw.capability !== 'ACOUSTIC_UNCALIBRATED' || input.targetLanguage !== 'en'
    || raw.locale !== 'en-US' || !['en', 'en-us'].includes(input.locale.toLowerCase())
    || raw.words.length !== expectedWords.length || !raw.words.length
    || !raw.phonemes.length)) throw new Error('PHONETIC_CAPABILITY_INVALID');
  const validTiming = (entry: Record<string, unknown>) => finite(entry.startMs) && finite(entry.endMs)
    && entry.startMs >= 0 && entry.endMs > entry.startMs && entry.endMs <= 30_000
    && finite(entry.rawAcousticScore) && finite(entry.rawAcousticScorePerFrame) && entry.confidence === null;
  const words: PhoneticWordEvidence[] = raw.words.map((entry, index) => {
    if (!object(entry) || entry.index !== index || typeof entry.word !== 'string' || entry.word.length > 80
      || entry.word.normalize('NFKC').replace(/’/g, "'").toLowerCase() !== expectedWords[index]
      || !validTiming(entry) || !Array.isArray(entry.phonemeIndexes)
      || !entry.phonemeIndexes.every((value) => Number.isInteger(value) && value >= 0 && value < (raw.phonemes as unknown[]).length)) {
      throw new Error('PHONETIC_WORD_INVALID');
    }
    return { word: expectedWords[index]!, index, startMs: entry.startMs as number, endMs: entry.endMs as number,
      rawAcousticScore: entry.rawAcousticScore as number, rawAcousticScorePerFrame: entry.rawAcousticScorePerFrame as number,
      confidence: null, phonemeIndexes: entry.phonemeIndexes as number[] };
  });
  const phonemes: PhoneticPhonemeEvidence[] = raw.phonemes.map((entry, index) => {
    if (!object(entry) || entry.index !== index || !Number.isInteger(entry.wordIndex)
      || (entry.wordIndex as number) < 0 || (entry.wordIndex as number) >= words.length
      || typeof entry.expectedPhoneme !== 'string' || !entry.expectedPhoneme || entry.expectedPhoneme.length > 20
      || entry.observed !== null || entry.bestAlternative !== null || !validTiming(entry)) {
      throw new Error('PHONETIC_PHONE_INVALID');
    }
    return { index, wordIndex: entry.wordIndex as number, expectedPhoneme: entry.expectedPhoneme,
      startMs: entry.startMs as number, endMs: entry.endMs as number,
      rawAcousticScore: entry.rawAcousticScore as number, rawAcousticScorePerFrame: entry.rawAcousticScorePerFrame as number,
      confidence: null, observed: null, bestAlternative: null };
  });
  for (const [index, word] of words.entries()) {
    if ((index > 0 && word.startMs < words[index - 1]!.endMs)
      || !word.phonemeIndexes.length || new Set(word.phonemeIndexes).size !== word.phonemeIndexes.length) {
      throw new Error('PHONETIC_WORD_BOUNDARIES_INVALID');
    }
    for (const phoneIndex of word.phonemeIndexes) {
      const phone = phonemes[phoneIndex]!;
      if (phone.wordIndex !== index || phone.startMs < word.startMs || phone.endMs > word.endMs) {
        throw new Error('PHONETIC_PHONE_PARENT_INVALID');
      }
    }
  }
  for (const [index, phone] of phonemes.entries()) {
    if (!words[phone.wordIndex]!.phonemeIndexes.includes(index)
      || (index > 0 && phone.startMs < phonemes[index - 1]!.endMs)) {
      throw new Error('PHONETIC_PHONE_BOUNDARIES_INVALID');
    }
  }
  const errors = raw.errors.map((entry) => {
    if (!object(entry) || typeof entry.code !== 'string' || !/^[A-Z_]{1,80}$/.test(entry.code)
      || (entry.wordIndex !== undefined && (!Number.isInteger(entry.wordIndex) || (entry.wordIndex as number) < 0 || (entry.wordIndex as number) > 127))) {
      throw new Error('PHONETIC_ERROR_INVALID');
    }
    return { code: entry.code, ...(entry.wordIndex !== undefined ? { wordIndex: entry.wordIndex as number } : {}),
      ...(entry.tentative === true ? { tentative: true } : {}) };
  });
  const evidence = sanitizeTechnicalEvidence(raw.evidence, input);
  const duration = object(evidence.audio) ? evidence.audio.durationMs : undefined;
  if (available && (!finite(duration) || duration <= 0 || duration > 30_000
    || words.some((word) => word.endMs > duration + 10))) throw new Error('PHONETIC_AUDIO_BOUNDARIES_INVALID');
  const result: PhoneticAssessmentResult = {
    status: raw.status as PhoneticAssessmentResult['status'], language: input.targetLanguage,
    locale: available ? 'en-US' : null, engineVersion: raw.engineVersion, expectedText: input.expectedText,
    overallAcousticScore: null, accuracyScore: null, completenessScore: null, fluencyScore: null, prosodyScore: null,
    words, phonemes, errors, evidence, confidence: null, calibrationStatus: 'UNCALIBRATED',
    masteryEligible: false, capability: available ? 'ACOUSTIC_UNCALIBRATED' : 'PRACTICE_ONLY',
  };
  result.feedback = buildPronunciationFeedback(result);
  return result;
}

/** Reconstruct nested families field by field. Allowlisting only the outer
 * family would still persist raw audio/secrets/grades from a hostile adapter. */
function sanitizeTechnicalEvidence(raw: Record<string, unknown>, input: PhoneticEngineInput): Record<string, unknown> {
  // Even a legacy adapter omitting this family cannot imply diagnostic
  // confidence. The current forced alignment is a reference, not a detector.
  const result: Record<string, unknown> = {
    pronunciationDiagnostic: { status: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE',
      reason: 'REFERENCE_ALIGNMENT_IS_NOT_A_PHONEME_DIAGNOSIS', confidence: null,
      weakEvidenceCount: 0, weakWords: [], weakPhonemes: [], highConfidenceIssues: [] },
  };
  const numbers: Record<string, readonly string[]> = {
    audio: ['durationMs', 'sampleRate', 'channels', 'sourceSampleRate', 'sourceChannels', 'rmsDbfs', 'peak', 'clippedFraction'],
    timings: ['preprocessingElapsedMs', 'alignmentElapsedMs', 'completenessElapsedMs', 'scoringElapsedMs', 'totalElapsedMs', 'cpuTimeMs'],
    fluency: ['alignedWordCount', 'wordsPerMinute', 'speechSpanMs', 'recordingDurationMs', 'pauseThresholdMs', 'pauseCount', 'totalPauseMs'],
    completeness: ['expectedCount', 'observedCount', 'matchedCount'],
    model: ['wordCount', 'frameRate'],
  };
  const literals: Record<string, Record<string, readonly unknown[]>> = {
    audio: { conversion: ['PCM_WAV', 'CONFIGURED_FFMPEG_PCM16'] },
    completeness: { status: ['EVIDENCE_AVAILABLE', 'NOT_EVALUABLE'], method: ['SECONDARY_ASR_WORD_ALIGNMENT'], tentative: [true], qualityScore: [null], confidence: [null], reason: ['SECONDARY_ASR_NO_HYPOTHESIS', 'SECONDARY_ASR_OUTPUT_TOO_LARGE', 'SECONDARY_ASR_UNAVAILABLE'] },
    fluency: { status: ['EVIDENCE_AVAILABLE', 'NOT_EVALUABLE'], method: ['FORCED_ALIGNMENT_TIMINGS'], tentative: [true], qualityScore: [null], confidence: [null], wordCountSource: ['EXPECTED_ALIGNED_WORDS'], levelJudgement: [null], reason: ['TIMINGS_UNAVAILABLE'] },
    prosody: { status: ['NOT_IMPLEMENTED'], qualityScore: [null], confidence: [null], reason: ['NO_VALIDATED_PROSODY_MODEL'] },
    normalization: { method: ['RAW_LOG_SCORE_DIVIDED_BY_FRAME_COUNT'], crossPhonemeComparable: [false], percentage: [false], calibrated: [false], qualityJudgementAvailable: [false] },
    model: { locale: ['en-US'], g2pMethod: ['CMUDICT_LEXICON_ONLY'], oovPolicy: ['NOT_EVALUABLE'], ipaScope: ['BROAD_US_ENGLISH_STRESSLESS'], stressEvaluated: [false], alignmentMethod: ['TWO_PASS_HMM_FORCED_ALIGNMENT'], referenceOnly: [true], rawScoreType: ['HMM_ACOUSTIC_LOG_LIKELIHOOD_INTEGER'], observedPhonemesAvailable: [false], alternativePhonemesAvailable: [false] },
  };
  for (const family of ['audio', 'completeness', 'fluency', 'prosody', 'normalization', 'timings', 'model', 'pronunciationDiagnostic']) {
    const source = raw[family];
    if (!object(source)) continue;
    const clean: Record<string, unknown> = {};
    if (family === 'pronunciationDiagnostic') {
      // No validated contrasting-phone detector exists. Never trust a future
      // adapter to label an unproven weakness or fabricate a confidence value.
      result[family] = { status: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE',
        reason: 'REFERENCE_ALIGNMENT_IS_NOT_A_PHONEME_DIAGNOSIS', confidence: null,
        weakEvidenceCount: 0, weakWords: [], weakPhonemes: [], highConfidenceIssues: [] };
      continue;
    }
    for (const key of numbers[family] ?? []) {
      if (finite(source[key]) && Math.abs(source[key]) <= 10_000_000) clean[key] = source[key];
    }
    for (const [key, allowed] of Object.entries(literals[family] ?? {})) {
      if (allowed.includes(source[key])) clean[key] = source[key];
    }
    if (family === 'model') {
      for (const key of ['modelArtifactSha256', 'lexiconSha256']) {
        if (typeof source[key] === 'string' && /^[a-f0-9]{64}$/.test(source[key])) clean[key] = source[key];
      }
    }
    if (family === 'fluency') {
      clean.learnerLevel = input.learnerLevel;
      if (Array.isArray(source.pauses)) clean.pauses = source.pauses.slice(0, 80).flatMap((pause) => {
        if (!object(pause) || !finite(pause.startMs) || !finite(pause.durationMs)
          || pause.startMs < 0 || pause.durationMs < 0 || pause.startMs + pause.durationMs > 30_000) return [];
        return [{ startMs: pause.startMs, durationMs: pause.durationMs }];
      });
    }
    if (family === 'completeness') {
      const expected = input.expectedText.normalize('NFKC').replace(/’/g, "'").toLowerCase()
        .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
      if (source.status === 'EVIDENCE_AVAILABLE') {
        const count = (value: unknown, maximum: number): value is number => Number.isInteger(value)
          && (value as number) >= 0 && (value as number) <= maximum;
        if (!count(source.expectedCount, 128) || source.expectedCount !== expected.length
          || !expected.length || !count(source.observedCount, 384)
          || !count(source.matchedCount, Math.min(source.expectedCount, source.observedCount))) {
          throw new Error('PHONETIC_COMPLETENESS_INVALID');
        }
      } else {
        // An unavailable family cannot carry partial or optimistic counts.
        delete clean.expectedCount; delete clean.observedCount; delete clean.matchedCount;
      }
      // Recognition is secondary and fallible. Do not retain a transcript or
      // unexpected spoken words; counts and expected-word indexes suffice.
      for (const kind of ['omissions', 'insertions', 'substitutions']) {
        if (!Array.isArray(source[kind])) continue;
        clean[kind] = source[kind].slice(0, 80).flatMap((item) => {
          if (!object(item)) return [];
          const selected: Record<string, unknown> = {};
          if (Number.isInteger(item.expectedIndex) && (item.expectedIndex as number) >= 0
            && (item.expectedIndex as number) < expected.length) {
            selected.expectedIndex = item.expectedIndex;
            selected.expectedWord = expected[item.expectedIndex as number];
          }
          if (Number.isInteger(item.observedIndex) && (item.observedIndex as number) >= 0
            && (item.observedIndex as number) < 240) {
            selected.observedIndex = item.observedIndex;
          }
          return Object.keys(selected).length ? [selected] : [];
        });
      }
    }
    result[family] = clean;
  }
  return result;
}
