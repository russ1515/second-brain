import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_LOCALE_CODES,
  auditCatalogSet,
  auditRepository,
  formatHumanReport,
  gateStatus,
  isSuspiciousEnglishIdentity,
} from '../../../scripts/audit-locales.mjs';

function map(entries) {
  return new Map(Object.entries(entries));
}

test('a complete catalog preserves protected structures and passes the final gate', () => {
  const english = map({
    message: '**Second Brain** keeps {count} items at 90% — https://example.test 🧠',
    code: '`FSRS`',
  });
  const french = map({
    message: '**Second Brain** conserve {count} éléments à 90% — https://example.test 🧠',
    code: '`FSRS`',
  });
  const report = auditCatalogSet({
    english,
    catalogs: new Map([['en', english], ['fr', french]]),
    expectedCodes: ['en', 'fr'],
  });

  assert.equal(report.readyForFinalGate, true);
  assert.equal(report.errorCount, 0);
  assert.equal(report.nonMissingErrorCount, 0);
  assert.equal(gateStatus(report, true).exitCode, 0);
  assert.equal(report.locales[1].coveragePercent, 100);
});

test('number preservation accepts locale formatting and harmless added digits', () => {
  const english = map({ percent: 'Target 90%', week: 'In a week' });
  const french = map({ percent: 'Objectif 90 %', week: 'Dans 1 semaine' });
  const report = auditCatalogSet({
    english,
    catalogs: new Map([['fr', french]]),
    expectedCodes: ['fr'],
  });
  assert.equal(report.locales[0].issues.numbers.length, 0);
});

test('brand detection accepts attached CJK particles but not ASCII word fragments', () => {
  const english = map({ welcome: 'Welcome to Second Brain.', export: 'Export data' });
  const japanese = map({ welcome: 'Second Brainへようこそ。', export: 'Exporter les données' });
  const report = auditCatalogSet({
    english,
    catalogs: new Map([['ja', japanese]]),
    expectedCodes: ['ja'],
  });
  assert.equal(report.locales[0].issues.brands.length, 0);
});

test('the audit diagnoses every blocking quality dimension', () => {
  const english = map({
    placeholder: 'Keep {count}',
    number: 'Keep 90%',
    url: 'Open https://example.test',
    markdown: '**Keep this**',
    emoji: 'Keep 🧠',
    brand: 'Use Second Brain',
    missing: 'Missing sentence',
    blank: 'Must not be blank',
  });
  const broken = map({
    placeholder: 'Garder {total}',
    number: 'Garder 80%',
    url: 'Ouvrir https://invalid.test',
    markdown: 'Garder ceci',
    emoji: 'Garder',
    brand: 'Utiliser Deuxième Cerveau',
    blank: '   ',
    unknown: 'inconnue',
  });
  const report = auditCatalogSet({
    english,
    catalogs: new Map([['xx', broken]]),
    expectedCodes: ['xx'],
  });
  const locale = report.locales[0];

  assert.equal(locale.issues.missing.length, 1);
  assert.equal(locale.issues.unknown.length, 1);
  assert.equal(locale.issues.blank.length, 1);
  for (const kind of ['placeholders', 'numbers', 'urls', 'markdown', 'emojis', 'brands']) {
    assert.equal(locale.issues[kind].length, 1, kind);
  }
  assert.equal(report.readyForFinalGate, false);
  assert.equal(locale.nonMissingErrorCount, 8);
  assert.equal(report.nonMissingErrorCount, 8);
  assert.equal(gateStatus(report, false).exitCode, 0, 'progress mode must not block a partial recovery');
  assert.equal(gateStatus(report, true).exitCode, 1, 'strict mode must enforce the final gate');
});

test('identical English is diagnostic only and ignores brands or short codes', () => {
  for (const protectedValue of ['Second Brain', 'FSRS', 'OK', 'PDF', 'v2', 'https://example.test', '🧠 100%']) {
    assert.equal(isSuspiciousEnglishIdentity(protectedValue), false, protectedValue);
  }
  assert.equal(isSuspiciousEnglishIdentity('Start learning now'), true);
  assert.equal(isSuspiciousEnglishIdentity('Exporter tes données'), true, 'Expo must not match inside Exporter');

  const english = map({
    sentence: 'Start learning now',
    brand: 'Second Brain',
    code: 'PDF',
  });
  const report = auditCatalogSet({
    english,
    catalogs: new Map([['en', english], ['es', new Map(english)]]),
    expectedCodes: ['en', 'es'],
  });
  assert.deepEqual(report.locales[1].identicalToEnglish.map(({ key }) => key), ['sentence']);
  assert.equal(report.locales[1].errorCount, 0);
  assert.equal(report.readyForFinalGate, true);
});

test('the repository audit always runs offline and remains non-blocking until explicitly strict', () => {
  const report = auditRepository();
  assert.equal(report.localeCount, 27);
  assert.deepEqual(report.locales.map(({ code }) => code), ALL_LOCALE_CODES);
  assert.ok(report.sourceKeyCount > 3_000);
  assert.equal(gateStatus(report, false).exitCode, 0);

  const rendered = formatHumanReport(report);
  assert.match(rendered, /progress audit \(non-blocking\)/);
  assert.match(rendered, /FINAL_LOCALE_GATE_READY:/);
});
