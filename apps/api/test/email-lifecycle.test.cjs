'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { BadRequestException } = require('@nestjs/common');

const { EmailOtpService } = require('../dist/auth/email-otp.service.js');

const hash = (value) => createHash('sha256').update(value).digest('hex');

function createHarness({ mailFails = false, synchronizeReads = false } = {}) {
  const records = [];
  const sent = [];
  const diagnostics = [];
  let sequence = 0;
  let lockCalls = 0;
  let readers = 0;
  let releaseReads;
  const readsReady = new Promise((resolve) => { releaseReads = resolve; });

  const matches = (record, where) => Object.entries(where).every(([key, expected]) => {
    if (expected === null) return record[key] === null;
    if (typeof expected === 'object' && expected !== null && 'not' in expected) {
      return record[key] !== expected.not;
    }
    return record[key] === expected;
  });

  const tx = {
    $queryRaw: async () => { lockCalls += 1; },
    emailOtp: {
      updateMany: async ({ where, data }) => {
        const affected = records.filter((record) => matches(record, where));
        for (const record of affected) {
          if (Object.hasOwn(data, 'consumedAt')) record.consumedAt = data.consumedAt;
          if (data.attempts?.increment) record.attempts += data.attempts.increment;
        }
        return { count: affected.length };
      },
      create: async ({ data }) => {
        const record = {
          id: `otp-${++sequence}`,
          attempts: 0,
          consumedAt: null,
          createdAt: new Date(sequence),
          ...data,
        };
        records.push(record);
        return record;
      },
      findFirst: async ({ where }) => {
        const record = records
          .filter((candidate) => matches(candidate, where))
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
        if (synchronizeReads && record) {
          readers += 1;
          if (readers === 2) releaseReads();
          await readsReady;
        }
        return record ? { ...record } : null;
      },
    },
  };

  const prisma = {
    // The production code protects this transaction with a PostgreSQL user-row
    // lock. The fake deliberately does not serialize callbacks so the test also
    // exercises the conditional consumption update as a second line of defense.
    $transaction: async (callback) => callback(tx),
  };
  const mail = {
    activeTransport: 'smtp',
    send: async (message) => {
      sent.push(message);
      if (mailFails) throw new Error('simulated SMTP transport failure');
    },
  };
  const config = {
    getOrThrow: (key) => ({
      'auth.otpTtl': 600,
      'auth.otpMaxAttempts': 5,
    })[key],
  };

  const service = new EmailOtpService(prisma, mail, config);
  // Capture the intentionally safe diagnostic instead of writing test-only
  // delivery-failure output to the console.
  service.logger = { error: (message) => diagnostics.push(message) };

  return {
    service,
    records,
    sent,
    diagnostics,
    lockCalls: () => lockCalls,
    add({ code, purpose = 'email_verify', createdAt = new Date(), attempts = 0 }) {
      const record = {
        id: `otp-${++sequence}`,
        userId: 'user-1',
        purpose,
        codeHash: hash(code),
        expiresAt: new Date(Date.now() + 60_000),
        consumedAt: null,
        attempts,
        createdAt,
      };
      records.push(record);
      return record;
    },
  };
}

test('email OTP issuance serializes the user scope and leaves only the newest code pending', async () => {
  const harness = createHarness();
  const user = { id: 'user-1', email: 'email-lifecycle@example.test' };

  await harness.service.issue(user, 'email_verify');
  await harness.service.issue(user, 'email_verify');

  assert.equal(harness.records.length, 2);
  assert.equal(harness.records.filter((record) => record.consumedAt === null).length, 1);
  assert.equal(harness.lockCalls(), 2);
  assert.equal(harness.sent.length, 2);
});

test('email OTP delivery failure does not roll back issuance or introduce a fallback transport', async () => {
  const harness = createHarness({ mailFails: true });

  await assert.doesNotReject(
    harness.service.issue({ id: 'user-1', email: 'email-lifecycle@example.test' }, 'password_reset'),
  );

  assert.equal(harness.sent.length, 1);
  assert.equal(harness.records.length, 1);
  assert.equal(harness.records[0].consumedAt, null);
  assert.deepEqual(harness.diagnostics, [
    'OTP email delivery failed (purpose=password_reset; transport=smtp).',
  ]);
  assert.doesNotMatch(harness.diagnostics[0], /email-lifecycle|simulated|\d{6}/i);
});

test('only the newest OTP can be consumed, once, even when valid submissions race', async () => {
  const harness = createHarness({ synchronizeReads: true });
  const stale = harness.add({ code: '111111', createdAt: new Date(1) });
  const current = harness.add({ code: '222222', createdAt: new Date(2) });

  const [first, second] = await Promise.allSettled([
    harness.service.verify('user-1', '222222', 'email_verify'),
    harness.service.verify('user-1', '222222', 'email_verify'),
  ]);

  assert.equal([first, second].filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = [first, second].find((result) => result.status === 'rejected');
  assert.ok(rejected && rejected.reason instanceof BadRequestException);
  assert.notEqual(stale.consumedAt, null);
  assert.notEqual(current.consumedAt, null);

  await assert.rejects(
    harness.service.verify('user-1', '222222', 'email_verify'),
    (error) => error instanceof BadRequestException,
  );
});

test('OTP purpose and attempt limits remain fail-closed', async () => {
  const harness = createHarness();
  const locked = harness.add({ code: '333333', purpose: 'password_reset', attempts: 5 });
  harness.add({ code: '444444', purpose: 'email_verify' });

  await assert.rejects(
    harness.service.verify('user-1', '444444', 'password_reset'),
    (error) => error instanceof BadRequestException,
  );
  await assert.rejects(
    harness.service.verify('user-1', '333333', 'password_reset'),
    (error) => error instanceof BadRequestException,
  );
  assert.notEqual(locked.consumedAt, null);
});
