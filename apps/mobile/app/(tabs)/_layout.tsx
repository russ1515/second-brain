import { Redirect, Tabs, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { Button, Empty, Loading } from '../../components/ui';
import { ResponsiveTabBar } from '../../components/nav/responsive-tab-bar';
import { SidebarProvider, useSidebar, useIsRTL } from '../../components/nav/app-shell';
import { LandingPage } from '../../components/landing/landing-page';
import { newAppShellEnabledForPath } from '../../lib/navigation';

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

/**
 * The five spaces.
 *
 * The auth + offline guard lives here rather than in each screen: it now gates
 * each scene before its content mounts. The navigator itself must stay mounted
 * during session restoration, otherwise Expo loses nested deep links such as
 * `/profile` and resolves the tab group to its public index instead.
 */
export default function TabsLayout() {
  const pathname = usePathname();
  return (
    <SidebarProvider>
      <Shell externallyManaged={newAppShellEnabledForPath(pathname)} />
    </SidebarProvider>
  );
}

function TabRouteGate({ children }: { children: ReactNode }) {
  const { user, loading, offline, onboarded, retry, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();

  // `/` is the public product entrance for every visitor, including someone
  // who already has a session. The authenticated learner home lives at
  // `/home`, so opening the public URL can never be swallowed by an auth guard.
  if (pathname === '/') return <LandingPage />;

  if (loading) return <Loading label={t('classroom.opening')} />;

  // Session kept but the API is unreachable: do NOT bounce to sign-in, which
  // reads as "you were logged out" and invites re-entering a password never lost.
  const routeCanUseCache = pathname === '/library' || pathname === '/brain';
  if (offline && !routeCanUseCache) {
    return (
      <ScrollView contentContainerStyle={styles.offline}>
        <Empty
          title={t('classroom.offlineTitle')}
          detail={t('classroom.offlineDetail')}
        />
        <Button label={t('app.tryAgain')} onPress={retry} />
        <Button variant="ghost" label={t('app.signOut')} onPress={logout} />
      </ScrollView>
    );
  }

  if (!user) return <Redirect href={{ pathname: '/login', params: { returnTo: pathname } }} />;

  // The Universal KYC gate (UI/UX Sprint 2): a signed-in learner who has not
  // finished onboarding is sent to build their space first. `onboarded === null`
  // (unknown / status check failed) deliberately falls through to the app so a
  // status hiccup never traps them out of the classroom.
  if (onboarded === false) return <Redirect href={{ pathname: '/onboarding', params: { returnTo: pathname } }} />;

  return <>{children}</>;
}

function Shell({ externallyManaged = false }: { externallyManaged?: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { user, loading, offline, onboarded } = useAuth();
  const { width } = useResponsive();
  const rtl = useIsRTL();
  const { width: sidebarW } = useSidebar();
  const desktop = width >= 1024;
  const routeCanUseCache = pathname === '/library' || pathname === '/brain';
  const hideTabBar = externallyManaged || pathname === '/' || loading || !user
    || onboarded === false || (offline && !routeCanUseCache);
  const sceneStyle = !hideTabBar && desktop
    ? (rtl ? { paddingRight: sidebarW } : { paddingLeft: sidebarW })
    : undefined;

  return (
    <Tabs
      tabBar={hideTabBar ? () => null : (props) => <ResponsiveTabBar {...props} />}
      screenLayout={({ children }) => <TabRouteGate>{children}</TabRouteGate>}
      screenOptions={{
        headerShown: false,
        sceneStyle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: t('tab.home'),
          tabBarIcon: ({ color }) => <TabIcon emoji="🏠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: t('tab.learn'),
          tabBarIcon: ({ color }) => <TabIcon emoji="📚" color={color} />,
        }}
      />
      <Tabs.Screen
        name="brain"
        options={{
          title: t('tab.brain'),
          tabBarIcon: ({ color }) => <TabIcon emoji="🧠" color={color} />,
        }}
      />
      <Tabs.Screen
        name="study"
        options={{
          title: t('tab.study'),
          tabBarIcon: ({ color }) => <TabIcon emoji="📅" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tab.profile'),
          tabBarIcon: ({ color }) => <TabIcon emoji="👤" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  offline: {
    padding: 20,
    gap: 12,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
});
