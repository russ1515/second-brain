/*
 * Disposable, browser-only fixture for the Sprint 2 Control Center review.
 *
 * It deliberately talks only to a database whose name contains test, staging,
 * or sprint, and only manages an @example.test account with the fixed
 * `sprint2-browser-` prefix.  It is not application bootstrap code.
 *
 * Required environment for `create`:
 *   DATABASE_URL, SPRINT2_BROWSER_FIXTURE_CONFIRM=I_UNDERSTAND_TEST_ONLY,
 *   SPRINT2_BROWSER_PASSWORD, SPRINT2_BROWSER_TOTP_SECRET,
 *   and TWO_FACTOR_ENC_KEY (or JWT_ACCESS_SECRET when the API uses its
 *   documented fallback).
 *
 * Set SPRINT2_BROWSER_FIXTURE_ACTION to `create`, `copy-totp`, or `cleanup`.
 * `copy-totp` is Windows-only and copies the current one-time code directly to
 * the local clipboard for the browser run.  The helper intentionally prints
 * neither credentials nor TOTP material.
 */
const assert = require('node:assert/strict');
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const action = process.env.SPRINT2_BROWSER_FIXTURE_ACTION;
const confirmation = process.env.SPRINT2_BROWSER_FIXTURE_CONFIRM;
const databaseUrl = process.env.DATABASE_URL;
const email = (process.env.SPRINT2_BROWSER_EMAIL ?? 'sprint2-browser-admin@example.test').trim().toLowerCase();

function requireDedicatedDatabase() {
  assert.equal(confirmation, 'I_UNDERSTAND_TEST_ONLY', 'The explicit test-only confirmation is required.');
  assert.ok(databaseUrl, 'DATABASE_URL is required.');
  let name;
  try {
    name = decodeURIComponent(new URL(databaseUrl).pathname).replace(/^\/+/, '');
  } catch {
    assert.fail('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  assert.match(name, /(?:test|staging|sprint)/i, 'This helper accepts only a dedicated test, staging, or sprint database.');
  assert.match(email, /^sprint2-browser-[a-z0-9._+-]+@example\.test$/, 'The fixture email must remain in the test-only namespace.');
}

function encryptSecret(plaintext, material) {
  const key = createHash('sha256').update(material).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

function decryptSecret(payload, material) {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  assert.ok(ivB64 && tagB64 && dataB64, 'The stored fixture TOTP secret is malformed.');
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(material).digest(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

async function createFixture() {
  const password = process.env.SPRINT2_BROWSER_PASSWORD;
  const totpSecret = process.env.SPRINT2_BROWSER_TOTP_SECRET;
  const cipherMaterial = process.env.TWO_FACTOR_ENC_KEY ?? process.env.JWT_ACCESS_SECRET;
  assert.ok(password && password.length >= 12, 'A test-only password of at least 12 characters is required.');
  assert.ok(totpSecret, 'A test-only TOTP secret is required.');
  assert.ok(cipherMaterial, 'The encryption material used by the running API is required.');

  // Validate the secret without emitting its current code.
  assert.match(authenticator.generate(totpSecret), /^\d{6}$/, 'The supplied TOTP secret is invalid.');

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      emailVerified: true,
      isAdmin: false,
      accountStatus: 'active',
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(totpSecret, cipherMaterial),
    },
    update: {
      passwordHash,
      emailVerified: true,
      isAdmin: false,
      accountStatus: 'active',
      suspendedAt: null,
      bannedAt: null,
      suspensionReason: null,
      banReason: null,
      banInternalNote: null,
      banReference: null,
      twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(totpSecret, cipherMaterial),
    },
    select: { id: true },
  });

  // A fresh login must be required after every fixture reset.  Directly grant
  // the role so this test never depends on the legacy bootstrap path.
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.adminRoleAssignment.upsert({
      where: { userId_role: { userId: user.id, role: 'SUPER_ADMIN' } },
      create: { userId: user.id, role: 'SUPER_ADMIN', reason: 'Sprint 2 browser-only fixture' },
      update: { revokedAt: null, reason: 'Sprint 2 browser-only fixture' },
    }),
  ]);
}

async function cleanupFixture() {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return;
  // Audit and security rows are deliberately scalar references, rather than
  // User relations. Remove only this test account's rows before cascading the
  // remaining fixture data through the User relation graph.
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { OR: [{ actorId: user.id }, { targetId: user.id }] } }),
    prisma.securityEvent.deleteMany({ where: { OR: [{ actorId: user.id }, { userId: user.id }] } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
}

async function copyCurrentTotp() {
  const cipherMaterial = process.env.TWO_FACTOR_ENC_KEY ?? process.env.JWT_ACCESS_SECRET;
  assert.ok(cipherMaterial, 'The encryption material used by the running API is required.');
  const user = await prisma.user.findUnique({
    where: { email },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  assert.ok(user?.twoFactorEnabled && user.twoFactorSecret, 'Create the browser fixture before copying its TOTP code.');
  const code = authenticator.generate(decryptSecret(user.twoFactorSecret, cipherMaterial));
  const copied = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value ([Console]::In.ReadToEnd().Trim())'],
    { input: code, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(copied.status, 0, 'Unable to copy the one-time code to the local clipboard.');
}

async function main() {
  requireDedicatedDatabase();
  assert.ok(action === 'create' || action === 'copy-totp' || action === 'cleanup', 'Choose the create, copy-totp, or cleanup action.');
  await prisma.$connect();
  try {
    if (action === 'create') {
      await createFixture();
      console.log('SPRINT2_BROWSER_FIXTURE_READY');
    } else if (action === 'copy-totp') {
      await copyCurrentTotp();
      console.log('SPRINT2_BROWSER_TOTP_CLIPBOARD_READY');
    } else {
      await cleanupFixture();
      console.log('SPRINT2_BROWSER_FIXTURE_REMOVED');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  // Do not risk serializing environment-derived credentials into a test log.
  console.error('SPRINT2_BROWSER_FIXTURE_FAILED');
  process.exitCode = 1;
});
