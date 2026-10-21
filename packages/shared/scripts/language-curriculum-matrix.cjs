'use strict';

// Deterministic definitions only: no database, provider, learner or network.
const fs = require('node:fs');
const path = require('node:path');
const shared = require('../dist/index.js');
const productLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

function languageCurriculumMatrix() {
  const ids = new Set();
  const rows = shared.SUPPORTED_LANGUAGE_CODES.map((languageCode) => {
    const profile = shared.getLanguageCurriculumProfile(languageCode);
    const stages = productLevels.flatMap((productLevel) => {
      const catalogue = shared.buildLanguageLearningCatalogue({ languageCode, productLevel });
      const issues = shared.lintLanguageCurriculum(catalogue);
      for (const lesson of catalogue.modules.flatMap((module) => module.lessons)) {
        if (ids.has(lesson.id)) issues.push({ code: 'GLOBAL_DUPLICATE_ID', lessonId: lesson.id });
        ids.add(lesson.id);
      }
      return catalogue.cefrLevels.map((cefrLevel) => {
        const modules = catalogue.modules.map((module) => ({ moduleId: module.id,
          lessons: module.lessons.filter((lesson) => lesson.cefrLevel === cefrLevel).length }));
        return { cefrLevel, productLevel, status: issues.length ? 'PARTIAL' : 'COMPLETE',
          lessonBlueprints: modules.reduce((sum, module) => sum + module.lessons, 0), modules,
          issues: issues.filter((issue) => !issue.lessonId || catalogue.modules.some((module) => module.lessons.some((lesson) => lesson.id === issue.lessonId && lesson.cefrLevel === cefrLevel))) };
      });
    });
    return { languageCode, script: profile.script, direction: profile.direction,
      reviewStatus: profile.reviewStatus, supportStatus: profile.supportStatus, stages };
  });
  return { curriculumVersion: shared.UNIVERSAL_LANGUAGE_CURRICULUM_VERSION,
    languageCount: rows.length, cefrStages: [...shared.LANGUAGE_CURRICULUM_CEFR_STAGES], moduleFamilies: [...shared.LANGUAGE_LEARNING_MODULE_IDS],
    completeStageCells: rows.flatMap((row) => row.stages).filter((stage) => stage.status === 'COMPLETE').length,
    stageCells: rows.reduce((sum, row) => sum + row.stages.length, 0), uniqueLessonBlueprints: ids.size,
    technicalCompletenessOnly: true, expertLinguisticValidation: 'NOT_VERIFIED', acousticCertification: 'MASTERY_NOT_VERIFIED',
    generatedTeachingCourses: 0, paidCalls: 0, migrations: 0, rows };
}

if (require.main === module) {
  const report = languageCurriculumMatrix();
  const outputIndex = process.argv.indexOf('--output');
  const destination = outputIndex < 0 ? null : process.argv[outputIndex + 1];
  if (outputIndex >= 0 && !destination) throw new Error('--output requires an explicit file path.');
  if (destination) {
    const target = path.resolve(destination);
    fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`${JSON.stringify({ destination: target, languages: report.languageCount,
      stageCells: report.stageCells, completeStageCells: report.completeStageCells, uniqueLessonBlueprints: report.uniqueLessonBlueprints })}\n`);
  } else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.completeStageCells !== report.stageCells) process.exitCode = 1;
}

module.exports = { languageCurriculumMatrix };
