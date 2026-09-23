/*
 * Disposable browser fixture for the Sprint 3 User Administration Control
 * Center. It accepts only an explicitly confirmed test/staging/sprint database
 * and the `sprint3-browser-*@example.test` namespace. Credentials and TOTP
 * values are generated in memory and copied only to the local clipboard.
 */
const assert = require('node:assert/strict');
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');
const { PlanService } = require('../dist/subscription/plan.service.js');
const { SubscriptionService } = require('../dist/subscription/subscription.service.js');
const { QuotaService } = require('../dist/usage/quota.service.js');

const prisma = new PrismaClient();
const plans = new PlanService(prisma);
const subscriptions = new SubscriptionService(prisma, plans);
const quotas = new QuotaService(prisma, subscriptions);
const action = process.env.SPRINT3_BROWSER_FIXTURE_ACTION;
const confirmation = process.env.SPRINT3_BROWSER_FIXTURE_CONFIRM;
const databaseUrl = process.env.DATABASE_URL;
const adminEmail = 'sprint3-browser-admin@example.test';
const normalEmail = 'sprint3-browser-normal@example.test';
const learnerEmail = 'sprint3-browser-learner@example.test';
// Public RFC test vector: it is not a production secret and is only ever
// persisted inside the explicitly guarded disposable validation database.
const browserTotpTestVector = 'JBSWY3DPEHPK3PXP';
let fixturePhase = 'bootstrap';

function requireDedicatedDatabase() {
  assert.equal(confirmation, 'I_UNDERSTAND_TEST_ONLY', 'The explicit test-only confirmation is required.');
  assert.ok(databaseUrl, 'DATABASE_URL is required.');
  const name = decodeURIComponent(new URL(databaseUrl).pathname).replace(/^\/+/, '');
  assert.match(name, /(?:test|staging|sprint)/i, 'A dedicated test, staging, or sprint database is required.');
}

function encryptionMaterial() {
  const material = process.env.TWO_FACTOR_ENC_KEY ?? process.env.JWT_ACCESS_SECRET;
  assert.ok(material, 'The running API encryption material is required.');
  return material;
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
  assert.ok(ivB64 && tagB64 && dataB64, 'The stored fixture secret is malformed.');
  const decipher = createDecipheriv('aes-256-gcm', createHash('sha256').update(material).digest(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

function passwordFor(totpSecret) {
  return `S3-${createHash('sha256').update(`sprint3-browser:${totpSecret}`).digest('base64url').slice(0, 30)}-Aa1!`;
}

function copyClipboard(value) {
  const copied = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value ([Console]::In.ReadToEnd().Trim())'],
    { input: value, encoding: 'utf8', windowsHide: true },
  );
  assert.equal(copied.status, 0, 'Unable to copy the test-only value to the local clipboard.');
}

async function removeFixtures() {
  const records = await prisma.user.findMany({
    where: { email: { startsWith: 'sprint3-browser-' } }, select: { id: true },
  });
  if (!records.length) return;
  const ids = records.map((record) => record.id);
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }] } }),
    prisma.securityEvent.deleteMany({ where: { OR: [{ actorId: { in: ids } }, { userId: { in: ids } }] } }),
    // Reservations deliberately restrict quota-cycle deletion.  Remove their
    // fixture-scoped ledger history first so a disposable learner can be
    // recreated without weakening production referential integrity.
    prisma.usageLedger.deleteMany({ where: { userId: { in: ids } } }),
    prisma.quotaReservation.deleteMany({ where: { userId: { in: ids } } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
}

async function createFixture() {
  fixturePhase = 'prepare-fixture';
  const material = encryptionMaterial();
  const totpSecret = browserTotpTestVector;
  const passwordHash = await argon2.hash(passwordFor(totpSecret));
  fixturePhase = 'remove-existing-fixture';
  await removeFixtures();
  fixturePhase = 'initialize-plans';
  await plans.onModuleInit();
  const pro = await prisma.plan.findUniqueOrThrow({ where: { slug: 'pro' } });
  const now = new Date();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  fixturePhase = 'create-admin';
  const admin = await prisma.user.create({
    data: {
      email: adminEmail, passwordHash, emailVerified: true, accountStatus: 'active', twoFactorEnabled: true,
      twoFactorSecret: encryptSecret(totpSecret, material),
    }, select: { id: true },
  });
  await prisma.adminRoleAssignment.create({ data: { userId: admin.id, role: 'SUPER_ADMIN', reason: 'Sprint 3 browser fixture' } });
  fixturePhase = 'create-normal-user';
  await prisma.user.create({ data: { email: normalEmail, passwordHash, emailVerified: true, accountStatus: 'active' } });

  fixturePhase = 'create-learner';
  const learner = await prisma.user.create({
    data: {
      email: learnerEmail, passwordHash: 'browser-fixture-not-a-credential', emailVerified: true, accountStatus: 'active', lastActiveAt: now,
      profile: { create: { displayName: 'Sprint 3 Learner', preferredLanguage: 'fr', timezone: 'Europe/Paris' } },
      onboardingProfile: {
        create: {
          status: 'completed', category: 'university', currentStep: 'complete', completedAt: now,
          education: { level: 'licence' }, languages: { study: 'Spanish' }, goals: { goal: 'exam' },
          subjects: { values: ['mathematics'] }, preferences: { pace: 'steady' }, teacher: { style: 'guided' },
        },
      },
      languageProfiles: { create: { language: 'Spanish', normalizedLanguage: 'spanish-browser-fixture', nativeLanguage: 'French', mode: 'beginner', cefrLevel: 'A2', goal: 'exam' } },
    },
  });
  fixturePhase = 'create-subscription';
  await prisma.subscription.create({
    data: {
      userId: learner.id, planId: pro.id, planVersion: pro.configurationVersion, status: 'active', interval: 'month',
      provider: 'fake', providerSubscriptionId: 'browser-fixture-subscription', currentPeriodStart: now, currentPeriodEnd: periodEnd,
    },
  });
  fixturePhase = 'create-payment';
  await prisma.payment.create({ data: { userId: learner.id, provider: 'fake', providerRef: 'browser-fixture-payment', amount: 1999, currency: 'usd', status: 'succeeded' } });
  fixturePhase = 'create-session';
  await prisma.session.create({ data: { userId: learner.id, refreshTokenHash: 'browser-fixture-session', userAgent: 'FixtureBrowser/1.0', ipAddress: '203.0.113.50', expiresAt: periodEnd } });
  fixturePhase = 'seed-quota';
  await quotas.reserve({ userId: learner.id, resource: 'AI_TEXT', feature: 'browser-fixture', units: 100, idempotencyKey: 'browser-fixture-seed' });
}

async function copyPassword() {
  const user = await prisma.user.findUnique({ where: { email: adminEmail }, select: { twoFactorSecret: true } });
  assert.ok(user?.twoFactorSecret, 'Create the browser fixture before copying its password.');
  copyClipboard(passwordFor(decryptSecret(user.twoFactorSecret, encryptionMaterial())));
}

async function copyTotp() {
  const user = await prisma.user.findUnique({ where: { email: adminEmail }, select: { twoFactorEnabled: true, twoFactorSecret: true } });
  assert.ok(user?.twoFactorEnabled && user.twoFactorSecret, 'Create the browser fixture before copying its TOTP code.');
  copyClipboard(authenticator.generate(decryptSecret(user.twoFactorSecret, encryptionMaterial())));
}

async function main() {
  requireDedicatedDatabase();
  assert.ok(['create', 'copy-password', 'copy-totp', 'cleanup'].includes(action), 'Choose create, copy-password, copy-totp, or cleanup.');
  await prisma.$connect();
  try {
    if (action === 'create') {
      await createFixture();
      console.log('SPRINT3_BROWSER_FIXTURE_READY');
    } else if (action === 'copy-password') {
      await copyPassword();
      console.log('SPRINT3_BROWSER_PASSWORD_CLIPBOARD_READY');
    } else if (action === 'copy-totp') {
      await copyTotp();
      console.log('SPRINT3_BROWSER_TOTP_CLIPBOARD_READY');
    } else {
      await removeFixtures();
      console.log('SPRINT3_BROWSER_FIXTURE_REMOVED');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never serialize credentials, TOTP material, or configuration values to logs.
  const code = typeof error?.code === 'string' && /^[A-Z]\d{4}$/.test(error.code) ? error.code : 'SAFE_FAILURE';
  console.error(`SPRINT3_BROWSER_FIXTURE_FAILED:${code}:${fixturePhase}`);
  process.exitCode = 1;
});
