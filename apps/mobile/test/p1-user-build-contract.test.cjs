const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const dockerfile = fs.readFileSync(path.join(ROOT, 'Dockerfile.p1-user'), 'utf8');
const nginx = fs.readFileSync(path.join(ROOT, 'deploy/nginx/p1-user.conf'), 'utf8');

test('P1 User export defaults the two approved UX flags off and ignores dotenv', () => {
  assert.match(dockerfile, /^ARG EXPO_PUBLIC_FEATURE_NEW_APP_SHELL=false$/m);
  assert.match(dockerfile, /^ARG EXPO_PUBLIC_FEATURE_NEW_LANDING=false$/m);
  assert.match(dockerfile, /^\s*EXPO_NO_DOTENV=1 \\$/m);
  assert.match(
    dockerfile,
    /^\s*EXPO_PUBLIC_FEATURE_NEW_APP_SHELL=\$\{EXPO_PUBLIC_FEATURE_NEW_APP_SHELL\} \\$/m,
  );
  assert.match(
    dockerfile,
    /^\s*EXPO_PUBLIC_FEATURE_NEW_LANDING=\$\{EXPO_PUBLIC_FEATURE_NEW_LANDING\} \\$/m,
  );

  const publicFeatureNames = [...new Set(
    [...dockerfile.matchAll(/\b(EXPO_PUBLIC_FEATURE_[A-Z0-9_]+)/g)].map((match) => match[1]),
  )];
  assert.deepEqual(publicFeatureNames, [
    'EXPO_PUBLIC_FEATURE_NEW_APP_SHELL',
    'EXPO_PUBLIC_FEATURE_NEW_LANDING',
  ]);
});

test('P1 User build preserves same-origin API routing', () => {
  assert.doesNotMatch(dockerfile, /EXPO_PUBLIC_API_URL/);
  assert.match(nginx, /location ~ \^\/api\(\?:\/\|\$\)/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:3106;/);
  assert.match(nginx, /add_header Cache-Control "no-store" always;/);
});
