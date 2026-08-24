import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { HealthDependency, HealthReport } from '@second-brain/shared';
import { API_BASE_URL } from '../lib/api';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n } from '../lib/i18n';
import { Button, Loading } from '../components/ui';

const DEPENDENCIES: HealthDependency[] = ['postgres', 'redis', 'qdrant'];

/** The Phase-0 health screen. It used to be the app's home; the classroom took
 *  that slot, so it lives here as a diagnostic. */
export default function HealthScreen() {
  const { t } = useI18n();
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`);
      setReport((await res.json()) as HealthReport);
    } catch (e) {
      setError((e as Error).message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overallOk = report?.status === 'ok';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('health.title')}</Text>
      <Text style={styles.subtitle}>{API_BASE_URL}</Text>

      {loading ? (
        <Loading />
      ) : error ? (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.bannerText}>{t('health.unreachable')}</Text>
          <Text style={styles.bannerDetail}>{error}</Text>
        </View>
      ) : report ? (
        <>
          <View style={[styles.banner, overallOk ? styles.bannerOk : styles.bannerError]}>
            <Text style={styles.bannerText}>
              {overallOk ? t('health.allOk') : t('health.degraded')}
            </Text>
            <Text style={styles.bannerDetail}>
              {new Date(report.timestamp).toLocaleTimeString()}
            </Text>
          </View>

          {DEPENDENCIES.map((dep) => {
            const info = report.info[dep];
            const up = info?.status === 'up';
            return (
              <View key={dep} style={styles.row}>
                <View style={[styles.dot, up ? styles.dotUp : styles.dotDown]} />
                <Text style={styles.rowLabel}>{dep}</Text>
                <Text style={styles.rowStatus}>{up ? t('health.up') : (info?.message ?? t('health.down'))}</Text>
              </View>
            );
          })}
        </>
      ) : null}

      <Button label={t('health.refresh')} onPress={load} disabled={loading} />
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 24, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: c.textPrimary },
  subtitle: { fontSize: 13, color: c.textMuted, marginBottom: 12 },
  banner: { borderRadius: 12, padding: 16, marginBottom: 8 },
  bannerOk: { backgroundColor: c.successSoft },
  bannerError: { backgroundColor: c.errorSoft },
  bannerText: { fontSize: 18, fontWeight: '600', color: c.textPrimary },
  bannerDetail: { fontSize: 13, color: c.textSecondary, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotUp: { backgroundColor: c.success },
  dotDown: { backgroundColor: c.error },
  rowLabel: { fontSize: 16, color: c.textPrimary, flex: 1, textTransform: 'capitalize' },
  rowStatus: { fontSize: 13, color: c.textSecondary, maxWidth: '55%', textAlign: 'right' },
});
