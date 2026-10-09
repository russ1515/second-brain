'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const languagePage = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/app/languages/[id].tsx'),
  'utf8',
);
const capabilityCard = fs.readFileSync(
  path.join(ROOT, 'apps/mobile/components/language/oral-capability-card.tsx'),
  'utf8',
);
const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile.p1-user'), 'utf8');

test('strict language mastery stays disabled in the OVH User image by default', () => {
  assert.match(dockerfile, /^ARG EXPO_PUBLIC_FEATURE_LANGUAGE_MASTERY_V1=false$/m);
  assert.match(
    dockerfile,
    /EXPO_PUBLIC_FEATURE_LANGUAGE_MASTERY_V1=\$\{EXPO_PUBLIC_FEATURE_LANGUAGE_MASTERY_V1\}/,
  );
});

test('language space checks server capabilities and device capture before claiming the full path', () => {
  assert.match(languagePage, /api<SpeechCapabilities>\('\/speech\/capabilities'\)/);
  assert.match(languagePage, /languageOralCapabilityMatrix\(\{/);
  assert.match(languagePage, /audioCapture:\s*audioCaptureVerified/);
  assert.match(languagePage, /await probe\.start\(\)/);
  assert.match(languagePage, /setAudioCaptureVerified\(true\)/);
  assert.match(languagePage, /setAudioCaptureVerified\(false\)/);
});

test('capability UI is gated and never replaces the current language course', () => {
  assert.match(languagePage, /featureFlags\.languageMasteryV1 && strictCapabilities/);
  assert.match(languagePage, /<OralCapabilityCard/);
  assert.match(languagePage, /<CourseEntryCard/);
  assert.match(capabilityCard, /pronunciationAssessment/);
  assert.match(capabilityCard, /language-capability-probe-microphone/);
  assert.match(capabilityCard, /rlle\.ui\.capabilities\.blockedDetail/);
});
