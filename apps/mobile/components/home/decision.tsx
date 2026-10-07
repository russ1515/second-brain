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
  LearningDeletionPreview,
  NextBestAction,
} from '@second-brain/shared';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Progress } from '../ds/core';
import { Section } from '../ds/layout';
import { Dialog } from '../ds/overlays';

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

export function SessionResumeCard({
  session,
  onResume,
  onDelete,
  onPreviewDelete,
  deleting = false,
}: {
  session: HomeResumableSession;
  onResume: () => void;
  onDelete?: () => void;
  onPreviewDelete?: () => Promise<LearningDeletionPreview>;
  deleting?: boolean;
}) {
  const { t, formatLocale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [preview, setPreview] = useState<LearningDeletionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const typeLabel = t(`home4.session.type.${session.type}` as TranslationKey);
  const percent = session.progress?.percent;
  const deleteLabel = t('workspace10.plan.remove');
  return (
    <>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Badge tone="neutral" label={typeLabel} />
            <Text style={[typography.title, { color: c.textPrimary, marginTop: spacing.xs }]} numberOfLines={2}>
              {session.title ?? typeLabel}
            </Text>
            <Text style={[typography.caption, { color: c.textMuted }]}>
              {t('home4.lastActivity')}: {formatActivityDate(session.updatedAt, formatLocale, t)}
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label={t('home4.resumeAction')} variant="secondary" onPress={onResume} />
          {onDelete ? (
            <Button
              label={deleteLabel}
              icon="⌫"
              variant="ghost"
              disabled={deleting}
              onPress={() => {
                setConfirmingDelete(true);
                setPreview(null);
                setPreviewFailed(false);
                setPreviewing(true);
                void onPreviewDelete?.()
                  .then(setPreview)
                  .catch(() => setPreviewFailed(true))
                  .finally(() => setPreviewing(false));
              }}
              testID={`resume-delete-${session.id}`}
            />
          ) : null}
        </View>
      </Card>
      <Dialog
        visible={confirmingDelete}
        onClose={() => { if (!deleting) setConfirmingDelete(false); }}
        title={deleteLabel}
        footer={(
          <>
            <Button label={t('tutor.cancel')} variant="ghost" disabled={deleting} onPress={() => setConfirmingDelete(false)} />
            <Button
              label={deleteLabel}
              variant="danger"
              loading={deleting || previewing}
              disabled={!preview || previewFailed}
              onPress={() => {
                setConfirmingDelete(false);
                onDelete?.();
              }}
              testID={`resume-delete-confirm-${session.id}`}
            />
          </>
        )}
      >
        <Text style={[typography.body, { color: c.textSecondary }]}>{session.title ?? typeLabel}</Text>
        <DeletionImpact preview={preview} loading={previewing} failed={previewFailed} />
      </Dialog>
    </>
  );
}

export function ResumeSection({
  sessions,
  onResume,
  onDelete,
  onPreviewDelete,
  deletingSessionId,
}: {
  sessions: HomeResumableSession[];
  onResume: (session: HomeResumableSession) => void;
  onDelete?: (session: HomeResumableSession) => void;
  onPreviewDelete?: (session: HomeResumableSession) => Promise<LearningDeletionPreview>;
  deletingSessionId?: string | null;
}) {
  const { t } = useI18n();
  const { spacing } = useTokens();
  if (sessions.length === 0) return null;
  return (
    <Section title={t('home4.resume')} description={t('home4.resumeDetail')}>
      <View style={{ gap: spacing.sm }}>
        {sessions.slice(0, 3).map((session) => (
          <SessionResumeCard
            key={session.id}
            session={session}
            onResume={() => onResume(session)}
            onDelete={onDelete ? () => onDelete(session) : undefined}
            onPreviewDelete={onPreviewDelete ? () => onPreviewDelete(session) : undefined}
            deleting={deletingSessionId === session.id}
          />
        ))}
      </View>
    </Section>
  );
}

export function UpcomingSection({
  items,
  onOpen,
  onPlanning,
  onDelete,
  onPreviewDelete,
  deletingItemId,
}: {
  items: HomeUpcomingItem[];
  onOpen: (item: HomeUpcomingItem) => void;
  onPlanning: () => void;
  onDelete?: (item: HomeUpcomingItem) => void;
  onPreviewDelete?: (item: HomeUpcomingItem) => Promise<LearningDeletionPreview>;
  deletingItemId?: string | null;
}) {
  const { t, formatLocale } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  return (
    <Section title={t('home4.upcoming')} description={t('home4.upcomingDetail')} action={<Button label={t('home4.planning')} size="sm" variant="ghost" onPress={onPlanning} />}>
      {items.length === 0 ? (
        <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('home4.upcomingEmpty')}</Text>
      ) : (
        <View style={{ gap: spacing.xs }}>
          {items.map((item) => (
            <UpcomingItemRow
              key={`${item.date}-${item.kind}-${item.id}`}
              item={item}
              dateLabel={formatUpcomingDate(item.date, formatLocale, t)}
              onOpen={() => onOpen(item)}
              onDelete={onDelete && item.deletion?.kind !== 'details-only' ? () => onDelete(item) : undefined}
              onPreviewDelete={onPreviewDelete && item.deletion?.kind !== 'details-only' ? () => onPreviewDelete(item) : undefined}
              deleting={deletingItemId === item.id}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

export function MainGoalPreview({ goal, onOpen, onDelete, onPreviewDelete, deleting = false }: {
  goal: HomeGoalPreview | null;
  onOpen: () => void;
  onDelete?: () => void;
  onPreviewDelete?: () => Promise<LearningDeletionPreview>;
  deleting?: boolean;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [preview, setPreview] = useState<LearningDeletionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  if (!goal) return null;
  return (
    <>
      <Section title={t('home4.mainGoal')}>
        <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
          <Text style={[typography.h3, { color: c.textPrimary }]}>{goal.title}</Text>
          <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t(`home4.goal.period.${goal.period}` as TranslationKey)}</Text>
          {goal.progress !== null ? <Progress value={goal.progress} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label={t('home4.goal.open')} variant="secondary" onPress={onOpen} />
            {onDelete ? (
              <Button
                label={t('learningControl.deleteGoal')}
                variant="ghost"
                disabled={deleting}
                onPress={() => {
                  setConfirmingDelete(true);
                  setPreview(null);
                  setPreviewFailed(false);
                  setPreviewing(true);
                  void onPreviewDelete?.()
                    .then(setPreview)
                    .catch(() => setPreviewFailed(true))
                    .finally(() => setPreviewing(false));
                }}
              />
            ) : null}
          </View>
        </View>
      </Section>
      <Dialog
        visible={confirmingDelete}
        onClose={() => { if (!deleting) setConfirmingDelete(false); }}
        title={t('learningControl.deleteGoal')}
        footer={(
          <>
            <Button label={t('tutor.cancel')} variant="ghost" disabled={deleting} onPress={() => setConfirmingDelete(false)} />
            <Button
              label={t('learningControl.deleteGoal')}
              variant="danger"
              loading={deleting || previewing}
              disabled={!preview || previewFailed}
              onPress={() => { setConfirmingDelete(false); onDelete?.(); }}
            />
          </>
        )}
      >
        <Text style={[typography.body, { color: c.textSecondary }]}>{goal.title}</Text>
        <DeletionImpact preview={preview} loading={previewing} failed={previewFailed} />
      </Dialog>
    </>
  );
}

export function MainGoalEmpty({ onCreate }: { onCreate: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Section title={t('home4.mainGoal')}>
      <View style={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
        <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('goals.none')}</Text>
        <Button label={t('brain8.action.goal')} variant="secondary" onPress={onCreate} />
      </View>
    </Section>
  );
}

function UpcomingItemRow({
  item,
  dateLabel,
  onOpen,
  onDelete,
  onPreviewDelete,
  deleting,
}: {
  item: HomeUpcomingItem;
  dateLabel: string;
  onOpen: () => void;
  onDelete?: () => void;
  onPreviewDelete?: () => Promise<LearningDeletionPreview>;
  deleting: boolean;
}) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [preview, setPreview] = useState<LearningDeletionPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const detailOnly = item.deletion?.kind === 'details-only';
  const openAction = () => {
    if (detailOnly || !onDelete || !onPreviewDelete) {
      onOpen();
      return;
    }
    setConfirmingDelete(true);
    setPreview(null);
    setPreviewFailed(false);
    setPreviewing(true);
    void onPreviewDelete()
      .then(setPreview)
      .catch(() => setPreviewFailed(true))
      .finally(() => setPreviewing(false));
  };
  return (
    <>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 54,
        paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm,
        borderBottomWidth: 1, borderBottomColor: c.borderSubtle,
      }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${dateLabel} — ${item.title}`}
          onPress={onOpen}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            backgroundColor: pressed ? c.surfaceSunken : 'transparent',
          })}
        >
          <Text style={[typography.caption, { color: c.textMuted, width: 88 }]}>{dateLabel}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]} numberOfLines={2}>{item.title}</Text>
            <Text style={[typography.caption, { color: c.textMuted }]}>{t(`home4.upcoming.kind.${item.kind}` as TranslationKey)}</Text>
          </View>
        </Pressable>
        {item.deletion ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailOnly ? t('learningControl.openDetails') : t('learningControl.delete')}
            onPress={openAction}
            disabled={deleting}
            hitSlop={8}
            style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={[typography.title, { color: c.textMuted }]}>⋮</Text>
          </Pressable>
        ) : <Text accessible={false} style={{ color: c.textMuted }}>→</Text>}
      </View>
      <Dialog
        visible={confirmingDelete}
        onClose={() => { if (!deleting) setConfirmingDelete(false); }}
        title={t('learningControl.delete')}
        footer={(
          <>
            <Button label={t('tutor.cancel')} variant="ghost" disabled={deleting} onPress={() => setConfirmingDelete(false)} />
            <Button
              label={t('learningControl.delete')}
              variant="danger"
              loading={deleting || previewing}
              disabled={!preview || previewFailed}
              onPress={() => { setConfirmingDelete(false); onDelete?.(); }}
            />
          </>
        )}
      >
        <Text style={[typography.body, { color: c.textSecondary }]}>{item.title}</Text>
        <DeletionImpact preview={preview} loading={previewing} failed={previewFailed} />
      </Dialog>
    </>
  );
}

export function DeletionImpact({ preview, loading, failed }: {
  preview: LearningDeletionPreview | null;
  loading: boolean;
  failed: boolean;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (loading) return <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('learningControl.previewLoading')}</Text>;
  if (failed || !preview) return <Text style={[typography.bodySmall, { color: c.error }]}>{t('learningControl.previewFailed')}</Text>;
  const allCountEntries: Array<[TranslationKey, number]> = [
    ['learningControl.count.sessions', preview.counts.sessions],
    ['learningControl.count.lessons', preview.counts.lessons],
    ['learningControl.count.studySessions', preview.counts.studySessions],
    ['learningControl.count.messages', preview.counts.tutorMessages],
    ['learningControl.count.exercises', preview.counts.exerciseAttempts + preview.counts.homework],
    ['learningControl.count.reviews', preview.counts.reviewItems],
    ['learningControl.count.cards', preview.counts.cards],
    ['learningControl.count.documents', preview.counts.documentsMovedToTrash],
    ['learningControl.count.reminders', preview.counts.calendarEvents],
    ['learningControl.count.references', preview.counts.workspaceReferences],
    ['learningControl.count.recommendations', preview.counts.recommendations],
  ];
  const countEntries = allCountEntries.filter((entry) => entry[1] > 0);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('learningControl.impact')}</Text>
      {countEntries.map(([key, count]) => (
        <Text key={key} style={[typography.bodySmall, { color: c.textPrimary }]}>• {t(key).replace('{count}', String(count))}</Text>
      ))}
      {preview.reversibleDocuments ? (
        <Text style={[typography.caption, { color: c.textMuted }]}>{t('learningControl.documentsTrash')}</Text>
      ) : null}
      {preview.sharedDocumentsPreserved > 0 ? (
        <Text style={[typography.caption, { color: c.textMuted }]}>
          {t('learningControl.sharedPreserved').replace('{count}', String(preview.sharedDocumentsPreserved))}
        </Text>
      ) : null}
    </View>
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

function formatActivityDate(value: string, formatLocale: string, t: Translate): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t('home4.date.unknown');
  const today = new Date();
  if (sameDay(date, today)) return t('home4.date.today');
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (sameDay(date, yesterday)) return t('home4.date.yesterday');
  return date.toLocaleDateString(formatLocale, { dateStyle: 'medium' });
}

function formatUpcomingDate(value: string, formatLocale: string, t: Translate): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  if (sameDay(date, today)) return t('home4.date.today');
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, tomorrow)) return t('home4.date.tomorrow');
  return date.toLocaleDateString(formatLocale, { day: 'numeric', month: 'short' });
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
