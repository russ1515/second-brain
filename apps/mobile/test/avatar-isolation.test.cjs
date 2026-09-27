'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/profile/photo.ts'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'app/(tabs)/profile.tsx'), 'utf8');
const navigation = fs.readFileSync(
  path.join(root, 'components/nav/responsive-tab-bar.tsx'),
  'utf8',
);

test('avatar notifications are scoped to the authenticated account', () => {
  assert.match(source, /new Map<string, Set<\(uri: string \| null\) => void>>/);
  assert.match(source, /subscribeAvatarPhoto\(\s*userId: string/);
  assert.match(source, /listeners\.get\(userId\)\?\.forEach/);
  assert.match(source, /publish\(userId, stored\)/);
  assert.match(source, /publish\(userId, null\)/);
  assert.match(navigation, /subscribeAvatarPhoto\(user\.id,/);
});

test('successful avatar upload survives a transient read-back failure coherently', () => {
  const upload = source.indexOf("apiUpload('/profile/avatar'");
  const readback = source.indexOf('loadAvatarPhoto()', upload);
  const fallback = source.indexOf('publish(userId, image.uri)', readback);
  assert.ok(upload > 0 && readback > upload && fallback > readback);
  assert.match(source, /return \{ uri: image\.uri, readback: 'unconfirmed' \}/);
  assert.match(profile, /setPhoto\(stored\.uri\)/);
  assert.match(profile, /stored\.readback === 'unconfirmed'/);
  assert.doesNotMatch(source, /Avatar upload did not persist/);
});

test('photo upload succeeds before the independent emoji cleanup is attempted', () => {
  const storeStart = profile.indexOf('const storeCapturedAvatar');
  const storeEnd = profile.indexOf('const onChooseAvatar', storeStart);
  const store = profile.slice(storeStart, storeEnd);
  const upload = store.indexOf('saveAvatarPhoto(user.id');
  const clearEmoji = store.indexOf("patch('identity', { avatarEmoji: '' })");
  assert.ok(upload > 0 && clearEmoji > upload);
  assert.match(store, /new photo remains primary[\s\S]*old emoji is a harmless fallback/);
});

test('Profile only claims preservation for failures known to precede a remote mutation', () => {
  assert.match(profile, /setAvatarError\(\{ title: t\('profile\.avatar\.saveError'\) \}\)/);
  assert.match(profile, /title=\{avatarError\.title\} detail=\{avatarError\.detail\}/);
  assert.doesNotMatch(profile, /title=\{avatarError\} detail=\{t\('profile\.avatar\.preserved'\)\}/);
});
