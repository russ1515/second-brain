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
  HomeResumableSession,
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
    ['learningControl.count.documents', preview.counts.documentsDeleted],
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
      {preview.sharedDocumentsPreserved > 0 ? (
        <Text style={[typography.caption, { color: c.textMuted }]}>
          {t('learningControl.sharedPreserved').replace('{count}', String(preview.sharedDocumentsPreserved))}
        </Text>
      ) : null}
    </View>
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

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
