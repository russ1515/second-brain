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
