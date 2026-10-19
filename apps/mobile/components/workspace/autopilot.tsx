import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { PersistentWorkspace, WorkspaceAutopilotRequest, WorkspaceProfessorPhase } from '@second-brain/shared';
import { api } from '../../lib/client';
import { createClientRequestId } from '../../lib/request-id';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Alert, Button, Card } from '../ds/core';
import { Markdown } from '../markdown';

type Command = WorkspaceAutopilotRequest['action'];

/** A single caller advances the persisted server orchestration one step at a
 * time. Rendering, elapsed time and remounts never constitute phase evidence. */
export function WorkspaceAutopilot({
  workspace,
  onPrepare,
  onWorkspace,
  onQuestion,
  onAddSource,
  onOrientation,
  onContinueEditing,
  manualOpen,
  onToggleManual,
}: {
  workspace: PersistentWorkspace;
  onPrepare: (action: Command) => Promise<number | null>;
  onWorkspace: (workspace: PersistentWorkspace) => boolean;
  onQuestion: () => void;
  onAddSource: () => void;
  onOrientation: () => void;
  onContinueEditing: () => void;
  manualOpen: boolean;
  onToggleManual: () => void;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const state = workspace.progress.workflow?.autopilot;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const mounted = useRef(false);
  const stepInFlight = useRef(false);
  const controlInFlight = useRef(false);
  const pauseRequested = useRef(false);
  const controllers = useRef(new Set<AbortController>());
  const latest = useRef({ workspace, onPrepare, onWorkspace });
  latest.current = { workspace, onPrepare, onWorkspace };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
    };
  }, [workspace.id]);

  const refresh = async () => {
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const next = await api<PersistentWorkspace>(`/workspaces/${latest.current.workspace.id}`, { signal: controller.signal });
      if (mounted.current && !latest.current.onWorkspace(next)) setBlocked(true);
    } finally {
      controllers.current.delete(controller);
    }
  };

  const command = async (action: Command): Promise<boolean> => {
    const automatic = action === 'step';
    if (!mounted.current || (automatic ? stepInFlight.current : controlInFlight.current)) return false;
    if (action === 'pause' || action === 'stop') pauseRequested.current = true;
    if (automatic) stepInFlight.current = true;
    else controlInFlight.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const expectedRevision = await latest.current.onPrepare(action);
      if (expectedRevision === null || !mounted.current) {
        if (mounted.current) setBlocked(true);
        return false;
      }
      const request: WorkspaceAutopilotRequest = {
        requestId: createClientRequestId(`workspace-autopilot-${action}`),
        expectedRevision,
        action,
        ...(action === 'start' ? { consent: true } : {}),
      };
      const next = await api<PersistentWorkspace>(`/workspaces/${latest.current.workspace.id}/autopilot`, {
        method: 'POST', body: request, requestId: request.requestId,
        signal: controller.signal,
      });
      if (!mounted.current) return false;
      const accepted = latest.current.onWorkspace(next);
      if (accepted && (action === 'start' || action === 'resume')) pauseRequested.current = false;
      setBlocked(!accepted);
      return accepted;
    } catch (caught) {
      if (!mounted.current) return false;
      setBlocked(true);
      setError((caught as Error).message);
      // An uncertain paid operation is never automatically retried. Reload its
      // persisted receipt before the learner chooses to resume.
      await refresh().catch(() => undefined);
      return false;
    } finally {
      controllers.current.delete(controller);
      if (automatic) stepInFlight.current = false;
      else controlInFlight.current = false;
      if (mounted.current) setBusy(stepInFlight.current || controlInFlight.current);
    }
  };

  useEffect(() => {
    if (state?.status !== 'RUNNING' || state.activeRequest || blocked || manualOpen || busy || pauseRequested.current) return;
    if (workspace.status === 'archived') return;
    void command('step');
  }, [workspace.id, workspace.autosaveRevision, workspace.professor.phaseSequence, state?.status, state?.activeRequest?.requestId, busy, blocked, manualOpen]);

  useEffect(() => {
    if (!state?.activeRequest) return;
    // Poll only an operation the server says is pending; this performs no AI
    // call and never invents an intermediate progress stage.
    const timer = setTimeout(() => {
      void refresh().catch((caught) => {
        if (!mounted.current) return;
        setBlocked(true);
        setError((caught as Error).message);
      });
    }, 1_500);
    return () => clearTimeout(timer);
  }, [workspace, state?.activeRequest?.requestId]);

  const interrupt = async (open: () => void) => {
    if (state?.status === 'RUNNING' && !await command('pause')) return;
    open();
  };
  const phase = workspace.professor.currentPhase;
  const sequence: readonly { key: string; phases: readonly WorkspaceProfessorPhase[] }[] = [
    { key: 'understood', phases: ['CAPTURE', 'COMPREHENSION'] },
    { key: 'methodReady', phases: ['METHOD'] },
    { key: 'working', phases: ['WORK', 'COACHING'] },
    { key: 'verifying', phases: ['VERIFICATION'] },
    { key: 'finalizing', phases: ['FINALIZATION', 'DECONSTRUCTION'] },
  ];
  const currentIndex = sequence.findIndex((item) => item.phases.includes(phase));
  const completed = state?.status === 'COMPLETED';
  const statusKey = !state?.consent ? 'consent'
    : completed ? 'done'
      : state.status === 'PAUSED_ERROR' || (blocked && error) ? 'pausedError'
        : blocked ? 'paused'
        : state.errorCode === 'STOP_AUTOPILOT_REVIEW_REQUIRED' ? 'reviewRequired'
          : state.status === 'NEEDS_INPUT' ? 'needsInput'
          : state.status === 'PAUSED' ? 'paused'
            : state.status === 'STOPPED' ? (state.reason === 'STOP_AUTOPILOT_REVIEW_REQUIRED' || state.errorCode === 'STOP_AUTOPILOT_REVIEW_REQUIRED' ? 'reviewRequired' : 'stopped')
              : phase === 'CAPTURE' || phase === 'COMPREHENSION' ? 'think'
                : phase === 'METHOD' ? 'method'
                  : phase === 'WORK' || phase === 'COACHING' ? 'draft'
                    : phase === 'VERIFICATION' ? 'check' : 'finish';
  const canResume = Boolean(state?.consent && !completed && (blocked || state.status !== 'RUNNING') && workspace.status === 'active');
  const undoAvailable = Boolean(state?.undo && workspace.autosaveRevision === state.undo.appliedRevision && state.status !== 'RUNNING' && workspace.status === 'active');
  const latestReply = [...workspace.assistantHistory].reverse().find((entry) => entry.role === 'assistant' && entry.autopilot?.runId === state?.runId);
  const replyText = latestReply?.autopilot?.output.text ?? latestReply?.content;
  const deconstruction = latestReply?.autopilot?.output.deconstruction;
  const resume = async () => {
    if (await command('resume') && manualOpen) onToggleManual();
  };

  return <Card testID="workspace-autopilot" style={{ gap: spacing.md }}>
    <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspaceAutopilot.title')}</Text>
    <View accessibilityLiveRegion="polite" testID="workspace-autopilot-status">
      <Text style={[typography.body, { color: c.textPrimary }]}>{t(`workspaceAutopilot.${statusKey}` as TranslationKey)}</Text>
      {state?.status === 'NEEDS_INPUT' && state.errorCode === 'workspace_autopilot_clarification_required' && state.reason ? <Markdown text={state.reason} /> : null}
      {state?.activeRequest ? <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('workspaceAutopilot.pending')}</Text> : null}
    </View>
    <View style={{ gap: spacing.xs }} testID="workspace-autopilot-progress">
      {sequence.map((item, index) => <Text key={item.key} style={[typography.bodySmall, { color: completed || index < currentIndex ? c.success : index === currentIndex ? c.textPrimary : c.textMuted }]}>
        {completed || index < currentIndex ? '✓ ' : index === currentIndex ? '● ' : '○ '}{t(`workspaceAutopilot.${item.key}` as TranslationKey)}
      </Text>)}
    </View>
    {replyText ? <View testID="workspace-autopilot-reply" style={{ gap: spacing.sm }}>
      <Markdown text={replyText} />
      {deconstruction && deconstruction !== replyText ? <Markdown text={deconstruction} /> : null}
    </View> : null}
    {!state?.consent && workspace.status === 'active' ? <Button testID="workspace-autopilot-start" label={t('workspaceAutopilot.start')} variant="ai" loading={busy} onPress={() => void command('start')} /> : null}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {state?.status === 'RUNNING' ? <Button testID="workspace-autopilot-pause" label={t('workspaceAutopilot.pause')} variant="secondary" onPress={() => void command('pause')} /> : null}
      {canResume ? <Button testID="workspace-autopilot-resume" label={t('workspaceAutopilot.resume')} variant="ai" loading={busy} disabled={Boolean(state?.activeRequest)} onPress={() => void resume()} /> : null}
      {workspace.status === 'active' ? <>
        <Button testID="workspace-autopilot-question" label={t('workspaceAutopilot.question')} variant="secondary" onPress={() => void interrupt(onQuestion)} />
        <Button testID="workspace-autopilot-source" label={t('workspaceAutopilot.addSource')} variant="secondary" onPress={() => void interrupt(onAddSource)} />
        <Button testID="workspace-autopilot-orientation" label={t('workspaceAutopilot.orientation')} variant="secondary" onPress={() => void interrupt(onOrientation)} />
      </> : null}
      {workspace.status === 'completed' ? <Button testID="workspace-autopilot-continue-editing" label={t('workspaceAutopilot.continueEditing')} variant="secondary" onPress={onContinueEditing} /> : null}
      {state?.consent && !completed && state.status !== 'STOPPED' ? <Button testID="workspace-autopilot-stop" label={t('workspaceAutopilot.stop')} variant="ghost" onPress={() => void command('stop')} /> : null}
      {undoAvailable ? <Button testID="workspace-autopilot-undo" label={t('workspaceAutopilot.undo')} variant="ghost" loading={busy} onPress={() => void command('undo')} /> : null}
    </View>
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
    <Button testID="workspace-autopilot-options" label={t(manualOpen ? 'workspaceAutopilot.hideOptions' : 'workspaceAutopilot.options')} variant="ghost" onPress={() => {
      if (manualOpen) onToggleManual();
      else void interrupt(onToggleManual);
    }} />
  </Card>;
}
