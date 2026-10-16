'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function loadTypeScript(relative) {
  const file = path.join(ROOT, relative);
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const compiled = new Module(file, module);
  compiled.filename = file;
  compiled.paths = Module._nodeModulePaths(path.dirname(file));
  compiled._compile(js, file);
  return compiled.exports;
}

function dimension(dimension, percent, evaluatedEvidenceCount, completionIds = []) {
  return {
    dimension,
    percent,
    evaluatedEvidenceCount,
    latestEvidenceAt: '2026-10-16T10:00:00.000Z',
    completionIds,
  };
}

test('Cognostatity is a deterministic evidence-weighted projection with no synthetic fallback', () => {
  const { deriveCognostatity, COGNOSTATITY_MIN_EVIDENCE } = loadTypeScript(
    'apps/mobile/lib/brain/cognostatity.ts',
  );
  const indicators = deriveCognostatity({
    completedCount: 5,
    generatedAt: '2026-10-16T10:00:00.000Z',
    dimensions: [
      dimension('knowledge', 80, 2, ['c1', 'c2']),
      dimension('understanding', 100, 1, ['c3']),
      dimension('application', 60, 1, ['c2']),
      dimension('reasoning', 70, 1, ['c3']),
      dimension('critical_reflection', 90, 2, ['c4', 'c5']),
      dimension('perspective', 50, 2, ['c5', 'c6']),
    ],
  });

  assert.equal(COGNOSTATITY_MIN_EVIDENCE, 3);
  assert.equal(indicators.length, 5);
  assert.equal(indicators.find((item) => item.key === 'intelligence').percent, 72.5);
  assert.equal(Math.round(indicators.find((item) => item.key === 'reflection').percent), 83);
  assert.equal(indicators.find((item) => item.key === 'vision').percent, 70);
  assert.equal(Math.round(indicators.find((item) => item.key === 'understanding').percent), 87);
  assert.equal(Math.round(indicators.find((item) => item.key === 'adaptation').percent), 53);

  const sparse = deriveCognostatity({
    completedCount: 1,
    generatedAt: '2026-10-16T10:00:00.000Z',
    dimensions: [dimension('knowledge', 95, 1), dimension('understanding', null, 0)],
  });
  assert.ok(sparse.every((item) => item.percent === null));

  const oneCompletion = deriveCognostatity({
    completedCount: 1,
    generatedAt: '2026-10-16T10:00:00.000Z',
    dimensions: [
      dimension('knowledge', 95, 1, ['one']),
      dimension('application', 92, 1, ['one']),
      dimension('reasoning', 90, 1, ['one']),
    ],
  });
  assert.equal(oneCompletion.find((item) => item.key === 'intelligence').percent, null);
  assert.equal(oneCompletion.find((item) => item.key === 'intelligence').evidenceCount, 1);
});

test('Brain renders a responsive controlled bulletin grid and a distinct Cognostatity tab', () => {
  const screen = read('apps/mobile/app/(tabs)/brain.tsx');
  const grid = read('apps/mobile/components/brain/language-bulletin-grid.tsx');
  const panel = read('apps/mobile/components/brain/cognostatity-panel.tsx');
  const bulletin = read('apps/mobile/components/language/course-ui.tsx');

  assert.match(screen, /options=\{\['evidence', 'cognostatity'\] as const\}/);
  assert.match(screen, /<BrainLanguageBulletinGrid/);
  assert.match(screen, /<CognostatityPanel progress=\{data\.evidenceProgress\}/);
  assert.match(grid, /<ResponsiveGrid maxColumns=\{3\}/);
  assert.match(grid, /const \[openId, setOpenId\] = useState<string \| null>\(null\)/);
  assert.match(grid, /current === id \? null : id/);
  assert.match(bulletin, /expanded=\{openId === id\}|expanded \? \(/);
  assert.match(bulletin, /accessibilityExpanded=\{expanded\}/);
  assert.match(panel, /cognostatity-disclaimer/);
  assert.match(panel, /indicator\.percent === null/);
  assert.doesNotMatch(panel, /Math\.random|api\(|fetch\(/);
});

test('Profile hides MFA enrollment UI while Privacy keeps protected reset/delete with accessible password reveal', () => {
  const profile = read('apps/mobile/app/(tabs)/profile.tsx');
  const privacy = read('apps/mobile/app/privacy.tsx');
  const reset = read('apps/mobile/components/privacy/learning-reset-card.tsx');
  const password = read('apps/mobile/components/privacy/password-visibility-field.tsx');

  assert.doesNotMatch(profile, /profile-mfa-card|router\.push\('\/two-factor'\)|mfa\.profileTitle/);
  assert.doesNotMatch(privacy, /\/me\/export|\/me\/learning-report|saveLearningReportAsPdf|priv\.export/);
  assert.match(privacy, /<LearningResetCard\s*\/>/);
  assert.match(privacy, /api\('\/me\/delete'/);
  assert.match(privacy, /testID="delete-account-password"/);
  assert.match(reset, /testID="learning-reset-password"/);
  assert.match(password, /secureTextEntry=\{!visible\}/);
  assert.match(password, /'auth\.hidePassword' : 'auth\.showPassword'/);
  assert.match(password, /accessibilityRole="button"/);
  assert.match(password, /width: 44/);
  assert.match(password, /height: 44/);
  assert.match(password, /paddingEnd: 54/);
  assert.match(password, /end: 5/);
  assert.doesNotMatch(password, /paddingRight: 54|right: 5/);
});

test('Professor voice reply uses one bounded playback action and local retryable audio errors', () => {
  const tutor = read('apps/mobile/app/tutor/[id].tsx');
  const button = read('apps/mobile/components/speak-button.tsx');
  const playback = read('apps/mobile/lib/speech-playback.ts');

  assert.match(tutor, /type VoicePlaybackState = 'idle' \| 'loading' \| 'playing' \| 'paused' \| 'ended' \| 'error'/);
  assert.match(tutor, /if \(voicePlaybackInFlight\.current\) return/);
  assert.match(tutor, /requestId = createClientRequestId\('tts'\)/);
  assert.match(tutor, /testID="tutor-voice-error"/);
  assert.match(tutor, /void playVoiceReply\(reply\.text, reply\.requestId\)/);
  assert.match(button, /if \(startInFlightRef\.current\) return/);
  assert.match(button, /onFirstAudio:\s*\(latencyMs\)/);
  assert.match(playback, /FIRST_NARRATION_SEGMENT_MIN = 160/);
  assert.match(playback, /const tailRequest = tail[\s\S]*options\.synthesize/);
  assert.match(playback, /waitUntilPlayable/);
});
