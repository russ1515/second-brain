'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Module = require('node:module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../../..');

function loadModule(filename, imports, typescript = false) {
  const originalSource = fs.readFileSync(filename, 'utf8');
  const source = typescript ? ts.transpileModule(originalSource, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText : originalSource;
  const compiled = new Module(filename, module);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = (id) => Object.hasOwn(imports, id) ? imports[id] : originalRequire(id);
  compiled._compile(source, filename);
  return compiled.exports;
}

function createHarness(initial = {}) {
  let pathname = initial.pathname ?? '/profile';
  let auth = {
    user: { id: 'placement-retest-user', emailVerified: true },
    loading: true,
    offline: false,
    onboarded: true,
    retry() {},
    logout() {},
    ...initial.auth,
  };
  let privateScreenRenders = 0;
  const jsx = (type, props, key) => ({ type, key: key ?? null, props: props ?? {} });
  const Tabs = 'Tabs';
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'expo-router': {
      Redirect: 'Redirect',
      Tabs,
      usePathname: () => pathname,
    },
    'react-native': {
      ScrollView: 'ScrollView',
      Text: 'Text',
      StyleSheet: { create: (styles) => styles },
    },
    '../../lib/auth-context': { useAuth: () => auth },
    '../../lib/i18n': { useI18n: () => ({ t: (key) => key }) },
    '../../lib/responsive': { useResponsive: () => ({ width: 1280 }) },
    '../../components/ui': { Button: 'Button', Empty: 'Empty', Loading: 'Loading' },
    '../../components/nav/responsive-tab-bar': { ResponsiveTabBar: 'ResponsiveTabBar' },
    '../../components/nav/app-shell': {
      SidebarProvider: 'SidebarProvider',
      useSidebar: () => ({ width: 280 }),
      useIsRTL: () => false,
    },
    '../../components/landing/landing-page': { LandingPage: 'LandingPage' },
    '../../lib/navigation': { newAppShellEnabledForPath: (value) => value !== '/' },
  };
  const layout = loadModule(path.join(ROOT, 'apps/mobile/app/(tabs)/_layout.tsx'), imports, true).default;
  function resolve(node) {
    if (Array.isArray(node)) return node.map(resolve);
    if (!node || typeof node !== 'object') return node;
    if (typeof node.type === 'function') return resolve(node.type(node.props));
    if (node.type === 'Fragment') return resolve(node.props.children);
    return { ...node, props: { ...node.props, children: resolve(node.props.children) } };
  }
  function walk(node) {
    if (Array.isArray(node)) return node.flatMap(walk);
    if (!node || typeof node !== 'object') return [];
    return [node, ...walk(node.props?.children)];
  }
  function tree() { return resolve(layout()); }
  function mountedTabs() {
    const root = tree();
    const tabs = walk(root).find((node) => node.type === Tabs);
    assert.ok(tabs, 'The nested Tabs navigator must remain mounted during auth restoration');
    assert.equal(typeof tabs.props.screenLayout, 'function', 'Route guards must wrap screen content, not replace the navigator');
    return { root, tabs };
  }
  function scene() {
    const { tabs } = mountedTabs();
    const privateChild = jsx(function PrivatePassportScreen() {
      privateScreenRenders += 1;
      return jsx('PrivatePassportScreen', { owner: auth.user?.id });
    });
    const result = resolve(tabs.props.screenLayout({ children: privateChild }));
    return { result, nodes: walk(result) };
  }
  return {
    tree,
    mountedTabs,
    scene,
    walk,
    get privateScreenRenders() { return privateScreenRenders; },
    setAuth(patch) { auth = { ...auth, ...patch }; },
    setPath(value) { pathname = value; },
  };
}

test('Passport reload mounts the nested navigator while auth is loading, without private content or redirects', () => {
  const harness = createHarness();
  assert.equal(harness.mountedTabs().tabs.props.tabBar({}), null);
  assert.equal(harness.mountedTabs().tabs.props.screenOptions.sceneStyle, undefined, 'Auth restoration must not reserve space for hidden legacy navigation');
  const { nodes } = harness.scene();
  assert.ok(nodes.some((node) => node.type === 'Loading'));
  assert.equal(nodes.some((node) => node.type === 'LandingPage' || node.type === 'Redirect'), false);
  assert.equal(harness.privateScreenRenders, 0);
});

test('Passport reload preserves navigator position/type across auth restoration and renders the same private route', () => {
  const harness = createHarness();
  const before = harness.mountedTabs();
  const structure = (node) => !node || typeof node !== 'object' ? node
    : Array.isArray(node) ? node.map(structure)
      : { type: node.type, key: node.key, children: structure(node.props.children) };
  harness.scene();
  harness.setAuth({ loading: false });
  const after = harness.mountedTabs();
  assert.deepEqual(structure(after.root), structure(before.root));
  const { result, nodes } = harness.scene();
  assert.equal(result.type, 'PrivatePassportScreen');
  assert.equal(result.props.owner, 'placement-retest-user');
  assert.equal(harness.privateScreenRenders, 1);
  assert.equal(nodes.some((node) => node.type === 'LandingPage' || node.type === 'Redirect'), false);
});

test('Unauthenticated Passport deep link preserves its exact destination at login', () => {
  const harness = createHarness({ auth: { loading: false, user: null } });
  const { nodes } = harness.scene();
  const redirect = nodes.find((node) => node.type === 'Redirect');
  assert.deepEqual(redirect?.props.href, { pathname: '/login', params: { returnTo: '/profile' } });
  assert.equal(harness.privateScreenRenders, 0);
});

test('Incomplete onboarding preserves the Passport destination without mounting private content', () => {
  const harness = createHarness({ auth: { loading: false, onboarded: false } });
  const { nodes } = harness.scene();
  const redirect = nodes.find((node) => node.type === 'Redirect');
  assert.deepEqual(redirect?.props.href, { pathname: '/onboarding', params: { returnTo: '/profile' } });
  assert.equal(harness.privateScreenRenders, 0);
});

test('The public root remains Landing for authenticated and anonymous visitors, even during session hydration', () => {
  for (const user of [null, { id: 'placement-retest-user', emailVerified: true }]) {
    const harness = createHarness({ pathname: '/', auth: { user, loading: true, onboarded: false } });
    assert.equal(harness.mountedTabs().tabs.props.tabBar({}), null);
    assert.equal(harness.mountedTabs().tabs.props.screenOptions.sceneStyle, undefined, 'Public Landing must retain its full-width layout');
    const { nodes } = harness.scene();
    assert.ok(nodes.some((node) => node.type === 'LandingPage'));
    assert.equal(nodes.some((node) => node.type === 'Loading' || node.type === 'Redirect'), false);
    assert.equal(harness.privateScreenRenders, 0);
  }
});

test('Offline Passport retains a mounted navigator and a recoverable offline guard', () => {
  const harness = createHarness({ auth: { loading: false, offline: true } });
  const { nodes } = harness.scene();
  assert.ok(nodes.some((node) => node.type === 'Empty' && node.props.title === 'classroom.offlineTitle'));
  assert.ok(nodes.some((node) => node.type === 'Button' && node.props.label === 'app.tryAgain'));
  assert.equal(nodes.some((node) => node.type === 'Redirect' || node.type === 'LandingPage'), false);
  assert.equal(harness.privateScreenRenders, 0);
  harness.setPath('/brain');
  assert.equal(harness.scene().result.type, 'PrivatePassportScreen', 'Existing cached-route exceptions must remain intact');
});

test('The installed Expo serializer retains /profile only while its nested route state is present', () => {
  const serializerFile = require.resolve('expo-router/build/fork/getPathFromState');
  const forksFile = path.join(path.dirname(serializerFile), 'getPathFromState-forks.js');
  // Only the unrelated native schema validator is substituted. The serializer,
  // its index fallback and route traversal are the installed Expo implementation.
  const forks = loadModule(forksFile, { '@react-navigation/native': { validatePathConfig() {} } });
  const { getPathFromState } = loadModule(serializerFile, { './getPathFromState-forks': forks });
  const config = { screens: { '(tabs)': { path: '', screens: { index: '', home: 'home', profile: 'profile' } } } };
  const state = { index: 0, routes: [{ key: 'tabs', name: '(tabs)', state: { index: 0, routes: [{ name: 'profile' }] } }] };
  assert.equal(getPathFromState(state, config), '/profile');
  const missingChildState = { ...state, routes: state.routes.map((route) => ({ ...route, state: undefined })) };
  assert.equal(getPathFromState(missingChildState, config), '/', 'Missing child navigator state is serialized to public group index');
});
