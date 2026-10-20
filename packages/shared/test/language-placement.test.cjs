'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

function skills(levels = ['A1', 'A1', 'A1', 'A1'], round = 1) {
  return shared.LANGUAGE_PLACEMENT_REQUIRED_SKILLS.map((skill, index) => ({
    policyVersion: shared.LANGUAGE_PLACEMENT_POLICY_VERSION,
    round, skill, level: levels[index], questionId: `q-${round}-${skill}`,
    assessmentId: `a-${round}`, submissionId: `s-${round}`,
    reason: 'The independent answer demonstrates this criterion.',
    evidenceQuote: levels[index] === 'PRE_A1' ? '' : 'actual learner response',
    observedAt: '2026-10-20T10:00:00.000Z',
  }));
}

test('placement classifies by the minimum of all four required skills, not an average', () => {
  const result = shared.projectLanguagePlacementRound({ round: 2, skills: skills(['B2', 'B2', 'A2', 'B1'], 2) });
  assert.equal(result.globalLevel, 'A2');
  assert.equal(result.productLevel, 'BEGINNER');
  assert.equal(result.nextRound, null);
});

test('balanced A1 diagnostic is complete and does not require an oral result', () => {
  const result = shared.projectLanguagePlacementRound({ round: 1, skills: skills() });
  assert.equal(result.status, 'complete');
  assert.equal(result.globalLevel, 'A1');
  assert.equal(result.nextRound, null);
});

test('PRE_A1 is preserved honestly and is displayed as Beginner rather than fabricated A1 evidence', () => {
  const result = shared.projectLanguagePlacementRound({ round: 1, skills: skills(['A1', 'PRE_A1', 'A2', 'A1']) });
  assert.equal(result.globalLevel, 'PRE_A1');
  assert.equal(result.productLevel, 'BEGINNER');
});

test('all required skills at A2 open only the second round, never direct advanced placement', () => {
  const result = shared.projectLanguagePlacementRound({ round: 1, skills: skills(['A2', 'A2', 'A2', 'A2']) });
  assert.equal(result.nextRound, 2);
  assert.equal(result.globalLevel, 'A2');
});

test('all required skills at B2 open only the final round', () => {
  const result = shared.projectLanguagePlacementRound({ round: 2, skills: skills(['B2', 'B2', 'B2', 'B2'], 2) });
  assert.equal(result.nextRound, 3);
  assert.equal(result.productLevel, 'INTERMEDIATE');
});

test('the third round is bounded and never requests a fourth', () => {
  const result = shared.projectLanguagePlacementRound({ round: 3, skills: skills(['C2', 'C2', 'C2', 'C2'], 3) });
  assert.equal(result.nextRound, null);
  assert.equal(result.globalLevel, 'C2');
  assert.equal(result.productLevel, 'ADVANCED');
});

test('a missing or unknown required skill prevents classification', () => {
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: skills().slice(1) }).reason, 'missing-required-skill');
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: skills(['A1', null, 'A1', 'A1']) }).reason, 'unknown-required-level');
});

test('an optional strong or unavailable speaking result cannot lift or block the written result', () => {
  for (const level of ['C2', null]) {
    const result = shared.projectLanguagePlacementRound({ round: 1, skills: [...skills(), { ...skills()[0], skill: 'speaking', level }] });
    assert.equal(result.globalLevel, 'A1');
  }
});

test('a single strong required skill cannot override the weaker ones', () => {
  assert.equal(shared.projectLanguagePlacementRound({ round: 3, skills: skills(['C2', 'B1', 'A2', 'B2'], 3) }).globalLevel, 'A2');
});

test('the current round supersedes previous observations instead of choosing isolated best results', () => {
  const prior = skills(['B2', 'B2', 'B2', 'B2'], 2);
  const current = skills(['C1', 'B1', 'B2', 'C1'], 3);
  assert.equal(shared.projectLanguagePlacementRound({ round: 3, skills: [...prior, ...current] }).globalLevel, 'B1');
});

test('duplicate current-round skill observations fail closed', () => {
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: [...skills(), skills()[0]] }).reason, 'duplicate-required-skill');
});

test('the assessment ceiling rejects an unsupported high-level inference', () => {
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: skills(['C2', 'A2', 'A2', 'A2']) }).reason, 'level-above-round-ceiling');
});

test('incomplete provenance, a stale policy or a missing actual quote cannot classify', () => {
  for (const patch of [{ submissionId: '' }, { assessmentId: '' }, { questionId: '' }, { observedAt: 'invalid' }, { policyVersion: 'old' }, { evidenceQuote: '' }]) {
    const values = skills();
    values[0] = { ...values[0], ...patch };
    assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: values }).reason, 'invalid-evidence');
  }
});

test('reusing one question for several skills or mixing submissions fails closed', () => {
  const same = skills();
  same[1].questionId = same[0].questionId;
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: same }).reason, 'invalid-evidence');
  const mixed = skills();
  mixed[1].submissionId = 'other-submission';
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: mixed }).reason, 'invalid-evidence');
});

test('placement projection never mutates observations or creates mastery scores', () => {
  const values = skills().map((item) => Object.freeze(item));
  const before = JSON.stringify(values);
  const result = shared.projectLanguagePlacementRound({ round: 1, skills: Object.freeze(values) });
  assert.equal(JSON.stringify(values), before);
  assert.equal('score' in result, false);
  assert.equal('completionId' in result, false);
});

test('all product levels are CEFR projections including the diagnostic-only PRE_A1 value', () => {
  assert.deepEqual(shared.LANGUAGE_PLACEMENT_LEVELS.map(shared.placementProductLevel), ['BEGINNER', 'BEGINNER', 'BEGINNER', 'INTERMEDIATE', 'INTERMEDIATE', 'ADVANCED', 'ADVANCED']);
});

test('rubrics cover the four required skills and every CEFR tier without language-specific rules or a mastery-score shortcut', () => {
  const directive = shared.placementRubricDirective(1);
  for (const skill of shared.LANGUAGE_PLACEMENT_REQUIRED_SKILLS) assert.ok(directive.includes(`${skill}:`));
  for (const level of shared.LANGUAGE_PLACEMENT_LEVELS) assert.ok(directive.includes(level));
  assert.match(directive, /not a 90% mastery exam/);
  assert.match(directive, /transcript is not acoustic/);
  assert.equal(/French|English|Lingala/.test(directive), false);
});

test('all self-estimates are offered but none is accepted by the evidence projection as a level', () => {
  assert.deepEqual(shared.LANGUAGE_PLACEMENT_SELF_ESTIMATES, ['zero', 'basics', 'communicate', 'fluent', 'unknown']);
  assert.equal(shared.projectLanguagePlacementRound({ round: 1, skills: [] }).globalLevel, null);
});

test('a harder follow-up round cannot revoke the complete A2 consensus already demonstrated', () => {
  const initial = skills(['A2', 'A2', 'A2', 'A2'], 1);
  const followUp = skills(['B1', 'B1', 'PRE_A1', 'B1'], 2);
  assert.equal(shared.highestDemonstratedPlacementLevel([...initial, ...followUp]), 'A2');
});

test('strong partial profiles from different rounds never manufacture a higher global level', () => {
  const initial = skills(['A2', 'A2', 'A1', 'A1'], 1);
  const unauthorizedFollowUp = skills(['A2', 'A2', 'B2', 'B2'], 2);
  assert.equal(shared.highestDemonstratedPlacementLevel([...initial, ...unauthorizedFollowUp]), 'A1');
});

test('a second or third round without the prerequisite complete consensus cannot establish a level', () => {
  assert.equal(shared.highestDemonstratedPlacementLevel(skills(['B2', 'B2', 'B2', 'B2'], 2)), null);
  assert.equal(shared.highestDemonstratedPlacementLevel(skills(['C2', 'C2', 'C2', 'C2'], 3)), null);
});

test('a missing, malformed or technically unavailable next round preserves only the valid baseline', () => {
  const initial = skills(['A2', 'A2', 'A2', 'A2'], 1);
  for (const followUp of [
    skills(['B2', 'B2', 'B2', null], 2),
    skills(['B2', 'B2', 'B2', 'B2'], 2).slice(1),
    skills(['B2', 'B2', 'B2', 'B2'], 2).map((item, index) => index === 0 ? { ...item, submissionId: 'foreign-submission' } : item),
  ]) assert.equal(shared.highestDemonstratedPlacementLevel([...initial, ...followUp]), 'A2');
});

test('a sequential complete three-round diagnostic retains its highest all-skill consensus', () => {
  const observations = [
    ...skills(['A2', 'A2', 'A2', 'A2'], 1),
    ...skills(['B2', 'B2', 'B2', 'B2'], 2),
    ...skills(['C2', 'C2', 'C1', 'C2'], 3),
  ];
  assert.equal(shared.highestDemonstratedPlacementLevel(observations), 'C1');
});
