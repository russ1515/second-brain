import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  MentorDimension,
  MentorDimensionKey,
  MentorGuidance,
  MentorRating,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const DIM_ICON: Record<MentorDimensionKey, string> = {
  success: '🎯',
  exams: '📝',
  organization: '🗓️',
  method: '🛠️',
  confidence: '💪',
};

const DIM_KEY: Record<MentorDimensionKey, TranslationKey> = {
  success: 'ment.dim.success',
  exams: 'ment.dim.exams',
  organization: 'ment.dim.organization',
  method: 'ment.dim.method',
  confidence: 'ment.dim.confidence',
};

const RATING_KEY: Record<MentorRating, TranslationKey> = {
  good: 'ment.rating.good',
  building: 'ment.rating.building',
  concern: 'ment.rating.concern',
};

const ratingColor = (c: ColorScale): Record<MentorRating, string> => ({
  good: c.success,
  building: c.warning,
  concern: c.error,
});

/**
 * 🎓 AI Mentor (Sprint 9.5). The teacher steps back and mentors: an honest,
 * grounded read across academic success, exam prep, organization, work method
 * and confidence — able to say "you're working hard, but not the right way" —
 * with the single thing to focus on and the signals behind every judgement.
 */
export default function MentorshipScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [data, setData] = useState<MentorGuidance | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<MentorGuidance>('/ai-mentor'));
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
  if (!data) return <Loading label={t('ment.loading')} />;

  // Focus dimension first, then the rest — worst news up top.
  const ordered = [...data.dimensions].sort(
    (a, b) =>
      (a.key === data.focus ? -1 : 0) - (b.key === data.focus ? -1 : 0) ||
      severity(b.rating) - severity(a.rating),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🎓 {t('ment.title')}</Text>
        <Text style={styles.intro}>{t('ment.intro')}</Text>
      </View>

      {/* The mentor speaks first. */}
      <Card style={styles.headlineCard}>
        <Text style={styles.headlineIcon}>👨‍🏫</Text>
        <Text style={styles.headline}>{data.headline}</Text>
      </Card>

      {ordered.map((d) => (
        <DimensionCard key={d.key} d={d} isFocus={d.key === data.focus} t={t} />
      ))}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function DimensionCard({
  d,
  isFocus,
  t,
}: {
  d: MentorDimension;
  isFocus: boolean;
  t: (k: TranslationKey) => string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const color = ratingColor(c)[d.rating];
  return (
    <View style={[styles.card, { borderLeftColor: color }]} testID={`dim-${d.key}`}>
      <View style={styles.head}>
        <Text style={styles.icon}>{DIM_ICON[d.key]}</Text>
        <Text style={styles.title}>{t(DIM_KEY[d.key])}</Text>
        {isFocus ? (
          <View style={styles.focusBadge}>
            <Text style={styles.focusText}>{t('ment.focus')}</Text>
          </View>
        ) : null}
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={styles.badgeText}>{t(RATING_KEY[d.rating])}</Text>
        </View>
      </View>
      <Text style={styles.insight}>{d.insight}</Text>
      {d.reasons.length > 0 ? (
        <>
          <Text style={styles.whyLabel}>{t('ment.why')}</Text>
          {d.reasons.map((r, i) => (
            <Text key={i} style={styles.reason}>
              • {r}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

function severity(r: MentorRating): number {
  return r === 'concern' ? 2 : r === 'building' ? 1 : 0;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  headlineCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headlineIcon: { fontSize: 26 },
  headline: { flex: 1, fontSize: 16, color: c.textPrimary, fontWeight: '600', lineHeight: 23 },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { fontSize: 20 },
  title: { flex: 1, fontSize: 16, fontWeight: '700', color: c.textPrimary },
  focusBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: c.primary,
  },
  focusText: { fontSize: 10, fontWeight: '800', color: c.onPrimary, letterSpacing: 0.5 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700', color: c.onColor, textTransform: 'uppercase' },
  insight: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
  whyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  reason: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
});
