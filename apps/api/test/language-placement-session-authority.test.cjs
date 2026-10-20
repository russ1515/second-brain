'use strict';

require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { ExperienceSessionService } = require('../dist/experience-sessions/experience-session.service.js');
const { UpdateExperienceSessionDto } = require('../dist/experience-sessions/dto/update-experience-session.dto.js');

function fixture(intent = 'language-placement') {
  let writes = 0;
  const row = {
    id: 'language-session', userId: 'owner', type: 'language', intent,
    languageProfileId: 'language-profile', status: 'active',
    currentStep: { key: intent, title: 'Server-owned state', position: 1 },
  };
  const prisma = {
    experienceSession: {
      findFirst: async ({ where }) => where.id === row.id && where.userId === row.userId ? row : null,
      findUnique: async ({ where }) => where.id === row.id ? row : null,
    },
  };
  const service = new ExperienceSessionService(prisma);
  service.create = async () => { writes += 1; return { id: 'must-not-create' }; };
  service.updateState = async () => { writes += 1; return { id: row.id }; };
  return { row, service, writes: () => writes };
}

const status = (expected) => (error) => error?.getStatus?.() === expected;

test('generic clients cannot rewrite placement or course evidence/cursor using intent, progress or currentStep', async () => {
  for (const intent of ['language-placement', 'language-course']) {
    for (const patch of [
      { intent: 'some-other-intent' },
      { currentStep: { key: 'complete', title: 'Fabricated diagnostic', position: 3, metadata: { globalLevel: 'C2' } } },
      { progress: { completed: 999, total: 999, percent: 100 } },
      { type: 'research' },
      { status: 'completed' },
      { currentStep: null },
      {},
    ]) {
      const f = fixture(intent);
      await assert.rejects(f.service.updateFromClient('owner', f.row.id, patch), status(400));
      assert.equal(f.writes(), 0);
    }
  }
});

test('generic creation cannot manufacture a language-owned placement or course wrapper', async () => {
  for (const intent of ['language-placement', 'language-course']) {
    const f = fixture();
    await assert.rejects(Promise.resolve().then(() => f.service.createFromClient('owner', {
      type: 'language', intent, title: 'Forged placement', inputModality: 'text',
      links: { languageProfileId: 'language-profile' },
    })), status(400));
    assert.equal(f.writes(), 0);
  }
});

test('a generic client cannot reserve the language-placement server idempotency namespace with an otherwise normal intent', async () => {
  const f = fixture();
  await assert.rejects(Promise.resolve().then(() => f.service.createFromClient('owner', {
    type: 'learning', intent: 'ordinary-learning', title: 'Ordinary learning', inputModality: 'text',
    idempotencyKey: 'language-placement:v1:language-profile',
  })), status(400));
  assert.equal(f.writes(), 0);
});

test('reserved language intents cannot be laundered through another generic session type', async () => {
  for (const intent of ['language-placement', 'language-course']) {
    const f = fixture();
    await assert.rejects(Promise.resolve().then(() => f.service.createFromClient('owner', {
      type: 'research', intent, title: 'Forged placement', inputModality: 'text',
      links: { languageProfileId: 'language-profile' },
    })), status(400));
    assert.equal(f.writes(), 0);
  }
});

test('a foreign owner cannot read or mutate a language diagnostic through the generic update endpoint', async () => {
  const f = fixture();
  await assert.rejects(f.service.updateFromClient('foreign-owner', f.row.id, { progress: { completed: 1, total: 1 } }), status(404));
  assert.equal(f.writes(), 0);
});

test('a generic session cannot acquire a reserved language intent through an update', async () => {
  for (const patch of [
    { intent: 'language-placement' },
    { intent: 'language-course' },
  ]) {
    const f = fixture('ordinary-research');
    f.row.type = 'research';
    await assert.rejects(f.service.updateFromClient('owner', f.row.id, patch), status(400));
    assert.equal(f.writes(), 0);
  }
});

test('HTTP update validation does not permit changing a generic session type into a language session', async () => {
  const dto = plainToInstance(UpdateExperienceSessionDto, { type: 'language', title: 'Existing research' });
  await validate(dto, { whitelist: true });
  assert.equal('type' in dto, false);
  assert.equal(dto.title, 'Existing research');
});

test('ordinary client-owned session progress remains available', async () => {
  const f = fixture('ordinary-research');
  f.row.type = 'research';
  f.row.languageProfileId = null;
  await f.service.updateFromClient('owner', f.row.id, { progress: { completed: 1, total: 3 } });
  assert.equal(f.writes(), 1);
});
