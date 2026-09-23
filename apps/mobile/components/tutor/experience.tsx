import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type {
  ExperienceSession,
  TutorMessageBlock,
  TutorMessageView,
} from '@second-brain/shared';
import { indeterminateAIWorkState } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Markdown } from '../markdown';
import { Badge, Button, Card, Progress } from '../ds/core';
import { AIWorkStateIndicator } from '../ds/states';
import { SourceCitation } from '../ds/sources';

const BLOCK_LABEL: Record<TutorMessageBlock['kind'], TranslationKey> = {
  TEXT: 'tutor6.block.text',
  TEACHING_BLOCK: 'tutor6.block.teaching',
  EXAMPLE: 'tutor6.block.example',
  QUESTION: 'tutor6.block.question',
  EXERCISE: 'tutor6.block.exercise',
  QUIZ: 'tutor6.block.quiz',
  SUMMARY: 'tutor6.block.summary',
  SOURCE: 'tutor6.block.source',
  ACTION: 'tutor6.block.action',
  PROGRESS: 'tutor6.block.progress',
};

export type TutorWorkState =
  | 'READY'
  | 'LISTENING'
  | 'TRANSCRIPTION'
  | 'THINKING'
  | 'RESPONSE'
  | 'PAUSED'
  | 'ERROR';

export function TutorAIState({ state }: { state: TutorWorkState }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (state === 'THINKING' || state === 'TRANSCRIPTION') {
    const messageCode = state === 'THINKING' ? 'tutor6.state.thinking' : 'tutor6.state.transcription';
    return (
      <AIWorkStateIndicator
        compact
        message={t(messageCode)}
        work={indeterminateAIWorkState('tutor-turn', state.toLowerCase(), messageCode)}
      />
    );
  }
  const key = `tutor6.state.${state.toLowerCase()}` as TranslationKey;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Text accessible={false} style={{ color: state === 'ERROR' ? c.error : c.aiAccent }}>●</Text>
      <Text style={[typography.caption, { color: state === 'ERROR' ? c.error : c.textMuted }]}>{t(key)}</Text>
    </View>
  );
}

export function TutorMessage({
  message,
  onOpenSource,
  trailing,
}: {
  message: TutorMessageView;
  onOpenSource?: (documentId: string) => void;
  trailing?: ReactNode;
}) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const mine = message.role === 'user';
  const blocks = message.blocks?.length
    ? message.blocks
    : [{ kind: 'TEXT' as const, content: message.content }];
  if (mine) {
    return (
      <View style={{ alignItems: 'flex-end' }}>
        <Card style={{ maxWidth: 760, backgroundColor: c.surfaceSunken, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text style={[typography.label, { color: c.textMuted }]}>{t('tutor.you')}</Text>
            {message.viaVoice ? <Badge label={t('tutor.spoken')} tone="neutral" /> : null}
          </View>
          <Text style={[typography.body, { color: c.textPrimary }]}>{message.content}</Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.sm, maxWidth: 820 }}>
      <Text style={[typography.label, { color: c.aiAccent }]}>{t('tutor.teacher')}</Text>
      {blocks.map((block, index) => {
        if (block.kind === 'SOURCE' && block.citation) {
          return (
            <SourceCitation
              key={`${message.id}-source-${index}`}
              title={block.citation.documentTitle}
              kind="document"
              index={index + 1}
              onPress={onOpenSource ? () => onOpenSource(block.citation!.documentId) : undefined}
              compact={false}
            />
          );
        }
        const emphasized = ['QUESTION', 'EXERCISE', 'QUIZ', 'SUMMARY', 'ACTION', 'PROGRESS'].includes(block.kind);
        return (
          <View
            key={`${message.id}-${block.kind}-${index}`}
            style={{
              gap: spacing.xs,
              padding: emphasized ? spacing.md : 0,
              borderRadius: radius.md,
              borderWidth: emphasized ? 1 : 0,
              borderColor: emphasized ? c.border : 'transparent',
              backgroundColor: emphasized ? c.surface : 'transparent',
            }}
          >
            {block.kind !== 'TEXT' || block.title ? (
              <Text style={[typography.label, { color: c.textSecondary }]}>
                {block.title ?? t(BLOCK_LABEL[block.kind])}
              </Text>
            ) : null}
            <Markdown text={block.content} />
          </View>
        );
      })}
      {trailing}
    </View>
  );
}

export function ProgressNarrative({ session }: { session: ExperienceSession }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const progress = session.progress;
  const changes = session.twinImpact?.changes ?? [];
  if (!progress && changes.length === 0) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text style={[typography.title, { color: c.textPrimary }]}>{t('tutor6.progress.title')}</Text>
      {progress ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
            {progress.total !== undefined
              ? t('tutor6.progress.count').replace('{done}', String(progress.completed)).replace('{total}', String(progress.total))
              : t('tutor6.progress.completed').replace('{done}', String(progress.completed))}
          </Text>
          {progress.percent !== undefined ? <Progress value={progress.percent} tone="ai" /> : null}
        </View>
      ) : null}
      {changes.map((change, index) => (
        <Text key={`${change.kind}-${change.referenceId ?? index}`} style={[typography.bodySmall, { color: c.textSecondary }]}>
          {change.label ?? t(`tutor6.impact.${change.kind}` as TranslationKey)}
          {change.before !== undefined && change.after !== undefined ? ` · ${change.before} → ${change.after}` : ''}
        </Text>
      ))}
    </Card>
  );
}

export interface ResultAction {
  id: string;
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function ResultActionBar({ actions }: { actions: readonly ResultAction[] }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (actions.length === 0) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('tutor6.result.title')}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('tutor6.result.detail')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {actions.slice(0, 3).map((action, index) => (
          <Button
            key={action.id}
            label={action.label}
            variant={action.variant ?? (index === 0 ? 'primary' : 'secondary')}
            onPress={action.onPress}
          />
        ))}
      </View>
    </Card>
  );
}
