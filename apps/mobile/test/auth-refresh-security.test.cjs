'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('parallel 401 responses share one refresh and late results cannot replace another login', () => {
  const client = read('lib/client.ts');
  const storage = read('lib/storage.ts');
  assert.match(client, /let refreshInFlight/);
  assert.match(client, /if \(refreshInFlight\) return refreshInFlight/);
  assert.match(client, /replaceSessionIfRefreshMatches\(session\.refreshToken/);
  assert.match(client, /res\.status === 401 \|\| res\.status === 403/);
  assert.match(storage, /enqueueSessionMutation/);
  assert.match(storage, /current !== expectedRefreshToken/);
});

test('pending email verification survives reload and cannot enter the learner shell', () => {
  const auth = read('lib/auth-context.tsx');
  const signIn = read('app/sign-in.tsx');
  const layout = read('app/_layout.tsx');

  assert.match(auth, /status: 'pending-verification'/);
  assert.match(auth, /if \(!res\.user\.emailVerified\)[\s\S]*return \{ status: 'pending-verification' \}/);
  assert.match(signIn, /user && !user\.emailVerified && step === 'credentials'/);
  assert.match(signIn, /setEmail\(user\.email\)[\s\S]*setStep\('otp'\)/);
  assert.match(signIn, /res\.status === 'pending-verification'[\s\S]*setStep\('otp'\)[\s\S]*setInfo\(t\('auth\.emailVerificationRequired'\)\)/);
  assert.match(auth, /verifyTwoFactor[\s\S]*if \(!res\.user\.emailVerified\)[\s\S]*setOnboarded\(false\)[\s\S]*status: 'pending-verification'/);
  assert.match(signIn, /verifyTwoFactor\(challengeToken, otp\.trim\(\)\)[\s\S]*result\.status === 'pending-verification'[\s\S]*setStep\('otp'\)[\s\S]*setInfo\(t\('auth\.emailVerificationRequired'\)\)/);
  assert.match(signIn, /const changeAccount = async[\s\S]*await logout\(\)[\s\S]*setMode\('login'\)[\s\S]*setStep\('credentials'\)/);
  assert.match(signIn, /onPress=\{\(\) => void changeAccount\(\)\}[\s\S]*t\('app\.signOut'\)/);
  assert.match(layout, /const redirectToEmailVerification/);
  assert.match(layout, /user\?\.emailVerified === false[\s\S]*metadata\?\.path !== '\/sign-in'/);
  assert.match(layout, /user\?\.emailVerified === true &&\s+userExperience/);
  assert.match(auth, /if \(me\.emailVerified\)[\s\S]*refreshOnboarding\(\)[\s\S]*setOnboarded\(false\)/);
});

test('auth failures map stable backend codes to distinct localized client states', () => {
  const client = read('lib/client.ts');
  const i18n = read('lib/i18n.tsx');

  assert.match(client, /code === 'INVALID_CREDENTIALS'[\s\S]*tr\('auth\.invalidCredentials'\)/);
  assert.match(client, /code === 'EMAIL_VERIFICATION_REQUIRED'[\s\S]*tr\('auth\.emailVerificationRequired'\)/);
  assert.match(client, /code === 'ACCOUNT_SUSPENDED'[\s\S]*tr\('error\.accountSuspended'\)/);
  assert.match(client, /code === 'ACCOUNT_BANNED'[\s\S]*tr\('error\.accountBanned'\)/);
  assert.match(client, /code === 'SESSION_EXPIRED'[\s\S]*tr\('error\.sessionExpired'\)/);
  assert.match(client, /code === 'SESSION_REVOKED'[\s\S]*code === 'SESSION_INVALID'[\s\S]*tr\('error\.sessionEnded'\)/);
  assert.match(client, /status === 401 && context\.path === '\/auth\/login'[\s\S]*tr\('auth\.invalidCredentials'\)/);
  assert.match(client, /status === 401 && context\.authenticated[\s\S]*tr\('error\.sessionEnded'\)/);
  assert.match(client, /API error prose is untrusted transport data/);
  assert.doesNotMatch(client, /payload\.message\s*\?\?/);

  assert.match(i18n, /'auth\.invalidCredentials': 'E-mail ou mot de passe incorrect\.'/);
  assert.match(i18n, /'error\.sessionExpired': 'Ta session a expiré\./);
  assert.match(i18n, /'error\.sessionEnded': 'Ta session n[’']est plus active\./);
});
