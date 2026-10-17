import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { localeDirection, useI18n, type TranslationKey } from '../../lib/i18n';
import { capability, publicStatusLabel } from './capabilities.registry';
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

type ProductDemoStageId =
  | 'capture'
  | 'classify'
  | 'understand'
  | 'source'
  | 'answer'
  | 'suggestion'
  | 'verify'
  | 'deconstruct'
  | 'export';

interface ProductDemoStage {
  id: ProductDemoStageId;
  icon: string;
  shortKey: TranslationKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
}

const PRODUCT_DEMO_STAGES: readonly ProductDemoStage[] = [
  {
    id: 'capture',
    icon: '▣',
    shortKey: 'learn5.capture.photo',
    titleKey: 'landing12.story.documents.title',
    descriptionKey: 'landingV1.demo.detectedHomework',
  },
  {
    id: 'classify',
    icon: '◎',
    shortKey: 'workspaceOrchestrator.family.assignment',
    titleKey: 'workspaceOrchestrator.family.assignment',
    descriptionKey: 'workspaceOrchestrator.reason.assignment-exercises',
  },
  {
    id: 'understand',
    icon: '✦',
    shortKey: 'workspaceProfessor.phase.COMPREHENSION',
    titleKey: 'landing12.story.professor.title',
    descriptionKey: 'landingV1.demo.professorPrompt',
  },
  {
    id: 'source',
    icon: '[1]',
    shortKey: 'lib.ask.sources',
    titleKey: 'landing12.story.workspace.citation',
    descriptionKey: 'landingV1.demo.formulaFound',
  },
  {
    id: 'answer',
    icon: '✎',
    shortKey: 'lesson.yourAnswer',
    titleKey: 'landing12.story.oral.transcript',
    descriptionKey: 'landing12.story.oral.note',
  },
  {
    id: 'suggestion',
    icon: '↗',
    shortKey: 'workspace10.assist.suggest',
    titleKey: 'landingV1.demo.suggestionGap',
    descriptionKey: 'landingV1.demo.suggestionSource',
  },
  {
    id: 'verify',
    icon: '✓',
    shortKey: 'workspaceProfessor.phase.VERIFICATION',
    titleKey: 'onb.sup.verify',
    descriptionKey: 'research10.plan.verify',
  },
  {
    id: 'deconstruct',
    icon: '◇',
    shortKey: 'workspaceProfessor.phase.DECONSTRUCTION',
    titleKey: 'workspaceProfessor.phase.DECONSTRUCTION',
    descriptionKey: 'landingV1.demo.deconstruction',
  },
  {
    id: 'export',
    icon: '⇩',
    shortKey: 'learn5.modality.export',
    titleKey: 'landing12.story.workspace.title',
    descriptionKey: 'workspace10.resumeDetail',
  },
] as const;

const AUTO_STEP_MS = 3_300;

export function ProductStory() {
  const { colors: c, radius, reducedMotion } = useTokens();
  const { width } = useResponsive();
  const { locale, t } = useI18n();
  const rtl = localeDirection(locale) === 'rtl';
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const desktop = width >= 1000;
  const current = PRODUCT_DEMO_STAGES[activeIndex];
  const isLast = activeIndex === PRODUCT_DEMO_STAGES.length - 1;

  useEffect(() => {
    if (reducedMotion || !playing) return undefined;
    const timer = setTimeout(() => {
      if (isLast) {
        setPlaying(false);
        return;
      }
      setActiveIndex((index) => Math.min(index + 1, PRODUCT_DEMO_STAGES.length - 1));
    }, AUTO_STEP_MS);
    return () => clearTimeout(timer);
  }, [activeIndex, isLast, playing, reducedMotion]);

  const selectStage = (index: number) => {
    setActiveIndex(index);
    setPlaying(false);
  };

  const previous = () => {
    setPlaying(false);
    setActiveIndex((index) => Math.max(index - 1, 0));
  };

  const next = () => {
    if (isLast) {
      setActiveIndex(0);
      setPlaying(!reducedMotion);
      return;
    }
    setActiveIndex((index) => index + 1);
  };

  const togglePlayback = () => {
    if (isLast) setActiveIndex(0);
    setPlaying((value) => !value);
  };

  return (
    <LandingSection tone="soft">
      <View style={{ gap: 12, maxWidth: 820, marginBottom: 30 }}>
        <LandingKicker>{t('landing12.story.kicker')}</LandingKicker>
        <LandingTitle>{t('landing12.story.title')}</LandingTitle>
        <LandingLead>{t('landing12.story.lead')}</LandingLead>
      </View>

      <Surface style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: width >= 600 ? 22 : 15, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottomWidth: 1, borderBottomColor: c.borderSubtle, backgroundColor: c.surface }}>
          <DemoLabel label={t('landing12.demo.label')} />
          <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, flex: 1, minWidth: 210 }}>{t('landing12.demo.disclaimer')}</Text>
        </View>

        {reducedMotion ? (
          <StaticProductJourney />
        ) : (
          <View style={{ flexDirection: desktop ? 'row' : 'column', minHeight: desktop ? 560 : undefined }}>
            {desktop ? (
              <View accessibilityRole="tablist" style={{ width: 258, borderRightWidth: 1, borderRightColor: c.borderSubtle, padding: 14, gap: 6, backgroundColor: c.surfaceSunken }}>
                {PRODUCT_DEMO_STAGES.map((stage, index) => (
                  <StoryTab key={stage.id} stage={stage} index={index} selected={index === activeIndex} onPress={() => selectStage(index)} vertical />
                ))}
              </View>
            ) : (
              <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
                {PRODUCT_DEMO_STAGES.map((stage, index) => (
                  <StoryTab key={stage.id} stage={stage} index={index} selected={index === activeIndex} onPress={() => selectStage(index)} />
                ))}
              </View>
            )}

            <View accessibilityLiveRegion="polite" style={{ flex: 1, padding: width >= 700 ? 28 : 16, gap: 20 }}>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 1, max: PRODUCT_DEMO_STAGES.length, now: activeIndex + 1 }}
                style={{ height: 4, borderRadius: radius.full, backgroundColor: c.surfaceSunken, overflow: 'hidden' }}
              >
                <View style={{ width: `${((activeIndex + 1) / PRODUCT_DEMO_STAGES.length) * 100}%`, height: '100%', backgroundColor: c.aiAccent }} />
              </View>

              <StageTransition revision={current.id}>
                <View style={{ gap: 18 }}>
                  <View style={{ gap: 7 }}>
                    <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>{current.icon} {t(current.shortKey)}</Text>
                    <Text accessibilityRole="header" aria-level={3} style={{ color: c.textPrimary, fontSize: width >= 700 ? 28 : 23, lineHeight: width >= 700 ? 35 : 29, fontWeight: '800' }}>{t(current.titleKey)}</Text>
                    <Text style={{ color: c.textSecondary, maxWidth: 720, fontSize: 14, lineHeight: 22 }}>{t(current.descriptionKey)}</Text>
                  </View>
                  <StoryVisual stage={current.id} autoApply={playing} />
                </View>
              </StageTransition>

              <PersistenceNote />

              <View style={{ flexDirection: width < 560 ? 'column' : 'row', alignItems: width < 560 ? 'stretch' : 'center', gap: 10, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 16 }}>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                  <LandingPill label={t('landing12.story.sharedContext')} tone="accent" icon="✦" />
                  <LandingPill label={t('landing12.story.traceability')} icon="↗" />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <LandingButton compact variant="quiet" label={t('lesson.previous')} onPress={previous} disabled={activeIndex === 0} icon={rtl ? '→' : '←'} />
                  <LandingButton compact variant="quiet" label={playing ? t('voice11.pause') : t('voice11.resume')} onPress={togglePlayback} icon={playing ? 'Ⅱ' : '▶'} />
                  <LandingButton compact variant="secondary" label={isLast ? t('landing12.cta.restart') : t('landing12.cta.next')} onPress={next} icon={isLast ? '↻' : rtl ? '←' : '→'} />
                </View>
              </View>
            </View>
          </View>
        )}
      </Surface>

      <View style={{ marginTop: 20, flexDirection: width >= 760 ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1, padding: 18, borderLeftWidth: 3, borderLeftColor: c.aiAccent, backgroundColor: c.surface, borderRadius: radius.md }}>
          <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: '800' }}>{t('landing12.story.outcome')}</Text>
        </View>
        <View style={{ flex: 1, padding: 18, borderLeftWidth: 3, borderLeftColor: c.success, backgroundColor: c.surface, borderRadius: radius.md }}>
          <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 22, fontWeight: '800' }}>{t('landing12.story.nba')}</Text>
        </View>
      </View>
    </LandingSection>
  );
}

function StoryTab({
  stage,
  index,
  selected,
  onPress,
  vertical = false,
}: {
  stage: ProductDemoStage;
  index: number;
  selected: boolean;
  onPress: () => void;
  vertical?: boolean;
}) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      aria-selected={selected}
      accessibilityLabel={`${index + 1}. ${t(stage.shortKey)}`}
      style={({ pressed }) => [
        {
          minHeight: vertical ? 48 : 42,
          minWidth: vertical ? undefined : 132,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: selected ? c.aiAccent : 'transparent',
          backgroundColor: selected ? c.aiAccentSoft : pressed ? c.surface : 'transparent',
          opacity: pressed ? 0.8 : 1,
        },
        webOnly({ cursor: 'pointer' }),
      ]}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.aiAccent : c.surface }}>
        <Text accessible={false} style={{ color: selected ? c.onAiAccent : c.textMuted, fontSize: 11, fontWeight: '900' }}>{index + 1}</Text>
      </View>
      <Text numberOfLines={vertical ? 2 : 1} style={{ color: selected ? c.textPrimary : c.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: selected ? '800' : '600', flexShrink: 1 }}>{t(stage.shortKey)}</Text>
    </Pressable>
  );
}

function StaticProductJourney() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <View style={{ padding: 18, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {PRODUCT_DEMO_STAGES.map((stage, index) => (
          <View key={stage.id} style={{ flexGrow: 1, flexBasis: 215, minHeight: 94, borderWidth: 1, borderColor: index === PRODUCT_DEMO_STAGES.length - 1 ? c.aiAccent : c.borderSubtle, backgroundColor: index === PRODUCT_DEMO_STAGES.length - 1 ? c.aiAccentSoft : c.surface, borderRadius: radius.md, padding: 13, gap: 5 }}>
            <Text style={{ color: c.aiAccent, fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.8 }}>{index + 1} · {stage.icon} {t(stage.shortKey)}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 20, fontWeight: '800' }}>{t(stage.titleKey)}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 17 }}>{t(stage.descriptionKey)}</Text>
            {stage.id === 'capture' ? <LandingPill label={`${t('onb.subj.physics')} · PDF`} icon="▣" /> : null}
            {stage.id === 'suggestion' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <LandingPill label={t('landingV1.action.apply')} tone="success" icon="✓" />
                <LandingPill label={t('landingV1.action.reject')} tone="warning" icon="×" />
              </View>
            ) : null}
            {stage.id === 'verify' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <LandingPill label={t('learn.exam.consignes')} tone="success" icon="✓" />
                <LandingPill label={t('writing.d.structure')} tone="success" icon="✓" />
                <LandingPill label={t('tutor6.block.source')} tone="success" icon="✓" />
              </View>
            ) : null}
            {stage.id === 'deconstruct' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {[t('coachp.method'), t('landingV1.action.apply'), t('brain8.history.kind.error'), t('landing12.story.traceability'), t('lesson.concept')].map((label) => <LandingPill key={label} label={label} />)}
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <LandingPill label={t('workspace10.save.saved')} tone="success" icon="✓" />
        <LandingPill label={t('workspace10.resume')} tone="accent" icon="↻" />
        <LandingPill label={`${t('learn5.modality.export')} · PDF`} icon="⇩" />
        <LandingPill label={`${t('learn5.modality.export')} · Markdown`} icon="⇩" />
      </View>
    </View>
  );
}

function StoryVisual({ stage, autoApply }: { stage: ProductDemoStageId; autoApply: boolean }) {
  if (stage === 'capture') return <CaptureStory />;
  if (stage === 'classify') return <ClassificationStory />;
  if (stage === 'understand') return <ProfessorStory />;
  if (stage === 'source') return <SourceStory />;
  if (stage === 'answer') return <LearnerAnswerStory />;
  if (stage === 'suggestion') return <SuggestionStory autoApply={autoApply} />;
  if (stage === 'verify') return <VerificationStory />;
  if (stage === 'deconstruct') return <DeconstructionStory />;
  return <ExportStory />;
}

function VisualFrame({ children }: { children: ReactNode }) {
  const { colors: c, radius } = useTokens();
  return <View style={{ minHeight: 250, justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.lg, padding: 18 }}>{children}</View>;
}

function CaptureStory() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ flexDirection: width >= 680 ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
        <View style={{ width: width >= 680 ? 180 : '100%', minHeight: 178, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.md, padding: 16, gap: 11 }}>
          <Text accessible={false} style={{ color: c.aiAccent, fontSize: 28 }}>▣</Text>
          <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800' }}>{t('learn5.capture.photo')}</Text>
          <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 16 }}>{t('onb.subj.physics')} · PDF</Text>
          <View style={{ flex: 1 }} />
          <LandingPill label={t('landing12.story.readyDemo')} tone="success" icon="✓" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 11 }}>
          <LandingPill label={t('workspaceOrchestrator.family.assignment')} tone="accent" icon="◎" />
          <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 26, fontWeight: '800' }}>{t('lesson.homework')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('workspaceOrchestrator.reason.assignment-exercises')}</Text>
        </View>
      </View>
    </VisualFrame>
  );
}

function ClassificationStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 14 }}>
        <LandingPill label={t('workspaceProfessor.phase.CAPTURE')} icon="▣" />
        <View style={{ borderWidth: 2, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.lg, padding: 18, gap: 7 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>{t('workspaceOrchestrator.family.assignment')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 26, fontWeight: '800' }}>{t('workspaceOrchestrator.reason.assignment-exercises')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('workspaceOrchestrator.overrideKept')}</Text>
        </View>
      </View>
    </VisualFrame>
  );
}

function ProfessorStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 13 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
          <LandingPill label={t('workspaceProfessor.phase.COMPREHENSION')} tone="accent" icon="✦" />
          <LandingPill label={t('landing12.story.context.document')} icon="▤" />
          <LandingPill label={t('landing12.story.context.goal')} icon="◎" />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, maxWidth: '94%' }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.aiAccent }}><Text accessible={false} style={{ color: c.onAiAccent, fontWeight: '900' }}>✦</Text></View>
          <View style={{ flex: 1, backgroundColor: c.aiAccentSoft, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.lg, paddingVertical: 11, paddingHorizontal: 13 }}>
            <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 20 }}>{t('workspaceOrchestrator.reason.assignment-exercises')}</Text>
          </View>
        </View>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landingV1.demo.professorPrompt')}</Text>
      </View>
    </VisualFrame>
  );
}

function SourceStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 13 }}>
        <LandingPill label={t('landing12.story.traceability')} tone="accent" icon="↗" />
        <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 8 }}>
          <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '800' }}>{t('onb.subj.physics')} · PDF</Text>
          <Text style={{ color: c.aiAccent, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t('scan.pagePosition', { current: 17, total: 17 })}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('landingV1.demo.formulaFound')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 22, fontWeight: '900' }}>F = m × a</Text>
        </View>
      </View>
    </VisualFrame>
  );
}

function LearnerAnswerStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 12 }}>
        <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('lesson.yourAnswer')}</Text>
        <View style={{ alignSelf: 'flex-end', maxWidth: '92%', backgroundColor: c.primary, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 15 }}>
          <Text style={{ color: c.onPrimary, fontSize: 14, lineHeight: 22 }}>m = 2 kg · a = 3 m/s² · F = 6 N</Text>
        </View>
        <LandingPill label={t('workspace10.save.saved')} tone="success" icon="✓" />
      </View>
    </VisualFrame>
  );
}

function SuggestionStory({ autoApply }: { autoApply: boolean }) {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const [applied, setApplied] = useState(false);
  useEffect(() => {
    setApplied(false);
    if (!autoApply) return undefined;
    const timer = setTimeout(() => setApplied(true), 1_500);
    return () => clearTimeout(timer);
  }, [autoApply]);
  return (
    <VisualFrame>
      <View style={{ gap: 13 }}>
        <View style={{ borderWidth: 1, borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft, borderRadius: radius.lg, padding: 15, gap: 7 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 16, fontWeight: '900', textTransform: 'uppercase' }}>{t('workspace10.assist.suggest')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 14, lineHeight: 22 }}>{t('landingV1.demo.suggestionGap')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t('landingV1.demo.suggestionSource')}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <LandingButton compact label={t('landingV1.action.apply')} onPress={() => setApplied(true)} icon="✓" />
          <LandingButton compact variant="quiet" label={t('landingV1.action.reject')} onPress={() => setApplied(false)} icon="×" />
        </View>
        {applied ? <LandingPill label={t('workspace10.save.saved')} tone="success" icon="✓" /> : null}
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('workspace10.integrityDetail')}</Text>
      </View>
    </VisualFrame>
  );
}

function VerificationStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 13 }}>
        <LandingPill label={t('workspaceProfessor.phase.VERIFICATION')} tone="accent" icon="✓" />
        <View style={{ borderLeftWidth: 3, borderLeftColor: c.success, backgroundColor: c.successSoft, borderRadius: radius.md, padding: 16, gap: 7 }}>
          <Text style={{ color: c.textPrimary, fontSize: 17, lineHeight: 24, fontWeight: '800' }}>{t('onb.sup.verify')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('research10.plan.verify')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <LandingPill label={t('learn.exam.consignes')} tone="success" icon="✓" />
            <LandingPill label={t('writing.d.structure')} tone="success" icon="✓" />
            <LandingPill label={t('tutor6.block.source')} tone="success" icon="✓" />
          </View>
        </View>
      </View>
    </VisualFrame>
  );
}

function DeconstructionStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 13 }}>
        <LandingPill label={t('workspaceProfessor.phase.DECONSTRUCTION')} tone="accent" icon="◇" />
        <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 8 }}>
          <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 23, fontWeight: '800' }}>{t('lesson.how')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('landingV1.demo.deconstruction')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <LandingPill label={t('coachp.method')} tone="accent" icon="1" />
            <LandingPill label={t('landingV1.action.apply')} icon="2" />
            <LandingPill label={t('brain8.history.kind.error')} tone="warning" icon="3" />
            <LandingPill label={t('landing12.story.traceability')} icon="4" />
            <LandingPill label={t('lesson.concept')} tone="success" icon="5" />
          </View>
        </View>
      </View>
    </VisualFrame>
  );
}

function ExportStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <LandingPill label={t('workspaceProfessor.phase.FINALIZATION')} tone="accent" icon="✓" />
          <LandingPill label={t('workspace10.save.saved')} tone="success" icon="✓" />
        </View>
        <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 12 }}>
          <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '800' }}>{t('learn5.modality.export')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <LandingPill label={`PDF · ${publicStatusLabel(capability('pdf').status, t)}`} tone="success" icon="⇩" />
            <LandingPill label={`Markdown · ${publicStatusLabel(capability('markdown').status, t)}`} tone="success" icon="⇩" />
          </View>
          <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('learn5.modality.export')} ≠ {t('workspace10.status.archived')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('workspace10.resumeDetail')}</Text>
        </View>
      </View>
    </VisualFrame>
  );
}

function PersistenceNote() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.surfaceSunken, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12 }}>
      <LandingPill label={t('workspace10.save.saved')} tone="success" icon="✓" />
      <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18, flex: 1, minWidth: 190 }}>{t('workspace10.resumeDetail')}</Text>
      <Text style={{ color: c.aiAccent, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t('workspace10.resume')}</Text>
    </View>
  );
}
