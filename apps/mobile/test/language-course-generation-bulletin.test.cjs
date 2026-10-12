'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

const languages = read('apps/mobile/app/languages/index.tsx');
const course = read('apps/mobile/app/languages/[id]/course/index.tsx');
const courseUi = read('apps/mobile/components/language/course-ui.tsx');
const brain = read('apps/mobile/app/(tabs)/brain.tsx');
const brainBulletins = read('apps/mobile/lib/brain-language-bulletins.ts');
const revision = read('apps/mobile/app/revision.tsx');

test('profile creation starts the real course with one stable operation key', () => {
  assert.match(languages, /const created = await api<LanguageProfileSummary>\('\/languages'/);
  assert.match(languages, /await saveActiveLanguage\(user\.id, created\.id\)/);
  assert.match(languages, /await startRlleCourse\(created\.id, \{/);
  assert.match(languages, /startFrom: 'declared-level'/);
  assert.match(languages, /targetLevel: created\.cefrLevel/);
  assert.match(languages, /goal: requestedGoal/);
  assert.match(languages, /idempotencyKey: `mobile-course:\$\{created\.id\}:profile-goal`/);
  assert.doesNotMatch(languages, /goalDomain: 'general'/);
  assert.match(languages, /router\.push\(`\/languages\/\$\{encodeURIComponent\(created\.id\)\}\/course`/);
  assert.match(languages, /course\?generation=failed/);
  assert.doesNotMatch(languages, /DELETE[\s\S]{0,300}created\.id/);
  assert.match(languages, /testID="language-course-goal"/);
  assert.match(languages, /testID="language-generate-course"/);
});

test('course generation failure remains retryable without pretending a course exists', () => {
  assert.match(course, /generationFailed/);
  assert.match(course, /course\?\.status === 'not-started'/);
  assert.match(course, /rlle\.ui\.course\.generationFailedDetail/);
  assert.match(course, /testID="language-course-start"/);
});

test('notion mastery UI renders only the server projection and exact statuses', () => {
  assert.match(course, /bulletins=\{course\.masteryBulletins\}/);
  assert.match(courseUi, /bulletin\.displayPercent/);
  assert.match(courseUi, /bulletin\.masteredRequiredNotions/);
  assert.match(courseUi, /bulletin\.toStrengthenRequiredNotions/);
  assert.match(courseUi, /bulletin\.notionGateUnlocked/);
  assert.match(courseUi, /notion\.status/);
  assert.match(courseUi, /`rlle\.ui\.strand\.\$\{notion\.sourceStrand\}`/);
  assert.match(courseUi, /localizedLabel/);
  assert.doesNotMatch(courseUi, /notion\.criterionId/);
  for (const status of ['MASTERED', 'NOT_MASTERED', 'IN_PROGRESS', 'NOT_EVALUABLE']) {
    assert.match(courseUi, new RegExp(`${status}:`));
  }
  assert.doesNotMatch(courseUi, /rawMasteryRatio\s*>=/);
  assert.doesNotMatch(courseUi, /masteredRequiredNotions\s*\//);
  assert.doesNotMatch(courseUi, /strictCertification/);
  assert.match(courseUi, /testID="language-mastery-bulletins"/);
  assert.match(courseUi, /testID=\{`language-notion-\$\{notion\.notionId\}`\}/);
});

test('Brain aggregates all language bulletins and preserves an explicit profile scope', () => {
  assert.match(brain, /languageProfileId/);
  assert.match(brain, /api<LanguageProfileSummary\[]>\('\/languages'\)/);
  assert.match(brain, /resolveBrainLanguageBulletins\(languageProfileId/);
  assert.match(brainBulletins, /Promise\.allSettled/);
  assert.match(brainBulletins, /profiles\.map/);
  assert.match(brainBulletins, /dependencies\.loadCourse\(profile\.id\)/);
  assert.match(brain, /enabled: Boolean\(user\)/);
  assert.match(brain, /languageCourses\.data\?\.items\.map/);
  assert.match(brain, /bulletins=\{course\.course\.masteryBulletins\}/);
  assert.match(course, /bulletin\.notions\.some/);
  assert.match(course, /\/revision\?languageProfileId=\$\{profile\.id\}/);
  assert.match(course, /\/brain\?languageProfileId=\$\{profile\.id\}/);
  assert.match(revision, /languageProfileId/);
});
