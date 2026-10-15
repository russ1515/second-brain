import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import type {
  WorkspaceArchiveRequest,
  WorkspaceArchiveResponse,
  WorkspaceCompletionCheck,
  WorkspaceCompletionStateResponse,
  WorkspaceExportFormat,
  WorkspaceExportRequest,
  WorkspaceExportResponse,
  WorkspaceFinalizeRequest,
  WorkspaceFinalizeResponse,
  WorkspaceProfessorPhase,
  WorkspaceProjectStatus,
  WorkspaceRestoreRequest,
  WorkspaceRestoreResponse,
  WorkspaceSaveState,
} from '@second-brain/shared';
import { api, ApiError } from '../../lib/client';
import { localeDirection, useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { useResponsive } from '../../lib/responsive';
import { createClientRequestId } from '../../lib/request-id';
import { workspaceCompletionLabel } from '../../lib/workspace-paths';
import { Alert, Badge, Button, Card } from '../ds/core';

interface PendingFinalizeRequest {
  requestId: string;
  expectedRevision: number;
}

interface PendingExportRequest extends WorkspaceExportRequest {
  snapshotId: string;
}

function apiErrorCode(error: ApiError): string | null {
  if (!error.payload || typeof error.payload !== 'object') return null;
  const payload = error.payload as Record<string, unknown>;
  if (typeof payload.code === 'string') return payload.code;
  if (payload.message && typeof payload.message === 'object') {
    const nested = payload.message as Record<string, unknown>;
    return typeof nested.code === 'string' ? nested.code : null;
  }
  return null;
}

function safeFileName(value: string, fallback: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

async function saveMarkdownExport(response: WorkspaceExportResponse): Promise<void> {
  if (typeof response.content !== 'string' || !response.content.trim()) throw new Error('WORKSPACE_EXPORT_EMPTY');
  const fileName = safeFileName(response.fileName, `second-brain-workspace-${Date.now()}.md`);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([response.content], { type: response.mimeType || 'text/markdown;charset=utf-8' }));
    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
    return;
  }
  if (!FileSystem.documentDirectory) throw new Error('WORKSPACE_EXPORT_STORAGE_UNAVAILABLE');
  const uri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, response.content, { encoding: FileSystem.EncodingType.UTF8 });
  await Share.share({ title: fileName, url: uri, message: uri });
}

async function savePdfExport(response: WorkspaceExportResponse): Promise<void> {
  if (typeof response.html !== 'string' || !response.html.trim()) throw new Error('WORKSPACE_EXPORT_EMPTY');
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: response.html });
    return;
  }
  const generated = await Print.printToFileAsync({ html: response.html });
  const fileName = safeFileName(response.fileName, `second-brain-workspace-${Date.now()}.pdf`);
  const uri = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}${fileName}` : generated.uri;
  if (uri !== generated.uri) await FileSystem.copyAsync({ from: generated.uri, to: uri });
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info.exists || info.isDirectory || info.size <= 0) throw new Error('WORKSPACE_EXPORT_FILE_NOT_CREATED');
  await Share.share({ title: fileName, url: uri, message: uri });
}

function completionError(error: unknown, t: (key: TranslationKey) => string): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message === t('workspace10.save.error')
      ? error.message
      : t('error.download');
  }
  const code = apiErrorCode(error);
  if (code === 'workspace_revision_conflict' || code === 'workspace_resume_revision_required') {
    return t('workspace10.conflict');
  }
  if (code === 'workspace_finalization_phase_required' || code === 'workspace_archive_finalization_required') {
    return t('workspace10.nextSection').replace('{section}', t('workspaceProfessor.phase.FINALIZATION'));
  }
  if (code === 'workspace_finalization_gate_failed') {
    return `${t('workspace10.integrity')} · ${t('workspace10.integrityDetail')}`;
  }
  if (code === 'workspace_archived_read_only') {
    return `${t('workspace10.status.archived')} · ${t('lib.restore')}`;
  }
  if (code === 'workspace_completed_read_only') {
    return `${t('workspace10.status.completed')} · ${t('workspace10.resume')}`;
  }
  if (code === 'workspace_restore_not_archived' || code === 'workspace_export_snapshot_not_found') {
    return t('workspace10.unavailable');
  }
  if (
    code === 'workspace_completion_idempotency_conflict'
    || code === 'workspace_completion_request_unavailable'
    || code === 'workspace_completion_persistence_conflict'
  ) return t('workspace10.conflict');
  if (error.status === 409) return t('workspace10.conflict');
  return t('workspace10.unavailable');
}

export function WorkspaceCompletion({
  workspaceId,
  status,
  phase,
  currentRevision,
  saveState,
  localChecks,
  onPrepareMutation,
  onMutationSettled,
  onWorkspaceRefresh,
  onContinueWorking,
}: {
  workspaceId: string;
  status: WorkspaceProjectStatus;
  phase: WorkspaceProfessorPhase;
  currentRevision: number;
  saveState: WorkspaceSaveState;
  localChecks: WorkspaceCompletionCheck[];
  onPrepareMutation: () => Promise<number | null>;
  onMutationSettled: () => void;
  onWorkspaceRefresh: () => Promise<boolean>;
  onContinueWorking: () => Promise<boolean>;
}) {
  const { locale, t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const { width } = useResponsive();
  const compact = width < 760;
  const rtl = localeDirection(locale) === 'rtl';
  const [completion, setCompletion] = useState<WorkspaceCompletionStateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'finalize' | WorkspaceExportFormat | 'continue' | 'archive' | 'restore' | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pendingFinalizeRef = useRef<PendingFinalizeRequest | null>(null);
  const pendingExportRef = useRef<Record<WorkspaceExportFormat, PendingExportRequest | null>>({ pdf: null, markdown: null });
  const pendingArchiveRef = useRef<WorkspaceArchiveRequest | null>(null);
  const pendingRestoreRef = useRef<WorkspaceRestoreRequest | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api<WorkspaceCompletionStateResponse>(`/workspaces/${workspaceId}/completion`);
      setCompletion(next);
      setError(null);
    } catch (caught) {
      setError(completionError(caught, t));
    } finally {
      setLoading(false);
    }
  }, [t, workspaceId]);

  useEffect(() => { void refresh(); }, [refresh, currentRevision, phase, status]);

  const finalize = async () => {
    if (busy) return;
    setBusy('finalize');
    setError(null);
    setNotice(null);
    try {
      const expectedRevision = await onPrepareMutation();
      if (expectedRevision === null) throw new Error(t('workspace10.save.error'));
      const retained = pendingFinalizeRef.current;
      const request: WorkspaceFinalizeRequest = retained?.expectedRevision === expectedRevision
        ? retained
        : { requestId: createClientRequestId('workspace-finalize'), expectedRevision };
      pendingFinalizeRef.current = request;
      await api<WorkspaceFinalizeResponse>(`/workspaces/${workspaceId}/finalize`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      pendingFinalizeRef.current = null;
      setNotice(t('globalPath.calendar.finalized'));
      await onWorkspaceRefresh();
      await refresh();
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 0) pendingFinalizeRef.current = null;
      setError(completionError(caught, t));
    } finally {
      onMutationSettled();
      setBusy(null);
    }
  };

  const exportSnapshot = async (format: WorkspaceExportFormat) => {
    if (busy || !completion?.latestSnapshot) return;
    setBusy(format);
    setError(null);
    setNotice(null);
    try {
      const retained = pendingExportRef.current[format];
      const request: PendingExportRequest = retained?.snapshotId === completion.latestSnapshot.id
        ? retained
        : {
            requestId: createClientRequestId(`workspace-export-${format}`),
            snapshotId: completion.latestSnapshot.id,
            format,
            locale,
          };
      pendingExportRef.current[format] = request;
      const response = await api<WorkspaceExportResponse>(`/workspaces/${workspaceId}/exports`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      if (format === 'pdf') await savePdfExport(response);
      else await saveMarkdownExport(response);
      pendingExportRef.current[format] = null;
      setNotice(t(Platform.OS === 'web' ? 'priv.exportDone' : 'priv.exportReady'));
    } catch (caught) {
      // A local Print/FileSystem failure happens after the server accepted the
      // logical export. Keep its idempotency key so Retry cannot create a
      // second server export operation.
      if (caught instanceof ApiError && caught.status !== 0) pendingExportRef.current[format] = null;
      setError(completionError(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    if (busy) return;
    setBusy('archive');
    setError(null);
    setNotice(null);
    try {
      const expectedRevision = await onPrepareMutation();
      if (expectedRevision === null) throw new Error(t('workspace10.save.error'));
      const retained = pendingArchiveRef.current;
      const request: WorkspaceArchiveRequest = retained?.expectedRevision === expectedRevision
        ? retained
        : { requestId: createClientRequestId('workspace-archive'), expectedRevision };
      pendingArchiveRef.current = request;
      await api<WorkspaceArchiveResponse>(`/workspaces/${workspaceId}/archive`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      pendingArchiveRef.current = null;
      setConfirmArchive(false);
      await onWorkspaceRefresh();
      await refresh();
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 0) pendingArchiveRef.current = null;
      setError(completionError(caught, t));
    } finally {
      onMutationSettled();
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy('restore');
    setError(null);
    setNotice(null);
    try {
      const expectedRevision = completion?.revision ?? currentRevision;
      const retained = pendingRestoreRef.current;
      const request: WorkspaceRestoreRequest = retained?.expectedRevision === expectedRevision
        ? retained
        : { requestId: createClientRequestId('workspace-restore'), expectedRevision };
      pendingRestoreRef.current = request;
      await api<WorkspaceRestoreResponse>(`/workspaces/${workspaceId}/restore`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      pendingRestoreRef.current = null;
      await onWorkspaceRefresh();
      await refresh();
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.status !== 0) pendingRestoreRef.current = null;
      setError(completionError(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const continueWorking = async () => {
    if (busy) return;
    setBusy('continue');
    setError(null);
    setNotice(null);
    try {
      const resumed = await onContinueWorking();
      if (!resumed) throw new Error(t('workspace10.save.error'));
      await refresh();
    } catch (caught) {
      setError(completionError(caught, t));
    } finally {
      setBusy(null);
    }
  };

  const checks = completion?.checks ?? localChecks;
  const latestSnapshot = completion?.latestSnapshot ?? null;
  const archived = (completion?.status ?? status) === 'archived';
  const completed = (completion?.status ?? status) === 'completed';
  const completionPhase = completion?.phase ?? phase;
  const phaseAllowsFinalize = completionPhase === 'FINALIZATION' || completionPhase === 'DECONSTRUCTION';
  const serverRevisionCurrent = completion?.revision === currentRevision;
  const draftSaved = saveState === 'saved' && serverRevisionCurrent;
  const ready = Boolean(completion?.ready && phaseAllowsFinalize && draftSaved && !archived);
  const needsFinalization = !latestSnapshot || latestSnapshot.revision !== (completion?.revision ?? currentRevision) || !completed;
  const blockerLabels = [...new Set((completion?.blockers ?? []).map((blocker) => {
    if (blocker.code === 'invalid-phase') return t('workspaceProfessor.phase.FINALIZATION');
    if (blocker.code === 'source-unavailable') return t('workspace10.unavailable');
    if (blocker.checkId) return workspaceCompletionLabel(blocker.checkId, t);
    return t('workspace10.editor.label');
  }))];
  const finalLabel = latestSnapshot
    ? `${t('globalPath.calendar.finalized')} · ${latestSnapshot.version}`
    : t('workspace10.status.completed');

  return <Card style={{ gap: spacing.sm }} testID="workspace-aw8-completion">
    <View style={{ flexDirection: rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
      <Text
        accessibilityRole="header"
        style={[typography.h3, { flex: 1, color: c.textPrimary, textAlign: rtl ? 'right' : 'left' }]}
      >
        {t(latestSnapshot ? 'globalPath.calendar.finalized' : 'workspace10.integrity')}
      </Text>
      <Badge
        tone={archived ? 'neutral' : latestSnapshot ? 'success' : completion?.ready ? 'info' : 'warning'}
        label={archived
          ? t('workspace10.status.archived')
          : latestSnapshot
            ? finalLabel
            : completion?.ready
              ? t('voice11.state.ready')
              : t('workspace10.integrity')}
      />
    </View>

    <View accessibilityRole="list" style={{ gap: spacing.xs }}>
      <CompletionRow passed={draftSaved} label={t('workspace10.save.saved')} rtl={rtl} />
      {checks.map((check) => <CompletionRow
        key={check.id}
        passed={check.passed}
        label={`${workspaceCompletionLabel(check.id, t)}${check.required ? ' *' : ''}`}
        rtl={rtl}
      />)}
      <CompletionRow passed={phaseAllowsFinalize} label={t('workspaceProfessor.phase.VERIFICATION')} rtl={rtl} />
    </View>

    {blockerLabels.length ? <Alert
      tone="warning"
      title={t('workspace10.integrity')}
      detail={blockerLabels.join(' · ')}
    /> : null}

    {!archived && !completed && needsFinalization ? <Button
      testID="workspace-finalize"
      size="sm"
      variant="primary"
      fullWidth={compact}
      label={t('workspace10.status.completed')}
      loading={busy === 'finalize'}
      disabled={!ready || Boolean(busy) || loading}
      onPress={() => void finalize()}
    /> : null}

    {latestSnapshot || (!archived && completed) ? <View
      testID="workspace-export-actions"
      style={{ flexDirection: compact ? 'column' : rtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: spacing.xs }}
    >
      {latestSnapshot ? <Button
        testID="workspace-export-pdf"
        size="sm"
        variant="secondary"
        fullWidth={compact}
        label={`${t('learn5.modality.export')} · PDF`}
        loading={busy === 'pdf'}
        disabled={Boolean(busy)}
        onPress={() => void exportSnapshot('pdf')}
      /> : null}
      {latestSnapshot ? <Button
        testID="workspace-export-markdown"
        size="sm"
        variant="secondary"
        fullWidth={compact}
        label={`${t('learn5.modality.export')} · Markdown`}
        loading={busy === 'markdown'}
        disabled={Boolean(busy)}
        onPress={() => void exportSnapshot('markdown')}
      /> : null}
      {!archived && completed && latestSnapshot ? <Button
        testID="workspace-continue"
        size="sm"
        variant="ghost"
        fullWidth={compact}
        label={t('workspace10.continue')}
        loading={busy === 'continue'}
        disabled={Boolean(busy)}
        onPress={() => void continueWorking()}
      /> : null}
      {!archived && completed ? <Button
        testID="workspace-archive-request"
        size="sm"
        variant="ghost"
        fullWidth={compact}
        label={t('workspace10.status.archived')}
        disabled={Boolean(busy)}
        onPress={() => setConfirmArchive(true)}
      /> : null}
    </View> : null}

    {confirmArchive && !archived && completed && latestSnapshot ? <View testID="workspace-archive-confirmation" style={{ gap: spacing.xs }}>
      <Alert tone="warning" title={t('workspace10.status.archived')} detail={t('workspace10.resumeDetail')} />
      <View style={{ flexDirection: compact ? 'column' : rtl ? 'row-reverse' : 'row', gap: spacing.xs }}>
        <Button
          testID="workspace-archive-confirm"
          size="sm"
          variant="secondary"
          fullWidth={compact}
          label={t('workspace10.status.archived')}
          loading={busy === 'archive'}
          disabled={Boolean(busy && busy !== 'archive')}
          onPress={() => void archive()}
        />
        <Button
          testID="workspace-archive-cancel"
          size="sm"
          variant="ghost"
          fullWidth={compact}
          label={t('app.dismiss')}
          disabled={Boolean(busy)}
          onPress={() => setConfirmArchive(false)}
        />
      </View>
    </View> : null}

    {archived ? <Button
      testID="workspace-restore"
      size="sm"
      variant="secondary"
      fullWidth={compact}
      label={t('lib.restore')}
      loading={busy === 'restore'}
      disabled={Boolean(busy)}
      onPress={() => void restore()}
    /> : null}

    {notice ? <Alert tone="success" title={t('state.success')} detail={notice} /> : null}
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
  </Card>;
}

function CompletionRow({ passed, label, rtl }: { passed: boolean; label: string; rtl: boolean }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  return <View
    accessibilityRole="text"
    style={{ minHeight: 32, flexDirection: rtl ? 'row-reverse' : 'row', alignItems: 'center', gap: spacing.xs }}
  >
    <Text
      accessibilityLabel={passed ? t('workspace10.save.saved') : t('workspace10.save.dirty')}
      style={{ color: passed ? c.success : c.textMuted, fontWeight: '800' }}
    >
      {passed ? '✓' : '○'}
    </Text>
    <Text style={[typography.bodySmall, { flex: 1, color: c.textSecondary, textAlign: rtl ? 'right' : 'left' }]}>{label}</Text>
  </View>;
}
