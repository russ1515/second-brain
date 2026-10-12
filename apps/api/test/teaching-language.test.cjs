'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { AssessmentService } = require('../dist/lessons/assessment.service.js');
const { VoiceService } = require('../dist/tutor/voice.service.js');
const { LanguageWritingService } = require('../dist/languages/language-writing.service.js');
const { LanguageService } = require('../dist/languages/language.service.js');
const { languageSystemPrompt } = require('../dist/languages/language-modes.js');
const { resolveLanguageTeachingRoles } = require('../dist/common/language-teaching.js');
const {
  LANGUAGE_MODES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
} = require('@second-brain/shared');

const profile = {
  id: 'language-1',
  userId: 'user-1',
  language: 'English',
  normalizedLanguage: 'en',
  nativeLanguage: 'Lingala',
  teachingLanguageSource: 'native',
  mode: 'beginner',
  cefrLevel: 'A1',
  goal: 'Introduce myself',
  vocabDeckId: null,
  createdAt: new Date('2026-10-12T10:00:00.000Z'),
  updatedAt: new Date('2026-10-12T10:00:00.000Z'),
};

test('invalid native teaching source is rejected before creating its FSRS deck', async () => {
  let deckCreates = 0;
  const service = new LanguageService({
    languageProfile: { findMany: async () => [] },
    deck: { create: async () => { deckCreates += 1; throw new Error('must not run'); } },
  }, {}, {});

  await assert.rejects(
    service.create('user-1', {
      language: 'en',
      teachingLanguageSource: 'native',
    }),
    /native language must be registered/i,
  );
  assert.equal(deckCreates, 0);
});

test('language assessment keeps the rubric but writes correction in the per-path teaching language', async () => {
  let system = '';
  const prisma = {
    onboardingProfile: { findUnique: async () => ({ teacher: null }) },
    languageProfile: { findFirst: async () => profile },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
  };
  const llm = {
    generate: async (messages) => {
      system = messages[0].content;
      return {
        text: JSON.stringify({
          correct: true, score: 1, why: 'malamu', how: 'ndenge',
          error: '', avoid: '', feedback: 'kobá',
        }),
      };
    },
  };
  const service = new AssessmentService(prisma, llm, {}, {});
  const result = await service.gradeEphemeral(
    'user-1',
    {
      topic: 'Greetings', language: 'English', conceptId: null,
      languageProfileId: profile.id,
    },
    { type: 'open', question: 'Introduce yourself.', answer: 'My name is Ada.' },
    0,
    'My name is Ada.',
  );

  assert.equal(result.attempt.correct, true);
  assert.match(system, /production against the unchanged rubric/i);
  assert.match(system, /feedback field in Lingala/i);
  assert.match(system, /examples and target expressions in English/i);
});

test('Tutor voice transcribes in the target hint but synthesizes in the persisted teaching language', async () => {
  let transcriptionLanguage = null;
  let synthesisLanguage = null;
  const prisma = {
    tutorSession: {
      findUnique: async () => ({ userId: 'user-1' }),
      findFirst: async () => ({ languageProfile: profile }),
    },
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
  };
  const speech = {
    supportsSynthesis: true,
    activeProvider: 'test',
    transcribe: async (_audio, options) => {
      transcriptionLanguage = options.language;
      return { text: 'Hello', language: 'en' };
    },
    synthesize: async (_text, options) => {
      synthesisLanguage = options.language;
      return { audioBase64: 'AA==', mimeType: 'audio/mpeg', provider: 'test', model: null };
    },
  };
  const tutor = {
    sendMessage: async () => ({
      message: {
        id: 'message-1', role: 'assistant', content: 'Tokoki koloba: Hello — Mbote.',
        viaVoice: true, createdAt: new Date().toISOString(), citations: [],
      },
    }),
  };
  const service = new VoiceService(prisma, speech, tutor, {});
  await service.handleTurn(
    'user-1',
    'session-1',
    { buffer: Buffer.from('audio'), mimetype: 'audio/webm' },
    { speak: true, lesson: false, language: 'en' },
  );

  assert.equal(transcriptionLanguage, 'en');
  assert.equal(synthesisLanguage, 'ln');
});

test('all 34 learning targets keep native/interface teaching-language selection independent', async () => {
  const prisma = {
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
  };
  assert.equal(SUPPORTED_LANGUAGE_CODES.length, 34);
  for (const code of SUPPORTED_LANGUAGE_CODES) {
    const target = SUPPORTED_LANGUAGES[code];
    const nativeRoles = await resolveLanguageTeachingRoles(prisma, 'user-1', {
      language: target.englishName,
      normalizedLanguage: code,
      nativeLanguage: 'Lingala',
      teachingLanguageSource: 'native',
    });
    assert.equal(nativeRoles.supportLanguageCode, 'ln', code);
    assert.equal(nativeRoles.supportLanguage, 'Lingala', code);
    assert.equal(nativeRoles.targetLanguage, target.englishName, code);

    const interfaceRoles = await resolveLanguageTeachingRoles(prisma, 'user-1', {
      language: target.englishName,
      normalizedLanguage: code,
      nativeLanguage: 'Lingala',
      teachingLanguageSource: 'interface',
    });
    assert.equal(interfaceRoles.supportLanguageCode, 'fr', code);
    assert.equal(interfaceRoles.supportLanguage, 'French', code);
    assert.equal(interfaceRoles.targetLanguage, target.englishName, code);
  }
});

test('every teaching mode keeps pedagogy in support language and target examples paired', () => {
  for (const mode of LANGUAGE_MODES) {
    const prompt = languageSystemPrompt({
      language: 'English',
      targetLanguage: 'English',
      interfaceLanguage: 'French',
      supportLanguage: 'Lingala',
      nativeLanguage: 'Lingala',
      mode,
      goal: 'Introduce myself',
      cefrLevel: 'A1',
      immersionIntensity: mode === 'immersion' ? 'full' : undefined,
    });
    assert.match(prompt, /every introduction, explanation, instruction, rule, correction, feedback and summary in Lingala/i, mode);
    assert.match(prompt, /immediate Lingala correspondence/i, mode);
    assert.doesNotMatch(
      prompt,
      /Explain in the target language first|speak ONLY(?: the target language| English)|Never translate anything|give NO translation \(immersion\)/i,
      mode,
    );
  }
});

test('immersion dialogue still returns immediate teaching-language correspondence', async () => {
  let system = '';
  const service = new LanguageWritingService(
    {
      generate: async (messages) => {
        system = messages[0].content;
        return {
          text: JSON.stringify({
            title: 'Greeting',
            lines: [{ speaker: 'A', text: 'Hello!', translation: 'Mbote!' }],
          }),
        };
      },
    },
    {
      requireOwned: async () => ({ ...profile, mode: 'immersion' }),
      promptRoles: async () => ({
        interfaceLanguage: 'French',
        supportLanguage: 'Lingala',
        supportLanguageCode: 'ln',
        targetLanguage: 'English',
        teachingLanguageSource: 'native',
      }),
    },
  );
  const result = await service.dialogue('user-1', profile.id, 'meeting someone');
  assert.match(system, /"translation"/);
  assert.doesNotMatch(system, /give NO translation \(immersion\)/i);
  assert.equal(result.lines[0].translation, 'Mbote!');
});
