import { useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  WORKSPACE_ASSIST_ACTIONS,
  type PersistentWorkspaceAssistRequest,
  type PersistentWorkspaceAssistResponse,
  type WorkspaceAssistAction,
  type WorkspaceAssistantHistoryEntry,
  type WorkspaceCompletionCheck,
  type WorkspaceProfessorPhase,
  type WorkspaceProfessorState,
  type WorkspaceShellKind,
  type WorkspaceSourceCitation,
  type WorkspaceToolProposal,
} from '@second-brain/shared';
import { api, ApiError } from '../../lib/client';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { createClientRequestId } from '../../lib/request-id';
import { Alert, Badge, Button, Card, Input } from '../ds/core';
import { SourceCitation, SourcePreview, type SourceKind } from '../ds/sources';
import {
  WorkspaceTools,
  type WorkspaceToolApplicationMode,
  type WorkspaceToolSelectionSnapshot,
} from './tools';

export function WorkspaceAssistant({
  workspaceId,
  initialHistory,
  professor,
  shellKind,
  draftRevision,
  sourceCount,
  completionChecks,
  selectedText,
  selection,
  onBeforeAssist,
  onAssistFailure,
  onProfessorChange,
  onRequestTransition,
  onApplyToolProposal,
  onApplyProposal,
  onUndo,
  canUndo,
}: {
  workspaceId: string;
  initialHistory: WorkspaceAssistantHistoryEntry[];
  professor: WorkspaceProfessorState;
  shellKind: WorkspaceShellKind;
  draftRevision: number;
  sourceCount: number;
  completionChecks: WorkspaceCompletionCheck[];
  selectedText: string;
  selection: { start: number; end: number };
  onBeforeAssist: () => Promise<number | null>;
  onAssistFailure: () => Promise<void>;
  onProfessorChange: (professor: WorkspaceProfessorState, revision: number) => void;
  onRequestTransition: (requestedPhase: WorkspaceProfessorPhase) => Promise<void>;
  onApplyToolProposal: (
    proposal: WorkspaceToolProposal,
    mode: WorkspaceToolApplicationMode,
    selectionAtRun: WorkspaceToolSelectionSnapshot,
  ) => Promise<void>;
  onApplyProposal: (proposal: string, mode: 'insert' | 'replace') => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [history, setHistory] = useState(initialHistory);
  const [action, setAction] = useState<WorkspaceAssistAction>('suggest');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sendInFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PersistentWorkspaceAssistRequest | null>(null);
  const [failedRequest, setFailedRequest] = useState<PersistentWorkspaceAssistRequest | null>(null);
  const [transitioningTo, setTransitioningTo] = useState<WorkspaceProfessorPhase | null>(null);
  const [preview, setPreview] = useState<WorkspaceSourceCitation | null>(null);
  const latestProposal = [...history].reverse().find((entry) => entry.role === 'assistant')?.content ?? null;
  const canApplyProposal = professor.currentPhase === 'WORK' || professor.currentPhase === 'COACHING';
  const requiredChecksReady = completionChecks.filter((check) => check.required).every((check) => check.passed);
  const mainTransition = nextProfessorPhase(professor.currentPhase, requiredChecksReady);

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    setError(null);
  }, [professor.currentPhase, professor.phaseSequence]);

  const send = async (requestOverride?: PersistentWorkspaceAssistRequest) => {
    if (busy || sendInFlightRef.current || transitioningTo) return;
    const baseRequest: PersistentWorkspaceAssistRequest = requestOverride ?? {
      action,
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(selectedText.trim() ? { selectedText: selectedText.trim() } : {}),
    };
    if (!baseRequest.message?.trim() && !baseRequest.selectedText?.trim()) return;
    sendInFlightRef.current = true;
    setBusy(true);
    setError(null);
    setFailedRequest(null);
    let request: PersistentWorkspaceAssistRequest | null = null;
    let userEntry: WorkspaceAssistantHistoryEntry | null = null;
    try {
      const preparedRevision = requestOverride?.expectedRevision ?? await onBeforeAssist();
      if (preparedRevision === null) throw new Error(t('workspace10.save.error'));
      request = {
        ...baseRequest,
        requestId: baseRequest.requestId ?? createClientRequestId('workspace-assist'),
        expectedPhase: baseRequest.expectedPhase ?? professor.currentPhase,
        expectedRevision: preparedRevision,
      };
      const logicalRequestId = request.requestId!;
      userEntry = {
        id: `local-${logicalRequestId}`,
        role: 'user',
        content: request.message?.trim() || request.selectedText?.trim() || '',
        createdAt: new Date().toISOString(),
        requestId: logicalRequestId,
        professorPhase: request.expectedPhase,
      };
      setHistory((current) => current.some((entry) => (
        entry.role === 'user'
        && (entry.id === userEntry!.id || entry.requestId === logicalRequestId)
      ))
        ? current
        : [...current, userEntry!]);
      const response = await api<PersistentWorkspaceAssistResponse>(`/workspaces/${workspaceId}/assistant`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      setHistory((current) => (
        current.some((entry) => (
          entry.role === 'assistant'
          && (
            entry.id === response.reply.id
            || Boolean(response.reply.requestId && entry.requestId === response.reply.requestId)
          )
        ))
          ? current
          : [...current, response.reply].slice(-30)
      ));
      onProfessorChange(response.professor, response.revision);
      setLastRequest(request);
      setFailedRequest(null);
      setMessage('');
    } catch (caught) {
      if (userEntry) setHistory((current) => current.filter((entry) => entry.id !== userEntry!.id));
      if (request) setFailedRequest(request);
      setError((caught as Error).message);
      await onAssistFailure().catch(() => undefined);
    } finally {
      sendInFlightRef.current = false;
      setBusy(false);
    }
  };

  const transition = async (requestedPhase: WorkspaceProfessorPhase) => {
    if (transitioningTo || sendInFlightRef.current) return;
    setTransitioningTo(requestedPhase);
    setError(null);
    try {
      await onRequestTransition(requestedPhase);
    } catch (caught) {
      const payload = caught instanceof ApiError ? caught.payload : null;
      const code = payload && typeof payload === 'object'
        ? (payload as { code?: unknown }).code
        : null;
      setError(
        professor.currentPhase === 'COMPREHENSION'
        && requestedPhase === 'METHOD'
        && code === 'workspace_professor_transition_criteria_not_met'
          ? t('workspaceProfessor.comprehensionResponseRequired')
          : (caught as Error).message,
      );
    } finally {
      setTransitioningTo(null);
    }
  };

  return <Card style={{ gap: spacing.md }} testID="workspace-assistant">
    <View style={{ gap: spacing.xs }}>
      <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('ai.professor')}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('workspace10.assistantDetail')}</Text>
      <View testID="workspace-professor-phase" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
        <Badge tone="primary" label={t(`workspaceProfessor.phase.${professor.currentPhase}` as TranslationKey)} />
        {mainTransition ? <Button
          testID="workspace-professor-advance"
          size="sm"
          variant="secondary"
          label={`${t('onb.continue')} · ${t(`workspaceProfessor.phase.${mainTransition}` as TranslationKey)}`}
          loading={transitioningTo === mainTransition}
          disabled={busy || Boolean(transitioningTo)}
          onPress={() => void transition(mainTransition)}
        /> : null}
        {professor.currentPhase === 'WORK' ? <Button
          testID="workspace-professor-coaching"
          size="sm"
          variant="ghost"
          label={t('coach.title')}
          loading={transitioningTo === 'COACHING'}
          disabled={Boolean(transitioningTo)}
          onPress={() => void transition('COACHING')}
        /> : null}
        {professor.currentPhase === 'FINALIZATION' ? <Button
          testID="workspace-professor-back-to-work"
          size="sm"
          variant="ghost"
          label={t('workspace10.area.work')}
          loading={transitioningTo === 'WORK'}
          disabled={Boolean(transitioningTo)}
          onPress={() => void transition('WORK')}
        /> : null}
      </View>
    </View>
    <WorkspaceTools
      workspaceId={workspaceId}
      shellKind={shellKind}
      phase={professor.currentPhase}
      selectedText={selectedText}
      selection={selection}
      sourceCount={sourceCount}
      currentRevision={draftRevision}
      onBeforeRun={onBeforeAssist}
      onApply={onApplyToolProposal}
    />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>{WORKSPACE_ASSIST_ACTIONS.map((value) => <Button
      key={value}
      testID={`workspace-professor-action-${value}`}
      size="sm"
      variant={action === value ? 'ai' : 'secondary'}
      label={t(`workspace10.assist.${value}` as TranslationKey)}
      disabled={busy || Boolean(transitioningTo)}
      onPress={() => {
        setAction(value);
        if (value === 'explain') void send({
          action: value,
          ...(message.trim()
            ? { message: message.trim() }
            : !selectedText.trim()
              ? { message: t('workspace10.assist.explain') }
              : {}),
          ...(selectedText.trim() ? { selectedText: selectedText.trim() } : {}),
        });
      }}
    />)}</ScrollView>
    {selectedText ? <Alert tone="info" title={t('workspace10.selection')} detail={selectedText.slice(0, 180)} /> : null}
    <ScrollView
      style={{ maxHeight: 360 }}
      contentContainerStyle={{ gap: spacing.sm }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      testID="workspace-assistant-history"
    >
      {history.slice(-10).map((entry) => <View key={entry.id} style={{ alignSelf: entry.role === 'user' ? 'flex-end' : 'stretch', maxWidth: entry.role === 'user' ? '85%' : '100%', backgroundColor: entry.role === 'user' ? c.primary : c.surfaceSunken, padding: spacing.sm, borderRadius: 10, gap: spacing.xs }}>
        {entry.content ? <Text style={[typography.bodySmall, { color: entry.role === 'user' ? c.onPrimary : c.textPrimary }]}>{entry.content}</Text> : null}
        {entry.role === 'assistant' && entry.evidenceStatus === 'none' ? <Alert tone="info" title={t('research10.noSources')} detail={t('research10.noSourcesDetail')} /> : null}
        {entry.role === 'assistant' && entry.citations?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {entry.citations.map((citation) => <SourceCitation
            key={`${entry.id}:${citation.citationLabel}`}
            title={`${citation.citationLabel} · ${citation.title}`}
            kind={citationKind(citation)}
            onPress={() => setPreview(citation)}
          />)}
        </View> : null}
      </View>)}
    </ScrollView>
    {preview ? <SourcePreview
      title={`${preview.citationLabel} · ${preview.title}`}
      snippet={preview.snippet}
      location={preview.page ? `${preview.citationLabel} · p. ${preview.page}` : preview.citationLabel}
      kind={citationKind(preview)}
      onOpen={citationCanOpen(preview) ? () => void openCitation(preview, router) : undefined}
      onClose={() => setPreview(null)}
    /> : null}
    {latestProposal && canApplyProposal ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Button size="sm" variant="secondary" label={t('globalPath.insertProposal')} onPress={() => onApplyProposal(latestProposal, 'insert')} />
        {selectedText ? <Button size="sm" variant="secondary" label={t('globalPath.replaceSelection')} onPress={() => onApplyProposal(latestProposal, 'replace')} /> : null}
        {lastRequest ? <Button size="sm" variant="ghost" label={t('globalPath.anotherProposal')} loading={busy} onPress={() => void send({
          action: lastRequest.action,
          ...(lastRequest.message ? { message: lastRequest.message } : {}),
          ...(lastRequest.selectedText ? { selectedText: lastRequest.selectedText } : {}),
        })} /> : null}
        {canUndo ? <Button size="sm" variant="ghost" label={t('globalPath.undoInsertion')} onPress={onUndo} /> : null}
      </View>
    ) : null}
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
    {failedRequest ? <Button
      testID="workspace-professor-retry"
      size="sm"
      variant="secondary"
      label={t('auth.retry')}
      loading={busy}
      onPress={() => {
        const operation = professor.assistOperations.find((item) => item.requestId === failedRequest.requestId);
        if (operation?.status === 'completed') {
          setFailedRequest(null);
          setError(null);
          return;
        }
        if (operation?.status === 'pending') {
          void onAssistFailure();
          return;
        }
        if (operation?.status === 'failed') {
          void send({
            action: failedRequest.action,
            ...(failedRequest.message ? { message: failedRequest.message } : {}),
            ...(failedRequest.selectedText ? { selectedText: failedRequest.selectedText } : {}),
          });
          return;
        }
        void send({
          requestId: failedRequest.requestId,
          action: failedRequest.action,
          ...(failedRequest.message ? { message: failedRequest.message } : {}),
          ...(failedRequest.selectedText ? { selectedText: failedRequest.selectedText } : {}),
        });
      }}
    /> : null}
    <Input label={t('workspace10.assistantQuestion')} value={message} onChangeText={setMessage} placeholder={t('workspace10.assistantPlaceholder')} multiline />
    <Button label={t('workspace10.assistantSend')} variant="ai" loading={busy} disabled={!message.trim() && !selectedText.trim()} onPress={() => void send()} />
  </Card>;
}

function nextProfessorPhase(
  current: WorkspaceProfessorPhase,
  requiredChecksReady: boolean,
): WorkspaceProfessorPhase | null {
  switch (current) {
    case 'CAPTURE': return 'COMPREHENSION';
    case 'COMPREHENSION': return 'METHOD';
    case 'METHOD': return 'WORK';
    case 'WORK': return 'VERIFICATION';
    case 'COACHING': return 'WORK';
    case 'VERIFICATION': return requiredChecksReady ? 'FINALIZATION' : 'WORK';
    case 'FINALIZATION': return 'DECONSTRUCTION';
    case 'DECONSTRUCTION': return null;
  }
}

function citationKind(citation: WorkspaceSourceCitation): SourceKind {
  if (citation.sourceType === 'brain') return 'brain';
  if (citation.sourceType === 'web') return 'web';
  if (citation.sourceType === 'external' || citation.sourceType === 'research') return 'external';
  return 'document';
}

function citationCanOpen(citation: WorkspaceSourceCitation): boolean {
  return Boolean(
    citation.documentId
    || citation.sourceType === 'brain'
    || (citation.url && /^https:\/\//i.test(citation.url)),
  );
}

async function openCitation(citation: WorkspaceSourceCitation, router: ReturnType<typeof useRouter>) {
  if (citation.documentId) {
    router.push(`/library/${citation.documentId}`);
    return;
  }
  if (citation.sourceType === 'brain') {
    router.push('/brain');
    return;
  }
  if (citation.url && /^https:\/\//i.test(citation.url)) await Linking.openURL(citation.url);
}
