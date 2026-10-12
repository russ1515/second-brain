'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ForbiddenException } = require('@nestjs/common');
const { OpenAISpeechProvider } = require('../dist/speech/providers/openai-speech.provider.js');
const { SpeechService } = require('../dist/speech/speech.service.js');
const { languageSystemPrompt } = require('../dist/languages/language-modes.js');
const {
  resolveLanguageTeachingRoles,
} = require('../dist/common/language-teaching.js');
const {
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
} = require('@second-brain/shared');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function response(payload, headers = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => payload,
    arrayBuffer: async () => Buffer.from('RIFF-audio').buffer,
  };
}

function oneSecondWav() {
  const byteRate = 16_000;
  const result = Buffer.alloc(44 + byteRate);
  result.write('RIFF', 0, 'ascii');
  result.writeUInt32LE(result.length - 8, 4);
  result.write('WAVEfmt ', 8, 'ascii');
  result.writeUInt32LE(16, 16);
  result.writeUInt16LE(1, 20);
  result.writeUInt16LE(1, 22);
  result.writeUInt32LE(16_000, 24);
  result.writeUInt32LE(byteRate, 28);
  result.writeUInt16LE(1, 32);
  result.writeUInt16LE(8, 34);
  result.write('data', 36, 'ascii');
  result.writeUInt32LE(byteRate, 40);
  return result;
}

test('OpenAI speech maps STT/TTS through the existing provider contract without exposing credentials', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/transcriptions')) {
      assert.equal(init.body.get('model'), 'gpt-transcribe-test');
      assert.equal(init.body.get('language'), 'zh');
      return response({ text: '你好', usage: { seconds: 2.1 } }, { 'x-request-id': 'req-stt' });
    }
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'gpt-tts-test');
    assert.equal(body.voice, 'voice-test');
    assert.equal(body.response_format, 'wav');
    assert.match(body.instructions, /French as the primary narration language/);
    assert.match(body.instructions, /Do not translate, omit or add content/);
    assert.equal(body.input, 'Bonjour');
    return {
      ...response({}, { 'x-request-id': 'req-tts' }),
      arrayBuffer: async () => oneSecondWav(),
    };
  };
  const provider = new OpenAISpeechProvider('private-test-key', 'gpt-transcribe-test', 'gpt-tts-test', 'voice-test', fetcher);
  const transcript = await provider.transcribe(Buffer.from('audio'), { mimeType: 'audio/webm', language: 'zh-Hant' });
  assert.equal(transcript.text, '你好');
  assert.equal(transcript.language, 'zh');
  assert.equal(transcript.audioSeconds, 3);
  assert.equal(transcript.providerRequestId, 'req-stt');
  const speech = await provider.synthesize('Bonjour', { language: 'fr' });
  assert.equal(speech.mimeType, 'audio/wav');
  assert.equal(speech.providerRequestId, 'req-tts');
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.init.headers.Authorization === 'Bearer private-test-key'));
  assert.ok(calls.every((call) => !String(call.init.body).includes('private-test-key')));
});

test('speech metering reserves once, measures WAV duration and does not double-call TTS', async () => {
  let calls = 0;
  let envelope;
  const provider = {
    name: 'openai',
    synthesize: async () => {
      calls += 1;
      return {
        audioBase64: oneSecondWav().toString('base64'),
        mimeType: 'audio/wav',
        provider: 'openai',
        model: 'gpt-tts-test',
        providerRequestId: 'req-1',
      };
    },
    transcribe: async () => ({ text: 'hello', language: 'en', provider: 'openai', model: 'gpt-stt-test' }),
  };
  const metering = {
    executeWithAttempts: async (input, operation) => {
      envelope = input;
      return operation({ attempt: (call) => call() });
    },
  };
  const service = new SpeechService(provider, metering);
  const text = 'A deliberately longer sentence for quota reservation.';
  const result = await service.synthesize(text);
  assert.equal(result.model, 'gpt-tts-test');
  assert.equal(calls, 1);
  assert.equal(envelope.units, Math.ceil(text.length / 3));
  assert.equal(envelope.quotaUnits(result), 1);
  assert.equal(envelope.measure(result).providerRequestId, 'req-1');
});

test('generic audio analysis never substitutes for the dedicated acoustic assessment seam', async () => {
  let genericAnalysisCalls = 0;
  const speech = new SpeechService({
    name: 'gemini',
    transcribe: async () => ({
      text: 'hello', language: 'en', provider: 'gemini', model: 'stt-test',
    }),
    analyze: async () => {
      genericAnalysisCalls += 1;
      return { text: '{"accuracy":100}' };
    },
  });

  assert.equal(speech.supportsAnalysis, true);
  assert.equal(speech.supportsPronunciationAssessment, false);
  const referenceText = 'This answer must never be returned or logged.';
  const result = await speech.assessPronunciation(oneSecondWav(), {
    mimeType: 'audio/wav',
    locale: 'en-US',
    mode: 'scripted-reference',
    rubricVersion: 'language-mastery-v1',
    requiredDimensions: ['accuracy', 'fluency'],
    referenceText,
  });

  assert.equal(genericAnalysisCalls, 0);
  assert.equal(result.outcome, 'not-evaluable');
  assert.equal(result.reason, 'assessment-provider-unavailable');
  assert.deepEqual(result.dimensions, []);
  assert.equal(result.provider, null);
  assert.match(result.referenceTextFingerprint, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(referenceText));
});

test('simulated acoustic provider is metered once and yields only normalized raw dimensions', async () => {
  let providerCalls = 0;
  let meteringCalls = 0;
  let attemptCalls = 0;
  let envelope;
  let attemptEnvelope;
  const acousticProvider = {
    name: 'azure-speech-simulated',
    model: 'pronunciation-assessment-simulated',
    adapterVersion: 'azure-pa-adapter-v1',
    supports: ({ locale, mode, requiredDimensions }) =>
      locale === 'en-US'
      && mode === 'scripted-reference'
      && requiredDimensions.includes('accuracy')
      && requiredDimensions.includes('fluency'),
    assess: async () => {
      providerCalls += 1;
      await Promise.resolve();
      return {
        providerLocale: 'en-US',
        providerRequestId: 'req-acoustic-1',
        audioSeconds: 1,
        outcome: 'evaluated',
        dimensions: [
          { kind: 'accuracy', rawValue: 92, range: { min: 0, max: 100 } },
          { kind: 'fluency', rawValue: 88, range: { min: 0, max: 100 } },
        ],
        reason: null,
      };
    },
  };
  const metering = {
    executeWithAttempts: async (input, operation) => {
      meteringCalls += 1;
      envelope = input;
      const value = await operation({
        attempt: (call, attemptInput) => {
          attemptCalls += 1;
          attemptEnvelope = attemptInput;
          return call();
        },
      });
      assert.equal(input.measure(value).providerRequestId, 'req-acoustic-1');
      return value;
    },
  };
  const speech = new SpeechService({
    name: 'openai',
    transcribe: async () => ({
      text: 'hello', language: 'en', provider: 'openai', model: 'stt-test',
    }),
  }, metering, undefined, acousticProvider);
  const options = {
    mimeType: 'audio/wav',
    locale: 'en-US',
    mode: 'scripted-reference',
    rubricVersion: 'language-mastery-v1',
    requiredDimensions: ['accuracy', 'fluency'],
    referenceText: 'A private scripted answer',
  };

  const [first, second] = await Promise.all([
    speech.assessPronunciation(oneSecondWav(), options),
    speech.assessPronunciation(oneSecondWav(), options),
  ]);

  assert.equal(providerCalls, 1);
  assert.equal(meteringCalls, 1);
  assert.equal(attemptCalls, 1);
  assert.deepEqual(first, second);
  assert.equal(first.outcome, 'evaluated');
  assert.equal(first.provider, 'azure-speech-simulated');
  assert.equal(first.providerAdapterVersion, 'azure-pa-adapter-v1');
  assert.deepEqual(first.dimensions, [
    { kind: 'accuracy', rawValue: 92, range: { min: 0, max: 100 } },
    { kind: 'fluency', rawValue: 88, range: { min: 0, max: 100 } },
  ]);
  assert.equal('score' in first, false);
  assert.equal('transcript' in first, false);
  assert.doesNotMatch(JSON.stringify(first), /A private scripted answer/);
  assert.equal(envelope.provider, 'azure-speech-simulated');
  assert.equal(envelope.model, 'pronunciation-assessment-simulated');
  assert.deepEqual(attemptEnvelope, {
    provider: 'azure-speech-simulated',
    model: 'pronunciation-assessment-simulated',
  });
  assert.equal(envelope.resource, 'VOICE_SECONDS');
  assert.equal(envelope.units, 1);
  assert.equal(envelope.quotaUnits(first), 1);
  assert.doesNotMatch(JSON.stringify(envelope.metadata), /private scripted/i);
});

test('acoustic quota rejection keeps the authoritative 403 and never calls the provider', async () => {
  let providerCalls = 0;
  const quotaError = new ForbiddenException({
    code: 'QUOTA_EXHAUSTED',
    message: 'Voice quota is exhausted.',
  });
  const service = new SpeechService({
    name: 'openai',
    transcribe: async () => ({
      text: 'hello', language: 'en', provider: 'openai', model: 'stt-test',
    }),
  }, {
    executeWithAttempts: async () => {
      throw quotaError;
    },
  }, undefined, {
    name: 'azure-speech-simulated',
    model: 'pronunciation-assessment-simulated',
    adapterVersion: 'azure-pa-adapter-v1',
    supports: () => true,
    assess: async () => {
      providerCalls += 1;
      throw new Error('must not be reached');
    },
  });

  await assert.rejects(
    service.assessPronunciation(oneSecondWav(), {
      mimeType: 'audio/wav',
      locale: 'en-US',
      mode: 'spontaneous',
      rubricVersion: 'language-mastery-v1',
      requiredDimensions: ['accuracy', 'fluency'],
    }),
    (error) => error === quotaError
      && error.getStatus() === 403
      && error.getResponse().code === 'QUOTA_EXHAUSTED',
  );
  assert.equal(providerCalls, 0);
});

test('compressed acoustic input reserves the conservative server cap until provider measurement', async () => {
  let envelope;
  const service = new SpeechService({
    name: 'openai',
    transcribe: async () => ({
      text: 'hello', language: 'en', provider: 'openai', model: 'stt-test',
    }),
  }, {
    executeWithAttempts: async (input, operation) => {
      envelope = input;
      return operation({ attempt: (call) => call() });
    },
  }, undefined, {
    name: 'azure-speech-simulated',
    model: 'pronunciation-assessment-simulated',
    adapterVersion: 'azure-pa-adapter-v1',
    supports: () => true,
    assess: async () => ({
      providerLocale: 'en-US',
      providerRequestId: 'req-compressed',
      audioSeconds: 2,
      outcome: 'evaluated',
      dimensions: [
        { kind: 'accuracy', rawValue: 95, range: { min: 0, max: 100 } },
        { kind: 'fluency', rawValue: 95, range: { min: 0, max: 100 } },
      ],
      reason: null,
    }),
  });

  const result = await service.assessPronunciation(Buffer.from('compressed-webm'), {
    mimeType: 'audio/webm',
    locale: 'en-US',
    mode: 'spontaneous',
    rubricVersion: 'language-mastery-v1',
    requiredDimensions: ['accuracy', 'fluency'],
  });

  assert.equal(envelope.units, 600);
  assert.equal(envelope.metadata.durationMeasurement, 'NOT_INSTRUMENTED');
  assert.equal(envelope.quotaUnits(result), 2);
});

test('malformed or incomplete acoustic responses fail closed without a score', async () => {
  const baseSpeech = {
    name: 'openai',
    transcribe: async () => ({
      text: 'hello', language: 'en', provider: 'openai', model: 'stt-test',
    }),
  };
  const options = {
    mimeType: 'audio/wav',
    locale: 'en-US',
    mode: 'spontaneous',
    rubricVersion: 'language-mastery-v1',
    requiredDimensions: ['accuracy', 'fluency'],
  };
  const provider = (dimensions) => ({
    name: 'azure-speech-simulated',
    model: 'pronunciation-assessment-simulated',
    adapterVersion: 'azure-pa-adapter-v1',
    supports: () => true,
    assess: async () => ({
      providerLocale: 'en-US',
      providerRequestId: 'req-invalid',
      audioSeconds: 1,
      outcome: 'evaluated',
      dimensions,
      reason: null,
    }),
  });

  const missing = await new SpeechService(
    baseSpeech,
    undefined,
    undefined,
    provider([
      { kind: 'accuracy', rawValue: 90, range: { min: 0, max: 100 } },
    ]),
  ).assessPronunciation(oneSecondWav(), options);
  assert.equal(missing.outcome, 'technical-error');
  assert.equal(missing.reason, 'required-dimension-missing');
  assert.deepEqual(missing.dimensions, []);

  const outOfRange = await new SpeechService(
    baseSpeech,
    undefined,
    undefined,
    provider([
      { kind: 'accuracy', rawValue: 101, range: { min: 0, max: 100 } },
      { kind: 'fluency', rawValue: 90, range: { min: 0, max: 100 } },
    ]),
  ).assessPronunciation(oneSecondWav(), options);
  assert.equal(outOfRange.outcome, 'technical-error');
  assert.equal(outOfRange.reason, 'provider-response-invalid');
  assert.deepEqual(outOfRange.dimensions, []);
});

test('unmetered acoustic failures are attributed to the acoustic provider without leaking details', async () => {
  const service = new SpeechService({
    name: 'openai',
    transcribe: async () => ({
      text: 'hello', language: 'en', provider: 'openai', model: 'stt-test',
    }),
  }, undefined, undefined, {
    name: 'azure-speech-simulated',
    model: 'pronunciation-assessment-simulated',
    adapterVersion: 'azure-pa-adapter-v1',
    supports: () => true,
    assess: async () => {
      const error = new Error('private-provider-detail');
      error.code = 'E_ACOUSTIC_TEST';
      throw error;
    },
  });
  const logs = [];
  service.logger.error = (message) => logs.push(String(message));

  const result = await service.assessPronunciation(oneSecondWav(), {
    mimeType: 'audio/wav',
    locale: 'en-US',
    mode: 'spontaneous',
    rubricVersion: 'language-mastery-v1',
    requiredDimensions: ['accuracy', 'fluency'],
  });

  assert.equal(result.outcome, 'technical-error');
  assert.equal(result.reason, 'provider-request-failed');
  assert.equal(logs.length, 1);
  assert.match(logs[0], /provider=azure-speech-simulated/);
  assert.doesNotMatch(logs[0], /provider=openai/);
  assert.doesNotMatch(logs[0], /private-provider-detail/);
});

test('language Professor keeps UI, native, support and target roles separate and paired', () => {
  const prompt = languageSystemPrompt({
    language: 'English',
    targetLanguage: 'en',
    interfaceLanguage: 'fr',
    supportLanguage: 'fr',
    nativeLanguage: 'ln',
    mode: 'intermediate',
    goal: 'Conversation',
  });
  assert.match(prompt, /interface=fr/);
  assert.match(prompt, /native=ln/);
  assert.match(prompt, /explanation\/support=fr/);
  assert.match(prompt, /learning\/target=en/);
  assert.match(prompt, /target.*line first/i);
  assert.match(prompt, /next line/i);
  assert.match(prompt, /Never produce arbitrary mixed-language sentences/);
  assert.match(prompt, /every introduction, explanation, instruction, rule, correction, feedback and summary in fr/i);
  assert.match(prompt, /autonomous assessment[\s\S]*reveal no translation, hint, model answer or correction/i);
});

test('per-path teaching language resolves from native or interface without replacing any target', async () => {
  const prisma = {
    profile: { findUnique: async () => ({ preferredLanguage: 'fr' }) },
  };
  const base = {
    language: 'English', normalizedLanguage: 'en', nativeLanguage: 'Lingala',
  };
  const fromInterface = await resolveLanguageTeachingRoles(prisma, 'u1', {
    ...base, teachingLanguageSource: 'interface',
  });
  assert.equal(fromInterface.supportLanguage, 'French');
  assert.equal(fromInterface.supportLanguageCode, 'fr');
  assert.equal(fromInterface.targetLanguage, 'English');

  const fromNative = await resolveLanguageTeachingRoles(prisma, 'u1', {
    ...base, teachingLanguageSource: 'native',
  });
  assert.equal(fromNative.supportLanguage, 'Lingala');
  assert.equal(fromNative.supportLanguageCode, 'ln');
  assert.equal(fromNative.targetLanguage, 'English');

  for (const targetCode of SUPPORTED_LANGUAGE_CODES) {
    const target = await resolveLanguageTeachingRoles(prisma, 'u1', {
      ...base,
      language: SUPPORTED_LANGUAGES[targetCode].englishName,
      normalizedLanguage: targetCode,
      teachingLanguageSource: 'interface',
    });
    assert.equal(target.supportLanguage, 'French');
    assert.equal(target.targetLanguage, SUPPORTED_LANGUAGES[targetCode].englishName);
  }
});

test('Tutor voice UI preserves one session, provides playback controls and oral exam safeguards', () => {
  const session = read('apps/mobile/app/tutor/[id].tsx');
  const oral = read('apps/mobile/app/tutor/index.tsx');
  const player = read('apps/mobile/components/speak-button.tsx');
  const policy = read('packages/shared/src/teacher-policy.ts');
  assert.match(session, /\/speech\/stt/);
  assert.match(session, /\/tutor\/sessions\/\$\{id\}\/messages/);
  assert.match(session, /viaVoice/);
  assert.match(session, /await speak\(spokenReply/);
  assert.match(player, /pauseSpeaking/);
  assert.match(player, /resumeSpeaking/);
  assert.match(player, /stopSpeaking/);
  assert.match(oral, /form\.append\('speak', 'true'\)/);
  assert.match(oral, /form\.append\('lesson', 'false'\)/);
  assert.match(oral, /languageProfileId/);
  assert.match(policy, /Give no hints or answer before closure/);
  assert.match(policy, /After closure, justify the result by criteria/);
});

test('persistent beta runtime selects OpenAI speech without putting a credential in source', () => {
  const runtime = read('scripts/compose.openai-runtime.yml');
  assert.match(runtime, /SPEECH_PROVIDER: openai/);
  assert.match(runtime, /SPEECH_STT_MODEL: \$\{SPEECH_STT_MODEL:-gpt-4o-mini-transcribe\}/);
  assert.match(runtime, /SPEECH_TTS_MODEL: \$\{SPEECH_TTS_MODEL:-gpt-4o-mini-tts\}/);
  assert.match(runtime, /OPENAI_API_KEY: \$\{OPENAI_API_KEY:\?OPENAI_API_KEY is required\}/);
  assert.doesNotMatch(runtime, /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/);
});
