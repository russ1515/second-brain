import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Goal, GoalPeriod } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const PERIODS: { period: GoalPeriod; key: TranslationKey }[] = [
  { period: 'daily', key: 'goals.daily' },
  { period: 'weekly', key: 'goals.weekly' },
  { period: 'monthly', key: 'goals.monthly' },
];

/** Goals (Sprint 5): the learner's daily / weekly / monthly objectives. */
export default function GoalsScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('daily');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setGoals(await api<Goal[]>('/goals'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api<Goal>('/goals', { method: 'POST', body: { period, title: title.trim() } });
      setTitle('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string) => {
    try {
      await api<Goal>(`/goals/${id}/toggle`, { method: 'PATCH' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      await api<void>(`/goals/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !goals) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!goals) return <Loading label={t('goals.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🎯 {t('goals.title')}</Text>
        <Text style={styles.intro}>{t('goals.intro')}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <Card style={styles.addCard}>
        <TextInput
          style={styles.input}
          placeholder={t('goals.placeholder')}
          placeholderTextColor={c.textMuted}
          value={title}
          onChangeText={setTitle}
        />
        <View style={styles.chips}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.period}
              style={[styles.chip, period === p.period && styles.chipOn]}
              onPress={() => setPeriod(p.period)}
            >
              <Text style={[styles.chipText, period === p.period && styles.chipTextOn]}>{t(p.key)}</Text>
            </Pressable>
          ))}
        </View>
        <Button label={t('goals.addBtn')} onPress={add} busy={busy} disabled={!title.trim()} />
      </Card>

      {PERIODS.map((p) => {
        const list = goals.filter((g) => g.period === p.period);
        return (
          <View key={p.period} style={styles.section}>
            <Text style={styles.sectionTitle}>{t(p.key)}</Text>
            {list.length === 0 ? (
              <Text style={styles.empty}>{t('goals.none')}</Text>
            ) : (
              list.map((g) => (
                <View key={g.id} style={styles.goal}>
                  <Pressable onPress={() => toggle(g.id)} accessibilityRole="button" hitSlop={6}>
                    <Text style={[styles.check, g.status === 'done' && styles.checkOn]}>
                      {g.status === 'done' ? '☑' : '☐'}
                    </Text>
                  </Pressable>
                  <Text style={[styles.goalText, g.status === 'done' && styles.goalDone]} numberOfLines={2}>
                    {g.title}
                  </Text>
                  <Pressable onPress={() => remove(g.id)} accessibilityRole="button" hitSlop={6}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  addCard: { gap: 10 },
  input: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 15, color: c.textPrimary },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.surfaceElevated },
  chipOn: { borderColor: c.primary, backgroundColor: c.primary },
  chipText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  chipTextOn: { color: c.onPrimary },
  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  empty: { fontSize: 13, color: c.textMuted },
  goal: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12,
  },
  check: { fontSize: 22, color: c.textSecondary },
  checkOn: { color: c.success },
  goalText: { flex: 1, fontSize: 15, color: c.textPrimary },
  goalDone: { color: c.textMuted, textDecorationLine: 'line-through' },
  remove: { fontSize: 16, color: c.error, fontWeight: '700', paddingHorizontal: 4 },
});
