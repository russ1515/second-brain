import { Redirect, Tabs } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { theme } from '../../lib/theme';
import { Button, Empty, Loading } from '../../components/ui';
import { ResponsiveTabBar } from '../../components/nav/responsive-tab-bar';
import { LandingPage } from '../../components/landing/landing-page';

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

/**
 * The five spaces.
 *
 * The auth + offline guard lives here rather than in each screen: it now gates
 * the whole classroom at once, and the tabs only mount for a signed-in learner
 * with a reachable API.
 */
export default function TabsLayout() {
  const { user, loading, offline, onboarded, retry, logout } = useAuth();
  const { t } = useI18n();
  const { width } = useResponsive();

  if (loading) return <Loading label={t('classroom.opening')} />;

  // Session kept but the API is unreachable: do NOT bounce to sign-in, which
  // reads as "you were logged out" and invites re-entering a password never lost.
  if (offline) {
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

  // Public landing (UI/UX Sprint 8): a logged-out visitor to `/` (or any app
  // route) sees the marketing landing, whose CTAs route into the auth flow
  // (/sign-in → OTP → onboarding → app). The auth + onboarding gates below are
  // untouched.
  if (!user) return <LandingPage />;

  // The Universal KYC gate (UI/UX Sprint 2): a signed-in learner who has not
  // finished onboarding is sent to build their space first. `onboarded === null`
  // (unknown / status check failed) deliberately falls through to the app so a
  // status hiccup never traps them out of the classroom.
  if (onboarded === false) return <Redirect href="/onboarding" />;

  // Responsive nav (UI/UX Sprint 7): a permanent left sidebar on desktop
  // (≥1024px), the bottom bar otherwise — same 5 spaces. On desktop the content
  // is offset so it never sits under the floating sidebar.
  const desktop = width >= 1024;

  return (
    <Tabs
      tabBar={(props) => <ResponsiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: desktop ? { paddingLeft: 232 } : undefined,
      }}
    >
      <Tabs.Screen
        name="index"
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
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
});
