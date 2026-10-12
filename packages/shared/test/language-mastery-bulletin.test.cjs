'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

function a1Notions() {
  return shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .filter((unit) => unit.level === 'A1')
    .flatMap((unit) => unit.milestones);
}

function proof(targetId, verdict, verifiedCompletionId = null) {
  return { targetId, verdict, verifiedCompletionId };
}

test('bulletin projects the four exact notion states from canonical evidence', () => {
  const notions = a1Notions();
  const bulletin = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'en',
    level: 'A1',
    evidence: [
      proof(notions[0].id, 'mastered', 'completion-verified'),
      proof(notions[1].id, 'not-mastered'),
      proof(notions[2].id, 'not-evaluable'),
    ],
  });

  assert.deepEqual(
    bulletin.notions.slice(0, 4).map((item) => item.status),
    ['MASTERED', 'NOT_MASTERED', 'NOT_EVALUABLE', 'IN_PROGRESS'],
  );
  assert.equal(bulletin.notions[0].verifiedCompletionId, 'completion-verified');
  assert.equal(bulletin.notions[0].sourceStrand, notions[0].sourceStrand);
  assert.equal(bulletin.notions[0].origin, notions[0].origin);
  assert.equal(bulletin.masteredRequiredNotions, 1);
  assert.equal(bulletin.toStrengthenRequiredNotions, notions.length - 1);
  assert.equal(bulletin.notMasteredRequiredNotions, 1);
  assert.equal(bulletin.notEvaluableRequiredNotions, 1);
  assert.equal(bulletin.inProgressRequiredNotions, notions.length - 3);
  assert.equal(bulletin.totalRequiredNotions, notions.length);
});

test('verified completion is the only mastery source and remains acquired after later failures', () => {
  const notion = a1Notions()[0];
  const withoutCompletion = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'en',
    level: 'A1',
    evidence: [proof(notion.id, 'mastered')],
  });
  assert.equal(withoutCompletion.notions[0].status, 'IN_PROGRESS');

  const acquired = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'en',
    level: 'A1',
    evidence: [
      proof(notion.id, 'mastered', 'completion-verified'),
      proof(notion.id, 'not-mastered'),
      proof(notion.id, 'not-evaluable'),
    ],
  });
  assert.equal(acquired.notions[0].status, 'MASTERED');
  assert.equal(acquired.notions[0].verifiedCompletionId, 'completion-verified');
});

test('NOT_EVALUABLE never hides an earlier evaluated weakness', () => {
  const notion = a1Notions()[0];
  const bulletin = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'en',
    level: 'A1',
    evidence: [
      proof(notion.id, 'not-mastered'),
      proof(notion.id, 'not-evaluable'),
    ],
  });

  assert.equal(bulletin.notions[0].status, 'NOT_MASTERED');
  assert.equal(bulletin.notMasteredRequiredNotions, 1);
  assert.equal(bulletin.notEvaluableRequiredNotions, 0);
});

test('the notion denominator follows the actual curriculum and gates before display rounding', () => {
  const notions = a1Notions();
  assert.equal(notions.length, 14, 'the current A1 curriculum has a dynamic fourteen-notion denominator');

  const below = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'en',
    level: 'A1',
    evidence: notions.slice(0, 12).map((item, index) =>
      proof(item.id, 'mastered', `completion-${index}`)),
  });
  assert.equal(below.masteredRequiredNotions, 12);
  assert.equal(below.rawMasteryRatio, 12 / 14);
  assert.equal(below.notionGateUnlocked, false);

  const pass = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'en',
    level: 'A1',
    evidence: notions.slice(0, 13).map((item, index) =>
      proof(item.id, 'mastered', `completion-${index}`)),
    strictCertificationUnlocked: false,
  });
  assert.equal(pass.masteredRequiredNotions, 13);
  assert.equal(pass.rawMasteryRatio, 13 / 14);
  assert.equal(pass.notionGateUnlocked, true);
  assert.equal(pass.strictCertification.separateFromNotionGate, true);
  assert.equal(pass.strictCertification.requiredPillarExams, 5);
  assert.equal(pass.strictCertification.unlocked, false);
});

test('an empty course scope never unlocks and a scoped denominator is not hard-coded', () => {
  const unitId = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP.find((unit) => unit.level === 'B2').unitId;
  const unitNotions = shared.RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .find((unit) => unit.unitId === unitId).milestones;
  const scoped = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'de',
    level: 'B2',
    curriculumUnitIds: [unitId],
    evidence: [],
  });
  assert.equal(scoped.totalRequiredNotions, unitNotions.length);
  assert.equal(scoped.notionGateUnlocked, false);

  const empty = shared.projectRlleLevelMasteryBulletin({
    languageCode: 'de',
    level: 'B2',
    curriculumUnitIds: [],
    evidence: [],
  });
  assert.equal(empty.totalRequiredNotions, 0);
  assert.equal(empty.rawMasteryRatio, 0);
  assert.equal(empty.notionGateUnlocked, false);
});
