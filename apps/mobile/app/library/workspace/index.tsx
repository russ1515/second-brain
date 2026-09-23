import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  WORKSPACE_TEMPLATES,
  type Collection,
  type LibraryDocument,
  type LibraryPage,
  type PersistentWorkspace,
  type WorkspacePage,
  type WorkspaceSourceReference,
  type WorkspaceTemplate,
} from '@second-brain/shared';
import { api } from '../../../lib/client';
import { useI18n, type TranslationKey } from '../../../lib/i18n';
import { useTokens } from '../../../lib/design/theme';
import { useResponsive } from '../../../lib/responsive';
import { Alert, Badge, Button, Card, EmptyState, Input, Progress, SegmentedControl } from '../../../components/ds/core';
import { Page, Section } from '../../../components/ds/layout';
import { SmartLoadingState } from '../../../components/ds/states';

type SourceMode = 'documents' | 'collections';

export default function WorkspaceHomeScreen() {
  const params = useLocalSearchParams<{ documentId?: string; title?: string; objective?: string; type?: string }>();
  const router = useRouter();
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
  const [dueAt, setDueAt] = useState('');
  const [sourceMode, setSourceMode] = useState<SourceMode>('documents');
  const [sources, setSources] = useState<WorkspaceSourceReference[]>(params.documentId ? [{ kind: 'document', id: params.documentId, title: params.title }] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<WorkspacePage>('/workspaces?limit=20'),
      api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50'),
      api<Collection[]>('/library/collections'),
    ]).then(([workspaces, library, nextCollections]) => {
      setPage(workspaces);
      setDocuments(library.items.filter((item) => item.status === 'ready'));
      setCollections(nextCollections);
    }).catch((caught) => setError((caught as Error).message));
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const workspace = await api<PersistentWorkspace>('/workspaces', {
        method: 'POST',
        body: {
          title: title.trim(), template, objective: objective.trim(), sources,
          ...(dueAt.trim() ? { dueAt: new Date(`${dueAt.trim()}T12:00:00`).toISOString() } : {}),
        },
      });
      router.push(`/library/workspace/${workspace.id}`);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleSource = (source: WorkspaceSourceReference) => setSources((current) => {
    const exists = current.some((item) => item.kind === source.kind && item.id === source.id);
    return exists ? current.filter((item) => item.kind !== source.kind || item.id !== source.id) : current.length < 50 ? [...current, source] : current;
  });

  const selected = (kind: WorkspaceSourceReference['kind'], id: string) => sources.some((source) => source.kind === kind && source.id === id);

  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: c.background }}>
    <Page width="wide" style={{ gap: spacing.xl, paddingBottom: spacing.huge }} testID="workspace-home">
      <View style={{ gap: spacing.xs, maxWidth: 820 }}>
        <Text style={[typography.overline, { color: c.aiAccent }]}>{t('workspace10.eyebrow')}</Text>
        <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('workspace10.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary }]}>{t('workspace10.subtitle')}</Text>
      </View>
      {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}

      <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.xl }}>
        <Card style={{ flex: 1, width: '100%', gap: spacing.md }} testID="workspace-create">
          <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{t('workspace10.create')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {WORKSPACE_TEMPLATES.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: template === value }} onPress={() => setTemplate(value)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, borderColor: template === value ? c.primary : c.border, backgroundColor: template === value ? c.primary : c.surfaceSunken }}><Text style={[typography.bodySmall, { color: template === value ? c.onPrimary : c.textPrimary, fontWeight: '700' }]}>{t(`workspace10.template.${value}` as TranslationKey)}</Text></Pressable>)}
          </View>
          <Input label={t('workspace10.field.title')} value={title} onChangeText={setTitle} placeholder={t('workspace10.field.titlePlaceholder')} />
          <Input label={t('workspace10.field.objective')} value={objective} onChangeText={setObjective} placeholder={t('workspace10.field.objectivePlaceholder')} multiline />
          <Input label={t('workspace10.field.due')} value={dueAt} onChangeText={setDueAt} placeholder="YYYY-MM-DD" inputMode="numeric" />
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm }}><Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.sources')}</Text><Badge label={t('workspace10.sourceCount').replace('{n}', String(sources.length))} tone={sources.length ? 'primary' : 'neutral'} /></View>
            <SegmentedControl options={['documents', 'collections'] as const} value={sourceMode} onChange={setSourceMode} labelFor={(value) => t(`workspace10.sourceMode.${value}`)} />
            <View style={{ maxHeight: 250, gap: spacing.xs }}>
              {sourceMode === 'documents' ? documents.map((document) => <SourceChoice key={document.id} title={document.title} detail={document.subject ?? document.source.toUpperCase()} checked={selected('document', document.id)} onPress={() => toggleSource({ kind: 'document', id: document.id, title: document.title })} />) : collections.map((collection) => <SourceChoice key={collection.id} title={collection.name} detail={t('library7.documentsCount').replace('{n}', String(collection.documentCount))} checked={selected('collection', collection.id)} onPress={() => toggleSource({ kind: 'collection', id: collection.id, title: collection.name })} />)}
            </View>
          </View>
          <Card style={{ gap: spacing.xs, backgroundColor: c.surfaceSunken }}><Text style={[typography.label, { color: c.textPrimary }]}>{t('workspace10.structure')}</Text>{['Introduction', 'Development', 'Conclusion'].map((item, index) => <Text key={item} style={[typography.bodySmall, { color: c.textSecondary }]}>{index + 1}. {t(`workspace10.defaultPlan.${index}` as TranslationKey)}</Text>)}</Card>
          <Alert tone="info" title={t('workspace10.integrity')} detail={t('workspace10.integrityDetail')} />
          <Button label={t('workspace10.createAction')} variant="ai" loading={busy} disabled={!title.trim()} onPress={() => void create()} />
        </Card>

        <View style={{ width: desktop ? 420 : '100%', gap: spacing.md }}>
          <Section title={t('workspace10.resume')} description={t('workspace10.resumeDetail')}>
            {page === null && !error ? <SmartLoadingState title={t('workspace10.loading')} /> : page?.items.length ? page.items.map((workspace) => {
              const determinate = workspace.totalSteps > 0;
              const progress = determinate ? Math.round((workspace.completedSteps / workspace.totalSteps) * 100) : null;
              return <Card key={workspace.id} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}><View style={{ flex: 1 }}><Text style={[typography.title, { color: c.textPrimary }]}>{workspace.title}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{t(`workspace10.template.${workspace.template}` as TranslationKey)} · {t('workspace10.sourcesN').replace('{n}', String(workspace.sourceCount))}</Text></View><Badge label={t(`workspace10.status.${workspace.status}` as TranslationKey)} tone={workspace.status === 'active' ? 'success' : 'neutral'} /></View>
                {progress !== null ? <><Progress value={progress} /><Text style={[typography.caption, { color: c.textMuted }]}>{t('workspace10.steps').replace('{done}', String(workspace.completedSteps)).replace('{total}', String(workspace.totalSteps))}</Text></> : null}
                <Button label={t('workspace10.open')} variant="secondary" onPress={() => router.push(`/library/workspace/${workspace.id}`)} />
              </Card>;
            }) : <EmptyState icon="▧" title={t('workspace10.empty')} detail={t('workspace10.emptyDetail')} />}
          </Section>
        </View>
      </View>
    </Page>
  </ScrollView>;
}

function workspaceTemplateFromParam(value?: string): WorkspaceTemplate {
  if (WORKSPACE_TEMPLATES.includes(value as WorkspaceTemplate)) return value as WorkspaceTemplate;
  if (value === 'memoire' || value === 'dissertation') return value;
  if (value === 'rapport') return 'report';
  return 'assignment';
}

function SourceChoice({ title, detail, checked, onPress }: { title: string; detail: string; checked: boolean; onPress: () => void }) {
  const { colors: c, radius, spacing, typography } = useTokens();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={{ minHeight: 50, borderWidth: 1, borderColor: checked ? c.primary : c.border, borderRadius: radius.sm, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Text style={{ color: c.primary }}>{checked ? '✓' : '○'}</Text><View style={{ flex: 1 }}><Text numberOfLines={1} style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>{title}</Text><Text style={[typography.caption, { color: c.textMuted }]}>{detail}</Text></View></Pressable>;
}
