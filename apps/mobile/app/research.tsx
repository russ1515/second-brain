import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  buildDeepResearchPlan,
  createContext,
  isQuotaError,
  type Collection,
  type CreateExperienceSessionRequest,
  type ExperienceProduction,
  type ExperienceSession,
  type ExperienceSourceReference,
  type LibraryDocument,
  type LibraryPage,
  type PersistentWorkspace,
  type ResearchAvailabilityResponse,
  type ResearchDepth,
  type ResearchResult,
  type ResearchScope,
  type ResearchScopeKind,
  type UnifiedResearchCitation,
} from '@second-brain/shared';
import { api, ApiError } from '../lib/client';
import { useAuth } from '../lib/auth-context';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import { useResponsive } from '../lib/responsive';
import { Markdown } from '../components/markdown';
import { ContextBar } from '../components/context/context-bar';
import { Alert, Badge, Button, Card, Input, SegmentedControl } from '../components/ds/core';
import { Page, Section } from '../components/ds/layout';
import { SourceCitation, SourcePreview } from '../components/ds/sources';
import { SmartLoadingState } from '../components/ds/states';
import { Sheet } from '../components/ds/overlays';

const DEPTHS: readonly ResearchDepth[] = ['quick', 'sourced', 'deep'];
const SCOPE_KINDS: readonly ResearchScopeKind[] = ['library', 'brain', 'documents', 'collection', 'external', 'web'];

export default function ResearchScreen() {
  const params = useLocalSearchParams<{ q?: string; depth?: string; experienceSessionId?: string; documentId?: string; title?: string; workspaceId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing, typography, radius } = useTokens();
  const { width } = useResponsive();
  const desktop = width >= 1024;
  const mobile = width < 768;
  const [question, setQuestion] = useState(params.q ?? '');
  const [depth, setDepth] = useState<ResearchDepth>(DEPTHS.includes(params.depth as ResearchDepth) ? params.depth as ResearchDepth : 'sourced');
  const [scopeKinds, setScopeKinds] = useState<ResearchScopeKind[]>(params.documentId ? ['documents'] : ['library']);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(params.documentId ? [params.documentId] : []);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [availability, setAvailability] = useState<ResearchAvailabilityResponse | null>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [sessionId, setSessionId] = useState(params.experienceSessionId ?? '');
  const [selectedCitation, setSelectedCitation] = useState<UnifiedResearchCitation | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void Promise.all([
      api<ResearchAvailabilityResponse>('/research/availability'),
      api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50'),
      api<Collection[]>('/library/collections'),
    ]).then(([nextAvailability, page, nextCollections]) => {
      setAvailability(nextAvailability);
      setDocuments(page.items.filter((item) => item.status === 'ready'));
      setCollections(nextCollections);
    }).catch((caught) => setError((caught as Error).message));
  }, []);

  useEffect(() => {
    if (!params.experienceSessionId) return;
    void api<ExperienceSession>(`/experience-sessions/${params.experienceSessionId}`).then((session) => {
      if (session.type !== 'research') return;
      setSessionId(session.id);
      const metadata = session.currentStep?.metadata;
      if (typeof metadata?.question === 'string') setQuestion(metadata.question);
      if (DEPTHS.includes(metadata?.depth as ResearchDepth)) setDepth(metadata?.depth as ResearchDepth);
      if (Array.isArray(metadata?.scopes)) {
        const restored = metadata.scopes as ResearchScope[];
        setScopeKinds(restored.map((scope) => scope.kind));
        setSelectedDocumentIds(restored.find((scope) => scope.kind === 'documents')?.documentIds ?? []);
        setCollectionId(restored.find((scope) => scope.kind === 'collection')?.collectionId ?? null);
      }
      const saved = session.productions.find((production) => production.kind === 'research-result')?.metadata;
      if (saved && isResearchResult(saved)) setResult(saved as unknown as ResearchResult);
    }).catch((caught) => setError((caught as Error).message));
  }, [params.experienceSessionId]);

  const scopes = useMemo<ResearchScope[]>(() => scopeKinds.map((kind) => {
    if (kind === 'documents') return { kind, documentIds: selectedDocumentIds };
    if (kind === 'collection') return { kind, ...(collectionId ? { collectionId } : {}) };
    return { kind };
  }), [collectionId, scopeKinds, selectedDocumentIds]);

  const contexts = useMemo(() => user ? createContext(user.id, [
    ...scopes.map((scope, index) => ({
    id: `research:${scope.kind}:${scope.collectionId ?? scope.documentIds?.join('-') ?? 'all'}`,
    kind: scope.kind === 'brain' ? 'brain' as const : scope.kind === 'collection' ? 'document-collection' as const : scope.kind === 'documents' ? 'document' as const : 'research' as const,
    scope: 'space' as const,
    referenceId: scope.collectionId ?? scope.documentIds?.[0] ?? scope.kind,
    label: t(`research10.scope.${scope.kind}` as TranslationKey),
    priority: 100 - index,
    visibility: 'visible' as const,
    })),
    ...(params.workspaceId ? [{ id: `workspace:${params.workspaceId}`, kind: 'workspace' as const, scope: 'active-object' as const, referenceId: params.workspaceId, label: t('workspace10.title'), priority: 95, visibility: 'visible' as const }] : []),
  ]).items : [], [params.workspaceId, scopes, t, user]);

  const webAvailable = availability?.external.status === 'available' && availability.external.capabilities.webSearch;
  const selectionReady = scopeKinds.length > 0
    && (!scopeKinds.includes('documents') || selectedDocumentIds.length > 0)
    && (!scopeKinds.includes('collection') || Boolean(collectionId));

  const toggleScope = (kind: ResearchScopeKind) => {
    if ((kind === 'web' || kind === 'external') && !webAvailable) return;
    setResult(null);
    setScopeKinds((current) => current.includes(kind)
      ? current.length === 1 ? current : current.filter((value) => value !== kind)
      : current.length >= 4 ? current : [...current, kind]);
  };

  const requestResearch = async () => {
    if (depth === 'deep' && !showPlan) {
      setShowPlan(true);
      return;
    }
    await runResearch();
  };

  const runResearch = async () => {
    const cleanQuestion = question.trim();
    if (!cleanQuestion || !selectionReady || !user) return;
    setBusy(true);
    setError(null);
    setQuota(false);
    setSelectedCitation(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const createRequest: CreateExperienceSessionRequest = {
          type: 'research',
          title: cleanQuestion.slice(0, 120),
          intent: cleanQuestion.slice(0, 500),
          inputModality: 'text',
          activeContexts: contexts,
          currentStep: { id: 'collect', state: 'active', metadata: { question: cleanQuestion, depth, scopes } },
          progress: { completed: 0, total: depth === 'deep' ? 4 : 3, messageCode: 'research10.running.collect' },
          sourceReferences: [],
          idempotencyKey: `research:${Date.now()}:${cleanQuestion.slice(0, 40)}`,
        };
        const created = await api<ExperienceSession>('/experience-sessions', { method: 'POST', body: createRequest, signal: controller.signal });
        activeSessionId = created.id;
        setSessionId(created.id);
        await api(`/experience-sessions/${created.id}`, {
          method: 'PATCH',
          body: { resumeTarget: { kind: 'experience-session', id: created.id, path: '/research', params: { experienceSessionId: created.id } } },
          signal: controller.signal,
        });
      }
      const nextResult = await api<ResearchResult>('/research/run', {
        method: 'POST', body: { question: cleanQuestion, depth, scopes },
        timeoutMs: depth === 'deep' ? 60_000 : 45_000,
        signal: controller.signal,
      });
      setResult(nextResult);
      setShowPlan(false);
      const sourceReferences: ExperienceSourceReference[] = nextResult.citations.slice(0, 100).map((citation) => ({
        kind: citation.kind === 'document' ? 'document' : citation.kind === 'brain' && citation.conceptId ? 'concept' : 'external-source',
        id: citation.documentId ?? citation.conceptId ?? citation.url ?? citation.id,
        title: citation.title,
      }));
      const production: ExperienceProduction = {
        id: `research-result:${activeSessionId}`,
        kind: 'research-result',
        title: cleanQuestion.slice(0, 120),
        createdAt: nextResult.generatedAt,
        metadata: JSON.parse(JSON.stringify(nextResult)) as Record<string, unknown>,
      };
      await api(`/experience-sessions/${activeSessionId}`, {
        method: 'PATCH',
        body: {
          currentStep: { id: 'result', state: 'completed', metadata: { question: cleanQuestion, depth, scopes } },
          progress: { completed: nextResult.stages.length, total: nextResult.stages.length, ...(nextResult.stages.length ? { percent: 100 } : {}) },
          sourceReferences,
          productions: [production],
          nextBestAction: researchNextBestAction(cleanQuestion),
        },
      });
    } catch (caught) {
      if ((caught as { name?: string }).name === 'AbortError') {
        setError(t('research10.cancelled'));
      } else {
        const apiError = caught as ApiError;
        setQuota(apiError.status === 429 || isQuotaError(apiError.payload));
        setError((caught as Error).message);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const addToWorkspace = async () => {
    if (!result || !sessionId) return;
    setTransferBusy(true);
    setError(null);
    try {
      const researchSource = {
        kind: 'research-source' as const, id: sessionId, title: result.question,
        question: result.question, synthesis: result.synthesis,
        citations: result.citations.map((citation) => ({
              id: citation.id, title: citation.title, kind: citation.kind,
              ...(citation.documentId ? { documentId: citation.documentId } : {}),
              ...(citation.url ? { url: citation.url } : {}),
              excerpt: citation.excerpt,
        })),
      };
      const workspace = params.workspaceId
        ? await (async () => {
          const current = await api<PersistentWorkspace>(`/workspaces/${params.workspaceId}`);
          return api<PersistentWorkspace>(`/workspaces/${params.workspaceId}`, {
            method: 'PATCH',
            body: { sources: [...current.sources.filter((source) => !(source.kind === 'research-source' && source.id === sessionId)), researchSource] },
          });
        })()
        : await api<PersistentWorkspace>('/workspaces', {
          method: 'POST',
          body: {
            title: result.question.slice(0, 120),
            template: 'academic-research',
            objective: result.question,
            sources: [researchSource],
          initialContent: `# ${result.question}\n\n${result.synthesis}`,
          },
        });
      router.push(`/library/workspace/${workspace.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setTransferBusy(false);
    }
  };

  const sourceRail = result?.citations.length ? (
    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.sources')}</Text>
      {result.citations.map((citation, index) => (
        <SourceCitation
          key={citation.id}
          title={citation.title}
          kind={citation.kind}
          provider={citation.provider}
          index={index + 1}
          compact={false}
          onPress={() => setSelectedCitation(citation)}
        />
      ))}
    </Card>
  ) : null;

  const scopeControls = (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {SCOPE_KINDS.map((kind) => {
          const disabled = (kind === 'web' || kind === 'external') && !webAvailable;
          const selected = scopeKinds.includes(kind);
          return <Pressable key={kind} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} onPress={() => toggleScope(kind)} style={{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : c.surfaceSunken, opacity: disabled ? 0.5 : 1 }}>
            <Text style={[typography.bodySmall, { color: selected ? c.onPrimary : c.textPrimary, fontWeight: '700' }]}>{t(`research10.scope.${kind}` as TranslationKey)}</Text>
          </Pressable>;
        })}
      </View>
      {!webAvailable ? <Alert tone="info" title={t('research10.webUnavailable')} detail={t('research10.webUnavailableDetail')} /> : null}
      {scopeKinds.includes('documents') ? <SourceSelector documents={documents} selected={selectedDocumentIds} onToggle={(id) => setSelectedDocumentIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 20 ? [...current, id] : current)} /> : null}
      {scopeKinds.includes('collection') ? <CollectionSelector collections={collections} selected={collectionId} onSelect={setCollectionId} /> : null}
    </View>
  );

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }}>
      <Page width="wide" style={{ gap: spacing.xl, paddingBottom: spacing.huge }} testID="research-experience">
        <View style={{ gap: spacing.xs, maxWidth: 820 }}>
          <Text style={[typography.overline, { color: c.aiAccent }]}>{t('research10.eyebrow')}</Text>
          <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('research10.title')}</Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('research10.subtitle')}</Text>
        </View>

        <Card style={{ gap: spacing.md }} testID="research-query">
          <Input label={t('research10.question')} value={question} onChangeText={(value) => { setQuestion(value); setResult(null); }} placeholder={t('research10.placeholder')} multiline />
          <View style={{ gap: spacing.xs }}>
            <Text style={[typography.label, { color: c.textSecondary }]}>{t('research10.depth')}</Text>
            <SegmentedControl options={DEPTHS} value={depth} onChange={(value) => { setDepth(value); setShowPlan(false); setResult(null); }} labelFor={(value) => t(`research10.depth.${value}`)} />
            <Text style={[typography.caption, { color: c.textMuted }]}>{t(`research10.depth.${depth}.detail` as TranslationKey)}</Text>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.label, { color: c.textSecondary }]}>{t('research10.scope')}</Text>
            {mobile
              ? <Button label={t('research10.scope.edit').replace('{count}', String(scopeKinds.length))} variant="secondary" onPress={() => setScopeOpen(true)} />
              : scopeControls}
          </View>
          <ContextBar items={contexts} />
          {depth === 'deep' ? <Alert tone="warning" title={t('research10.deep.costTitle')} detail={t('research10.deep.costDetail')} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button label={depth === 'deep' && !showPlan ? t('research10.reviewPlan') : t('research10.launch')} variant="ai" onPress={() => void requestResearch()} disabled={!question.trim() || !selectionReady || busy} loading={busy} />
            {busy ? <Button label={t('research10.cancel')} variant="secondary" onPress={() => abortRef.current?.abort()} /> : null}
          </View>
        </Card>

        {showPlan && !busy ? <DeepPlan onLaunch={() => void runResearch()} onCancel={() => setShowPlan(false)} /> : null}
        {quota ? <Alert tone="warning" title={t('research10.quota')} detail={t('research10.quotaDetail')} /> : null}
        {quota ? <Button label={t('research10.openUsage')} variant="secondary" onPress={() => router.push('/usage')} /> : null}
        {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
        {busy ? <SmartLoadingState title={t('research10.running')} detail={t('research10.runningDetail')} /> : null}

        {result ? (
          <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.lg }}>
            <View style={{ flex: 1, minWidth: 0, width: '100%', gap: spacing.lg }}>
              <ResearchResultView result={result} />
              <Section title={t('research10.next')}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  <Button label={t('research10.action.learn')} onPress={() => router.push({ pathname: '/tutor', params: { mode: 'explain', q: result.question, researchSessionId: sessionId } })} />
                  <Button label={t('research10.action.workspace')} variant="secondary" loading={transferBusy} onPress={() => void addToWorkspace()} />
                  {depth !== 'deep' ? <Button label={t('research10.action.deepen')} variant="ghost" onPress={() => { setDepth('deep'); setShowPlan(true); }} /> : null}
                </View>
              </Section>
              {!desktop && sourceRail}
            </View>
            {desktop ? <View style={{ width: 330, flexShrink: 0 }}>{sourceRail}</View> : null}
          </View>
        ) : null}

        {selectedCitation ? <SourcePreview
          title={selectedCitation.title}
          snippet={selectedCitation.excerpt}
          location={selectedCitation.chunkIndex !== undefined ? t('source.passage').replace('{n}', String(selectedCitation.chunkIndex + 1)) : selectedCitation.publishedAt ?? null}
          kind={selectedCitation.kind}
          onOpen={selectedCitation.documentId
            ? () => router.push(`/library/${selectedCitation.documentId}`)
            : selectedCitation.conceptId
              ? () => router.push({ pathname: '/brain', params: { conceptId: selectedCitation.conceptId } })
              : selectedCitation.url
                ? () => void Linking.openURL(selectedCitation.url!)
                : undefined}
          onClose={() => setSelectedCitation(null)}
        /> : null}
        <Sheet visible={mobile && scopeOpen} onClose={() => setScopeOpen(false)} title={t('research10.scope')}>
          <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
            {scopeControls}
          </ScrollView>
          <Button label={t('research10.scope.apply')} onPress={() => setScopeOpen(false)} disabled={!selectionReady} />
        </Sheet>
      </Page>
    </ScrollView>
  );
}

function DeepPlan({ onLaunch, onCancel }: { onLaunch: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <Card style={{ gap: spacing.md }} testID="deep-research-plan">
    <View style={{ gap: spacing.xs }}><Badge label={t('research10.depth.deep')} tone="ai" /><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.plan.title')}</Text></View>
    {buildDeepResearchPlan().map((step, index) => <View key={step.id} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Badge label={String(index + 1)} tone="neutral" /><Text style={[typography.body, { color: c.textSecondary, flex: 1 }]}>{t(step.messageCode as TranslationKey)}</Text></View>)}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}><Button label={t('research10.launch')} variant="ai" onPress={onLaunch} /><Button label={t('research10.cancel')} variant="ghost" onPress={onCancel} /></View>
  </Card>;
}

function ResearchResultView({ result }: { result: ResearchResult }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (!result.citations.length) return <Alert tone="info" title={t('research10.noSources')} detail={t('research10.noSourcesDetail')} />;
  return <View style={{ gap: spacing.lg }} testID="research-result">
    {result.partial ? <Alert tone="warning" title={t('research10.partial')} detail={t('research10.partialDetail')} /> : null}
    <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('research10.synthesis')}</Text><Markdown text={result.synthesis} /></Card>
    {result.keyPoints.length ? <Card style={{ gap: spacing.sm }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.keyPoints')}</Text>{result.keyPoints.map((point, index) => <Text key={index} style={[typography.body, { color: c.textSecondary }]}>• {point}</Text>)}</Card> : null}
    {result.sections.map((section) => <Card key={section.id} style={{ gap: spacing.sm }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{section.title}</Text><Markdown text={section.body} />{section.citationIds.length ? <Text style={[typography.caption, { color: c.textMuted }]}>{section.citationIds.map((id) => `[${id}]`).join(' ')}</Text> : null}</Card>)}
    {result.comparison ? <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.comparison')}</Text><Comparison title={t('research10.agreements')} items={result.comparison.agreements} /><Comparison title={t('research10.divergences')} items={result.comparison.divergences} /><Comparison title={t('research10.specificities')} items={result.comparison.specificities} /></Card> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{result.stages.map((stage) => <Badge key={stage.kind} tone="success" label={`${t(`research10.stage.${stage.kind}` as TranslationKey)}${stage.itemCount !== undefined ? ` · ${stage.itemCount}` : ''}`} />)}</View>
  </View>;
}

function Comparison({ title, items }: { title: string; items: string[] }) {
  const { colors: c, typography } = useTokens();
  if (!items.length) return null;
  return <View><Text style={[typography.label, { color: c.textPrimary }]}>{title}</Text>{items.map((item, index) => <Text key={index} style={[typography.bodySmall, { color: c.textSecondary }]}>• {item}</Text>)}</View>;
}

function SourceSelector({ documents, selected, onToggle }: { documents: LibraryDocument[]; selected: string[]; onToggle: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textSecondary }]}>{t('research10.documents')}</Text>{documents.length ? documents.map((document) => <Pressable key={document.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(document.id) }} onPress={() => onToggle(document.id)} style={{ minHeight: 44, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Text style={{ color: c.primary }}>{selected.includes(document.id) ? '✓' : '○'}</Text><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{document.title}</Text></Pressable>) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('research10.documents.empty')}</Text>}</View>;
}

function CollectionSelector({ collections, selected, onSelect }: { collections: Collection[]; selected: string | null; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textSecondary }]}>{t('research10.collections')}</Text>{collections.length ? collections.map((collection) => <Pressable key={collection.id} accessibilityRole="radio" accessibilityState={{ selected: selected === collection.id }} onPress={() => onSelect(collection.id)} style={{ minHeight: 44, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Text style={{ color: c.primary }}>{selected === collection.id ? '●' : '○'}</Text><Text style={[typography.bodySmall, { color: c.textPrimary }]}>{collection.name}</Text></Pressable>) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('research10.collections.empty')}</Text>}</View>;
}

function researchNextBestAction(question: string) {
  return {
    title: 'Learn this researched topic',
    primaryAction: { label: 'Learn', destination: { kind: 'route' as const, path: '/tutor', params: { mode: 'explain', q: question } } },
    reason: 'A sourced synthesis is ready to turn into active learning.',
    estimatedDuration: null,
    expectedImpact: { kind: 'knowledge' as const, label: 'Connect the researched topic to learning' },
    signalsUsed: [],
    alternatives: [],
    destination: { kind: 'route' as const, path: '/tutor', params: { mode: 'explain', q: question } },
    validUntil: null,
    confidence: null,
    source: { kind: 'session' as const },
  };
}

function isResearchResult(value: Record<string, unknown>): boolean {
  return typeof value.question === 'string' && typeof value.synthesis === 'string' && Array.isArray(value.citations) && Array.isArray(value.scopes);
}
