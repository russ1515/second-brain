import type {
  EvidenceBasedLearningProgress,
  LearningEvidenceDimension,
} from '@second-brain/shared';
import { Text, View } from 'react-native';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Button, Card, Progress } from '../ds/core';

const DIMENSION_KEYS: Record<LearningEvidenceDimension, TranslationKey> = {
  knowledge: 'globalPath.evidence.knowledge',
  understanding: 'globalPath.evidence.understanding',
  application: 'globalPath.evidence.application',
  reasoning: 'globalPath.evidence.reasoning',
  critical_reflection: 'globalPath.evidence.criticalReflection',
  perspective: 'globalPath.evidence.perspective',
};

export function EvidenceProgressPanel({
  progress,
  compact = false,
  onOpen,
}: {
  progress: EvidenceBasedLearningProgress;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { t, formatLocale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();

  return (
    <Card style={{ gap: spacing.md }} testID={compact ? 'home-evidence-progress' : 'brain-evidence-progress'}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[compact ? typography.title : typography.h2, { color: c.textPrimary }]}>
          {t('globalPath.evidence.title')}
        </Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('globalPath.evidence.detail')}</Text>
        <Text style={[typography.caption, { color: c.textMuted }]}>
          {progress.completedCount} · {t('globalPath.evidence.completedCount')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {progress.dimensions.map((dimension) => (
          <View
            key={dimension.dimension}
            style={{ flexGrow: 1, flexBasis: compact ? 190 : 250, minWidth: 0, gap: spacing.xs }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
              <Text style={[typography.label, { color: c.textPrimary, flex: 1 }]}>{t(DIMENSION_KEYS[dimension.dimension])}</Text>
              <Text style={[typography.label, { color: dimension.percent === null ? c.textMuted : c.primary }]}>
                {dimension.percent === null ? t('globalPath.evidence.notEvaluated') : `${Math.round(dimension.percent)}%`}
              </Text>
            </View>
            {dimension.percent === null ? null : <Progress value={dimension.percent} />}
            {!compact && dimension.evaluatedEvidenceCount > 0 ? (
              <Text style={[typography.caption, { color: c.textMuted }]}>
                {dimension.evaluatedEvidenceCount} · {t('globalPath.evidence.evidenceCount')}
                {dimension.latestEvidenceAt
                  ? ` · ${new Date(dimension.latestEvidenceAt).toLocaleDateString(formatLocale, { dateStyle: 'medium' })}`
                  : ''}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {onOpen ? <Button label={t('home4.progress.open')} variant="ghost" onPress={onOpen} /> : null}
    </Card>
  );
}
