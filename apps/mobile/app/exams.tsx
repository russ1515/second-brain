import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CreateExamRequest, ExamPriority, ExamView } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const PRIORITIES: { p: ExamPriority; key: TranslationKey }[] = [
  { p: 'high', key: 'exams.p.high' },
  { p: 'medium', key: 'exams.p.medium' },
  { p: 'low', key: 'exams.p.low' },
];
const priorityColor = (c: ColorScale): Record<ExamPriority, string> => ({
  high: c.error,
  medium: c.warning,
  low: c.success,
});
const DAY_OFFSETS: { key: TranslationKey; days: number }[] = [
  { key: 'exams.in3', days: 3 },
  { key: 'exams.in7', days: 7 },
  { key: 'exams.in14', days: 14 },
  { key: 'exams.in30', days: 30 },
];

/** Upcoming Exams (Sprint 5): subject, date, priority + a preparation level
 *  derived from ConceptMastery. */
export default function ExamsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, locale } = useI18n();
  const [exams, setExams] = useState<ExamView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<ExamPriority>('high');
  const [offset, setOffset] = useState(7);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setExams(await api<ExamView[]>('/exams'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!subject.trim()) return;
    setBusy(true);
    try {
      const d = new Date(Date.now() + offset * 86_400_000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const body: CreateExamRequest = { subject: subject.trim(), date, priority };
      await api<ExamView>('/exams', { method: 'POST', body });
      setSubject('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api<void>(`/exams/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !exams) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!exams) return <Loading label={t('exams.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>📝 {t('exams.title')}</Text>
        <Text style={styles.intro}>{t('exams.intro')}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.addCard}>
        <TextInput
          style={styles.input}
          placeholder={t('exams.placeholder')}
          placeholderTextColor={c.textMuted}
          value={subject}
          onChangeText={setSubject}
        />
        <View style={styles.chips}>
          {PRIORITIES.map((x) => (
            <Chip key={x.p} label={t(x.key)} on={priority === x.p} onPress={() => setPriority(x.p)} />
          ))}
        </View>
        <View style={styles.chips}>
          {DAY_OFFSETS.map((o) => (
            <Chip key={o.days} label={t(o.key)} on={offset === o.days} onPress={() => setOffset(o.days)} />
          ))}
        </View>
        <Button label={t('exams.addBtn')} onPress={add} busy={busy} disabled={!subject.trim()} />
      </Card>

      {exams.length === 0 ? (
        <Text style={styles.empty}>{t('exams.none')}</Text>
      ) : (
        exams.map((e) => (
          <View key={e.id} style={[styles.exam, { borderLeftColor: priorityColor(c)[e.priority] }]}>
            <View style={styles.examHead}>
              <Text style={styles.examSubject} numberOfLines={1}>{e.subject}</Text>
              <View style={[styles.prio, { borderColor: priorityColor(c)[e.priority] }]}>
                <Text style={[styles.prioText, { color: priorityColor(c)[e.priority] }]}>
                  {t(PRIORITIES.find((x) => x.p === e.priority)!.key)}
                </Text>
              </View>
            </View>
            <Text style={styles.examMeta}>
              📅 {formatDate(e.date, locale)} · {daysLabel(e.daysUntil, t)}
            </Text>
            <View style={styles.prepRow}>
              <Text style={styles.prepLabel}>{t('exams.prep')}</Text>
              {e.preparation === null ? (
                <Text style={styles.prepUnknown}>{t('exams.prepUnknown')}</Text>
              ) : (
                <View style={styles.prepBarBg}>
                  <View style={[styles.prepBar, { width: `${e.preparation}%`, backgroundColor: prepColor(e.preparation, c) }]} />
                  <Text style={styles.prepPct}>{e.preparation}%</Text>
                </View>
              )}
            </View>
            <Pressable onPress={() => remove(e.id)} accessibilityRole="button" style={styles.removeWrap} hitSlop={6}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function prepColor(p: number, c: ColorScale): string {
  return p >= 70 ? c.success : p >= 40 ? c.warning : c.error;
}
function daysLabel(days: number, t: (k: TranslationKey) => string): string {
  if (days < 0) return t('exams.past');
  if (days === 0) return t('exams.today');
  if (days === 1) return t('exams.tomorrow');
  return `${t('exams.in')} ${days} ${t('exams.days')}`;
}
function formatDate(date: string, locale: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  addCard: { gap: 10 },
  input: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 15, color: c.textPrimary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.surfaceElevated },
  chipOn: { borderColor: c.primary, backgroundColor: c.primary },
  chipText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  chipTextOn: { color: c.onPrimary },
  empty: { fontSize: 14, color: c.textSecondary },
  exam: {
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderLeftWidth: 3,
    borderRadius: 12, padding: 14, gap: 8,
  },
  examHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  examSubject: { flex: 1, fontSize: 16, fontWeight: '700', color: c.textPrimary },
  prio: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  prioText: { fontSize: 11, fontWeight: '700' },
  examMeta: { fontSize: 13, color: c.textSecondary },
  prepRow: { gap: 4 },
  prepLabel: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  prepUnknown: { fontSize: 13, color: c.textMuted },
  prepBarBg: { height: 20, backgroundColor: c.surfaceElevated, borderRadius: 10, justifyContent: 'center', overflow: 'hidden' },
  prepBar: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 10 },
  prepPct: { fontSize: 12, fontWeight: '700', color: c.textPrimary, paddingLeft: 8 },
  removeWrap: { position: 'absolute', top: 10, right: 12 },
  remove: { fontSize: 16, color: c.error, fontWeight: '700' },
});
