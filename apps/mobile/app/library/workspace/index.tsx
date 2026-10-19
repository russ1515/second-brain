import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  WORKSPACE_TEMPLATE_DEFINITIONS,
  WORKSPACE_TEMPLATES,
  type Collection,
  type LibraryDocument,
  type LibraryPage,
  type PersistentWorkspace,
  type WorkspaceBrief,
  type WorkspacePage,
  type WorkspaceSourceReference,
  type WorkspaceTemplate,
} from '@second-brain/shared';
import { api } from '../../../lib/client';
import { useAuth } from '../../../lib/auth-context';
import { createClientRequestId } from '../../../lib/request-id';
import { useI18n, type TranslationKey } from '../../../lib/i18n';
import { useTokens } from '../../../lib/design/theme';
import { useResponsive } from '../../../lib/responsive';
import { localizedWorkspacePlan, workspaceFieldLabel } from '../../../lib/workspace-paths';
import { Alert, Badge, Button, Card, EmptyState, Input, Progress, SegmentedControl } from '../../../components/ds/core';
import { Page, Section } from '../../../components/ds/layout';
import { SmartLoadingState } from '../../../components/ds/states';
import { WorkspaceUniversalCapture } from '../../../components/workspace/universal-capture';

type SourceMode = 'documents' | 'collections' | 'brain';

export default function WorkspaceHomeScreen() {
  const params = useLocalSearchParams<{ documentId?: string; title?: string; objective?: string; type?: string; captureStatus?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing, typography, radius } = useTokens();
  const { width } = useResponsive();
  const desktop = width >= 1024;
  const [page, setPage] = useState<WorkspacePage | null>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [template, setTemplate] = useState<WorkspaceTemplate>(workspaceTemplateFromParam(params.type));
  const [title, setTitle] = useState(params.title ?? '');
  const [objective, setObjective] = useState(params.objective ?? '');
  const [briefFields, setBriefFields] = useState<WorkspaceBrief['fields']>({});
  const [dueAt, setDueAt] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('documents');
  const [sources, setSources] = useState<WorkspaceSourceReference[]>(params.documentId ? [{ kind: 'document', id: params.documentId }] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [loadingMoreWorkspaces, setLoadingMoreWorkspaces] = useState(false);
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentNextCursor, setDocumentNextCursor] = useState<string | null>(null);
  const [loadingMoreDocuments, setLoadingMoreDocuments] = useState(false);
  const creatingRef = useRef(false);
  const createRequestRef = useRef<{ signature: string; requestId: string } | null>(null);
  const listOwnerRef = useRef<string | undefined>(user?.id);
  const documentSearchRef = useRef(documentSearch);
  const workspaceCursorRef = useRef<string | null>(page?.nextCursor ?? null);
  const documentCursorRef = useRef<string | null>(documentNextCursor);
  const initialTemplateHint = explicitWorkspaceTemplateFromParam(params.type);
  const workspaceListEpoch = useRef(0);
  const documentListEpoch = useRef(0);
  listOwnerRef.current = user?.id;
  documentSearchRef.current = documentSearch;
  workspaceCursorRef.current = page?.nextCursor ?? null;
  documentCursorRef.current = documentNextCursor;
  const templateDefinition = WORKSPACE_TEMPLATE_DEFINITIONS[template];
  const localizedPlan = useMemo(
    () => localizedWorkspacePlan(template, t),
    [template, t],
  );
  const requiredBriefReady = templateDefinition.requiredFields.every((field) => Boolean(briefFields[field]?.trim()));

  useEffect(() => {
    let active = true;
    const ownerId = user?.id;
    const epoch = ++workspaceListEpoch.current;
    setPage(null);
    setCollections([]);
    setLoadingMoreWorkspaces(false);
    setSources(params.documentId ? [{ kind: 'document', id: params.documentId }] : []);
    if (!ownerId) return () => { active = false; };
    void Promise.all([
      api<WorkspacePage>('/workspaces?limit=50'),
      api<Collection[]>('/library/collections'),
    ]).then(([workspaces, nextCollections]) => {
      if (!active || workspaceListEpoch.current !== epoch || listOwnerRef.current !== ownerId) return;
      setPage(workspaces);
      setCollections(nextCollections);
    }).catch((caught) => {
      if (active && workspaceListEpoch.current === epoch && listOwnerRef.current === ownerId) setError((caught as Error).message);
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const ownerId = user?.id;
    const search = documentSearch;
    const epoch = ++documentListEpoch.current;
    setDocuments([]);
    setDocumentNextCursor(null);
    setLoadingMoreDocuments(false);
    if (!ownerId) return () => { active = false; };
    const timer = setTimeout(() => {
      void api<LibraryPage>(libraryPageUrl(search)).then((library) => {
        if (!active || documentListEpoch.current !== epoch || listOwnerRef.current !== ownerId || documentSearchRef.current !== search) return;
        setDocuments(library.items.filter(selectableWorkspaceDocument));
        setDocumentNextCursor(library.nextCursor);
      }).catch((caught) => {
        if (active && documentListEpoch.current === epoch && listOwnerRef.current === ownerId && documentSearchRef.current === search) setError((caught as Error).message);
      });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [documentSearch, user?.id]);

  const create = async () => {
    if (creatingRef.current || !title.trim() || !requiredBriefReady) return;
    creatingRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: title.trim(),
        template,
        objective: objective.trim(),
        autopilotConsent: true,
        sources: sources.map(canonicalWorkspaceSource),
        plan: localizedPlan,
        brief: {
          version: 1 as const,
          fields: Object.fromEntries(
            templateDefinition.fields
              .map((field) => [field, briefFields[field]?.trim()])
              .filter(([, value]) => Boolean(value)),
          ),
        },
        ...(dueAt.trim() ? { dueAt: new Date(`${dueAt.trim()}T12:00:00`).toISOString() } : {}),
      };
      const signature = JSON.stringify(body);
      if (createRequestRef.current?.signature !== signature) {
        createRequestRef.current = {
          signature,
          requestId: createClientRequestId('workspace'),
        };
      }
      const requestId = createRequestRef.current.requestId;
      const workspace = await api<PersistentWorkspace>('/workspaces', {
        method: 'POST',
        body: { ...body, requestId },
        requestId,
      });
      createRequestRef.current = null;
      router.push(`/library/workspace/${workspace.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      creatingRef.current = false;
      setBusy(false);
    }
  };

  const toggleSource = (source: WorkspaceSourceReference) => setSources((current) => {
    const exists = current.some((item) => item.kind === source.kind && item.id === source.id);
    return exists ? current.filter((item) => item.kind !== source.kind || item.id !== source.id) : current.length < 50 ? [...current, source] : current;
  });

  const selected = (kind: WorkspaceSourceReference['kind'], id: string) => sources.some((source) => source.kind === kind && source.id === id);

  const loadMoreWorkspaces = async () => {
    if (!page?.nextCursor || loadingMoreWorkspaces) return;
    const ownerId = user?.id;
    const cursor = page.nextCursor;
    const epoch = workspaceListEpoch.current;
    if (!ownerId) return;
    setLoadingMoreWorkspaces(true);
    setError(null);
    try {
      const next = await api<WorkspacePage>(`/workspaces?limit=50&cursor=${encodeURIComponent(cursor)}`);
      if (workspaceListEpoch.current !== epoch || listOwnerRef.current !== ownerId || workspaceCursorRef.current !== cursor) return;
      setPage((current) => current?.nextCursor === cursor ? {
        items: [...current.items, ...next.items.filter((item) => !current.items.some((existing) => existing.id === item.id))],
        nextCursor: next.nextCursor,
      } : current);
    } catch (caught) {
      if (workspaceListEpoch.current === epoch && listOwnerRef.current === ownerId && workspaceCursorRef.current === cursor) setError((caught as Error).message);
    } finally {
      if (workspaceListEpoch.current === epoch && listOwnerRef.current === ownerId) setLoadingMoreWorkspaces(false);
    }
  };

  const loadMoreDocuments = async () => {
    if (!documentNextCursor || loadingMoreDocuments) return;
    const ownerId = user?.id;
    const search = documentSearch;
    const cursor = documentNextCursor;
    const epoch = documentListEpoch.current;
    if (!ownerId) return;
    setLoadingMoreDocuments(true);
    setError(null);
    try {
      const next = await api<LibraryPage>(libraryPageUrl(search, cursor));
      if (documentListEpoch.current !== epoch || listOwnerRef.current !== ownerId || documentSearchRef.current !== search || documentCursorRef.current !== cursor) return;
      setDocuments((current) => [
        ...current,
        ...next.items.filter(selectableWorkspaceDocument).filter((item) => !current.some((existing) => existing.id === item.id)),
      ]);
      setDocumentNextCursor(next.nextCursor);
    } catch (caught) {
      if (documentListEpoch.current === epoch && listOwnerRef.current === ownerId && documentSearchRef.current === search && documentCursorRef.current === cursor) setError((caught as Error).message);
    } finally {
      if (documentListEpoch.current === epoch && listOwnerRef.current === ownerId && documentSearchRef.current === search) setLoadingMoreDocuments(false);
    }
  };

  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }}>
    <Page width="wide" style={{ gap: spacing.xl, paddingBottom: spacing.huge }} testID="workspace-home">
      <View style={{ gap: spacing.xs, maxWidth: 820 }}>
        <Text style={[typography.overline, { color: c.aiAccent }]}>{t('workspace10.eyebrow')}</Text>
        <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('workspace10.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary }]}>{t('workspace10.subtitle')}</Text>
      </View>
      {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}

      {user ? <WorkspaceUniversalCapture
        ownerUserId={user.id}
        documents={documents}
        collections={collections}
        workspaces={page?.items ?? []}
        hasMoreWorkspaces={Boolean(page?.nextCursor)}
        loadingMoreWorkspaces={loadingMoreWorkspaces}
        onLoadMoreWorkspaces={() => void loadMoreWorkspaces()}
        documentSearch={documentSearch}
        onDocumentSearchChange={setDocumentSearch}
        hasMoreDocuments={Boolean(documentNextCursor)}
        loadingMoreDocuments={loadingMoreDocuments}
        onLoadMoreDocuments={() => void loadMoreDocuments()}
        initialDocument={params.documentId ? { id: params.documentId, title: params.title, status: params.captureStatus } : undefined}
        initialTemplateHint={initialTemplateHint}
      /> : null}

      <Button
        testID="workspace-manual-toggle"
        variant="ghost"
        label={manualOpen ? t('app.dismiss') : t('workspaceCapture.manual')}
        onPress={() => setManualOpen((value) => !value)}
      />

      <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.xl }}>
        {manualOpen ? <Card style={{ flex: 1, width: '100%', gap: spacing.md }} testID="workspace-create">
          <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('workspace10.create')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {WORKSPACE_TEMPLATES.map((value) => <Pressable key={value} testID={`workspace-template-${value}`} accessibilityRole="radio" accessibilityState={{ selected: template === value }} onPress={() => setTemplate(value)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: template === value ? c.primary : c.border, backgroundColor: template === value ? c.primary : c.surfaceSunken }}><Text style={[typography.bodySmall, { color: template === value ? c.onPrimary : c.textPrimary, fontWeight: '700' }]}>{t(`workspace10.template.${value}` as TranslationKey)}</Text></Pressable>)}
          </View>
          <Input testID="workspace-title" label={t('workspace10.field.title')} value={title} onChangeText={setTitle} placeholder={t('workspace10.field.titlePlaceholder')} />
          <Input testID="workspace-objective" label={t('workspace10.field.objective')} value={objective} onChangeText={setObjective} placeholder={t('workspace10.field.objectivePlaceholder')} multiline />
          <View style={{ gap: spacing.sm }} testID="workspace-adaptive-fields">
            {templateDefinition.fields.map((field) => {
              const required = templateDefinition.requiredFields.includes(field);
              const label = workspaceFieldLabel(field, t);
              return <Input
                key={field}
                testID={`workspace-field-${field}`}
                label={`${label}${required ? ' *' : ''}`}
                value={briefFields[field] ?? ''}
                onChangeText={(value) => setBriefFields((current) => ({ ...current, [field]: value }))}
                placeholder={label}
                multiline
              />;
            })}
          </View>
          <Input label={t('workspace10.field.due')} value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" inputMode="numeric" />
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}><Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.sources')}</Text><Badge label={t('workspace10.sourceCount').replace('{n}', String(sources.length))} tone={sources.length ? 'primary' : 'neutral'} /></View>
            <SegmentedControl options={['documents', 'collections', 'brain'] as const} value={sourceMode} onChange={setSourceMode} labelFor={(value) => value === 'brain' ? t('research10.scope.brain') : t(`workspace10.sourceMode.${value}`)} />
            {sourceMode === 'documents' ? <Input value={documentSearch} onChangeText={setDocumentSearch} placeholder={t('library7.search')} /> : null}
            <View style={{ maxHeight: 250, gap: spacing.xs }}>
              {sourceMode === 'documents' ? documents.map((document) => <SourceChoice key={document.id} title={document.title} detail={document.subject ?? document.source.toUpperCase()} checked={selected('document', document.id)} onPress={() => toggleSource({ kind: 'document', id: document.id })} />) : null}
              {sourceMode === 'collections' ? collections.map((collection) => <SourceChoice key={collection.id} title={collection.name} detail={t('library7.documentsCount').replace('{n}', String(collection.documentCount))} checked={selected('collection', collection.id)} onPress={() => toggleSource({ kind: 'collection', id: collection.id })} />) : null}
              {sourceMode === 'brain' ? <SourceChoice title={t('research10.scope.brain')} detail={t('brain8.ask.detail')} checked={selected('brain', 'brain')} onPress={() => toggleSource({ kind: 'brain', id: 'brain' })} /> : null}
            </View>
            {sourceMode === 'documents' && documentNextCursor ? <Button size="sm" variant="ghost" label={t('brain8.loadMore')} loading={loadingMoreDocuments} disabled={loadingMoreDocuments} onPress={() => void loadMoreDocuments()} /> : null}
          </View>
          <Card style={{ gap: spacing.xs, backgroundColor: c.surfaceSunken }} testID="workspace-adaptive-plan"><Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.structure')}</Text>{localizedPlan.map((item, index) => <Text key={item.id} style={[typography.bodySmall, { color: c.textSecondary }]}>{index + 1}. {item.title}</Text>)}</Card>
          <Alert tone="info" title={t('workspace10.integrity')} detail={t('workspace10.integrityDetail')} />
          <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('workspaceAutopilot.consent')}</Text>
          <Button testID="workspace-create-action" label={t('workspaceAutopilot.start')} variant="ai" loading={busy} disabled={!title.trim() || !requiredBriefReady} onPress={() => void create()} />
        </Card> : null}

        <View style={{ width: manualOpen && desktop ? 420 : '100%', gap: spacing.md }}>
          <Section title={t('workspace10.resume')} description={t('workspace10.resumeDetail')}>
            {page === null && !error ? <SmartLoadingState title={t('workspace10.loading')} /> : page?.items.length ? page.items.map((workspace) => {
              const determinate = workspace.totalSteps > 0;
              const progress = determinate ? Math.round((workspace.completedSteps / workspace.totalSteps) * 100) : null;
              return <Card key={workspace.id} testID={`workspace-resume-${workspace.id}`} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}><View style={{ flex: 1 }}><Text style={[typography.title, { color: c.textPrimary }]}>{workspace.title}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{t(`workspace10.template.${workspace.template}` as TranslationKey)} · {t('workspace10.sourcesN').replace('{n}', String(workspace.sourceCount))}</Text></View><Badge label={t(`workspace10.status.${workspace.status}` as TranslationKey)} tone={workspace.status === 'active' ? 'success' : 'neutral'} /></View>
                {progress !== null ? <><Progress value={progress} /><Text style={[typography.caption, { color: c.textMuted }]}>{t('workspace10.steps').replace('{done}', String(workspace.completedSteps)).replace('{total}', String(workspace.totalSteps))}</Text></> : null}
                <Button testID={`workspace-open-${workspace.id}`} label={t('workspace10.open')} variant="secondary" onPress={() => router.push(`/library/workspace/${workspace.id}`)} />
              </Card>;
            }) : <EmptyState icon="▧" title={t('workspace10.empty')} detail={t('workspace10.emptyDetail')} />}
          </Section>
        </View>
      </View>
    </Page>
  </ScrollView>;
}

function workspaceTemplateFromParam(value?: string): WorkspaceTemplate {
  return explicitWorkspaceTemplateFromParam(value) ?? 'assignment';
}

function explicitWorkspaceTemplateFromParam(value?: string): WorkspaceTemplate | undefined {
  if (WORKSPACE_TEMPLATES.includes(value as WorkspaceTemplate)) return value as WorkspaceTemplate;
  if (value === 'rapport') return 'report';
  return undefined;
}

function libraryPageUrl(search: string, cursor?: string): string {
  const query = search.trim();
  return `/library/paged?filter=all&sort=newest&limit=50${query ? `&q=${encodeURIComponent(query)}` : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
}

function selectableWorkspaceDocument(document: LibraryDocument): boolean {
  return document.status === 'ready' || document.status === 'partial';
}

function canonicalWorkspaceSource(source: WorkspaceSourceReference): WorkspaceSourceReference {
  return { kind: source.kind, id: source.id };
}

function SourceChoice({ title, detail, checked, onPress }: { title: string; detail: string; checked: boolean; onPress: () => void }) {
  const { colors: c, radius, spacing, typography } = useTokens();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={{ minHeight: 50, borderWidth: 1, borderColor: checked ? c.primary : c.border, borderRadius: radius.sm, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Text style={{ color: c.primary }}>{checked ? '✓' : '○'}</Text><View style={{ flex: 1 }}><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{title}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{detail}</Text></View></Pressable>;
}
