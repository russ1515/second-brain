import { useEffect, useState, type PropsWithChildren } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { adminEnvironment } from '../lib/api';
import { t } from '../lib/i18n';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';

export const SECTIONS = ['dashboard', 'users', 'plans', 'usage', 'costs', 'bugs', 'incidents', 'support', 'infrastructure', 'payments', 'emails', 'documents', 'security', 'analytics', 'settings'] as const;
export type Section = (typeof SECTIONS)[number];

export function AdminShell({ children }: PropsWithChildren) {
  const auth = useAuth(); const router = useRouter(); const pathname = usePathname(); const { width } = useWindowDimensions();
  const { dark, locale, setDark, setLocale } = useAdminUi();
  const [collapsed, setCollapsed] = useState(false); const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    setCollapsed(localStorage.getItem('sb-admin-sidebar') === 'collapsed');
  }, []);
  const compact = width < 1024; const bg = dark ? '#090f1a' : '#f1f5f9'; const panel = dark ? '#111827' : '#fff'; const fg = dark ? '#e5e7eb' : '#0f172a';
  // Nested user routes must retain the Users shell context rather than treating
  // an opaque user ID as a navigation section.
  const selected = (pathname.split('/').filter(Boolean).find((segment) => SECTIONS.includes(segment as Section)) ?? 'dashboard') as Section;
  const toggleSidebar = () => { if (compact) setDrawer(!drawer); else { const next = !collapsed; setCollapsed(next); if (typeof localStorage !== 'undefined') localStorage.setItem('sb-admin-sidebar', next ? 'collapsed' : 'expanded'); } };
  const sidebarVisible = !compact || drawer;
  return <View style={{ flex: 1, minHeight: '100%', flexDirection: 'row', backgroundColor: bg }}>
    {sidebarVisible && <View accessibilityLabel={t(locale, 'primaryNavigation')} accessibilityViewIsModal={compact} style={{ width: compact ? 280 : collapsed ? 76 : 244, backgroundColor: '#0b1220', paddingVertical: 18, position: compact ? 'absolute' : 'relative', zIndex: 20, left: 0, top: 0, bottom: 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'toggleNavigation')} accessibilityHint={t(locale, 'toggleNavigationHint')} onPress={toggleSidebar} style={{ paddingHorizontal: 18, paddingBottom: 18 }}><Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{collapsed && !compact ? 'SB' : 'Second Brain'}</Text><Text style={{ color: '#60a5fa', fontSize: 10 }}>{t(locale, 'controlCenter')}</Text></Pressable>
      <ScrollView>{SECTIONS.map((section) => <Pressable key={section} accessibilityRole="button" accessibilityLabel={t(locale, section)} accessibilityHint={t(locale, 'navigateToSection')} accessibilityState={{ selected: selected === section }} aria-current={selected === section ? 'page' : undefined} onPress={() => { router.push(`/${section}` as never); setDrawer(false); }} style={{ paddingVertical: 10, paddingHorizontal: 18, marginHorizontal: 8, borderRadius: 7, backgroundColor: selected === section ? '#1d4ed8' : 'transparent' }}><Text style={{ color: '#e2e8f0', fontWeight: selected === section ? '700' : '500' }}>{collapsed && !compact ? section.slice(0, 2).toUpperCase() : t(locale, section)}</Text></Pressable>)}</ScrollView>
    </View>}
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ height: 66, paddingHorizontal: width < 768 ? 12 : 22, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: panel, borderBottomWidth: 1, borderBottomColor: dark ? '#263244' : '#e2e8f0' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'toggleNavigation')} accessibilityHint={t(locale, 'toggleNavigationHint')} onPress={toggleSidebar}><Text style={{ color: fg, fontSize: 22 }}>☰</Text></Pressable>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: fg, fontSize: 17, fontWeight: '700' }}>{t(locale, selected)}</Text><Text style={{ color: dark ? '#94a3b8' : '#64748b', fontSize: 11 }}>{t(locale, 'adminBreadcrumb')} / {t(locale, selected)}</Text></View>
        {width >= 768 && <TextInput editable={false} accessibilityLabel={t(locale, 'searchPlaceholder')} placeholder={t(locale, 'search')} placeholderTextColor="#94a3b8" style={{ width: 190, borderWidth: 1, borderColor: dark ? '#334155' : '#cbd5e1', borderRadius: 7, padding: 8, color: fg }} />}
        <View style={{ backgroundColor: adminEnvironment === 'PRODUCTION' ? '#7f1d1d' : '#1e3a8a', borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{adminEnvironment}</Text></View>
        {width >= 768 && <View accessibilityLabel={t(locale, 'notificationsUnavailable')} accessibilityRole="text"><Text style={{ fontSize: 18 }}>◉</Text></View>}
        <Pressable accessibilityRole="button" accessibilityLabel={dark ? t(locale, 'switchToLightTheme') : t(locale, 'switchToDarkTheme')} accessibilityHint={t(locale, 'themeHint')} onPress={() => { setDark(!dark); }}><Text style={{ fontSize: 18 }}>{dark ? '☀' : '☾'}</Text></Pressable>
        {width >= 1024 && <View><Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{auth.identity?.email}</Text><Text style={{ color: '#64748b', fontSize: 10 }}>{auth.identity?.roles.join(', ')}</Text></View>}
        <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'logout')} accessibilityHint={t(locale, 'logoutHint')} onPress={() => { void auth.logout().finally(() => router.replace('/login')); }}><Text style={{ color: '#dc2626', fontWeight: '700' }}>↪</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={locale === 'en' ? t(locale, 'switchToFrench') : t(locale, 'switchToEnglish')} accessibilityHint={t(locale, 'languageHint')} onPress={() => { setLocale(locale === 'en' ? 'fr' : 'en'); }}><Text style={{ color: fg, fontSize: 11 }}>{locale.toUpperCase()}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: width < 768 ? 14 : 24, maxWidth: 1600, width: '100%', alignSelf: 'center' }}>{children}</ScrollView>
    </View>
    {compact && drawer && <Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'closeNavigation')} onPress={() => setDrawer(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 280, backgroundColor: '#0005', zIndex: 10 }} />}
  </View>;
}
