import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type {
  BrainAnswer,
  BrainConceptView,
  BrainGraphPage,
  BrainOverview,
  BrainSearchPage,
  BrainSearchResult,
  BrainView,
  ContextItem,
  ExperienceSession,
  LearningMemoryPage,
  RlleCourseView,
  TwinGraphNode,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useI18n } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { actionDestinationHref } from '../../lib/action-destination';
import { loadBrainCache, saveBrainCache } from '../../lib/brain-cache';
import { Badge, Button, Card, Skeleton } from '../../components/ds/core';
import { ContextBar } from '../../components/context/context-bar';
import { KnowledgeGraph, MasteryLegend } from '../../components/brain/knowledge-graph';
import { ProgressNarrative } from '../../components/tutor/experience';
import { BrainLanguageEvidence } from '../../components/language/course-ui';
import {
  AskBrainPanel,
  BrainMaturitySummary,
  BrainNavigation,
  BrainNextActionPanel,
  BrainSearchPanel,
  BrainConceptPanel,
  ForesightPanel,
  HistoryTimeline,
  KnowledgeList,
  LearningProfilePanel,
  MemorySummaryPanel,
  SparseBrain,
  StrengthFragility,
} from '../../components/brain/digital-twin';

const BRAIN_VIEWS: BrainView[] = ['overview', 'knowledge', 'learning', 'memory', 'history'];

/** Mon Cerveau — a maturity-aware, evidence-only cognitive digital twin. */
export default function BrainScreen() {
  const params = useLocalSearchParams<{ view?: string | string[]; conceptId?: string | string[]; documentId?: string | string[]; sessionId?: string | string[]; goalId?: string | string[]; languageProfileId?: string | string[] }>();
  const documentId = first(params.documentId);
  const routeConceptId = first(params.conceptId);
  const sessionId = first(params.sessionId);
  const goalId = first(params.goalId);
  const languageProfileId = first(params.languageProfileId);
  const routeView = normalizeView(first(params.view));
  const { user } = useAuth();
  const { t, formatLocale } = useI18n();
  const router = useRouter();
  const { colors: c, radius, spacing, typography } = useTokens();
  const { width, maxContentWidth } = useResponsive();
  const wide = width >= 900;

  const [view, setView] = useState<BrainView>(routeView);
  const [overview, setOverview] = useState<BrainOverview | null>(null);
  const [graph, setGraph] = useState<BrainGraphPage | null>(null);
  const [history, setHistory] = useState<LearningMemoryPage | null>(null);
  const [experience, setExperience] = useState<ExperienceSession | null>(null);
  const [languageCourse, setLanguageCourse] = useState<RlleCourseView | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(routeConceptId ?? null);
  const [concept, setConcept] = useState<BrainConceptView | null>(null);
  const [conceptLoading, setConceptLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staleAt, setStaleAt] = useState<string | null>(null);
  const [knowledgeMode, setKnowledgeMode] = useState<'list' | 'graph'>(wide ? 'graph' : 'list');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BrainSearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<BrainAnswer | null>(null);
  const [askBusy, setAskBusy] = useState(false);

  useEffect(() => setView(routeView), [routeView]);
  useEffect(() => {
    if (!wide) setKnowledgeMode('list');
  }, [wide]);

  const openConcept = useCallback(async (id: string, switchView = true) => {
    setSelectedId(id);
    if (switchView) setView('knowledge');
    setConceptLoading(true);
    try {
      setConcept(await api<BrainConceptView>(`/brain/concepts/${encodeURIComponent(id)}`));
    } catch {
      setConcept(null);
    } finally {
      setConceptLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const graphQuery = documentId ? `?limit=40&documentId=${encodeURIComponent(documentId)}` : '?limit=40';
    const [overviewResult, graphResult, experienceResult, languageCourseResult] = await Promise.allSettled([
      api<BrainOverview>('/brain/overview'),
      api<BrainGraphPage>(`/brain/graph${graphQuery}`),
      sessionId ? api<ExperienceSession>(`/experience-sessions/${encodeURIComponent(sessionId)}`) : Promise.resolve(null),
      languageProfileId
        ? api<RlleCourseView>(`/languages/${encodeURIComponent(languageProfileId)}/course`)
        : Promise.resolve(null),
    ]);
    let nextOverview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
    let nextGraph = graphResult.status === 'fulfilled' ? graphResult.value : null;
    if (!nextOverview || !nextGraph) {
      const cached = await loadBrainCache(user.id);
      if (cached) {
        nextOverview ??= cached.overview;
        nextGraph ??= cached.graph;
        setStaleAt(cached.savedAt);
      }
    } else {
      setStaleAt(null);
      void saveBrainCache(user.id, nextOverview, nextGraph);
    }
    setOverview(nextOverview);
    setGraph(nextGraph);
    if (experienceResult.status === 'fulfilled') setExperience(experienceResult.value);
    setLanguageCourse(languageCourseResult.status === 'fulfilled' ? languageCourseResult.value : null);
    if (!nextOverview && !nextGraph) setError(t('brain8.error.load'));
    const initialConceptId = routeConceptId ?? (documentId ? nextGraph?.nodes[0]?.id : undefined);
    if (initialConceptId) void openConcept(initialConceptId, false);
    setLoading(false);
  }, [documentId, languageProfileId, openConcept, routeConceptId, sessionId, t, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    if (view !== 'history' || history || !user) return;
    void api<LearningMemoryPage>('/memory/page?limit=20').then(setHistory).catch(() => undefined);
  }, [history, user, view]);

  const contextItems = useMemo<ContextItem[]>(() => {
    const now = new Date().toISOString();
    const items: ContextItem[] = [{ id: 'brain-space', kind: 'brain', scope: 'space', label: t('brain.title'), priority: 20, visibility: 'visible', addedAt: now }];
    if (documentId) {
      const title = overview?.recentDocuments.find((document) => document.id === documentId)?.title;
      items.push({ id: `document-${documentId}`, kind: 'document', scope: 'active-object', referenceId: documentId, label: title ?? t('brain8.context.document'), priority: 50, visibility: 'visible', addedAt: now });
    }
    if (selectedId && concept) items.push({ id: `concept-${selectedId}`, kind: 'concept', scope: 'active-object', referenceId: selectedId, label: concept.node.name, priority: 60, visibility: 'visible', addedAt: now });
    if (sessionId) items.push({ id: `session-${sessionId}`, kind: 'tutor-session', scope: 'experience-session', referenceId: sessionId, label: experience?.title ?? t('brain8.context.session'), priority: 40, visibility: 'summary', addedAt: now });
    if (goalId) items.push({ id: `goal-${goalId}`, kind: 'goal', scope: 'experience-session', referenceId: goalId, label: t('brain8.context.goal'), priority: 35, visibility: 'summary', addedAt: now });
    if (languageProfileId) items.push({ id: `language-${languageProfileId}`, kind: 'language', scope: 'active-object', referenceId: languageProfileId, label: languageCourse?.languageCode.toUpperCase() ?? languageProfileId, priority: 55, visibility: 'visible', addedAt: now });
    return items;
  }, [concept, documentId, experience?.title, goalId, languageCourse?.languageCode, languageProfileId, overview?.recentDocuments, selectedId, sessionId, t]);

  const navigate = (href: string) => router.push(href as never);
  const openNextAction = () => overview?.nextBestAction && navigate(actionDestinationHref(overview.nextBestAction.destination));
  const openDocument = (id: string) => navigate(`/library/${encodeURIComponent(id)}`);
  const dueCount = overview?.nextPathItems.reduce((sum, item) => sum + item.dueCount, 0) ?? 0;

  const submitSearch = async () => {
    if (searchQuery.trim().length < 2 || searchBusy) return;
    setSearchBusy(true);
    try {
      const result = await api<BrainSearchPage>(`/brain/search?q=${encodeURIComponent(searchQuery.trim())}&limit=12`);
      setSearchResults(result.items);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  };
  const submitQuestion = async () => {
    if (question.trim().length < 2 || askBusy) return;
    setAskBusy(true);
    try {
      setAnswer(await api<BrainAnswer>('/brain/ask', { method: 'POST', body: { question: question.trim() } }));
    } catch {
      setAnswer({ kind: 'no-results', concepts: [], documents: [], evidenceCount: 0, grounded: true });
    } finally {
      setAskBusy(false);
    }
  };
  const openSearchResult = (result: BrainSearchResult) => {
    if (result.kind === 'concept') void openConcept(result.id);
    else navigate(actionDestinationHref(result.destination));
  };
  const loadMoreGraph = async () => {
    if (!graph?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    const documentQuery = documentId ? `&documentId=${encodeURIComponent(documentId)}` : '';
    try {
      const next = await api<BrainGraphPage>(`/brain/graph?limit=40&cursor=${encodeURIComponent(graph.nextCursor)}${documentQuery}`);
      setGraph({ ...next, nodes: [...graph.nodes, ...next.nodes], edges: dedupeEdges([...graph.edges, ...next.edges]) });
    } finally {
      setLoadingMore(false);
    }
  };
  const loadMoreHistory = async () => {
    if (!history?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await api<LearningMemoryPage>(`/memory/page?limit=20&cursor=${encodeURIComponent(history.nextCursor)}`);
      setHistory({ ...next, entries: [...history.entries, ...next.entries] });
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading && !overview && !graph) return <BrainSkeleton maxWidth={maxContentWidth} />;
  if (error && !overview) {
    return <ScrollView contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}><Card style={{ gap: spacing.md }}><Text accessibilityRole="alert" style={[typography.h2, { color: c.textPrimary }]}>{error}</Text><Button label={t('app.tryAgain')} onPress={() => void load()} /></Card></ScrollView>;
  }
  if (!overview) return null;

  const recentNodes = graph?.nodes.slice(0, overview.maturity.level === 'sparse' ? 4 : 8) ?? [];
  return (
    <>
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.container, { maxWidth: maxContentWidth }]}>
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>🧠 {t('brain.title')}</Text>
          <Text style={[typography.body, { color: c.textSecondary, maxWidth: 760 }]}>{t('brain8.intro')}</Text>
        </View>
        <ContextBar items={contextItems} />
        {staleAt ? <Card style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Badge tone="warning" label={t('state.stale')} /><Text style={[typography.caption, { color: c.textMuted }]}>{new Intl.DateTimeFormat(formatLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(staleAt))}</Text></Card> : null}
        {overview.partial ? <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: c.warning }]}>{t('brain8.partial')}</Text> : null}
        {experience?.twinImpact ? <ProgressNarrative session={experience} /> : null}
        {languageCourse && languageProfileId ? (
          <BrainLanguageEvidence
            course={languageCourse}
            onOpenCourse={() => navigate(`/languages/${encodeURIComponent(languageProfileId)}/course`)}
          />
        ) : null}
        <BrainNavigation value={view} onChange={setView} />

        {view === 'overview' ? (
          overview.maturity.level === 'sparse' ? (
            <>
              <BrainMaturitySummary maturity={overview.maturity} />
              <SparseBrain documents={overview.recentDocuments} concepts={recentNodes} activity={overview.memory?.recentEntries ?? []} onLearn={() => navigate('/learn')} onImport={() => navigate('/library?import=1')} onGoal={() => navigate('/goals')} onOpenDocument={openDocument} onSelectConcept={(id) => void openConcept(id)} />
              <AskBrainPanel question={question} onChange={setQuestion} onAsk={() => void submitQuestion()} answer={answer} busy={askBusy} onSelectConcept={(id) => void openConcept(id)} onOpenDocument={openDocument} />
            </>
          ) : (
            <>
              <BrainMaturitySummary maturity={overview.maturity} />
              {overview.nextBestAction ? <BrainNextActionPanel action={overview.nextBestAction} onOpen={openNextAction} /> : null}
              {overview.strengths ? <StrengthFragility value={overview.strengths} onSelect={(id) => void openConcept(id)} /> : null}
              <Card style={{ gap: spacing.md }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, alignItems: 'center' }}><Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.recent.knowledge')}</Text><Button label={t('brain8.openKnowledge')} size="sm" variant="ghost" onPress={() => setView('knowledge')} /></View><KnowledgeList nodes={recentNodes} onSelect={(id) => void openConcept(id)} compact /></Card>
              {overview.memory ? <MemorySummaryPanel summary={overview.memory.summary} dueCount={dueCount} onOpen={() => setView('memory')} /> : null}
              {overview.foresight ? <ForesightPanel value={overview.foresight} onOpen={() => overview.nextBestAction ? openNextAction() : setView('knowledge')} /> : null}
              <AskBrainPanel question={question} onChange={setQuestion} onAsk={() => void submitQuestion()} answer={answer} busy={askBusy} onSelectConcept={(id) => void openConcept(id)} onOpenDocument={openDocument} />
            </>
          )
        ) : null}

        {view === 'knowledge' ? (
          <View style={{ gap: spacing.md }}>
            <BrainSearchPanel query={searchQuery} onChange={setSearchQuery} onSubmit={() => void submitSearch()} results={searchResults} busy={searchBusy} onOpen={openSearchResult} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><Button label={t('brain8.knowledge.list')} variant={knowledgeMode === 'list' ? 'primary' : 'secondary'} size="sm" onPress={() => setKnowledgeMode('list')} /><Button label={t('brain8.knowledge.graph')} variant={knowledgeMode === 'graph' ? 'primary' : 'secondary'} size="sm" onPress={() => setKnowledgeMode('graph')} /></View>
            <View style={wide ? { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' } : undefined}>
              <View style={{ flex: 1.6, gap: spacing.sm, minWidth: 0 }}>
                {knowledgeMode === 'graph' && graph && graph.nodes.length > 0 ? <><KnowledgeGraph graph={graph} selectedId={selectedId} onSelect={(node) => void openConcept(node.id, false)} height={wide ? 560 : 420} /><MasteryLegend /><Text style={[typography.caption, { color: c.textMuted }]}>{t('brain8.graph.bounded').replace('{shown}', String(graph.nodes.length)).replace('{total}', String(graph.total))}</Text></> : <KnowledgeList nodes={graph?.nodes ?? []} selectedId={selectedId} onSelect={(id) => void openConcept(id, false)} />}
                {graph?.nextCursor ? <Button label={loadingMore ? t('state.loading') : t('brain8.loadMore')} variant="secondary" onPress={() => void loadMoreGraph()} disabled={loadingMore} /> : null}
              </View>
              {wide ? <Card style={{ flex: 1, minWidth: 300 }}>{conceptLoading ? <Skeleton height={260} /> : concept ? <BrainConceptPanel concept={concept} onTutor={() => navigate(`/tutor?mode=explain&conceptId=${encodeURIComponent(concept.node.id)}&conceptName=${encodeURIComponent(concept.node.name)}${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ''}`)} onPractice={() => navigate(`/examiner?type=exercise&topic=${encodeURIComponent(concept.node.name)}&conceptId=${encodeURIComponent(concept.node.id)}`)} onReview={() => navigate(`/revision?conceptId=${encodeURIComponent(concept.node.id)}`)} onOpenSource={openDocument} onSelectRelation={(id) => void openConcept(id, false)} /> : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('brain8.concept.pick')}</Text>}</Card> : null}
            </View>
          </View>
        ) : null}

        {view === 'learning' ? <LearningProfilePanel declared={overview.declaredProfile} observed={overview.learnerProfile} dna={overview.learningDna} /> : null}
        {view === 'memory' ? <View style={{ gap: spacing.md }}>{overview.memory ? <MemorySummaryPanel summary={overview.memory.summary} dueCount={dueCount} onOpen={() => setView('history')} /> : null}<Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.memory.fragile')}</Text><KnowledgeList nodes={(graph?.nodes ?? []).filter((node) => node.status === 'at_risk')} onSelect={(id) => void openConcept(id)} compact /><Button label={t('brain8.memory.review')} variant="secondary" onPress={() => navigate('/revision')} /></Card></View> : null}
        {view === 'history' ? <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('brain8.history.title')}</Text><HistoryTimeline entries={history?.entries ?? overview.memory?.recentEntries ?? []} />{history?.nextCursor ? <Button label={loadingMore ? t('state.loading') : t('brain8.loadMore')} variant="secondary" onPress={() => void loadMoreHistory()} disabled={loadingMore} /> : null}</Card> : null}
      </ScrollView>

      {!wide ? (
        <Modal visible={Boolean(concept) && view === 'knowledge'} transparent animationType="none" onRequestClose={() => setConcept(null)}>
          <Pressable style={styles.backdrop} onPress={() => setConcept(null)} accessibilityLabel={t('app.dismiss')}>
            <Pressable accessibilityViewIsModal style={[styles.sheet, { backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }]} onPress={(event) => event.stopPropagation()}>
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
                <Button label={t('app.dismiss')} variant="ghost" size="sm" onPress={() => setConcept(null)} />
                {conceptLoading ? <Skeleton height={300} /> : concept ? <BrainConceptPanel concept={concept} onTutor={() => navigate(`/tutor?mode=explain&conceptId=${encodeURIComponent(concept.node.id)}&conceptName=${encodeURIComponent(concept.node.name)}${documentId ? `&documentId=${encodeURIComponent(documentId)}` : ''}`)} onPractice={() => navigate(`/examiner?type=exercise&topic=${encodeURIComponent(concept.node.name)}&conceptId=${encodeURIComponent(concept.node.id)}`)} onReview={() => navigate(`/revision?conceptId=${encodeURIComponent(concept.node.id)}`)} onOpenSource={openDocument} onSelectRelation={(id) => void openConcept(id, false)} /> : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

function first(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeView(value?: string): BrainView {
  if (value && BRAIN_VIEWS.includes(value as BrainView)) return value as BrainView;
  return 'overview';
}

function dedupeEdges<T extends { id: string }>(edges: T[]): T[] {
  return [...new Map(edges.map((edge) => [edge.id, edge])).values()];
}

function BrainSkeleton({ maxWidth }: { maxWidth: number }) {
  return <ScrollView contentContainerStyle={[styles.container, { maxWidth }]}><Skeleton height={40} width="55%" /><Skeleton height={48} /><Skeleton height={150} /><Skeleton height={240} /></ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16, width: '100%', alignSelf: 'center', paddingBottom: 72 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '88%', minHeight: '45%' },
});
