'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const argon2 = require('argon2');
const { AuthService } = require('../dist/auth/auth.service.js');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('refresh rotation is serialized on the presented session row', () => {
  const auth = read('src/auth/auth.service.ts');
  assert.match(auth, /SELECT "id" FROM "sessions" WHERE "id" = \$\{parsed\.sessionId\} FOR UPDATE/);
  assert.match(auth, /this\.prisma\.\$transaction\(async \(tx\)/);
  assert.match(auth, /await tx\.session\.update/);
  assert.match(auth, /const newSession = await tx\.session\.create/);
});

test('logout shares the rotation lock and revokes a concurrently-created descendant', async () => {
  const secret = 'old-refresh-secret';
  const oldHash = await argon2.hash(secret, {
    memoryCost: 1024,
    timeCost: 2,
    parallelism: 1,
  });
  const user = {
    id: 'user-1',
    email: 'learner@example.test',
    emailVerified: true,
    accountStatus: 'active',
    suspendedAt: null,
    bannedAt: null,
  };
  const rows = new Map([
    ['session-old', {
      id: 'session-old',
      userId: user.id,
      user,
      refreshTokenHash: oldHash,
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      mfaVerifiedAt: null,
    }],
  ]);
  let sequence = 0;
  let transactionTail = Promise.resolve();

  const session = {
    findUnique: async ({ where }) => {
      const row = rows.get(where.id);
      return row ? { ...row } : null;
    },
    update: async ({ where, data }) => {
      const row = rows.get(where.id);
      if (!row) throw new Error('missing session');
      Object.assign(row, data);
      return { ...row };
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of rows.values()) {
        if (row.userId !== where.userId) continue;
        if (where.revokedAt === null && row.revokedAt !== null) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    },
    create: async ({ data }) => {
      const row = {
        id: `session-new-${++sequence}`,
        revokedAt: null,
        ...data,
      };
      rows.set(row.id, row);
      return { ...row };
    },
  };
  const tx = { $queryRaw: async () => [], session };
  const prisma = {
    session,
    $transaction: async (work) => {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => { release = resolve; });
      await previous;
      try {
        return await work(tx);
      } finally {
        release();
      }
    },
  };
  const config = {
    getOrThrow: (key) => ({
      'auth.refreshTtl': 3600,
      'auth.accessTtl': 900,
      'auth.accessSecret': 'test-access-secret-at-least-32-bytes',
    })[key],
  };
  const jwt = {
    signAsync: async (payload) => `access-for-${payload.sessionId}`,
  };
  const privateBeta = { assertNormalAccess: async () => undefined };
  const service = new AuthService(
    prisma,
    jwt,
    config,
    {},
    {},
    privateBeta,
  );
  service.mintRefreshSecret = async () => ({
    secret: 'rotated-refresh-secret',
    hash: 'rotated-refresh-hash',
  });

  const oldToken = `session-old.${secret}`;
  const [rotated] = await Promise.all([
    service.refresh(oldToken),
    service.logout(oldToken),
  ]);

  assert.match(rotated.refreshToken, /^session-new-1\./);
  assert.equal(
    [...rows.values()].filter((row) => row.userId === user.id && row.revokedAt === null).length,
    0,
  );
});

test('logout source uses the same row lock and fail-closed descendant revocation', () => {
  const auth = read('src/auth/auth.service.ts');
  const logout = auth.slice(auth.indexOf('async logout('), auth.indexOf('async logoutAll('));
  assert.match(logout, /this\.prisma\.\$transaction\(async \(tx\)/);
  assert.match(logout, /SELECT "id" FROM "sessions" WHERE "id" = \$\{parsed\.sessionId\} FOR UPDATE/);
  assert.match(logout, /tx\.session\.updateMany/);
  assert.match(logout, /where: \{ userId: session\.userId, revokedAt: null \}/);
});

test('MFA recovery codes use a conditional single-use consume', () => {
  const twoFactor = read('src/auth/two-factor.service.ts');
  assert.match(twoFactor, /recoveryCode\.updateMany/);
  assert.match(twoFactor, /where: \{ id: candidate\.id, userId, usedAt: null \}/);
  assert.match(twoFactor, /consumed\.count === 1/);
});
