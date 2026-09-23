import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  Text,
  View,
} from 'react-native';
import type {
  HomeContextView,
  HomeGoalPreview,
  HomeProgressSummary,
  HomeResumableSession,
  HomeUpcomingItem,
  NextBestAction,
} from '@second-brain/shared';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Progress } from '../ds/core';
import { Section } from '../ds/layout';

export function HomeContextHeader({ name, context }: { name: string; context: HomeContextView }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const contextKey = `home4.context.${context.kind}` as TranslationKey;
  const detail = t(contextKey).replace('{focus}', context.focusLabel ?? '');
  return (
    <View style={{ gap: spacing.xs }}>
      <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>
        {t('home.greeting')}{name ? ` ${name}` : ''}.
      </Text>
      <Text style={[typography.body, { color: c.textSecondary, maxWidth: 720 }]}>{detail}</Text>
    </View>
  );
}

export function NextBestActionCard({ action, onOpen }: { action: NextBestAction; onOpen: () => void }) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const [whyOpen, setWhyOpen] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) {
        opacity.setValue(1);
        return;
      }
      animation = Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true });
      animation.start();
    });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <View style={{ borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.lg, backgroundColor: c.surface, overflow: 'hidden' }}>
        <View style={{ height: 4, backgroundColor: c.aiAccent }} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm }}>
            <Badge tone="ai" label={t('home4.recommended')} />
            {action.estimatedDuration !== null ? <Badge tone="neutral" label={`${action.estimatedDuration} ${t('h.hero.min')}`} /> : null}
          </View>
          <View style={{ gap: spacing.xs }}>
            <Text accessibilityRole="header" style={[typography.display, { color: c.textPrimary }]}>{action.title}</Text>
            <Text style={[typography.body, { color: c.textSecondary, maxWidth: 760 }]}>{action.reason}</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: whyOpen }}
            accessibilityLabel={whyOpen ? t('home4.whyClose') : t('h.nba.why')}
            onPress={() => setWhyOpen((open) => !open)}
            style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[typography.bodySmall, { color: c.primary, fontWeight: '700' }]}>
              {whyOpen ? t('home4.whyClose') : t('h.nba.why')}
            </Text>
          </Pressable>

          {whyOpen ? (
            <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: c.surfaceSunken }}>
              <Text style={[typography.caption, { color: c.textMuted }]}>{t('home4.whyIntro')}</Text>
              {action.source.kind === 'foresight' && action.confidence !== null ? (
                <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>
                  {t('home4.confidence').replace('{value}', String(Math.round(action.confidence * 100)))}
                </Text>
              ) : null}
              {action.signalsUsed.map((signal) => (
                <View key={`${signal.signal}-${signal.evidence}`} style={{ gap: 2 }}>
                  <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{signal.humanLabel}</Text>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{signal.evidence}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Button label={action.primaryAction.label} variant="ai" size="lg" onPress={onOpen} />
        </View>
      </View>
    </Animated.View>
  );
}

export function SessionResumeCard({ session, onResume }: { session: HomeResumableSession; onResume: () => void }) {
  const { t, locale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const typeLabel = t(`home4.session.type.${session.type}` as TranslationKey);
  const percent = session.progress?.percent;
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Badge tone="neutral" label={typeLabel} />
          <Text style={[typography.title, { color: c.textPrimary, marginTop: spacing.xs }]} numberOfLines={2}>
            {session.title ?? typeLabel}
          </Text>
          <Text style={[typography.caption, { color: c.textMuted }]}>
            {t('home4.lastActivity')}: {formatActivityDate(session.updatedAt, locale, t)}
          </Text>
        </View>
        {percent !== undefined ? <Text style={[typography.title, { color: c.primary }]}>{percent}%</Text> : null}
      </View>

      {session.contextLabels.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {session.contextLabels.map((label) => <Badge key={label} tone="primary" label={label} />)}
        </View>
      ) : null}
      {percent !== undefined ? <Progress value={percent} /> : null}
      {session.artifact ? (
        <Text style={[typography.bodySmall, { color: c.textSecondary }]} numberOfLines={2}>
          {t('home4.artifact')}: {session.artifact.title ?? session.artifact.kind}
        </Text>
      ) : null}
      <Button label={t('home4.resumeAction')} variant="secondary" onPress={onResume} />
    </Card>
  );
}

export function ResumeSection({ sessions, onResume }: { sessions: HomeResumableSession[]; onResume: (session: HomeResumableSession) => void }) {
  const { t } = useI18n();
  const { spacing } = useTokens();
  if (sessions.length === 0) return null;
  return (
    <Section title={t('home4.resume')} description={t('home4.resumeDetail')}>
      <View style={{ gap: spacing.sm }}>
        {sessions.slice(0, 3).map((session) => <SessionResumeCard key={session.id} session={session} onResume={() => onResume(session)} />)}
      </View>
    </Section>
  );
}

export function UpcomingSection({ items, onOpen, onPlanning }: { items: HomeUpcomingItem[]; onOpen: (item: HomeUpcomingItem) => void; onPlanning: () => void }) {
  const { t, locale } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  return (
    <Section title={t('home4.upcoming')} description={t('home4.upcomingDetail')} action={<Button label={t('home4.planning')} size="sm" variant="ghost" onPress={onPlanning} />}>
      {items.length === 0 ? (
        <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('home4.upcomingEmpty')}</Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {items.map((item) => (
            <Pressable
              key={`${item.date}-${item.kind}-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${formatUpcomingDate(item.date, locale, t)} — ${item.title}`}
              onPress={() => onOpen(item)}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 54,
                paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
                backgroundColor: pressed ? c.surfaceSunken : 'transparent',
                borderBottomWidth: 1, borderBottomColor: c.borderSubtle,
              })}
            >
              <Text style={[typography.caption, { color: c.textMuted, width: 88 }]}>{formatUpcomingDate(item.date, locale, t)}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]} numberOfLines={2}>{item.title}</Text>
                <Text style={[typography.caption, { color: c.textMuted }]}>{t(`home4.upcoming.kind.${item.kind}` as TranslationKey)}</Text>
              </View>
              <Text accessible={false} style={{ color: c.textMuted }}>→</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Section>
  );
}

export function MainGoalPreview({ goal, onOpen }: { goal: HomeGoalPreview | null; onOpen: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (!goal) return null;
  return (
    <Section title={t('home4.mainGoal')}>
      <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
        <Text style={[typography.h3, { color: c.textPrimary }]}>{goal.title}</Text>
        <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t(`home4.goal.period.${goal.period}` as TranslationKey)}</Text>
        {goal.progress !== null ? <Progress value={goal.progress} /> : null}
        <Button label={t('home4.goal.open')} variant="secondary" onPress={onOpen} />
      </View>
    </Section>
  );
}

export function ProgressSummary({ progress, onOpen }: { progress: HomeProgressSummary | null; onOpen: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (!progress) return null;
  const items = [
    { value: progress.reviewsDue, label: t('home4.progress.due') },
    { value: progress.conceptsMastered, label: t('home4.progress.mastered') },
    { value: progress.streakDays, label: t('home4.progress.streak') },
  ];
  return (
    <Section title={t('home4.progress.title')} description={t('home4.progress.detail')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, paddingVertical: spacing.xs }}>
        {items.map((item) => (
          <View key={item.label} style={{ minWidth: 100, gap: 2 }}>
            <Text style={[typography.h2, { color: c.textPrimary, fontVariant: ['tabular-nums'] }]}>{item.value}</Text>
            <Text style={[typography.caption, { color: c.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
      <Button label={t('home4.progress.open')} variant="ghost" onPress={onOpen} />
    </Section>
  );
}

export function HomeQuickActions({ onWrite, onSpeak, onScan, onImport }: { onWrite: () => void; onSpeak: () => void; onScan: () => void; onImport: () => void }) {
  const { t } = useI18n();
  const { spacing } = useTokens();
  const actions = [
    { label: t('h.capture.write'), icon: '✎', onPress: onWrite },
    { label: t('h.capture.speak'), icon: '◉', onPress: onSpeak },
    { label: t('h.capture.scan'), icon: '▣', onPress: onScan },
    { label: t('h.capture.import'), icon: '＋', onPress: onImport },
  ];
  return (
    <Section title={t('home4.other')} description={t('home4.otherDetail')}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {actions.map((action) => <Button key={action.label} label={action.label} icon={action.icon} variant="ghost" onPress={action.onPress} />)}
      </View>
    </Section>
  );
}

type Translate = (key: TranslationKey) => string;

function formatActivityDate(value: string, locale: string, t: Translate): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('home4.date.unknown');
  const today = new Date();
  if (sameDay(date, today)) return t('home4.date.today');
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return t('home4.date.yesterday');
  return date.toLocaleDateString(locale, { dateStyle: 'medium' });
}

function formatUpcomingDate(value: string, locale: string, t: Translate): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  if (sameDay(date, today)) return t('home4.date.today');
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, tomorrow)) return t('home4.date.tomorrow');
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
