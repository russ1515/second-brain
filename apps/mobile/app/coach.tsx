import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  CoachDifficulty,
  CoachMethod,
  CoachPace,
  CoachPlan,
  CoachSetting,
  UpdateCoachRequest,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const PACES: CoachPace[] = ['gentle', 'steady', 'intensive'];
const DIFFICULTIES: CoachDifficulty[] = ['beginner', 'intermediate', 'advanced'];
const METHODS: CoachMethod[] = ['practice', 'reading', 'socratic', 'mixed'];
const MINUTES = [10, 15, 20, 25, 30, 45];

/**
 * 🧑‍🏫 Personalized Academic Coach (Sprint 9.2). The coach adapts pace,
 * difficulty, session length and method to the learner, always explaining why —
 * and the learner can override any dimension (a decision the coach then respects,
 * shown as "your choice"). It also mirrors back the state it accompanies:
 * streak, discipline, goals, progression.
 */
export default function CoachScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [plan, setPlan] = useState<CoachPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan(await api<CoachPlan>('/coach/profile'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const override = useCallback(async (body: UpdateCoachRequest) => {
    setBusy(true);
    try {
      setPlan(await api<CoachPlan>('/coach/profile', { method: 'PUT', body }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  if (error && !plan) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!plan) return <Loading label={t('coachp.loading')} />;

  const a = plan.accompaniment;
  const anyOverride =
    plan.pace.source === 'you' ||
    plan.difficulty.source === 'you' ||
    plan.sessionMinutes.source === 'you' ||
    plan.method.source === 'you';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧑‍🏫 {t('coachp.title')}</Text>
        <Text style={styles.headline}>{plan.headline}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* What the coach accompanies — reused from the twin / mentor / goals. */}
      <Card style={styles.stateCard}>
        <Text style={styles.sectionLabel}>{t('coachp.state')}</Text>
        <View style={styles.stateRow}>
          <Stat value={`${a.streak.current}🔥`} label={t('coachp.streak')} />
          <Stat value={t(DISCIPLINE_KEY[a.discipline])} label={t('coachp.discipline')} />
          <Stat value={String(a.sessionsLast7)} label={t('coachp.week')} />
          <Stat
            value={a.progression.averageMastery === null ? '—' : `${a.progression.averageMastery}%`}
            label={t('coachp.mastery')}
          />
          <Stat value={`${a.goals.done}/${a.goals.total}`} label={t('coachp.goals')} />
        </View>
      </Card>

      {/* The four adapted dimensions — each explicable and overridable. */}
      <Dimension
        title={t('coachp.pace')}
        setting={plan.pace}
        options={PACES}
        labelFor={(v) => t(PACE_KEY[v])}
        onPick={(v) => void override({ pace: v })}
        disabled={busy}
        t={t}
      />
      <Dimension
        title={t('coachp.difficulty')}
        setting={plan.difficulty}
        options={DIFFICULTIES}
        labelFor={(v) => t(DIFF_KEY[v])}
        onPick={(v) => void override({ difficulty: v })}
        disabled={busy}
        t={t}
      />
      <Dimension
        title={t('coachp.method')}
        setting={plan.method}
        options={METHODS}
        labelFor={(v) => t(METHOD_KEY[v])}
        onPick={(v) => void override({ method: v })}
        disabled={busy}
        t={t}
      />
      <Dimension
        title={t('coachp.session')}
        setting={plan.sessionMinutes}
        options={MINUTES}
        labelFor={(v) => `${v} min`}
        onPick={(v) => void override({ sessionMinutes: v })}
        disabled={busy}
        t={t}
      />

      {anyOverride ? (
        <Button
          variant="ghost"
          label={t('coachp.reset')}
          onPress={() => void override({ reset: true })}
        />
      ) : null}
    </ScrollView>
  );
}

/** One adaptive dimension: current value + source badge + why + override chips. */
function Dimension<T extends string | number>({
  title,
  setting,
  options,
  labelFor,
  onPick,
  disabled,
  t,
}: {
  title: string;
  setting: CoachSetting<T>;
  options: readonly T[];
  labelFor: (v: T) => string;
  onPick: (v: T) => void;
  disabled: boolean;
  t: (k: TranslationKey) => string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Card style={styles.dimCard}>
      <View style={styles.dimHead}>
        <Text style={styles.dimTitle}>{title}</Text>
        <View style={[styles.badge, setting.source === 'you' ? styles.badgeYou : styles.badgeCoach]}>
          <Text style={styles.badgeText}>
            {setting.source === 'you' ? t('coachp.byYou') : t('coachp.byCoach')}
          </Text>
        </View>
      </View>
      <Text style={styles.dimReason}>{setting.reason}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = opt === setting.value;
          return (
            <Pressable
              key={String(opt)}
              disabled={disabled}
              onPress={() => onPick(opt)}
              style={[styles.chip, active && styles.chipActive, disabled && styles.chipOff]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{labelFor(opt)}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const PACE_KEY: Record<CoachPace, TranslationKey> = {
  gentle: 'coachp.pace.gentle',
  steady: 'coachp.pace.steady',
  intensive: 'coachp.pace.intensive',
};
const DIFF_KEY: Record<CoachDifficulty, TranslationKey> = {
  beginner: 'coachp.diff.beginner',
  intermediate: 'coachp.diff.intermediate',
  advanced: 'coachp.diff.advanced',
};
const METHOD_KEY: Record<CoachMethod, TranslationKey> = {
  practice: 'coachp.method.practice',
  reading: 'coachp.method.reading',
  socratic: 'coachp.method.socratic',
  mixed: 'coachp.method.mixed',
};
const DISCIPLINE_KEY: Record<'strong' | 'building' | 'irregular', TranslationKey> = {
  strong: 'coachp.disc.strong',
  building: 'coachp.disc.building',
  irregular: 'coachp.disc.irregular',
};

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 6, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  headline: { fontSize: 17, color: c.textPrimary, lineHeight: 24, fontWeight: '600' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  stateCard: { gap: 4 },
  stateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  stat: { minWidth: 64 },
  statValue: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  statLabel: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
  dimCard: { gap: 10 },
  dimHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dimTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeCoach: { backgroundColor: c.primary },
  badgeYou: { backgroundColor: c.warning },
  badgeText: { fontSize: 11, fontWeight: '700', color: c.onPrimary },
  dimReason: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipOff: { opacity: 0.5 },
  chipText: { fontSize: 14, color: c.textPrimary, fontWeight: '500' },
  chipTextActive: { color: c.onPrimary, fontWeight: '700' },
});
