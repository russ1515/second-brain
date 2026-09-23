import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type {
  BrainAnswer,
  BrainConceptView,
  BrainDeclaredProfile,
  BrainForesight,
  BrainMaturityView,
  BrainNextAction,
  BrainSearchResult,
  BrainView,
  LearnerProfile,
  LearningDna,
  LearningMemoryPage,
  MemoryEntry,
  StrengthsWeaknesses,
  TwinGraphNode,
} from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Badge, Button, Card, Input, Progress } from '../ds/core';
import { SourceCitation, SourcePreview } from '../ds/sources';
import { STATUS_VISUAL } from '../../lib/brain/graph';

const VIEWS: BrainView[] = ['overview', 'knowledge', 'learning', 'memory', 'history'];

export function BrainNavigation({ value, onChange }: { value: BrainView; onChange: (view: BrainView) => void }) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }} accessibilityRole="tablist">
      {VIEWS.map((view) => {
        const active = view === value;
        return (
          <Pressable
            key={view}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(view)}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: active ? c.surfaceSunken : c.surface, borderWidth: 1, borderColor: active ? c.primary : c.borderSubtle }}
          >
            <Text style={[typography.bodySmall, { color: active ? c.primary : c.textSecondary, fontWeight: '700' }]}>{t(`brain8.nav.${view}` as TranslationKey)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function BrainMaturitySummary({ maturity }: { maturity: BrainMaturityView }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.map.title')}</Text>
        <Badge tone={maturity.level === 'dense' ? 'ai' : maturity.level === 'medium' ? 'primary' : 'neutral'} label={t(`brain8.maturity.${maturity.level}` as TranslationKey)} />
      </View>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(`brain8.maturity.${maturity.level}.detail` as TranslationKey)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <Metric value={maturity.conceptCount} label={t('brain8.metrics.concepts')} />
        <Metric value={maturity.edgeCount} label={t('brain8.metrics.connections')} />
        <Metric value={maturity.historyCount} label={t('brain8.metrics.events')} />
      </View>
    </Card>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const { colors: c, typography } = useTokens();
  return (
    <View style={{ minWidth: 90, gap: 2 }}>
      <Text style={[typography.h2, { color: c.textPrimary }]}>{value}</Text>
      <Text style={[typography.caption, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

export function SparseBrain({ documents, concepts, activity, onLearn, onImport, onGoal, onOpenDocument, onSelectConcept }: {
  documents: { id: string; title: string }[];
  concepts: TwinGraphNode[];
  activity: MemoryEntry[];
  onLearn: () => void;
  onImport: () => void;
  onGoal: () => void;
  onOpenDocument: (id: string) => void;
  onSelectConcept: (id: string) => void;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('brain8.sparse.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary }]}>{t('brain8.sparse.detail')}</Text>
      </View>
      {concepts.length > 0 ? <KnowledgeList nodes={concepts.slice(0, 4)} onSelect={onSelectConcept} compact /> : null}
      {documents.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={[typography.label, { color: c.textMuted }]}>{t('brain8.recent.documents')}</Text>
          {documents.slice(0, 3).map((document) => <SourceCitation key={document.id} title={document.title} kind="document" compact={false} onPress={() => onOpenDocument(document.id)} />)}
        </View>
      ) : null}
      {activity.length > 0 ? <HistoryTimeline entries={activity.slice(0, 3)} compact /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('brain8.action.learn')} variant="ai" onPress={onLearn} />
        <Button label={t('brain8.action.import')} variant="secondary" onPress={onImport} />
        <Button label={t('brain8.action.goal')} variant="ghost" onPress={onGoal} />
      </View>
    </Card>
  );
}

export function KnowledgeList({ nodes, onSelect, selectedId, compact = false }: { nodes: TwinGraphNode[]; onSelect: (id: string) => void; selectedId?: string | null; compact?: boolean }) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  if (nodes.length === 0) return <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.knowledge.empty')}</Text>;
  return (
    <View accessibilityRole="list" style={{ gap: spacing.xs }}>
      {nodes.map((node) => {
        const visual = STATUS_VISUAL[node.status];
        const selected = selectedId === node.id;
        return (
          <Pressable
            key={node.id}
            accessibilityRole="button"
            accessibilityLabel={`${node.name}, ${t(`graph.s.${node.status}` as TranslationKey)}`}
            onPress={() => onSelect(node.id)}
            style={{ minHeight: compact ? 48 : 58, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: selected ? c.primary : c.borderSubtle, backgroundColor: selected ? c.surfaceSunken : c.surface, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          >
            <Text accessible={false}>{visual.icon}</Text>
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text numberOfLines={2} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{node.name}</Text>
              <Text style={[typography.caption, { color: c.textMuted }]}>{t(`graph.s.${node.status}` as TranslationKey)}</Text>
            </View>
            {node.mastery !== null ? <Text style={[typography.bodySmall, { color: c.textSecondary, fontWeight: '700' }]}>{Math.round(node.mastery * 100)}%</Text> : <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.mastery.unknown')}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

export function StrengthFragility({ value, onSelect }: { value: StrengthsWeaknesses; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (value.strengths.length === 0 && value.weaknesses.length === 0) return null;
  return (
    <Card style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.strength.title')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {value.strengths.slice(0, 4).map((item) => <Pressable key={item.conceptId} onPress={() => onSelect(item.conceptId)}><Badge tone="success" label={`${item.name} · ${Math.round(item.mastery * 100)}%`} /></Pressable>)}
        {value.weaknesses.slice(0, 4).map((item) => <Pressable key={item.conceptId} onPress={() => onSelect(item.conceptId)}><Badge tone="warning" label={`${item.name} · ${Math.round(item.mastery * 100)}%`} /></Pressable>)}
      </View>
      <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.strength.note')}</Text>
    </Card>
  );
}

export function BrainNextActionPanel({ action, onOpen }: { action: BrainNextAction; onOpen: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [why, setWhy] = useState(false);
  return (
    <Card style={{ gap: spacing.md, borderColor: c.aiAccent }}>
      <Badge tone="ai" label={t('brain8.nba.badge')} />
      <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t(`brain8.nba.${action.kind}.title` as TranslationKey).replace('{concept}', action.concept.name)}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(`brain8.nba.${action.kind}.reason` as TranslationKey)}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: why }} onPress={() => setWhy((value) => !value)} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
        <Text style={[typography.bodySmall, { color: c.primary, fontWeight: '700' }]}>{why ? t('brain8.nba.hideWhy') : t('brain8.nba.why')}</Text>
      </Pressable>
      {why ? (
        <View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(`graph.s.${action.evidence.status}` as TranslationKey)}</Text>
          {action.evidence.dueCount > 0 ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('brain8.nba.due').replace('{count}', String(action.evidence.dueCount))}</Text> : null}
          {!action.evidence.masteryKnown ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.mastery.unknown.detail')}</Text> : null}
        </View>
      ) : null}
      <Button label={t(`brain8.nba.${action.kind}.action` as TranslationKey)} variant="ai" onPress={onOpen} />
    </Card>
  );
}

export function MemorySummaryPanel({ summary, dueCount, onOpen }: { summary: LearningMemoryPage['summary']; dueCount: number; onOpen: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.memory.title')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg }}>
        <Metric value={summary.revisions} label={t('brain8.memory.reviews')} />
        <Metric value={dueCount} label={t('brain8.memory.due')} />
        <Metric value={summary.lessons + summary.documents} label={t('brain8.memory.sources')} />
      </View>
      <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.memory.note')}</Text>
      <Button label={t('brain8.memory.open')} variant="secondary" onPress={onOpen} />
    </Card>
  );
}

export function LearningProfilePanel({ declared, observed, dna }: { declared: BrainDeclaredProfile | null; observed: LearnerProfile | null; dna: LearningDna | null }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const observations = observed ? [
    observed.learningStyle ? t(`brain8.observed.style.${observed.learningStyle}` as TranslationKey) : null,
    observed.explanationDepth ? t(`brain8.observed.depth.${observed.explanationDepth}` as TranslationKey) : null,
    observed.workRhythm ? t(`brain8.observed.rhythm.${observed.workRhythm}` as TranslationKey) : null,
    observed.focusWindow ? t(`brain8.observed.focus.${observed.focusWindow}` as TranslationKey) : null,
  ].filter((value): value is string => value !== null) : [];
  return (
    <View style={{ gap: spacing.md }}>
      <Card style={{ gap: spacing.md }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.declared.title')}</Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('brain8.declared.detail')}</Text>
        {declared && (declared.preferences.length > 0 || declared.teacher) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {declared.preferences.map((value) => <Badge key={value} tone="primary" label={value} />)}
            {declared.teacher?.tone ? <Badge tone="neutral" label={declared.teacher.tone} /> : null}
            {declared.teacher?.explanations ? <Badge tone="neutral" label={declared.teacher.explanations} /> : null}
          </View>
        ) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.declared.empty')}</Text>}
      </Card>
      <Card style={{ gap: spacing.md }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.observed.title')}</Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('brain8.observed.detail')}</Text>
        {observations.length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{observations.map((value) => <Badge key={value} tone="ai" label={value} />)}</View> : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.observed.empty')}</Text>}
        {observed ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.observed.evidence').replace('{count}', String(observed.interactions))}</Text> : null}
      </Card>
      <Card style={{ gap: spacing.md }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.dna.title')}</Text>
        <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.dna.note')}</Text>
        {dna && dna.traits.length > 0 ? dna.traits.slice(0, 6).map((trait) => (
          <View key={trait.key} style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}><Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{trait.label}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{Math.round(trait.confidence)}%</Text></View>
            <Text style={[typography.caption, { color: c.textSecondary }]}>{trait.summary}</Text>
          </View>
        )) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.dna.empty')}</Text>}
      </Card>
    </View>
  );
}

export function HistoryTimeline({ entries, compact = false }: { entries: MemoryEntry[]; compact?: boolean }) {
  const { t, locale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (entries.length === 0) return <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.history.empty')}</Text>;
  return (
    <View accessibilityRole="list" style={{ gap: spacing.sm }}>
      {entries.map((entry) => (
        <View key={entry.id} accessibilityRole="text" style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View accessible={false} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 5 }} />
          <View style={{ flex: 1, minWidth: 0, paddingBottom: compact ? 2 : spacing.sm, borderBottomWidth: compact ? 0 : 1, borderBottomColor: c.borderSubtle }}>
            <Text numberOfLines={compact ? 1 : 2} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{entry.title}</Text>
            <Text style={[typography.caption, { color: c.textMuted }]}>{t(`brain8.history.kind.${entry.kind}` as TranslationKey)} · {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(entry.at))}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function ForesightPanel({ value, onOpen }: { value: BrainForesight; onOpen: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.foresight.title')}</Text>
        <Badge tone="warning" label={t('brain8.foresight.forecast')} />
      </View>
      <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{t(`brain8.foresight.kind.${value.prediction.kind}` as TranslationKey)} · {Math.round(value.prediction.probability)}%</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(`brain8.foresight.reason.${value.prediction.kind}` as TranslationKey)}</Text>
      <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.foresight.note')}</Text>
      <Button label={t('brain8.foresight.action')} variant="secondary" onPress={onOpen} />
    </Card>
  );
}

export function BrainSearchPanel({ query, onChange, onSubmit, results, busy, onOpen }: { query: string; onChange: (value: string) => void; onSubmit: () => void; results: BrainSearchResult[]; busy: boolean; onOpen: (result: BrainSearchResult) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.sm }}>
      <Input label={t('brain8.search.label')} placeholder={t('brain8.search.placeholder')} value={query} onChangeText={onChange} onSubmitEditing={onSubmit} returnKeyType="search" />
      <Button label={busy ? t('state.loading') : t('brain8.search.action')} variant="secondary" onPress={onSubmit} disabled={busy || query.trim().length < 2} />
      {results.map((result) => (
        <Pressable key={`${result.kind}-${result.id}`} accessibilityRole="button" onPress={() => onOpen(result)} style={{ minHeight: 48, justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.borderSubtle }}>
          <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{result.title}</Text>
          <Text style={[typography.caption, { color: c.textMuted }]}>{t(`brain8.search.kind.${result.kind}` as TranslationKey)}</Text>
        </Pressable>
      ))}
    </Card>
  );
}

export function AskBrainPanel({ question, onChange, onAsk, answer, busy, onSelectConcept, onOpenDocument }: { question: string; onChange: (value: string) => void; onAsk: () => void; answer: BrainAnswer | null; busy: boolean; onSelectConcept: (id: string) => void; onOpenDocument: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return (
    <Card style={{ gap: spacing.md, borderColor: c.aiAccent }}>
      <View style={{ gap: 3 }}><Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.ask.title')}</Text><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('brain8.ask.detail')}</Text></View>
      <Input placeholder={t('brain8.ask.placeholder')} value={question} onChangeText={onChange} onSubmitEditing={onAsk} returnKeyType="send" />
      <Button label={busy ? t('state.loading') : t('brain8.ask.action')} variant="ai" onPress={onAsk} disabled={busy || question.trim().length < 2} />
      {answer ? (
        <View accessibilityLiveRegion="polite" style={{ gap: spacing.sm }}>
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(`brain8.ask.answer.${answer.kind}` as TranslationKey).replace('{count}', String(answer.evidenceCount))}</Text>
          {answer.concepts.length > 0 ? <KnowledgeList nodes={answer.concepts} onSelect={onSelectConcept} compact /> : null}
          {answer.documents.map((document) => <SourceCitation key={document.id} title={document.title} kind="document" compact={false} onPress={() => onOpenDocument(document.id)} />)}
          <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.ask.grounded')}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function BrainConceptPanel({ concept, onTutor, onPractice, onReview, onOpenSource, onSelectRelation }: { concept: BrainConceptView; onTutor: () => void; onPractice: () => void; onReview: () => void; onOpenSource: (id: string) => void; onSelectRelation: (id: string) => void }) {
  const { t, locale } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);
  const previewSource = concept.sources.find((source) => source.id === previewSourceId) ?? null;
  const visual = STATUS_VISUAL[concept.node.status];
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}><Text accessible={false}>{visual.icon}</Text><View style={{ flex: 1, minWidth: 0 }}><Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{concept.node.name}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{t(`graph.s.${concept.node.status}` as TranslationKey)}</Text></View></View>
      {concept.description ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{concept.description}</Text> : null}
      {concept.node.mastery !== null ? <View style={{ gap: 4 }}><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('brain8.mastery.value').replace('{value}', String(Math.round(concept.node.mastery * 100)))}</Text><Progress value={concept.node.mastery} tone={concept.node.status === 'mastered' ? 'success' : 'primary'} /></View> : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.mastery.unknown.detail')}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><Badge tone="neutral" label={t('brain8.concept.cards').replace('{count}', String(concept.cardCount))} /><Badge tone={concept.dueCount > 0 ? 'warning' : 'neutral'} label={t('brain8.concept.due').replace('{count}', String(concept.dueCount))} />{concept.memoryStabilityDays !== null ? <Badge tone="info" label={t('brain8.concept.stability').replace('{days}', concept.memoryStabilityDays.toFixed(1))} /> : null}</View>
      {concept.nextReviewAt ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.concept.nextReview').replace('{date}', new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(concept.nextReviewAt)))}</Text> : null}
      <Button label={t('brain8.concept.tutor')} variant="ai" onPress={onTutor} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><Button label={t('brain8.concept.practice')} variant="secondary" size="sm" onPress={onPractice} /><Button label={t('brain8.concept.review')} variant="secondary" size="sm" onPress={onReview} /></View>
      {concept.sources.length > 0 ? <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textMuted }]}>{t('brain8.concept.sources')}</Text>{concept.sources.map((source) => <SourceCitation key={source.id} title={source.title} kind="document" compact={false} onPress={() => setPreviewSourceId(source.id)} />)}{previewSource ? <SourcePreview title={previewSource.title} location={previewSource.subject} kind="document" onOpen={() => onOpenSource(previewSource.id)} onClose={() => setPreviewSourceId(null)} /> : null}{concept.sourcesTruncated ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.concept.truncated')}</Text> : null}</View> : null}
      {concept.relations.length > 0 ? <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textMuted }]}>{t('brain8.concept.relations')}</Text>{concept.relations.map((relation) => <Pressable key={relation.id} onPress={() => onSelectRelation(relation.conceptId)} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={[typography.bodySmall, { color: c.primary }]}>→ {relation.name} · {t(`brain8.relation.${relation.relation}` as TranslationKey)}</Text></Pressable>)}</View> : null}
      {concept.recentInteractions.length > 0 ? <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textMuted }]}>{t('brain8.concept.activity')}</Text>{concept.recentInteractions.map((item) => <Text key={item.id} style={[typography.caption, { color: c.textSecondary }]}>{item.title} · {new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(item.at))}</Text>)}</View> : null}
    </View>
  );
}
