import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  workspaceProgressFromPlan,
  type LibraryDocument,
  type LibraryPage,
  type PersistentWorkspace,
  type WorkspacePlanItem,
  type WorkspaceSaveState,
  type WorkspaceSourceReference,
} from '@second-brain/shared';
import { api, ApiError } from '../../../lib/client';
import { useI18n, type TranslationKey } from '../../../lib/i18n';
import { useTokens } from '../../../lib/design/theme';
import { useResponsive } from '../../../lib/responsive';
import { Alert, Badge, Button, Card, Progress, SegmentedControl } from '../../../components/ds/core';
import { Page } from '../../../components/ds/layout';
import { SourceCitation, SourcePreview } from '../../../components/ds/sources';
import { SmartErrorState, SmartLoadingState } from '../../../components/ds/states';
import { WorkspaceAssistant } from '../../../components/workspace/assistant';

type WorkspaceArea = 'plan' | 'work' | 'sources' | 'assistant';
const AREAS: readonly WorkspaceArea[] = ['plan', 'work', 'sources', 'assistant'];

export default function AcademicWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const { width, isLandscape } = useResponsive();
  const desktop = width >= 1100;
  const tabletSplit = width >= 760 && isLandscape;
  const [workspace, setWorkspace] = useState<PersistentWorkspace | null>(null);
  const [content, setContent] = useState('');
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [activeArea, setActiveArea] = useState<WorkspaceArea>('work');
  const [saveState, setSaveState] = useState<WorkspaceSaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [library, setLibrary] = useState<LibraryDocument[]>([]);
  const revisionRef = useRef(0);
  const lastSavedRef = useRef('');
  const loadedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async () => {
    setError(null);
    try {
      const next = await api<PersistentWorkspace>(`/workspaces/${id}`);
      setWorkspace(next);
      setContent(next.draft.content);
      lastSavedRef.current = next.draft.content;
      revisionRef.current = next.autosaveRevision;
      loadedRef.current = true;
      setSaveState('saved');
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    if (!loadedRef.current || content === lastSavedRef.current) return;
    setSaveState('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void save(content); }, 1_200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [content]);

  const save = async (nextContent: string) => {
    if (!workspace || nextContent === lastSavedRef.current) return;
    setSaveState('saving');
    try {
      const result = await api<{ saved: boolean; revision: number; updatedAt: string }>(`/workspaces/${workspace.id}/autosave`, {
        method: 'PATCH',
        body: { workspaceId: workspace.id, expectedRevision: revisionRef.current, draft: { format: 'markdown', content: nextContent } },
      });
      revisionRef.current = result.revision;
      lastSavedRef.current = nextContent;
      setWorkspace((current) => current ? { ...current, autosaveRevision: result.revision, draft: { ...current.draft, content: nextContent, revision: result.revision, updatedAt: result.updatedAt }, updatedAt: result.updatedAt } : current);
      setSaveState('saved');
    } catch (caught) {
      const apiError = caught as ApiError;
      setSaveState(apiError.status === 0 ? 'offline' : 'error');
      setError(apiError.status === 409 ? t('workspace10.conflict') : (caught as Error).message);
    }
  };

  const patchWorkspace = async (patch: Record<string, unknown>) => {
    if (!workspace) return;
    try {
      const next = await api<PersistentWorkspace>(`/workspaces/${workspace.id}`, { method: 'PATCH', body: patch });
      setWorkspace(next);
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const updatePlan = async (plan: WorkspacePlanItem[]) => {
    setWorkspace((current) => current ? { ...current, plan, progress: workspaceProgressFromPlan(plan) } : current);
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
    setContent(`${content.slice(0, selection.start)}${insertion}${content.slice(selection.end)}`);
  };

  const openSourcePicker = async () => {
    setShowSourcePicker(true);
    if (library.length) return;
    try {
      const page = await api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50');
      setLibrary(page.items.filter((item) => item.status === 'ready'));
    } catch (caught) {
      setError((caught as Error).message);
    }
  };

  const toggleDocumentSource = async (document: LibraryDocument) => {
    if (!workspace) return;
    const exists = workspace.sources.some((source) => source.kind === 'document' && source.id === document.id);
    const sources = exists
      ? workspace.sources.filter((source) => source.kind !== 'document' || source.id !== document.id)
      : [...workspace.sources, { kind: 'document' as const, id: document.id, title: document.title }];
    await patchWorkspace({ sources });
  };

  if (!workspace && !error) return <SmartLoadingState title={t('workspace10.opening')} detail={t('workspace10.openingDetail')} />;
  if (!workspace) return <SmartErrorState title={t('workspace10.unavailable')} detail={error ?? undefined} onRetry={() => void load()} />;

  const selectedText = content.slice(selection.start, selection.end).trim();
  const total = workspace.plan.length;
  const done = workspace.plan.filter((item) => item.completed).length;
  const progress = total ? Math.round((done / total) * 100) : null;
  const nextSection = workspace.plan.find((item) => !item.completed);
  const planPanel = <PlanPanel workspace={workspace} onUpdate={updatePlan} onMove={movePlan} onRemove={removePlanItem} onAdd={addPlanItem} />;
  const sourcesPanel = <SourcesPanel workspace={workspace} showPicker={showSourcePicker} library={library} onOpenPicker={() => void openSourcePicker()} onToggleDocument={(document) => void toggleDocumentSource(document)} onOpenDocument={(documentId) => router.push(`/library/${documentId}`)} />;
  const assistantPanel = <WorkspaceAssistant workspaceId={workspace.id} initialHistory={workspace.assistantHistory} selectedText={selectedText} />;
  const editor = <EditorPanel content={content} saveState={saveState} onChange={setContent} onSelection={setSelection} onInsert={insertMarkup} onSave={() => void save(content)} />;

  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }}>
    <Page width="fluid" style={{ gap: spacing.lg, paddingBottom: spacing.huge }} testID="academic-workspace">
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ flex: 1, minWidth: 240 }}><Text style={[typography.overline, { color: c.aiAccent }]}>{t(`workspace10.template.${workspace.template}` as TranslationKey)}</Text><Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{workspace.title}</Text><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{workspace.objective || t('workspace10.noObjective')}</Text></View>
          <Badge tone={saveState === 'saved' ? 'success' : saveState === 'error' || saveState === 'offline' ? 'warning' : 'neutral'} label={t(`workspace10.save.${saveState}` as TranslationKey)} />
        </View>
        {progress !== null ? <View style={{ gap: spacing.xs }}><Progress value={progress} /><Text style={[typography.caption, { color: c.textMuted }]}>{t('workspace10.steps').replace('{done}', String(done)).replace('{total}', String(total))}</Text></View> : null}
      </View>
      {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
      {!desktop ? <SegmentedControl options={AREAS} value={activeArea} onChange={setActiveArea} labelFor={(value) => t(`workspace10.area.${value}`)} /> : null}

      {desktop ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}><View style={{ width: 270, gap: spacing.md }}>{planPanel}{sourcesPanel}</View><View style={{ flex: 1, minWidth: 0 }}>{editor}</View><View style={{ width: 340 }}>{assistantPanel}</View></View>
        : tabletSplit ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}><View style={{ width: 280 }}>{activeArea === 'assistant' ? assistantPanel : activeArea === 'sources' ? sourcesPanel : planPanel}</View><View style={{ flex: 1, minWidth: 0 }}>{editor}</View></View>
          : activeArea === 'plan' ? planPanel : activeArea === 'sources' ? sourcesPanel : activeArea === 'assistant' ? assistantPanel : editor}

      <Card style={{ gap: spacing.sm, borderColor: c.aiAccent }}>
        <Text style={[typography.overline, { color: c.aiAccent }]}>{t('workspace10.next')}</Text>
        <Text style={[typography.h3, { color: c.textPrimary }]}>{nextSection ? t('workspace10.nextSection').replace('{section}', nextSection.title) : t('workspace10.nextSources')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}><Button label={nextSection ? t('workspace10.continue') : t('workspace10.addSource')} onPress={() => setActiveArea(nextSection ? 'work' : 'sources')} /><Button label={t('workspace10.askTutor')} variant="secondary" onPress={() => router.push({ pathname: '/tutor', params: { mode: 'discuss', workspaceId: workspace.id, workspaceTitle: workspace.title } })} /><Button label={t('workspace10.research')} variant="ghost" onPress={() => router.push({ pathname: '/research', params: { q: workspace.objective || workspace.title, workspaceId: workspace.id } })} /></View>
      </Card>
    </Page>
  </ScrollView>;
}

function PlanPanel({ workspace, onUpdate, onMove, onRemove, onAdd }: { workspace: PersistentWorkspace; onUpdate: (plan: WorkspacePlanItem[]) => Promise<void>; onMove: (index: number, delta: number) => void; onRemove: (id: string) => void; onAdd: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  return <Card style={{ gap: spacing.sm }} testID="workspace-plan"><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspace10.plan')}</Text>{workspace.plan.map((item, index) => <View key={item.id} style={{ gap: spacing.xs, borderBottomWidth: index === workspace.plan.length - 1 ? 0 : 1, borderBottomColor: c.borderSubtle, paddingBottom: spacing.sm }}><View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.completed }} onPress={() => void onUpdate(workspace.plan.map((row) => row.id === item.id ? { ...row, completed: !row.completed } : row))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: item.completed ? c.success : c.textMuted, fontSize: 18 }}>{item.completed ? '✓' : '○'}</Text></Pressable><TextInput defaultValue={item.title} onEndEditing={(event) => { const title = event.nativeEvent.text.trim(); if (title && title !== item.title) void onUpdate(workspace.plan.map((row) => row.id === item.id ? { ...row, title } : row)); }} style={[typography.bodySmall, { flex: 1, color: c.textPrimary, minHeight: 44 }]} accessibilityLabel={t('workspace10.plan.rename')} /></View><View style={{ flexDirection: 'row', gap: spacing.xs }}><Button size="sm" variant="ghost" label="↑" disabled={index === 0} onPress={() => onMove(index, -1)} /><Button size="sm" variant="ghost" label="↓" disabled={index === workspace.plan.length - 1} onPress={() => onMove(index, 1)} /><Button size="sm" variant="ghost" label={t('workspace10.plan.remove')} onPress={() => onRemove(item.id)} /></View></View>)}<Button size="sm" variant="secondary" label={t('workspace10.plan.add')} onPress={onAdd} /></Card>;
}

function EditorPanel({ content, saveState, onChange, onSelection, onInsert, onSave }: { content: string; saveState: WorkspaceSaveState; onChange: (value: string) => void; onSelection: (selection: { start: number; end: number }) => void; onInsert: (prefix: string, suffix?: string) => void; onSave: () => void }) {
  const { t } = useI18n();
  const { colors: c, radius, spacing, typography } = useTokens();
  return <Card style={{ gap: spacing.sm, minHeight: 620 }} testID="workspace-editor"><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><Button size="sm" variant="ghost" label={t('workspace10.editor.heading')} onPress={() => onInsert('## ')} /><Button size="sm" variant="ghost" label={t('workspace10.editor.list')} onPress={() => onInsert('- ')} /><Button size="sm" variant="ghost" label={t('workspace10.editor.quote')} onPress={() => onInsert('> ')} /><Button size="sm" variant="ghost" label={t('workspace10.editor.reference')} onPress={() => onInsert('[', ']')} /></View><TextInput value={content} onChangeText={onChange} onSelectionChange={(event) => onSelection(event.nativeEvent.selection)} multiline textAlignVertical="top" placeholder={t('workspace10.editor.placeholder')} placeholderTextColor={c.textMuted} accessibilityLabel={t('workspace10.editor.label')} style={[typography.body, { flex: 1, minHeight: 520, borderWidth: 1, borderColor: c.border, borderRadius: radius.sm, backgroundColor: c.surfaceElevated, color: c.textPrimary, padding: spacing.md }]} /><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}><Text accessibilityLiveRegion="polite" style={[typography.caption, { color: saveState === 'error' || saveState === 'offline' ? c.warning : c.textMuted }]}>{t(`workspace10.save.${saveState}` as TranslationKey)}</Text><Button size="sm" variant="secondary" label={t('workspace10.saveNow')} disabled={saveState === 'saving' || saveState === 'saved'} onPress={onSave} /></View></Card>;
}

function SourcesPanel({ workspace, showPicker, library, onOpenPicker, onToggleDocument, onOpenDocument }: { workspace: PersistentWorkspace; showPicker: boolean; library: LibraryDocument[]; onOpenPicker: () => void; onToggleDocument: (document: LibraryDocument) => void; onOpenDocument: (id: string) => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [preview, setPreview] = useState<WorkspaceSourceReference | null>(null);
  return <Card style={{ gap: spacing.sm }} testID="workspace-sources"><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspace10.sources')}</Text>{workspace.sources.length ? workspace.sources.map((source, index) => <SourceCitation key={`${source.kind}:${source.id}`} title={source.title ?? source.id} kind={source.kind === 'research-source' ? 'external' : 'document'} index={index + 1} compact={false} onPress={() => setPreview(source)} />) : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('workspace10.sourcesEmpty')}</Text>}<Button size="sm" variant="secondary" label={t('workspace10.addSource')} onPress={onOpenPicker} />{showPicker ? <View style={{ gap: spacing.xs }}>{library.map((document) => { const checked = workspace.sources.some((source) => source.kind === 'document' && source.id === document.id); return <Pressable key={document.id} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onToggleDocument(document)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}><Text style={{ color: c.primary }}>{checked ? '✓' : '○'}</Text><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, flex: 1 }]}>{document.title}</Text></Pressable>; })}</View> : null}{preview ? <SourcePreview title={preview.title ?? preview.id} snippet={preview.synthesis ?? preview.question ?? null} kind={preview.kind === 'research-source' ? 'external' : 'document'} onOpen={preview.kind === 'document' ? () => onOpenDocument(preview.id) : undefined} onClose={() => setPreview(null)} /> : null}</Card>;
}
