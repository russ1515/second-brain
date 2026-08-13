import { useCallback, useState } from 'react'; // sprint 9.1 proactive mentor
import { SwipeableCard } from '../../components/swipeable-card';
import { enqueue } from '../../lib/offline';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  DailyPlanItemView,
  DailyPlanView,
  InitiativeView,
  LessonSummary,
  MentorOverview,
  PlanSlot,
  ProactiveBriefing,
  StudyRecommendation,
} from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

const SLOT_KEY: Record<PlanSlot, TranslationKey> = {
  morning: 'slot.morning',
  afternoon: 'slot.afternoon',
  evening: 'slot.evening',
  night: 'slot.night',
};

/**
 * 🏠 Home — the intelligent dashboard.
 *
 * Every section is fed from real endpoints (the journey plan, the Mentor, the
 * lesson history, the twin's learning path). Where a signal does not exist yet
 * the section states so honestly rather than faking a number. `allSettled` keeps
 * one failing endpoint from blanking the whole board.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState<DailyPlanView | null>(null);
  const [mentor, setMentor] = useState<MentorOverview | null>(null);
  const [lastLesson, setLastLesson] = useState<LessonSummary | null>(null);
  const [coach, setCoach] = useState<ProactiveBriefing | null>(null);
  const [initiatives, setInitiatives] = useState<InitiativeView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    const [planRes, mentorRes, lessonsRes, coachRes, initRes] = await Promise.allSettled([
      api<DailyPlanView>('/journey/today'),
      api<MentorOverview>('/mentor'),
      api<LessonSummary[]>('/lessons'),
      api<ProactiveBriefing>('/coach/today'),
      api<InitiativeView[]>('/proactive'),
    ]);
    if (planRes.status === 'fulfilled') setPlan(planRes.value);
    if (mentorRes.status === 'fulfilled') setMentor(mentorRes.value);
    if (lessonsRes.status === 'fulfilled') setLastLesson(lessonsRes.value[0] ?? null);
    if (coachRes.status === 'fulfilled') setCoach(coachRes.value);
    if (initRes.status === 'fulfilled') setInitiatives(initRes.value);
    // Only surface an error if literally everything failed — a single dead
    // endpoint should degrade one card, not the page.
    if (
      [planRes, mentorRes, lessonsRes, coachRes].every((r) => r.status === 'rejected')
    ) {
      setError((planRes as PromiseRejectedResult).reason?.message ?? 'Could not load your dashboard.');
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) void load();
    }, [user, load]),
  );

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || '';

  const respondInitiative = async (id: string, action: 'act' | 'dismiss') => {
    setInitiatives((prev) => prev.filter((i) => i.id !== id));
    // Through the offline outbox (Sprint 10.3): sent now if online, queued and
    // auto-synced on reconnect if not — the card is already gone from the UI.
    await enqueue({
      method: 'POST',
      path: `/proactive/${id}/${action}`,
      label: action === 'act' ? 'Accepted a suggestion' : 'Dismissed a suggestion',
    });
  };

  const openItem = (item: DailyPlanItemView) => {
    if (['review', 'quick_revision', 'vocabulary'].includes(item.kind)) {
      router.push('/revision');
      return;
    }
    router.push({ pathname: '/lesson/new', params: { conceptId: item.conceptId ?? '', title: item.title } });
  };

  // A coach recommendation routes to the right place for its kind.
  const openRecommendation = (r: StudyRecommendation) => {
    if (r.kind === 'review' || r.kind === 'vocabulary') {
      router.push('/revision');
      return;
    }
    router.push({
      pathname: '/lesson/new',
      params: { conceptId: r.conceptId ?? '', title: r.activity },
    });
  };

  // The day's headline objective: the afternoon lesson if planned, else the
  // first thing still to do.
  const pending = plan?.items.filter((i) => i.status === 'pending') ?? [];
  const objective =
    pending.find((i) => i.slot === 'afternoon' && i.kind === 'lesson') ?? pending[0] ?? null;

  const due = mentor?.stats.dueNow ?? 0;

  if (loading) {
    return <Loading label={t('classroom.opening')} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={theme.textMuted} />
      }
    >
      {/* 👋 Greeting */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.greeting}>
            👋 {t('home.greeting')} {name}
          </Text>
          <Text style={styles.date}>
            {plan ? new Date(`${plan.date}T00:00:00Z`).toDateString() : ''}
          </Text>
        </View>
        <View style={styles.streak} testID="streak">
          <Text style={styles.streakNumber}>{mentor?.streak.current ?? 0}</Text>
          <Text style={styles.streakLabel}>{t('classroom.streak')}</Text>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* 🧭 Proactive mentor (Sprint 9.1): the AI took the initiative — it
          observed the learner's state and decided to act, explaining why. */}
      {initiatives.map((it) => (
        // Swipe the card away to dismiss (Sprint 10.2 touch gesture), or use the buttons.
        <SwipeableCard key={it.id} onDismiss={() => respondInitiative(it.id, 'dismiss')}>
          <Card style={styles.initiative} testID="initiative">
            <Text style={styles.initTitle}>🧭 {it.title}</Text>
            <Text style={styles.initMessage}>{it.message}</Text>
            {it.reasons.length > 0 ? (
              <>
                <Text style={styles.coachWhyLabel}>{t('mentor.why')}</Text>
                {it.reasons.map((r, i) => (
                  <Text key={i} style={styles.initReason}>• {r}</Text>
                ))}
              </>
            ) : null}
            <View style={styles.initActions}>
              <View style={styles.flex}>
                <Button label={t('mentor.act')} onPress={() => respondInitiative(it.id, 'act')} />
              </View>
              <Button variant="ghost" label={t('mentor.dismiss')} onPress={() => respondInitiative(it.id, 'dismiss')} />
            </View>
          </Card>
        </SwipeableCard>
      ))}

      {/* 👨‍🏫 The teacher speaks first: the prepared day, time-boxed, with one
          button into the session. This IS the app opening as a study day. */}
      {coach ? (
        <SessionBriefing
          coach={coach}
          name={name}
          onOpen={openRecommendation}
          onStart={() => router.push('/daily-session')}
        />
      ) : null}

      {/* 🎯 Today's objective */}
      <Section emoji="🎯" title={t('home.objective')}>
        {objective ? (
          <>
            <Text style={styles.body}>{objective.title}</Text>
            {objective.detail ? <Text style={styles.muted}>{objective.detail}</Text> : null}
            <Button label={t('home.open')} onPress={() => openItem(objective)} />
          </>
        ) : (
          <Text style={styles.muted}>{t('home.objectiveNone')}</Text>
        )}
      </Section>

      {/* 👨‍🏫 AI teacher's message */}
      <Section emoji="👨‍🏫" title={t('home.teacher')}>
        <Text style={styles.body}>{teacherMessage(mentor, lastLesson, t)}</Text>
      </Section>

      {/* 📚 Continue last lesson */}
      <Section emoji="📚" title={t('home.continue')}>
        {lastLesson ? (
          <>
            <Text style={styles.body}>{lastLesson.topic}</Text>
            {lastLesson.objective ? <Text style={styles.muted}>{lastLesson.objective}</Text> : null}
            <Button label={t('home.open')} onPress={() => router.push(`/lesson/${lastLesson.id}`)} />
          </>
        ) : (
          <Text style={styles.muted}>{t('home.continueNone')}</Text>
        )}
      </Section>

      {/* 🔥 Priority revision */}
      <Section emoji="🔥" title={t('home.priority')}>
        {due > 0 ? (
          <>
            <Text style={styles.big}>
              {due} <Text style={styles.body}>{t('home.cardsDue')}</Text>
            </Text>
            <Button label={t('home.reviewNow')} onPress={() => router.push('/revision')} />
          </>
        ) : (
          <Text style={styles.muted}>{t('home.nothingDue')}</Text>
        )}
      </Section>

      {/* 📅 Today's plan */}
      <Section emoji="📅" title={t('home.plan')}>
        {pending.length > 0 ? (
          pending.map((item) => (
            <View key={item.id} style={styles.planRow}>
              <Text style={styles.planSlot}>{t(SLOT_KEY[item.slot])}</Text>
              <Text style={styles.planTitle}>{item.title}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>{t('home.objectiveNone')}</Text>
        )}
      </Section>

      {/* 📈 Progress */}
      <Section emoji="📈" title={t('home.progress')}>
        <View style={styles.stats}>
          <Stat value={`${mentor?.streak.current ?? 0}`} label={t('classroom.streak')} />
          <Stat
            value={
              mentor?.stats.retention == null
                ? '—'
                : `${Math.round(mentor.stats.retention * 100)}%`
            }
            label={t('home.retention')}
          />
          <Stat value={`${mentor?.stats.conceptsMastered ?? 0}`} label={t('home.mastered')} />
        </View>
      </Section>

    </ScrollView>
  );
}

const REC_KIND_KEY: Record<StudyRecommendation['kind'], TranslationKey> = {
  review: 'briefing.k.review',
  lesson: 'briefing.k.lesson',
  vocabulary: 'briefing.k.vocabulary',
};

/**
 * 👨‍🏫 The AI teacher's morning briefing — the Sprint 5 result: the learner does
 * not open an app, they open a study day already prepared for them.
 *
 * The teacher greets by name, states it analysed the progress, lists the
 * time-boxed recommendations, gives the total ("achievable in N minutes"),
 * explains WHY (the "explains its choices" role), shows the real Learning Score,
 * and offers a single ▶ Start-my-session button into the daily session.
 *
 * No new logic: every recommendation and number comes from /coach/today
 * (CoachService), which already orchestrates the twin, learning path and FSRS.
 * The total is a plain sum of the real per-item minutes.
 */
function SessionBriefing({
  coach,
  name,
  onOpen,
  onStart,
}: {
  coach: ProactiveBriefing;
  name: string;
  onOpen: (r: StudyRecommendation) => void;
  onStart: () => void;
}) {
  const { t } = useI18n();
  const recs = coach.recommendations;
  const totalMinutes = recs.reduce((sum, r) => sum + r.minutes, 0);

  // Prefer the concept being forgotten (a 'review') for the "why" line; fall
  // back to a language if that's all there is.
  const firstReview =
    recs.find((r) => r.kind === 'review') ?? recs.find((r) => r.kind === 'vocabulary');

  return (
    <Card style={styles.coach} testID="coach">
      <Text style={styles.briefHello}>
        👨‍🏫 {t('briefing.hello')} {name}.
      </Text>
      <Text style={styles.coachLead}>{t('briefing.analyzed')}</Text>

      {recs.length > 0 ? (
        <>
          <Text style={styles.briefRecommend}>{t('briefing.recommend')}</Text>
          {recs.map((r, i) => (
            <Pressable key={i} onPress={() => onOpen(r)} accessibilityRole="button">
              <View style={styles.coachRec} testID={`coach-rec-${i}`}>
                <Text style={styles.coachMinutes}>
                  {r.minutes} {t('briefing.min')}
                </Text>
                <Text style={styles.coachActivity}>
                  {t(REC_KIND_KEY[r.kind])} {r.activity}
                </Text>
              </View>
            </Pressable>
          ))}

          <Text style={styles.briefTotal}>
            {t('briefing.achievable').replace('{n}', String(totalMinutes))}
          </Text>

          {/* "Explains its choices" — the reasoned why behind the plan. */}
          <Text style={styles.coachWhyLabel}>{t('coach.why')}</Text>
          <Text style={styles.coachWhy}>
            {firstReview
              ? `${t('coach.forgetting')} ${firstReview.activity}.`
              : t('briefing.upToDate')}
          </Text>
        </>
      ) : (
        <Text style={styles.coachWhy}>{t('briefing.upToDate')}</Text>
      )}

      {/* Learning Score + honest projection. */}
      <View style={styles.scoreRow}>
        <Text style={styles.scoreLabel}>{t('coach.score')}</Text>
        <Text style={styles.scoreValue}>
          {coach.score.score === null ? '—' : `${coach.score.score}/100`}
        </Text>
      </View>
      {coach.projectedGain && coach.projectedGain > 0 ? (
        <Text style={styles.scoreGain}>
          {t('coach.wouldRaise')} +{coach.projectedGain} {t('coach.points')}.
        </Text>
      ) : coach.score.score === null ? (
        <Text style={styles.coachWhy}>{t('coach.newScore')}</Text>
      ) : null}

      <Button label={`▶ ${t('briefing.start')}`} onPress={onStart} />
    </Card>
  );
}

/** A light, honest teacher line built from real stats — no extra LLM call on a
 *  dashboard load. The full grounded briefing lives on the Progress screen. */
function teacherMessage(
  mentor: MentorOverview | null,
  lastLesson: LessonSummary | null,
  t: (k: TranslationKey) => string,
): string {
  if (mentor?.streak.studiedToday && mentor.streak.current >= 2) return t('teacher.streak');
  if ((mentor?.stats.dueNow ?? 0) > 0) return t('teacher.due');
  if (!lastLesson) return t('teacher.first');
  return t('teacher.default');
}

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {emoji} {title}
      </Text>
      <Card style={styles.sectionCard}>{children}</Card>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 24, fontWeight: '700', color: theme.text },
  date: { fontSize: 13, color: theme.textFaint, marginTop: 2 },
  streak: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  streakNumber: { fontSize: 22, fontWeight: '700', color: theme.warn },
  streakLabel: { fontSize: 11, color: theme.textMuted },
  initiative: { backgroundColor: theme.surfaceAlt, borderColor: theme.warn, gap: 6 },
  initTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  initMessage: { fontSize: 15, color: '#CBD5E1', lineHeight: 22 },
  initReason: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  initActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  coach: { backgroundColor: theme.surfaceAlt, borderColor: theme.accent, gap: 8 },
  coachTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
  coachLead: { fontSize: 14, color: theme.textMuted, marginTop: 2 },
  briefHello: { fontSize: 18, fontWeight: '700', color: theme.text },
  briefRecommend: { fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 4 },
  briefTotal: { fontSize: 15, fontWeight: '700', color: theme.ok, marginTop: 6 },
  coachRec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
  },
  coachMinutes: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.accentText,
    backgroundColor: theme.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  coachActivity: { fontSize: 16, fontWeight: '600', color: theme.text, flex: 1 },
  coachWhyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
  },
  coachWhy: { fontSize: 14, color: '#CBD5E1', lineHeight: 21 },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    paddingTop: 10,
  },
  scoreLabel: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  scoreValue: { fontSize: 20, fontWeight: '700', color: theme.warn },
  scoreGain: { fontSize: 13, color: theme.ok, marginTop: 4 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCard: { gap: 10 },
  body: { fontSize: 15, color: theme.text, lineHeight: 22 },
  muted: { fontSize: 14, color: theme.textMuted, lineHeight: 20 },
  big: { fontSize: 28, fontWeight: '700', color: theme.warn },
  planRow: { gap: 2 },
  planSlot: {
    fontSize: 11,
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planTitle: { fontSize: 15, color: theme.text },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: theme.text },
  statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 4, textAlign: 'center' },
});
