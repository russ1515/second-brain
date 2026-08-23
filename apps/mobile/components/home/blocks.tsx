import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  DailyPlanView,
  ExamView,
  InitiativeView,
  LearningPathItem,
  LessonSummary,
  MentorOverview,
  ProactiveBriefing,
  StudyRecommendation,
} from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { Alert, Badge, Button, Card, Input, Progress } from '../ds/core';
import { AIRecommendation, AITeacherMessage } from '../ds/ai';
import type { HomePersona } from '../../lib/home/persona';

/**
 * Home dashboard blocks (UI/UX Sprint 3), all built on the Sprint 1 design
 * system and fed by the existing engines (journey, coach, mentor, twin, exams).
 * No business logic lives here — each block only presents real data, states its
 * empty case honestly, and never fabricates a number.
 */

export type HomeContext =
  | 'new'
  | 'active'
  | 'exam'
  | 'revision'
  | 'success'
  | 'inactive';

// ── shared bits ──────────────────────────────────────────────────────────────
export function SectionTitle({ children }: { children: ReactNode }) {
  const { colors: c } = useTokens();
  return (
    <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </Text>
  );
}

export function BlockError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <Card>
      <Alert tone="warning" title={t('h.block.error')} />
      <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
        <Button label={t('h.block.retry')} variant="secondary" size="sm" onPress={onRetry} />
      </View>
    </Card>
  );
}

// ── 3.1 / 3.13 Hero — contextual AI daily briefing ───────────────────────────
export function HeroBriefing({
  name,
  context,
  coach,
  onStart,
  onDetail,
}: {
  name: string;
  context: HomeContext;
  coach: ProactiveBriefing | null;
  onStart: () => void;
  onDetail: () => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const ctxKey =
    context === 'new' ? 'h.ctx.new'
    : context === 'exam' ? 'h.ctx.exam'
    : context === 'revision' ? 'h.ctx.revision'
    : context === 'success' ? 'h.ctx.success'
    : context === 'inactive' ? 'h.ctx.inactive'
    : 'h.ctx.active';

  const recs = coach?.recommendations ?? [];
  const totalMin = recs.reduce((s, r) => s + r.minutes, 0);

  return (
    <Card elevated style={{ borderColor: c.aiAccent, gap: 10 }}>
      <Text style={{ color: c.textPrimary, fontSize: 24, fontWeight: '800' }}>
        👨‍🏫 {t('home.greeting')} {name}.
      </Text>
      {/* The teacher's lead line: prefer the localized coach headline, else the
          context line. */}
      <AITeacherMessage text={coach?.headline?.trim() || t(ctxKey)} posture="supportive" />
      {coach?.why?.trim() ? (
        <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 21 }}>{coach.why.trim()}</Text>
      ) : null}

      {recs.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Badge label={`${totalMin} ${t('h.hero.min')}`} tone="ai" />
          <Badge label={`${recs.length} ${t('h.hero.activities')}`} tone="neutral" />
          {context === 'exam' || context === 'revision' ? (
            <Badge label={t('h.hero.priorityHigh')} tone="warning" />
          ) : null}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 2, flexWrap: 'wrap' }}>
        <Button label={`▶ ${t('h.hero.start')}`} variant="ai" onPress={onStart} />
        <Button label={t('h.hero.detail')} variant="ghost" onPress={onDetail} />
      </View>
    </Card>
  );
}

// ── 3.11 Quick Capture / Universal Input ─────────────────────────────────────
export function QuickCapture({
  persona,
  onText,
  onSpeak,
  onScan,
  onImport,
}: {
  persona: HomePersona;
  onText: (text: string) => void;
  onSpeak: () => void;
  onScan: () => void;
  onImport: () => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const [text, setText] = useState('');
  const submit = () => {
    const v = text.trim();
    if (v) onText(v);
    setText('');
  };
  const captures: { key: HomePersona['primaryCapture']; icon: string; label: string; onPress: () => void }[] = [
    { key: 'write', icon: '✍️', label: t('h.capture.write'), onPress: submit },
    { key: 'speak', icon: '🎤', label: t('h.capture.speak'), onPress: onSpeak },
    { key: 'scan', icon: '📷', label: t('h.capture.scan'), onPress: onScan },
    { key: 'import', icon: '📎', label: t('h.capture.import'), onPress: onImport },
  ];
  const entries = captures.sort((a, b) => (a.key === persona.primaryCapture ? -1 : b.key === persona.primaryCapture ? 1 : 0));

  return (
    <Card>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>
        {t('h.capture.title')}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input placeholder={t('h.capture.placeholder')} value={text} onChangeText={setText} onSubmitEditing={submit} returnKeyType="send" />
        </View>
        <Button label="→" onPress={submit} disabled={!text.trim()} accessibilityLabel={t('h.capture.write')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {entries.map((e) => (
          <Pressable
            key={e.key}
            onPress={e.onPress}
            accessibilityRole="button"
            accessibilityLabel={e.label}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40 }}
          >
            <Text style={{ fontSize: 15 }}>{e.icon}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: '600' }}>{e.label}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}

// ── 3.2 Next Best Action ─────────────────────────────────────────────────────
export function NextBestAction({
  item,
  onStart,
}: {
  item: LearningPathItem | null;
  onStart: (item: LearningPathItem | null) => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const verb =
    !item ? t('h.nba.review')
    : item.status === 'ready' ? t('h.nba.learn')
    : t('h.nba.review');
  const reasonKey =
    !item ? 'h.nba.none'
    : item.status === 'at_risk' ? 'h.nba.r.at_risk'
    : item.status === 'ready' ? 'h.nba.r.ready'
    : item.status === 'in_progress' ? 'h.nba.r.in_progress'
    : 'h.nba.r.review';

  return (
    <Card elevated style={{ borderColor: c.aiAccent, gap: 8 }}>
      <Badge label={`🎯 ${t('h.nba.priority')}`} tone="ai" />
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 2 }}>
        {item ? `${verb} ${item.name}` : t('h.nba.title')}
      </Text>
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {t('h.nba.why')}
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 15, lineHeight: 22 }}>{t(reasonKey)}</Text>
      <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
        <Button label={`▶ ${t('h.nba.start')}`} variant="ai" onPress={() => onStart(item)} />
      </View>
    </Card>
  );
}

// ── 3.14 AI Proactive State ──────────────────────────────────────────────────
export function ProactiveState({
  initiatives,
  onAct,
  onDismiss,
}: {
  initiatives: InitiativeView[];
  onAct: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  if (initiatives.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      {initiatives.map((it) => (
        <Card key={it.id} style={{ borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, gap: 6 }}>
          <Badge label={`🤖 ${t('h.proactive.badge')}`} tone="ai" />
          <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{it.title}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 14, lineHeight: 21 }}>{it.message}</Text>
          {it.reasons.slice(0, 2).map((r, i) => (
            <Text key={i} style={{ color: c.textMuted, fontSize: 13, lineHeight: 19 }}>• {r}</Text>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Button label={t('h.recs.act')} size="sm" onPress={() => onAct(it.id)} />
            <Button label="✕" variant="ghost" size="sm" onPress={() => onDismiss(it.id)} accessibilityLabel="Dismiss" />
          </View>
        </Card>
      ))}
    </View>
  );
}

// ── 3.3 Daily Plan ───────────────────────────────────────────────────────────
export function DailyPlan({
  plan,
  onOpen,
}: {
  plan: DailyPlanView | null;
  onOpen: (item: DailyPlanView['items'][number]) => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const items = plan?.items ?? [];
  const firstPending = items.find((i) => i.status === 'pending');
  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{t('h.today.title')}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('h.today.none')}</Text>
      ) : (
        items.map((it) => {
          const mark = it.status === 'done' ? '✓' : it.status === 'skipped' ? '⤼' : it === firstPending ? '→' : '○';
          const markColor = it.status === 'done' ? c.success : it === firstPending ? c.aiAccent : c.textMuted;
          return (
            <Pressable
              key={it.id}
              onPress={() => onOpen(it)}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
            >
              <Text style={{ color: markColor, fontSize: 16, fontWeight: '800', width: 18 }}>{mark}</Text>
              <Text style={{ color: it.status === 'done' ? c.textMuted : c.textPrimary, fontSize: 15, flex: 1, textDecorationLine: it.status === 'done' ? 'line-through' : 'none' }}>
                {it.title}
              </Text>
              {it.targetCount ? (
                <Text style={{ color: c.textMuted, fontSize: 13 }}>×{it.targetCount}</Text>
              ) : null}
            </Pressable>
          );
        })
      )}
    </Card>
  );
}

// ── 3.4 Continue Learning ────────────────────────────────────────────────────
export function ContinueLearning({
  lesson,
  onOpen,
}: {
  lesson: LessonSummary | null;
  onOpen: () => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  return (
    <Card>
      <SectionTitle>{t('h.continue.title')}</SectionTitle>
      {lesson ? (
        <>
          <Text style={{ color: c.textPrimary, fontSize: 17, fontWeight: '700' }}>📚 {lesson.topic}</Text>
          {lesson.objective ? (
            <Text style={{ color: c.textSecondary, fontSize: 14, marginTop: 2 }}>{t('h.continue.reached')} {lesson.objective}</Text>
          ) : null}
          <View style={{ alignSelf: 'flex-start', marginTop: 10 }}>
            <Button label={t('h.continue.btn')} onPress={onOpen} />
          </View>
        </>
      ) : (
        <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('home.continueNone')}</Text>
      )}
    </Card>
  );
}

// ── 3.5 Progress (this week) ─────────────────────────────────────────────────
export function ProgressWeek({ mentor }: { mentor: MentorOverview | null }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const s = mentor?.stats;
  const cell = (value: string, label: string) => (
    <View style={{ flex: 1, minWidth: 80, alignItems: 'center', gap: 2 }}>
      <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  );
  return (
    <Card>
      <SectionTitle>{t('h.progress.week')}</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {cell(`${mentor?.streak.current ?? 0}`, t('h.progress.streak'))}
        {cell(s?.retention == null ? '—' : `${Math.round(s.retention * 100)}%`, t('home.retention'))}
        {cell(`${s?.conceptsMastered ?? 0}`, t('home.mastered'))}
        {cell(`${s?.cardsReviewed ?? 0}`, t('h.progress.reviews'))}
      </View>
    </Card>
  );
}

// ── 3.6 Mastery Snapshot ─────────────────────────────────────────────────────
export function MasterySnapshot({ items }: { items: LearningPathItem[] }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  // Only the relevant concepts: ones with a measured mastery (studied), weakest
  // first, capped — never the whole graph.
  const shown = items
    .filter((i) => i.mastery != null)
    .sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
    .slice(0, 4);
  return (
    <Card>
      <SectionTitle>{t('h.mastery.title')}</SectionTitle>
      {shown.length === 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('h.mastery.none')}</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((it) => {
            const pct = Math.round((it.mastery ?? 0) * 100);
            const tone = pct >= 80 ? 'success' : pct >= 50 ? 'primary' : 'ai';
            return (
              <View key={it.conceptId} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.textPrimary, fontSize: 14, flex: 1 }} numberOfLines={1}>{it.name}</Text>
                  <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: '700' }}>{pct}%</Text>
                </View>
                <Progress value={(it.mastery ?? 0)} tone={tone as 'success' | 'primary' | 'ai'} />
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

// ── 3.7 Upcoming Exams ───────────────────────────────────────────────────────
export function UpcomingExams({
  exams,
  onPlan,
}: {
  exams: ExamView[];
  onPlan: () => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const upcoming = exams.filter((e) => e.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 3);
  const when = (d: number) => (d === 0 ? t('h.exams.today') : d === 1 ? t('h.exams.tomorrow') : t('h.exams.inDays').replace('{n}', String(d)));
  return (
    <Card>
      <SectionTitle>{t('h.exams.title')}</SectionTitle>
      {upcoming.length === 0 ? (
        <>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>{t('h.exams.none')}</Text>
          <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{t('h.exams.hint')}</Text>
        </>
      ) : (
        <View style={{ gap: 10 }}>
          {upcoming.map((e) => (
            <View key={e.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '700' }}>{e.subject}</Text>
                <Text style={{ color: e.priority === 'high' ? c.warning : c.textMuted, fontSize: 13 }}>{when(e.daysUntil)}</Text>
              </View>
              {e.preparation != null ? (
                <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('h.exams.prep')} : {Math.round(e.preparation)}%</Text>
              ) : null}
            </View>
          ))}
          <View style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            <Button label={t('h.exams.plan')} variant="secondary" size="sm" onPress={onPlan} />
          </View>
        </View>
      )}
    </Card>
  );
}

// ── 3.8 AI Recommendations ───────────────────────────────────────────────────
export function Recommendations({
  recs,
  onAct,
}: {
  recs: StudyRecommendation[];
  onAct: (r: StudyRecommendation) => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const shown = recs.slice(0, 3);
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle>{t('h.recs.title')}</SectionTitle>
      {shown.length === 0 ? (
        <Card><Text style={{ color: c.textMuted, fontSize: 14 }}>{t('h.recs.none')}</Text></Card>
      ) : (
        shown.map((r, i) => (
          <AIRecommendation
            key={i}
            title={`${r.activity} · ${r.minutes} ${t('h.hero.min')}`}
            body={r.reason}
            action={<Button label={t('h.recs.act')} size="sm" variant="ai" onPress={() => onAct(r)} />}
          />
        ))
      )}
    </View>
  );
}

// ── 3.9 Streak & consistency ─────────────────────────────────────────────────
export function StreakStrip({ mentor }: { mentor: MentorOverview | null }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const current = mentor?.streak.current ?? 0;
  const studiedToday = mentor?.streak.studiedToday ?? false;
  // A modest 7-day run indicator derived from the real streak: fill the last
  // `min(current,7)` days ending today (if studied) or yesterday. It reflects the
  // consecutive-day count, not a fabricated per-day calendar.
  const filled = Math.min(current, 7);
  const dots = Array.from({ length: 7 }, (_, i) => {
    const fromEnd = 6 - i; // 0 = today
    const offset = studiedToday ? fromEnd : fromEnd - 1;
    return offset >= 0 && offset < filled;
  });
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '800' }}>🔥 {current} {t('h.streak.days')}</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {dots.map((on, i) => (
            <View key={i} style={{ width: 12, height: 12, borderRadius: 999, backgroundColor: on ? c.warning : c.surfaceSunken, borderWidth: on ? 0 : 1, borderColor: c.border }} />
          ))}
        </View>
      </View>
    </Card>
  );
}

// ── 3.10 Daily capacity (from the real recommended minutes) ──────────────────
export function CapacityBar({ minutes }: { minutes: number }) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  if (minutes <= 0) return null;
  // A gentle scale against a 90-minute "full day"; purely a display of the real
  // recommended minutes, no invented capacity engine.
  const ratio = Math.min(1, minutes / 90);
  return (
    <Card>
      <SectionTitle>{t('h.capacity.title')}</SectionTitle>
      <Progress value={ratio} tone="ai" />
      <Text style={{ color: c.textSecondary, fontSize: 14, marginTop: 8 }}>
        {t('h.capacity.recommended').replace('{n}', String(minutes))}
      </Text>
    </Card>
  );
}
