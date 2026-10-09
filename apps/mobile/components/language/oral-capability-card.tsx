import type {
  LanguageOralCapabilityMatrix,
  LanguageOralCapabilityState,
} from '@second-brain/shared';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Badge, Button, Card } from '../ds/core';

const CAPABILITY_ROWS: ReadonlyArray<{
  key: keyof Pick<
    LanguageOralCapabilityMatrix,
    | 'audioCapture'
    | 'transcription'
    | 'spokenContentEvaluation'
    | 'listeningComprehensionEvaluation'
    | 'orthographyGraphyEvaluation'
    | 'pronunciationAssessment'
  >;
  label: TranslationKey;
}> = [
  { key: 'audioCapture', label: 'rlle.ui.capabilities.audioCapture' },
  { key: 'transcription', label: 'rlle.ui.capabilities.transcription' },
  { key: 'spokenContentEvaluation', label: 'rlle.ui.capabilities.spokenContent' },
  { key: 'listeningComprehensionEvaluation', label: 'rlle.ui.capabilities.listening' },
  { key: 'orthographyGraphyEvaluation', label: 'rlle.ui.capabilities.graphy' },
  { key: 'pronunciationAssessment', label: 'rlle.ui.capabilities.pronunciation' },
];

const STATUS_KEYS: Record<LanguageOralCapabilityState, TranslationKey> = {
  available: 'rlle.ui.capabilities.available',
  'runtime-required': 'rlle.ui.capabilities.runtimeRequired',
  'not-evaluable': 'rlle.ui.capabilities.notEvaluable',
};

export function OralCapabilityCard({
  matrix,
  onProbeCapture,
  probing = false,
}: {
  matrix: LanguageOralCapabilityMatrix;
  onProbeCapture?: () => void;
  probing?: boolean;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const blocked = matrix.activation === 'blocked-capability';

  return (
    <Card style={styles.card} testID="language-oral-capabilities">
      <View style={styles.heading}>
        <Text style={styles.title}>{t('rlle.ui.capabilities.title')}</Text>
        <Badge
          label={t(blocked
            ? 'rlle.ui.capabilities.blocked'
            : 'rlle.ui.capabilities.providerReady')}
          tone={blocked ? 'warning' : 'success'}
        />
      </View>
      <Text style={styles.detail}>{t('rlle.ui.capabilities.detail')}</Text>
      {CAPABILITY_ROWS.map((item) => {
        const state = matrix[item.key];
        return (
          <View key={item.key} style={styles.row} testID={'language-capability-' + item.key}>
            <Text style={styles.label}>{t(item.label)}</Text>
            <Text style={[
              styles.status,
              state === 'available'
                ? styles.available
                : state === 'not-evaluable'
                  ? styles.unavailable
                  : undefined,
            ]}>
              {t(STATUS_KEYS[state])}
            </Text>
          </View>
        );
      })}
      {blocked ? (
        <Text style={styles.warning}>{t('rlle.ui.capabilities.blockedDetail')}</Text>
      ) : null}
      {matrix.audioCapture === 'runtime-required' && onProbeCapture ? (
        <Button
          label={t('rlle.ui.capabilities.checkMicrophone')}
          loading={probing}
          onPress={onProbeCapture}
          variant="secondary"
          testID="language-capability-probe-microphone"
        />
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  card: { gap: 10, borderColor: c.border },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  title: { color: c.textPrimary, fontSize: 16, fontWeight: '700' },
  detail: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    alignItems: 'center',
    borderTopColor: c.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 38,
    paddingTop: 8,
  },
  label: { color: c.textSecondary, flex: 1, fontSize: 13 },
  status: { color: c.textMuted, fontSize: 12, fontWeight: '700' },
  available: { color: c.success },
  unavailable: { color: c.warning },
  warning: { color: c.warning, fontSize: 13, lineHeight: 19 },
});
