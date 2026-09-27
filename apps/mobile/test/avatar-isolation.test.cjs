'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/profile/photo.ts'), 'utf8');
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
