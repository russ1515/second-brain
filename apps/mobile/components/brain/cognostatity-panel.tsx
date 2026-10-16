import type { EvidenceBasedLearningProgress } from '@second-brain/shared';
import { Text, View } from 'react-native';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { deriveCognostatity, type CognostatityIndicatorKey } from '../../lib/brain/cognostatity';
import { useTokens } from '../../lib/design/theme';
import { Card, Progress } from '../ds/core';
import { ResponsiveGrid, Section } from '../ds/layout';

const INDICATOR_ICON: Record<CognostatityIndicatorKey, string> = {
  intelligence: '🧠',
  reflection: '🔍',
  vision: '👁',
  understanding: '💡',
  adaptation: '🔄',
};

export function CognostatityPanel({ progress }: { progress: EvidenceBasedLearningProgress }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const indicators = deriveCognostatity(progress);

  return (
    <Section title={t('brainV1.cognostatity.title')} description={t('brainV1.cognostatity.detail')}>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]} testID="cognostatity-disclaimer">
        {t('brainV1.cognostatity.disclaimer')}
      </Text>
      <ResponsiveGrid maxColumns={3}>
        {indicators.map((indicator) => {
          const title = `${INDICATOR_ICON[indicator.key]} ${t(`brainV1.cognostatity.indicator.${indicator.key}` as TranslationKey)}`;
          return (
            <Card
              key={indicator.key}
              style={{ gap: spacing.sm, minHeight: 150 }}
              testID={`cognostatity-${indicator.key}`}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary, flex: 1 }]}>{title}</Text>
                <Text style={[typography.title, { color: indicator.percent === null ? c.textMuted : c.primary }]}>
                  {indicator.percent === null ? '—' : `${Math.round(indicator.percent)}%`}
                </Text>
              </View>
              {indicator.percent === null ? (
                <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brainV1.cognostatity.insufficient')}</Text>
              ) : (
                <>
                  <Progress value={indicator.percent} />
                  <Text style={[typography.caption, { color: c.textMuted }]}>
                    {t('brainV1.cognostatity.basedOn').replace('{count}', String(indicator.evidenceCount))}
                  </Text>
                </>
              )}
              <Text style={[typography.caption, { color: c.textMuted }]}>
                {t('brainV1.cognostatity.indicatorNote')}
              </Text>
            </Card>
          );
        })}
      </ResponsiveGrid>
    </Section>
  );
}
