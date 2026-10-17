import { Text, View } from 'react-native';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { localeDirection, useI18n, type TranslationKey } from '../../lib/i18n';
import { capability, publicStatusLabel } from './capabilities.registry';
import {
  LandingKicker,
  LandingLead,
  LandingPill,
  LandingSection,
  LandingTitle,
  DemoLabel,
  SectionHeading,
  Surface,
} from './landing-foundation';

const k = (key: string) => key as TranslationKey;

const WORKSPACE_FAMILIES = [
  { id: 'assignment', icon: '☑', detail: 'workspaceOrchestrator.reason.assignment-exercises', preview: ['learn.exam.consignes', 'workspace10.area.work'] },
  { id: 'thesis', icon: '☰', detail: 'workspaceOrchestrator.reason.thesis-research', preview: ['workspace10.area.plan', 'workspace10.area.work', 'workspace10.area.sources'] },
  { id: 'dissertation', icon: '⇌', detail: 'workspaceOrchestrator.reason.dissertation-argument', preview: ['writing.d.argumentation', 'writing.d.logic', 'writing.d.structure'] },
  { id: 'article', icon: '∴', detail: 'workspaceOrchestrator.reason.article-scientific', preview: ['writing.d.structure', 'workspace10.area.sources', 'writing.d.academic_quality'] },
  { id: 'report', icon: '▦', detail: 'workspaceOrchestrator.reason.report-structure', preview: ['workspace10.field.objective', 'session.results', 'org.recommendations'] },
  { id: 'general', icon: '✦', detail: 'workspaceOrchestrator.reason.conflicting-signals', preview: ['workspace10.area.assistant', 'workspace10.area.plan', 'workspace10.area.work'] },
] as const;

const PROFESSOR_PHASES = [
  'COMPREHENSION',
  'METHOD',
  'WORK',
  'COACHING',
  'VERIFICATION',
  'FINALIZATION',
  'DECONSTRUCTION',
] as const;

/** Public, deterministic representation of the already-delivered Academic Workspace. */
export function AcademicWorkspaceSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { locale, t } = useI18n();
  const rtl = localeDirection(locale) === 'rtl';
  const desktop = width >= 920;
  const capture = [
    { icon: '📷', label: 'profile.card.takePhoto' },
    { icon: 'PDF', label: 'landing.exp.s1', capabilityId: 'pdf' },
    { icon: '✎', label: 'h.capture.write' },
    { icon: '●', label: 'h.capture.speak', capabilityId: 'voice' },
    { icon: '▤', label: 'learn5.spaces.library' },
  ] as const;

  return (
    <LandingSection tone="soft">
      <SectionHeading
        kicker={t('workspace10.eyebrow')}
        title={t('workspace10.title')}
        lead={t('workspace10.subtitle')}
      />

      <View style={{ marginTop: 28, gap: 18 }}>
        <Surface>
          <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 18, alignItems: desktop ? 'center' : 'stretch' }}>
            <View style={{ flex: 1, gap: 10 }}>
              <LandingKicker>{t('learn5.capture.title')}</LandingKicker>
              <LandingLead>{t('learn5.capture.detail')}</LandingLead>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {capture.map((item) => {
                  const capabilityId = 'capabilityId' in item ? item.capabilityId : null;
                  const status = capabilityId ? ` · ${publicStatusLabel(capability(capabilityId).status, t)}` : '';
                  return <LandingPill key={item.label} icon={item.icon} label={`${t(item.label)}${status}`} tone={capabilityId === 'voice' ? 'warning' : 'neutral'} />;
                })}
              </View>
            </View>
            <Text accessible={false} style={{ color: c.aiAccent, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>{desktop ? (rtl ? '←' : '→') : '↓'}</Text>
            <View style={{ flex: 0.72, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.lg, backgroundColor: c.aiAccentSoft, padding: 17, gap: 7 }}>
              <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>{t('landing12.hero.scene.context.title')}</Text>
              <Text style={{ color: c.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: '900' }}>{t('workspaceOrchestrator.generalProposal')}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('workspaceOrchestrator.overrideKept')}</Text>
            </View>
          </View>
        </Surface>

        <View style={{ flexDirection: desktop ? 'row' : 'column', flexWrap: desktop ? 'wrap' : 'nowrap', gap: 12 }}>
          {WORKSPACE_FAMILIES.map((family) => (
            <View key={family.id} style={{ flexGrow: 1, flexBasis: desktop ? '31%' : '100%', minWidth: desktop ? 260 : undefined, borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.surface, padding: 16, gap: 9 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <Text accessible={false} style={{ color: c.aiAccent, fontSize: 17, fontWeight: '900' }}>{family.icon}</Text>
                <Text style={{ flex: 1, color: c.textPrimary, fontSize: 15, lineHeight: 21, fontWeight: '900' }}>{t(k(`workspaceOrchestrator.family.${family.id}`))}</Text>
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t(family.detail)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 2 }}>
                {family.preview.map((item, index) => (
                  <LandingPill key={item} label={t(item)} tone={index === 0 ? 'accent' : 'neutral'} icon={index === 0 ? (rtl ? '←' : '→') : '·'} />
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 14 }}>
          <Surface accent style={{ flex: 1 }}>
            <DemoLabel label={t('landing12.demo.label')} />
            <LandingKicker>{t('workspace10.resume')}</LandingKicker>
            <Text style={{ marginTop: 8, color: c.textPrimary, fontSize: 21, lineHeight: 28, fontWeight: '900' }}>{t('workspace10.resumeDetail')}</Text>
            <View style={{ marginTop: 14, gap: 9 }}>
              <Text style={{ color: c.aiAccent, fontSize: 12, lineHeight: 18, fontWeight: '900' }}>{t('workspaceOrchestrator.family.thesis')} · 43 %</Text>
              <View style={{ height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.borderSubtle }}>
                <View style={{ width: '43%', height: '100%', backgroundColor: c.aiAccent }} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {['workspace10.area.plan', 'workspace10.area.work', 'workspace10.area.sources', 'learn5.draft.restored', 'nav.progress', 'workspace10.save.saved'].map((item) => <LandingPill key={item} label={t(k(item))} tone="accent" />)}
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('workspace10.resume')} · {t('source.passage', { n: 'II · 2.3' })}</Text>
            </View>
          </Surface>
          <Surface style={{ flex: 1 }}>
            <LandingKicker>{t('workspace10.integrity')}</LandingKicker>
            <Text style={{ marginTop: 8, color: c.textPrimary, fontSize: 19, lineHeight: 26, fontWeight: '900' }}>{t('workspace10.integrityDetail')}</Text>
            <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <LandingPill label={t('landingV1.action.apply')} tone="success" icon="✓" />
              <LandingPill label={t('landingV1.action.reject')} tone="warning" icon="×" />
            </View>
          </Surface>
        </View>

        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.surface, padding: 17, gap: 11 }}>
          <LandingKicker>{t('workspace10.sources')}</LandingKicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <LandingPill label="PDF" icon="▤" />
            <LandingPill label={t('h.capture.write')} icon="✎" />
            <LandingPill label={t('workspace10.sourceMode.collections')} icon="▦" />
            <LandingPill label={t('landing12.brain.kicker')} icon="◉" />
            <LandingPill label={t('research10.eyebrow')} icon="⌕" />
          </View>
          <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 18 }}>{t('landing12.story.workspace.citation')} · {t('landing12.story.workspace.source')}</Text>
        </View>

        <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: radius.lg, backgroundColor: c.surface, padding: 17, gap: 13 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {['WORK', 'VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'].map((phase, index) => (
              <View key={phase} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <LandingPill label={t(k(`workspaceProfessor.phase.${phase}`))} tone={index === 3 ? 'accent' : 'neutral'} />
                {index < 3 ? <Text accessible={false} style={{ color: c.borderStrong }}>{rtl ? '←' : '→'}</Text> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <LandingPill label={`PDF · ${publicStatusLabel(capability('pdf').status, t)}`} tone="success" />
            <LandingPill label={`Markdown · ${publicStatusLabel(capability('markdown').status, t)}`} tone="success" />
          </View>
          <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 17 }}>{t('learn5.modality.export')} ≠ {t('workspace10.status.archived')}</Text>
        </View>
      </View>
    </LandingSection>
  );
}

export function ProfessorJourneySection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  return (
    <LandingSection>
      <SectionHeading kicker={t('landing12.professor.kicker')} title={t('landing12.professor.title')} lead={t('landing12.professor.lead')} />
      <View style={{ marginTop: 26, flexDirection: width >= 920 ? 'row' : 'column', gap: 16 }}>
        <Surface accent style={{ flex: 0.78 }}>
          <Text style={{ color: c.aiAccent, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{t('landing12.professor.identity')}</Text>
          <Text style={{ marginTop: 10, color: c.textPrimary, fontSize: 20, lineHeight: 28, fontWeight: '900' }}>{t('landing12.professor.example')}</Text>
          <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['level', 'goals', 'documents', 'progress'].map((item) => <LandingPill key={item} label={t(k(`landing12.professor.${item}`))} />)}
            <LandingPill label={`${t('landing12.professor.mode.voice')} · ${publicStatusLabel(capability('voice').status, t)}`} tone="warning" icon="●" />
          </View>
        </Surface>
        <View style={{ flex: 1.22, borderWidth: 1, borderColor: c.border, borderRadius: radius.xl, backgroundColor: c.surface, padding: 18, gap: 9 }}>
          {PROFESSOR_PHASES.map((phase, index) => (
            <View key={phase} style={{ minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: index === PROFESSOR_PHASES.length - 1 ? 0 : 1, borderBottomColor: c.borderSubtle }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: index === PROFESSOR_PHASES.length - 1 ? c.aiAccent : c.aiAccentSoft }}>
                <Text style={{ color: index === PROFESSOR_PHASES.length - 1 ? c.onPrimary : c.aiAccent, fontSize: 10, fontWeight: '900' }}>{index + 1}</Text>
              </View>
              <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '800' }}>{t(k(`workspaceProfessor.phase.${phase}`))}</Text>
            </View>
          ))}
        </View>
      </View>
    </LandingSection>
  );
}

export function ResearchEvidenceSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const scopes = ['brain', 'library', 'documents', 'collection'] as const;
  return (
    <LandingSection tone="soft">
      <SectionHeading kicker={t('research10.eyebrow')} title={t('research10.title')} lead={t('research10.subtitle')} />
      <View style={{ marginTop: 26, flexDirection: width >= 820 ? 'row' : 'column', gap: 14 }}>
        <Surface style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <Text style={{ color: c.textPrimary, fontSize: 18, lineHeight: 24, fontWeight: '900' }}>{t('research10.depth.sourced')}</Text>
            <LandingPill label={publicStatusLabel(capability('internalResearch').status, t)} tone="success" />
          </View>
          <Text style={{ marginTop: 9, color: c.textSecondary, fontSize: 13, lineHeight: 20 }}>{t('research10.depth.sourced.detail')}</Text>
          <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {scopes.map((scope) => <LandingPill key={scope} label={t(k(`research10.scope.${scope}`))} icon="⌕" />)}
          </View>
          <View style={{ marginTop: 16, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.md, backgroundColor: c.aiAccentSoft, padding: 13 }}>
            <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t('landing12.story.workspace.source')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 17 }}>{t('landing12.story.workspace.citation')}</Text>
          </View>
        </Surface>
        <Surface style={{ flex: 0.7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text accessible={false} style={{ color: c.textMuted, fontSize: 19 }}>◎</Text>
            <Text style={{ flex: 1, color: c.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '900' }}>{t('research10.scope.web')}</Text>
          </View>
          <View style={{ marginTop: 12, alignSelf: 'flex-start' }}><LandingPill label={publicStatusLabel(capability('groundedWebResearch').status, t)} tone="warning" /></View>
          <Text style={{ marginTop: 12, color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t('landing12.demo.disclaimer')}</Text>
        </Surface>
      </View>
    </LandingSection>
  );
}

export function BrainEvidenceSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const indicators = ['intelligence', 'reflection', 'vision', 'understanding', 'adaptation'] as const;
  const cards = [
    { icon: '▤', title: 'brainV1.bulletin.section', detail: 'brainV1.bulletin.sectionDetail' },
    { icon: '✓', title: 'brainV1.tabs.evidence', detail: 'globalPath.evidence.detail' },
    { icon: '◉', title: 'brainV1.tabs.cognostatity', detail: 'brainV1.cognostatity.detail' },
  ] as const;
  return (
    <LandingSection>
      <SectionHeading kicker={t('landing12.brain.kicker')} title={t('landing12.brain.title')} lead={t('landing12.brain.lead')} />
      <View style={{ marginTop: 26, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.xl, backgroundColor: c.aiAccentSoft, padding: 18, gap: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9 }}>
          <LandingPill label={t('brainV1.bulletin.section')} tone="accent" icon="▤" />
          <Text style={{ color: c.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '900' }}>{t('onb.subj.physics')}</Text>
        </View>
        <View style={{ flexDirection: width >= 700 ? 'row' : 'column', gap: 9 }}>
          {[
            ['nav.progress', 'brain8.mastery.unknown'],
            ['globalPath.evidence.title', 'brainV1.cognostatity.insufficient'],
            ['landing12.brain.fragilities', 'brain8.mastery.unknown.detail'],
          ].map(([label, value]) => (
            <View key={label} style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface, padding: 12, gap: 4 }}>
              <Text style={{ color: c.textMuted, fontSize: 10, lineHeight: 15, fontWeight: '800', textTransform: 'uppercase' }}>{t(k(label))}</Text>
              <Text style={{ color: c.textPrimary, fontSize: 12, lineHeight: 18, fontWeight: '800' }}>{t(k(value))}</Text>
            </View>
          ))}
        </View>
        <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 17 }}>{t('landing12.brain.noScores')}</Text>
      </View>
      <View style={{ marginTop: 14, flexDirection: width >= 860 ? 'row' : 'column', gap: 13 }}>
        {cards.map((card) => (
          <View key={card.title} style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.xl, backgroundColor: c.surface, padding: 18, gap: 9 }}>
            <Text accessible={false} style={{ color: c.aiAccent, fontSize: 21, fontWeight: '900' }}>{card.icon}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 17, lineHeight: 23, fontWeight: '900' }}>{t(card.title)}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12, lineHeight: 19 }}>{t(card.detail)}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 14, borderWidth: 1, borderColor: c.aiAccent, borderRadius: radius.lg, backgroundColor: c.aiAccentSoft, padding: 17, gap: 11 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {indicators.map((indicator) => <LandingPill key={indicator} label={t(k(`brainV1.cognostatity.indicator.${indicator}`))} tone="accent" />)}
        </View>
        <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 20, fontWeight: '800' }}>{t('brainV1.cognostatity.insufficient')}</Text>
        <Text style={{ color: c.textSecondary, fontSize: 11, lineHeight: 17 }}>{t('brainV1.cognostatity.disclaimer')}</Text>
      </View>
    </LandingSection>
  );
}

export function ReviewNextActionSection() {
  const { colors: c, radius } = useTokens();
  const { width } = useResponsive();
  const { t } = useI18n();
  const actions = ['english', 'review', 'workspace', 'professor'] as const;
  return (
    <LandingSection tone="dark">
      <SectionHeading kicker={t('landing12.nba.kicker')} title={t('landing12.nba.title')} lead={t('landing12.nba.lead')} inverse />
      <View style={{ marginTop: 25, flexDirection: width >= 760 ? 'row' : 'column', gap: 10 }}>
        {actions.map((action, index) => (
          <View key={action} style={{ flex: 1, minHeight: 116, borderWidth: 1, borderColor: index === 0 ? c.aiAccent : c.borderStrong, borderRadius: radius.lg, backgroundColor: index === 0 ? c.aiAccentSoft : c.surface, padding: 15, gap: 8 }}>
            <Text accessible={false} style={{ color: index === 0 ? c.aiAccent : c.textMuted, fontSize: 16, fontWeight: '900' }}>{index === 0 ? '→' : '○'}</Text>
            <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '900' }}>{t(k(`landing12.nba.${action}`))}</Text>
            {index === 0 ? <Text style={{ color: c.textSecondary, fontSize: 10, lineHeight: 15 }}>{t('landing12.nba.why')}</Text> : null}
          </View>
        ))}
      </View>
    </LandingSection>
  );
}
