import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  SmartNotification,
  SmartNotificationKind,
  SmartNotificationsView,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const SOURCE_KEY: Record<SmartNotificationKind, TranslationKey> = {
  review: 'notif.src.mastery',
  exam: 'notif.src.calendar',
  unlock: 'notif.src.path',
  forecast: 'notif.src.forecast',
};
const CTA_KEY: Record<SmartNotificationKind, TranslationKey> = {
  review: 'notif.cta.review',
  exam: 'notif.cta.exam',
  unlock: 'notif.cta.unlock',
  forecast: 'notif.cta.forecast',
};

/**
 * Smart Notifications (task 5.6). Never generic: each notification is assembled
 * from the engines and states its justification — a review that would raise
 * mastery by X%, an exam in N days whose plan was reorganised, an unlocked next
 * topic. The teacher speaks, with a reason.
 */
export default function NotificationsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState<SmartNotificationsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<SmartNotificationsView>('/notifications/smart'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!data) return <Loading label={t('notif.loading')} />;

  const hello = data.greetingName
    ? `${t('notif.hello')} ${data.greetingName}.`
    : `${t('notif.helloNoName')}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🔔 {t('notif.title')}</Text>
        <Text style={styles.greeting}>👨‍🏫 {hello}</Text>
      </View>

      {data.notifications.length === 0 ? (
        <Text style={styles.empty}>{t('notif.empty')}</Text>
      ) : (
        data.notifications.map((n, i) => (
          <View key={`${n.kind}-${i}`} style={styles.card}>
            <Text style={styles.message}>{message(n, t)}</Text>
            <Text style={styles.source}>{t(SOURCE_KEY[n.kind])}</Text>
            {n.route ? (
              <Button label={t(CTA_KEY[n.kind])} onPress={() => router.push(n.route as never)} />
            ) : null}
          </View>
        ))
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

/** Compose the justified, pedagogical message for a notification. */
function message(n: SmartNotification, t: (k: TranslationKey) => string): string {
  const fill = (tpl: string) =>
    tpl
      .replace('{s}', n.subject ?? '')
      .replace('{m}', String(n.minutes ?? ''))
      .replace('{p}', String(n.percent ?? ''))
      .replace('{d}', String(n.days ?? ''))
      .replace('{next}', n.nextSubject ?? '');
  switch (n.kind) {
    case 'review':
      return fill(t('notif.review'));
    case 'exam':
      return fill(t('notif.exam'));
    case 'unlock':
      return fill(t('notif.unlock'));
    case 'forecast':
      return fill(t('notif.forecast'));
  }
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 6 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  greeting: { fontSize: 18, fontWeight: '700', color: c.textPrimary, lineHeight: 25 },
  empty: { fontSize: 14, color: c.textSecondary },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  message: { fontSize: 16, color: c.textSecondary, lineHeight: 24, fontWeight: '500' },
  source: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
