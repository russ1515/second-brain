'use strict';

require('reflect-metadata');

const assert = require('node:assert/strict');
const test = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { AuthService } = require('../dist/auth/auth.service.js');
const { RegisterDto } = require('../dist/auth/dto/register.dto.js');

test('registration locale is optional, validated and canonicalized', async () => {
  const legacyNorwegian = plainToInstance(RegisterDto, {
    email: 'locale@example.test',
    password: 'controlled-password',
    preferredLanguage: 'no',
  });
  assert.equal((await validate(legacyNorwegian)).length, 0);
  assert.equal(legacyNorwegian.preferredLanguage, 'nb');

  const traditionalChinese = plainToInstance(RegisterDto, {
    email: 'locale@example.test',
    password: 'controlled-password',
    preferredLanguage: 'zh-TW',
  });
  assert.equal((await validate(traditionalChinese)).length, 0);
  assert.equal(traditionalChinese.preferredLanguage, 'zh-Hant');

  const invalid = plainToInstance(RegisterDto, {
    email: 'locale@example.test',
    password: 'controlled-password',
    preferredLanguage: 'not-a-locale',
  });
  assert.ok((await validate(invalid)).some((error) => error.property === 'preferredLanguage'));
});

test('registration persists and returns the normalized locale with the new profile', async () => {
  let createArgs;
  const prisma = {
    user: {
      create: async (args) => {
        createArgs = args;
        return {
          id: 'new-locale-user',
          email: args.data.email,
          emailVerified: false,
        };
      },
    },
  };
  const service = new AuthService(
    prisma,
    {},
    {},
    {},
    { issue: async () => undefined },
    { assertRegistrationAllowed: () => undefined },
  );
  service.issueTokens = async () => ({
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
    tokenType: 'Bearer',
    expiresIn: 900,
  });

  const response = await service.register({
    email: 'NEW-LOCALE@example.test',
    password: 'controlled-password',
    preferredLanguage: 'no',
  });

  assert.deepEqual(createArgs.data.profile.create, {
    displayName: null,
    preferredLanguage: 'nb',
  });
  assert.deepEqual(createArgs.data.onboardingProfile.create, {
    extra: { interfaceLanguage: 'nb' },
  });
  assert.equal(response.user.interfaceLanguage, 'nb');
  assert.equal(response.user.preferredLanguage, 'nb');
});

test('interface locale persists separately from the pedagogical explanation locale', async () => {
  let preferredLanguage = 'no';
  let interfaceLanguage = 'fr';
  let upsert;
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-locale',
        email: 'locale@example.test',
        emailVerified: true,
        accountStatus: 'active',
        suspendedAt: null,
        bannedAt: null,
        profile: { displayName: 'Locale learner', preferredLanguage },
        onboardingProfile: { extra: { interfaceLanguage, keepMe: true } },
      }),
    },
    onboardingProfile: {
      findUnique: async () => ({ extra: { interfaceLanguage, keepMe: true } }),
      upsert: async (args) => {
        upsert = args;
        interfaceLanguage = args.update.extra.interfaceLanguage;
      },
    },
  };
  prisma.$transaction = async (callback) => callback({
    $queryRaw: async () => undefined,
    onboardingProfile: prisma.onboardingProfile,
  });
  const service = new AuthService(prisma, {}, {}, {}, {}, {});

  assert.equal((await service.me('user-locale')).interfaceLanguage, 'fr');
  assert.equal((await service.me('user-locale')).preferredLanguage, 'nb');
  const updated = await service.setLocale('user-locale', 'zh-Hant');
  assert.deepEqual(upsert, {
    where: { userId: 'user-locale' },
    create: { userId: 'user-locale', extra: { interfaceLanguage: 'zh-Hant', keepMe: true } },
    update: { extra: { interfaceLanguage: 'zh-Hant', keepMe: true } },
  });
  assert.equal(updated.interfaceLanguage, 'zh-Hant');
  assert.equal(updated.preferredLanguage, 'nb');
});
