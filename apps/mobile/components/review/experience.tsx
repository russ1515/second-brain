import { Pressable, Text, View } from 'react-native';
import type {
  ReviewDailyPlan,
  ReviewExperienceItem,
  ReviewHomeView,
  ReviewPriorityReason,
  ReviewRating,
  ReviewSessionSummary,
} from '@second-brain/shared';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Badge, Button, Card, Progress } from '../ds/core';
import { SourceCitation } from '../ds/sources';

export function TodayReview({
  home,
  selectedSize,
  onSize,
  onStart,
}: {
  home: ReviewHomeView;
  selectedSize: 5 | 10 | 'all';
  onSize: (size: 5 | 10 | 'all') => void;
  onStart: () => void;
}) {
  const { t, locale } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const largeQueue = home.overdueCount >= 25;
  return (
    <Card elevated style={{ borderColor: c.aiAccent, gap: spacing.md }} testID="review-today">
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.overline, { color: c.aiAccent }]}>{t('review9.now')}</Text>
        <Text accessibilityRole="header" style={[typography.display, { color: c.textPrimary }]}>
          {home.dueCount === 0 ? t('review9.caughtUp') : t('review9.dueCount').replace('{count}', String(home.dueCount))}
        </Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
          {home.dueCount === 0
            ? nextDueText(home.plan, t, locale)
            : largeQueue
              ? t('review9.largeQueue')
              : t('review9.dueDetail').replace('{cards}', String(home.flashcardDueCount)).replace('{activities}', String(home.activityDueCount))}
        </Text>
      </View>

      {home.dueCount > 0 ? (
        <>
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label, { color: c.textPrimary }]}>{t('review9.sessionSize')}</Text>
            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {([5, 10, 'all'] as const).map((size) => (
                <Pressable
                  key={String(size)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedSize === size }}
                  accessibilityLabel={size === 'all' ? t('review9.sizeAll') : t('review9.sizeCount').replace('{count}', String(size))}
                  onPress={() => onSize(size)}
                  style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: 1, borderColor: selectedSize === size ? c.aiAccent : c.border, backgroundColor: selectedSize === size ? c.aiAccentSoft : c.surface }}
                >
                  <Text style={[typography.bodySmall, { color: selectedSize === size ? c.aiAccent : c.textPrimary, fontWeight: '700' }]}>
                    {size === 'all' ? t('review9.sizeAll') : t('review9.sizeCount').replace('{count}', String(size))}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Button label={t('review9.start')} variant="ai" size="lg" onPress={onStart} testID="start-review" />
        </>
      ) : null}
    </Card>
  );
}

export function PriorityExplanation({ item, dueCount, itemOnly = false }: { item?: ReviewExperienceItem; dueCount: number; itemOnly?: boolean }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const reasons = item?.reasons ?? (dueCount > 0 ? [{ code: 'due-now' as const, value: dueCount }] : []);
  if (reasons.length === 0) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('review9.why')}</Text>
      {reasons.slice(0, 3).map((reason, index) => (
        <View key={`${reason.code}-${index}`} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
          <Text accessible={false} style={{ color: c.aiAccent }}>●</Text>
          <Text style={[typography.bodySmall, { color: c.textSecondary, flex: 1 }]}>{reasonText(reason, dueCount, itemOnly, t)}</Text>
        </View>
      ))}
    </Card>
  );
}

export function ReviewQueuePreview({ items }: { items: readonly ReviewExperienceItem[] }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (items.length === 0) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('review9.upNext')}</Text>
      {items.slice(0, 5).map((item) => (
        <View key={item.reference} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 }}>
          <Text accessible={false} style={{ fontSize: 17 }}>{item.format === 'flashcard' ? '◫' : '◎'}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{item.prompt}</Text>
            <Text numberOfLines={1} style={[typography.caption, { color: c.textMuted }]}>{item.concepts.map((concept) => concept.name).join(' · ') || item.title}</Text>
          </View>
          <Badge label={t(`review9.priority.${item.priority}` as TranslationKey)} tone={item.priority === 'urgent' ? 'error' : item.priority === 'high' ? 'warning' : 'neutral'} />
        </View>
      ))}
    </Card>
  );
}

export function DailyReviewPlanView({ plan }: { plan: ReviewDailyPlan }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('review9.plan')}</Text>
      <PlanRow label={t('review9.today')} value={String(plan.today)} />
      <PlanRow label={t('review9.tomorrow')} value={String(plan.tomorrow)} />
      {plan.nextExam ? <PlanRow label={t('review9.exam')} value={`${plan.nextExam.subject} · ${plan.nextExam.daysUntil === 0 ? t('review9.today').toLowerCase() : t('review9.inDays').replace('{count}', String(plan.nextExam.daysUntil))}`} /> : null}
    </Card>
  );

  function PlanRow({ label, value }: { label: string; value: string }) {
    return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{label}</Text><Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700', textAlign: 'right', flexShrink: 1 }]}>{value}</Text></View>;
  }
}

export function ReviewWorkItem({
  item,
  index,
  total,
  revealed,
  busy,
  onReveal,
  onRate,
  onOpenSource,
  onAskTutor,
  onOpenLanguage,
}: {
  item: ReviewExperienceItem;
  index: number;
  total: number;
  revealed: boolean;
  busy: boolean;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
  onOpenSource: () => void;
  onAskTutor: () => void;
  onOpenLanguage?: () => void;
}) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  return (
    <View style={{ gap: spacing.md }}>
      <View accessibilityRole="progressbar" accessibilityValue={{ now: index + 1, min: 1, max: total }} style={{ gap: spacing.xs }}>
        <Text style={[typography.caption, { color: c.textMuted }]}>{t('review9.progress').replace('{current}', String(index + 1)).replace('{total}', String(total))}</Text>
        <Progress value={Math.round(((index + 1) / total) * 100)} tone="ai" />
      </View>
      <Card style={{ gap: spacing.md, minHeight: 280, justifyContent: 'space-between' }} testID="review-item">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Badge label={t(item.format === 'flashcard' ? 'review9.type.flashcard' : 'review9.type.recall')} tone="ai" />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {item.language ? <Button label={item.language} variant="ghost" size="sm" onPress={onOpenLanguage} /> : null}
            {item.source ? <SourceCitation title={item.source.title} kind="document" onPress={onOpenSource} /> : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: revealed }}
          accessibilityLabel={revealed ? t('review9.answerShown') : t('revision.reveal')}
          onPress={revealed ? undefined : onReveal}
          style={{ flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.md, borderRadius: radius.lg, backgroundColor: c.surfaceSunken, padding: spacing.lg }}
        >
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('review9.prompt')}</Text>
          <Text selectable style={[typography.display, { color: c.textPrimary, textAlign: 'center' }]}>{item.prompt}</Text>
          {revealed ? (
            <View style={{ width: '100%', borderTopWidth: 1, borderTopColor: c.border, paddingTop: spacing.md, gap: spacing.xs }}>
              <Text style={[typography.caption, { color: c.textMuted }]}>{item.answer ? t('review9.correction') : t('review9.selfAssess')}</Text>
              <Text selectable style={[typography.body, { color: c.textSecondary, textAlign: 'center' }]}>{item.answer ?? t('review9.noCorrection')}</Text>
            </View>
          ) : <Text style={[typography.bodySmall, { color: c.primary }]}>{t('revision.tapReveal')}</Text>}
        </Pressable>
        {!revealed ? <Button label={t('revision.reveal')} onPress={onReveal} fullWidth /> : (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.label, { color: c.textPrimary }]}>{t('review9.ratePrompt')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
              {([1, 2, 3, 4] as const).map((rating) => (
                <Pressable
                  key={rating}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={t(RATING_KEYS[rating])}
                  accessibilityState={{ disabled: busy }}
                  onPress={() => onRate(rating)}
                  testID={`grade-${rating}`}
                  style={{ flexGrow: 1, flexBasis: 120, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, backgroundColor: c.surface, opacity: busy ? 0.5 : 1 }}
                >
                  <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{t(RATING_KEYS[rating])}</Text>
                </Pressable>
              ))}
            </View>
            <Button label={t('review9.askTutor')} variant="ghost" size="sm" onPress={onAskTutor} />
          </View>
        )}
      </Card>
    </View>
  );
}

export function ReviewFeedback({ code }: { code: 'review-soon' | 'still-fragile' | 'good-recall' | 'easy-recall' }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <View accessibilityLiveRegion="polite" style={{ padding: spacing.sm }}><Text style={[typography.bodySmall, { color: c.textSecondary, textAlign: 'center', fontWeight: '700' }]}>{t(`review9.feedback.${code}` as TranslationKey)}</Text></View>;
}

export function ReviewSummaryView({ summary }: { summary: ReviewSessionSummary }) {
  const { t, locale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.md, alignItems: 'center', paddingVertical: spacing.xl }} testID="review-summary">
      <Text accessible={false} style={{ fontSize: 38 }}>✓</Text>
      <Text accessibilityRole="header" style={[typography.display, { color: c.textPrimary, textAlign: 'center' }]}>{t('review9.complete')}</Text>
      <Text style={[typography.body, { color: c.textSecondary, textAlign: 'center' }]}>{t('review9.completeDetail').replace('{reviewed}', String(summary.reviewed)).replace('{difficult}', String(summary.difficult))}</Text>
      {summary.nextReviewAt ? <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('review9.nextReview').replace('{date}', new Date(summary.nextReviewAt).toLocaleDateString(locale))}</Text> : null}
    </Card>
  );
}

const RATING_KEYS: Record<ReviewRating, TranslationKey> = {
  1: 'revision.again',
  2: 'revision.hard',
  3: 'revision.good',
  4: 'revision.easy',
};

function reasonText(reason: ReviewPriorityReason, dueCount: number, itemOnly: boolean, t: (key: TranslationKey) => string): string {
  if (reason.code === 'due-now') return itemOnly ? t('review9.reason.itemDue') : t('review9.reason.due').replace('{count}', String(reason.value ?? dueCount));
  if (reason.code === 'overdue') return t('review9.reason.overdue').replace('{count}', String(reason.value ?? 0));
  if (reason.code === 'relearning') return t('review9.reason.relearning');
  if (reason.code === 'target-concept') return t('review9.reason.concept');
  if (reason.code === 'source-document') return t('review9.reason.document');
  if (reason.code === 'exam-soon') return t('review9.reason.exam').replace('{count}', String(reason.value ?? 0));
  if (reason.code === 'active-goal') return t('review9.reason.goal');
  return t('review9.reason.resume');
}

function nextDueText(plan: ReviewDailyPlan, t: (key: TranslationKey) => string, locale: string): string {
  if (!plan.nextDueAt) return t('review9.caughtUpDetail');
  const next = new Date(plan.nextDueAt);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (next.toDateString() === tomorrow.toDateString()) return t('review9.nextTomorrow');
  return t('review9.nextDate').replace('{date}', next.toLocaleDateString(locale));
}
