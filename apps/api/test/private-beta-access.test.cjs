'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const { ForbiddenException, UnauthorizedException } = require('@nestjs/common');

const {
  PRIVATE_BETA_ACCESS_KEY,
  PrivateBetaAccessService,
} = require('../dist/auth/private-beta-access.service.js');
const { AuthService } = require('../dist/auth/auth.service.js');
const { validateEnv } = require('../dist/config/env.validation.js');

function config(values) {
  return { get: (key) => values[key] };
}

test('private beta and SMTP security booleans reject ambiguous environment values', () => {
  const base = {
    NODE_ENV: 'test', API_PORT: '3000', DATABASE_URL: 'postgresql://test',
    REDIS_HOST: 'localhost', REDIS_PORT: '6379', QDRANT_URL: 'http://localhost:6333',
    LLM_PROVIDER: 'echo', LLM_MODEL: 'echo',
    JWT_ACCESS_SECRET: 'controlled-access-secret',
    JWT_REFRESH_SECRET: 'controlled-refresh-secret',
    JWT_ACCESS_TTL: '900', JWT_REFRESH_TTL: '3600',
  };
  assert.doesNotThrow(() => validateEnv({
    ...base, MAIL_SECURE: 'true', PRIVATE_BETA_ENFORCED: 'false',
  }));
  for (const key of ['MAIL_SECURE', 'PRIVATE_BETA_ENFORCED']) {
    assert.throws(() => validateEnv({ ...base, [key]: 'TRUE' }));
  }
});

test('private beta: disabled by default and registration is unchanged', async () => {
  const service = new PrivateBetaAccessService({}, config({}));
  assert.equal(service.isEnforced(), false);
  assert.doesNotThrow(() => service.assertRegistrationAllowed('controlled@example.test'));
  await assert.doesNotReject(service.assertNormalAccess('controlled-user', false));
});

test('private beta: enforced registration is a pre-side-effect allowlist gate', async () => {
  const service = new PrivateBetaAccessService({}, config({
    'privateBeta.enforced': true,
    'privateBeta.registrationEmails': ['allowed@example.test'],
  }));
  assert.doesNotThrow(() => service.assertRegistrationAllowed('allowed@example.test'));
  assert.throws(
    () => service.assertRegistrationAllowed('denied@example.test'),
    (error) => error instanceof ForbiddenException && error.getStatus() === 403,
  );

  let userCreates = 0;
  const auth = new AuthService(
    { user: { create: async () => { userCreates += 1; } } },
    {},
    {},
    {},
    {},
    service,
  );
  await assert.rejects(
    auth.register({ email: 'denied@example.test', password: 'controlled-password' }),
    (error) => error instanceof ForbiddenException && error.getStatus() === 403,
  );
  assert.equal(userCreates, 0);
});

test('private beta: active feature override requires value, time window and no revocation', async () => {
  let lookup;
  const service = new PrivateBetaAccessService({
    entitlementOverride: {
      findFirst: async (args) => {
        lookup = args;
        return { id: 'controlled-grant' };
      },
    },
  }, config({ 'privateBeta.enforced': true }));
  assert.equal(await service.hasActiveAccess('controlled-user', new Date('2030-01-01T00:00:00.000Z')), true);
  assert.equal(lookup.where.kind, 'feature');
  assert.equal(lookup.where.key, PRIVATE_BETA_ACCESS_KEY);
  assert.deepEqual(lookup.where.value, { equals: true });
  assert.equal(lookup.where.revokedAt, null);
  assert.deepEqual(lookup.where.startsAt, { lte: new Date('2030-01-01T00:00:00.000Z') });
});

test('private beta: grant expires, audits and revocation invalidates live sessions atomically', async () => {
  const audits = [];
  const securityEvents = [];
  const sessionUpdates = [];
  let activeLookup = true;
  const transaction = {
    user: { findUnique: async () => ({ id: 'controlled-user' }) },
    entitlementOverride: {
      updateMany: async () => ({ count: 1 }),
      create: async (args) => ({
        id: 'controlled-grant',
        startsAt: args.data.startsAt,
        endsAt: args.data.endsAt,
      }),
      findFirst: async () => activeLookup ? { id: 'controlled-grant' } : null,
    },
    session: {
      updateMany: async (args) => {
        sessionUpdates.push(args);
        return { count: 2 };
      },
    },
    auditLog: { create: async (args) => { audits.push(args.data); return args.data; } },
    securityEvent: { create: async (args) => { securityEvents.push(args.data); return args.data; } },
  };
  const service = new PrivateBetaAccessService({
    $transaction: async (callback) => callback(transaction),
  }, config({ 'privateBeta.enforced': true }));
  const expiry = new Date(Date.now() + 60_000).toISOString();
  const granted = await service.grant(
    'controlled-user',
    { expiresAt: expiry, reason: 'controlled private beta validation' },
    { actorId: 'controlled-actor', requestId: 'controlled-request' },
  );
  assert.equal(granted.id, 'controlled-grant');
  assert.equal(granted.expiresAt, expiry);
  assert.equal(audits[0].action, 'private_beta_access.grant');
  assert.equal(securityEvents[0].type, 'PRIVATE_BETA_ACCESS_GRANTED');

  const revoked = await service.revoke(
    'controlled-user',
    'controlled-grant',
    'controlled beta revocation',
    { actorId: 'controlled-actor', requestId: 'controlled-request' },
  );
  activeLookup = false;
  assert.deepEqual(revoked, { revoked: true, sessionsRevoked: 2 });
  assert.equal(sessionUpdates.length, 1);
  assert.deepEqual(sessionUpdates[0].where, { userId: 'controlled-user', revokedAt: null });
  assert.equal(audits[1].action, 'private_beta_access.revoke');
  assert.equal(securityEvents[1].type, 'PRIVATE_BETA_ACCESS_REVOKED');
});

test('private beta: login stays generic when a correct password lacks access', async () => {
  const passwordHash = await argon2.hash('controlled-password');
  const privateBeta = {
    assertRegistrationAllowed: () => undefined,
    assertNormalAccess: async () => {
      throw new UnauthorizedException({ code: 'PRIVATE_BETA_ACCESS_REQUIRED' });
    },
  };
  const auth = new AuthService(
    {
      user: {
        findUnique: async () => ({
          id: 'controlled-user',
          email: 'controlled@example.test',
          passwordHash,
          emailVerified: true,
          accountStatus: 'active',
          suspendedAt: null,
          bannedAt: null,
          isAdmin: false,
          twoFactorEnabled: false,
          profile: null,
          adminRoleAssignments: [],
        }),
      },
    },
    {},
    {},
    {},
    {},
    privateBeta,
  );
  await assert.rejects(
    auth.login({ email: 'controlled@example.test', password: 'controlled-password' }),
    (error) => error instanceof UnauthorizedException && error.message === 'Invalid email or password.',
  );
});
