const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const {
  classifySpeechInputFailure,
  speechInputError,
} = require('../lib/speech-input-error.ts');

test('speech input failures keep permission, recording, transport and STT separate', () => {
  assert.equal(
    classifySpeechInputFailure(speechInputError('MIC_PERMISSION', 'private message'), 'recording'),
    'MIC_PERMISSION',
  );
  assert.equal(
    classifySpeechInputFailure({ name: 'NotSupportedError' }, 'recording'),
    'MEDIARECORDER_UNAVAILABLE',
  );
  assert.equal(
    classifySpeechInputFailure({ name: 'NotReadableError' }, 'recording'),
    'AUDIO_RECORDING',
  );
  assert.equal(
    classifySpeechInputFailure({ status: 0 }, 'transcription'),
    'AUDIO_UPLOAD',
  );
  assert.equal(
    classifySpeechInputFailure({ name: 'TypeError' }, 'transcription'),
    'AUDIO_UPLOAD',
  );
  assert.equal(
    classifySpeechInputFailure({ status: 413 }, 'transcription'),
    'AUDIO_UPLOAD',
  );
  assert.equal(
    classifySpeechInputFailure({
      status: 503,
      payload: { code: 'SPEECH_TRANSCRIPTION_UNAVAILABLE' },
    }, 'transcription'),
    'STT_UNAVAILABLE',
  );
  assert.equal(
    classifySpeechInputFailure({ status: 422 }, 'transcription'),
    'STT_ERROR',
  );
  assert.equal(
    classifySpeechInputFailure({
      status: 415,
      payload: { code: 'TRANSCODE' },
    }, 'transcription'),
    'TRANSCODE',
  );
  assert.equal(classifySpeechInputFailure(new Error('codec'), 'transcode'), 'TRANSCODE');
  assert.equal(
    classifySpeechInputFailure({
      payload: { code: 'LANGUAGE_MASTERY_ACOUSTIC_ASSESSMENT_REQUIRED' },
    }, 'acoustic'),
    'ACOUSTIC_UNAVAILABLE',
  );
});

test('language lesson uses STT-only speech input and never claims acoustic evidence', () => {
  const lesson = fs.readFileSync(path.join(ROOT, 'apps/mobile/app/lesson/[id].tsx'), 'utf8');
  const runner = fs.readFileSync(
    path.join(ROOT, 'apps/mobile/components/language/practice-runner.tsx'),
    'utf8',
  );
  const service = fs.readFileSync(
    path.join(ROOT, 'apps/api/src/languages/real-life-language.service.ts'),
    'utf8',
  );

  assert.match(lesson, /\/languages\/\$\{encodeURIComponent\(lesson\.languageProfileId\)\}\/course\/training\/stt/);
  assert.match(lesson, /form\.append\('lessonId', lesson\.id\)/);
  assert.match(lesson, /form\.append\('exerciseIndex', String\(index\)\)/);
  assert.doesNotMatch(lesson, /form\.append\('feature'/);
  assert.doesNotMatch(lesson, /form\.append\('language'/);
  assert.match(lesson, /setVoiceTranscript\(text\)/);
  assert.match(runner, /voiceTranscript/);
  assert.match(runner, /voice11\.transcript\.edit/);
  assert.match(runner, /label=\{voiceActive \? t\('voice11\.transcribe'\)/);
  assert.match(runner, /const submittedAnswer = answer\.trim\(\)/);
  assert.match(runner, /onSubmit\(submittedAnswer\)/);
  assert.match(lesson, /onSubmit=\{\(answer\) => void submitWritten\(answer\)\}/);
  assert.match(lesson, /'rlle\.ui\.capabilities\.transcription'/);
  assert.doesNotMatch(lesson, /submitRllePronunciationTraining/);
  assert.match(service, /item\.source === 'audio-native-coaching'/);
});

test('web and native recorders emit stable local failure categories', () => {
  const web = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/recorder.web.ts'), 'utf8');
  const native = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/recorder.ts'), 'utf8');

  for (const source of [web, native]) {
    assert.match(source, /speechInputError\('MIC_PERMISSION'/);
    assert.match(source, /speechInputError\('AUDIO_RECORDING'/);
  }
  assert.match(web, /speechInputError\([\s\S]*?'MEDIARECORDER_UNAVAILABLE'/);
  assert.match(web, /stream\?\.getTracks\(\)\.forEach\(\(t\) => t\.stop\(\)\)/);
  assert.match(web, /active\.onerror = fail/);
  assert.match(web, /try \{\s*active\.stop\(\);\s*\} catch \{\s*fail\(\)/s);
  assert.match(native, /restorePlaybackMode/);
  assert.match(native, /finally \{[\s\S]*await restorePlaybackMode\(\)/);
});
