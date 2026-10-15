import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
  WORKSPACE_TEMPLATE_DEFINITIONS,
  workspaceCompletionChecks,
  workspaceShellFromTemplate,
  type Collection,
  type LibraryDocument,
  type LibraryPage,
  type PersistentWorkspace,
  type WorkspaceBrief,
  type WorkspacePlanItem,
  type WorkspaceProfessorPhase,
  type WorkspaceProfessorState,
  type WorkspaceProfessorTransitionRequest,
  type WorkspaceProfessorTransitionResponse,
  type WorkspaceSaveState,
  type WorkspaceSourceReference,
  type WorkspaceSourceState,
  type WorkspaceSourceStatesResponse,
} from '@second-brain/shared';
import { api, ApiError } from '../../../lib/client';
import { useI18n, type TranslationKey } from '../../../lib/i18n';
import { useTokens } from '../../../lib/design/theme';
import { useResponsive } from '../../../lib/responsive';
import { createClientRequestId } from '../../../lib/request-id';
import { workspaceCompletionLabel, workspaceFieldLabel } from '../../../lib/workspace-paths';
import { Alert, Badge, Button, Card, Input, Progress } from '../../../components/ds/core';
import { Page } from '../../../components/ds/layout';
import { SourceCitation, SourcePreview } from '../../../components/ds/sources';
import { SmartErrorState, SmartLoadingState } from '../../../components/ds/states';
import { WorkspaceAssistant } from '../../../components/workspace/assistant';
import { WorkspaceShell, type WorkspaceShellArea } from '../../../components/workspace/shell';

interface WorkspaceConflictDraft {
  content: string;
  serverReloaded: boolean;
  copyState: 'idle' | 'copied' | 'selectable';
}

export default function AcademicWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const { width, isLandscape } = useResponsive();
  // The AppShell sidebar remains visible on Web. Reserve enough real content
  // width before enabling the three-column Thesis/Report compositions.
  const desktop = width >= 1_400;
  const tabletSplit = width >= 760 && isLandscape;
  const [workspace, setWorkspace] = useState<PersistentWorkspace | null>(null);
  const [content, setContent] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [activeArea, setActiveArea] = useState<WorkspaceShellArea>('work');
  const [saveState, setSaveState] = useState<WorkspaceSaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [library, setLibrary] = useState<LibraryDocument[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [sourceStates, setSourceStates] = useState<WorkspaceSourceState[]>([]);
  const [sourcePickerLoaded, setSourcePickerLoaded] = useState(false);
  const [assistantUndo, setAssistantUndo] = useState<string | null>(null);
  const [conflictDraft, setConflictDraft] = useState<WorkspaceConflictDraft | null>(null);
  const [showConflictDraft, setShowConflictDraft] = useState(false);
  const revisionRef = useRef(0);
  const lastSavedRef = useRef('');
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef('');
  const conflictActiveRef = useRef(false);
  const leavingRef = useRef(false);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveRef = useRef<(nextContent: string) => Promise<boolean>>(async () => true);
  const transitionRequestRef = useRef<WorkspaceProfessorTransitionRequest | null>(null);

  const refreshSourceStates = async (workspaceId: string) => {
    try {
      const result = await api<WorkspaceSourceStatesResponse>(`/workspaces/${workspaceId}/sources`);
      setSourceStates(result.sources);
    } catch {
      // Source status is complementary. A temporary status endpoint failure
      // must not hide the persisted Workspace or invent an availability state.
      setSourceStates([]);
    }
  };

  const load = async (preserveConflictDraft = false): Promise<boolean> => {
    setError(null);
    try {
      const next = await api<PersistentWorkspace>(`/workspaces/${id}`);
      setWorkspace(next);
      void refreshSourceStates(next.id);
      setContent(next.draft.content);
      lastSavedRef.current = next.draft.content;
      revisionRef.current = next.autosaveRevision;
      loadedRef.current = true;
      transitionRequestRef.current = null;
      conflictActiveRef.current = false;
      if (preserveConflictDraft) {
        setConflictDraft((current) => current ? { ...current, serverReloaded: true } : null);
      } else {
        setConflictDraft(null);
        setShowConflictDraft(false);
      }
      setSaveState('saved');
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    }
  };

  useEffect(() => { void load(); }, [id]);

  const persist = async (nextContent: string): Promise<boolean> => {
    if (!workspace) return false;
    if (nextContent === lastSavedRef.current) return true;
    if (conflictActiveRef.current) {
      const latestContent = contentRef.current;
      setConflictDraft((current) => current
        ? { ...current, content: latestContent, copyState: 'idle' }
        : { content: latestContent, serverReloaded: false, copyState: 'idle' });
      return false;
    }
    setError(null);
    setSaveState('saving');
    try {
      const result = await api<{ saved: boolean; revision: number; updatedAt: string }>(`/workspaces/${workspace.id}/autosave`, {
        method: 'PATCH',
        body: { workspaceId: workspace.id, expectedRevision: revisionRef.current, draft: { format: 'markdown', content: nextContent } },
      });
      revisionRef.current = result.revision;
      lastSavedRef.current = nextContent;
      setWorkspace((current) => current ? { ...current, autosaveRevision: result.revision, draft: { ...current.draft, content: nextContent, revision: result.revision, updatedAt: result.updatedAt }, updatedAt: result.updatedAt } : current);
      setError(null);
      setSaveState('saved');
      return true;
    } catch (caught) {
      const apiError = caught as ApiError;
      setSaveState(apiError.status === 0 ? 'offline' : 'error');
      if (apiError.status === 409) {
        const latestContent = contentRef.current;
        conflictActiveRef.current = true;
        setConflictDraft({ content: latestContent, serverReloaded: false, copyState: 'idle' });
        setShowConflictDraft(false);
        setError(null);
      } else {
        setError((caught as Error).message);
      }
      return false;
    }
  };

  const save = (nextContent: string): Promise<boolean> => {
    const queued = saveQueueRef.current.then(
      () => persist(nextContent),
      () => persist(nextContent),
    );
    saveQueueRef.current = queued;
    return queued;
  };

  saveRef.current = save;
  contentRef.current = content;

  useEffect(() => {
    if (!loadedRef.current || content === lastSavedRef.current || conflictActiveRef.current) return;
    setSaveState('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void saveRef.current(content); }, 1_200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const pending = contentRef.current;
      if (state === 'active' || !loadedRef.current || pending === lastSavedRef.current || conflictActiveRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      void saveRef.current(pending);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const pending = contentRef.current;
      if (!loadedRef.current || pending === lastSavedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
      if (!conflictActiveRef.current) void saveRef.current(pending);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    const pending = contentRef.current;
    if (leavingRef.current) {
      leavingRef.current = false;
      return;
    }
    if (!loadedRef.current || pending === lastSavedRef.current) return;
    event.preventDefault();
    if (conflictActiveRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    void saveRef.current(pending).then((saved) => {
      if (!saved || contentRef.current !== lastSavedRef.current) return;
      leavingRef.current = true;
      navigation.dispatch(event.data.action);
      setTimeout(() => { leavingRef.current = false; }, 0);
    });
  }), [navigation]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const pending = contentRef.current;
    if (loadedRef.current && pending !== lastSavedRef.current && !conflictActiveRef.current) {
      void saveRef.current(pending);
    }
  }, []);

  const copyConflictContent = async () => {
    if (!conflictDraft) return;
    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(conflictDraft.content);
        copied = true;
      }
    } catch {
      copied = false;
    }
    setShowConflictDraft(true);
    setConflictDraft((current) => current ? { ...current, copyState: copied ? 'copied' : 'selectable' } : null);
  };

  const patchWorkspace = async (patch: Record<string, unknown>): Promise<boolean> => {
    if (!workspace) return false;
    setError(null);
    try {
      const next = await api<PersistentWorkspace>(`/workspaces/${workspace.id}`, {
        method: 'PATCH',
        body: { ...patch, expectedRevision: revisionRef.current },
      });
      revisionRef.current = next.autosaveRevision;
      setWorkspace(next);
      if (Object.prototype.hasOwnProperty.call(patch, 'sources')) void refreshSourceStates(next.id);
      setError(null);
      return true;
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError.status === 409 ? t('workspace10.conflict') : (caught as Error).message);
      return false;
    }
  };

  const updatePlan = async (plan: WorkspacePlanItem[]) => {
    await patchWorkspace({ plan });
  };

  const movePlan = (index: number, delta: number) => {
    if (!workspace) return;
    const target = index + delta;
    if (target < 0 || target >= workspace.plan.length) return;
    const plan = [...workspace.plan];
    [plan[index], plan[target]] = [plan[target]!, plan[index]!];
    void updatePlan(plan.map((item, order) => ({ ...item, order })));
  };

  const addPlanItem = () => {
    if (!workspace) return;
    void updatePlan([...workspace.plan, { id: `section-${Date.now()}`, title: t('workspace10.plan.new'), order: workspace.plan.length, completed: false }]);
  };

  const removePlanItem = (idToRemove: string) => workspace && void updatePlan(workspace.plan.filter((item) => item.id !== idToRemove).map((item, order) => ({ ...item, order })));

  const insertMarkup = (prefix: string, suffix = '') => {
    const selected = content.slice(selection.start, selection.end);
    const insertion = `${prefix}${selected}${suffix}`;
    setAssistantUndo(null);
    setContent(`${content.slice(0, selection.start)}${insertion}${content.slice(selection.end)}`);
  };

  const applyAssistantProposal = (proposal: string, mode: 'insert' | 'replace') => {
    const normalized = proposal.trim();
    if (!normalized) return;
    setAssistantUndo(content);
    if (mode === 'replace' && selection.end > selection.start) {
      setContent(`${content.slice(0, selection.start)}${normalized}${content.slice(selection.end)}`);
      return;
    }
    const before = content.slice(0, selection.end);
    const after = content.slice(selection.end);
    const leading = before && !before.endsWith('\n') ? '\n\n' : '';
    const trailing = after && !after.startsWith('\n') ? '\n\n' : '';
    setContent(`${before}${leading}${normalized}${trailing}${after}`);
  };

  const undoAssistantInsertion = () => {
    if (assistantUndo === null) return;
    setContent(assistantUndo);
    setAssistantUndo(null);
  };

  const applyProfessorState = (professor: WorkspaceProfessorState, _revision: number) => {
    // Professor-only mutations do not own the draft revision. Keeping the
    // editor token unchanged makes a draft changed in another tab surface as
    // the existing 409 conflict instead of letting stale local text overwrite
    // the canonical draft.
    setWorkspace((current) => current ? {
      ...current,
      professor,
      progress: {
        ...current.progress,
        workflow: {
          version: 1,
          brief: current.brief,
          professor,
        },
      },
    } : current);
  };

  const prepareProfessorAssist = async (): Promise<number | null> => {
    const pendingDraft = contentRef.current;
    if (pendingDraft !== lastSavedRef.current && !await save(pendingDraft)) return null;
    return revisionRef.current;
  };

  const refreshProfessorState = async () => {
    if (!workspace) return;
    const next = await api<PersistentWorkspace>(`/workspaces/${workspace.id}`);
    const draftStillCanonical = next.draft.content === lastSavedRef.current;
    if (draftStillCanonical) {
      revisionRef.current = next.autosaveRevision;
    } else {
      const localContent = contentRef.current;
      conflictActiveRef.current = true;
      setConflictDraft((current) => current
        ? { ...current, content: localContent, copyState: 'idle' }
        : { content: localContent, serverReloaded: false, copyState: 'idle' });
      setShowConflictDraft(false);
      setSaveState('error');
    }
    setWorkspace((current) => current ? {
      ...current,
      assistantHistory: next.assistantHistory,
      professor: next.professor,
      progress: {
        ...current.progress,
        workflow: {
          version: 1,
          brief: current.brief,
          professor: next.professor,
        },
      },
      ...(draftStillCanonical
        ? { autosaveRevision: next.autosaveRevision, updatedAt: next.updatedAt }
        : {}),
    } : current);
  };

  const handleProfessorAssistFailure = async () => {
    await refreshProfessorState();
  };

  const transitionProfessor = async (requestedPhase: WorkspaceProfessorPhase) => {
    if (!workspace) return;
    const pendingDraft = contentRef.current;
    if (pendingDraft !== lastSavedRef.current && !await save(pendingDraft)) {
      throw new Error(t('workspace10.save.error'));
    }
    const expectedPhase = workspace.professor.currentPhase;
    const expectedRevision = revisionRef.current;
    let request = transitionRequestRef.current;
    if (
      !request
      || request.expectedPhase !== expectedPhase
      || request.requestedPhase !== requestedPhase
      || request.expectedRevision !== expectedRevision
    ) {
      request = {
        requestId: createClientRequestId('workspace-transition'),
        expectedPhase,
        requestedPhase,
        expectedRevision,
      };
      transitionRequestRef.current = request;
    }
    try {
      const response = await api<WorkspaceProfessorTransitionResponse>(`/workspaces/${workspace.id}/transitions`, {
        method: 'POST',
        body: request,
        requestId: request.requestId,
      });
      transitionRequestRef.current = null;
      applyProfessorState(response.professor, response.revision);
    } catch (caught) {
      await refreshProfessorState().catch(() => undefined);
      throw caught;
    }
  };

  const openSourcePicker = async () => {
    setShowSourcePicker(true);
    if (sourcePickerLoaded) return;
    try {
      const [page, nextCollections] = await Promise.all([
        api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50'),
        api<Collection[]>('/library/collections'),
      ]);
      setLibrary(page.items.filter((item) => item.status === 'ready' || item.status === 'partial'));
      setCollections(nextCollections);
      setSourcePickerLoaded(true);
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const toggleSource = async (source: WorkspaceSourceReference) => {
    if (!workspace) return;
    const canonical = { kind: source.kind, id: source.id } satisfies WorkspaceSourceReference;
    const exists = workspace.sources.some((current) => current.kind === canonical.kind && current.id === canonical.id);
    const sources = exists
      ? workspace.sources.filter((current) => current.kind !== canonical.kind || current.id !== canonical.id).map(canonicalWorkspaceSource)
      : [...workspace.sources.map(canonicalWorkspaceSource), canonical];
    await patchWorkspace({ sources });
  };

  if (!workspace && !error) return <SmartLoadingState title={t('workspace10.opening')} detail={t('workspace10.openingDetail')} />;
  if (!workspace) return <SmartErrorState title={t('workspace10.unavailable')} detail={error ?? undefined} onRetry={() => void load()} />;

  const selectedText = content.slice(selection.start, selection.end).trim();
  const shellKind = workspaceShellFromTemplate(workspace.template);
  const total = workspace.plan.length;
  const done = workspace.plan.filter((item) => item.completed).length;
  const progress = total ? Math.round((done / total) * 100) : null;
  const completionChecks = workspaceCompletionChecks({
    template: workspace.template,
    brief: workspace.brief,
    plan: workspace.plan,
    sources: workspace.sources,
    draftContent: content,
  });
  const briefPanel = <BriefPanel workspace={workspace} onUpdate={(brief) => patchWorkspace({ brief })} />;
  const planPanel = <PlanPanel workspace={workspace} onUpdate={updatePlan} onMove={movePlan} onRemove={removePlanItem} onAdd={addPlanItem} />;
  const completionPanel = <CompletionPanel checks={completionChecks} />;
  const sourcesPanel = <SourcesPanel
    workspace={workspace}
    sourceStates={sourceStates}
    showPicker={showSourcePicker}
    library={library}
    collections={collections}
    onOpenPicker={() => void openSourcePicker()}
    onToggleSource={(source) => void toggleSource(source)}
    onOpenSource={(source) => {
      if (source.kind === 'document') router.push(`/library/${source.id}`);
      if (source.kind === 'brain') router.push('/brain');
      if (source.kind === 'research-source') router.push({ pathname: '/research', params: { experienceSessionId: source.id } });
    }}
  />;
  const assistantPanel = (
    <WorkspaceAssistant
      key={workspace.id}
      workspaceId={workspace.id}
      initialHistory={workspace.assistantHistory}
      professor={workspace.professor}
      completionChecks={completionChecks}
      selectedText={selectedText}
      onBeforeAssist={prepareProfessorAssist}
      onAssistFailure={handleProfessorAssistFailure}
      onProfessorChange={applyProfessorState}
      onRequestTransition={transitionProfessor}
      onApplyProposal={applyAssistantProposal}
      onUndo={undoAssistantInsertion}
      canUndo={assistantUndo !== null}
    />
  );
  const editor = <EditorPanel content={content} saveState={saveState} onChange={(value) => {
    setAssistantUndo(null);
    setContent(value);
    if (conflictActiveRef.current) {
      setConflictDraft((current) => current ? { ...current, content: value, copyState: 'idle' } : current);
    }
  }} onSelection={setSelection} onInsert={insertMarkup} onSave={() => void save(content)} />;

  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }}>
    <Page width="fluid" style={{ gap: spacing.lg, paddingBottom: spacing.huge }} testID="academic-workspace">
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, minWidth: 240 }}><Text style={[typography.overline, { color: c.aiAccent }]}>{t(`workspace10.template.${workspace.template}` as TranslationKey)}</Text><Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{workspace.title}</Text><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{workspace.objective || t('workspace10.noObjective')}</Text></View>
          <Badge tone={saveState === 'saved' ? 'success' : saveState === 'error' || saveState === 'offline' ? 'warning' : 'neutral'} label={t(`workspace10.save.${saveState}` as TranslationKey)} />
        </View>
        {progress !== null ? <View style={{ gap: spacing.xs }}><Progress value={progress} /><Text style={[typography.caption, { color: c.textMuted }]}>{t('workspace10.steps').replace('{done}', String(done)).replace('{total}', String(total))}</Text></View> : null}
      </View>
      {conflictDraft ? <Card style={{ gap: spacing.sm }} testID="workspace-conflict-recovery">
        <Alert tone="warning" title={t('error.conflict')} detail={t('workspace10.conflict')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {!conflictDraft.serverReloaded ? <Button testID="workspace-conflict-reload" size="sm" variant="secondary" label={t('health.refresh')} onPress={() => void load(true)} /> : null}
          <Button testID="workspace-conflict-copy" size="sm" variant="secondary" label={t(conflictDraft.copyState === 'copied' ? 'globalPath.copyDone' : 'globalPath.copy')} onPress={() => void copyConflictContent()} />
          {conflictDraft.serverReloaded ? <Button testID="workspace-conflict-dismiss" size="sm" variant="ghost" label={t('app.dismiss')} onPress={() => { setConflictDraft(null); setShowConflictDraft(false); }} /> : null}
        </View>
        {showConflictDraft ? <TextInput testID="workspace-conflict-local-draft" value={conflictDraft.content} editable={false} multiline selectTextOnFocus accessibilityLabel={t('workspace10.editor.label')} style={[typography.bodySmall, { minHeight: 120, borderWidth: 1, borderColor: c.border, color: c.textPrimary, padding: spacing.sm }]} /> : null}
      </Card> : null}
      {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
      <WorkspaceShell
        shellKind={shellKind}
        templateLabel={t(`workspace10.template.${workspace.template}` as TranslationKey)}
        plan={workspace.plan}
        activeArea={activeArea}
        onAreaChange={setActiveArea}
        desktop={desktop}
        tabletSplit={tabletSplit}
        briefPanel={briefPanel}
        planPanel={planPanel}
        completionPanel={completionPanel}
        sourcesPanel={sourcesPanel}
        editorPanel={editor}
        assistantPanel={assistantPanel}
      />
    </Page>
  </ScrollView>;
}

function BriefPanel({
  workspace,
  onUpdate,
}: {
  workspace: PersistentWorkspace;
  onUpdate: (brief: WorkspaceBrief) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const definition = WORKSPACE_TEMPLATE_DEFINITIONS[workspace.template];
  const [fields, setFields] = useState<WorkspaceBrief['fields']>(workspace.brief.fields);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setFields(workspace.brief.fields);
  }, [workspace.id, workspace.brief]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await onUpdate({
        version: 1,
        fields: Object.fromEntries(
          Object.entries(fields)
            .map(([field, value]) => [field, value?.trim()])
            .filter(([, value]) => Boolean(value)),
        ),
      });
      if (saved) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(fields) !== JSON.stringify(workspace.brief.fields);
  const visibleFields = definition.fields.filter((field) => Boolean(workspace.brief.fields[field]?.trim()));
  return <Card style={{ gap: spacing.sm }} testID="workspace-adaptive-brief">
    <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>
      {t(`workspace10.template.${workspace.template}` as TranslationKey)} · {t('workspace10.assistantQuestion')}
    </Text>
    {!editing ? <>
      {visibleFields.length ? visibleFields.map((field) => <View key={field} style={{ gap: spacing.xs }}>
        <Text style={[typography.caption, { color: c.textMuted }]}>{workspaceFieldLabel(field, t)}</Text>
        <Text style={[typography.bodySmall, { color: c.textPrimary }]}>{workspace.brief.fields[field]}</Text>
      </View>) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('workspace10.noObjective')}</Text>}
      <Button size="sm" variant="secondary" label={t('onb.edit')} onPress={() => setEditing(true)} />
    </> : definition.fields.map((field) => {
      const required = definition.requiredFields.includes(field);
      const label = workspaceFieldLabel(field, t);
      return <Input
        key={field}
        testID={`workspace-resume-field-${field}`}
        label={`${label}${required ? ' *' : ''}`}
        value={fields[field] ?? ''}
        onChangeText={(value) => setFields((current) => ({ ...current, [field]: value }))}
        placeholder={label}
        multiline
      />;
    })}
    {editing ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <Button size="sm" variant="secondary" label={t('workspace10.saveNow')} loading={saving} disabled={!dirty || saving} onPress={() => void save()} />
      <Button size="sm" variant="ghost" label={t('app.dismiss')} disabled={saving} onPress={() => { setFields(workspace.brief.fields); setEditing(false); }} />
    </View> : null}
  </Card>;
}

function CompletionPanel({ checks }: { checks: PersistentWorkspace['completionChecks'] }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <Card style={{ gap: spacing.sm }} testID="workspace-completion-controls">
    <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspace10.integrity')}</Text>
    {checks.map((check) => <View key={check.id} style={{ minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Text accessibilityLabel={check.passed ? t('workspace10.save.saved') : t('workspace10.save.dirty')} style={{ color: check.passed ? c.success : c.textMuted, fontWeight: '800' }}>{check.passed ? '✓' : '○'}</Text>
      <Text style={[typography.bodySmall, { flex: 1, color: c.textSecondary }]}>{workspaceCompletionLabel(check.id, t)}{check.required ? ' *' : ''}</Text>
    </View>)}
  </Card>;
}

function PlanPanel({ workspace, onUpdate, onMove, onRemove, onAdd }: { workspace: PersistentWorkspace; onUpdate: (plan: WorkspacePlanItem[]) => Promise<void>; onMove: (index: number, delta: number) => void; onRemove: (id: string) => void; onAdd: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <Card style={{ gap: spacing.sm }} testID="workspace-plan"><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspace10.plan')}</Text>{workspace.plan.map((item, index) => <View key={item.id} style={{ gap: spacing.xs, borderBottomWidth: index === workspace.plan.length - 1 ? 0 : 1, borderBottomColor: c.borderSubtle, paddingBottom: spacing.sm }}><View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }} onPress={() => void onUpdate(workspace.plan.map((row) => row.id === item.id ? { ...row, completed: !row.completed } : row))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: item.completed ? c.success : c.textMuted, fontSize: 18 }}>{item.completed ? '✓' : '○'}</Text></Pressable><TextInput defaultValue={item.title} onEndEditing={(event) => { const title = event.nativeEvent.text.trim(); if (title && title !== item.title) void onUpdate(workspace.plan.map((row) => row.id === item.id ? { ...row, title, stepId: undefined } : row)); }} style={[typography.bodySmall, { flex: 1, color: c.textPrimary, minHeight: 44 }]} accessibilityLabel={t('workspace10.plan.rename')} /></View><View style={{ flexDirection: 'row', gap: spacing.xs }}><Button size="sm" variant="ghost" label="↑" disabled={index === 0} onPress={() => onMove(index, -1)} /><Button size="sm" variant="ghost" label="↓" disabled={index === workspace.plan.length - 1} onPress={() => onMove(index, 1)} /><Button size="sm" variant="ghost" label={t('workspace10.plan.remove')} onPress={() => onRemove(item.id)} /></View></View>)}<Button size="sm" variant="secondary" label={t('workspace10.plan.add')} onPress={onAdd} /></Card>;
}

function EditorPanel({ content, saveState, onChange, onSelection, onInsert, onSave }: { content: string; saveState: WorkspaceSaveState; onChange: (value: string) => void; onSelection: (selection: { start: number; end: number }) => void; onInsert: (prefix: string, suffix?: string) => void; onSave: () => void }) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  return <Card style={{ gap: spacing.sm, minHeight: 620 }} testID="workspace-editor"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><Button size="sm" variant="ghost" label={t('workspace10.editor.heading')} onPress={() => onInsert('## ')} /><Button size="sm" variant="ghost" label={t('workspace10.editor.list')} onPress={() => onInsert('- ')} /><Button size="sm" variant="ghost" label={t('workspace10.editor.quote')} onPress={() => onInsert('> ')} /><Button size="sm" variant="ghost" label={t('workspace10.editor.reference')} onPress={() => onInsert('[', ']')} /></View><TextInput testID="workspace-draft-input" value={content} onChangeText={onChange} onSelectionChange={(event) => onSelection(event.nativeEvent.selection)} multiline textAlignVertical="top" placeholder={t('workspace10.editor.placeholder')} placeholderTextColor={c.textMuted} accessibilityLabel={t('workspace10.editor.label')} style={[typography.body, { flex: 1, minHeight: 520, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, backgroundColor: c.surfaceElevated, color: c.textPrimary, padding: spacing.md }]} /><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}><Text accessibilityLiveRegion="polite" style={[typography.caption, { color: saveState === 'error' || saveState === 'offline' ? c.warning : c.textMuted }]}>{t(`workspace10.save.${saveState}` as TranslationKey)}</Text><Button testID="workspace-save-draft" size="sm" variant="secondary" label={t('workspace10.saveNow')} disabled={saveState === 'saving' || saveState === 'saved'} onPress={onSave} /></View></Card>;
}

function canonicalWorkspaceSource(source: WorkspaceSourceReference): WorkspaceSourceReference {
  return { kind: source.kind, id: source.id };
}

function SourcesPanel({
  workspace,
  sourceStates,
  showPicker,
  library,
  collections,
  onOpenPicker,
  onToggleSource,
  onOpenSource,
}: {
  workspace: PersistentWorkspace;
  sourceStates: WorkspaceSourceState[];
  showPicker: boolean;
  library: LibraryDocument[];
  collections: Collection[];
  onOpenPicker: () => void;
  onToggleSource: (source: WorkspaceSourceReference) => void;
  onOpenSource: (source: WorkspaceSourceReference) => void;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [preview, setPreview] = useState<WorkspaceSourceReference | null>(null);
  const states = new Map(sourceStates.map((state) => [`${state.kind}:${state.id}`, state]));
  const previewState = preview ? states.get(`${preview.kind}:${preview.id}`) : undefined;
  const brainSelected = workspace.sources.some((source) => source.kind === 'brain' && source.id === 'brain');
  return <Card style={{ gap: spacing.sm }} testID="workspace-sources">
    <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspace10.sources')}</Text>
    {workspace.sources.length ? workspace.sources.map((source, index) => {
      const state = states.get(`${source.kind}:${source.id}`);
      const title = source.kind === 'brain' ? t('research10.scope.brain') : state?.title ?? source.id;
      const kind = source.kind === 'brain' ? 'brain' : source.kind === 'research-source' ? 'external' : 'document';
      return <View key={`${source.kind}:${source.id}`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs }}>
        <SourceCitation title={title} kind={kind} index={index + 1} compact={false} onPress={() => setPreview(source)} />
        {state ? <Badge
          label={sourceAvailabilityLabel(state, t)}
          tone={state.availability === 'available' ? 'success' : state.availability === 'processing' ? 'info' : 'warning'}
        /> : null}
      </View>;
    }) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('workspace10.sourcesEmpty')}</Text>}
    <Button size="sm" variant="secondary" label={t('workspace10.addSource')} onPress={onOpenPicker} />
    {showPicker ? <View style={{ gap: spacing.md }} testID="workspace-source-picker">
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.sourceMode.documents')}</Text>
        {library.map((document) => {
          const checked = workspace.sources.some((source) => source.kind === 'document' && source.id === document.id);
          return <SourcePickerChoice key={document.id} title={document.title} checked={checked} onPress={() => onToggleSource({ kind: 'document', id: document.id })} />;
        })}
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.sourceMode.collections')}</Text>
        {collections.map((collection) => {
          const checked = workspace.sources.some((source) => source.kind === 'collection' && source.id === collection.id);
          return <SourcePickerChoice key={collection.id} title={collection.name} checked={checked} onPress={() => onToggleSource({ kind: 'collection', id: collection.id })} />;
        })}
      </View>
      <SourcePickerChoice title={t('research10.scope.brain')} checked={brainSelected} onPress={() => onToggleSource({ kind: 'brain', id: 'brain' })} />
    </View> : null}
    {preview ? <SourcePreview
      title={preview.kind === 'brain' ? t('research10.scope.brain') : previewState?.title ?? preview.id}
      snippet={previewState ? sourceAvailabilityLabel(previewState, t) : null}
      kind={preview.kind === 'brain' ? 'brain' : preview.kind === 'research-source' ? 'external' : 'document'}
      onOpen={preview.kind === 'collection' ? undefined : () => onOpenSource(preview)}
      onClose={() => setPreview(null)}
    /> : null}
  </Card>;
}

function SourcePickerChoice({ title, checked, onPress }: { title: string; checked: boolean; onPress: () => void }) {
  const { colors: c, spacing, typography } = useTokens();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
    <Text style={{ color: c.primary }}>{checked ? '✓' : '○'}</Text>
    <Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{title}</Text>
  </Pressable>;
}

function sourceAvailabilityLabel(state: WorkspaceSourceState, t: (key: TranslationKey) => string): string {
  if (state.availability === 'available') return t('lib.status.ready');
  if (state.availability === 'processing') return t('lib.status.processing');
  return t('workspace10.unavailable');
}
