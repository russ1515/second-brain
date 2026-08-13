import { Redirect, Tabs } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { theme } from '../../lib/theme';
import { Button, Empty, Loading } from '../../components/ui';

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
  const { user, loading, offline, retry, logout } = useAuth();
  const { t } = useI18n();

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

  if (!user) return <Redirect href="/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
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
