'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { languageSystemPrompt } = require('../dist/languages/language-modes.js');
const { SpeechController } = require('../dist/speech/speech.controller.js');

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

test('speech endpoints report real capabilities and return provider transcription unchanged', async () => {
  const speech = {
    activeProvider: 'fake', supportsSynthesis: false, supportsAnalysis: false,
    transcribe: async (buffer, options) => ({ text: buffer.toString('utf8'), language: options.language ?? null, provider: 'fake', model: null }),
  };
  const controller = new SpeechController(speech);
  assert.deepEqual(controller.capabilities(), { provider: 'fake', transcription: true, synthesis: false, audioAnalysis: false });
  const result = await controller.transcribe({ originalname: 'turn.webm', mimetype: 'audio/webm', size: 5, buffer: Buffer.from('hello') }, 'en');
  assert.equal(result.text, 'hello');
  assert.equal(result.language, 'en');
});

test('language conversations create a language ExperienceSession and Tutor reuses it', () => {
  const conversation = read('apps/api/src/languages/conversation.service.ts');
  const experiences = read('apps/api/src/experience-sessions/experience-session.service.ts');
  assert.match(conversation, /type: 'language'/);
  assert.match(conversation, /languageProfileId: profile\.id/);
  assert.match(conversation, /immersionIntensity/);
  assert.match(conversation, /correctionIntensity/);
  assert.match(experiences, /\['tutor', 'language'\]/);
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
