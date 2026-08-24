import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  WritingDimension,
  WritingSubmissionView,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

const DIM_LABEL: Record<WritingDimension['kind'], TranslationKey> = {
  structure: 'writing.d.structure',
  logic: 'writing.d.logic',
  clarity: 'writing.d.clarity',
  spelling: 'writing.d.spelling',
  grammar: 'writing.d.grammar',
  argumentation: 'writing.d.argumentation',
  academic_quality: 'writing.d.academic_quality',
};

export default function WritingReviewScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sub, setSub] = useState<WritingSubmissionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSub(await api<WritingSubmissionView>(`/writing/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!sub && !error) return <Loading />;

  const badge = (r: WritingDimension['rating']) =>
    r === 'good' ? styles.rateGood : r === 'fair' ? styles.rateFair : styles.rateBad;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.title}>{sub?.title || t('writing.reviewTitle')}</Text>

      {sub ? (
        <>
          <Card style={styles.scoreCard}>
            <Text style={styles.scoreBig}>{sub.review.score}/100</Text>
            {sub.review.summary ? <Text style={styles.summary}>{sub.review.summary}</Text> : null}
          </Card>

          {sub.review.strengths.length > 0 ? (
            <Card>
              <Text style={styles.blockLabel}>{t('writing.works')}</Text>
              {sub.review.strengths.map((s, i) => (
                <Text key={i} style={styles.bullet}>✓ {s}</Text>
              ))}
            </Card>
          ) : null}

          {sub.review.dimensions.map((d) => (
            <Card key={d.kind}>
              <View style={styles.dimHead}>
                <Text style={styles.dimName}>{t(DIM_LABEL[d.kind])}</Text>
                <Text style={[styles.dimBadge, badge(d.rating)]}>
                  {t(`rating.${d.rating}` as TranslationKey)}
                </Text>
              </View>
              {d.observation ? <Text style={styles.obs}>{d.observation}</Text> : null}
              {d.howToImprove ? (
                <Text style={styles.improve}>
                  <Text style={styles.improveLabel}>{t('writing.improve')}</Text>
                  {d.howToImprove}
                </Text>
              ) : null}
            </Card>
          ))}

          {sub.review.priorities.length > 0 ? (
            <Card style={styles.prioCard}>
              <Text style={styles.blockLabel}>{t('writing.first')}</Text>
              {sub.review.priorities.map((p, i) => (
                <Text key={i} style={styles.bullet}>{i + 1}. {p}</Text>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <Button variant="ghost" label={t('writing.back')} onPress={() => router.replace('/writing')} />
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
  scoreCard: { alignItems: 'center', gap: 6, borderColor: c.primary },
  scoreBig: { fontSize: 34, fontWeight: '800', color: c.textPrimary },
  summary: { fontSize: 14, color: c.textPrimary, lineHeight: 20, textAlign: 'center' },
  blockLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  bullet: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 4 },
  dimHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dimName: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  dimBadge: { fontSize: 11, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' },
  rateGood: { backgroundColor: c.successSoft, color: c.success },
  rateFair: { backgroundColor: c.warningSoft, color: c.warning },
  rateBad: { backgroundColor: c.errorSoft, color: c.error },
  obs: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 6 },
  improve: { fontSize: 14, color: c.textPrimary, lineHeight: 20 },
  improveLabel: { fontWeight: '700', color: c.primary },
  prioCard: { borderColor: c.primary },
});
