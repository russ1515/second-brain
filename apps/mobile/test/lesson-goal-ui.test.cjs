'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '../app/lesson/new.tsx'), 'utf8');

test('new lesson requires an explicit objective and sends it as a linked goal', () => {
  assert.match(source, /const \[objective, setObjective\] = useState\(''\)/);
  assert.match(source, /objective\.trim\(\)\.length > 0/);
  assert.match(source, /testID="lesson-goal-input"/);
  assert.match(source, /goalTitle:\s*objective\.trim\(\)/);
  assert.match(source, /goalPeriod:\s*'weekly'/);
});

test('new lesson never auto-creates from route params or component mount', () => {
  assert.doesNotMatch(source, /\buseEffect\b/);
  assert.doesNotMatch(source, /create\(\{[^}]*\}\);/s);
  const submit = source.indexOf('onPress={() => create({');
  const goalTitle = source.indexOf('goalTitle: objective.trim()', submit);
  assert.ok(submit >= 0 && goalTitle > submit, 'lesson creation must remain user-triggered and include goalTitle');
});
