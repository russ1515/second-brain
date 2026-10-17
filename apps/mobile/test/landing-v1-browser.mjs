import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = (process.env.SECOND_BRAIN_PUBLIC_BASE_URL || 'https://beta.secondbrainlearn.com').replace(/\/$/u, '');
const browser = await chromium.launch({ headless: true });

const orderedSectionIds = [
  'product',
  'academic',
  'professor',
  'research',
  'languages',
  'brain',
  'review',
  'download',
  'privacy',
  'pricing',
  'faq',
  'contact',
];

const paidOrAiApiPaths = [
  /^\/(?:api\/)?(?:ai|llm|provider)(?:\/|$)/u,
  /^\/(?:api\/)?tutor(?:\/|$)/u,
  /^\/(?:api\/)?research\/run(?:\/|$)/u,
  /^\/(?:api\/)?documents\/ask(?:\/|$)/u,
  /^\/(?:api\/)?speech(?:\/|$)/u,
  /^\/(?:api\/)?workspaces(?:\/|$)/u,
  /^\/(?:api\/)?onboarding\/assessment(?:\/|$)/u,
  /^\/(?:api\/)?reading\/generate(?:\/|$)/u,
  /^\/(?:api\/)?languages\/[^/]+\/course\/start(?:\/|$)/u,
];

const trackedContexts = [];

async function trackedPublicContext({
  locale = 'en-US',
  savedLocale = 'en',
  reducedMotion = 'no-preference',
  viewport = { width: 1440, height: 960 },
} = {}) {
  const context = await browser.newContext({ locale, reducedMotion, viewport });
  const requests = [];

  await context.addInitScript((localeCode) => {
    try {
      window.localStorage.setItem('sb.locale', localeCode);
    } catch {
      // Hardened/private contexts can deny storage; browser locale remains the fallback.
    }
  }, savedLocale);

  context.on('request', (request) => {
    if (!['fetch', 'xhr'].includes(request.resourceType())) return;
    const url = new URL(request.url());
    requests.push({ method: request.method(), path: url.pathname, url: `${url.origin}${url.pathname}` });
  });

  const tracked = { context, requests };
  trackedContexts.push(tracked);
  return tracked;
}

function assertNoPaidOrAiRequests(requests, scenario) {
  const forbidden = requests.filter(({ path }) => paidOrAiApiPaths.some((pattern) => pattern.test(path)));
  assert.deepEqual(forbidden, [], `${scenario} triggered an AI/provider-capable route`);
}

async function gotoPublic(page, pathname, readySelector) {
  const response = await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'domcontentloaded' });
  assert.ok(response, `${pathname} did not return a document response`);
  assert.ok(response.status() >= 200 && response.status() < 400, `${pathname} returned HTTP ${response.status()}`);
  await page.locator(readySelector).first().waitFor({ state: 'visible' });
}

async function waitForPath(page, pathname, search = null) {
  await page.waitForURL((url) => (
    url.pathname === pathname
    && (search === null || url.search === search)
  ));
}

async function waitForSectionAtTop(page, id) {
  await page.waitForFunction((sectionId) => {
    const section = document.getElementById(`landing-${sectionId}`);
    if (!section) return false;
    const top = section.getBoundingClientRect().top;
    return top >= 0 && top <= 110;
  }, id);
}

async function assertNoHorizontalOverflow(page, scenario) {
  const overflow = await page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    return width - document.documentElement.clientWidth;
  });
  assert.ok(overflow <= 2, `${scenario} horizontal overflow=${overflow}`);
}

async function assertLocalizedPlatformStatuses(page, copy) {
  for (const [platform, status] of copy) {
    const label = new RegExp(`^${platform}\\s*·\\s*${status}$`, 'u');
    assert.ok(await page.getByText(label).count(), `missing localized status ${platform} · ${status}`);
  }
  for (const rawStatus of ['AVAILABLE', 'BETA', 'IN_PREPARATION', 'COMING_SOON', 'DISABLED']) {
    assert.equal(await page.getByText(rawStatus, { exact: true }).count(), 0, `raw status leaked: ${rawStatus}`);
  }
}

try {
  // Desktop, English: full public-product acceptance and all public navigation paths.
  const desktop = await trackedPublicContext();
  const page = await desktop.context.newPage();
  await gotoPublic(page, '/', '#landing-product');
  assert.equal(new URL(page.url()).pathname, '/', 'anonymous root must remain the public Landing');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');

  const positions = [];
  for (const id of orderedSectionIds) {
    const section = page.locator(`#landing-${id}`);
    assert.equal(await section.count(), 1, `missing #landing-${id}`);
    positions.push(await section.evaluate((node) => node.getBoundingClientRect().top + window.scrollY));
  }
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'Landing sections are not in product-story order');

  const brand = page.getByRole('link', { name: 'Second Brain', exact: true }).first();
  await brand.waitFor({ state: 'visible' });
  assert.equal(await brand.evaluate((node) => {
    let current = node;
    while (current) {
      if (window.getComputedStyle(current).position === 'sticky') return true;
      current = current.parentElement;
    }
    return false;
  }), true, 'the public header is not sticky');

  assert.ok(await page.getByRole('button', { name: 'Start for free', exact: true }).count(), 'missing primary Hero CTA');
  const seeAction = page.getByRole('button', { name: 'See how it works', exact: true }).first();
  await seeAction.click();
  await waitForSectionAtTop(page, 'product');

  await assertLocalizedPlatformStatuses(page, [
    ['Web', 'Available'],
    ['Android', 'In preparation'],
    ['iOS', 'In preparation'],
    ['Windows', 'Coming soon'],
    ['macOS', 'Coming soon'],
  ]);
  assert.ok(await page.locator('#landing-professor').getByText(/^Voice\s*·\s*Beta$/u).count(), 'Voice beta status is not localized');

  const academicNav = page.getByRole('link', { name: 'Academic Workspace', exact: true }).first();
  await academicNav.focus();
  await page.keyboard.press('Enter');
  await waitForSectionAtTop(page, 'academic');
  await page.waitForFunction(() => (
    [...document.querySelectorAll('[role="link"]')].some((node) => (
      node.getAttribute('aria-label') === 'Academic Workspace'
      && node.getAttribute('aria-current') === 'location'
    ))
  ));

  const productNav = page.getByRole('link', { name: 'Product', exact: true }).first();
  await productNav.click();
  await waitForSectionAtTop(page, 'product');
  const storyTabs = page.locator('#landing-product').getByRole('tab');
  assert.equal(await storyTabs.count(), 9, 'the 30-second story must expose its nine deterministic stages');
  await storyTabs.nth(5).click();
  assert.equal(await storyTabs.nth(5).getAttribute('aria-selected'), 'true', 'manual demo stage selection failed');
  const product = page.locator('#landing-product');
  await product.getByRole('button', { name: 'Apply', exact: true }).click();
  await product.getByRole('button', { name: 'Reject', exact: true }).click();

  const academic = page.locator('#landing-academic');
  for (const shell of [
    'Assignment & exercises',
    'Thesis & final-year project',
    'Dissertation & essay',
    'Scientific article',
    'Report',
    'General adaptive',
  ]) {
    assert.ok(await academic.getByText(shell, { exact: true }).count(), `missing Academic Workspace shell: ${shell}`);
  }
  assert.ok(await academic.getByText(/43\s*%/u).count(), 'persistent dossier demo is missing');
  assert.ok(await academic.getByText(/^PDF\s*·\s*Available$/u).count(), 'PDF availability is missing');
  assert.ok(await academic.getByText(/^Markdown\s*·\s*Available$/u).count(), 'Markdown availability is missing');
  assert.equal(await academic.getByText(/DOCX/iu).count(), 0, 'deferred DOCX is advertised');

  const professor = page.locator('#landing-professor');
  for (const phase of ['Comprehension', 'Method', 'Work', 'Coaching', 'Verification', 'Finalization', 'Deconstruction']) {
    assert.ok(await professor.getByText(phase, { exact: true }).count(), `missing Professor phase: ${phase}`);
  }

  const research = page.locator('#landing-research');
  assert.ok(await research.getByText('Sourced research', { exact: true }).count(), 'internal sourced research is missing');
  assert.ok(await research.getByText('Available', { exact: true }).count(), 'internal research status is not available');
  assert.ok(await research.getByText('Web', { exact: true }).count(), 'Web research card is missing');
  assert.ok(await research.getByText('Coming soon', { exact: true }).count(), 'Web research status is not coming soon');

  const languages = page.locator('#landing-languages');
  assert.ok(await languages.getByText('Native language', { exact: true }).count(), 'support-language side of the language path is missing');
  assert.ok(await languages.getByText('Learning language', { exact: true }).count(), 'target-language side of the language path is missing');
  assert.ok(await languages.locator('img').count() >= 34, 'the 34-language registry is not rendered');

  const brain = page.locator('#landing-brain');
  for (const evidence of ['Mastery bulletins', 'Learning evidence', 'Cognostatity level', 'Insufficient data']) {
    assert.ok(await brain.getByText(evidence, { exact: true }).count(), `missing Brain evidence: ${evidence}`);
  }
  assert.match(await brain.innerText(), /not an IQ test/iu, 'Cognostatity disclaimer is missing');
  assert.doesNotMatch(await brain.innerText(), /\b\d+(?:[.,]\d+)?\s*%/u, 'the public Brain contains a fabricated Cognostatity score');
  assert.ok(await page.locator('#landing-review').getByText(/Why this recommendation\?/u).count(), 'Next Best Action is not explained');

  assert.equal(await page.locator('#landing-privacy').getByText('Export your data', { exact: true }).count(), 0, 'obsolete privacy export promise remains');
  assert.doesNotMatch(await page.locator('#landing-pricing').innerText(), /(?:[$€£]\s*\d|\d\s*(?:USD|EUR|GBP))/u, 'an unvalidated public price is rendered');

  const faqButton = page.locator('#landing-faq').getByRole('button').first();
  await faqButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction((node) => node?.getAttribute('aria-expanded') === 'true', await faqButton.elementHandle());

  assert.ok((await page.title()).trim().length > 0, 'SEO title is empty');
  assert.ok((await page.locator('meta[name="description"]').getAttribute('content'))?.trim(), 'SEO description is empty');
  assert.ok((await page.locator('meta[property="og:title"]').getAttribute('content'))?.trim(), 'OpenGraph title is empty');

  // Landing -> Signup -> explicit back.
  await gotoPublic(page, '/', '#landing-product');
  const start = page.getByRole('button', { name: 'Start for free', exact: true }).first();
  await start.focus();
  await page.keyboard.press('Enter');
  await waitForPath(page, '/signup');
  await page.getByTestId('signup-product-demo').waitFor({ state: 'visible' });
  await page.getByTestId('auth-back-home').click();
  await waitForPath(page, '/');
  await page.locator('#landing-product').waitFor({ state: 'visible' });

  // Signup logo -> Landing.
  await gotoPublic(page, '/signup', '[data-testid="signup-product-demo"]');
  await page.getByTestId('auth-logo-home-desktop').click();
  await waitForPath(page, '/');

  // Landing -> Login -> explicit back, then Login logo -> Landing.
  await gotoPublic(page, '/', '#landing-product');
  await page.getByRole('link', { name: 'Sign in', exact: true }).first().click();
  await waitForPath(page, '/login');
  assert.equal(await page.getByTestId('signup-product-demo').count(), 0, 'Login must remain quieter than Signup');
  await page.getByTestId('auth-back-home').click();
  await waitForPath(page, '/');
  await gotoPublic(page, '/login', '[data-testid="auth-logo-home-desktop"]');
  await page.getByTestId('auth-logo-home-desktop').click();
  await waitForPath(page, '/');

  // Native browser history and Signup/Login mode toggles.
  await gotoPublic(page, '/', '#landing-product');
  await page.getByRole('button', { name: 'Start for free', exact: true }).first().click();
  await waitForPath(page, '/signup');
  await page.goBack();
  await waitForPath(page, '/');
  await page.locator('#landing-product').waitFor({ state: 'visible' });
  await gotoPublic(page, '/signup', '[data-testid="signup-product-demo"]');
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await waitForPath(page, '/login');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await waitForPath(page, '/signup');
  assert.equal(await page.getByRole('button', { name: /Google|GitHub/iu }).count(), 0, 'non-existent social authentication is advertised');
  assert.equal(await page.getByRole('link', { name: /Google|GitHub/iu }).count(), 0, 'non-existent social authentication link is advertised');
  assertNoPaidOrAiRequests(desktop.requests, 'desktop Landing/Auth acceptance');

  // Tablet, French: translated statuses and the intended split Signup composition.
  const tablet = await trackedPublicContext({
    locale: 'fr-FR',
    savedLocale: 'fr',
    viewport: { width: 900, height: 1100 },
  });
  const tabletPage = await tablet.context.newPage();
  await gotoPublic(tabletPage, '/', '#landing-product');
  assert.equal(await tabletPage.locator('html').getAttribute('lang'), 'fr');
  await assertLocalizedPlatformStatuses(tabletPage, [
    ['Web', 'Disponible'],
    ['Android', 'En préparation'],
    ['iOS', 'En préparation'],
    ['Windows', 'Bientôt disponible'],
    ['macOS', 'Bientôt disponible'],
  ]);
  assert.ok(await tabletPage.locator('#landing-professor').getByText(/^Voix\s*·\s*Bêta$/u).count(), 'French Voice beta status is missing');
  await assertNoHorizontalOverflow(tabletPage, 'tablet Landing');
  await gotoPublic(tabletPage, '/signup', '[data-testid="signup-product-demo"]');
  const tabletDemo = await tabletPage.getByTestId('signup-product-demo').boundingBox();
  const tabletForm = await tabletPage.getByText('Créer un compte', { exact: true }).first().boundingBox();
  assert.ok(tabletDemo && tabletForm && tabletDemo.x < tabletForm.x, 'tablet Signup does not prioritize the split demo/form composition');
  await assertNoHorizontalOverflow(tabletPage, 'tablet Signup');
  assertNoPaidOrAiRequests(tablet.requests, 'French tablet acceptance');

  // Mobile + reduced motion: form first, static demos, password control and privacy return.
  const mobile = await trackedPublicContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  });
  const mobilePage = await mobile.context.newPage();
  await gotoPublic(mobilePage, '/', '#landing-product');
  await assertNoHorizontalOverflow(mobilePage, 'mobile Landing');
  assert.equal(await mobilePage.locator('#landing-product').getByRole('progressbar').count(), 0, 'Landing demo still animates under reduced motion');
  assert.ok(await mobilePage.locator('#landing-product').getByText('Deconstruction', { exact: true }).count(), 'reduced-motion Landing loses a demo stage');

  await gotoPublic(mobilePage, '/signup', '[data-testid="signup-product-demo"]');
  await assertNoHorizontalOverflow(mobilePage, 'mobile Signup');
  const mobileForm = await mobilePage.getByText('Create an account', { exact: true }).first().boundingBox();
  const mobileDemo = await mobilePage.getByTestId('signup-product-demo').boundingBox();
  assert.ok(mobileForm && mobileDemo && mobileForm.y < mobileDemo.y, 'mobile Signup must render the form before the demo');
  assert.equal(
    await mobilePage.locator('[data-testid^="signup-demo-stage-"]').count(),
    7,
    'reduced-motion Signup must expose all seven deterministic stages',
  );
  assert.equal(await mobilePage.getByTestId('signup-product-demo').getByRole('progressbar').count(), 0, 'Signup demo still animates under reduced motion');

  const password = mobilePage.locator('input[autocomplete="new-password"]');
  await password.waitFor({ state: 'visible' });
  await password.fill('StaticAcceptance123!');
  assert.equal(await password.getAttribute('type'), 'password', 'password does not start masked');
  await mobilePage.getByRole('button', { name: 'Show password', exact: true }).click();
  await mobilePage.waitForFunction((input) => input?.getAttribute('type') === 'text', await password.elementHandle());
  await mobilePage.getByRole('button', { name: 'Hide password', exact: true }).click();
  await mobilePage.waitForFunction((input) => input?.getAttribute('type') === 'password', await password.elementHandle());

  const privacyLink = mobilePage.getByTestId('auth-privacy-link');
  await privacyLink.focus();
  await mobilePage.keyboard.press('Enter');
  await waitForPath(mobilePage, '/', '?section=privacy');
  await mobilePage.locator('#landing-privacy').waitFor({ state: 'visible' });
  await waitForSectionAtTop(mobilePage, 'privacy');
  assertNoPaidOrAiRequests(mobile.requests, 'mobile/reduced-motion acceptance');

  // Arabic: explicit persisted RTL locale on Landing and Signup, not an English fallback.
  const rtl = await trackedPublicContext({
    locale: 'ar-SA',
    savedLocale: 'ar',
    reducedMotion: 'reduce',
    viewport: { width: 1280, height: 900 },
  });
  const rtlPage = await rtl.context.newPage();
  await gotoPublic(rtlPage, '/', '#landing-product');
  assert.equal(await rtlPage.locator('html').getAttribute('lang'), 'ar');
  assert.equal(await rtlPage.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await rtlPage.getByRole('link', { name: 'Product', exact: true }).count(), 0, 'RTL Landing fell back to English navigation');
  assert.equal(await rtlPage.locator('#landing-product').evaluate((node) => getComputedStyle(node).direction), 'rtl');
  await assertNoHorizontalOverflow(rtlPage, 'RTL Landing');
  await gotoPublic(rtlPage, '/signup', '[data-testid="signup-product-demo"]');
  assert.equal(await rtlPage.locator('html').getAttribute('dir'), 'rtl');
  assert.equal(await rtlPage.getByText('Create an account', { exact: true }).count(), 0, 'RTL Signup fell back to English');
  await assertNoHorizontalOverflow(rtlPage, 'RTL Signup');
  assertNoPaidOrAiRequests(rtl.requests, 'RTL acceptance');

  console.log(JSON.stringify({
    status: 'PASS',
    baseUrl,
    sections: orderedSectionIds.length,
    shells: 6,
    professorPhases: 7,
    desktop: 'PASS',
    tablet: 'PASS',
    mobile: 'PASS',
    reducedMotion: 'PASS',
    rtl: 'PASS',
    paidOrAiDemoCalls: 0,
  }, null, 2));
} finally {
  await Promise.allSettled(trackedContexts.map(({ context }) => context.close()));
  await browser.close();
}
