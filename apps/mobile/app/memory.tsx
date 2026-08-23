import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LearningMemory, MemoryEntry, MemoryKind } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<MemoryKind, string> = {
  lesson: '📘',
  success: '✅',
  error: '❌',
  revision: '🔁',
  conversation: '💬',
  homework: '📝',
  report: '🎓',
  document: '📄',
};

const KIND_LABEL: Record<MemoryKind, TranslationKey> = {
  lesson: 'memory.k.lesson',
  success: 'memory.k.success',
  error: 'memory.k.error',
  revision: 'memory.k.revision',
  conversation: 'memory.k.conversation',
  homework: 'memory.k.homework',
  report: 'memory.k.report',
  document: 'memory.k.document',
};

/**
 * Learning Memory Engine (task 4.2) — the pedagogical memory.
 *
 * A summary of everything the AI remembers, then a chronological timeline of
 * lessons, exercises, mistakes, successes, revisions, conversations, homework,
 * reports and studied documents. The point: the AI never starts from zero.
 */
export default function MemoryScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, locale } = useI18n();
  const [memory, setMemory] = useState<LearningMemory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMemory(await api<LearningMemory>('/memory'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !memory) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!memory) return <Loading label={t('memory.loading')} />;

  const s = memory.summary;
  const stats: { icon: string; label: string; value: number }[] = [
    { icon: '📘', label: t('memory.k.lesson'), value: s.lessons },
    { icon: '🎯', label: t('memory.exercises'), value: s.exercises },
    { icon: '✅', label: t('memory.successes'), value: s.successes },
    { icon: '❌', label: t('memory.errors'), value: s.errors },
    { icon: '🔁', label: t('memory.revisions'), value: s.revisions },
    { icon: '💬', label: t('memory.conversations'), value: s.conversations },
    { icon: '📝', label: t('memory.homework'), value: s.homework },
    { icon: '🎓', label: t('memory.reports'), value: s.reports },
    { icon: '📄', label: t('memory.documents'), value: s.documents },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>💾 {t('memory.title')}</Text>
        <Text style={styles.intro}>{t('memory.intro')}</Text>
      </View>

      <Card style={styles.totalCard}>
        <Text style={styles.totalValue}>{s.total}</Text>
        <Text style={styles.totalLabel}>{t('memory.remembered')}</Text>
      </Card>

      <View style={styles.grid}>
        {stats.map((st) => (
          <View key={st.label} style={styles.stat}>
            <Text style={styles.statIcon}>{st.icon}</Text>
            <Text style={styles.statValue}>{st.value}</Text>
            <Text style={styles.statLabel}>{st.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t('memory.timeline')}</Text>
      {memory.entries.length === 0 ? (
        <Text style={styles.empty}>{t('memory.empty')}</Text>
      ) : (
        memory.entries.map((e) => <Row key={e.id} entry={e} t={t} locale={locale} />)
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

function Row({
  entry,
  t,
  locale,
}: {
  entry: MemoryEntry;
  t: (k: TranslationKey) => string;
  locale: string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const when = new Date(entry.at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{KIND_ICON[entry.kind]}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.rowKind}>{t(KIND_LABEL[entry.kind])}</Text>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {entry.title}
        </Text>
        <Text style={styles.rowDetail} numberOfLines={1}>
          {entry.detail} · {when}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  totalCard: { alignItems: 'center', gap: 2, borderColor: c.primary },
  totalValue: { fontSize: 44, fontWeight: '800', color: c.textPrimary },
  totalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    flexGrow: 1,
    flexBasis: '29%',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: 22, fontWeight: '800', color: c.textPrimary },
  statLabel: { fontSize: 11, color: c.textSecondary, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary, marginTop: 8 },
  empty: { fontSize: 14, color: c.textSecondary },
  row: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 12,
  },
  rowIcon: { fontSize: 22 },
  rowBody: { flex: 1, gap: 2 },
  rowKind: {
    fontSize: 10,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: c.textPrimary, lineHeight: 20 },
  rowDetail: { fontSize: 12, color: c.textSecondary },
});
