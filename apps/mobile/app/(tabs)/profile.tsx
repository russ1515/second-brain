import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { theme } from '../../lib/theme';
import { FeatureTile } from '../../components/feature-tile';
import { LocalePicker } from '../../components/locale-picker';
import { Button, Card } from '../../components/ui';
import { useResponsive } from '../../lib/responsive';

/**
 * 👤 Profile — the learner and their settings.
 *
 * Real: account, app language (moved off Home), system health, sign out.
 * Coming Soon: preferences, subscription, AI settings, notifications — the
 * structure is here, the screens land later. Nothing new is coded.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { maxContentWidth } = useResponsive();
  return (
    <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
      <Text style={styles.h1}>👤 {t('profile.title')}</Text>

      {/* Compte */}
      <Card>
        <Text style={styles.label}>{t('profile.account')}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>
        {user?.displayName ? <Text style={styles.name}>{user.displayName}</Text> : null}
      </Card>

      {/* Langues (app language) */}
      <Card>
        <LocalePicker />
        <Text style={styles.manageLink} onPress={() => router.push('/language-manager')}>
          🌍 {t('lm.manage')}
        </Text>
      </Card>

      <View style={styles.grid}>
        <FeatureTile
          emoji="🔒"
          title={t('profile.privacy')}
          subtitle={t('priv.tileDetail')}
          onPress={() => router.push('/privacy')}
          testID="tile-privacy"
        />
        <FeatureTile emoji="⚙️" title={t('profile.preferences')} comingSoon testID="tile-preferences" />
        <FeatureTile emoji="🤖" title={t('profile.aiSettings')} comingSoon testID="tile-ai" />
        <FeatureTile emoji="🔔" title={t('profile.notifications')} comingSoon testID="tile-notifs" />
        <FeatureTile
          emoji="💳"
          title={t('profile.subscription')}
          subtitle={t('sub.tileDetail')}
          onPress={() => router.push('/subscription')}
          testID="tile-subscription"
        />
        <FeatureTile
          emoji="📊"
          title={t('profile.usage')}
          subtitle={t('usage.tileDetail')}
          onPress={() => router.push('/usage')}
          testID="tile-usage"
        />
        <FeatureTile
          emoji="🏫"
          title={t('profile.orgs')}
          subtitle={t('org.tileDetail')}
          onPress={() => router.push('/organizations')}
          testID="tile-orgs"
        />
        <FeatureTile
          emoji="🛡️"
          title={t('profile.admin')}
          subtitle={t('admin.tileDetail')}
          onPress={() => router.push('/admin')}
          testID="tile-admin"
        />
        <FeatureTile
          emoji="📊"
          title={t('mon.title')}
          subtitle={t('mon.tileDetail')}
          onPress={() => router.push('/monitoring')}
          testID="tile-monitoring"
        />
        <FeatureTile
          emoji="🤖"
          title={t('aim.title')}
          subtitle={t('aim.tileDetail')}
          onPress={() => router.push('/ai-manager')}
          testID="tile-ai-manager"
        />
        <FeatureTile
          emoji="🧩"
          title={t('plg.title')}
          subtitle={t('plg.tileDetail')}
          onPress={() => router.push('/plugins')}
          testID="tile-plugins"
        />
        <FeatureTile
          emoji="📈"
          title={t('profile.analytics')}
          subtitle={t('an.tileDetail')}
          onPress={() => router.push('/analytics')}
          testID="tile-analytics"
        />
        <FeatureTile
          emoji="🔄"
          title={t('sync.title')}
          subtitle={t('sync.tileDetail')}
          onPress={() => router.push('/sync')}
          testID="tile-sync"
        />
        <FeatureTile
          emoji="🩺"
          title={t('profile.health.title')}
          subtitle={t('profile.health.detail')}
          onPress={() => router.push('/health')}
          testID="tile-health"
        />
      </View>

      <Button variant="ghost" label={t('app.signOut')} onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 30, fontWeight: '700', color: theme.text },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  email: { fontSize: 16, color: theme.text, fontWeight: '600' },
  name: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  manageLink: { fontSize: 13, color: theme.accent, fontWeight: '600', marginTop: 10 },
});
