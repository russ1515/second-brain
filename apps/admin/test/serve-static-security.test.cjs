const assert = require('node:assert/strict');
const test = require('node:test');

const { applySecurityHeaders, isSameOrigin, rewriteAdminBundle } = require('./serve-static.cjs');

test('rewrites private and development API origins to the same-origin proxy', () => {
  const source = [
    'http://localhost:3000/api/auth/login',
    'http://127.0.0.1:8083/api/admin/session',
  ].join('\n');

  const rewritten = rewriteAdminBundle(source);

  assert.equal(rewritten.includes('localhost:3000'), false);
  assert.equal(rewritten.includes('127.0.0.1:8083'), false);
  assert.equal(rewritten, '/api/auth/login\n/api/admin/session');
});

test('accepts absent and same-origin Origin headers but rejects cross-origin requests', () => {
  assert.equal(isSameOrigin({ headers: { host: 'admin.secondbrainlearn.com' } }), true);
  assert.equal(isSameOrigin({ headers: { host: 'admin.secondbrainlearn.com', origin: 'https://admin.secondbrainlearn.com' } }), true);
  assert.equal(isSameOrigin({ headers: { host: '127.0.0.1:8083', origin: 'http://127.0.0.1:8083' } }), true);
  assert.equal(isSameOrigin({ headers: { host: 'admin.secondbrainlearn.com', origin: 'https://beta.secondbrainlearn.com' } }), false);
  assert.equal(isSameOrigin({ headers: { host: 'admin.secondbrainlearn.com', origin: 'not-a-url' } }), false);
});

test('sets restrictive browser security headers', () => {
  const headers = new Map();
  applySecurityHeaders({ setHeader: (name, value) => headers.set(name, value) });

  assert.match(headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.equal(headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.equal(headers.get('referrer-policy'), 'no-referrer');
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('x-frame-options'), 'DENY');
});
