import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { PRODUCT_STORY_STAGES, type ProductStoryStageId } from './landing-content';
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

export function ProductStory() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const [active, setActive] = useState<ProductStoryStageId>('documents');
  const desktop = width >= 1000;
  const activeIndex = PRODUCT_STORY_STAGES.findIndex((stage) => stage.id === active);
  const current = PRODUCT_STORY_STAGES[activeIndex];
  const next = () => setActive(PRODUCT_STORY_STAGES[(activeIndex + 1) % PRODUCT_STORY_STAGES.length].id);

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

        <View style={{ flexDirection: desktop ? 'row' : 'column', minHeight: desktop ? 540 : undefined }}>
          {desktop ? (
            <View style={{ width: 238, borderRightWidth: 1, borderRightColor: c.borderSubtle, padding: 14, gap: 6, backgroundColor: c.surfaceSunken }}>
              {PRODUCT_STORY_STAGES.map((stage, index) => (
                <StoryTab key={stage.id} stage={stage} index={index} selected={stage.id === active} onPress={() => setActive(stage.id)} vertical />
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, maxHeight: 70 }} contentContainerStyle={{ alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: c.borderSubtle }}>
              {PRODUCT_STORY_STAGES.map((stage, index) => (
                <StoryTab key={stage.id} stage={stage} index={index} selected={stage.id === active} onPress={() => setActive(stage.id)} />
              ))}
            </ScrollView>
          )}

          <View accessibilityLiveRegion="polite" style={{ flex: 1, padding: width >= 700 ? 28 : 16, gap: 22 }}>
            <StageTransition revision={active}>
              <View style={{ gap: 18 }}>
                <View style={{ gap: 7 }}>
                  <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' }}>{current.icon} {t(current.shortKey)}</Text>
                  <Text accessibilityRole="header" style={{ color: c.textPrimary, fontSize: width >= 700 ? 28 : 23, lineHeight: width >= 700 ? 35 : 29, fontWeight: '800' }}>{t(current.titleKey)}</Text>
                  <Text style={{ color: c.textSecondary, maxWidth: 720, fontSize: 14, lineHeight: 22 }}>{t(current.descriptionKey)}</Text>
                </View>
                <StoryVisual stage={active} />
              </View>
            </StageTransition>

            <View style={{ flexDirection: width < 480 ? 'column' : 'row', alignItems: width < 480 ? 'stretch' : 'center', gap: 12, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: 18 }}>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                <LandingPill label={t('landing12.story.sharedContext')} tone="accent" icon="✦" />
                <LandingPill label={t('landing12.story.traceability')} icon="↗" />
              </View>
              <LandingButton
                compact
                variant="secondary"
                label={activeIndex === PRODUCT_STORY_STAGES.length - 1 ? t('landing12.cta.restart') : t('landing12.cta.next')}
                onPress={next}
                icon={activeIndex === PRODUCT_STORY_STAGES.length - 1 ? '↻' : '→'}
              />
            </View>
          </View>
        </View>
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
  stage: (typeof PRODUCT_STORY_STAGES)[number];
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
          minHeight: vertical ? 54 : 42,
          minWidth: vertical ? undefined : 118,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          paddingVertical: 9,
          paddingHorizontal: 11,
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

function StoryVisual({ stage }: { stage: ProductStoryStageId }) {
  if (stage === 'documents') return <DocumentStory />;
  if (stage === 'brain') return <BrainStory />;
  if (stage === 'professor') return <ProfessorStory />;
  if (stage === 'oral') return <OralStory />;
  if (stage === 'review') return <ReviewStory />;
  return <WorkspaceStory />;
}

function VisualFrame({ children }: { children: ReactNode }) {
  const { colors: c, radius } = useTokens();
  return <View style={{ minHeight: 275, justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, borderRadius: radius.lg, padding: 18 }}>{children}</View>;
}

function DocumentStory() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const pipeline = ['import', 'read', 'concepts', 'connect'];
  return (
    <VisualFrame>
      <View style={{ flexDirection: width >= 680 ? 'row' : 'column', gap: 18, alignItems: 'stretch' }}>
        <View style={{ width: width >= 680 ? 170 : '100%', minHeight: 190, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.md, padding: 16, gap: 11 }}>
          <Text accessible={false} style={{ color: c.error, fontSize: 25 }}>▤</Text>
          <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800' }}>{t('landing12.story.file')}</Text>
          <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 16 }}>{t('landing12.story.fileType')}</Text>
          <View style={{ flex: 1 }} />
          <LandingPill label={t('landing12.story.readyDemo')} tone="success" icon="✓" />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', gap: 9 }}>
          {pipeline.map((step, index) => (
            <View key={step} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: index === pipeline.length - 1 ? c.aiAccent : c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
                <Text accessible={false} style={{ color: index === pipeline.length - 1 ? c.onAiAccent : c.textSecondary, fontSize: 11, fontWeight: '900' }}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1, minHeight: 42, borderRadius: radius.sm, borderWidth: 1, borderColor: index === pipeline.length - 1 ? c.aiAccent : c.borderSubtle, backgroundColor: index === pipeline.length - 1 ? c.aiAccentSoft : c.surfaceElevated, justifyContent: 'center', paddingHorizontal: 12 }}>
                <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{t(k(`landing12.story.pipeline.${step}`))}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </VisualFrame>
  );
}

function BrainStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const concepts = ['photosynthesis', 'chlorophyll', 'atp'];
  return (
    <VisualFrame>
      <View style={{ alignItems: 'center', gap: 13 }}>
        <View style={{ minWidth: 210, maxWidth: '100%', paddingVertical: 13, paddingHorizontal: 17, borderWidth: 2, borderColor: c.warning, borderRadius: radius.full, backgroundColor: c.warningSoft, alignItems: 'center' }}>
          <Text style={{ color: c.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'center' }}>{t('landing12.story.concept.respiration')}</Text>
          <Text style={{ color: c.warning, fontSize: 11, lineHeight: 16, fontWeight: '800' }}>{t('landing12.story.concept.toConsolidate')}</Text>
        </View>
        <View accessible={false} style={{ width: 1, height: 18, backgroundColor: c.borderStrong }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9 }}>
          {concepts.map((concept, index) => (
            <View key={concept} style={{ minWidth: 125, borderWidth: 1, borderColor: index === 2 ? c.aiAccent : c.border, backgroundColor: index === 2 ? c.aiAccentSoft : c.surfaceElevated, borderRadius: radius.full, paddingVertical: 9, paddingHorizontal: 13, alignItems: 'center' }}>
              <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 17, fontWeight: '700' }}>{t(k(`landing12.story.concept.${concept}`))}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: c.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' }}>{t('landing12.story.brain.note')}</Text>
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
          <LandingPill label={t('landing12.story.context.brain')} tone="accent" icon="◉" />
          <LandingPill label={t('landing12.story.context.document')} icon="▤" />
          <LandingPill label={t('landing12.story.context.goal')} icon="◎" />
        </View>
        <View style={{ alignSelf: 'flex-end', maxWidth: '86%', backgroundColor: c.primary, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 13 }}>
          <Text style={{ color: c.onPrimary, fontSize: 13, lineHeight: 20 }}>{t('landing12.story.professor.question')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 9, maxWidth: '92%' }}>
          <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.aiAccent }}><Text accessible={false} style={{ color: c.onAiAccent, fontWeight: '900' }}>✦</Text></View>
          <View style={{ flex: 1, backgroundColor: c.aiAccentSoft, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.lg, paddingVertical: 11, paddingHorizontal: 13 }}>
            <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 20 }}>{t('landing12.story.professor.answer')}</Text>
          </View>
        </View>
        <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('landing12.story.professor.session')}</Text>
      </View>
    </VisualFrame>
  );
}

function OralStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const states = ['listen', 'transcript', 'answer'];
  return (
    <VisualFrame>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {states.map((state, index) => (
            <View key={state} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <LandingPill label={t(k(`landing12.story.oral.${state}`))} tone={index === 1 ? 'accent' : 'neutral'} icon={index === 0 ? '●' : index === 1 ? '✎' : '✓'} />
              {index < states.length - 1 ? <Text accessible={false} style={{ color: c.textMuted }}>→</Text> : null}
            </View>
          ))}
        </View>
        <View style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 16, gap: 8 }}>
          <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>{t('landing12.story.oral.visibleTranscript')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 16, lineHeight: 24, fontStyle: 'italic' }}>{t('landing12.story.oral.transcriptText')}</Text>
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.story.oral.note')}</Text>
      </View>
    </VisualFrame>
  );
}

function ReviewStory() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  return (
    <VisualFrame>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, alignItems: 'stretch' }}>
        <View style={{ flex: 1, minWidth: 220, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, padding: 18, gap: 9 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 }}>{t('landing12.story.review.cardLabel')}</Text>
          <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: '800' }}>{t('landing12.story.concept.respiration')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('landing12.story.review.question')}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 210, justifyContent: 'center', gap: 9, borderLeftWidth: 3, borderLeftColor: c.warning, paddingLeft: 16 }}>
          <Text style={{ color: c.warning, fontSize: 13, lineHeight: 19, fontWeight: '800' }}>{t('landing12.story.review.tomorrow')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.story.review.note')}</Text>
          <LandingPill label={t('landing12.story.review.fsrs')} tone="warning" icon="↻" />
        </View>
      </View>
    </VisualFrame>
  );
}

function WorkspaceStory() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const wide = width >= 680;
  return (
    <VisualFrame>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 12, minHeight: 220 }}>
        <View style={{ width: wide ? 145 : '100%', gap: 8, borderRightWidth: wide ? 1 : 0, borderBottomWidth: wide ? 0 : 1, borderColor: c.borderSubtle, paddingRight: wide ? 12 : 0, paddingBottom: wide ? 0 : 12 }}>
          <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase' }}>{t('landing12.story.workspace.plan')}</Text>
          {['context', 'analysis', 'conclusion'].map((item, index) => (
            <View key={item} style={{ borderRadius: radius.sm, backgroundColor: index === 1 ? c.aiAccentSoft : c.surfaceSunken, paddingVertical: 7, paddingHorizontal: 9 }}>
              <Text style={{ color: index === 1 ? c.aiAccent : c.textSecondary, fontSize: 11, lineHeight: 16, fontWeight: '700' }}>{t(k(`landing12.story.workspace.${item}`))}</Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1, gap: 9 }}>
          <Text style={{ color: c.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '800' }}>{t('landing12.story.workspace.documentTitle')}</Text>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t('landing12.story.workspace.copy')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
            <LandingPill label={t('landing12.story.workspace.source')} icon="▤" />
            <LandingPill label={t('landing12.story.workspace.citation')} tone="accent" icon="[1]" />
          </View>
        </View>
      </View>
    </VisualFrame>
  );
}
