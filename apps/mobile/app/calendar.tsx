import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type {
  CalendarEntry,
  CalendarEntryKind,
  CalendarView,
  UserEventKind,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<CalendarEntryKind, string> = {
  exam: '📝',
  homework: '📚',
  practical: '🔬',
  language: '🗣️',
  aiSession: '🎓',
  revision: '🔁',
  quiz: '❓',
  objective: '🎯',
  deadline: '⏰',
};
const KIND_KEY: Record<CalendarEntryKind, TranslationKey> = {
  exam: 'cal.k.exam',
  homework: 'cal.k.homework',
  practical: 'cal.k.practical',
  language: 'cal.k.language',
  aiSession: 'cal.k.aiSession',
  revision: 'cal.k.revision',
  quiz: 'cal.k.quiz',
  objective: 'cal.k.objective',
  deadline: 'cal.k.deadline',
};
const USER_KINDS: { kind: UserEventKind; key: TranslationKey }[] = [
  { kind: 'exam', key: 'cal.k.exam' },
  { kind: 'objective', key: 'cal.k.objective' },
  { kind: 'deadline', key: 'cal.k.deadline' },
];
const DAY_OFFSETS: { key: TranslationKey; days: number }[] = [
  { key: 'cal.today', days: 0 },
  { key: 'cal.tomorrow', days: 1 },
  { key: 'cal.in3', days: 3 },
  { key: 'cal.in7', days: 7 },
];

/**
 * Smart Calendar (task 5.4). Not a classic agenda: it's assembled automatically
 * from everything the engines scheduled — revisions, homework, practicals,
 * languages, quizzes and AI sessions — over which the learner overlays their own
 * exams and objectives. AI entries are read-only (priority); user entries can be
 * removed.
 */
export default function CalendarScreen() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<CalendarView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<UserEventKind>('exam');
  const [offset, setOffset] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await api<CalendarView>('/calendar'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addEvent = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const d = new Date(Date.now() + offset * 86_400_000);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      await api<CalendarEntry>('/calendar/events', { method: 'POST', body: { date, kind, title: title.trim() } });
      setTitle('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeEvent = async (id: string) => {
    try {
      await api<void>(`/calendar/events/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !view) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!view) return <Loading label={t('cal.loading')} />;

  const days = view.days.filter((d) => d.today || d.entries.length > 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🗓️ {t('cal.title')}</Text>
        <Text style={styles.intro}>{t('cal.intro')}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Add one of the learner's own events (the AI keeps priority). */}
      <Card style={styles.addCard}>
        <Text style={styles.addLabel}>{t('cal.add')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('cal.titlePlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.chips}>
          {USER_KINDS.map((k) => (
            <Chip key={k.kind} label={t(k.key)} on={kind === k.kind} onPress={() => setKind(k.kind)} />
          ))}
        </View>
        <View style={styles.chips}>
          {DAY_OFFSETS.map((o) => (
            <Chip key={o.days} label={t(o.key)} on={offset === o.days} onPress={() => setOffset(o.days)} />
          ))}
        </View>
        <Button label={t('cal.addBtn')} onPress={addEvent} busy={busy} disabled={!title.trim()} />
      </Card>

      {days.map((day) => (
        <View key={day.date} style={styles.day}>
          <Text style={[styles.dayLabel, day.today && styles.dayToday]}>
            {formatDay(day.date, locale)}{day.today ? ` · ${t('cal.todayTag')}` : ''}
          </Text>
          {day.entries.length === 0 ? (
            <Text style={styles.empty}>{t('cal.nothing')}</Text>
          ) : (
            day.entries.map((e) => (
              <View key={e.id} style={[styles.entry, e.source === 'ai' && styles.entryAi]}>
                <Text style={styles.entryIcon}>{KIND_ICON[e.kind]}</Text>
                <View style={styles.entryBody}>
                  <Text style={styles.entryKind}>{t(KIND_KEY[e.kind])}</Text>
                  <Text style={styles.entryTitle} numberOfLines={1}>{e.title}</Text>
                </View>
                {e.source === 'ai' ? (
                  <Text style={styles.aiBadge}>🤖</Text>
                ) : (
                  <Pressable onPress={() => removeEvent(e.id)} accessibilityRole="button" hitSlop={8}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function formatDay(date: string, locale: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  addCard: { gap: 10 },
  addLabel: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    padding: 12, fontSize: 15, color: theme.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.surfaceAlt },
  chipOn: { borderColor: theme.accent, backgroundColor: theme.accent },
  chipText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  chipTextOn: { color: theme.accentText },
  day: { gap: 6, marginTop: 6 },
  dayLabel: { fontSize: 13, fontWeight: '700', color: theme.textMuted, textTransform: 'capitalize' },
  dayToday: { color: theme.accent },
  empty: { fontSize: 13, color: theme.textFaint },
  entry: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12,
  },
  entryAi: { borderLeftWidth: 3, borderLeftColor: theme.accent },
  entryIcon: { fontSize: 20 },
  entryBody: { flex: 1, gap: 1 },
  entryKind: { fontSize: 10, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.6 },
  entryTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
  aiBadge: { fontSize: 14 },
  remove: { fontSize: 18, color: theme.danger, fontWeight: '700', paddingHorizontal: 4 },
});
