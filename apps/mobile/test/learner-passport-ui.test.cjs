const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Profile renders the learner passport from its dedicated read model', () => {
  const profile = read('apps/mobile/app/(tabs)/profile.tsx');
  const card = read('apps/mobile/components/profile/learner-passport.tsx');

  assert.match(profile, /api<LearnerPassportView>\(['"]\/learner-passport['"]\)/);
  assert.match(profile, /<LearnerPassportCard/);
  assert.match(profile, /edit:\s*['"]passport['"]/);
  assert.match(card, /passport\?\.declared/);
  assert.match(card, /passport\?\.observed/);
  assert.match(card, /passport\.source\.declared/);
  assert.match(card, /passport\.source\.observed/);
});

test('active onboarding keeps interface, primary, teaching and learned languages distinct', () => {
  const steps = read('apps/mobile/components/onboarding/steps.tsx');

  assert.match(steps, /countryOfOrigin/);
  assert.match(steps, /currentCountry/);
  assert.match(steps, /value=\{l\.interface/);
  assert.match(steps, /value=\{l\.native/);
  assert.match(steps, /value=\{l\.explanation/);
  assert.match(steps, /value=\{l\.teaching \?\? l\.study/);
  assert.match(steps, /known:\s*\[\.\.\.known/);
  assert.match(steps, /level:\s*knownLevel/);
});

test('Landing adds one bounded illustrative passport section', () => {
  const landing = read('apps/mobile/components/landing/landing-page.tsx');
  const section = read('apps/mobile/components/landing/learner-passport-section.tsx');

  assert.match(landing, /<LearnerPassportLandingSection\s*\/>/);
  assert.match(section, /landing12\.passport\.demo/);
  assert.match(section, /passport\.originCountry/);
  assert.match(section, /passport\.teachingLanguage/);
  assert.match(section, /passport\.progression/);
  assert.doesNotMatch(section, /unique au monde|unique in the world/i);
});
