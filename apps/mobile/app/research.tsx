import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  buildDeepResearchPlan,
  createContext,
  isQuotaError,
  resolveDocumentPipeline,
  type Collection,
  type CreateExperienceSessionRequest,
  type DocumentDetail,
  type ExperienceSession,
  type InputModality,
  type LibraryDocument,
  type LibraryPage,
  type PersistentWorkspace,
  type ResearchAvailabilityResponse,
  type ResearchDepth,
  type ResearchResult,
  type ResearchScope,
  type ResearchScopeKind,
  type TranscriptionResult,
  type UnifiedResearchCitation,
} from '@second-brain/shared';
import { api, ApiError, apiUpload } from '../lib/client';
import { createClientRequestId } from '../lib/request-id';
import { useAuth } from '../lib/auth-context';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import { useResponsive } from '../lib/responsive';
import { pickDocuments, uploadPickedDocument } from '../lib/document-import';
import { createRecorder, RECORDING_SUPPORTED, type Recorder } from '../lib/recorder';
import { Markdown } from '../components/markdown';
import { ContextBar } from '../components/context/context-bar';
import { Alert, Badge, Button, Card, Input, SegmentedControl } from '../components/ds/core';
import { Page, Section } from '../components/ds/layout';
import { SourceCitation, SourcePreview } from '../components/ds/sources';
import { SmartLoadingState } from '../components/ds/states';
import { Sheet } from '../components/ds/overlays';

const DEPTHS: readonly ResearchDepth[] = ['quick', 'sourced', 'deep'];
const SCOPE_KINDS: readonly ResearchScopeKind[] = ['library', 'brain', 'documents', 'collection', 'external', 'web'];

interface ResearchAttachment {
  id: string;
  name: string;
  status: DocumentDetail['status'] | null;
}

export default function ResearchScreen() {
  const params = useLocalSearchParams<{ q?: string; depth?: string; experienceSessionId?: string; documentId?: string; documentTitle?: string; captureStatus?: string; title?: string; workspaceId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing, typography, radius } = useTokens();
  const { width } = useResponsive();
  const mobile = width < 768;
  const [question, setQuestion] = useState(params.q ?? '');
  const [depth, setDepth] = useState<ResearchDepth>(DEPTHS.includes(params.depth as ResearchDepth) ? params.depth as ResearchDepth : 'sourced');
  const [scopeKinds, setScopeKinds] = useState<ResearchScopeKind[]>(params.documentId ? ['documents'] : ['library']);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(params.documentId ? [params.documentId] : []);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [availability, setAvailability] = useState<ResearchAvailabilityResponse | null>(null);
  const [documents, setDocuments] = useState<Array<Pick<LibraryDocument, 'id' | 'title'>>>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [sessionId, setSessionId] = useState(params.experienceSessionId ?? '');
  const [selectedCitation, setSelectedCitation] = useState<UnifiedResearchCitation | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachmentName, setPendingAttachmentName] = useState<string | null>(null);
  const [attachedSource, setAttachedSource] = useState<ResearchAttachment | null>(() => params.documentId ? {
    id: params.documentId,
    name: params.documentTitle ?? params.title ?? '',
    status: documentStatusFromParam(params.captureStatus),
  } : null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [inputModality, setInputModality] = useState<InputModality>(params.documentId ? 'file' : 'text');
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const transferInFlightRef = useRef(false);
  const workspaceTransferRequestRef = useRef<{ signature: string; requestId: string } | null>(null);

  useEffect(() => {
    void Promise.all([
      api<ResearchAvailabilityResponse>('/research/availability'),
      api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50'),
      api<Collection[]>('/library/collections'),
    ]).then(([nextAvailability, page, nextCollections]) => {
      setAvailability(nextAvailability);
      setDocuments((current) => {
        const ready = page.items.filter((item) => item.status === 'ready').map(({ id, title }) => ({ id, title }));
        const imported = current.filter((item) => !ready.some((candidate) => candidate.id === item.id));
        return [...imported, ...ready];
      });
      setCollections(nextCollections);
    }).catch((caught) => setError((caught as Error).message));
  }, []);

  useEffect(() => () => recorderRef.current?.cancel(), []);

  useEffect(() => {
    const documentId = attachedSource?.id;
    if (!documentId || isTerminalDocumentStatus(attachedSource.status)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const document = await api<DocumentDetail>(`/library/documents/${encodeURIComponent(documentId)}`);
        if (cancelled) return;
        setAttachedSource((current) => current?.id === documentId
          ? { id: document.id, name: document.title, status: document.status }
          : current);
        if (!isTerminalDocumentStatus(document.status)) timer = setTimeout(() => void poll(), 2_000);
      } catch {
        if (!cancelled) timer = setTimeout(() => void poll(), 4_000);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [attachedSource?.id]);

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

  const webAvailable = availability?.web.status === 'available' && availability.web.capabilities.webSearch;
  const externalAvailable = availability?.external.status === 'available' && availability.external.capabilities.externalSearch;
  const attachedSourceReady = !attachedSource || attachedSource.status === 'ready' || attachedSource.status === 'partial';
  const selectionReady = scopeKinds.length > 0
    && (!scopeKinds.includes('documents') || selectedDocumentIds.length > 0)
    && (!scopeKinds.includes('collection') || Boolean(collectionId))
    && attachedSourceReady;

  const toggleScope = (kind: ResearchScopeKind) => {
    if (kind === 'web' && !webAvailable) return;
    if (kind === 'external' && !externalAvailable) return;
    setResult(null);
    setScopeKinds((current) => current.includes(kind)
      ? current.length === 1 ? current : current.filter((value) => value !== kind)
      : current.length >= 4 ? current : [...current, kind]);
  };

  const attachDocument = (document: DocumentDetail) => {
    setAttachedSource({ id: document.id, name: document.title, status: document.status });
    setDocuments((current) => current.some((item) => item.id === document.id)
      ? current
      : [{ id: document.id, title: document.title }, ...current]);
    setSelectedDocumentIds((current) => current.includes(document.id) ? current : [...current, document.id].slice(0, 20));
    setScopeKinds((current): ResearchScopeKind[] => current.length === 1 && current[0] === 'library'
      ? ['documents']
      : current.includes('documents') ? current : ['documents' as const, ...current].slice(0, 4));
    setInputModality('file');
    setResult(null);
  };

  const chooseFile = async () => {
    setCaptureOpen(false);
    setError(null);
    setQuota(false);
    try {
      const picked = (await pickDocuments(false, false))[0];
      if (!picked) return;
      setPendingAttachmentName(picked.name);
      setUploading(true);
      const document = await uploadPickedDocument(picked, createClientRequestId('research-import'));
      attachDocument(document);
    } catch (caught) {
      const apiError = caught as ApiError;
      setQuota(apiError.status === 429 || isQuotaError(apiError.payload));
      setError((caught as Error).message || t('learn5.error.generic'));
    } finally {
      setPendingAttachmentName(null);
      setUploading(false);
    }
  };

  const openPhoto = () => {
    setCaptureOpen(false);
    router.push({
      pathname: '/scan',
      params: {
        source: 'research',
        captureType: 'photo',
        ...(question.trim() ? { researchQuestion: question.trim() } : {}),
        researchDepth: depth,
        ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
      },
    });
  };

  const toggleVoice = async () => {
    if (!RECORDING_SUPPORTED || busy || uploading || transcribing) return;
    setError(null);
    try {
      if (!recording) {
        recorderRef.current = createRecorder();
        await recorderRef.current.start();
        setRecording(true);
        return;
      }
      const recordingResult = await recorderRef.current!.stop();
      recorderRef.current = null;
      setRecording(false);
      setTranscribing(true);
      const form = new FormData();
      form.append('audio', recordingResult.blob, `research-query.${audioExtension(recordingResult.mimeType)}`);
      if (recordingResult.durationMs !== undefined) form.append('durationMs', String(recordingResult.durationMs));
      const transcript = await apiUpload<TranscriptionResult>('/speech/stt', form);
      setQuestion(transcript.text);
      setInputModality('voice');
      setResult(null);
    } catch (caught) {
      recorderRef.current?.cancel();
      recorderRef.current = null;
      setRecording(false);
      setError((caught as Error).message || t('learn5.voice.error'));
    } finally {
      setTranscribing(false);
    }
  };

  const detachDocument = () => {
    if (!attachedSource) return;
    setSelectedDocumentIds((current) => current.filter((id) => id !== attachedSource.id));
    setAttachedSource(null);
    setScopeKinds((current) => {
      if (!current.includes('documents')) return current;
      const next = current.filter((kind) => kind !== 'documents');
      return next.length ? next : ['library'];
    });
    setResult(null);
  };

  const requestResearch = async () => {
    if (depth === 'deep' && !showPlan) {
      setShowPlan(true);
      return;
    }
    await runResearch();
  };

  const runResearch = async (questionOverride?: string) => {
    const cleanQuestion = (questionOverride ?? question).trim();
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
          inputModality: attachedSource ? 'mixed' : inputModality,
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
        method: 'POST', body: { question: cleanQuestion, depth, scopes, experienceSessionId: activeSessionId },
        timeoutMs: depth === 'deep' ? 60_000 : 45_000,
        signal: controller.signal,
      });
      setResult(nextResult);
      setShowPlan(false);
      await api(`/experience-sessions/${activeSessionId}`, {
        method: 'PATCH',
        body: {
          currentStep: { id: 'result', state: 'completed', metadata: { question: cleanQuestion, depth, scopes } },
          progress: { completed: nextResult.stages.length, total: nextResult.stages.length, ...(nextResult.stages.length ? { percent: 100 } : {}) },
          nextBestAction: researchNextBestAction(cleanQuestion, t),
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
    if (!result || !sessionId || transferInFlightRef.current) return;
    transferInFlightRef.current = true;
    setTransferBusy(true);
    setError(null);
    try {
      const researchSource = { kind: 'research-source' as const, id: sessionId };
      const workspace = params.workspaceId
        ? await (async () => {
          const current = await api<PersistentWorkspace>(`/workspaces/${params.workspaceId}`);
          return api<PersistentWorkspace>(`/workspaces/${params.workspaceId}`, {
            method: 'PATCH',
            body: {
              expectedRevision: current.autosaveRevision,
              sources: [...current.sources.filter((source) => !(source.kind === 'research-source' && source.id === sessionId)), researchSource],
            },
          });
        })()
        : await (async () => {
          const body = {
            title: result.question.slice(0, 120),
            template: 'academic-research',
            objective: result.question,
            sources: [researchSource],
            initialContent: `# ${result.question}\n\n${result.synthesis}`,
          } as const;
          const signature = JSON.stringify(body);
          if (workspaceTransferRequestRef.current?.signature !== signature) {
            workspaceTransferRequestRef.current = {
              signature,
              requestId: createClientRequestId('workspace'),
            };
          }
          const requestId = workspaceTransferRequestRef.current.requestId;
          return api<PersistentWorkspace>('/workspaces', {
            method: 'POST',
            body: { ...body, requestId },
            requestId,
          });
        })();
      router.push(`/library/workspace/${workspace.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      transferInFlightRef.current = false;
      setTransferBusy(false);
    }
  };

  const sourceStrip = result?.citations.length ? (
    <View style={{ gap: spacing.sm }} testID="research-source-strip">
      <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.sources')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xs }}>
        {result.citations.map((citation, index) => (
          <View key={citation.id} style={{ width: mobile ? 230 : 270 }}>
            <Card style={{ minHeight: 112, gap: spacing.xs }}>
              <SourceCitation
                title={citation.title}
                kind={citation.kind}
                provider={citation.provider}
                index={index + 1}
                compact={false}
                onPress={() => setSelectedCitation(citation)}
              />
              <Text numberOfLines={2} style={[typography.caption, { color: c.textMuted }]}>
                {sourceLocation(citation, t)}
              </Text>
            </Card>
          </View>
        ))}
      </ScrollView>
    </View>
  ) : null;

  const followUps = ((result as (ResearchResult & { followUpQuestions?: string[] }) | null)?.followUpQuestions ?? []).slice(0, 3);

  const runFollowUp = (nextQuestion: string) => {
    setQuestion(nextQuestion);
    setResult(null);
    setSelectedCitation(null);
    if (depth === 'deep') {
      setShowPlan(true);
      return;
    }
    void runResearch(nextQuestion);
  };

  const scopeControls = (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {SCOPE_KINDS.map((kind) => {
          const disabled = (kind === 'web' && !webAvailable) || (kind === 'external' && !externalAvailable);
          const selected = scopeKinds.includes(kind);
          return <Pressable key={kind} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} accessibilityLabel={disabled ? `${t(`research10.scope.${kind}` as TranslationKey)} · ${t(kind === 'web' ? 'research10.webUnavailable' : 'research10.externalUnavailable')}` : undefined} accessibilityHint={disabled ? t(kind === 'web' ? 'research10.webUnavailableDetail' : 'research10.externalUnavailableDetail') : undefined} onPress={() => toggleScope(kind)} style={{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : c.surfaceSunken, opacity: disabled ? 0.58 : 1 }}>
            <Text style={[typography.bodySmall, { color: selected ? c.onPrimary : c.textPrimary, fontWeight: '700' }]}>{t(`research10.scope.${kind}` as TranslationKey)}{disabled ? ' ⚠' : ''}</Text>
          </Pressable>;
        })}
      </View>
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
          <Input label={t('research10.question')} value={question} onChangeText={(value) => { setQuestion(value); setInputModality('text'); setResult(null); }} placeholder={t('research10.placeholder')} multiline />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }} testID="research-universal-input-actions">
            <Button
              label={recording ? t('voice11.transcribe') : t('learn5.modality.speak')}
              icon={recording ? '■' : '◉'}
              variant={recording ? 'secondary' : 'ghost'}
              disabled={!RECORDING_SUPPORTED || busy || uploading || transcribing}
              loading={transcribing}
              onPress={() => void toggleVoice()}
            />
            <Button label={t('learn5.modality.capture')} icon="▣" variant="ghost" disabled={busy || uploading || transcribing || recording} onPress={() => setCaptureOpen(true)} />
            {!RECORDING_SUPPORTED ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.voice.unavailable')}</Text> : null}
          </View>
          {uploading || attachedSource ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: c.surfaceSunken }} testID="research-attached-source">
              <Text accessible={false} style={{ fontSize: 22 }}>▤</Text>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{pendingAttachmentName ?? attachedSource?.name}</Text>
                <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: c.textMuted }]}>
                  {uploading
                    ? t('document.pipeline.queued')
                    : attachedSource?.status
                      ? t(resolveDocumentPipeline(attachedSource.status, null).messageCode as TranslationKey)
                      : t('document.pipeline.queued')}
                </Text>
              </View>
              {attachedSource && !uploading ? <Button label={t('learn5.attachment.remove')} variant="ghost" size="sm" onPress={detachDocument} /> : null}
            </View>
          ) : null}
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
            <Button label={depth === 'deep' && !showPlan ? t('research10.reviewPlan') : t('research10.launch')} variant="ai" onPress={() => void requestResearch()} disabled={!question.trim() || !selectionReady || busy || uploading || transcribing || recording} loading={busy} />
            {busy ? <Button label={t('research10.cancel')} variant="secondary" onPress={() => abortRef.current?.abort()} /> : null}
          </View>
        </Card>

        {showPlan && !busy ? <DeepPlan onLaunch={() => void runResearch()} onCancel={() => setShowPlan(false)} /> : null}
        {quota ? <Alert tone="warning" title={t('research10.quota')} detail={t('research10.quotaDetail')} /> : null}
        {quota ? <Button label={t('research10.openUsage')} variant="secondary" onPress={() => router.push('/usage')} /> : null}
        {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
        {busy ? <SmartLoadingState title={t('research10.running')} detail={t('research10.runningDetail')} /> : null}

        {result ? (
          <View style={{ width: '100%', gap: spacing.lg }}>
            {sourceStrip}
            <ResearchResultView result={result} onCitation={(id) => {
              const citation = result.citations.find((item) => item.id === id);
              if (citation) setSelectedCitation(citation);
            }} />
            {followUps.length ? (
              <Section title={t('researchV1.followUps')}>
                <View style={{ gap: spacing.xs }} testID="research-follow-ups">
                  {followUps.map((followUp, index) => (
                    <Button key={`${index}:${followUp}`} fullWidth variant="secondary" label={followUp} disabled={busy} onPress={() => runFollowUp(followUp)} />
                  ))}
                </View>
              </Section>
            ) : null}
            <Section title={t('research10.next')}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                <Button label={t('research10.action.learn')} onPress={() => router.push({ pathname: '/tutor', params: { mode: 'explain', q: result.question, researchSessionId: sessionId } })} />
                <Button label={t('research10.action.workspace')} variant="secondary" loading={transferBusy} onPress={() => void addToWorkspace()} />
                {depth !== 'deep' ? <Button label={t('research10.action.deepen')} variant="ghost" onPress={() => { setDepth('deep'); setShowPlan(true); }} /> : null}
              </View>
            </Section>
          </View>
        ) : null}

        {selectedCitation ? <SourcePreview
          title={selectedCitation.title}
          snippet={selectedCitation.excerpt}
          location={selectedCitation.pageNumber !== undefined
            ? `📄 ${selectedCitation.pageNumber}`
            : selectedCitation.chunkIndex !== undefined
              ? t('source.passage').replace('{n}', String(selectedCitation.chunkIndex + 1))
            : [selectedCitation.domain, selectedCitation.publishedAt ?? selectedCitation.retrievedAt].filter(Boolean).join(' · ') || null}
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
        <Sheet visible={captureOpen} onClose={() => setCaptureOpen(false)} title={t('learn5.capture.title')}>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('learn5.capture.detail')}</Text>
          <Button fullWidth label={t('learn5.capture.photo')} icon="📷" onPress={openPhoto} />
          <Button fullWidth label={t('learn5.capture.file')} icon="▤" variant="secondary" onPress={() => void chooseFile()} />
          <Button fullWidth label={t('learn5.cancel')} variant="ghost" onPress={() => setCaptureOpen(false)} />
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

function ResearchResultView({ result, onCitation }: { result: ResearchResult; onCitation: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  if (!result.citations.length) return <Alert tone="info" title={t('research10.noSources')} detail={t('research10.noSourcesDetail')} />;
  return <View style={{ gap: spacing.lg }} testID="research-result">
    {result.partial ? <Alert tone="warning" title={t('research10.partial')} detail={t('research10.partialDetail')} /> : null}
    <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('research10.synthesis')}</Text><Markdown text={result.synthesis} citations={result.citations} onCitation={onCitation} /></Card>
    {result.plan?.queries.length ? <Card style={{ gap: spacing.sm }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.plan.title')}</Text>{result.plan.queries.map((query, index) => <Text key={`${index}:${query}`} style={[typography.bodySmall, { color: c.textSecondary }]}>{index + 1}. {query}</Text>)}</Card> : null}
    {result.keyPoints.length || result.claims?.length ? <Card style={{ gap: spacing.sm }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.keyPoints')}</Text>{(result.claims?.length ? result.claims : result.keyPoints.map((text) => ({ text, citationIds: [] }))).map((claim, index) => <View key={index} style={{ gap: spacing.xs }}><Text style={[typography.body, { color: c.textSecondary }]}>• {claim.text}</Text><CitationLinks ids={claim.citationIds} citations={result.citations} onPress={onCitation} /></View>)}</Card> : null}
    {result.sections.map((section) => <Card key={section.id} style={{ gap: spacing.sm }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{section.title}</Text><Markdown text={section.body} citations={result.citations} onCitation={onCitation} /><CitationLinks ids={section.citationIds} citations={result.citations} onPress={onCitation} /></Card>)}
    {result.comparison ? <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('research10.comparison')}</Text><Comparison title={t('research10.agreements')} items={result.comparison.agreements} /><Comparison title={t('research10.divergences')} items={result.comparison.divergences} /><Comparison title={t('research10.specificities')} items={result.comparison.specificities} /></Card> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{result.stages.map((stage) => <Badge key={stage.kind} tone="success" label={`${t(`research10.stage.${stage.kind}` as TranslationKey)}${stage.itemCount !== undefined ? ` · ${stage.itemCount}` : ''}`} />)}</View>
  </View>;
}

function CitationLinks({ ids, citations, onPress }: { ids: string[]; citations: UnifiedResearchCitation[]; onPress: (id: string) => void }) {
  const { colors: c, spacing, typography, radius } = useTokens();
  if (!ids.length) return null;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{ids.map((id) => {
    const index = citations.findIndex((citation) => citation.id === id);
    if (index < 0) return null;
    return <Pressable key={id} accessibilityRole="link" accessibilityLabel={citations[index].title} onPress={() => onPress(id)} style={{ minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: c.surfaceSunken, borderWidth: 1, borderColor: c.border }}><Text style={[typography.caption, { color: c.primary, fontWeight: '700' }]}>[{index + 1}]</Text></Pressable>;
  })}</View>;
}

function Comparison({ title, items }: { title: string; items: string[] }) {
  const { colors: c, typography } = useTokens();
  if (!items.length) return null;
  return <View><Text style={[typography.label, { color: c.textPrimary }]}>{title}</Text>{items.map((item, index) => <Text key={index} style={[typography.bodySmall, { color: c.textSecondary }]}>• {item}</Text>)}</View>;
}

function SourceSelector({ documents, selected, onToggle }: { documents: Array<Pick<LibraryDocument, 'id' | 'title'>>; selected: string[]; onToggle: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textSecondary }]}>{t('research10.documents')}</Text>{documents.length ? documents.map((document) => <Pressable key={document.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(document.id) }} onPress={() => onToggle(document.id)} style={{ minHeight: 44, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Text style={{ color: c.primary }}>{selected.includes(document.id) ? '✓' : '○'}</Text><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{document.title}</Text></Pressable>) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('research10.documents.empty')}</Text>}</View>;
}

function CollectionSelector({ collections, selected, onSelect }: { collections: Collection[]; selected: string | null; onSelect: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <View style={{ gap: spacing.xs }}><Text style={[typography.label, { color: c.textSecondary }]}>{t('research10.collections')}</Text>{collections.length ? collections.map((collection) => <Pressable key={collection.id} accessibilityRole="radio" accessibilityState={{ selected: selected === collection.id }} onPress={() => onSelect(collection.id)} style={{ minHeight: 44, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}><Text style={{ color: c.primary }}>{selected === collection.id ? '●' : '○'}</Text><Text style={[typography.bodySmall, { color: c.textPrimary }]}>{collection.name}</Text></Pressable>) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('research10.collections.empty')}</Text>}</View>;
}

function researchNextBestAction(question: string, t: (key: TranslationKey) => string) {
  return {
    title: t('research10.next'),
    primaryAction: { label: t('research10.action.learn'), destination: { kind: 'route' as const, path: '/tutor', params: { mode: 'explain', q: question } } },
    reason: t('research10.next.reason'),
    estimatedDuration: null,
    expectedImpact: { kind: 'knowledge' as const, label: 'research-to-learning' },
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

function sourceLocation(citation: UnifiedResearchCitation, t: (key: TranslationKey) => string): string {
  if (citation.pageNumber !== undefined) return `📄 ${citation.pageNumber}`;
  if (citation.chunkIndex !== undefined) return t('source.passage').replace('{n}', String(citation.chunkIndex + 1));
  return [citation.domain, citation.publishedAt ?? citation.retrievedAt].filter(Boolean).join(' · ');
}

function audioExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

function documentStatusFromParam(value: string | undefined): DocumentDetail['status'] | null {
  return value && ['pending', 'processing', 'ready', 'partial', 'failed'].includes(value)
    ? value as DocumentDetail['status']
    : null;
}

function isTerminalDocumentStatus(status: DocumentDetail['status'] | null): boolean {
  return status === 'ready' || status === 'partial' || status === 'failed';
}
