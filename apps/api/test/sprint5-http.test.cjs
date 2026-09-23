const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createHash, randomBytes, randomUUID } = require('node:crypto');
const argon2 = require('argon2');
const { authenticator } = require('otplib');
const { PrismaClient } = require('@prisma/client');

// An opt-in HTTP suite.  It only talks to a caller-supplied loopback API and a
// database whose name explicitly identifies it as test/staging/sprint work.
const configuredApiBase = process.env.SPRINT5_API_URL;
const apiBase = configuredApiBase?.replace(/\/+$/, '');
const databaseUrl = process.env.DATABASE_URL ?? '';
const confirmation = process.env.SPRINT5_HTTP_TEST_CONFIRM === 'I_UNDERSTAND_TEST_ONLY';
const password = process.env.SPRINT5_TEST_PASSWORD;
const totpSecret = process.env.SPRINT5_TEST_TOTP_SECRET;
const cipherMaterial = process.env.TWO_FACTOR_ENC_KEY;
const enabled = Boolean(
  confirmation
  && /^http:\/\/127\.0\.0\.1:\d+(?:\/api)?$/u.test(apiBase ?? '')
  && /(?:test|staging|sprint)/iu.test(databaseUrl)
  && !/(?:^|[._/-])(prod|production)(?:[._/?-]|$)/iu.test(databaseUrl),
);
const rbacEnabled = Boolean(enabled && password && totpSecret && cipherMaterial);
const prisma = enabled ? new PrismaClient() : null;
const runId = `sprint5-http-${process.pid}-${Date.now()}`;
const eventIds = new Set();
const bugGroupIds = new Set();
const reportIds = new Set();
const incidentIds = new Set();
let learner;
let techOps;
let support;

function encryptSecret(plaintext) {
  const key = createHash('sha256').update(cipherMaterial).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join('.');
}

function accessSessionId(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).sessionId;
}

async function api(path, { method = 'GET', body, token, requestId } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      'x-request-id': requestId ?? `${runId}-${randomUUID()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  return { status: response.status, body: payload, headers: response.headers };
}

async function loginAdmin(email) {
  const login = await api('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(login.status, 200);
  assert.equal(login.body?.twoFactorRequired, true);
  const verified = await api('/auth/2fa/verify', {
    method: 'POST', body: { challengeToken: login.body.challengeToken, code: authenticator.generate(totpSecret) },
  });
  assert.equal(verified.status, 200);
  return verified.body.tokens.accessToken;
}

async function loginLearner() {
  const login = await api('/auth/login', { method: 'POST', body: { email: learner.email, password } });
  assert.equal(login.status, 200);
  assert.equal(login.body?.twoFactorRequired, false);
  return login.body.tokens.accessToken;
}

test.before(async () => {
  if (!enabled) return;
  await prisma.$connect();
  assert.ok(prisma.errorEvent && prisma.bugGroup, 'Sprint 5 Prisma client generation/migration is required.');
  if (!rbacEnabled) return;
  const passwordHash = await argon2.hash(password);
  learner = await prisma.user.create({
    data: { email: `${runId}-learner@example.test`, passwordHash, emailVerified: true },
  });
  techOps = await prisma.user.create({
    data: {
      email: `${runId}-techops@example.test`, passwordHash, emailVerified: true,
      twoFactorEnabled: true, twoFactorSecret: encryptSecret(totpSecret),
    },
  });
  support = await prisma.user.create({
    data: {
      email: `${runId}-support@example.test`, passwordHash, emailVerified: true,
      twoFactorEnabled: true, twoFactorSecret: encryptSecret(totpSecret),
    },
  });
  await prisma.adminRoleAssignment.createMany({
    data: [
      { userId: techOps.id, role: 'TECH_OPS', reason: 'Sprint 5 HTTP RBAC fixture' },
      { userId: support.id, role: 'SUPPORT', reason: 'Sprint 5 HTTP RBAC fixture' },
    ],
  });
});

test.after(async () => {
  if (!enabled) return;
  try {
    const fixtureUserIds = [learner?.id, techOps?.id, support?.id].filter(Boolean);
    const cases = fixtureUserIds.length
      ? await prisma.supportCase.findMany({ where: { userId: { in: fixtureUserIds } }, select: { id: true } })
      : [];
    const caseIds = cases.map((item) => item.id);
    const reporterReports = fixtureUserIds.length
      ? await prisma.report.findMany({ where: { reporterId: { in: fixtureUserIds } }, select: { id: true } })
      : [];
    const allReportIds = [...new Set([...reportIds, ...reporterReports.map((item) => item.id)])];
    if (caseIds.length) {
      await prisma.supportCaseNote.deleteMany({ where: { supportCaseId: { in: caseIds } } });
      await prisma.supportCase.deleteMany({ where: { id: { in: caseIds } } });
    }
    if (allReportIds.length) await prisma.report.deleteMany({ where: { id: { in: allReportIds } } });
    if (incidentIds.size) {
      await prisma.incidentTimelineEvent.deleteMany({ where: { incidentId: { in: [...incidentIds] } } });
      await prisma.incident.deleteMany({ where: { id: { in: [...incidentIds] } } });
    }
    const groupIds = [...bugGroupIds];
    if (groupIds.length) {
      await prisma.bugDiagnostic.deleteMany({ where: { bugGroupId: { in: groupIds } } });
      await prisma.bugComment.deleteMany({ where: { bugGroupId: { in: groupIds } } });
      await prisma.bugAffectedUser.deleteMany({ where: { bugGroupId: { in: groupIds } } });
      await prisma.errorEvent.deleteMany({ where: { bugGroupId: { in: groupIds } } });
      await prisma.bugGroup.deleteMany({ where: { id: { in: groupIds } } });
    }
    if (eventIds.size) await prisma.errorEvent.deleteMany({ where: { id: { in: [...eventIds] } } });
    if (fixtureUserIds.length) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: fixtureUserIds } } });
      await prisma.adminRoleAssignment.deleteMany({ where: { userId: { in: fixtureUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: fixtureUserIds } } });
    }
  } finally {
    await prisma.$disconnect();
  }
});

test('frontend telemetry is bounded, redacted before persistence, and retry-idempotent', {
  skip: !enabled && 'set SPRINT5_HTTP_TEST_CONFIRM=I_UNDERSTAND_TEST_ONLY, SPRINT5_API_URL loopback, and a dedicated DATABASE_URL',
}, async () => {
  // Values exist only in memory.  No assertion echoes them if something fails.
  const marker = `s5-${randomUUID().replaceAll('-', '')}`;
  const ingestId = `${runId}-ingest`;
  const payload = {
    source: 'frontend',
    ingestId,
    errorCode: 'RENDER_FAILURE',
    errorType: 'RenderError',
    route: '/learn',
    feature: 'LEARN',
    appVersion: '5.0.0',
    platform: 'web',
    message: `password=${marker} json=${JSON.stringify({ password: marker, refresh_token: marker })}`,
    stack: `RenderError: password=${marker}\n at render (C:\\private\\${marker}.tsx:12:3)`,
    metadata: { password: marker, authorization: `Bearer ${marker}`, nested: { api_key: marker } },
    deviceMetadata: { email: `${marker}@example.test`, ip: '203.0.113.9' },
  };
  const first = await api('/telemetry/errors', { method: 'POST', body: payload });
  assert.equal(first.status, 202);
  assert.equal(typeof first.body?.eventId, 'string');
  assert.equal(typeof first.body?.bugId, 'string');
  assert.equal(first.headers.has('x-request-id'), true);
  assert.equal(JSON.stringify(first.body).includes(marker), false);
  eventIds.add(first.body.eventId);
  bugGroupIds.add(first.body.bugId);

  const event = await prisma.errorEvent.findUniqueOrThrow({ where: { id: first.body.eventId } });
  const persisted = JSON.stringify(event);
  assert.equal(persisted.includes(marker), false);
  assert.equal(event.requestId, first.headers.get('x-request-id'), 'The API request ID must cross the telemetry boundary unchanged.');
  assert.equal(event.userId, null, 'A public telemetry payload must never select an arbitrary user identity.');
  assert.equal(event.operationId, null, 'A public telemetry payload must not select a logical operation.');

  const retry = await api('/telemetry/errors', { method: 'POST', body: payload });
  assert.equal(retry.status, 202);
  assert.equal(retry.body?.eventId, first.body.eventId);
  const duplicateRows = await prisma.errorEvent.count({ where: { id: first.body.eventId } });
  assert.equal(duplicateRows, 1);
  const group = await prisma.bugGroup.findUniqueOrThrow({ where: { id: first.body.bugId } });
  assert.equal(group.occurrenceCount, 1, 'A retry of the same ingestId cannot increase aggregate occurrence count.');

  const rejectedSource = await api('/telemetry/errors', {
    method: 'POST', body: { ...payload, ingestId: `${runId}-wrong-source`, source: 'provider' },
  });
  assert.equal(rejectedSource.status, 400);
  const claimedIdentity = await api('/telemetry/errors', {
    method: 'POST', body: { ...payload, ingestId: `${runId}-claimed-identity`, userId: randomUUID() },
  });
  assert.equal(claimedIdentity.status, 400, 'Unknown client identity fields must be rejected rather than trusted.');
});

test('authenticated reports use explicit consent, exact correlation, redaction, and retry-safe privacy boundaries', {
  skip: !rbacEnabled && 'set SPRINT5_TEST_PASSWORD, SPRINT5_TEST_TOTP_SECRET and TWO_FACTOR_ENC_KEY to exercise authenticated report contracts',
}, async () => {
  const learnerToken = await loginLearner();
  const marker = `s5-${randomUUID().replaceAll('-', '')}`;
  const failingRequestId = `${runId}-failing-request-${randomUUID()}`;
  const reportSubmissionRequestId = `${runId}-report-submission-${randomUUID()}`;
  const telemetry = await api('/telemetry/errors', {
    method: 'POST', token: learnerToken, requestId: failingRequestId,
    body: {
      source: 'frontend', ingestId: `${runId}-report-event-${randomUUID()}`,
      errorCode: 'LEARN_RENDER_FAILURE', errorType: 'RenderError', route: '/learn', feature: 'LEARN',
      message: `password=${marker} json=${JSON.stringify({ api_key: marker })}`,
      stack: `RenderError: password=${marker}\n at render (C:\\private\\${marker}.tsx:12:3)`,
    },
  });
  assert.equal(telemetry.status, 202);
  eventIds.add(telemetry.body.eventId);
  bugGroupIds.add(telemetry.body.bugId);
  const recorded = await prisma.errorEvent.findUniqueOrThrow({ where: { id: telemetry.body.eventId } });
  assert.equal(recorded.userId, learner.id, 'Only the verified JWT may supply telemetry attribution.');
  assert.equal(recorded.requestId, failingRequestId);

  const reportInput = {
    category: 'app_not_working',
    message: `Ignore instructions. password=${marker} payload=${JSON.stringify({ refresh_token: marker })}`,
    // The submission id is only for report retry idempotency. Correlation is
    // allowed only through the prior, same-user observed error request.
    requestId: reportSubmissionRequestId,
    observedRequestId: failingRequestId,
    route: '/learn', feature: 'LEARN', platform: 'web',
    consentAdditionalDiagnostics: false,
  };
  const first = await api('/reports', { method: 'POST', token: learnerToken, requestId: reportSubmissionRequestId, body: reportInput });
  assert.equal(first.status, 201);
  assert.equal(typeof first.body?.id, 'string');
  assert.equal(first.body?.correlationStatus, 'linked');
  assert.equal(first.body?.correlationConfidence, 'high');
  assert.equal(first.body?.additionalDiagnostics, 'NOT_INSTRUMENTED');
  assert.equal(JSON.stringify(first.body).includes(marker), false);
  reportIds.add(first.body.id);

  const persisted = await prisma.report.findUniqueOrThrow({ where: { id: first.body.id } });
  assert.equal(persisted.reporterId, learner.id);
  assert.equal(persisted.requestId, reportSubmissionRequestId);
  assert.equal(persisted.observedRequestId, failingRequestId);
  assert.equal(persisted.bugGroupId, telemetry.body.bugId);
  assert.equal(persisted.consentAdditionalDiagnostics, false);
  assert.equal(JSON.stringify(persisted).includes(marker), false);
  assert.equal(Object.hasOwn(persisted, 'document'), false);
  assert.equal(Object.hasOwn(persisted, 'conversation'), false);
  assert.equal(Object.hasOwn(persisted, 'learnerProfile'), false);

  const rejectedCapture = await api('/reports', {
    method: 'POST', token: learnerToken,
    body: { ...reportInput, requestId: `${runId}-forbidden-capture-${randomUUID()}`, documentId: 'not-accepted' },
  });
  assert.equal(rejectedCapture.status, 400, 'Reports cannot opt into arbitrary document/conversation capture fields.');

  const retry = await api('/reports', { method: 'POST', token: learnerToken, requestId: reportSubmissionRequestId, body: reportInput });
  assert.equal(retry.status, 201);
  assert.equal(retry.body?.id, first.body.id, 'A same-user request retry must return the original report.');

  const concurrentRequestId = `${runId}-concurrent-report-${randomUUID()}`;
  const concurrent = await Promise.all(Array.from({ length: 4 }, () => api('/reports', {
    method: 'POST', token: learnerToken, requestId: concurrentRequestId,
    body: { category: 'app_not_working', message: 'Concurrent retry fixture.', requestId: concurrentRequestId },
  })));
  assert.ok(concurrent.every((result) => result.status === 201));
  const concurrentIds = concurrent.map((result) => result.body?.id);
  assert.equal(new Set(concurrentIds).size, 1, 'Concurrent same-request retries must converge to one report.');
  reportIds.add(concurrentIds[0]);
  assert.equal(await prisma.report.count({ where: { reporterId: learner.id, requestId: concurrentRequestId } }), 1);
});

test('admin diagnostics and support contracts enforce MFA RBAC, redaction, human review, and step-up', {
  skip: !rbacEnabled && 'set Sprint 5 test MFA credentials to exercise Admin RBAC/step-up contracts',
}, async () => {
  const marker = `s5-${randomUUID().replaceAll('-', '')}`;
  const telemetry = await api('/telemetry/errors', {
    method: 'POST',
    body: {
      source: 'frontend', ingestId: `${runId}-admin-contract-${randomUUID()}`,
      errorCode: 'TUTOR_PROVIDER_TIMEOUT', errorType: 'ProviderTimeoutError', route: '/tutor', feature: 'TUTOR_TEXT',
      provider: 'fixture-provider', model: 'fixture-model',
      message: `password=${marker} Authorization: Bearer ${marker}`,
      stack: `ProviderTimeoutError: password=${marker}\n at provider (C:\\private\\${marker}.ts:8:3)`,
      metadata: { password: marker, api_key: marker },
    },
  });
  assert.equal(telemetry.status, 202);
  eventIds.add(telemetry.body.eventId);
  bugGroupIds.add(telemetry.body.bugId);
  const bugId = telemetry.body.bugId;

  assert.equal((await api('/admin/bugs')).status, 401);
  const learnerToken = await loginLearner();
  assert.equal((await api('/admin/bugs', { token: learnerToken })).status, 403, 'A normal user cannot enter the diagnostic control center.');

  const supportToken = await loginAdmin(support.email);
  assert.equal((await api(`/admin/bugs/${bugId}`, { token: supportToken })).status, 200);
  assert.equal((await api(`/admin/bugs/${bugId}/events`, { token: supportToken })).status, 403);
  assert.equal((await api(`/admin/bugs/${bugId}/events/sensitive`, { token: supportToken })).status, 403, 'Support cannot obtain sensitive event detail.');

  const userReport = await api('/reports', {
    method: 'POST', token: learnerToken,
    body: { category: 'app_not_working', message: `Untrusted user report password=${marker}`, requestId: `${runId}-support-report-${randomUUID()}` },
  });
  assert.equal(userReport.status, 201);
  reportIds.add(userReport.body.id);
  const supportCase = await api('/admin/support/cases', {
    method: 'POST', token: supportToken,
    body: { userId: learner.id, reportId: userReport.body.id, bugGroupId: bugId, priority: 'high' },
  });
  assert.equal(supportCase.status, 201);
  const supportUpdate = await api(`/admin/support/cases/${supportCase.body.id}/status`, {
    method: 'POST', token: supportToken,
    body: { status: 'in_progress', note: `Internal review; password=${marker}` },
  });
  assert.equal(supportUpdate.status, 201);
  assert.equal(supportUpdate.body?.status, 'in_progress');
  const safeReportList = await api('/admin/support/cases?view=reports', { token: supportToken });
  assert.equal(safeReportList.status, 200);
  assert.equal(JSON.stringify(safeReportList.body).includes(marker), false);
  const listedReport = safeReportList.body?.items?.find((item) => item.id === userReport.body.id);
  assert.equal(listedReport?.untrusted, true);
  assert.equal(listedReport?.content, 'REDACTED');

  const techOpsToken = await loginAdmin(techOps.email);
  const sensitive = await api(`/admin/bugs/${bugId}/events/sensitive`, { token: techOpsToken });
  assert.equal(sensitive.status, 200);
  assert.equal(JSON.stringify(sensitive.body).includes(marker), false, 'Even privileged views receive redacted telemetry only.');
  const diagnosis = await api(`/admin/bugs/${bugId}/diagnose`, {
    method: 'POST', token: techOpsToken, body: { kind: 'rule_based', reason: 'Human operator requested deterministic evidence review.' },
  });
  assert.equal(diagnosis.status, 201);
  assert.equal(diagnosis.body?.kind, 'rule_based');
  assert.equal(diagnosis.body?.status, 'available');
  assert.notEqual(diagnosis.body?.confidence, 'confirmed');
  assert.ok(Array.isArray(diagnosis.body?.evidence) && diagnosis.body.evidence.length > 0);

  // An old MFA proof cannot authorize a critical mutation. A successful
  // explicit step-up is required before the human triage action can proceed.
  const stepUpTtlSeconds = Number(process.env.ADMIN_STEP_UP_TTL ?? 600);
  await prisma.session.update({
    where: { id: accessSessionId(techOpsToken) },
    data: { mfaVerifiedAt: new Date(Date.now() - (stepUpTtlSeconds + 2) * 1_000) },
  });
  const staleDenied = await api(`/admin/bugs/${bugId}/status`, {
    method: 'POST', token: techOpsToken, body: { status: 'triaged', reason: 'Must not run without step-up.' },
  });
  assert.equal(staleDenied.status, 403);
  const steppedUp = await api('/auth/2fa/step-up', {
    method: 'POST', token: techOpsToken, body: { code: authenticator.generate(totpSecret) },
  });
  assert.equal(steppedUp.status, 200);
  const triaged = await api(`/admin/bugs/${bugId}/status`, {
    method: 'POST', token: techOpsToken, body: { status: 'triaged', reason: 'Human triage after reviewed evidence.' },
  });
  assert.equal(triaged.status, 201);
  assert.equal(triaged.body?.status, 'triaged');

  const incident = await api('/admin/incidents', {
    method: 'POST', token: techOpsToken,
    body: { title: 'Provider degradation review', severity: 'high', bugGroupIds: [bugId] },
  });
  assert.equal(incident.status, 201);
  incidentIds.add(incident.body.id);
  const monitoring = await api(`/admin/incidents/${incident.body.id}/status`, {
    method: 'POST', token: techOpsToken, body: { status: 'monitoring', note: 'Human monitoring only.' },
  });
  assert.equal(monitoring.status, 201);
  const resolved = await api(`/admin/incidents/${incident.body.id}/status`, {
    method: 'POST', token: techOpsToken, body: { status: 'resolved', note: 'Human resolution review complete.' },
  });
  assert.equal(resolved.status, 201);
  assert.equal(resolved.body?.status, 'resolved');
  assert.equal(await prisma.auditLog.count({ where: { actorId: techOps.id, action: { in: ['BUG_RULE_DIAGNOSTIC_RUN', 'BUG_STATUS_CHANGED', 'INCIDENT_CREATED'] } } }) >= 3, true);
});
