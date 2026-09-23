const test = require('node:test');
const assert = require('node:assert/strict');
const {
  filterAndRankLanguages,
  resolveResponsiveLayout,
  resolveUsageMeter,
  responsiveColumnBasis,
  SUPPORTED_LANGUAGE_CODES,
} = require('../dist');

test('responsive model describes compact, medium and wide compositions', () => {
  const phone = resolveResponsiveLayout(390, 844);
  assert.equal(phone.mode, 'compact');
  assert.equal(phone.contentPadding, 16);
  assert.equal(phone.isDesktop, false);

  const tablet = resolveResponsiveLayout(768, 1024);
  assert.equal(tablet.mode, 'medium');
  assert.equal(tablet.columns, 3);
  assert.equal(tablet.isTablet, true);

  const desktop = resolveResponsiveLayout(1440, 900);
  assert.equal(desktop.mode, 'wide');
  assert.equal(desktop.maxContentWidth, 1360);
  assert.equal(desktop.isDesktop, true);
  assert.equal(responsiveColumnBasis(4), '23%');
  assert.throws(() => resolveResponsiveLayout(0, 800));
});

test('usage meter preserves unlimited and truthful threshold states', () => {
  assert.deepEqual(resolveUsageMeter(12, null), {
    used: 12,
    limit: null,
    remaining: null,
    ratio: null,
    percent: null,
    unlimited: true,
    tone: 'neutral',
  });

  assert.equal(resolveUsageMeter(79, 100).tone, 'primary');
  assert.equal(resolveUsageMeter(80, 100).tone, 'warning');
  assert.equal(resolveUsageMeter(100, 100).tone, 'critical');
  assert.equal(resolveUsageMeter(120, 100).remaining, 0);
  assert.equal(resolveUsageMeter(0, 0).tone, 'critical');
  assert.throws(() => resolveUsageMeter(-1, 100));
});

test('language search is accent-insensitive and ranks active then recent', () => {
  assert.equal(SUPPORTED_LANGUAGE_CODES.length, 27);
  const options = [
    { code: 'fr', nativeName: 'Français', displayName: 'French' },
    { code: 'en', nativeName: 'English', displayName: 'English' },
    { code: 'es', nativeName: 'Español', displayName: 'Spanish' },
  ];

  assert.deepEqual(
    filterAndRankLanguages(options, '', 'es', ['en']).map((item) => item.code),
    ['es', 'en', 'fr'],
  );
  assert.deepEqual(
    filterAndRankLanguages(options, 'francais').map((item) => item.code),
    ['fr'],
  );
  assert.deepEqual(
    filterAndRankLanguages(options, 'spanish').map((item) => item.code),
    ['es'],
  );
});
