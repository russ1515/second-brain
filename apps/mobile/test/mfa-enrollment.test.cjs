const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const screen = fs.readFileSync(path.join(ROOT, 'apps/mobile/app/two-factor.tsx'), 'utf8');
const profile = fs.readFileSync(path.join(ROOT, 'apps/mobile/app/(tabs)/profile.tsx'), 'utf8');
const routes = fs.readFileSync(path.join(ROOT, 'packages/shared/src/route-metadata.ts'), 'utf8');

test('MFA setup starts only from an explicit user action', () => {
  assert.match(screen, /const beginEnrollment = async \(\) =>/);
  assert.match(screen, /onPress=\{\(\) => void beginEnrollment\(\)\}/);
  assert.doesNotMatch(screen, /useEffect/);
  assert.match(screen, /api<TwoFactorSetupResponse>\('\/auth\/2fa\/setup'/);
});

test('MFA enablement requires a complete 6-digit code and keeps existing auth flows untouched', () => {
  assert.match(screen, /\^\\d\{6\}\$/);
  assert.match(screen, /disabled=\{!codeReady\}/);
  assert.match(screen, /api<TwoFactorEnableResponse>\('\/auth\/2fa\/enable'/);
  assert.match(screen, /body: \{ code: normalizedCode \}/);
  assert.doesNotMatch(screen, /2fa\/(?:verify|step-up|disable)/);
});

test('TOTP material remains ephemeral and recovery codes require explicit acknowledgement', () => {
  assert.match(screen, /useState<TwoFactorSetupResponse \| null>\(null\)/);
  assert.match(screen, /useState<string\[\] \| null>\(null\)/);
  assert.match(screen, /setSetup\(null\);[\s\S]*setRecoveryCodes\(\[\.\.\.response\.recoveryCodes\]\)/);
  assert.match(screen, /setRecoveryCodes\(null\);[\s\S]*setComplete\(true\)/);
  assert.doesNotMatch(screen, /AsyncStorage|localStorage|sessionStorage|console\.|searchParams|useLocalSearchParams/);
});

test('the authenticated Web enrollment route is reachable from Profile', () => {
  assert.match(profile, /Platform\.OS === 'web'/);
  assert.match(profile, /router\.push\('\/two-factor'\)/);
  assert.match(routes, /route\('\/two-factor', 'profile', 'profile'/);
  assert.match(screen, /const \{ user, loading \} = useAuth\(\)/);
  assert.match(screen, /if \(!user\)[\s\S]*<Redirect href=\{\{ pathname: '\/sign-in'/);
  assert.match(screen, /if \(Platform\.OS !== 'web'\)[\s\S]*<Redirect href="\/profile"/);
});
