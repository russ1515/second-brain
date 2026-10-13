const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const {
  FIRST_AUDIO_TARGET_MS,
  FIRST_NARRATION_SEGMENT_MAX,
  FIRST_NARRATION_SEGMENT_MIN,
  TTS_TEXT_MAX,
  createNarrationPauseGate,
  narrationSegments,
  playNarrationSegments,
} = require('../lib/speech-playback.ts');

test('short narration remains one metered synthesis request', () => {
  assert.deepEqual(narrationSegments('  Hello, learner.  '), {
    lead: 'Hello, learner.',
    tail: null,
  });
});

test('long narration starts with a complete short sentence and keeps all content', () => {
  const text = `${'This is the detailed explanation. '.repeat(14)}A final recap.`.trim();
  const parts = narrationSegments(text);

  assert.ok(parts.lead.endsWith('.'));
  assert.ok(parts.lead.length >= FIRST_NARRATION_SEGMENT_MIN);
  assert.ok(parts.lead.length <= FIRST_NARRATION_SEGMENT_MAX);
  assert.ok(parts.tail);
  assert.equal(`${parts.lead} ${parts.tail}`, text);
});

test('a short greeting is kept with enough narration to prepare its continuation', () => {
  const text = `Bonjour ! ${'Voici une explication pédagogique sans autre ponctuation '.repeat(35)}`.trim();
  const parts = narrationSegments(text);

  assert.notEqual(parts.lead, 'Bonjour !');
  assert.ok(parts.lead.length >= FIRST_NARRATION_SEGMENT_MIN);
  assert.ok(parts.lead.length <= FIRST_NARRATION_SEGMENT_MAX);
  assert.equal(`${parts.lead} ${parts.tail}`, text);
});

test('non-Latin sentence boundaries can start promptly without cutting the next sentence', () => {
  const text = `これは最初の説明です。${'次の説明を詳しく続けます。'.repeat(30)}`;
  const parts = narrationSegments(text);

  assert.equal(parts.lead.endsWith('。'), true);
  assert.ok(parts.lead.length <= FIRST_NARRATION_SEGMENT_MAX);
  assert.equal(`${parts.lead}${parts.tail}`, text);
});

test('unbroken narration uses a bounded deterministic lead', () => {
  const text = 'x'.repeat(400);
  const parts = narrationSegments(text);

  assert.equal(parts.lead.length, FIRST_NARRATION_SEGMENT_MAX);
  assert.equal(`${parts.lead}${parts.tail}`, text);
});

test('invalid narration fails before any provider request can be made', () => {
  assert.throws(() => narrationSegments('   '), /TTS_TEXT_REQUIRED/);
  assert.throws(() => narrationSegments('x'.repeat(TTS_TEXT_MAX + 1)), /TTS_TEXT_TOO_LONG/);
  assert.equal(TTS_TEXT_MAX, 4_096);
});

test('speaker UI measures first playback honestly and exposes delayed loading plus terminal retry', () => {
  const button = fs.readFileSync(path.join(ROOT, 'apps/mobile/components/speak-button.tsx'), 'utf8');
  const web = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/speak.web.ts'), 'utf8');
  const native = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/speak.ts'), 'utf8');
  const api = fs.readFileSync(path.join(ROOT, 'apps/mobile/lib/speech-api.ts'), 'utf8');

  assert.equal(FIRST_AUDIO_TARGET_MS, 3_000);
  assert.match(button, /'idle' \| 'loading' \| 'playing' \| 'paused' \| 'ended' \| 'error'/);
  assert.match(button, /onFirstAudio:\s*\(latencyMs\)/);
  assert.match(button, /setState\('ended'\)/);
  assert.match(button, /setState\('error'\)/);
  assert.match(button, /setTimeout\([\s\S]*FIRST_AUDIO_TARGET_MS/);
  assert.match(button, /t\('app\.tryAgain'\)/);
  assert.match(button, /slowStart \? <Text[^>]*>\{t\('state\.loading'\)\}<\/Text>/);
  assert.match(button, /createClientRequestId\('tts'\)/);
  assert.match(button, /if \(startInFlightRef\.current\) return;[\s\S]*startInFlightRef\.current = true;/);
  assert.match(button, /finally \{[\s\S]*startInFlightRef\.current = false;/);
  assert.doesNotMatch(button, /start\(true\)/);
  assert.match(button, /requestId,/);
  assert.match(button, /pauseSpeaking/);
  assert.match(button, /stopSpeaking/);
  assert.match(web, /audio\.onplaying = markStarted/);
  assert.match(native, /status\.isPlaying\) markStarted/);
  assert.match(api, /synthesisInFlight\.get\(key\)/);
  assert.match(api, /SYNTHESIS_CACHE_MAX = 8/);
  assert.match(api, /signal: controller\.signal/);
  assert.match(api, /\.\.\.\(requestId \? \{ requestId \} : \{\}\)/);
  assert.match(api, /if \(!signal\) synthesisInFlight\.set\(key, request\)/);
  assert.match(web, /playNarrationSegments\(text/);
  assert.match(native, /playNarrationSegments\(text/);
  assert.match(web, /signal\?\.addEventListener\('abort', cancel/);
  assert.match(native, /signal\?\.addEventListener\('abort', cancel/);
  assert.match(native, /if \(current !== active\) return true/);
  assert.match(native, /if \(current !== active\) return gateResumed \|\| narrationWasPaused/);
});

test('continuation synthesis starts before lead playback finishes and playback stays ordered', async () => {
  const events = [];
  let finishLead;
  const leadFinished = new Promise((resolve) => { finishLead = resolve; });
  const text = `Bonjour ! ${'Une explication suffisamment longue continue ici sans interruption. '.repeat(30)}`;

  const playback = playNarrationSegments(text, {
    requestId: 'tts-test',
    synthesize: async (_segment, _signal, requestId) => {
      events.push(`synthesize:${requestId}`);
      return requestId;
    },
    play: async (result) => {
      events.push(`play:start:${result}`);
      if (result === 'tts-test:lead') await leadFinished;
      events.push(`play:end:${result}`);
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(events, [
    'synthesize:tts-test:lead',
    'synthesize:tts-test:tail',
    'play:start:tts-test:lead',
  ]);
  finishLead();
  await playback;
  assert.deepEqual(events, [
    'synthesize:tts-test:lead',
    'synthesize:tts-test:tail',
    'play:start:tts-test:lead',
    'play:end:tts-test:lead',
    'play:start:tts-test:tail',
    'play:end:tts-test:tail',
  ]);
});

test('pause before first audio persists until resume without resynthesis', async () => {
  const pauseGate = createNarrationPauseGate();
  const synthesisIds = [];
  const played = [];
  let releaseLeadSynthesis;
  const leadSynthesisGate = new Promise((resolve) => { releaseLeadSynthesis = resolve; });
  const text = `Bonjour ! ${'Une longue leçon se poursuit avec le même contenu pédagogique. '.repeat(30)}`;

  const playback = playNarrationSegments(text, {
    requestId: 'tts-pause-before-start',
    waitUntilPlayable: pauseGate.wait,
    synthesize: async (_segment, _signal, requestId) => {
      synthesisIds.push(requestId);
      if (requestId === 'tts-pause-before-start:lead') await leadSynthesisGate;
      return requestId;
    },
    play: async (result) => { played.push(result); },
  });

  pauseGate.pause();
  releaseLeadSynthesis();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(synthesisIds, [
    'tts-pause-before-start:lead',
    'tts-pause-before-start:tail',
  ]);
  assert.deepEqual(played, []);

  pauseGate.resume();
  await playback;
  assert.deepEqual(synthesisIds, [
    'tts-pause-before-start:lead',
    'tts-pause-before-start:tail',
  ]);
  assert.deepEqual(played, [
    'tts-pause-before-start:lead',
    'tts-pause-before-start:tail',
  ]);
});

test('pause in the inter-segment gap prevents a spontaneous tail restart', async () => {
  const pauseGate = createNarrationPauseGate();
  const synthesisIds = [];
  const played = [];
  let releaseTailSynthesis;
  const tailSynthesisGate = new Promise((resolve) => { releaseTailSynthesis = resolve; });
  const text = `Bonjour ! ${'Une longue leçon se poursuit avec le même contenu pédagogique. '.repeat(30)}`;

  const playback = playNarrationSegments(text, {
    requestId: 'tts-pause-gap',
    waitUntilPlayable: pauseGate.wait,
    synthesize: async (_segment, _signal, requestId) => {
      synthesisIds.push(requestId);
      if (requestId === 'tts-pause-gap:tail') await tailSynthesisGate;
      return requestId;
    },
    play: async (result) => { played.push(result); },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(played, ['tts-pause-gap:lead']);
  pauseGate.pause();
  releaseTailSynthesis();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(played, ['tts-pause-gap:lead']);

  pauseGate.resume();
  await playback;
  assert.deepEqual(synthesisIds, ['tts-pause-gap:lead', 'tts-pause-gap:tail']);
  assert.deepEqual(played, ['tts-pause-gap:lead', 'tts-pause-gap:tail']);
});

test('Stop prevents continuation playback without a third synthesis', async () => {
  const controller = new AbortController();
  const synthesisIds = [];
  const played = [];
  let releaseLead;
  const leadGate = new Promise((resolve) => { releaseLead = resolve; });
  const text = `Bonjour ! ${'Une longue leçon se poursuit avec le même contenu pédagogique. '.repeat(30)}`;

  const playback = playNarrationSegments(text, {
    signal: controller.signal,
    requestId: 'tts-stop',
    synthesize: async (_segment, _signal, requestId) => {
      synthesisIds.push(requestId);
      return requestId;
    },
    play: async (result) => {
      played.push(result);
      if (result === 'tts-stop:lead') await leadGate;
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(synthesisIds, ['tts-stop:lead', 'tts-stop:tail']);
  controller.abort();
  releaseLead();
  await playback;
  assert.deepEqual(synthesisIds, ['tts-stop:lead', 'tts-stop:tail']);
  assert.deepEqual(played, ['tts-stop:lead']);
});
