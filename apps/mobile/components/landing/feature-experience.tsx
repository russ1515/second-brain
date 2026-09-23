import { Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { CAPABILITY_GROUPS, LANDING_CAPABILITIES } from './landing-content';
import {
  LandingKicker,
  LandingLead,
  LandingPill,
  LandingSection,
  LandingTitle,
  SectionHeading,
  Surface,
} from './landing-foundation';

const k = (key: string) => key as TranslationKey;

export function CapabilityExperience() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const desktop = width >= 940;
  const supportingGroups = CAPABILITY_GROUPS.filter((group) =>
    LANDING_CAPABILITIES.some((capability) => capability.group === group && capability.id !== 'brain' && capability.id !== 'professor'),
  );

  return (
    <LandingSection>
      <View style={{ gap: 12, maxWidth: 800, marginBottom: 30 }}>
        <LandingKicker>{t('landing12.features.kicker')}</LandingKicker>
        <LandingTitle>{t('landing12.features.title')}</LandingTitle>
        <LandingLead>{t('landing12.features.lead')}</LandingLead>
      </View>

      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 16, marginBottom: 20 }}>
        <Surface accent style={{ flex: desktop ? 1.12 : undefined, minHeight: 330 }}>
          <BrainFeature />
        </Surface>
        <Surface style={{ flex: desktop ? 0.88 : undefined, minHeight: 330 }}>
          <ProfessorFeature />
        </Surface>
      </View>

      <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: c.surface }}>
        {supportingGroups.map((group, groupIndex) => {
          const capabilities = LANDING_CAPABILITIES.filter((capability) => capability.group === group && capability.id !== 'brain' && capability.id !== 'professor');
          return (
            <View key={group} style={{ flexDirection: width >= 760 ? 'row' : 'column', borderTopWidth: groupIndex === 0 ? 0 : 1, borderTopColor: c.borderSubtle }}>
              <View style={{ width: width >= 760 ? 190 : '100%', backgroundColor: c.surfaceSunken, paddingVertical: 18, paddingHorizontal: 18, justifyContent: 'center', gap: 4 }}>
                <Text style={{ color: c.aiAccent, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' }}>{t(k(`landing12.features.group.${group}`))}</Text>
                <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t(k(`landing12.features.group.${group}.desc`))}</Text>
              </View>
              <View style={{ flex: 1, flexDirection: width >= 620 ? 'row' : 'column', flexWrap: width >= 620 ? 'wrap' : 'nowrap', padding: 10 }}>
                {capabilities.map((capability) => (
                  <View key={capability.id} style={{ flexGrow: 1, flexBasis: width >= 1100 ? '31%' : width >= 620 ? '46%' : '100%', minWidth: width >= 620 ? 220 : undefined, padding: 10, gap: 7 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.aiAccentSoft, alignItems: 'center', justifyContent: 'center' }}>
                        <Text accessible={false} style={{ color: c.aiAccent, fontSize: 14, fontWeight: '900' }}>{capability.icon}</Text>
                      </View>
                      <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '800', flex: 1 }}>{t(capability.titleKey)}</Text>
                    </View>
                    <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t(capability.descriptionKey)}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LandingPill label={t('landing12.features.researchScope')} icon="⌕" />
        <LandingPill label={t('landing12.features.noWebClaim')} tone="warning" icon="!" />
        <LandingPill label={t('landing12.features.sameContext')} tone="accent" icon="✦" />
      </View>
    </LandingSection>
  );
}

function BrainFeature() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const compact = width < 520;
  const nodes = [
    { key: 'knowledge', tone: c.primary },
    { key: 'connections', tone: c.aiAccent },
    { key: 'strengths', tone: c.success },
    { key: 'fragilities', tone: c.warning },
    { key: 'memory', tone: c.info },
  ];
  return (
    <View style={{ flex: 1, gap: 18 }}>
      <View style={{ gap: 7 }}>
        <LandingKicker>{t('landing12.brain.kicker')}</LandingKicker>
        <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: 25, lineHeight: 31, fontWeight: '800' }}>{t('landing12.brain.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('landing12.brain.lead')}</Text>
      </View>
      <View style={{ flex: 1, minHeight: compact ? 250 : 205, justifyContent: 'center', alignItems: 'center', padding: 8 }}>
        <View style={{ width: compact ? '100%' : 210, borderWidth: 2, borderColor: c.aiAccent, backgroundColor: c.surface, borderRadius: radius.full, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', zIndex: 2 }}>
          <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '900', textAlign: 'center' }}>{t('landing12.brain.center')}</Text>
        </View>
        <View style={{ height: 18, width: 1, backgroundColor: c.borderStrong }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {nodes.map((node) => (
            <View key={node.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 10 }}>
              <View accessible={false} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: node.tone }} />
              <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: '700' }}>{t(k(`landing12.brain.${node.key}`))}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landing12.brain.noScores')}</Text>
    </View>
  );
}

function ProfessorFeature() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, gap: 17 }}>
      <View style={{ gap: 7 }}>
        <LandingKicker>{t('landing12.professor.kicker')}</LandingKicker>
        <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: 25, lineHeight: 31, fontWeight: '800' }}>{t('landing12.professor.title')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('landing12.professor.lead')}</Text>
      </View>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['level', 'goals', 'documents', 'progress'].map((item) => <LandingPill key={item} label={t(k(`landing12.professor.${item}`))} />)}
        </View>
        <View style={{ borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.lg, padding: 14, gap: 8 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800' }}>✦ {t('landing12.professor.identity')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 21 }}>{t('landing12.professor.example')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['explain', 'teach', 'question', 'assess', 'voice'].map((mode) => <LandingPill key={mode} label={t(k(`landing12.professor.mode.${mode}`))} tone="accent" />)}
        </View>
      </View>
    </View>
  );
}

export function PersonalIntelligenceSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const desktop = width >= 900;
  return (
    <LandingSection tone="soft">
      <SectionHeading kicker={t('landing12.personal.kicker')} title={t('landing12.personal.title')} lead={t('landing12.personal.lead')} />
      <View style={{ marginTop: 28, flexDirection: desktop ? 'row' : 'column', gap: 16 }}>
        <View style={{ flex: 1, gap: 12, justifyContent: 'center' }}>
          {['learn', 'understand', 'forget', 'master', 'goals'].map((item, index) => (
            <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: index === 4 ? 0 : 1, borderBottomColor: c.borderSubtle, paddingVertical: 11 }}>
              <Text accessible={false} style={{ color: c.aiAccent, fontSize: 15, fontWeight: '900' }}>+</Text>
              <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '700' }}>{t(k(`landing12.personal.${item}`))}</Text>
            </View>
          ))}
        </View>
        <View style={{ alignSelf: 'center' }}><Text accessible={false} style={{ color: c.aiAccent, fontSize: 24, fontWeight: '900' }}>{desktop ? '→' : '↓'}</Text></View>
        <View style={{ flex: 1.1, minHeight: 270, borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.xl, padding: 22, justifyContent: 'center', alignItems: 'center', gap: 14 }}>
          <BrainConstellation />
          <Text style={{ color: c.textPrimary, fontSize: 21, lineHeight: 27, fontWeight: '900', textAlign: 'center' }}>{t('landing12.personal.twin')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 360 }}>{t('landing12.personal.note')}</Text>
        </View>
      </View>
      <View style={{ marginTop: 18, padding: 18, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: width >= 700 ? 'row' : 'column', gap: 12, alignItems: width >= 700 ? 'center' : 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase' }}>{t('landing12.personal.nbaLabel')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '800', marginTop: 4 }}>{t('landing12.personal.nbaAction')}</Text>
        </View>
        <Text style={{ color: c.textSecondary, maxWidth: 390, fontSize: 12, lineHeight: 18 }}>{t('landing12.personal.nbaReason')}</Text>
      </View>
    </LandingSection>
  );
}

function BrainConstellation() {
  const { colors: c } = useTokens();
  const nodes: Array<{ left: `${number}%`; top: number; size: number; color: string }> = [
    { left: '48%', top: 53, size: 17, color: c.aiAccent },
    { left: '14%', top: 18, size: 11, color: c.primary },
    { left: '77%', top: 14, size: 10, color: c.success },
    { left: '22%', top: 103, size: 12, color: c.info },
    { left: '72%', top: 100, size: 12, color: c.warning },
  ];
  return (
    <View accessible={false} style={{ width: '100%', maxWidth: 330, height: 145, position: 'relative' }}>
      <View style={{ position: 'absolute', left: '20%', top: 69, width: '62%', height: 1, backgroundColor: c.borderStrong, transform: [{ rotate: '-9deg' }] }} />
      <View style={{ position: 'absolute', left: '24%', top: 70, width: '52%', height: 1, backgroundColor: c.borderStrong, transform: [{ rotate: '17deg' }] }} />
      {nodes.map((node, index) => <View key={index} style={{ position: 'absolute', left: node.left, top: node.top, width: node.size, height: node.size, borderRadius: node.size / 2, backgroundColor: node.color }} />)}
    </View>
  );
}
