import { Text, View } from 'react-native';
import { SUPPORTED_LANGUAGES } from '@second-brain/shared';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { useTokens } from '../../lib/design/theme';
import { LanguageFlag } from '../ds/language-flag';
import {
  DemoLabel,
  LandingSection,
  SectionHeading,
  Surface,
} from './landing-foundation';

type PassportStage = {
  label: TranslationKey;
  value: string;
  marker: string | null;
  languageCode?: 'fr' | 'de';
};

/**
 * A deliberately short public illustration of the Learner Passport. It uses
 * no learner data and claims no measured progress: the scene only explains how
 * declared context can stay connected to the Professor and future evidence.
 */
export function LearnerPassportLandingSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const horizontal = width >= 980;
  const stages: PassportStage[] = [
    {
      label: 'passport.originCountry',
      value: 'République démocratique du Congo',
      marker: '🇨🇩',
    },
    {
      label: 'onb.languages.native',
      value: SUPPORTED_LANGUAGES.fr.name,
      marker: null,
      languageCode: 'fr',
    },
    {
      label: 'passport.currentCountry',
      value: 'Deutschland',
      marker: '🇩🇪',
    },
    {
      label: 'passport.teachingLanguage',
      value: `${SUPPORTED_LANGUAGES.de.name} · A2`,
      marker: null,
      languageCode: 'de',
    },
    {
      label: 'onb.academic.field',
      value: t('onb.subj.cs'),
      marker: '⌘',
    },
    {
      label: 'ai.professor',
      value: t('profile.teacher.learning.balanced'),
      marker: '✦',
    },
    {
      label: 'passport.progression',
      value: 'A2 → B1/B2',
      marker: '↗',
    },
  ];

  return (
    <LandingSection tone="soft" compact>
      <SectionHeading
        kicker={t('landing12.passport.kicker')}
        title={t('landing12.passport.title')}
        lead={t('landing12.passport.lead')}
      />
      <Surface style={{ marginTop: 26, padding: horizontal ? 22 : 16 }}>
        <DemoLabel label={t('landing12.passport.demo')} />
        <View
          accessibilityRole="list"
          style={{
            marginTop: 16,
            flexDirection: horizontal ? 'row' : 'column',
            alignItems: horizontal ? 'stretch' : 'center',
            gap: horizontal ? 7 : 5,
          }}
        >
          {stages.map((stage, index) => (
            <View
              key={stage.label}
              style={{
                flex: horizontal ? 1 : undefined,
                width: horizontal ? undefined : '100%',
                flexDirection: horizontal ? 'row' : 'column',
                alignItems: 'center',
                gap: 7,
              }}
            >
              <View
                style={{
                  width: '100%',
                  minHeight: 92,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  borderWidth: 1,
                  borderColor: index >= stages.length - 2 ? c.aiAccent : c.border,
                  backgroundColor: index >= stages.length - 2 ? c.aiAccentSoft : c.surface,
                  borderRadius: radius.lg,
                  paddingHorizontal: 10,
                  paddingVertical: 12,
                }}
              >
                {stage.languageCode ? (
                  <LanguageFlag code={stage.languageCode} size={18} />
                ) : (
                  <Text accessible={false} style={{ fontSize: 18 }}>{stage.marker}</Text>
                )}
                <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'center' }}>
                  {t(stage.label)}
                </Text>
                <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'center' }}>
                  {stage.value}
                </Text>
              </View>
              {index < stages.length - 1 ? (
                <Text accessible={false} style={{ color: c.aiAccent, fontSize: 16, fontWeight: '900' }}>
                  {horizontal ? '→' : '↓'}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </Surface>
    </LandingSection>
  );
}
