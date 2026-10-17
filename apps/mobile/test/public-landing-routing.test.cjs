'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('public root is unconditional and learner home remains protected', () => {
  const tabsLayout = read('apps/mobile/app/(tabs)/_layout.tsx');
  const rootLayout = read('apps/mobile/app/_layout.tsx');
  const homeAlias = read('apps/mobile/app/(tabs)/home.tsx');

  assert.match(tabsLayout, /if \(pathname === '\/'\) return <LandingPage \/>/);
  assert.doesNotMatch(tabsLayout, /featureFlags\.newLanding/);
  assert.match(tabsLayout, /if \(!user\) return <Redirect href="\/login" \/>/);
  assert.match(tabsLayout, /name="index"[\s\S]*?href: null/);
  assert.match(tabsLayout, /name="home"[\s\S]*?title: t\('tab\.home'\)/);
  assert.match(homeAlias, /HomeScreen as default/);
  assert.match(rootLayout, /Boolean\(metadata\?\.requiresAuth\)[\s\S]*?user\?\.emailVerified === false/);
});

test('landing CTAs use explicit public auth routes', () => {
  const landing = read('apps/mobile/components/landing/landing-page.tsx');
  assert.match(landing, /const start = \(\) => router\.push\('\/signup'\)/);
  assert.match(landing, /const signIn = \(\) => router\.push\('\/login'\)/);
  assert.doesNotMatch(landing, /pathname: '\/sign-in'/);
});

test('login and signup share hardened auth while exposing a public home return', () => {
  const login = read('apps/mobile/app/login.tsx');
  const signup = read('apps/mobile/app/signup.tsx');
  const auth = read('apps/mobile/app/sign-in.tsx');

  assert.match(login, /import SignInScreen from '\.\/sign-in'[\s\S]*export default SignInScreen/);
  assert.match(signup, /import SignInScreen from '\.\/sign-in'[\s\S]*export default SignInScreen/);
  assert.match(auth, /pathname === '\/login'/);
  assert.match(auth, /pathname === '\/signup'/);
  assert.match(auth, /testID="auth-back-home"/);
  assert.match(auth, /testID="auth-logo-home-desktop"/);
  assert.match(auth, /testID="auth-logo-home-mobile"/);
  assert.match(auth, /router\.push\('\/'\)/);
  assert.match(auth, /t\('session\.home'\)/);
});
