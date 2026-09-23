import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { RlleDemoStage } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { publicLanguageOptions, RLLE_PUBLIC_DEMO } from './landing-content';
import {
  DemoLabel,
  LandingButton,
  LandingKicker,
  LandingLead,
  LandingPill,
  LandingSection,
  LandingTitle,
  StageTransition,
  Surface,
  webOnly,
} from './landing-foundation';

const k = (key: string) => key as TranslationKey;

export function LanguageExperience({ onStart }: { onStart: () => void }) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { locale, t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = RLLE_PUBLIC_DEMO.stages[activeIndex];
  const languages = useMemo(() => publicLanguageOptions(locale), [locale]);
  const demoLanguage = languages.find((language) => language.code === RLLE_PUBLIC_DEMO.languageCode);
  const demoLanguageLabel = demoLanguage
    ? demoLanguage.displayName === demoLanguage.nativeName
      ? demoLanguage.nativeName
      : `${demoLanguage.nativeName} · ${demoLanguage.displayName}`
    : RLLE_PUBLIC_DEMO.languageCode.toUpperCase();
  const desktop = width >= 980;
  const next = () => setActiveIndex((activeIndex + 1) % RLLE_PUBLIC_DEMO.stages.length);

  return (
    <LandingSection tone="dark">
      <View style={{ gap: 12, maxWidth: 850, marginBottom: 30 }}>
        <LandingKicker inverse>{t('landing12.languages.kicker')}</LandingKicker>
        <LandingTitle inverse>{t('landing12.languages.title')}</LandingTitle>
        <LandingLead inverse>{t('landing12.languages.lead')}</LandingLead>
      </View>

      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
        <View style={{ width: desktop ? 268 : '100%', gap: 13 }}>
          <Surface style={{ backgroundColor: c.surface, gap: 12 }}>
            <DemoLabel label={t('landing12.demo.label')} />
            <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landing12.languages.demoDisclaimer')}</Text>
            <View style={{ gap: 4 }}>
              <Text style={{ color: c.aiAccent, fontSize: 10, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('landing12.languages.objective')}</Text>
              <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 23, fontWeight: '800' }}>{t('landing12.languages.objectiveValue')}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              <LandingPill label={demoLanguageLabel} tone="accent" icon="◉" />
              <LandingPill label={RLLE_PUBLIC_DEMO.level} />
              <LandingPill label={t('landing12.languages.missionMeeting')} icon="◎" />
            </View>
          </Surface>

          {desktop ? (
            <View style={{ gap: 5 }}>
              {RLLE_PUBLIC_DEMO.stages.map((stage, index) => <LanguageStageTab key={stage} stage={stage} index={index} selected={index === activeIndex} onPress={() => setActiveIndex(index)} />)}
            </View>
          ) : null}
        </View>

        <Surface accent style={{ flex: 1, minHeight: desktop ? 560 : 440 }}>
          {!desktop ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, maxHeight: 60 }} contentContainerStyle={{ alignItems: 'center', gap: 6, paddingBottom: 15 }}>
              {RLLE_PUBLIC_DEMO.stages.map((stage, index) => <LanguageStageTab key={stage} stage={stage} index={index} selected={index === activeIndex} onPress={() => setActiveIndex(index)} compact />)}
            </ScrollView>
          ) : null}
          <StageTransition revision={active}>
            <View accessibilityLiveRegion="polite" style={{ gap: 15 }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c.aiAccent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text accessible={false} style={{ color: c.onAiAccent, fontSize: 12, fontWeight: '900' }}>{activeIndex + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: c.aiAccent, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('landing12.languages.rlle')}</Text>
                  <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: width >= 700 ? 24 : 20, lineHeight: width >= 700 ? 31 : 27, fontWeight: '800' }}>{t(k(`landing12.languages.stage.${active}`))}</Text>
                </View>
              </View>
              <LanguageStageVisual stage={active} />
              <View style={{ flexDirection: width < 500 ? 'column' : 'row', alignItems: width < 500 ? 'stretch' : 'center', gap: 10, paddingTop: 4 }}>
                <Text style={{ flex: 1, color: c.textSecondary, fontSize: 11, lineHeight: 17 }}>{t(k(`landing12.languages.stage.${active}.note`))}</Text>
                <LandingButton compact variant="secondary" label={activeIndex === RLLE_PUBLIC_DEMO.stages.length - 1 ? t('landing12.cta.restart') : t('landing12.cta.next')} onPress={next} icon={activeIndex === RLLE_PUBLIC_DEMO.stages.length - 1 ? '↻' : '→'} />
              </View>
            </View>
          </StageTransition>
        </Surface>
      </View>

      <View style={{ marginTop: 24, flexDirection: width >= 900 ? 'row' : 'column', gap: 16 }}>
        <View style={{ flex: 1, gap: 14, padding: 20, backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border }}>
          <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '800' }}>{t('landing12.languages.courseTitle')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.languages.courseLead')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {['vocabulary', 'grammar', 'verbs', 'conjugation', 'reading', 'writing', 'listening', 'oral', 'pronunciation', 'mediation'].map((strand) => <LandingPill key={strand} label={t(k(`landing12.languages.strand.${strand}`))} />)}
          </View>
        </View>
        <View style={{ flex: 1, gap: 14, padding: 20, backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border }}>
          <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '800' }}>{t('landing12.languages.missionsTitle')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.languages.missionsLead')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            {['travel', 'work', 'studies', 'social'].map((mission) => <LandingPill key={mission} label={t(k(`landing12.languages.mission.${mission}`))} tone="accent" />)}
          </View>
        </View>
      </View>

      <View style={{ marginTop: 24, padding: width >= 700 ? 24 : 16, backgroundColor: c.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border }}>
        <View style={{ gap: 8, marginBottom: 18 }}>
          <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '800' }}>{t('landing12.languages.registryTitle')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.languages.registryLead')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {languages.map((language) => (
            <View key={language.code} accessibilityLabel={`${language.nativeName}, ${language.displayName}`} style={{ flexGrow: 1, flexBasis: width >= 1050 ? '13%' : width >= 660 ? '22%' : '44%', minWidth: width >= 660 ? 135 : 125, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, backgroundColor: c.surfaceSunken, paddingVertical: 9, paddingHorizontal: 10 }}>
              <Text accessible={false} style={{ fontSize: 16 }}>{language.symbol}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '800', writingDirection: language.rtl ? 'rtl' : 'ltr' }}>{language.nativeName}</Text>
                {language.displayName !== language.nativeName ? <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 14 }}>{language.displayName}</Text> : null}
              </View>
            </View>
          ))}
        </View>
        <View style={{ marginTop: 18, alignSelf: 'flex-start' }}><LandingButton label={t('landing12.cta.language')} onPress={onStart} variant="inverse" /></View>
      </View>
    </LandingSection>
  );
}

function LanguageStageTab({ stage, index, selected, onPress, compact = false }: { stage: RlleDemoStage; index: number; selected: boolean; onPress: () => void; compact?: boolean }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={`${index + 1}. ${t(k(`landing12.languages.stage.${stage}`))}`}
      style={({ pressed }) => [
        {
          minHeight: compact ? 40 : 44,
          minWidth: compact ? 114 : undefined,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderWidth: 1,
          borderColor: selected ? c.aiAccent : c.border,
          backgroundColor: selected ? c.aiAccentSoft : c.surface,
          borderRadius: radius.md,
          paddingVertical: 8,
          paddingHorizontal: 10,
          opacity: pressed ? 0.75 : 1,
        },
        webOnly({ cursor: 'pointer' }),
      ]}
    >
      <Text accessible={false} style={{ color: selected ? c.aiAccent : c.textMuted, fontSize: 10, fontWeight: '900' }}>{String(index + 1).padStart(2, '0')}</Text>
      <Text numberOfLines={1} style={{ flex: 1, color: selected ? c.textPrimary : c.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: selected ? '800' : '600' }}>{t(k(`landing12.languages.stage.${stage}`))}</Text>
    </Pressable>
  );
}

function LanguageStageVisual({ stage }: { stage: RlleDemoStage }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const panel = { minHeight: 330, justifyContent: 'center', gap: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.lg, padding: 18 } as const;

  if (stage === 'goal' || stage === 'course' || stage === 'mission') {
    return (
      <View style={panel}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
          <LanguagePathItem label={t('landing12.languages.objectiveValue')} active={stage === 'goal'} icon="◎" />
          <Text accessible={false} style={{ color: c.textMuted }}>→</Text>
          <LanguagePathItem label={`English · ${RLLE_PUBLIC_DEMO.level}`} active={stage === 'course'} icon="◉" />
          <Text accessible={false} style={{ color: c.textMuted }}>→</Text>
          <LanguagePathItem label={t('landing12.languages.missionMeeting')} active={stage === 'mission'} icon="⌁" />
        </View>
        <View style={{ height: 1, backgroundColor: c.borderSubtle, marginVertical: 4 }} />
        <Text style={{ color: c.textPrimary, fontSize: 17, lineHeight: 25, fontWeight: '800' }}>{t(k(`landing12.languages.path.${stage}`))}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t(k(`landing12.languages.path.${stage}.desc`))}</Text>
      </View>
    );
  }

  if (stage === 'conversation') {
    return (
      <View style={panel}>
        <LandingPill label={t('landing12.languages.professorLabel')} tone="accent" icon="✦" />
        <View style={{ alignSelf: 'flex-start', maxWidth: '92%', backgroundColor: c.aiAccentSoft, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.lg, padding: 13 }}>
          <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 23 }}>“Could you explain your proposal to the team?”</Text>
        </View>
        <View style={{ alignSelf: 'flex-end', maxWidth: '88%', backgroundColor: c.primary, borderRadius: radius.lg, padding: 13 }}>
          <Text style={{ color: c.onPrimary, fontSize: 14, lineHeight: 21 }}>“My proposal help the team to work more efficient.”</Text>
        </View>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landing12.languages.transcriptVisible')}</Text>
      </View>
    );
  }

  if (stage === 'gap') {
    return (
      <View style={panel}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <LandingPill label={t('landing12.languages.gapDetected')} tone="warning" icon="!" />
          <LandingPill label={t('rlle.ui.recovery.mistakes')} tone="warning" icon="↻" />
        </View>
        <Text style={{ color: c.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '800' }}>efficient → efficiently</Text>
        <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 21 }}>{t('landing12.languages.gapExplanation')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <LandingPill label={t('landing12.languages.gapGrammar')} />
          <LandingPill label={t('landing12.languages.gapFluency')} />
        </View>
      </View>
    );
  }

  if (stage === 'micro-lesson') {
    return (
      <View style={panel}>
        <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 16, fontWeight: '800', textTransform: 'uppercase' }}>{t('landing12.languages.microLesson')}</Text>
        <Text style={{ color: c.textPrimary, fontSize: 19, lineHeight: 27, fontWeight: '800' }}>{t('landing12.languages.microRule')}</Text>
        <View style={{ backgroundColor: c.surfaceSunken, borderRadius: radius.md, padding: 14, gap: 7 }}>
          <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 21 }}>efficient work → work efficiently</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.languages.microHint')}</Text>
        </View>
      </View>
    );
  }

  if (stage === 'retry') {
    return (
      <View style={panel}>
        <LandingPill label={t('landing12.languages.retryLabel')} tone="accent" icon="↻" />
        <View style={{ alignSelf: 'flex-end', maxWidth: '92%', backgroundColor: c.primary, borderRadius: radius.lg, padding: 14 }}>
          <Text style={{ color: c.onPrimary, fontSize: 15, lineHeight: 23 }}>“My proposal helps the team work more efficiently.”</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View accessible={false} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.success }} />
          <Text style={{ color: c.success, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t('landing12.languages.retryObserved')}</Text>
        </View>
      </View>
    );
  }

  if (stage === 'vocabulary') {
    return (
      <View style={panel}>
        <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '800' }}>{t('landing12.languages.vocabularyTitle')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {['proposal', 'efficiently', 'deadline', 'trade-off'].map((word) => <LandingPill key={word} label={word} tone="accent" />)}
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t('landing12.languages.vocabularyTrace')}</Text>
      </View>
    );
  }

  if (stage === 'review') {
    return (
      <View style={panel}>
        <LandingPill label={t('landing12.languages.reviewLabel')} tone="warning" icon="↻" />
        <Text style={{ color: c.textPrimary, fontSize: 19, lineHeight: 27, fontWeight: '800' }}>{t('landing12.languages.reviewAction')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t('landing12.languages.reviewTrace')}</Text>
      </View>
    );
  }

  return (
    <View style={panel}>
      <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '800' }}>{t('landing12.languages.canDoTitle')}</Text>
      {['introduce', 'restaurant', 'meeting', 'opinion'].map((item, index) => (
        <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text accessible={false} style={{ color: index < 2 ? c.success : c.textMuted, fontSize: 14, fontWeight: '900' }}>{index < 2 ? '✓' : '○'}</Text>
          <Text style={{ color: index < 2 ? c.textPrimary : c.textSecondary, fontSize: 13, lineHeight: 20, fontWeight: index < 2 ? '700' : '500' }}>{t(k(`landing12.languages.canDo.${item}`))}</Text>
        </View>
      ))}
      <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landing12.languages.canDoDisclaimer')}</Text>
    </View>
  );
}

function LanguagePathItem({ label, active, icon }: { label: string; active: boolean; icon: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ flexGrow: 1, flexBasis: 150, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: active ? c.aiAccent : c.border, backgroundColor: active ? c.aiAccentSoft : c.surfaceElevated, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 11 }}>
      <Text accessible={false} style={{ color: active ? c.aiAccent : c.textMuted, fontWeight: '900' }}>{icon}</Text>
      <Text style={{ flex: 1, color: c.textPrimary, fontSize: 11, lineHeight: 16, fontWeight: active ? '800' : '600' }}>{label}</Text>
    </View>
  );
}
