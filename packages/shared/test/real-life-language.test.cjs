'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const shared = require('../dist/index.js');

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function evidence(overrides = {}) {
  return {
    id: 'evidence-1',
    canDoId: 'travel-order',
    source: 'mission',
    sourceId: 'mission-attempt-1',
    result: 'not-demonstrated',
    observedAt: '2026-09-14T08:00:00.000Z',
    observation: 'The learner did not yet complete the communicative task.',
    ...overrides,
  };
}

test('RLLE exposes a gap-free, ordered CEFR spine from A1 through C2', () => {
  const units = shared.RLLE_CURRICULUM;
  assert.ok(units.length > CEFR.length, 'the spine must contain more than one unit per level');
  assert.deepEqual([...new Set(units.map((unit) => unit.level))], CEFR);
  assert.equal(new Set(units.map((unit) => unit.id)).size, units.length);
  assert.deepEqual(
    units.map((unit) => unit.order),
    units.map((unit) => unit.order).toSorted((a, b) => a - b),
  );

  for (const level of CEFR) {
    assert.ok(units.some((unit) => unit.level === level), `missing ${level} curriculum`);
  }
  for (const unit of units) {
    assert.ok(unit.titleCode.startsWith('rlle.unit.'));
    assert.ok(unit.objectiveCode.startsWith('rlle.objective.'));
    assert.ok(unit.strands.length > 0);
    assert.ok(unit.missionIds.length > 0);
    assert.ok(unit.canDoIds.length > 0);
  }
});

test('the complete curriculum covers every required learning strand without replacing existing engines', () => {
  const covered = new Set(shared.RLLE_CURRICULUM.flatMap((unit) => unit.strands));
  assert.deepEqual(
    shared.RLLE_CURRICULUM_STRANDS.filter((strand) => !covered.has(strand)),
    [],
  );
  assert.deepEqual(shared.RLLE_CURRICULUM_STRANDS, [
    'vocabulary', 'verbs', 'conjugation', 'grammar', 'listening', 'reading',
    'conversation', 'interaction', 'pronunciation', 'writing', 'mediation',
  ]);
});

test('a learner starting from zero gets A1 speak-first and survival foundations', () => {
  const units = shared.curriculumForGoal('A1', 'A1', 'general');
  assert.ok(units.length >= 3);
  assert.ok(units.every((unit) => unit.level === 'A1'));

  const strands = new Set(units.flatMap((unit) => unit.strands));
  assert.ok(strands.has('conversation'));
  assert.ok(strands.has('pronunciation'));
  assert.ok(strands.has('listening'));
  assert.ok(strands.has('interaction'));
  assert.ok(strands.has('mediation'));

  const missionIds = new Set(units.flatMap((unit) => unit.missionIds));
  const beginnerMissions = shared.RLLE_WORLD_MISSIONS.filter((mission) => missionIds.has(mission.id));
  assert.ok(beginnerMissions.some((mission) => mission.minimumLevel === 'A1'));
  assert.ok(beginnerMissions.some((mission) => mission.survivalSkills.length > 0));
});

test('an advanced learner resumes at the declared level instead of replaying beginner units', () => {
  const units = shared.curriculumForGoal('B2', 'C1', 'work');
  assert.ok(units.length > 0);
  assert.ok(units.every((unit) => unit.level === 'B2' || unit.level === 'C1'));
  assert.equal(units.some((unit) => unit.level === 'A1' || unit.level === 'A2'), false);
  assert.ok(units.some((unit) => unit.priority === 'goal'));
  assert.ok(units.some((unit) => unit.priority === 'core'));

  const nonRegressive = shared.curriculumForGoal('C1', 'B1', 'work');
  assert.ok(nonRegressive.length > 0);
  assert.ok(nonRegressive.every((unit) => unit.level === 'C1'));
});

test('goal personalisation changes priority but never removes the common pedagogical spine', () => {
  const general = shared.curriculumForGoal('A1', 'C2', 'general');
  for (const domain of shared.RLLE_GOAL_DOMAINS.filter((domain) => domain !== 'general')) {
    const personalised = shared.curriculumForGoal('A1', 'C2', domain);
    assert.deepEqual(
      personalised.map((unit) => unit.id),
      general.map((unit) => unit.id),
      `${domain} must not create curriculum gaps`,
    );
    assert.ok(personalised.some((unit) => unit.priority === 'goal'));
    for (const unit of personalised.filter((item) => item.priority === 'goal')) {
      assert.ok(unit.goalDomains.length < shared.RLLE_GOAL_DOMAINS.length);
      assert.ok(unit.goalDomains.includes(domain));
    }
  }
});

test('curriculum references only real World Missions and Can-Do capabilities', () => {
  const missions = new Set(shared.RLLE_WORLD_MISSIONS.map((mission) => mission.id));
  const canDos = new Set(shared.RLLE_CAN_DO_MAP.map((capability) => capability.id));

  for (const unit of shared.RLLE_CURRICULUM) {
    assert.deepEqual(unit.missionIds.filter((id) => !missions.has(id)), []);
    assert.deepEqual(unit.canDoIds.filter((id) => !canDos.has(id)), []);
    const missionCanDos = new Set(
      shared.RLLE_WORLD_MISSIONS
        .filter((mission) => unit.missionIds.includes(mission.id))
        .flatMap((mission) => mission.canDoIds),
    );
    assert.deepEqual(
      unit.canDoIds.filter((id) => !missionCanDos.has(id)),
      [],
      `${unit.id} must offer a real mission for every declared Can-Do`,
    );
  }
  for (const mission of shared.RLLE_WORLD_MISSIONS) {
    assert.deepEqual(mission.canDoIds.filter((id) => !canDos.has(id)), []);
    assert.ok(
      shared.RLLE_CURRICULUM.some((unit) => unit.missionIds.includes(mission.id)),
      `${mission.id} must be reachable from the curriculum`,
    );
  }
});

test('units, missions and Can-Do capabilities respect their declared CEFR prerequisites', () => {
  const rank = Object.fromEntries(CEFR.map((level, index) => [level, index]));
  const missions = new Map(shared.RLLE_WORLD_MISSIONS.map((mission) => [mission.id, mission]));
  const canDos = new Map(shared.RLLE_CAN_DO_MAP.map((capability) => [capability.id, capability]));

  for (const unit of shared.RLLE_CURRICULUM) {
    for (const missionId of unit.missionIds) {
      assert.ok(
        rank[missions.get(missionId).minimumLevel] <= rank[unit.level],
        `${unit.id} cannot require mission ${missionId} above ${unit.level}`,
      );
    }
    for (const canDoId of unit.canDoIds) {
      assert.ok(
        rank[canDos.get(canDoId).minimumLevel] <= rank[unit.level],
        `${unit.id} cannot assess ${canDoId} above ${unit.level}`,
      );
    }
  }
  for (const mission of shared.RLLE_WORLD_MISSIONS) {
    for (const canDoId of mission.canDoIds) {
      assert.ok(
        rank[canDos.get(canDoId).minimumLevel] <= rank[mission.minimumLevel],
        `${mission.id} cannot validate ${canDoId} above ${mission.minimumLevel}`,
      );
    }
  }
});

test('World Missions cover four real-life categories, mediation and all survival skills', () => {
  assert.deepEqual(
    [...new Set(shared.RLLE_WORLD_MISSIONS.map((mission) => mission.category))].toSorted(),
    [...shared.RLLE_MISSION_CATEGORIES].toSorted(),
  );
  assert.ok(shared.RLLE_WORLD_MISSIONS.some((mission) => mission.strands.includes('mediation')));

  const usedSurvivalSkills = new Set(shared.RLLE_WORLD_MISSIONS.flatMap((mission) => mission.survivalSkills));
  assert.deepEqual(
    shared.RLLE_SURVIVAL_SKILLS.filter((skill) => !usedSurvivalSkills.has(skill)),
    [],
  );
});

test('a Can-Do is validated by demonstrated evidence, never by mere participation', () => {
  assert.equal(shared.canDoStatus([]), 'not-evaluated');
  assert.equal(shared.canDoStatus([evidence()]), 'in-progress');
  assert.equal(shared.canDoStatus([
    evidence(),
    evidence({
      id: 'evidence-2',
      source: 'controlled-activity',
      sourceId: 'activity-1',
      result: 'demonstrated',
      observation: 'The learner completed the task without assistance.',
    }),
  ]), 'validated');
});

test('lesson, functional-gap, mistake-memory and repair contracts expose the complete real loop', () => {
  assert.deepEqual(shared.RLLE_LESSON_STAGES, [
    'communicative-objective', 'vocabulary', 'grammar-verbs', 'example',
    'comprehension', 'practice', 'oral', 'writing', 'verification', 'review',
  ]);
  assert.deepEqual(shared.RLLE_GAP_KINDS, [
    'vocabulary', 'grammar', 'conjugation', 'listening', 'fluency',
    'formulation', 'interaction', 'pronunciation',
  ]);
  assert.deepEqual(shared.RLLE_REPAIR_STAGES, [
    'explain', 'guided-practice', 'retry-now', 'reuse-later', 'consolidate',
  ]);
});

test('course progress is derived from persisted counts and stays unknown without a denominator', () => {
  assert.equal(shared.measuredCoursePercent(0, 0), null);
  assert.equal(shared.measuredCoursePercent(1, Number.NaN), null);
  assert.equal(shared.measuredCoursePercent(0, 4), 0);
  assert.equal(shared.measuredCoursePercent(1, 4), 25);
  assert.equal(shared.measuredCoursePercent(3, 4), 75);
  assert.equal(shared.measuredCoursePercent(8, 4), 100);
  assert.equal(shared.measuredCoursePercent(-2, 4), 0);
});

test('multidimensional progress includes productive, receptive, interactive and mediation evidence', () => {
  assert.deepEqual(shared.RLLE_PROGRESS_DIMENSIONS, [
    'vocabulary', 'grammar', 'conversation', 'listening', 'reading', 'writing',
    'interaction', 'pronunciation', 'mediation',
  ]);
});

test('CEFR helpers preserve ordered levels and adaptive but overridable immersion defaults', () => {
  assert.equal(shared.isCefrAtLeast('B1', 'A2'), true);
  assert.equal(shared.isCefrAtLeast('A2', 'B1'), false);
  assert.deepEqual(CEFR.map((level) => shared.nextCefrLevel(level)), ['A2', 'B1', 'B2', 'C1', 'C2', 'C2']);
  assert.deepEqual(CEFR.map((level) => shared.defaultImmersionForLevel(level)), [
    'guided', 'guided', 'mixed', 'mixed', 'full', 'full',
  ]);
});

test('a realistic CEFR assessment spans receptive, productive, interactive and mediation modalities', () => {
  assert.deepEqual(shared.RLLE_ASSESSMENT_MODALITIES, [
    'listening', 'reading', 'speaking', 'interaction', 'writing', 'mediation',
  ]);
  assert.equal(new Set(shared.RLLE_ASSESSMENT_MODALITIES).size, 6);
});

test('the Lot 12 blueprint is a staged scenario contract, not fabricated learner progress', () => {
  const blueprint = shared.RLLE_LANDING_DEMO_BLUEPRINT;
  assert.equal(blueprint.languageCode, 'en');
  assert.equal(blueprint.level, 'B1');
  assert.ok(shared.RLLE_WORLD_MISSIONS.some((mission) => mission.id === blueprint.missionId));
  assert.deepEqual(blueprint.stages, [
    'goal', 'course', 'mission', 'conversation', 'gap', 'micro-lesson',
    'retry', 'vocabulary', 'review', 'functional-progress',
  ]);
  assert.equal('percent' in blueprint, false);
  assert.equal('validatedCanDo' in blueprint, false);
});
