'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../../..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('public capability registry exposes the bounded product facts', () => {
  const registry = read('apps/mobile/components/landing/capabilities.registry.ts');

  assert.match(registry, /'AVAILABLE',[\s\S]*'BETA',[\s\S]*'IN_PREPARATION',[\s\S]*'COMING_SOON',[\s\S]*'DISABLED'/);
  assert.match(registry, /web: \{ status: 'AVAILABLE', href: '\/signup' \}/);
  assert.match(registry, /academicWorkspace: \{ status: 'AVAILABLE'/);
  assert.match(registry, /pdf: \{ status: 'AVAILABLE'/);
  assert.match(registry, /markdown: \{ status: 'AVAILABLE'/);
  assert.match(registry, /professor: \{ status: 'AVAILABLE'/);
  assert.match(registry, /voice: \{ status: 'BETA'/);
  assert.match(registry, /internalResearch: \{ status: 'AVAILABLE'/);
  assert.match(registry, /groundedWebResearch: \{ status: 'COMING_SOON'/);
  assert.match(registry, /languages: \{ status: 'AVAILABLE'/);
  assert.match(registry, /android: \{ status: 'IN_PREPARATION'/);
  assert.match(registry, /ios: \{ status: 'IN_PREPARATION'/);
  assert.match(registry, /windows: \{ status: 'COMING_SOON'/);
  assert.match(registry, /macos: \{ status: 'COMING_SOON'/);
  assert.match(registry, /export type CapabilityId =/);
  assert.match(registry, /export const PUBLIC_STATUS_LABEL_KEYS =/);
  assert.match(registry, /export function capability\(id: CapabilityId\)/);
  assert.match(registry, /export function publicStatusLabelKey\(status: PublicCapabilityStatus\)/);
  assert.match(registry, /BETA: 'landingV1\.status\.beta'/);
  assert.match(registry, /IN_PREPARATION: 'landingV1\.status\.inPreparation'/);
  assert.match(registry, /IN_PREPARATION: 'landingV1\.status\.mobilePreparationDetail'/);
  assert.match(registry, /COMING_SOON: 'soon\.badge'/);
  assert.match(registry, /export function publicStatusLabel\(/);
});

test('public platform presentation is derived from the capability registry', () => {
  const content = read('apps/mobile/components/landing/landing-content.ts');

  assert.match(content, /from '\.\/capabilities\.registry'/);
  assert.match(content, /platformStatus\(PUBLIC_CAPABILITIES\.web\.status\)/);
  assert.match(content, /href: PUBLIC_CAPABILITIES\.web\.href/);
  assert.doesNotMatch(content, /href: '\/sign-in'/);
  assert.doesNotMatch(content, /status: 'available'/);
  assert.doesNotMatch(content, /status: 'prepared'/);
  assert.doesNotMatch(content, /status: 'coming-soon'/);
});
