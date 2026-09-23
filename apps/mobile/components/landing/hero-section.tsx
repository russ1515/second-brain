import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import {
  DemoLabel,
  LANDING_CONTENT_MAX,
  LandingButton,
  LandingPill,
  StageTransition,
  Surface,
  useLandingGutter,
  webOnly,
} from './landing-foundation';

const k = (key: string) => key as TranslationKey;

export function LandingHero({
  onStart,
  onHow,
  onDownload,
}: {
  onStart: () => void;
  onHow: () => void;
  onDownload: () => void;
}) {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const gutter = useLandingGutter();
  const desktop = width >= 980;
  const compact = width < 520;

  return (
    <View style={{ width: '100%', overflow: 'hidden', backgroundColor: c.background }}>
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: -260,
            left: desktop ? '30%' : -170,
            width: 760,
            height: 760,
            borderRadius: 380,
            backgroundColor: c.aiAccent,
            opacity: 0.09,
          },
          webOnly({ filter: 'blur(140px)' }),
        ]}
      />
      <View
        style={{
          width: '100%',
          maxWidth: LANDING_CONTENT_MAX,
          alignSelf: 'center',
          paddingHorizontal: gutter,
          paddingTop: desktop ? 86 : 48,
          paddingBottom: desktop ? 86 : 58,
          flexDirection: desktop ? 'row' : 'column',
          alignItems: 'center',
          gap: desktop ? 58 : 38,
        }}
      >
        <View style={{ flex: desktop ? 0.96 : undefined, width: '100%', gap: compact ? 18 : 22, alignItems: desktop ? 'flex-start' : 'center' }}>
          <View style={{ borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 13 }}>
            <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' }}>{t('landing12.hero.eyebrow')}</Text>
          </View>
          <Text
            accessibilityRole="header"
            style={{
              color: c.textPrimary,
              maxWidth: 650,
              fontSize: desktop ? 58 : width >= 600 ? 47 : 38,
              lineHeight: desktop ? 64 : width >= 600 ? 54 : 44,
              letterSpacing: -1.1,
              fontWeight: '900',
              textAlign: desktop ? 'left' : 'center',
            }}
          >
            {t('landing12.hero.title')}
          </Text>
          <Text style={{ color: c.textSecondary, maxWidth: 610, fontSize: desktop ? 19 : 17, lineHeight: desktop ? 29 : 26, textAlign: desktop ? 'left' : 'center' }}>
            {t('landing12.hero.subtitle')}
          </Text>
          <View style={{ flexDirection: compact ? 'column' : 'row', width: compact ? '100%' : undefined, gap: 10, alignItems: 'stretch', justifyContent: desktop ? 'flex-start' : 'center' }}>
            <LandingButton label={t('landing12.cta.start')} onPress={onStart} />
            <LandingButton label={t('landing12.cta.how')} onPress={onHow} variant="secondary" />
          </View>
          <Pressable
            onPress={onDownload}
            accessibilityRole="link"
            accessibilityLabel={t('landing12.cta.download')}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.65 : 1 })}
          >
            <Text style={{ color: c.aiAccent, fontSize: 14, lineHeight: 20, fontWeight: '700', textAlign: desktop ? 'left' : 'center' }}>{t('landing12.cta.download')} ↓</Text>
          </Pressable>
          <View style={{ gap: 8, alignItems: desktop ? 'flex-start' : 'center' }}>
            <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '700', textAlign: desktop ? 'left' : 'center' }}>{t('landing12.hero.availability')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: desktop ? 'flex-start' : 'center' }}>
              {['web', 'android', 'ios', 'windows', 'macos'].map((id) => (
                <LandingPill key={id} label={t(k(`landing12.platform.${id}`))} tone={id === 'web' ? 'success' : 'neutral'} />
              ))}
            </View>
          </View>
        </View>
        <View style={{ flex: desktop ? 1.04 : undefined, width: '100%', maxWidth: desktop ? 650 : 680 }}>
          <HeroProductScene />
        </View>
      </View>
    </View>
  );
}

type HeroStage = 'question' | 'context' | 'teaching' | 'next';

function HeroProductScene() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const [active, setActive] = useState<HeroStage>('question');
  const stages: readonly HeroStage[] = ['question', 'context', 'teaching', 'next'];
  const narrow = width < 520;

  return (
    <Surface style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, backgroundColor: c.surfaceSunken, paddingHorizontal: 16, paddingVertical: 11 }}>
        <View style={{ flexDirection: 'row', gap: 5 }}>
          {[c.error, c.warning, c.success].map((color) => <View key={color} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, opacity: 0.85 }} />)}
        </View>
        <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1 }}>{t('landing12.hero.scene.product')}</Text>
        <View style={{ flex: 1 }} />
        <DemoLabel label={t('landing12.demo.label')} />
      </View>
      <View style={{ padding: narrow ? 14 : 20, gap: 16 }}>
        <View accessibilityLabel={t('landing12.hero.scene.tabsLabel')} style={{ flexDirection: 'row', gap: 6 }}>
          {stages.map((stage, index) => {
            const selected = active === stage;
            return (
              <Pressable
                key={stage}
                onPress={() => setActive(stage)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                aria-selected={selected}
                accessibilityLabel={t(k(`landing12.hero.scene.${stage}.tab`))}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 40,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: selected ? c.aiAccent : c.borderSubtle,
                  backgroundColor: selected ? c.aiAccentSoft : c.surface,
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: selected ? c.aiAccent : c.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '800' }}>{index + 1}</Text>
              </Pressable>
            );
          })}
        </View>
        <StageTransition revision={active}>
          <HeroStagePanel stage={active} />
        </StageTransition>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
          {stages.map((stage, index) => (
            <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Text style={{ color: active === stage ? c.textPrimary : c.textMuted, fontSize: 11, lineHeight: 15, fontWeight: active === stage ? '800' : '600' }}>{t(k(`landing12.hero.scene.${stage}.tab`))}</Text>
              {index < stages.length - 1 ? <Text accessible={false} style={{ color: c.borderStrong }}>→</Text> : null}
            </View>
          ))}
        </View>
      </View>
    </Surface>
  );
}

function HeroStagePanel({ stage }: { stage: HeroStage }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const base = { minHeight: 245, borderRadius: radius.lg, padding: 18 } as const;

  if (stage === 'question') {
    return (
      <View accessibilityLiveRegion="polite" style={[base, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 16, justifyContent: 'center' }]}>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('landing12.hero.scene.question.title')}</Text>
        <View style={{ alignSelf: 'flex-end', maxWidth: '92%', backgroundColor: c.primary, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 15 }}>
          <Text style={{ color: c.onPrimary, fontSize: 15, lineHeight: 22, fontWeight: '600' }}>{t('landing12.hero.scene.question.message')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <LandingPill label={t('landing12.hero.scene.question.intent')} tone="accent" icon="✦" />
          <LandingPill label={t('landing12.hero.scene.question.source')} icon="▤" />
        </View>
      </View>
    );
  }

  if (stage === 'context') {
    return (
      <View accessibilityLiveRegion="polite" style={[base, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 14 }]}>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('landing12.hero.scene.context.title')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <LandingPill label={t('landing12.hero.scene.context.brain')} tone="accent" icon="◉" />
          <LandingPill label={t('landing12.hero.scene.context.document')} icon="▤" />
          <LandingPill label={t('landing12.hero.scene.context.goal')} icon="◎" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
          <View style={{ height: 1, backgroundColor: c.border }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 13, height: 13, borderRadius: 7, backgroundColor: c.aiAccent }} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800' }}>{t('landing12.hero.scene.context.concept')}</Text>
              <Text style={{ color: c.warning, fontSize: 12, lineHeight: 17, fontWeight: '700' }}>{t('landing12.hero.scene.context.fragile')}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (stage === 'teaching') {
    return (
      <View accessibilityLiveRegion="polite" style={[base, { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, gap: 13 }]}>
        <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>✦ {t('landing12.hero.scene.teaching.title')}</Text>
        <View style={{ backgroundColor: c.aiAccentSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: c.aiAccent, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 21 }}>{t('landing12.hero.scene.teaching.message')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          <LandingPill label={t('landing12.hero.scene.teaching.explain')} tone="accent" />
          <LandingPill label={t('landing12.hero.scene.teaching.practice')} />
          <LandingPill label={t('landing12.hero.scene.teaching.voice')} />
        </View>
      </View>
    );
  }

  return (
    <View accessibilityLiveRegion="polite" style={[base, { backgroundColor: c.aiAccentSoft, borderWidth: 1, borderColor: c.aiAccent, gap: 14, justifyContent: 'center' }]}>
      <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('landing12.hero.scene.next.title')}</Text>
      <Text style={{ color: c.textPrimary, fontSize: 20, lineHeight: 27, fontWeight: '800' }}>{t('landing12.hero.scene.next.action')}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('landing12.hero.scene.next.reason')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.success }} />
        <Text style={{ color: c.success, fontSize: 12, lineHeight: 17, fontWeight: '800' }}>{t('landing12.hero.scene.next.context')}</Text>
      </View>
    </View>
  );
}
