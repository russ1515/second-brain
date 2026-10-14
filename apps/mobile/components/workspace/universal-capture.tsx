import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  WORKSPACE_TEMPLATES,
  type Collection,
  type DocumentDetail,
  type LibraryDocument,
  type LibraryDocumentDetail,
  type PersistentWorkspace,
  type TranscriptionResult,
  type WorkspaceSourceReference,
  type WorkspaceSummary,
  type WorkspaceTemplate,
  resolveDocumentPipeline,
} from '@second-brain/shared';
import { ApiError, api, apiUpload } from '../../lib/client';
import { pickDocuments, uploadPickedDocument, type PickedDocument } from '../../lib/document-import';
import { createRecorder, RECORDING_SUPPORTED, type Recorder } from '../../lib/recorder';
import { createClientRequestId } from '../../lib/request-id';
import { planWorkspaceCaptureAttachment, workspaceCaptureSignature } from '../../lib/workspace-capture-flow';
import {
  clearWorkspaceCaptureDraft,
  loadWorkspaceCaptureDraft,
  MAX_WORKSPACE_CAPTURE_SOURCES,
  mergeWorkspaceSources,
  saveWorkspaceCaptureDraft,
  type WorkspaceCaptureMode,
} from '../../lib/workspace-capture-draft';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Alert, Badge, Button, Card, Input, SegmentedControl } from '../ds/core';

type CapturePhase = 'IDLE' | 'CAPTURING' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'ERROR';

const MODES: readonly WorkspaceCaptureMode[] = ['photo', 'file', 'text', 'voice', 'library'];
const MODE_LABELS: Record<WorkspaceCaptureMode, TranslationKey> = {
  text: 'h.capture.write',
  file: 'learn5.capture.file',
  photo: 'learn5.capture.photo',
  voice: 'h.capture.speak',
  library: 'lib.title',
};

const PHASE_LABELS: Record<CapturePhase, TranslationKey> = {
  IDLE: 'voice11.state.ready',
  CAPTURING: 'voice11.state.listening',
  UPLOADING: 'document.pipeline.queued',
  PROCESSING: 'voice11.state.transcription',
  READY: 'document.pipeline.completed',
  ERROR: 'state.error',
};

export function WorkspaceUniversalCapture({
  ownerUserId,
  documents,
  collections,
  workspaces,
  hasMoreWorkspaces,
  loadingMoreWorkspaces,
  onLoadMoreWorkspaces,
  documentSearch,
  onDocumentSearchChange,
  hasMoreDocuments,
  loadingMoreDocuments,
  onLoadMoreDocuments,
  initialDocument,
}: {
  ownerUserId: string;
  documents: readonly LibraryDocument[];
  collections: readonly Collection[];
  workspaces: readonly WorkspaceSummary[];
  hasMoreWorkspaces?: boolean;
  loadingMoreWorkspaces?: boolean;
  onLoadMoreWorkspaces?: () => void;
  documentSearch?: string;
  onDocumentSearchChange?: (value: string) => void;
  hasMoreDocuments?: boolean;
  loadingMoreDocuments?: boolean;
  onLoadMoreDocuments?: () => void;
  initialDocument?: { id: string; title?: string; status?: string };
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  const [mode, setMode] = useState<WorkspaceCaptureMode | null>(initialDocument ? 'photo' : null);
  const [phase, setPhase] = useState<CapturePhase>(documentCapturePhase(initialDocument?.status));
  const [documentPipelineKey, setDocumentPipelineKey] = useState<TranslationKey | null>(documentStatusKey(initialDocument?.status));
  const [title, setTitle] = useState(initialDocument?.title ?? '');
  const [objective, setObjective] = useState('');
  const [template, setTemplate] = useState<WorkspaceTemplate>('assignment');
  const [initialContent, setInitialContent] = useState('');
  const [sources, setSources] = useState<WorkspaceSourceReference[]>(initialDocument ? [{ kind: 'document', id: initialDocument.id, title: initialDocument.title }] : []);
  const [sourceMode, setSourceMode] = useState<'documents' | 'collections'>('documents');
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trackedDocumentId, setTrackedDocumentId] = useState<string | null>(initialDocument?.id ?? null);
  const [failedDocumentId, setFailedDocumentId] = useState<string | null>(initialDocument?.status === 'failed' ? initialDocument.id : null);
  const [pollingExhausted, setPollingExhausted] = useState(false);
  const [documentUnsettled, setDocumentUnsettled] = useState(Boolean(initialDocument && !documentStatusSettled(initialDocument.status)));
  const [pollGeneration, setPollGeneration] = useState(0);
  const [pendingCreate, setPendingCreate] = useState<{ signature: string; requestId: string } | null>(null);
  const [attachmentId, setAttachmentId] = useState(() => createClientRequestId('workspace-capture'));
  const recorder = useRef<Recorder | null>(null);
  const pickedFile = useRef<PickedDocument | null>(null);
  const uploadRequestId = useRef<string | null>(null);
  const actionInFlight = useRef(false);
  const filePickerInFlight = useRef(false);
  const voiceTransitionInFlight = useRef(false);
  const hydratedOwner = useRef<string | null>(null);
  const persistenceSuspended = useRef(false);
  const captureCompleted = useRef(false);

  const routeSource = useMemo<WorkspaceSourceReference[]>(() => initialDocument
    ? [{ kind: 'document', id: initialDocument.id, title: initialDocument.title }]
    : [], [initialDocument?.id, initialDocument?.title]);

  useEffect(() => {
    let active = true;
    persistenceSuspended.current = true;
    captureCompleted.current = false;
    hydratedOwner.current = null;
    setHydrated(false);
    recorder.current?.cancel();
    recorder.current = null;
    pickedFile.current = null;
    uploadRequestId.current = null;
    actionInFlight.current = false;
    filePickerInFlight.current = false;
    voiceTransitionInFlight.current = false;
    setMode(initialDocument ? 'photo' : null);
    setPhase(documentCapturePhase(initialDocument?.status));
    setDocumentPipelineKey(documentStatusKey(initialDocument?.status));
    setTitle(initialDocument?.title ?? '');
    setObjective('');
    setTemplate('assignment');
    setInitialContent('');
    setSources(routeSource);
    setTrackedDocumentId(initialDocument?.id ?? null);
    setFailedDocumentId(initialDocument?.status === 'failed' ? initialDocument.id : null);
    setDocumentUnsettled(Boolean(initialDocument && !documentStatusSettled(initialDocument.status)));
    setPendingCreate(null);
    setAttachmentId(createClientRequestId('workspace-capture'));
    setError(null);
    void loadWorkspaceCaptureDraft(ownerUserId).then((draft) => {
      if (!active) return;
      if (draft) {
        setMode(initialDocument ? 'photo' : draft.mode);
        setTitle(initialDocument?.title || draft.title);
        setObjective(draft.objective);
        setTemplate(draft.template);
        setInitialContent(draft.initialContent);
        const restoredSources = mergeWorkspaceSources(draft.sources, routeSource);
        setSources(restoredSources);
        const restoredTrackedDocumentId = initialDocument?.id
          ?? draft.trackedDocumentId
          ?? [...restoredSources].reverse().find((source) => source.kind === 'document')?.id
          ?? null;
        setTrackedDocumentId(restoredTrackedDocumentId);
        setAttachmentId(draft.attachmentId ?? createClientRequestId('workspace-capture'));
        setPendingCreate(draft.createRequestId && draft.createSignature
          ? { requestId: draft.createRequestId, signature: draft.createSignature }
          : null);
        if (!initialDocument && (draft.mode === 'file' || draft.mode === 'photo') && restoredTrackedDocumentId) {
          setDocumentUnsettled(true);
          setPhase('PROCESSING');
        }
        else if (!initialDocument && (draft.mode === 'text' || draft.mode === 'voice') && draft.initialContent.trim()) setPhase('READY');
        else if (!initialDocument && draft.mode === 'library' && draft.sources.length) setPhase('READY');
        else if (!initialDocument) setPhase('IDLE');
      }
      hydratedOwner.current = ownerUserId;
      persistenceSuspended.current = false;
      setHydrated(true);
    });
    return () => { active = false; };
  }, [initialDocument?.id, initialDocument?.status, initialDocument?.title, ownerUserId, routeSource]);

  useEffect(() => {
    if (!hydrated || hydratedOwner.current !== ownerUserId || persistenceSuspended.current || captureCompleted.current) return;
    const timer = setTimeout(() => {
      if (persistenceSuspended.current || captureCompleted.current || hydratedOwner.current !== ownerUserId) return;
      void saveWorkspaceCaptureDraft(ownerUserId, {
        mode,
        title,
        objective,
        template,
        initialContent,
        sources,
        trackedDocumentId,
        attachmentId,
        createRequestId: pendingCreate?.requestId ?? null,
        createSignature: pendingCreate?.signature ?? null,
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [attachmentId, hydrated, initialContent, mode, objective, ownerUserId, pendingCreate, sources, template, title, trackedDocumentId]);

  useEffect(() => () => recorder.current?.cancel(), []);

  useEffect(() => {
    if (!hydrated || (mode !== 'file' && mode !== 'photo')) return;
    const documentId = trackedDocumentId;
    if (!documentId) return;
    setPollingExhausted(false);
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const document = await api<LibraryDocumentDetail>(`/library/documents/${encodeURIComponent(documentId)}`);
        if (!active) return;
        const pipeline = resolveDocumentPipeline(document.status, document.stage);
        setDocumentPipelineKey(pipeline.messageCode as TranslationKey);
        setDocumentUnsettled(!documentStatusSettled(document.status));
        if (document.status === 'ready' || document.status === 'partial') {
          setFailedDocumentId(null);
          setPhase('READY');
        }
        else if (document.status === 'failed') {
          setFailedDocumentId(document.id);
          setPhase('ERROR');
          if (document.error) setError(document.error);
        } else if (attempts < 10) {
          setPhase('PROCESSING');
          timer = setTimeout(() => void poll(), 4_000);
        } else {
          setPhase('PROCESSING');
          setPollingExhausted(true);
        }
      } catch (caught) {
        if (!active) return;
        setDocumentUnsettled(true);
        setPollingExhausted(true);
        setPhase('ERROR');
        setError((caught as Error).message);
      }
    };
    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, mode, pollGeneration, trackedDocumentId]);

  const cancelActiveRecording = () => {
    recorder.current?.cancel();
    recorder.current = null;
    voiceTransitionInFlight.current = false;
  };

  const beginNewCaptureIfCompleted = () => {
    if (!captureCompleted.current) return;
    captureCompleted.current = false;
    setAttachmentId(createClientRequestId('workspace-capture'));
  };

  const rejectSourceLimit = () => {
    setError(t('workspaceCapture.sourceLimit'));
  };

  const resetCaptureAfterSuccess = async () => {
    // Suspend both an already-scheduled timer and future persistence before the
    // durable delete. This prevents the cleared draft from being recreated as
    // React flushes the live-state reset during navigation.
    persistenceSuspended.current = true;
    try {
      await clearWorkspaceCaptureDraft(ownerUserId);
      captureCompleted.current = true;
      cancelActiveRecording();
      pickedFile.current = null;
      uploadRequestId.current = null;
      setMode(null);
      setPhase('IDLE');
      setDocumentPipelineKey(null);
      setTitle('');
      setObjective('');
      setTemplate('assignment');
      setInitialContent('');
      setSources([]);
      setTrackedDocumentId(null);
      setFailedDocumentId(null);
      setPollingExhausted(false);
      setDocumentUnsettled(false);
      setPendingCreate(null);
      setAttachmentId(createClientRequestId('workspace-capture'));
      setError(null);
    } finally {
      persistenceSuspended.current = false;
    }
  };

  const documentPipelineBusy = Boolean(
    trackedDocumentId
    && (mode === 'file' || mode === 'photo')
    && (documentUnsettled || phase === 'UPLOADING' || phase === 'PROCESSING'),
  );

  const selectMode = (next: WorkspaceCaptureMode) => {
    if (!hydrated || busy || documentPipelineBusy) return;
    beginNewCaptureIfCompleted();
    if (next === 'voice' && recorder.current) return;
    if (next !== 'voice') cancelActiveRecording();
    const remainingSources = failedDocumentId && next !== 'file' && next !== 'photo'
      ? sources.filter((source) => source.kind !== 'document' || source.id !== failedDocumentId)
      : sources;
    if (remainingSources !== sources) {
      setSources(remainingSources);
      setTrackedDocumentId(null);
      setFailedDocumentId(null);
    }
    setMode(next);
    setError(null);
    if (next !== 'file' && next !== 'photo') setDocumentPipelineKey(null);
    setPhase(initialContent.trim() || remainingSources.length ? 'READY' : 'IDLE');
  };

  const openPhoto = async () => {
    if (!hydrated || busy || actionInFlight.current) return;
    beginNewCaptureIfCompleted();
    if (sources.length >= MAX_WORKSPACE_CAPTURE_SOURCES) {
      rejectSourceLimit();
      return;
    }
    cancelActiveRecording();
    setMode('photo');
    setError(null);
    setDocumentPipelineKey(documentStatusKey(initialDocument?.status));
    await saveWorkspaceCaptureDraft(ownerUserId, {
      mode: 'photo',
      title,
      objective,
      template,
      initialContent,
      sources,
      trackedDocumentId,
      attachmentId,
      createRequestId: pendingCreate?.requestId ?? null,
      createSignature: pendingCreate?.signature ?? null,
    }).catch(() => undefined);
    router.push({ pathname: '/scan', params: { source: 'workspace', captureType: 'photo' } });
  };

  const rememberDocument = (document: DocumentDetail) => {
    const alreadySelected = sources.some((source) => source.kind === 'document' && source.id === document.id);
    if (!alreadySelected && sources.length >= MAX_WORKSPACE_CAPTURE_SOURCES) {
      setTrackedDocumentId(document.id);
      setDocumentUnsettled(!documentStatusSettled(document.status));
      setDocumentPipelineKey(documentStatusKey(document.status));
      setPhase('ERROR');
      rejectSourceLimit();
      return;
    }
    setTrackedDocumentId(document.id);
    setDocumentUnsettled(!documentStatusSettled(document.status));
    setFailedDocumentId(document.status === 'failed' ? document.id : null);
    setSources((current) => mergeWorkspaceSources(current, [{ kind: 'document', id: document.id, title: document.title }]));
    setTitle((current) => current.trim() || document.title);
    setPhase(documentCapturePhase(document.status));
    setDocumentPipelineKey(documentStatusKey(document.status));
    if (document.status === 'failed' && document.error) setError(document.error);
  };

  const uploadFile = async (document: PickedDocument) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setDocumentUnsettled(true);
    setPhase('UPLOADING');
    setDocumentPipelineKey('document.pipeline.queued');
    setError(null);
    try {
      const requestId = uploadRequestId.current ?? createClientRequestId('workspace-upload');
      uploadRequestId.current = requestId;
      rememberDocument(await uploadPickedDocument(document, requestId));
    } catch (caught) {
      const existingDocumentId = duplicateDocumentId(caught);
      if (existingDocumentId) {
        const existing = await api<DocumentDetail>(`/documents/${encodeURIComponent(existingDocumentId)}`);
        rememberDocument(existing);
      } else {
        setPhase('ERROR');
        setError((caught as Error).message);
      }
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const chooseFile = async () => {
    if (!hydrated || filePickerInFlight.current || actionInFlight.current || busy) return;
    beginNewCaptureIfCompleted();
    if (sources.length >= MAX_WORKSPACE_CAPTURE_SOURCES) {
      rejectSourceLimit();
      return;
    }
    filePickerInFlight.current = true;
    cancelActiveRecording();
    setMode('file');
    setError(null);
    setDocumentPipelineKey(null);
    setPhase(initialContent.trim() || sources.length ? 'READY' : 'IDLE');
    try {
      const document = (await pickDocuments(false, false))[0];
      if (!document) return;
      pickedFile.current = document;
      setTrackedDocumentId(null);
      setFailedDocumentId(null);
      setDocumentUnsettled(false);
      uploadRequestId.current = createClientRequestId('workspace-upload');
      await uploadFile(document);
    } catch (caught) {
      setPhase('ERROR');
      setError((caught as Error).message);
    } finally {
      filePickerInFlight.current = false;
    }
  };

  const retryFile = async () => {
    if (actionInFlight.current || busy) return;
    if (!failedDocumentId) {
      if (pickedFile.current) await uploadFile(pickedFile.current);
      return;
    }
    actionInFlight.current = true;
    setBusy(true);
    setPhase('PROCESSING');
    setError(null);
    setDocumentPipelineKey('document.pipeline.reading');
    try {
      const latest = await api<DocumentDetail>(`/documents/${encodeURIComponent(failedDocumentId)}`);
      if (latest.status !== 'failed') {
        rememberDocument(latest);
        if (latest.status === 'pending' || latest.status === 'processing') {
          setPollGeneration((value) => value + 1);
        }
        return;
      }
      rememberDocument(await api<DocumentDetail>(`/documents/${encodeURIComponent(failedDocumentId)}/retry-extraction`, { method: 'POST' }));
      setPollGeneration((value) => value + 1);
    } catch (caught) {
      setPhase('ERROR');
      setError((caught as Error).message);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const toggleVoice = async () => {
    if (!hydrated || !RECORDING_SUPPORTED || busy || voiceTransitionInFlight.current) return;
    beginNewCaptureIfCompleted();
    voiceTransitionInFlight.current = true;
    setBusy(true);
    setMode('voice');
    setError(null);
    try {
      if (phase !== 'CAPTURING') {
        recorder.current = createRecorder();
        await recorder.current.start();
        setPhase('CAPTURING');
        return;
      }
      const recording = await recorder.current!.stop();
      recorder.current = null;
      setPhase('PROCESSING');
      const form = new FormData();
      const extension = recording.mimeType.includes('mp4') ? 'mp4' : recording.mimeType.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', recording.blob, `workspace-capture.${extension}`);
      if (recording.durationMs !== undefined) form.append('durationMs', String(recording.durationMs));
      const transcript = await apiUpload<TranscriptionResult>('/speech/stt', form);
      setInitialContent(transcript.text);
      setTitle((current) => current.trim() || transcript.text.trim().slice(0, 80));
      setPhase('READY');
      setDocumentPipelineKey(null);
    } catch (caught) {
      recorder.current?.cancel();
      recorder.current = null;
      setPhase('ERROR');
      setError((caught as Error).message || t('learn5.voice.error'));
    } finally {
      setBusy(false);
      voiceTransitionInFlight.current = false;
    }
  };

  const toggleSource = (source: WorkspaceSourceReference) => {
    beginNewCaptureIfCompleted();
    setSources((current) => {
      const exists = current.some((item) => item.kind === source.kind && item.id === source.id);
      if (!exists && current.length >= MAX_WORKSPACE_CAPTURE_SOURCES) {
        rejectSourceLimit();
        return current;
      }
      const next = exists
        ? current.filter((item) => item.kind !== source.kind || item.id !== source.id)
        : mergeWorkspaceSources(current, [source]);
      setError(null);
      setPhase(next.length || initialContent.trim() ? 'READY' : 'IDLE');
      return next;
    });
  };

  const createWorkspace = async () => {
    if (!hydrated || actionInFlight.current || phase !== 'READY' || !title.trim() || (!initialContent.trim() && !sources.length)) return;
    actionInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        template,
        objective: objective.trim(),
        sources,
        ...(initialContent.trim() ? { initialContent: initialContent.trim() } : {}),
      };
      const signature = workspaceCaptureSignature(JSON.stringify(body));
      const request = pendingCreate?.signature === signature
        ? pendingCreate
        : { signature, requestId: createClientRequestId('workspace') };
      setPendingCreate(request);
      await saveWorkspaceCaptureDraft(ownerUserId, {
        mode,
        title,
        objective,
        template,
        initialContent,
        sources,
        trackedDocumentId,
        attachmentId,
        createRequestId: request.requestId,
        createSignature: request.signature,
      });
      const requestId = request.requestId;
      const workspace = await api<PersistentWorkspace>('/workspaces', {
        method: 'POST',
        body: { ...body, requestId },
        requestId,
      });
      await resetCaptureAfterSuccess();
      router.push(`/library/workspace/${workspace.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const attachToWorkspace = async (workspaceId: string) => {
    if (!hydrated || actionInFlight.current || phase !== 'READY' || !hasCapture) return;
    actionInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let current = await api<PersistentWorkspace>(`/workspaces/${encodeURIComponent(workspaceId)}`);
      const next = mergeWorkspaceSources(current.sources, sources);
      const rejectedSources = sources.filter((source) => !next.some((candidate) => candidate.kind === source.kind && candidate.id === source.id));
      if (rejectedSources.length) {
        rejectSourceLimit();
        return;
      }
      const attachment = planWorkspaceCaptureAttachment(current.sources, next, current.draft.content, initialContent, attachmentId);
      if (attachment.sourcesChanged) {
        current = await api<PersistentWorkspace>(`/workspaces/${encodeURIComponent(workspaceId)}`, {
          method: 'PATCH',
          body: { sources: next, expectedRevision: current.autosaveRevision },
        });
      }
      if (attachment.contentChanged) {
        await api(`/workspaces/${encodeURIComponent(workspaceId)}/autosave`, {
          method: 'PATCH',
          body: {
            workspaceId,
            expectedRevision: current.autosaveRevision,
            draft: { format: current.draft.format, content: attachment.content },
          },
        });
      }
      await resetCaptureAfterSuccess();
      router.push(`/library/workspace/${workspaceId}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const hasCapture = Boolean(initialContent.trim() || sources.length);
  const captureReady = phase === 'READY';
  const phaseLabel = t(
    documentPipelineKey && (mode === 'file' || mode === 'photo')
      ? documentPipelineKey
      : phase === 'PROCESSING' && mode !== 'voice'
      ? 'document.pipeline.reading'
      : phase === 'READY' && (mode === 'text' || mode === 'voice')
        ? 'voice11.state.ready'
        : PHASE_LABELS[phase],
  );

  return <Card elevated style={{ gap: spacing.md, borderColor: c.aiAccent }} testID="workspace-universal-capture">
    <View style={{ gap: spacing.xs }}>
      <Badge tone="ai" label={t('learn5.composer.badge')} />
      <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('learn5.capture.title')}</Text>
      <Text style={[typography.body, { color: c.textSecondary }]}>{t('learn5.capture.detail')}</Text>
    </View>
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      {MODES.map((value) => <Button
        key={value}
        testID={`workspace-capture-${value}`}
        size="sm"
        variant={mode === value ? 'primary' : 'secondary'}
        label={t(MODE_LABELS[value])}
        disabled={!hydrated || busy || phase === 'CAPTURING' || documentPipelineBusy}
        onPress={() => value === 'file' ? void chooseFile() : value === 'photo' ? void openPhoto() : selectMode(value)}
      />)}
    </View>
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Badge tone={phase === 'ERROR' || documentPipelineKey === 'document.pipeline.partial' ? 'warning' : phase === 'READY' ? 'success' : 'neutral'} label={phaseLabel} />
    </View>
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
    {pollingExhausted && documentUnsettled && trackedDocumentId ? <Button
      testID="workspace-capture-refresh-document"
      size="sm"
      variant="ghost"
      label={t('health.refresh')}
      onPress={() => {
        setError(null);
        setPhase('PROCESSING');
        setPollingExhausted(false);
        setPollGeneration((value) => value + 1);
      }}
    /> : null}

    {mode === 'text' || mode === 'voice' ? <View style={{ gap: spacing.sm }}>
      {mode === 'voice' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Button
          testID="workspace-capture-voice-toggle"
          label={phase === 'CAPTURING' ? t('voice11.transcribe') : t('h.capture.speak')}
          disabled={!RECORDING_SUPPORTED || busy}
          loading={busy}
          onPress={() => void toggleVoice()}
        />
        {!RECORDING_SUPPORTED ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('learn5.voice.unavailable')}</Text> : null}
      </View> : null}
      {mode === 'voice' ? <Text style={[typography.caption, { color: c.textSecondary }]}>{t('voice11.transcript.edit')}</Text> : null}
      <TextInput
        testID="workspace-capture-text"
        value={initialContent}
        onChangeText={(value) => { setInitialContent(value); setPhase(value.trim() ? 'READY' : 'IDLE'); }}
        editable={hydrated && !busy && phase !== 'CAPTURING'}
        multiline
        textAlignVertical="top"
        placeholder={t('workspace10.editor.placeholder')}
        placeholderTextColor={c.textMuted}
        accessibilityLabel={t('workspace10.editor.label')}
        style={[typography.body, { minHeight: 150, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, padding: spacing.md, color: c.textPrimary, backgroundColor: c.surface }]}
      />
    </View> : null}

    {mode === 'file' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      <Button label={t('learn5.capture.file')} variant="secondary" disabled={busy} onPress={() => void chooseFile()} />
      {phase === 'ERROR' && (failedDocumentId || (pickedFile.current && !trackedDocumentId)) ? <Button testID="workspace-capture-file-retry" label={t('document.pipeline.retry')} loading={busy} onPress={() => void retryFile()} /> : null}
    </View> : null}

    {mode === 'library' ? <View style={{ gap: spacing.sm }} testID="workspace-capture-library">
      <SegmentedControl options={['documents', 'collections'] as const} value={sourceMode} onChange={setSourceMode} labelFor={(value) => t(`workspace10.sourceMode.${value}`)} />
      {sourceMode === 'documents' && onDocumentSearchChange ? <Input
        testID="workspace-capture-document-search"
        value={documentSearch ?? ''}
        onChangeText={onDocumentSearchChange}
        placeholder={t('library7.search')}
        accessibilityLabel={t('library7.search')}
        editable={hydrated && !busy}
      /> : null}
      {(sourceMode === 'documents' ? documents : collections).map((item) => {
        const kind = sourceMode === 'documents' ? 'document' as const : 'collection' as const;
        const checked = sources.some((source) => source.kind === kind && source.id === item.id);
        const label = 'title' in item ? item.title : item.name;
        return <Pressable key={item.id} disabled={!hydrated || busy} accessibilityRole="checkbox" accessibilityState={{ checked, disabled: !hydrated || busy }} onPress={() => toggleSource({ kind, id: item.id, title: label })} style={{ minHeight: 48, borderWidth: 1, borderColor: checked ? c.primary : c.border, borderRadius: radius.sm, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, opacity: !hydrated || busy ? 0.6 : 1 }}><Text style={{ color: c.primary }}>{checked ? '✓' : '○'}</Text><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{label}</Text></Pressable>;
      })}
      {sourceMode === 'documents' && hasMoreDocuments && onLoadMoreDocuments ? <Button
        testID="workspace-capture-load-more-documents"
        size="sm"
        variant="ghost"
        label={t('brain8.loadMore')}
        loading={loadingMoreDocuments}
        disabled={busy || loadingMoreDocuments}
        onPress={onLoadMoreDocuments}
      /> : null}
    </View> : null}

    {sources.length ? <Card style={{ gap: spacing.xs, backgroundColor: c.surfaceSunken }}>
      <Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.sourceCount').replace('{n}', String(sources.length))}</Text>
      {sources.map((source) => <Text key={`${source.kind}:${source.id}`} numberOfLines={1} style={[typography.caption, { color: c.textSecondary }]}>• {source.title ?? source.id}</Text>)}
    </Card> : null}

    {hasCapture ? <View style={{ gap: spacing.sm }} testID="workspace-capture-qualification">
      <Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.create')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {WORKSPACE_TEMPLATES.map((value) => <Pressable key={value} disabled={!hydrated || busy} testID={`workspace-capture-template-${value}`} accessibilityRole="radio" accessibilityState={{ selected: template === value, disabled: !hydrated || busy }} onPress={() => setTemplate(value)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: template === value ? c.primary : c.border, backgroundColor: template === value ? c.primary : c.surfaceSunken, opacity: !hydrated || busy ? 0.6 : 1 }}><Text style={[typography.bodySmall, { color: template === value ? c.onPrimary : c.textPrimary, fontWeight: '700' }]}>{t(`workspace10.template.${value}` as TranslationKey)}</Text></Pressable>)}
      </View>
      <Input testID="workspace-capture-title" label={t('workspace10.field.title')} value={title} onChangeText={setTitle} placeholder={t('workspace10.field.titlePlaceholder')} editable={hydrated && !busy} />
      <Input testID="workspace-capture-objective" label={t('workspace10.field.objective')} value={objective} onChangeText={setObjective} placeholder={t('workspace10.field.objectivePlaceholder')} editable={hydrated && !busy} multiline />
      <Button testID="workspace-capture-create" label={t('workspace10.createAction')} variant="ai" loading={busy} disabled={!hydrated || !title.trim() || busy || !captureReady} onPress={() => void createWorkspace()} />
      {workspaces.length ? <View style={{ gap: spacing.xs }} testID="workspace-capture-existing-targets">
        <Text style={[typography.label, { color: c.textSecondary }]}>{t('workspace10.resume')}</Text>
        {workspaces.map((workspace) => <Button key={workspace.id} testID={`workspace-capture-attach-${workspace.id}`} size="sm" variant="secondary" label={`${t('workspace10.resume')} · ${workspace.title}`} disabled={busy || !captureReady} onPress={() => void attachToWorkspace(workspace.id)} />)}
        {hasMoreWorkspaces && onLoadMoreWorkspaces ? <Button testID="workspace-capture-load-more-workspaces" size="sm" variant="ghost" label={t('brain8.loadMore')} loading={loadingMoreWorkspaces} disabled={busy || loadingMoreWorkspaces} onPress={onLoadMoreWorkspaces} /> : null}
      </View> : null}
    </View> : null}
  </Card>;
}

function duplicateDocumentId(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.payload || typeof error.payload !== 'object') return null;
  const payload = error.payload as Record<string, unknown>;
  if (typeof payload.existingDocumentId === 'string') return payload.existingDocumentId;
  const nested = payload.message;
  if (nested && typeof nested === 'object') {
    const id = (nested as Record<string, unknown>).existingDocumentId;
    if (typeof id === 'string') return id;
  }
  return null;
}

function documentCapturePhase(status?: string): CapturePhase {
  if (!status) return 'IDLE';
  if (status === 'ready' || status === 'partial') return 'READY';
  if (status === 'failed') return 'ERROR';
  return 'PROCESSING';
}

function documentStatusKey(status?: string): TranslationKey | null {
  if (status === 'ready') return 'document.pipeline.completed';
  if (status === 'partial') return 'document.pipeline.partial';
  if (status === 'failed') return 'document.pipeline.failed';
  if (status === 'pending') return 'document.pipeline.queued';
  if (status === 'processing') return 'lib.status.processing';
  return null;
}

function documentStatusSettled(status?: string): boolean {
  return status === 'ready' || status === 'partial' || status === 'failed';
}
