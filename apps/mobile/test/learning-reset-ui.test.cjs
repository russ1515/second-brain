'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

test('privacy exposes a distinct strong learning reset flow', () => {
  const privacy = read('app/privacy.tsx');
  const reset = read('components/privacy/learning-reset-card.tsx');

  assert.match(privacy, /<LearningResetCard\s*\/>/);
  assert.match(reset, /const REQUIRED_CONFIRMATION = 'RÉINITIALISER'/);
  assert.match(reset, /confirmation === REQUIRED_CONFIRMATION/);
  assert.match(reset, /testID="learning-reset-password"/);
  assert.match(reset, /testID="learning-reset-confirmation"/);
  assert.match(reset, /\/me\/learning\/reset/);
  const serverReset = reset.indexOf("api<LearningResetResponse>('/me/learning/reset'");
  const localReset = reset.indexOf('clearLocalLearningState(user.id)');
  assert.ok(localReset > serverReset);
  assert.match(reset, /refreshOnboarding\(\)/);
  assert.match(reset, /router\.replace\('\/onboarding'\)/);
});

test('successful reset clears owner drafts, cached learning views and the offline outbox', () => {
  const local = read('lib/learning-reset-local.ts');
  const offline = read('lib/offline.ts');

  for (const prefix of [
    'sb.learn.composer.v1.',
    'sb.tutor.draft.v1.',
    'sb.library-cache.v1.',
    'sb.brain-cache.v1.',
    'sb.review-home-cache.v1.',
    'sb.review-session-cache.v1.',
    'sb.active-language.v1.',
    'sb.recent-languages.v1.',
  ]) {
    assert.match(local, new RegExp(prefix.replaceAll('.', '\\.')));
  }
  assert.match(local, /clearOfflineLearningState\(\)/);
  assert.match(local, /queryClient\.clear\(\)/);
  assert.match(offline, /outboxGeneration \+= 1/);
  assert.match(offline, /key === OUTBOX_KEY/);
  assert.match(offline, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(offline, /generation !== outboxGeneration/);

  // Account/session and interface preferences remain outside the reset list.
  assert.doesNotMatch(local, /sb\.accessToken|sb\.refreshToken|sb\.cachedAuthUser|sb\.locale|sb\.theme/);
});

test('MFA-enabled resets use the existing step-up endpoint before reset', () => {
  const reset = read('components/privacy/learning-reset-card.tsx');
  const stepUp = reset.indexOf("api('/auth/2fa/step-up'");
  const destructiveCall = reset.indexOf("api<LearningResetResponse>('/me/learning/reset'");

  assert.ok(stepUp >= 0);
  assert.ok(destructiveCall > stepUp);
  assert.match(reset, /requirements\.mfaRequired/);
  assert.match(reset, /mfaCode\.trim\(\)\.length <= 32/);
});
