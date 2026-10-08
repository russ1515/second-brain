import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  ExperienceSession,
  ExperienceSessionPage,
  Goal,
  GoalPeriod,
  LearningDeletionPreview,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';
import { Dialog } from '../components/ds/overlays';
import { DeletionImpact } from '../components/home/decision';

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
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [learningSessions, setLearningSessions] = useState<ExperienceSession[]>([]);
  const [experienceSessionId, setExperienceSessionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('daily');
  const [busy, setBusy] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [deletionPreview, setDeletionPreview] = useState<LearningDeletionPreview | null>(null);
  const [previewingDelete, setPreviewingDelete] = useState(false);
  const [previewDeleteFailed, setPreviewDeleteFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const load = useCallback(async () => {
    try {
      const [nextGoals, sessions] = await Promise.all([
        api<Goal[]>('/goals'),
        api<ExperienceSessionPage>('/experience-sessions?limit=50'),
      ]);
      const eligible = sessions.items.filter((session) =>
        (session.type === 'learning' || session.type === 'language') &&
        session.status !== 'abandoned' && session.status !== 'failed');
      setGoals(nextGoals);
      setLearningSessions(eligible);
      setExperienceSessionId((current) => current || eligible[0]?.id || '');
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!title.trim() || !experienceSessionId) return;
    setBusy(true);
    try {
      await api<Goal>('/goals', {
        method: 'POST',
        body: { period, title: title.trim(), experienceSessionId },
      });
      setTitle('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (goal: Goal) => {
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    setBusy(true);
    try {
      await api<Goal>(`/goals/${goal.id}`, { method: 'PATCH', body: { title: nextTitle } });
      setEditingGoalId(null);
      setEditingTitle('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setPrimary = async (goal: Goal, sessionId: string) => {
    setBusy(true);
    try {
      await api<Goal>(`/goals/${goal.id}/primary`, {
        method: 'PATCH',
        body: { experienceSessionId: sessionId },
      });
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

  const prepareRemove = (goal: Goal) => {
    setDeletingGoal(goal);
    setDeletionPreview(null);
    setPreviewDeleteFailed(false);
    setPreviewingDelete(true);
    void api<LearningDeletionPreview>(`/goals/${goal.id}/deletion-preview`)
      .then(setDeletionPreview)
      .catch(() => setPreviewDeleteFailed(true))
      .finally(() => setPreviewingDelete(false));
  };

  const remove = async () => {
    if (!deletingGoal || deleting) return;
    const id = deletingGoal.id;
    setDeleting(true);
    try {
      await api<void>(`/goals/${id}`, { method: 'DELETE' });
      setGoals((current) => current?.filter((goal) => goal.id !== id) ?? current);
      setDeletingGoal(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
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
        <Text style={styles.sectionTitle}>{t('goals.selectLearning')}</Text>
        {learningSessions.length ? (
          <View style={styles.chips}>
            {learningSessions.map((session) => (
              <Pressable
                key={session.id}
                style={[styles.learningChip, experienceSessionId === session.id && styles.chipOn]}
                onPress={() => setExperienceSessionId(session.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: experienceSessionId === session.id }}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.chipText, experienceSessionId === session.id && styles.chipTextOn]}
                >
                  {session.title ?? session.intent ?? session.type}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.noLearning}>
            <Text style={styles.empty}>{t('goals.noLearning')}</Text>
            <Button label={t('teach.title')} onPress={() => router.push('/learn' as never)} />
          </View>
        )}
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
        <Button
          label={t('goals.addBtn')}
          onPress={add}
          busy={busy}
          disabled={!title.trim() || !experienceSessionId}
        />
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
                  <View style={styles.goalBody}>
                    {editingGoalId === g.id ? (
                      <View style={styles.editRow}>
                        <TextInput
                          style={[styles.input, styles.editInput]}
                          value={editingTitle}
                          onChangeText={setEditingTitle}
                          autoFocus
                          editable={!busy}
                        />
                        <Button
                          label={t('goals.save')}
                          variant="ghost"
                          disabled={!editingTitle.trim() || busy}
                          onPress={() => { void saveEdit(g); }}
                        />
                      </View>
                    ) : (
                      <Text style={[styles.goalText, g.status === 'done' && styles.goalDone]} numberOfLines={2}>
                        {g.title}
                      </Text>
                    )}
                    {g.learningLinks.map((link) => (
                      <View key={link.experienceSessionId} style={styles.linkRow}>
                        <Text style={styles.learningLabel} numberOfLines={1}>
                          {link.learningTitle ?? link.learningType}
                        </Text>
                        {link.isPrimary ? (
                          <Text style={styles.primaryLabel}>{t('goals.primary')}</Text>
                        ) : (
                          <Pressable
                            onPress={() => { void setPrimary(g, link.experienceSessionId); }}
                            accessibilityRole="button"
                            accessibilityLabel={t('goals.setPrimary')}
                          >
                            <Text style={styles.reviewLinkText}>{t('goals.setPrimary')}</Text>
                          </Pressable>
                        )}
                      </View>
                    ))}
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingGoalId(g.id);
                      setEditingTitle(g.title);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('goals.edit')}
                    hitSlop={6}
                  >
                    <Text style={styles.edit}>✎</Text>
                  </Pressable>
                  {g.status !== 'done' ? <Pressable onPress={() => router.push({ pathname: '/revision', params: { goalId: g.id } })} accessibilityRole="link" accessibilityLabel={t('review9.goalReview')} style={styles.reviewLink}><Text style={styles.reviewLinkText}>{t('review9.goalReview')}</Text></Pressable> : null}
                  <Pressable onPress={() => prepareRemove(g)} accessibilityRole="button" accessibilityLabel={t('learningControl.deleteGoal')} hitSlop={6}>
                    <Text style={styles.remove}>✕</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        );
      })}
      <Dialog
        visible={Boolean(deletingGoal)}
        onClose={() => { if (!deleting) setDeletingGoal(null); }}
        title={t('learningControl.deleteGoal')}
        footer={(
          <>
            <Button label={t('tutor.cancel')} variant="ghost" disabled={deleting} onPress={() => setDeletingGoal(null)} />
            <Button
              label={t('learningControl.deleteGoal')}
              variant="danger"
              busy={deleting || previewingDelete}
              disabled={!deletionPreview || previewDeleteFailed}
              onPress={() => { void remove(); }}
            />
          </>
        )}
      >
        {deletingGoal ? <Text style={styles.goalText}>{deletingGoal.title}</Text> : null}
        <DeletionImpact preview={deletionPreview} loading={previewingDelete} failed={previewDeleteFailed} />
      </Dialog>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  addCard: { gap: 10 },
  noLearning: { gap: 10, alignItems: 'flex-start' },
  input: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 15, color: c.textPrimary },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.surfaceElevated },
  learningChip: { maxWidth: 260, borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: c.surfaceElevated },
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
  goalBody: { flex: 1, minWidth: 0, gap: 6 },
  editRow: { gap: 8 },
  editInput: { minHeight: 44 },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  learningLabel: { flexShrink: 1, fontSize: 12, color: c.textMuted },
  primaryLabel: { fontSize: 12, color: c.success, fontWeight: '700' },
  edit: { fontSize: 18, color: c.primary, fontWeight: '700', paddingHorizontal: 4 },
  goalDone: { color: c.textMuted, textDecorationLine: 'line-through' },
  remove: { fontSize: 16, color: c.error, fontWeight: '700', paddingHorizontal: 4 },
  reviewLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  reviewLinkText: { fontSize: 13, color: c.primary, fontWeight: '700' },
});
