'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const sourcePath = path.resolve(__dirname, '../lib/learning-report-pdf.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
}).outputText;
const compiled = new Module(sourcePath, module);
compiled.filename = sourcePath;
compiled.paths = Module._nodeModulePaths(path.dirname(sourcePath));
const normalRequire = compiled.require.bind(compiled);
compiled.require = (id) => id === 'expo-print' ? { printAsync: async () => undefined } : normalRequire(id);
compiled._compile(js, sourcePath);
const { learningReportHtml } = compiled.exports;

const copy = {
  title: 'Rapport', subtitle: 'Synthèse', generated: 'Généré', learnerName: 'Nom', declared: 'Déclaré',
  observed: 'Observé', assessed: 'Évalué', ageBand: 'Âge', originCountry: 'Origine',
  currentCountry: 'Pays', teachingLanguage: 'Langue', subjects: 'Matières', goals: 'Objectifs',
  preferences: 'Préférences', learningProfile: 'Profil', lessons: 'Leçons', tutorSessions: 'Sessions',
  concepts: 'Concepts', completedSessions: 'Terminées', reviews: 'Révisions', lastActivity: 'Activité',
  completedLearning: 'Apprentissages finalisés', knowledge: 'Connaissances', understanding: 'Compréhension',
  application: 'Application', reasoning: 'Raisonnement', criticalReflection: 'Réflexion critique',
  perspective: 'Vision d’ensemble', evidenceCount: 'Preuves', started: 'Début', finalized: 'Finalisation',
  objective: 'Objectif', result: 'Résultat', noEvidence: 'Aucune preuve',
  notAvailable: 'Indisponible', privacyNote: 'Données privées exclues.', provenanceNote: 'Provenance claire.',
};

function fixture() {
  return {
    generatedAt: '2026-10-06T10:00:00.000Z', locale: 'ar', learnerName: 'Amina',
    declared: { source: 'DECLARED', profile: {
      source: 'DECLARED', ageBand: '18to25', countryOfOrigin: '<script>CD</script>', currentCountry: 'DE',
      interfaceLanguage: 'ar', nativeOrPrimaryLanguage: 'ar', explanationLanguage: 'ar', teachingLanguage: 'de',
      knownLanguages: [], education: { category: 'university', level: 'Licence', system: null, field: 'Économie', domain: null, specialty: null, year: '2' },
      subjects: ['Finance'], academicGoals: ['Examen'], languageGoals: { targetLanguage: 'de', currentLevel: 'A2', targetLevel: 'B2', mainGoal: null, skills: [] },
      learningPreferences: ['guided'], teacher: null, timezone: 'Europe/Berlin',
    } },
    observed: { source: 'OBSERVED', learnerProfile: null, learningDna: null, totals: { lessons: 2, tutorSessions: 1, concepts: 4, completedStudySessions: 1, reviews: 7 }, lastLearningActivityAt: null },
    assessed: {
      source: 'ASSESSED', assessmentSubmissions: 0, averageAssessmentScore: null, exerciseAttempts: 0,
      correctExerciseAttempts: 0, averageExerciseScore: null, evidenceAvailable: false,
      evidenceProgress: {
        completedCount: 0, generatedAt: '2026-10-06T10:00:00.000Z',
        dimensions: ['knowledge', 'understanding', 'application', 'reasoning', 'critical_reflection', 'perspective']
          .map((dimension) => ({ dimension, percent: null, evaluatedEvidenceCount: 0, latestEvidenceAt: null, completionIds: [] })),
      },
      completionHistory: { items: [], generatedAt: '2026-10-06T10:00:00.000Z' },
    },
    exclusions: ['RAW_CONVERSATIONS', 'FULL_DOCUMENTS', 'AUTH_SECRETS', 'FINANCIAL_DETAILS'],
  };
}

test('A4 learning report supports RTL and separates evidence provenance', () => {
  const html = learningReportHtml(fixture(), copy, 'ar', 'rtl', '18–25');
  assert.match(html, /@page \{ size: A4;/);
  assert.match(html, /<html lang="ar" dir="rtl">/);
  assert.match(html, />Déclaré</);
  assert.match(html, />Observé</);
  assert.match(html, />Évalué</);
  assert.match(html, /Amina/);
  assert.match(html, /Aucune preuve/);
  assert.doesNotMatch(html, /Score exercices|Tentatives/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;CD&lt;\/script&gt;/);
});

test('learning report surface contains no raw conversation, document or financial payload', () => {
  const html = learningReportHtml(fixture(), copy, 'fr-FR', 'ltr');
  assert.doesNotMatch(html, /password|accessToken|invoice|payment|tutorMessage|documentContent/i);
  assert.match(html, /Données privées exclues/);
});

test('learning report uses the canonical six evidence dimensions and completion provenance', () => {
  assert.match(source, /assessed\.evidenceProgress\.dimensions/);
  assert.match(source, /critical_reflection: copy\.criticalReflection/);
  assert.match(source, /perspective: copy\.perspective/);
  assert.match(source, /assessed\.completionHistory\.items/);
  assert.match(source, /item\.provenance\.evidenceRefIds\.length/);
  assert.doesNotMatch(source, /score\(assessed\.averageAssessmentScore|averageExerciseScore \* 100/);
});

test('Privacy makes the A4 learning report primary while retaining JSON portability', () => {
  const privacy = fs.readFileSync(path.resolve(__dirname, '../app/privacy.tsx'), 'utf8');
  const reportIndex = privacy.indexOf("t('priv.learningReport.title')");
  const jsonIndex = privacy.indexOf("t('priv.exportHelp')");
  assert.ok(reportIndex >= 0 && jsonIndex > reportIndex);
  assert.match(privacy, /api<LearningReportView>\(\s*`\/me\/learning-report\?locale=/);
  assert.match(privacy, /saveLearningReportAsPdf/);
  assert.match(privacy, /api<DataExportResponse>\('\/me\/export'\)/);
});
