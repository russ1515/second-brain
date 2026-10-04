'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const report = fs.readFileSync(path.join(root, 'app/report-problem.tsx'), 'utf8');
const admin = fs.readFileSync(path.join(root, '../admin/components/SupportCenter.tsx'), 'utf8');
const translations = fs.readFileSync(path.join(root, 'lib/i18n.tsx'), 'utf8');

test('learner report UI uses the bounded support categories and owner history', () => {
  for (const category of ['bug', 'usage_problem', 'account', 'ai_teacher', 'document_scan', 'language_translation', 'other']) {
    assert.match(report, new RegExp(`'${category}'`));
    assert.match(translations, new RegExp(`report\\.category\\.${category}`));
  }
  assert.match(report, /api<UserReportPage>\('\/reports\?page=1&pageSize=20'\)/);
  assert.match(report, /report\.status\.\$\{report\.status\}/);
  assert.match(report, /trackingId/);
});

test('capture remains explicit and retries only the separate owner attachment route', () => {
  assert.match(report, /CameraCapture/);
  assert.match(report, /launchImageLibraryAsync/);
  assert.match(report, /apiUpload\(`\/reports\/\$\{encodeURIComponent\(reportId\)\}\/screenshot`/);
  assert.match(report, /setPendingCaptureReportId\(created\.id\)/);
  assert.match(report, /retry uploads only the attachment, never a duplicate report/);
  assert.doesNotMatch(report, /body:\s*\{[\s\S]{0,500}screenshot/);
});

test('Admin Support mutates the SupportCase id and previews capture by Report id', () => {
  assert.match(admin, /recordString\(row, \['supportCaseId', 'caseId'\]\)/);
  assert.match(admin, /recordType'\]\) === 'REPORT'/);
  assert.match(admin, /getSupportReportScreenshot\(pending\.id\)/);
  assert.match(admin, /isAdminStepUpRequired/);
});
