import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TranslationKey } from '../../lib/i18n';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { PUBLIC_CAPABILITIES, publicStatusLabel } from '../landing/capabilities.registry';

const DEMO_STEP_MS = 1_400;

interface DemoStage {
  icon: string;
  titleKey: TranslationKey;
  detailKey: TranslationKey;
  phaseKey: TranslationKey;
  detailVars?: Record<string, string | number>;
  detailLiteral?: string;
  decision?: boolean;
}

const DEMO_STAGES: readonly DemoStage[] = [
  {
    icon: '▣',
    titleKey: 'learn5.capture.scan',
    detailKey: 'learn5.capture.detail',
    phaseKey: 'workspaceProfessor.phase.CAPTURE',
  },
  {
    icon: '⌁',
    titleKey: 'workspaceOrchestrator.family.assignment',
    detailKey: 'workspaceOrchestrator.reason.assignment-exercises',
    phaseKey: 'workspaceProfessor.phase.COMPREHENSION',
  },
  {
    icon: '✦',
    titleKey: 'landing12.professor.title',
    detailKey: 'landingV1.demo.professorPrompt',
    phaseKey: 'workspaceProfessor.phase.METHOD',
  },
  {
    icon: '⌕',
    titleKey: 'landing12.story.workspace.citation',
    detailKey: 'landingV1.demo.formulaFound',
    phaseKey: 'workspaceProfessor.phase.WORK',
  },
  {
    icon: '●',
    titleKey: 'landing12.story.oral.answer',
    detailKey: 'lesson.yourAnswer',
    detailLiteral: 'm = 2 kg · a = 3 m/s² · F = 6 N',
    phaseKey: 'workspaceProfessor.phase.COACHING',
  },
  {
    icon: '✓',
    titleKey: 'landingV1.demo.suggestionGap',
    detailKey: 'landingV1.demo.suggestionSource',
    phaseKey: 'workspaceProfessor.phase.VERIFICATION',
    decision: true,
  },
  {
    icon: '↻',
    titleKey: 'workspace10.save.saved',
    detailKey: 'workspace10.resumeDetail',
    phaseKey: 'workspaceProfessor.phase.DECONSTRUCTION',
  },
] as const;

const PROFESSOR_PHASES: readonly TranslationKey[] = [
  'workspaceProfessor.phase.COMPREHENSION',
  'workspaceProfessor.phase.METHOD',
  'workspaceProfessor.phase.WORK',
  'workspaceProfessor.phase.COACHING',
  'workspaceProfessor.phase.VERIFICATION',
  'workspaceProfessor.phase.FINALIZATION',
  'workspaceProfessor.phase.DECONSTRUCTION',
];

/**
 * Deterministic public product walkthrough for the signup page.
 *
 * It uses no account data and calls no service. The seven frames form a subtle
 * 9.8-second loop. With reduced
 * motion, every frame is presented together so no information depends on
 * animation.
 */
export function SignupProductDemo({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, reducedMotion } = useTokens();
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const format = (key: TranslationKey, vars: Record<string, string | number> = {}) =>
    Object.entries(vars).reduce(
      (value, [name, replacement]) => value.replace(`{${name}}`, String(replacement)),
      t(key),
    );

  useEffect(() => {
    if (reducedMotion || !playing) return undefined;
    const timer = setTimeout(
      () => setActiveIndex((current) => (current + 1) % DEMO_STAGES.length),
      DEMO_STEP_MS,
    );
    return () => clearTimeout(timer);
  }, [activeIndex, playing, reducedMotion]);

  const visibleStages = useMemo(
    () => reducedMotion ? DEMO_STAGES : [DEMO_STAGES[activeIndex]],
    [activeIndex, reducedMotion],
  );
  const voiceStatus = publicStatusLabel(PUBLIC_CAPABILITIES.voice.status, t);

  return (
    <View
      testID="signup-product-demo"
      accessibilityLabel={t('landing12.demo.label')}
      style={{
        gap: compact ? spacing.sm : spacing.md,
        padding: compact ? spacing.md : spacing.lg,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' }}>
          {t('landing12.demo.label')}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 16 }}>
          {t('landing12.demo.disclaimer')}
        </Text>
      </View>

      {!reducedMotion ? (
        <View style={{ gap: 8 }}>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: DEMO_STAGES.length, now: activeIndex + 1 }} style={{ flexDirection: 'row', gap: 5 }}>
            {DEMO_STAGES.map((_, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: radius.full,
                  backgroundColor: index <= activeIndex ? c.primary : c.borderSubtle,
                }}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? t('voice11.pause') : t('voice11.resume')}
            onPress={() => setPlaying((value) => !value)}
            style={{ alignSelf: 'flex-end', minHeight: 28, justifyContent: 'center' }}
          >
            <Text style={{ color: c.primary, fontSize: 10, fontWeight: '800' }}>
              {playing ? t('voice11.pause') : t('voice11.resume')}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ gap: compact ? 7 : 10 }}>
        {visibleStages.map((stage) => (
          <View
            key={stage.titleKey}
            testID={`signup-demo-stage-${stage.titleKey}`}
            style={{
              minHeight: reducedMotion ? undefined : compact ? 108 : 126,
              gap: 8,
              padding: compact ? 11 : 14,
              borderRadius: radius.md,
              backgroundColor: c.surfaceElevated,
              borderWidth: 1,
              borderColor: c.borderSubtle,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: c.primary, fontSize: 18 }}>{stage.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: c.textPrimary, fontSize: compact ? 13 : 14, fontWeight: '800' }}>
                  {t(stage.titleKey)}
                </Text>
                <Text style={{ color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                  {t(stage.phaseKey)}
                </Text>
              </View>
            </View>
            <Text style={{ color: c.textSecondary, fontSize: compact ? 11 : 12, lineHeight: compact ? 16 : 18 }}>
              {stage.detailLiteral ?? format(stage.detailKey, stage.detailVars)}
            </Text>
            {stage.decision ? (
              <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
                <View style={{ borderRadius: radius.full, backgroundColor: c.primary, paddingVertical: 5, paddingHorizontal: 10 }}>
                  <Text style={{ color: c.onPrimary, fontSize: 10, fontWeight: '800' }}>{t('landingV1.action.apply')}</Text>
                </View>
                <View style={{ borderRadius: radius.full, borderWidth: 1, borderColor: c.border, paddingVertical: 5, paddingHorizontal: 10 }}>
                  <Text style={{ color: c.textSecondary, fontSize: 10, fontWeight: '700' }}>{t('landingV1.action.reject')}</Text>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {!compact ? (
        <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }} accessibilityLabel={t('landing12.professor.title')}>
          {PROFESSOR_PHASES.map((phase) => (
            <View key={phase} style={{ borderRadius: radius.full, borderWidth: 1, borderColor: c.borderSubtle, paddingVertical: 4, paddingHorizontal: 8 }}>
              <Text style={{ color: c.textMuted, fontSize: 9, fontWeight: '700' }}>{t(phase)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <DemoFact label={`${t('landing.academic.title')} V1 · ${publicStatusLabel(PUBLIC_CAPABILITIES.academicWorkspace.status, t)}`} />
        <DemoFact label={`${t('landing12.feature.professor.title')} · ${publicStatusLabel(PUBLIC_CAPABILITIES.professor.status, t)}`} />
        <DemoFact label={`${t('languageSelector.nativeLabel')} ↔ ${t('languageSelector.learningLabel')} · ${publicStatusLabel(PUBLIC_CAPABILITIES.languages.status, t)}`} />
        <DemoFact label={`${t('landing12.feature.voice.title')} · ${voiceStatus}`} />
        <DemoFact label={t('workspace10.resume')} />
      </View>
    </View>
  );
}

function DemoFact({ label }: { label: string }) {
  const { colors: c, radius } = useTokens();
  return (
    <View style={{ borderRadius: radius.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSunken, paddingVertical: 4, paddingHorizontal: 8 }}>
      <Text style={{ color: c.textSecondary, fontSize: 9, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}
