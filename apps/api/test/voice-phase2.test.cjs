'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { OpenAISpeechProvider } = require('../dist/speech/providers/openai-speech.provider.js');
const { SpeechService } = require('../dist/speech/speech.service.js');
const { languageSystemPrompt } = require('../dist/languages/language-modes.js');

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
  const speech = await provider.synthesize('Bonjour');
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
  const result = await service.synthesize('A deliberately longer sentence for quota reservation.');
  assert.equal(result.model, 'gpt-tts-test');
  assert.equal(calls, 1);
  assert.ok(envelope.units > 1);
  assert.equal(envelope.quotaUnits(result), 1);
  assert.equal(envelope.measure(result).providerRequestId, 'req-1');
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
});

test('Tutor context prefers declared explanation then teaching language without replacing the target', () => {
  const source = read('apps/api/src/tutor/tutor.service.ts');
  const explanation = source.indexOf('passport?.explanationLanguage');
  const teaching = source.indexOf('passport?.teachingLanguage', explanation);
  const ui = source.indexOf('passport?.interfaceLanguage', teaching);
  assert.ok(explanation >= 0 && teaching > explanation && ui > teaching);
  assert.match(source, /targetLanguage:[\s\S]*profile\.normalizedLanguage[\s\S]*passport\?\.targetLanguage/);
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
