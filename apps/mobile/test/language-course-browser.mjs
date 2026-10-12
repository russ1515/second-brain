import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * Destructive scope: one English profile created on the dedicated browser-test
 * learner, then deleted through DELETE /api/languages/:id in `finally`.
 *
 * Provider scope: at most the single lesson generation triggered by course
 * creation. This gate deliberately does not forge the ten canonical training
 * proofs required before an assessment/remediation cycle. Those phases remain
 * NOT_VERIFIED until a separately authorised real audio + grading run exists.
 */
const baseUrl = (process.env.WORKSPACE_BROWSER_BASE_URL ?? '').replace(/\/+$/u, '');
const email = process.env.P1_INFRA_LEARNER_EMAIL ?? '';
const password = process.env.P1_BROWSER_PASSWORD ?? '';
const runId = `language-p0-${Date.now()}`;
const evidenceDir = path.join(os.tmpdir(), 'second-brain-browser-evidence', runId);
const objective = 'saluer et se présenter';
const expectedTrainingFormats = [
  'recognition-mcq',
  'contextual-discrimination',
  'fill-blank-no-hint',
  'sentence-reconstruction',
  'register-matching',
  'error-correction',
  'listening-discrimination',
  'guided-writing',
  'voice-pronunciation',
  'mini-dialogue',
];

assert.match(baseUrl, /^https:\/\/beta\.secondbrainlearn\.com$/u, 'BETA_URL_REQUIRED');
assert.equal(email, 'p1-browser-learner@example.test', 'DEDICATED_TECHNICAL_LEARNER_REQUIRED');
assert.ok(password.length > 0, 'P1_BROWSER_PASSWORD_REQUIRED');

fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

const browser = await chromium.launch({ headless: true });
const primaryContext = await browser.newContext({
  locale: 'fr-FR',
  reducedMotion: 'reduce',
  viewport: { width: 1440, height: 1000 },
});
const primaryPage = await primaryContext.newPage();
let resumeContext;
let resumePage;
let createdProfileId = null;
let createdExperienceSessionId = null;
let previousLocale = null;
let localeChanged = false;
let cleanup = 'NOT_NEEDED';
let localeRestore = 'NOT_NEEDED';

async function login(page, returnTo = '/languages') {
  await page.goto(
    `${baseUrl}/sign-in?mode=login&returnTo=${encodeURIComponent(returnTo)}`,
    { waitUntil: 'networkidle' },
  );
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const loginResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/auth/login'
  ), { timeout: 30_000 });
  await page.getByRole('button', { name: /^(se connecter|sign in)$/iu }).click();
  const response = await loginResponse;
  assert.equal(response.status(), 200, 'NORMAL_LOGIN_RESPONSE');
  try {
    await Promise.race([
      page.waitForURL(
        (url) => url.pathname.replace(/\/+$/u, '') === returnTo.replace(/\/+$/u, ''),
        { timeout: 30_000 },
      ),
      page.getByText(
        /^(Vérification en deux étapes|Two-step verification|Confirme ton e-mail|Confirm your email)$/iu,
      ).waitFor({ state: 'visible', timeout: 30_000 }),
    ]);
  } catch {
    const pathname = new URL(page.url()).pathname;
    assert.ok(!pathname.includes('onboarding'), 'TECHNICAL_ACCOUNT_ONBOARDING_REQUIRED');
    assert.fail('NORMAL_LOGIN_DID_NOT_REACH_REQUESTED_ROUTE');
  }
  const pathname = new URL(page.url()).pathname.replace(/\/+$/u, '');
  if (pathname === returnTo.replace(/\/+$/u, '')) return;
  if (await page.getByText(/^(Vérification en deux étapes|Two-step verification)$/iu).isVisible()) {
    assert.fail('MFA_INTERACTION_REQUIRED_NO_BYPASS');
  }
  if (await page.getByText(/^(Confirme ton e-mail|Confirm your email)$/iu).isVisible()) {
    assert.fail('TECHNICAL_ACCOUNT_EMAIL_VERIFICATION_REQUIRED');
  }
  assert.fail('NORMAL_LOGIN_DID_NOT_REACH_REQUESTED_ROUTE');
}

async function appApi(page, requestPath, init = {}) {
  return page.evaluate(async ({ requestPath: route, init: options }) => {
    const accessToken = window.localStorage.getItem('sb.accessToken');
    if (!accessToken) return { ok: false, status: 0, data: null };
    const response = await window.fetch(route, {
      method: options.method ?? 'GET',
      headers: {
        authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    return { ok: response.ok, status: response.status, data };
  }, { requestPath, init });
}

async function requireApi(page, requestPath, init = {}, expectedStatus) {
  const result = await appApi(page, requestPath, init);
  if (expectedStatus !== undefined) {
    assert.equal(result.status, expectedStatus, `${requestPath}: HTTP ${expectedStatus}`);
  } else {
    assert.equal(result.ok, true, `${requestPath}: application response`);
  }
  return result.data;
}

async function loadCourse(page, profileId) {
  return requireApi(page, `/api/languages/${encodeURIComponent(profileId)}/course`);
}

async function waitForCourseStatus(page, profileId, expected) {
  await assert.doesNotReject(async () => {
    await page.waitForFunction(async ({ profileId: id, expected: status }) => {
      const token = window.localStorage.getItem('sb.accessToken');
      if (!token) return false;
      const response = await window.fetch(`/api/languages/${encodeURIComponent(id)}/course`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return false;
      const course = await response.json();
      return course.status === status;
    }, { profileId, expected }, { timeout: 20_000 });
  }, `COURSE_STATUS_${expected.toUpperCase()}`);
}

const evidence = {
  gate: 'P0_LANGUAGE_COURSE_BROWSER',
  status: 'FAIL',
  publicUrl: baseUrl,
  login: 'NOT_VERIFIED',
  uiFrench: 'NOT_VERIFIED',
  courseCreate: 'NOT_VERIFIED',
  courseOpen: 'NOT_VERIFIED',
  courseSave: 'NOT_VERIFIED',
  reloginResume: 'NOT_VERIFIED',
  notionStructure: 'NOT_VERIFIED',
  exercisesLinked: 'NOT_VERIFIED',
  bulletin: 'NOT_VERIFIED',
  brainProjection: 'NOT_VERIFIED',
  assessmentSaved: 'NOT_VERIFIED',
  targetedRemediation: 'NOT_VERIFIED',
  providerDependentCourseGenerationsMaximum: 1,
  limitations: [],
  cleanup: 'NOT_NEEDED',
  localeRestore: 'NOT_NEEDED',
};

try {
  await login(primaryPage);
  evidence.login = 'PASS';

  const me = await requireApi(primaryPage, '/api/auth/me');
  assert.equal(me.email, email, 'AUTHENTICATED_TECHNICAL_ACCOUNT');
  assert.equal(me.emailVerified, true, 'TECHNICAL_ACCOUNT_EMAIL_VERIFIED');
  previousLocale = me.interfaceLanguage ?? me.preferredLanguage ?? 'en';
  if (previousLocale !== 'fr') {
    await requireApi(primaryPage, '/api/auth/locale', {
      method: 'PATCH',
      body: { locale: 'fr' },
    });
    localeChanged = true;
  }

  await primaryPage.goto(`${baseUrl}/languages`, { waitUntil: 'networkidle' });
  await primaryPage.getByText('Ta pratique des langues', { exact: true }).waitFor({ state: 'visible' });
  evidence.uiFrench = 'PASS';

  const profilesBefore = await requireApi(primaryPage, '/api/languages');
  assert.ok(Array.isArray(profilesBefore), 'LANGUAGE_PROFILE_LIST');
  assert.equal(
    profilesBefore.some((profile) => profile.languageCode === 'en'),
    false,
    'TECHNICAL_ACCOUNT_ENGLISH_PROFILE_MUST_BE_ABSENT_BEFORE_TEST',
  );

  await primaryPage.getByRole('button', { name: 'Langue d’apprentissage' }).click();
  await primaryPage.getByRole('radio', { name: /^English, anglais$/iu }).click();
  await primaryPage.getByRole('tab', { name: 'A1', exact: true }).click();
  await primaryPage.getByTestId('language-course-goal').fill(objective);

  const profileResponsePromise = primaryPage.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/languages'
  ), { timeout: 30_000 });
  const courseResponsePromise = primaryPage.waitForResponse((response) => (
    response.request().method() === 'POST'
    && /\/api\/languages\/[^/]+\/course\/start$/u.test(new URL(response.url()).pathname)
  ), { timeout: 180_000 });
  await primaryPage.getByTestId('language-generate-course').click();

  const profileResponse = await profileResponsePromise;
  assert.equal(profileResponse.status(), 201, 'LANGUAGE_PROFILE_CREATED');
  const createdProfile = await profileResponse.json();
  assert.equal(typeof createdProfile?.id, 'string', 'LANGUAGE_PROFILE_ID');
  createdProfileId = createdProfile.id;

  const courseResponse = await courseResponsePromise;
  assert.equal(courseResponse.status(), 201, 'COURSE_CREATED');
  await primaryPage.waitForURL(
    new RegExp(`/languages/${createdProfileId}/course(?:\\?.*)?$`, 'u'),
    { timeout: 30_000 },
  );
  evidence.courseCreate = 'PASS';

  const profile = await requireApi(
    primaryPage,
    `/api/languages/${encodeURIComponent(createdProfileId)}`,
  );
  assert.equal(profile.languageCode, 'en', 'TARGET_LANGUAGE_ENGLISH');
  assert.equal(profile.cefrLevel, 'A1', 'DECLARED_LEVEL_A1');
  assert.equal(profile.goal, objective, 'COURSE_OBJECTIVE_PERSISTED');

  const createdCourse = await loadCourse(primaryPage, createdProfileId);
  assert.equal(createdCourse.profileId, createdProfileId, 'COURSE_PROFILE_SCOPE');
  assert.equal(createdCourse.languageCode, 'en', 'COURSE_LANGUAGE_SCOPE');
  assert.equal(createdCourse.level.declared, 'A1', 'COURSE_LEVEL_SCOPE');
  assert.equal(createdCourse.goal, objective, 'COURSE_GOAL_SCOPE');
  assert.equal(createdCourse.status, 'active', 'COURSE_ACTIVE');
  assert.ok(createdCourse.experienceSession?.id, 'COURSE_EXPERIENCE_SESSION');
  createdExperienceSessionId = createdCourse.experienceSession.id;
  assert.ok(createdCourse.currentLesson?.lessonId, 'GENERATED_LESSON_LINK');
  assert.ok(createdCourse.currentLesson?.unitId, 'GENERATED_UNIT_LINK');
  assert.ok(Array.isArray(createdCourse.units) && createdCourse.units.length > 0, 'COURSE_UNITS');
  assert.ok(createdCourse.units.every((unit) => (
    typeof unit.id === 'string'
    && typeof unit.level === 'string'
    && Array.isArray(unit.strands)
    && unit.strands.length > 0
  )), 'COURSE_LANGUAGE_LEVEL_PILLAR_MILESTONE_SPINE');

  const a1Bulletin = createdCourse.masteryBulletins?.find((item) => item.level === 'A1');
  assert.ok(a1Bulletin, 'A1_BULLETIN_PRESENT');
  assert.ok(a1Bulletin.totalRequiredNotions > 0, 'A1_DYNAMIC_NOTION_DENOMINATOR');
  assert.equal(a1Bulletin.masteredRequiredNotions, 0, 'NO_SYNTHETIC_MASTERY');
  assert.equal(a1Bulletin.rawMasteryRatio, 0, 'RAW_BULLETIN_STARTS_AT_ZERO');
  assert.equal(a1Bulletin.notionGateUnlocked, false, 'NINETY_PERCENT_GATE_LOCKED');
  assert.ok(a1Bulletin.notions.every((notion) => (
    notion.level === 'A1'
    && typeof notion.unitId === 'string'
    && typeof notion.pillar === 'string'
    && typeof notion.criterionId === 'string'
    && ['MASTERED', 'NOT_MASTERED', 'IN_PROGRESS', 'NOT_EVALUABLE'].includes(notion.status)
  )), 'BULLETIN_LANGUAGE_LEVEL_PILLAR_NOTION_STRUCTURE');
  evidence.notionCount = a1Bulletin.totalRequiredNotions;
  evidence.bulletin = 'PASS';

  const lesson = await requireApi(
    primaryPage,
    `/api/lessons/${encodeURIComponent(createdCourse.currentLesson.lessonId)}`,
  );
  assert.equal(lesson.languageProfileId, createdProfileId, 'LESSON_PROFILE_SCOPE');
  assert.ok(Array.isArray(lesson.exercises) && lesson.exercises.length === 10, 'TEN_FORMAT_TRAINING_BATTERY');
  assert.deepEqual(
    lesson.exercises.map((exercise) => exercise.languageFormat).sort(),
    [...expectedTrainingFormats].sort(),
    'EVERY_REQUIRED_TRAINING_FORMAT_EXACTLY_ONCE',
  );
  assert.ok(lesson.exercises.every((exercise) => (
    typeof exercise.languageFormat === 'string'
    && Array.isArray(exercise.notionIds)
    && exercise.notionIds.length > 0
    && Array.isArray(exercise.criterionIds)
    && exercise.criterionIds.length > 0
  )), 'EXERCISES_HAVE_NOTION_AND_CRITERION_LINKS');
  const lessonNotionIds = new Set(lesson.exercises.flatMap((exercise) => exercise.notionIds));
  const generatedUnitNotions = a1Bulletin.notions.filter(
    (notion) => notion.unitId === createdCourse.currentLesson.unitId,
  );
  assert.ok(generatedUnitNotions.length > 0, 'GENERATED_UNIT_NOTIONS');
  assert.ok(
    generatedUnitNotions.every((notion) => lessonNotionIds.has(notion.notionId)),
    'GENERATED_EXERCISES_COVER_UNIT_NOTIONS',
  );
  evidence.exerciseCount = lesson.exercises.length;
  evidence.notionStructure = 'PASS';
  evidence.exercisesLinked = 'PASS';

  assert.equal(createdCourse.nextMasteryTarget?.scopeKind, 'milestone', 'NEXT_TARGET_IS_NOTION_MILESTONE');
  assert.equal(createdCourse.nextMasteryTarget?.eligible, false, 'ASSESSMENT_REQUIRES_REAL_TRAINING');
  assert.equal(createdCourse.nextMasteryTarget?.blockedReason, 'training-incomplete', 'HONEST_TRAINING_GATE');
  evidence.limitations.push(
    'ASSESSMENT_SAVED and TARGETED_REMEDIATION intentionally remain NOT_VERIFIED: the server correctly requires nine evaluated written attempts plus one real audio-coaching evidence item before the autonomous notion assessment; this bounded course-generation gate does not manufacture those proofs.',
  );

  await primaryPage.getByTestId('rll-curriculum').waitFor({ state: 'visible' });
  await primaryPage.getByTestId('language-mastery-bulletin-A1').waitFor({ state: 'visible' });
  await primaryPage.screenshot({
    path: path.join(evidenceDir, 'course-created.png'),
    fullPage: true,
  });

  await primaryPage.getByRole('button', { name: 'Continuer la leçon en cours' }).click();
  await primaryPage.waitForURL(
    (url) => (
      url.pathname === `/languages/${createdProfileId}/course/lesson`
      && url.searchParams.get('unitId') === createdCourse.currentLesson.unitId
    ),
    { timeout: 30_000 },
  );
  await primaryPage.getByRole('button', { name: 'Ouvrir le contenu de la leçon' }).click();
  await primaryPage.waitForURL(
    new RegExp(`/lesson/${createdCourse.currentLesson.lessonId}(?:\\?.*)?$`, 'u'),
    { timeout: 30_000 },
  );
  await primaryPage.getByTestId('lesson-topic').waitFor({ state: 'visible' });
  assert.equal(
    await primaryPage.locator('[data-testid^="language-practice-"]').count(),
    10,
    'TEN_GENERATED_EXERCISES_RENDERED',
  );
  await primaryPage.screenshot({
    path: path.join(evidenceDir, 'generated-lesson-open.png'),
    fullPage: true,
  });

  await primaryPage.goto(`${baseUrl}/languages`, { waitUntil: 'networkidle' });
  await primaryPage.getByTestId('language-course-entry').waitFor({ state: 'visible' });
  await primaryPage.getByTestId('language-course-open').click();
  await primaryPage.waitForURL(
    new RegExp(`/languages/${createdProfileId}/course(?:\\?.*)?$`, 'u'),
    { timeout: 30_000 },
  );
  evidence.courseOpen = 'PASS';

  const pauseResponsePromise = primaryPage.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname
      === `/api/experience-sessions/${createdCourse.experienceSession.id}/pause`
  ), { timeout: 30_000 });
  await primaryPage.getByRole('button', { name: 'Mettre le cours en pause' }).click();
  assert.equal((await pauseResponsePromise).ok(), true, 'COURSE_PAUSE_PERSISTED');
  await waitForCourseStatus(primaryPage, createdProfileId, 'paused');
  evidence.courseSave = 'PASS';

  resumeContext = await browser.newContext({
    locale: 'fr-FR',
    reducedMotion: 'reduce',
    viewport: { width: 1440, height: 1000 },
  });
  resumePage = await resumeContext.newPage();
  await login(resumePage);
  await resumePage.getByText('Ta pratique des langues', { exact: true }).waitFor({ state: 'visible' });
  await resumePage.getByTestId('language-course-open').click();
  await resumePage.waitForURL(
    new RegExp(`/languages/${createdProfileId}/course(?:\\?.*)?$`, 'u'),
    { timeout: 30_000 },
  );

  const reloadedCourse = await loadCourse(resumePage, createdProfileId);
  assert.equal(reloadedCourse.status, 'paused', 'PAUSED_STATE_SURVIVES_RELOGIN');
  assert.equal(
    reloadedCourse.experienceSession?.id,
    createdCourse.experienceSession.id,
    'SAME_EXPERIENCE_SESSION_AFTER_RELOGIN',
  );
  assert.equal(
    reloadedCourse.currentLesson?.lessonId,
    createdCourse.currentLesson.lessonId,
    'SAME_GENERATED_LESSON_AFTER_RELOGIN',
  );

  const resumeResponsePromise = resumePage.waitForResponse((response) => (
    response.request().method() === 'POST'
    && new URL(response.url()).pathname
      === `/api/experience-sessions/${createdCourse.experienceSession.id}/resume`
  ), { timeout: 30_000 });
  await resumePage.getByRole('button', { name: 'Reprendre mon cours' }).click();
  assert.equal((await resumeResponsePromise).ok(), true, 'COURSE_RESUME_RESPONSE');
  await waitForCourseStatus(resumePage, createdProfileId, 'active');
  evidence.reloginResume = 'PASS';

  await resumePage.goto(
    `${baseUrl}/brain?languageProfileId=${encodeURIComponent(createdProfileId)}`,
    { waitUntil: 'networkidle' },
  );
  await resumePage.getByTestId('brain-evidence-view').waitFor({ state: 'visible' });
  await resumePage.getByTestId('language-mastery-bulletin-A1').waitFor({ state: 'visible' });
  assert.equal(
    await resumePage.locator('[data-testid^="language-notion-"]').count(),
    a1Bulletin.totalRequiredNotions,
    'BRAIN_USES_CANONICAL_BULLETIN_DENOMINATOR',
  );
  evidence.brainProjection = 'PASS';
  await resumePage.screenshot({
    path: path.join(evidenceDir, 'brain-canonical-bulletin.png'),
    fullPage: true,
  });

  evidence.status = 'PARTIAL_PASS';
} finally {
  const cleanupPage = resumePage ?? primaryPage;
  if (createdProfileId) {
    try {
      const deleted = await appApi(
        cleanupPage,
        `/api/languages/${encodeURIComponent(createdProfileId)}`,
        { method: 'DELETE' },
      );
      assert.equal(deleted.status, 204, 'TECHNICAL_LANGUAGE_PROFILE_CLEANUP');
      const remaining = await requireApi(cleanupPage, '/api/languages');
      assert.equal(
        remaining.some((profile) => profile.id === createdProfileId),
        false,
        'TECHNICAL_LANGUAGE_PROFILE_REMOVED',
      );
      if (createdExperienceSessionId) {
        const resumable = await requireApi(
          cleanupPage,
          '/api/experience-sessions/resumable?limit=100',
        );
        assert.ok(Array.isArray(resumable?.items), 'RESUMABLE_SESSION_PAGE');
        assert.equal(
          resumable.items.some((session) => session.id === createdExperienceSessionId),
          false,
          'TECHNICAL_COURSE_SESSION_REMOVED',
        );
      }
      cleanup = 'PASS';
    } catch {
      cleanup = 'FAIL';
    }
  }
  if (localeChanged && previousLocale) {
    try {
      const restored = await appApi(cleanupPage, '/api/auth/locale', {
        method: 'PATCH',
        body: { locale: previousLocale },
      });
      assert.equal(restored.ok, true, 'TECHNICAL_ACCOUNT_LOCALE_RESTORE_RESPONSE');
      const restoredMe = await requireApi(cleanupPage, '/api/auth/me');
      assert.equal(
        restoredMe.interfaceLanguage ?? restoredMe.preferredLanguage,
        previousLocale,
        'TECHNICAL_ACCOUNT_LOCALE_RESTORED',
      );
      localeRestore = 'PASS';
    } catch {
      localeRestore = 'FAIL';
    }
  }
  evidence.cleanup = cleanup;
  evidence.localeRestore = localeRestore;
  if (cleanup !== 'PASS' || localeRestore === 'FAIL') {
    evidence.status = 'FAIL';
  }
  evidence.completedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(evidenceDir, 'result.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  await resumeContext?.close();
  await primaryContext.close();
  await browser.close();
}

assert.equal(cleanup, 'PASS', 'TECHNICAL_DATA_CLEANUP');
assert.notEqual(localeRestore, 'FAIL', 'TECHNICAL_ACCOUNT_LOCALE_RESTORE');
process.stdout.write(
  `P0_LANGUAGE_COURSE_BROWSER=${evidence.status} `
  + `COURSE_CREATE=${evidence.courseCreate} COURSE_OPEN=${evidence.courseOpen} `
  + `RELOGIN_RESUME=${evidence.reloginResume} NOTIONS=${evidence.notionStructure} `
  + `BULLETIN=${evidence.bulletin} BRAIN=${evidence.brainProjection} `
  + `ASSESSMENT=${evidence.assessmentSaved} REMEDIATION=${evidence.targetedRemediation} `
  + `CLEANUP=${cleanup} LOCALE_RESTORE=${localeRestore} EVIDENCE_DIR=${evidenceDir}\n`,
);
