const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// This suite deliberately uses in-memory dependency and Prisma doubles. It
// exercises the compiled, read-only SystemHealthService contract without
// calling a provider or connecting to staging infrastructure. Run it after
// `pnpm --filter @second-brain/api build`. A disposable alternate output
// directory is supported for Windows filesystems that keep the normal dist
// directory open while an operator has a local development process running.
const distRoot = process.env.SPRINT6_API_DIST ? path.resolve(process.env.SPRINT6_API_DIST) : path.join(__dirname, '../dist');
const { SystemHealthService } = require(path.join(distRoot, 'admin/infrastructure/system-health.service.js'));

function config(values = {}) {
  return { get: (key) => values[key] };
}

function metrics(snapshot = {}) {
  return {
    snapshot: () => ({
      uptimeSeconds: 123,
      http: { total: 12, serverErrors: 2, errorRate: 2 / 12, p50Ms: 18, p95Ms: 42 },
      process: { rssMb: 71, heapUsedMb: 33 },
      ...snapshot,
    }),
  };
}

function indicator(status = 'up', extra = {}) {
  if (typeof status === 'object' && status !== null) {
    return { check: async () => status };
  }
  return { check: async () => ({ status, ...extra }) };
}

function prismaDouble({ attempts = [], bugGroups = [], errorEvents = 0, providerFailure, diagnosticsFailure, trace = {} } = {}) {
  return {
    providerUsageAttempt: {
      findMany: async (args) => {
        trace.providerLedgerQueries = (trace.providerLedgerQueries ?? 0) + 1;
        trace.providerLedgerArgs = args;
        if (providerFailure) throw providerFailure;
        return attempts;
      },
    },
    errorEvent: {
      count: async (args) => {
        trace.errorEventQueries = (trace.errorEventQueries ?? 0) + 1;
        trace.errorEventArgs = args;
        if (diagnosticsFailure) throw diagnosticsFailure;
        return errorEvents;
      },
    },
    bugGroup: {
      findMany: async (args) => {
        trace.bugGroupQueries = (trace.bugGroupQueries ?? 0) + 1;
        trace.bugGroupArgs = args;
        if (diagnosticsFailure) throw diagnosticsFailure;
        return bugGroups;
      },
    },
  };
}

function service({ prisma, configuration = {}, postgres = 'up', redis = 'up', qdrant = 'up', metricSnapshot, mail } = {}) {
  return new SystemHealthService(
    prisma ?? prismaDouble(),
    metrics(metricSnapshot),
    indicator(postgres),
    indicator(redis),
    indicator(qdrant),
    config({
      'llm.provider': 'openai',
      'llm.model': 'gpt-test',
      'embeddings.provider': 'fake',
      'embeddings.model': 'fake-embedding',
      'speech.provider': 'echo',
      ...configuration,
    }),
    mail,
  );
}

function attempt({
  id = 'op-1',
  provider = 'openai',
  model = 'gpt-test',
  status = 'SUCCEEDED',
  offsetMs = 0,
  resource = 'AI_TEXT',
  latencyMs = 25,
  inputTokens = 10,
  cachedInputTokens = 3,
  outputTokens = 7,
} = {}) {
  const observedAt = new Date(Date.now() - offsetMs);
  return {
    operationId: id,
    provider,
    model,
    status,
    latencyMs,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    startedAt: observedAt,
    completedAt: observedAt,
    operation: { resource },
  };
}

test('infrastructure range accepts only now, 1h, 24h, and 7d', () => {
  const instance = service();
  for (const key of ['now', '1h', '24h', '7d']) {
    const range = instance.range(key);
    assert.equal(range.key, key);
    assert.ok(range.toDate > range.fromDate);
  }
  assert.throws(() => instance.range('30d'), (error) => error.response?.code === 'INFRASTRUCTURE_RANGE_INVALID');
  assert.throws(() => instance.range(['now', '1h']), (error) => error.response?.code === 'INFRASTRUCTURE_RANGE_INVALID');
});

test('health overview aggregates durable provider ledger evidence without a provider call', async () => {
  const trace = {};
  const instance = service({
    prisma: prismaDouble({
      trace,
      errorEvents: 4,
      attempts: [
        attempt({ id: 'retry-operation', status: 'SUCCEEDED', offsetMs: 0, latencyMs: 30, inputTokens: 11, cachedInputTokens: 4, outputTokens: 9 }),
        attempt({ id: 'retry-operation', status: 'FAILED', offsetMs: 1_000, latencyMs: 10, inputTokens: 2, cachedInputTokens: 0, outputTokens: 0 }),
      ],
      bugGroups: [{
        id: 'bug-redis', source: 'redis', severity: 'high', occurrenceCount: 3,
        affectedUsersCount: 2, lastSeen: new Date(), incidentId: 'incident-1',
      }],
    }),
  });

  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('provider call must never be made by the health overview');
  };
  try {
    const overview = await instance.overview('1h');
    const openAi = overview.providers.find((provider) => provider.provider === 'openai' && provider.service === 'LLM');

    assert.equal(overview.overall.status, 'HEALTHY');
    assert.equal(overview.performance.currentProcess.dataStatus, 'OBSERVED');
    assert.equal(overview.performance.selectedRange.errorEvents, 4);
    assert.equal(overview.performance.selectedRange.httpErrorRate, null);
    assert.equal(overview.performance.selectedRange.slowRequests, null);
    assert.equal(overview.resources.dataStatus, 'NOT_INSTRUMENTED');
    assert.equal(openAi.status, 'HEALTHY');
    assert.equal(openAi.dataStatus, 'OBSERVED');
    assert.equal(openAi.recentAttempts, 2);
    assert.equal(openAi.recentFailures, 1);
    assert.equal(openAi.recentRetryOperations, 1);
    assert.equal(openAi.averageLatencyMs, 20);
    assert.equal(openAi.inputTokens, 13);
    assert.equal(openAi.cachedInputTokens, 4);
    assert.equal(openAi.outputTokens, 9);
    assert.deepEqual(overview.correlations, [{
      component: 'redis', source: 'redis', bugGroupId: 'bug-redis', incidentId: 'incident-1',
      severity: 'high', occurrenceCount: 3, affectedUsersCount: 2, lastSeen: overview.correlations[0].lastSeen,
    }]);
    assert.equal(trace.providerLedgerQueries, 1);
    assert.equal(trace.providerLedgerArgs.take, 501);
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('unavailable dependency and failed provider attempt create observed alerts without raw error leakage', async () => {
  const unsafeProviderValue = 'provider-token-should-not-appear';
  const unsafeModelValue = 'gpt-token-redaction-probe';
  const unsafeProbeValue = 'redis-password-should-not-appear';
  const instance = service({
    redis: { status: 'down', error: unsafeProbeValue },
    prisma: prismaDouble({
      attempts: [attempt({ status: 'FAILED', provider: unsafeProviderValue, model: unsafeModelValue })],
    }),
  });
  const overview = await instance.overview();
  const serialized = JSON.stringify(overview);

  assert.equal(overview.overall.status, 'UNAVAILABLE');
  assert.equal(overview.components.find((component) => component.key === 'redis').status, 'UNAVAILABLE');
  assert.ok(overview.alerts.some((alert) => alert.key === 'dependency_unavailable:redis' && alert.state === 'ACTIVE'));
  assert.ok(overview.alerts.some((alert) => alert.key === 'provider_degraded:unknown:LLM' && alert.state === 'ACTIVE'));
  assert.doesNotMatch(serialized, new RegExp(unsafeProviderValue));
  assert.doesNotMatch(serialized, new RegExp(unsafeModelValue));
  assert.doesNotMatch(serialized, new RegExp(unsafeProbeValue));
});

test('bounded provider samples remain explicitly incomplete instead of claiming period totals', async () => {
  const attempts = Array.from({ length: 501 }, (_, index) => attempt({ id: `operation-${index}`, offsetMs: index }));
  const overview = await service({ prisma: prismaDouble({ attempts }) }).overview('7d');
  const openAi = overview.providers.find((provider) => provider.provider === 'openai' && provider.service === 'LLM');

  assert.equal(openAi.sampled, true);
  assert.equal(openAi.dataStatus, 'INSUFFICIENT_DATA');
  assert.equal(openAi.recentAttempts, 500);
});

test('provider and diagnostic failures remain UNKNOWN and redact thrown values', async () => {
  const rawFailure = 'password=never-return-this';
  const instance = service({
    prisma: prismaDouble({
      providerFailure: new Error(rawFailure),
      diagnosticsFailure: new Error(rawFailure),
    }),
  });
  const overview = await instance.overview('24h');
  const configured = overview.providers.find((provider) => provider.provider === 'openai' && provider.service === 'LLM');

  assert.equal(configured.dataStatus, 'UNKNOWN');
  assert.equal(configured.status, 'UNKNOWN');
  assert.equal(configured.recentAttempts, null);
  assert.equal(configured.recentFailures, null);
  assert.equal(configured.recentRetryOperations, null);
  assert.equal(overview.performance.selectedRange.dataStatus, 'UNKNOWN');
  assert.equal(overview.performance.selectedRange.errorEvents, null);
  assert.equal(overview.performance.selectedRange.reason, 'PERSISTENT_DIAGNOSTIC_EVIDENCE_UNAVAILABLE');
  assert.doesNotMatch(JSON.stringify(overview), new RegExp(rawFailure));
});

test('SMTP health is observed only from explicit fresh transport evidence', async () => {
  const observedAt = new Date().toISOString();
  const healthy = await service({ mail: { health: { status: 'HEALTHY', observedAt } } }).overview();
  const unavailable = await service({ mail: { health: { status: 'UNAVAILABLE', observedAt } } }).overview();
  const stale = await service({ mail: { health: { status: 'UNKNOWN', observedAt } } }).overview();

  const smtp = (overview) => overview.components.find((component) => component.key === 'smtp');
  assert.deepEqual(smtp(healthy), { key: 'smtp', status: 'HEALTHY', dataStatus: 'OBSERVED', observedAt, reason: undefined });
  assert.deepEqual(smtp(unavailable), { key: 'smtp', status: 'UNAVAILABLE', dataStatus: 'OBSERVED', observedAt, reason: undefined });
  assert.deepEqual(smtp(stale), { key: 'smtp', status: 'UNKNOWN', dataStatus: 'UNKNOWN', observedAt, reason: 'SMTP_VERIFICATION_STALE' });
});

test('host snapshot is observed only when schema-valid and fresh; stale data is UNKNOWN', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'second-brain-sprint6-health-'));
  const snapshotPath = path.join(directory, 'system-health.json');
  const validSnapshot = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    host: {
      uptimeSeconds: 100, cpuCores: 4, load1: 0.2, load5: 0.1, load15: 0.05,
      memoryTotalBytes: 1000, memoryAvailableBytes: 400, diskTotalBytes: 10_000, diskAvailableBytes: 3_000,
    },
    containers: { total: 5, running: 4, unhealthy: 1, restarting: 0 },
  };

  try {
    fs.writeFileSync(snapshotPath, JSON.stringify(validSnapshot), { mode: 0o600 });
    const fresh = await service({ configuration: {
      'infrastructure.hostSnapshotPath': snapshotPath,
      'infrastructure.hostSnapshotMaxAgeSeconds': 60,
    } }).overview();
    assert.equal(fresh.resources.dataStatus, 'OBSERVED');
    assert.deepEqual(fresh.resources.host, validSnapshot.host);
    assert.deepEqual(fresh.resources.containers, validSnapshot.containers);
    assert.ok(fresh.alerts.some((alert) => alert.key === 'containers_unhealthy_or_restarting' && alert.state === 'ACTIVE'));

    fs.writeFileSync(snapshotPath, JSON.stringify({ ...validSnapshot, observedAt: new Date(Date.now() - 120_000).toISOString() }), { mode: 0o600 });
    const stale = await service({ configuration: {
      'infrastructure.hostSnapshotPath': snapshotPath,
      'infrastructure.hostSnapshotMaxAgeSeconds': 60,
    } }).overview();
    assert.equal(stale.resources.dataStatus, 'UNKNOWN');
    assert.equal(stale.resources.reason, 'HOST_SNAPSHOT_STALE');
    assert.equal(stale.resources.host, null);

    fs.writeFileSync(snapshotPath, JSON.stringify({
      ...validSnapshot,
      containers: { total: 1, running: 2, unhealthy: 0, restarting: 0 },
    }), { mode: 0o600 });
    const inconsistent = await service({ configuration: {
      'infrastructure.hostSnapshotPath': snapshotPath,
      'infrastructure.hostSnapshotMaxAgeSeconds': 60,
    } }).overview();
    assert.equal(inconsistent.resources.dataStatus, 'UNKNOWN');
    assert.equal(inconsistent.resources.reason, 'HOST_SNAPSHOT_INVALID');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('infrastructure controller is internal, capability-protected, cached nowhere, and read-only', () => {
  const controllerSource = fs.readFileSync(path.join(__dirname, '../src/admin/infrastructure/infrastructure.controller.ts'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(__dirname, '../src/admin/infrastructure/system-health.service.ts'), 'utf8');

  assert.match(controllerSource, /@UseGuards\(JwtAccessGuard, AdminGuard, CapabilityGuard\)/);
  assert.match(controllerSource, /@RequireAdminCapabilities\('infrastructure\.read'\)/);
  assert.match(controllerSource, /@Controller\('admin\/infrastructure'\)/);
  assert.match(controllerSource, /@Header\('Cache-Control', 'no-store'\)/);
  assert.match(controllerSource, /@Get\(\)/);
  assert.doesNotMatch(controllerSource, /@(Post|Put|Patch|Delete)\(/);
  assert.doesNotMatch(serviceSource, /\b(?:responses|chat|embeddings|speech)\b\s*(?:\.\w+){0,2}\.\s*(?:create|generate)\s*\(/i);
});
