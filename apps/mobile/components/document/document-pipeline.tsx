import { ActivityIndicator, Text, View } from 'react-native';
import {
  resolveDocumentPipeline,
  type DocumentPipelinePhase,
  type DocumentStatus,
  type PipelineStage,
} from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Progress } from '../ds/core';

const PHASES: DocumentPipelinePhase[] = [
  'queued',
  'reading',
  'extracting',
  'indexing',
  'connecting',
  'completed',
];

const PHASE_KEY: Record<DocumentPipelinePhase, TranslationKey> = {
  queued: 'document.pipeline.queued',
  reading: 'document.pipeline.reading',
  extracting: 'document.pipeline.extracting',
  indexing: 'document.pipeline.indexing',
  connecting: 'document.pipeline.connecting',
  completed: 'document.pipeline.completed',
  failed: 'document.pipeline.failed',
};

export function DocumentPipeline({
  status,
  stage,
  error,
  onRetry,
  compact = false,
}: {
  status: DocumentStatus;
  stage: PipelineStage | null;
  error?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const { colors: c, radius, spacing, typography, reducedMotion } = useTokens();
  const { t } = useI18n();
  const state = resolveDocumentPipeline(status, stage);
  const activeIndex = state.phase === 'failed'
    ? -1
    : PHASES.indexOf(state.phase);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t(PHASE_KEY[state.phase])}
      accessibilityValue={state.progress.mode === 'determinate'
        ? { min: 0, max: 100, now: state.progress.percent }
        : { text: t(PHASE_KEY[state.phase]) }}
      style={{ gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {status === 'processing' || status === 'pending' ? (
          reducedMotion
            ? <Text style={{ color: c.aiAccent, fontSize: 18 }}>●</Text>
            : <ActivityIndicator color={c.aiAccent} />
        ) : <Text style={{ color: status === 'failed' ? c.error : c.success, fontSize: 18 }}>{status === 'failed' ? '!' : '✓'}</Text>}
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>
            {t(PHASE_KEY[state.phase])}
          </Text>
          {state.progress.mode === 'indeterminate' && status !== 'failed' ? (
            <Text style={[typography.caption, { color: c.textMuted }]}>{t('document.pipeline.noEstimate')}</Text>
          ) : null}
        </View>
        {state.progress.mode === 'determinate' ? (
          <Text style={[typography.caption, { color: c.textMuted }]}>{state.progress.percent}%</Text>
        ) : null}
      </View>

      {!compact && status !== 'failed' ? (
        <View style={{ gap: spacing.xs }}>
          {PHASES.map((phase, index) => {
            const done = status === 'ready' || index < activeIndex;
            const active = index === activeIndex && status !== 'ready';
            return (
              <View key={phase} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 30 }}>
                <View style={{ width: 18, height: 18, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? c.successSoft : active ? c.aiAccentSoft : c.surfaceSunken }}>
                  <Text style={[typography.caption, { color: done ? c.success : active ? c.aiAccent : c.textMuted }]}>{done ? '✓' : active ? '●' : '·'}</Text>
                </View>
                <Text style={[typography.bodySmall, { color: done || active ? c.textPrimary : c.textMuted }]}>{t(PHASE_KEY[phase])}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {state.progress.mode === 'determinate' ? <Progress value={state.progress.percent} color={c.success} /> : null}
      {status === 'failed' ? (
        <View style={{ gap: spacing.sm }}>
          {error ? <Text style={[typography.bodySmall, { color: c.error }]}>{error}</Text> : null}
          {state.canRetry && onRetry ? <Button label={t('document.pipeline.retry')} variant="secondary" size="sm" onPress={onRetry} /> : null}
        </View>
      ) : null}
    </View>
  );
}
