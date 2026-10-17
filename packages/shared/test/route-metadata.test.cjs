'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

test('route metadata resolves concrete dynamic URLs without shadowing static routes', () => {
  assert.equal(shared.routeMetadataFor('/lesson/new')?.path, '/lesson/new');
  assert.equal(shared.routeMetadataFor('/lesson/lesson-42')?.path, '/lesson/[id]');
  assert.equal(shared.routeMetadataFor('/library/document-1')?.path, '/library/[id]');
  assert.equal(shared.routeMetadataFor('/library/resource/resource-1')?.path, '/library/resource/[id]');
});

test('route metadata normalizes navigation-only URL differences', () => {
  assert.equal(shared.routeMetadataFor('languages/spanish/?mode=oral#practice')?.path, '/languages/[id]');
  assert.equal(shared.normalizeRoutePath('//usage///?tab=limits'), '/usage');
  assert.equal(shared.routeMetadataFor('/does-not-exist'), undefined);
});

test('route template matching only accepts complete non-empty segments', () => {
  assert.equal(shared.routeTemplateMatches('/session/[id]', '/session/abc'), true);
  assert.equal(shared.routeTemplateMatches('/session/[id]', '/session'), false);
  assert.equal(shared.routeTemplateMatches('/session/[id]', '/session/abc/more'), false);
  assert.equal(shared.routeTemplateMatches('/session/[id]', '/lesson/abc'), false);
});

test('post-auth return paths remain registered and internal', () => {
  assert.equal(shared.safeAuthenticatedReturnPath('/lesson/abc?mode=guided'), '/lesson/abc?mode=guided');
  assert.equal(shared.safeAuthenticatedReturnPath('//lesson///abc'), '/lesson/abc');
  assert.equal(shared.safeAuthenticatedReturnPath('/admin'), '/admin');
  assert.equal(shared.safeAuthenticatedReturnPath('/sign-in'), '/home');
  assert.equal(shared.safeAuthenticatedReturnPath('/login'), '/home');
  assert.equal(shared.safeAuthenticatedReturnPath('/signup'), '/home');
  assert.equal(shared.safeAuthenticatedReturnPath('/onboarding'), '/home');
  assert.equal(shared.safeAuthenticatedReturnPath('//example.com/steal'), '/home');
});

test('public landing and auth aliases stay separate from protected learner home', () => {
  assert.equal(shared.routeMetadataFor('/')?.requiresAuth, false);
  assert.equal(shared.routeMetadataFor('/login')?.requiresAuth, false);
  assert.equal(shared.routeMetadataFor('/signup')?.requiresAuth, false);
  assert.equal(shared.routeMetadataFor('/home')?.requiresAuth, true);
  assert.equal(shared.routeMetadataFor('/home')?.parentSpace, 'home');
});
