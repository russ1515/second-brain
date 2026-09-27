'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('localized registration carries the selected locale through the mobile auth contract', () => {
  const shared = read('packages/shared/src/auth.ts');
  const signIn = read('apps/mobile/app/sign-in.tsx');
  const auth = read('apps/mobile/lib/auth-context.tsx');

  assert.match(shared, /preferredLanguage\?:\s*SupportedLanguageCode/);
  assert.match(shared, /interfaceLanguage\?:\s*SupportedLanguageCode/);
  assert.match(signIn, /const\s*\{\s*t,\s*locale\s*\}\s*=\s*useI18n\(\)/);
  assert.match(signIn, /register\([\s\S]*?email\.trim\(\)[\s\S]*?toSupportedLanguage\(locale\)\s*\?\?\s*['"]en['"]/);
  assert.match(auth, /preferredLanguage\?:\s*SupportedLanguageCode/);
  assert.match(auth, /\.\.\.\(preferredLanguage\s*\?\s*\{\s*preferredLanguage\s*\}\s*:\s*\{\}\)/);
});

test('locale persistence is serialized and only the latest response may update identity or cache', () => {
  const auth = read('apps/mobile/lib/auth-context.tsx');
  const rootLayout = read('apps/mobile/app/_layout.tsx');

  assert.match(auth, /const\s+localeWriteSequence\s*=\s*useRef\(0\)/);
  assert.match(auth, /const\s+localeWriteQueue\s*=\s*useRef<Promise<void>>\(Promise\.resolve\(\)\)/);
  assert.match(auth, /const\s+sequence\s*=\s*\+\+localeWriteSequence\.current/);
  assert.match(auth, /localeWriteQueue\.current[\s\S]*?api<AuthUser>\(['"]\/auth\/locale['"]/);
  assert.match(auth, /if\s*\(sequence\s*!==\s*localeWriteSequence\.current\)\s*return;[\s\S]*?setUser[\s\S]*?saveCachedAuthUser/);
  assert.match(auth, /localeWriteQueue\.current\s*=\s*operation\.catch/);
  assert.match(rootLayout, /accountLocale=\{user\?\.interfaceLanguage \?\? user\?\.preferredLanguage\}/);
  assert.match(rootLayout, /onAccountLocaleChange=\{setInterfaceLanguage\}/);
});

test('Expo 52 native RTL status is explicit and no forced reload is introduced', () => {
  const status = read('apps/mobile/RTL_NATIVE_STATUS.md');
  const mobileSources = [
    read('apps/mobile/lib/i18n.tsx'),
    read('apps/mobile/app/_layout.tsx'),
  ].join('\n');

  assert.match(status, /RTL_NATIVE_NOT_VERIFIED/);
  assert.match(status, /Expo SDK 52/);
  assert.doesNotMatch(mobileSources, /I18nManager\.(?:forceRTL|allowRTL)/);
  assert.doesNotMatch(mobileSources, /reloadAsync\s*\(/);
});
