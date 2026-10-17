'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('landing follows the bounded V1 product narrative in order', () => {
  const page = read('apps/mobile/components/landing/landing-page.tsx');
  const ordered = [
    'LandingHero',
    'ProductStory',
    'AcademicWorkspaceSection',
    'ProfessorJourneySection',
    'ResearchEvidenceSection',
    'LanguageExperience',
    'BrainEvidenceSection',
    'ReviewNextActionSection',
    'DownloadSection',
    'PrivacySection',
    'PricingSection',
    'FaqSection',
    'ContactSection',
    'FinalCtaSection',
    'LandingFooter',
  ];
  let cursor = page.indexOf('<LandingHero');
  assert.ok(cursor >= 0, 'hero is rendered');
  for (const component of ordered.slice(1)) {
    const next = page.indexOf(`<${component}`, cursor + 1);
    assert.ok(next > cursor, `${component} follows the previous section`);
    cursor = next;
  }
  assert.match(page, /activeAnchor={activeAnchor}/);
  assert.match(page, /scrollEventThrottle=\{100\}/);
});

test('hero exposes two primary actions and honest platform facts', () => {
  const hero = read('apps/mobile/components/landing/hero-section.tsx');
  assert.match(hero, /landing12\.cta\.start/);
  assert.match(hero, /landing12\.cta\.how/);
  assert.doesNotMatch(hero, /landing12\.cta\.download/);
  assert.match(hero, /publicStatusLabel\(fact\.status, t\)/);
});

test('static product demonstration covers control, evidence, completion and resume', () => {
  const demo = read('apps/mobile/components/landing/product-story.tsx');
  for (const stage of ['capture', 'classify', 'understand', 'source', 'answer', 'suggestion', 'verify', 'deconstruct', 'export']) {
    assert.match(demo, new RegExp(`id: '${stage}'`));
  }
  assert.match(demo, /landingV1\.action\.apply/);
  assert.match(demo, /landingV1\.action\.reject/);
  assert.match(demo, /landingV1\.demo\.detectedHomework/);
  assert.match(demo, /landingV1\.demo\.suggestionSource/);
  assert.match(demo, /landingV1\.demo\.deconstruction/);
  assert.doesNotMatch(demo, /landing12\.story\.oral\.transcriptText/);
  assert.doesNotMatch(demo, /landing12\.story\.professor\.session/);
  assert.match(demo, /setApplied\(true\)/);
  assert.match(demo, /learn\.exam\.consignes/);
  assert.match(demo, /writing\.d\.structure/);
  assert.match(demo, /tutor6\.block\.source/);
  assert.match(demo, /brain8\.history\.kind\.error/);
  assert.match(demo, /workspace10\.resumeDetail/);
  assert.match(demo, /PDF/);
  assert.match(demo, /Markdown/);
  assert.doesNotMatch(demo, /\bapi\s*\(/);
  assert.doesNotMatch(demo, /DOCX/i);
});

test('Academic Workspace, Professor, Research and Brain remain factual', () => {
  const sections = read('apps/mobile/components/landing/product-realignment-sections.tsx');
  for (const family of ['assignment', 'thesis', 'dissertation', 'article', 'report', 'general']) {
    assert.match(sections, new RegExp(`id: '${family}'`));
  }
  assert.match(sections, /preview:/);
  assert.match(sections, /learn5\.draft\.restored/);
  assert.match(sections, /nav\.progress/);
  assert.match(sections, /capability\('voice'\)/);
  for (const phase of ['COMPREHENSION', 'METHOD', 'WORK', 'COACHING', 'VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION']) {
    assert.match(sections, new RegExp(`'${phase}'`));
  }
  assert.match(sections, /capability\('internalResearch'\)/);
  assert.match(sections, /capability\('groundedWebResearch'\)/);
  assert.match(sections, /brainV1\.bulletin\.section/);
  assert.match(sections, /brainV1\.tabs\.evidence/);
  assert.match(sections, /brainV1\.tabs\.cognostatity/);
  assert.match(sections, /brainV1\.cognostatity\.disclaimer/);
  assert.doesNotMatch(sections, /Gemini|GEMINI_API_KEY|RATE_LIMIT|provider non configur/i);
});

test('privacy, signup and login are realigned without weakening auth', () => {
  const supporting = read('apps/mobile/components/landing/supporting-sections.tsx');
  const auth = read('apps/mobile/app/sign-in.tsx');
  const signupDemo = read('apps/mobile/components/auth/signup-product-demo.tsx');
  assert.doesNotMatch(supporting, /landing12\.privacy\.export/);
  assert.match(supporting, /priv\.learningReset\.title/);
  assert.match(auth, /pathname: route/);
  assert.match(auth, /router\.dismissTo\('\/\?section=privacy'\)/);
  assert.match(auth, /SignupProductDemo/);
  assert.match(auth, /landingV1\.auth\.privacy/);
  assert.match(signupDemo, /PUBLIC_CAPABILITIES\.voice\.status/);
  assert.match(signupDemo, /% DEMO_STAGES\.length/);
  assert.match(signupDemo, /voice11\.pause/);
  assert.doesNotMatch(signupDemo, /Google|GitHub|groundedWebResearch/);
  assert.doesNotMatch(auth, /Google|GitHub/);
});
