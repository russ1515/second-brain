import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n } from '../lib/i18n';
import { useOnline } from '../lib/connectivity';
import { flushOutbox, lastSyncAt, onOutboxChange, outboxCount } from '../lib/offline';
import { Button, Card } from '../components/ui';

/**
 * 🔄 Synchronization Center (Sprint 10.3). The learner's window on the offline
 * engine: are we online, how many changes are waiting to sync, when did we last
 * sync — and a manual "sync now". Changes made offline are replayed here (and
 * automatically the moment the connection returns).
 */
export default function SyncScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, locale } = useI18n();
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setPending(await outboxCount());
    setLast(await lastSyncAt());
  }, []);

  useEffect(() => {
    void refresh();
    return onOutboxChange(() => void refresh());
  }, [refresh]);

  const syncNow = async () => {
    setBusy(true);
    try {
      await flushOutbox();
    } finally {
      setBusy(false);
      void refresh();
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🔄 {t('sync.title')}</Text>
        <Text style={styles.intro}>{t('sync.intro')}</Text>
      </View>

      {/* Connection status. */}
      <Card style={styles.statusCard}>
        <View style={[styles.dot, { backgroundColor: online ? c.success : c.warning }]} />
        <View style={styles.flex}>
          <Text style={styles.statusTitle}>
            {online ? t('sync.online') : t('sync.offline')}
          </Text>
          <Text style={styles.statusSub}>
            {online ? t('sync.online.detail') : t('sync.offline.detail')}
          </Text>
        </View>
      </Card>

      {/* Pending changes. */}
      <Card style={styles.rowCard}>
        <Text style={styles.rowLabel}>{t('sync.pending')}</Text>
        <Text style={[styles.rowValue, pending > 0 && { color: c.warning }]}>{pending}</Text>
      </Card>

      {/* Last sync. */}
      <Card style={styles.rowCard}>
        <Text style={styles.rowLabel}>{t('sync.last')}</Text>
        <Text style={styles.rowValue}>
          {last ? new Date(last).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US') : t('sync.never')}
        </Text>
      </Card>

      <Button
        label={pending > 0 ? `${t('sync.now')} (${pending})` : t('sync.now')}
        busy={busy}
        disabled={!online || pending === 0}
        onPress={() => void syncNow()}
      />

      <Text style={styles.note}>{t('sync.note')}</Text>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  flex: { flex: 1 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  statusSub: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  rowCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: c.textSecondary },
  rowValue: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  note: { fontSize: 12, color: c.textMuted, lineHeight: 17, marginTop: 4 },
});
