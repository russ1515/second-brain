'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SafeRedactionService } = require('../dist/diagnostics/safe-redaction.service.js');
const { UserReportService } = require('../dist/diagnostics/user-report.service.js');

function fixture() {
  const reports = [];
  const cases = [];
  const locks = [];
  let selectedReporter = null;
  const tx = {
    $executeRaw: async (strings, ...values) => { locks.push({ strings, values }); },
    errorEvent: { findFirst: async () => null },
    report: {
      findFirst: async ({ where }) => {
        const report = reports.find((row) => row.reporterId === where.reporterId && row.requestId === where.requestId);
        if (!report) return null;
        return {
          id: report.id,
          bugGroupId: report.bugGroupId,
          correlationStatus: report.correlationStatus,
          correlationConfidence: report.correlationConfidence,
          supportCases: cases.filter((item) => item.reportId === report.id).map((item) => ({ status: item.status })),
        };
      },
      create: async ({ data }) => {
        const row = {
          ...data,
          id: `cmreport${reports.length + 1}opaque`,
          createdAt: new Date('2026-10-04T10:00:00.000Z'),
          status: 'new',
        };
        reports.push(row);
        return {
          id: row.id,
          correlationStatus: row.correlationStatus,
          correlationConfidence: row.correlationConfidence,
        };
      },
      count: async ({ where }) => reports.filter((row) => row.reporterId === where.reporterId).length,
      findMany: async ({ where }) => {
        selectedReporter = where.reporterId;
        return reports.filter((row) => row.reporterId === where.reporterId).map((report) => ({
          id: report.id,
          category: report.category,
          status: report.status,
          correlationStatus: report.correlationStatus,
          createdAt: report.createdAt,
          supportCases: cases.filter((item) => item.reportId === report.id).map((item) => ({
            status: item.status,
            updatedAt: item.updatedAt,
          })),
        }));
      },
    },
    supportCase: {
      create: async ({ data }) => {
        const row = { ...data, id: `case-${cases.length + 1}`, status: 'open', updatedAt: new Date('2026-10-04T10:00:01.000Z') };
        cases.push(row);
        return { status: row.status };
      },
    },
  };
  const prisma = {
    $transaction: async (operation) => Array.isArray(operation) ? Promise.all(operation) : operation(tx),
    report: tx.report,
  };
  const context = { current: () => ({ requestId: 'submission-request-1' }) };
  const media = { hasReportScreenshot: async () => false };
  const service = new UserReportService(prisma, context, new SafeRedactionService(), media);
  return { service, reports, cases, locks, selectedReporter };
}

test('one learner submission creates one Report and SupportCase and retries are idempotent', async () => {
  const state = fixture();
  const input = { category: 'bug', message: 'A reproducible learner-facing issue.' };
  const first = await state.service.create('user-a', input);
  const retry = await state.service.create('user-a', input);

  assert.equal(first.id, retry.id);
  assert.equal(first.status, 'RECEIVED');
  assert.equal(first.trackingId, `SB-REPORT-${first.id.toUpperCase()}`);
  assert.equal(state.reports.length, 1);
  assert.equal(state.cases.length, 1);
  assert.equal(state.cases[0].reportId, first.id);
  assert.equal(state.locks.length, 2);
  assert.equal(state.locks.every((entry) => String(entry.strings).includes('pg_advisory_xact_lock')), true);
});

test('learner report history is always selected by the authenticated reporter', async () => {
  const state = fixture();
  await state.service.create('user-a', { category: 'account', message: 'A sufficiently detailed account issue.' });
  state.reports.push({
    id: 'other-report', reporterId: 'user-b', requestId: 'other-request', category: 'bug', status: 'new',
    correlationStatus: 'independent', correlationConfidence: 'unconfirmed', bugGroupId: null,
    createdAt: new Date('2026-10-04T11:00:00.000Z'),
  });

  const page = await state.service.list('user-a', { page: 1, pageSize: 20 });
  assert.equal(page.total, 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].trackingId.startsWith('SB-REPORT-'), true);
  assert.equal(Object.hasOwn(page.items[0], 'message'), false);
});

test('support screenshot routes require owner JWT or Admin support.read plus MFA step-up and audit', () => {
  const learnerController = fs.readFileSync(path.join(__dirname, '../src/admin/reports.controller.ts'), 'utf8');
  const adminController = fs.readFileSync(path.join(__dirname, '../src/diagnostics/diagnostics.controller.ts'), 'utf8');
  const reportService = fs.readFileSync(path.join(__dirname, '../src/diagnostics/user-report.service.ts'), 'utf8');
  const bugService = fs.readFileSync(path.join(__dirname, '../src/diagnostics/bug-center.service.ts'), 'utf8');

  assert.match(learnerController, /@UseGuards\(JwtAccessGuard\)[\s\S]*@Controller\('reports'\)/);
  assert.match(learnerController, /@Put\(':id\/screenshot'\)/);
  assert.match(adminController, /@Get\('reports\/:id\/screenshot'\)[\s\S]*@RequireAdminCapabilities\('support\.read'\)[\s\S]*@UseGuards\(AdminStepUpGuard\)/);
  assert.match(adminController, /SUPPORT_REPORT_SCREENSHOT_VIEWED/);
  assert.match(reportService, /pg_advisory_xact_lock/);
  assert.match(bugService, /support-case:[^`]+/);
});
