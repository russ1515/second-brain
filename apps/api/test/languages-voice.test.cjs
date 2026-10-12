'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ForbiddenException } = require('@nestjs/common');
const { languageSystemPrompt } = require('../dist/languages/language-modes.js');
const { SpeechController } = require('../dist/speech/speech.controller.js');
const { LanguageService } = require('../dist/languages/language.service.js');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('language Professor prompt keeps target, UI language, CEFR, immersion and correction together', () => {
  const prompt = languageSystemPrompt({
    language: 'English', nativeLanguage: 'French', mode: 'intermediate',
    cefrLevel: 'B1', goal: 'Job interviews', immersionIntensity: 'guided',
    correctionIntensity: 'detailed',
  });
  assert.match(prompt, /English/);
  assert.match(prompt, /French/);
  assert.match(prompt, /B1/);
  assert.match(prompt, /Guided immersion/);
  assert.match(prompt, /Correction intensity is detailed/);
});

test('language profile persists the trusted teaching-language source and rejects an unavailable native source', async () => {
  const now = new Date('2026-10-12T10:00:00.000Z');
  let stored = null;
  const prisma = {
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
    deck: { create: async () => ({ id: 'deck-1' }) },
    card: {
      count: async () => 0,
    },
    languageProfile: {
      findMany: async () => [],
      findUnique: async () => stored,
      create: async ({ data }) => {
        stored = { id: 'lp-1', createdAt: now, updatedAt: now, ...data };
        return stored;
      },
      update: async ({ data }) => {
        stored = { ...stored, ...data, updatedAt: now };
        return stored;
      },
    },
    lesson: {
      count: async () => 0,
      findFirst: async () => null,
    },
    tutorSession: {
      count: async () => 0,
      findFirst: async () => null,
    },
  };
  const service = new LanguageService(prisma, {}, {});

  const created = await service.create('u1', {
    language: 'English',
    nativeLanguage: 'Lingala',
    teachingLanguageSource: 'native',
  });
  assert.equal(created.teachingLanguageSource, 'native');
  assert.equal(stored.teachingLanguageSource, 'native');
  assert.equal((await service.promptRoles('u1', stored)).supportLanguage, 'Lingala');

  const updated = await service.update('u1', 'lp-1', {
    teachingLanguageSource: 'interface',
  });
  assert.equal(updated.teachingLanguageSource, 'interface');
  assert.equal((await service.promptRoles('u1', stored)).supportLanguage, 'French');

  await assert.rejects(
    () => service.update('u1', 'lp-1', {
      nativeLanguage: '', teachingLanguageSource: 'native',
    }),
    /supported native language/i,
  );
});

test('speech endpoints report real capabilities and return provider transcription unchanged', async () => {
  const speech = {
    activeProvider: 'fake', supportsSynthesis: false, supportsAnalysis: false,
    supportsPronunciationAssessment: false,
    activePronunciationAssessmentProvider: null,
    transcribe: async (buffer, options) => ({ text: buffer.toString('utf8'), language: options.language ?? null, provider: 'fake', model: null }),
  };
  const controller = new SpeechController(speech);
  assert.deepEqual(controller.capabilities(), {
    provider: 'fake',
    transcription: true,
    synthesis: false,
    audioAnalysis: false,
    pronunciationAssessment: false,
    pronunciationAssessmentProvider: null,
    languageMasteryV1: {
      enabled: false,
      policyVersion: 'language-mastery-v1',
      transcriptionLanguageCodes: [],
      synthesisLanguageCodes: [],
      pronunciationAssessmentLanguageCodes: [],
    },
  });
  const configuredController = new SpeechController(speech, {
    get: (key) => key === 'features'
      ? { languageMasteryV1: true }
      : key === 'speech.languageMasteryV1'
        ? {
            transcriptionLanguageCodes: ['en'],
            synthesisLanguageCodes: ['en'],
            pronunciationAssessmentLanguageCodes: ['en'],
          }
        : undefined,
  });
  assert.equal(
    configuredController.capabilities().languageMasteryV1.enabled,
    false,
    'a feature flag cannot claim readiness before acoustic evidence and canonical publication are integrated',
  );
  const genericAnalysisOnlySpeech = {
    ...speech,
    supportsSynthesis: true,
    supportsAnalysis: true,
  };
  const genericAnalysisController = new SpeechController(genericAnalysisOnlySpeech, {
    get: (key) => key === 'features'
      ? { languageMasteryV1: true }
      : key === 'speech.languageMasteryV1'
        ? {
            transcriptionLanguageCodes: ['en'],
            synthesisLanguageCodes: ['en'],
            pronunciationAssessmentLanguageCodes: ['en'],
          }
        : undefined,
  });
  assert.equal(
    genericAnalysisController.capabilities().languageMasteryV1.enabled,
    false,
    'generic audio analysis cannot stand in for a dedicated phonetic assessment',
  );
  const fullyCapableSpeech = {
    ...genericAnalysisOnlySpeech,
    supportsPronunciationAssessment: true,
    activePronunciationAssessmentProvider: 'azure-speech-simulated',
  };
  const fullyConfiguredController = new SpeechController(fullyCapableSpeech, {
    get: (key) => key === 'features'
      ? { languageMasteryV1: true }
      : key === 'speech.languageMasteryV1'
        ? {
            transcriptionLanguageCodes: ['en'],
            synthesisLanguageCodes: ['en'],
            pronunciationAssessmentLanguageCodes: ['en'],
          }
        : undefined,
  });
  assert.equal(
    fullyConfiguredController.capabilities().languageMasteryV1.enabled,
    false,
    'external provider capability cannot bypass the code-level strict-path readiness boundary',
  );
  const result = await controller.transcribe({ originalname: 'turn.webm', mimetype: 'audio/webm', size: 5, buffer: Buffer.from('hello') }, 'en');
  assert.equal(result.text, 'hello');
  assert.equal(result.language, 'en');
});

test('TTS endpoint preserves quota errors instead of rewriting them as provider downtime', async () => {
  const quotaError = new ForbiddenException({
    code: 'QUOTA_EXHAUSTED',
    message: 'Voice quota is exhausted.',
  });
  const controller = new SpeechController({
    activeProvider: 'openai',
    supportsSynthesis: true,
    synthesize: async () => {
      throw quotaError;
    },
  });

  await assert.rejects(
    controller.synthesize({ text: 'Bonjour', language: 'fr' }),
    (error) => error === quotaError
      && error.getStatus() === 403
      && error.getResponse().code === 'QUOTA_EXHAUSTED',
  );
});

test('language conversations create a language ExperienceSession and Tutor reuses it', () => {
  const conversation = read('apps/api/src/languages/conversation.service.ts');
  const experiences = read('apps/api/src/experience-sessions/experience-session.service.ts');
  assert.match(conversation, /ensureLanguageSession\(userId/);
  assert.match(conversation, /languageProfileId: profile\.id/);
  assert.match(conversation, /immersionIntensity/);
  assert.match(conversation, /correctionIntensity/);
  assert.match(experiences, /ensureTutorLinkedSession\(userId, 'language', request\)/);
  assert.match(experiences, /SERVER_IDEMPOTENCY_PREFIX = 'server:v2:'/);
  assert.match(experiences, /tutorIdempotencyKey\(tutorSessionId/);
});

test('language vocabulary remains in FSRS with document and session provenance', () => {
  const vocabulary = read('apps/api/src/languages/vocabulary.service.ts');
  const review = read('apps/api/src/flashcards/review-experience.service.ts');
  assert.match(vocabulary, /sourceDocumentId: dto\.documentId/);
  assert.match(vocabulary, /language-vocabulary/);
  assert.match(review, /deckId: context\.language\?\.vocabDeckId/);
  assert.match(review, /languageProfileId: card\.deck\.languageProfiles\[0\]\.id/);
});

test('mobile voice flow is explicit, pausable, editable and has no fake waveform', () => {
  const tutor = read('apps/mobile/app/tutor/[id].tsx');
  const voice = read('apps/mobile/components/ds/language.tsx');
  assert.match(tutor, /\/speech\/stt/);
  assert.match(tutor, /pauseRecording/);
  assert.match(tutor, /resumeRecording/);
  assert.match(tutor, /setDraft\(transcript\.text\)/);
  assert.doesNotMatch(voice, /Animated|amplitudeBars|fakeAmplitude/);
});

test('active language preference and backend profile lookup are user-isolated', () => {
  const preferences = read('apps/mobile/lib/language-preferences.ts');
  const languageService = read('apps/api/src/languages/language.service.ts');
  assert.match(preferences, /ACTIVE_LANGUAGE_PREFIX/);
  assert.match(preferences, /userId/);
  assert.match(languageService, /where: \{ userId \}/);
  assert.match(languageService, /profile\.userId !== userId/);
});
