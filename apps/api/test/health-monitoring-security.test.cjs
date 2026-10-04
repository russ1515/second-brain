const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { HttpStatus } = require('@nestjs/common');
const distRoot = process.env.SPRINT6_API_DIST ? path.resolve(process.env.SPRINT6_API_DIST) : path.join(__dirname, '../dist');
const { HealthController } = require(path.join(distRoot, 'health/health.controller.js'));
const { LogMailer } = require(path.join(distRoot, 'mail/providers/log.mailer.js'));
const { SmtpMailer } = require(path.join(distRoot, 'mail/providers/smtp.mailer.js'));

function responseHarness() {
  return {
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

test('public health returns 200 only when every required dependency is up', async () => {
  const healthyResponse = responseHarness();
  const healthy = new HealthController(
    { check: async () => ({ status: 'up' }) },
    { check: async () => ({ status: 'up' }) },
    { check: async () => ({ status: 'up' }) },
  );

  const healthyReport = await healthy.check(healthyResponse);
  assert.equal(healthyResponse.statusCode, HttpStatus.OK);
  assert.equal(healthyReport.status, 'ok');

  const unavailableResponse = responseHarness();
  const unavailable = new HealthController(
    { check: async () => ({ status: 'up' }) },
    { check: async () => ({ status: 'down' }) },
    { check: async () => ({ status: 'up' }) },
  );

  const unavailableReport = await unavailable.check(unavailableResponse);
  assert.equal(unavailableResponse.statusCode, HttpStatus.SERVICE_UNAVAILABLE);
  assert.equal(unavailableReport.status, 'error');
  assert.deepEqual(unavailableReport.info.redis, { status: 'down' });
});

test('internal monitoring snapshot requires infrastructure.read and leaves public metrics unchanged', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/monitoring/monitoring.controller.ts'), 'utf8');
  const monitoringClass = source.slice(source.indexOf('/** Internal Monitoring Dashboard data'));
  const metricsClass = source.slice(
    source.indexOf("@Controller('metrics')"),
    source.indexOf('/** Internal Monitoring Dashboard data'),
  );

  assert.match(monitoringClass, /@UseGuards\(JwtAccessGuard, AdminGuard, CapabilityGuard\)/);
  assert.match(monitoringClass, /@RequireAdminCapabilities\('infrastructure\.read'\)/);
  assert.doesNotMatch(metricsClass, /CapabilityGuard|RequireAdminCapabilities/);
});

test('simulated mail is explicitly not instrumented and SMTP retains only redacted verification state', () => {
  assert.deepEqual(new LogMailer().health, { status: 'NOT_INSTRUMENTED', observedAt: null });
  const staleObservedAt = new Date(Date.now() - (6 * 60 * 1_000)).toISOString();
  const stale = Object.create(SmtpMailer.prototype);
  stale.healthState = { status: 'HEALTHY', observedAt: staleObservedAt };
  assert.deepEqual(stale.health, { status: 'UNKNOWN', observedAt: staleObservedAt });
  const smtpSource = fs.readFileSync(path.join(__dirname, '../src/mail/providers/smtp.mailer.ts'), 'utf8');
  assert.match(smtpSource, /private healthState: MailerHealth = \{ status: 'UNKNOWN', observedAt: null \}/);
  assert.match(smtpSource, /this\.healthState = \{ status: 'HEALTHY', observedAt: new Date\(\)\.toISOString\(\) \}/);
  assert.match(smtpSource, /this\.healthState = \{ status: 'UNAVAILABLE', observedAt: new Date\(\)\.toISOString\(\) \}/);
  assert.match(smtpSource, /healthMaxAgeMs = 5 \* 60 \* 1_000/);
  assert.doesNotMatch(smtpSource, /logger\.(?:log|warn|error)\([^)]*(?:config\.|host|user|pass)/i);
});
