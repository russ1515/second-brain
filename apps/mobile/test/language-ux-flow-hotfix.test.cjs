'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const lesson = read('apps/mobile/app/lesson/[id].tsx');
const structuredLesson = read('apps/mobile/app/languages/[id]/course/lesson.tsx');
const courseUi = read('apps/mobile/components/language/course-ui.tsx');
const languageService = read('apps/api/src/languages/real-life-language.service.ts');
const sharedLesson = read('packages/shared/src/lesson.ts');

test('an empty flashcard collection is omitted and its server step is skipped once', () => {
  assert.match(lesson, /if \(cards\.length > 0\) \{\s*s\.push\(\{\s*key: 'flashcards'/s);
  assert.doesNotMatch(lesson, /t\('lesson\.noFlashcards'\)/);
  assert.match(lesson, /flow\.activeStepKey !== 'flashcards'/);
  assert.match(lesson, /emptyFlashcardSkip\.current === lockKey/);
  assert.match(lesson, /\/flow\/flashcards\/validate/);
  assert.match(lesson, /\/flow\/\$\{nextKey\}\/enter/);
  assert.match(lesson, /visibleFlowIndex\(current, false\)/);
  assert.match(lesson, /stepKeys\.filter\(\(key\) => key !== 'flashcards'\)/);
  assert.match(sharedLesson, /keys\.push\('flashcards', 'revision'\)/);
  assert.doesNotMatch(lesson, /\/flashcards'\)\.catch\(\(\) => \[\]\)/);
});

test('the structured lesson exposes one Continue action instead of manual completion controls', () => {
  assert.equal((structuredLesson.match(/testID="language-lesson-continue"/g) ?? []).length, 1);
  assert.match(structuredLesson, /label=\{t\('lesson\.continue'\)\}/);
  assert.match(structuredLesson, /onPress=\{continueLesson\}/);
  assert.match(structuredLesson, /\{hasContinueAction \? \(/);
  assert.doesNotMatch(structuredLesson, /const completeStage/);
  assert.doesNotMatch(structuredLesson, /rlle\.ui\.lesson\.completeStage/);
  assert.doesNotMatch(structuredLesson, /rlle\.ui\.lesson\.openGenerated/);
  assert.doesNotMatch(courseUi, /LessonStages\(\{ outline, onStage/);
  assert.doesNotMatch(courseUi, /rlle\.ui\.lesson\.stageAction/);
  assert.doesNotMatch(lesson, /confirmNext|enterConfirmedStep|lesson\.flow\.confirmAction/);
  assert.match(lesson, /const nextKey = current\.stepKeys\[current\.activeIndex \+ 1\]/);
  assert.match(lesson, /\/flow\/\$\{nextKey\}\/enter/);
});

test('Continue opens the real activity and only reconciles after its guided flow completed', () => {
  assert.match(structuredLesson, /lessonFlowCompleted=1/);
  assert.match(structuredLesson, /completedLessonId=\$\{encodeURIComponent\(lessonId\)\}/);
  assert.match(structuredLesson, /api<LessonFlowProgress>\([\s\S]*\/flow`/);
  assert.match(structuredLesson, /if \(!completedFlow\.completed\)/);
  assert.match(structuredLesson, /completedLessonId !== currentLesson\.lessonId/);
  assert.match(
    structuredLesson,
    /if \(lessonFlowCompleted !== '1'\) \{[\s\S]*reconciledLessonFlow\.current = null;/,
  );
  assert.match(structuredLesson, /activeLesson\.lessonId !== lessonId/);
  assert.match(structuredLesson, /activeLesson\.unitId !== currentLesson\.unitId/);
  assert.ok(
    structuredLesson.indexOf('if (!completedFlow.completed)')
      < structuredLesson.indexOf('nextCourse = await advanceRlleLesson'),
    'the server completion proof must be checked before any structured-stage advance',
  );
  assert.match(structuredLesson, /open\(lessonRoute\(mastery\.remediation\.lessonId\)\)/);
  assert.match(structuredLesson, /if \(outline\?\.lessonId\) open\(lessonRoute\(outline\.lessonId\)\)/);
  assert.match(structuredLesson, /nextMasteryTarget\?\.activeAttemptId[\s\S]*resumeScopedMasteryAssessment/);
  assert.match(structuredLesson, /nextMasteryTarget\?\.eligible[\s\S]*startScopedMasteryAssessment/);
});

test('visual completion cannot bypass verification or the canonical mastery decision', () => {
  assert.match(languageService, /if \(completedStage === 'verification'\)/);
  assert.match(languageService, /const missing = missingLanguageTrainingFormats\(trainingEvidence\)/);
  assert.match(languageService, /if \(missing\.length > 0\)[\s\S]*throw new BadRequestException/);
  assert.match(languageService, /Finishing visual stages only opens the autonomous assessment/);
  assert.match(languageService, /status: 'autonomy-ready'/);
  assert.doesNotMatch(
    structuredLesson,
    /advanceRlleLesson[\s\S]{0,220}(?:mastered|finalizeLanguageUnit)/,
  );
});
