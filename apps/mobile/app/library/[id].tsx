import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createContext,
  type Collection,
  type CompareResponse,
  type ContextItem,
  type DocumentPrerequisites,
  type KnowledgeIntegration,
  type LibraryDocument,
  type LibraryDocumentDetail,
  type LibraryPage,
  type StudyResource,
  type StudyResourceType,
  type UnderstandMode,
  type UnderstandResponse,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { Alert, Badge, Button, Card, SegmentedControl } from '../../components/ds/core';
import { SmartErrorState, SmartLoadingState } from '../../components/ds/states';
import { ContextBar } from '../../components/context/context-bar';
import { DocumentPipeline } from '../../components/document/document-pipeline';
import { GroundedAsk } from '../../components/document/grounded-ask';

type MobileSection = 'document' | 'understand' | 'ask';

const RESOURCE_TYPES: StudyResourceType[] = ['summary', 'quiz', 'flashcards', 'revision_sheet', 'exercises'];

function resourceLabelKey(type: StudyResourceType): TranslationKey {
  if (type === 'revision_sheet') return 'lib.r.revisionSheet';
  if (type === 'open_questions') return 'lib.r.openQuestions';
  if (type === 'course_plan') return 'lib.r.coursePlan';
  return `lib.r.${type}` as TranslationKey;
}

export default function DocumentIntelligenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useResponsive();
  const desktop = width >= 1024;
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  const [document, setDocument] = useState<LibraryDocumentDetail | null>(null);
  const [prerequisites, setPrerequisites] = useState<DocumentPrerequisites | null>(null);
  const [integration, setIntegration] = useState<KnowledgeIntegration | null>(null);
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [understanding, setUnderstanding] = useState<UnderstandResponse | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  const [others, setOthers] = useState<LibraryDocument[] | null>(null);
  const [section, setSection] = useState<MobileSection>('understand');
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api<LibraryDocumentDetail>(`/library/documents/${id}`);
      setDocument(next); setError(null);
      if (next.status === 'ready') {
        const results = await Promise.allSettled([
          api<DocumentPrerequisites>(`/library/documents/${id}/prerequisites`),
          api<KnowledgeIntegration>(`/library/documents/${id}/integration`),
          api<StudyResource[]>(`/library/documents/${id}/resources`),
          api<Collection[]>('/library/collections'),
        ]);
        if (results[0].status === 'fulfilled') setPrerequisites(results[0].value);
        if (results[1].status === 'fulfilled') setIntegration(results[1].value);
        if (results[2].status === 'fulfilled') setResources(results[2].value);
        if (results[3].status === 'fulfilled') setCollections(results[3].value);
      }
    } catch (caught) { setError((caught as Error).message); }
  }, [id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    if (!document || (document.status !== 'pending' && document.status !== 'processing')) return;
    const timer = setTimeout(() => void load(), 2500);
    return () => clearTimeout(timer);
  }, [document, load]);

  const contexts = useMemo<ContextItem[]>(() => {
    if (!user || !document) return [];
    return createContext(user.id, [{
      id: `document:${document.id}`, kind: 'document', scope: 'active-object', referenceId: document.id,
      label: document.title, priority: 100, visibility: 'visible',
    }]).items;
  }, [document, user]);

  const runUnderstand = async (mode: UnderstandMode) => {
    setBusy(`understand-${mode}`); setError(null); setSection('understand');
    try {
      setUnderstanding(await api<UnderstandResponse>(`/library/documents/${id}/understand`, { method: 'POST', body: { mode } }));
    } catch (caught) { setError((caught as Error).message); } finally { setBusy(null); }
  };

  const generate = async (type: StudyResourceType) => {
    setBusy(`resource-${type}`); setError(null);
    try {
      const created = await api<StudyResource>(`/library/documents/${id}/resources`, { method: 'POST', body: { type } });
      setResources((current) => [created, ...current]);
    } catch (caught) { setError((caught as Error).message); } finally { setBusy(null); }
  };

  const compare = async (otherId: string) => {
    setBusy(`compare-${otherId}`); setError(null);
    try { setComparison(await api<CompareResponse>(`/library/documents/${id}/compare`, { method: 'POST', body: { otherDocumentId: otherId } })); }
    catch (caught) { setError((caught as Error).message); } finally { setBusy(null); }
  };

  const action = async (key: string, work: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await work(); await load(); } catch (caught) { setError((caught as Error).message); } finally { setBusy(null); }
  };

  if (!document && error) return <SmartErrorState detail={error} retryable onRetry={() => void load()} />;
  if (!document) return <SmartLoadingState title={t('library7.document.loading')} />;

  if (document.status !== 'ready') {
    return (
      <ScrollView contentContainerStyle={{ padding: desktop ? 28 : 16, gap: spacing.lg, maxWidth: 920, width: '100%', alignSelf: 'center' }}>
        <DocumentHeader document={document} />
        {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
        <Card><DocumentPipeline status={document.status} stage={document.stage} error={document.error} onRetry={document.status === 'failed' ? () => void action('retry', () => api(`/documents/${document.id}/reindex`, { method: 'POST' })) : undefined} /></Card>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('library7.document.processingHelp')}</Text>
        <Button label={t('library7.backLibrary')} variant="ghost" onPress={() => router.push('/library')} />
      </ScrollView>
    );
  }

  const documentPane = <DocumentPane document={document} />;
  const intelligencePane = (
    <IntelligencePane
      document={document}
      contexts={contexts}
      prerequisites={prerequisites}
      integration={integration}
      resources={resources}
      understanding={understanding}
      comparison={comparison}
      others={others}
      busy={busy}
      section={section}
      onSection={setSection}
      onUnderstand={(mode) => void runUnderstand(mode)}
      onGenerate={(type) => void generate(type)}
      onCompareList={() => void api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50').then((page) => setOthers(page.items.filter((item) => item.id !== document.id))).catch((caught) => setError((caught as Error).message))}
      onCompare={(otherId) => void compare(otherId)}
      onOpenDocument={(documentId) => router.push(`/library/${documentId}`)}
      onOpenResource={(resourceId) => router.push(`/library/resource/${resourceId}`)}
      onUsage={() => router.push('/usage')}
    />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: desktop ? 28 : 16, gap: spacing.lg, maxWidth: 1380, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <DocumentHeader document={document} />
      <ContextBar items={contexts} />
      {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('library7.action.ask')} icon="?" onPress={() => setSection('ask')} />
        <Button label={t('lib.u.summarize')} variant="secondary" loading={busy === 'understand-summarize'} onPress={() => void runUnderstand('summarize')} />
        <Button label={t('lib.u.explain')} variant="secondary" loading={busy === 'understand-explain'} onPress={() => void runUnderstand('explain')} />
        <Button label={t('library7.action.learn')} variant="secondary" onPress={() => router.push({ pathname: '/tutor', params: { documentId: document.id, title: document.title, mode: 'teach', intent: 'learn-document' } })} />
        <Button label={advanced ? t('library7.action.less') : t('library7.action.more')} variant="ghost" onPress={() => setAdvanced((value) => !value)} />
      </View>

      {advanced ? <Card style={{ gap: spacing.sm }}>
        <Text style={[typography.overline, { color: c.textMuted }]}>{t('library7.action.advanced')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button label={t('library7.action.quiz')} variant="secondary" loading={busy === 'resource-quiz'} onPress={() => void generate('quiz')} />
          <Button label={t('library7.action.flashcards')} variant="secondary" loading={busy === 'resource-flashcards'} onPress={() => void generate('flashcards')} />
          <Button label={t('lib.u.compare')} variant="secondary" onPress={() => { setSection('understand'); void api<LibraryPage>('/library/paged?filter=all&sort=newest&limit=50').then((page) => setOthers(page.items.filter((item) => item.id !== document.id))); }} />
          <Button label={t('library7.action.workspace')} variant="secondary" onPress={() => router.push({ pathname: '/library/workspace', params: { documentId: document.id, title: document.title } })} />
          <Button label={t('lib.reanalyse')} variant="ghost" loading={busy === 'enrich'} onPress={() => void action('enrich', () => api(`/library/documents/${id}/enrich`, { method: 'POST' }))} />
          <Button label={document.deletedAt ? t('lib.restore') : t('lib.moveToTrash')} variant="ghost" loading={busy === 'trash'} onPress={() => void action('trash', () => api(`/library/documents/${id}/${document.deletedAt ? 'restore' : 'trash'}`, { method: 'POST' }))} />
        </View>
      </Card> : null}

      {desktop ? <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg }}>
        <View style={{ flex: 1.2, minWidth: 0 }}>{documentPane}</View>
        <View style={{ flex: 0.9, minWidth: 360 }}>{intelligencePane}</View>
      </View> : <>
        <SegmentedControl options={['document', 'understand', 'ask'] as const} value={section} onChange={setSection} labelFor={(value) => t(`library7.tab.${value}`)} />
        {section === 'document' ? documentPane : intelligencePane}
      </>}

      <NextDocumentActions document={document} integration={integration} resources={resources} onLearn={() => router.push({ pathname: '/tutor', params: { documentId: document.id, title: document.title, mode: 'teach', intent: 'learn-document' } })} onAsk={() => setSection('ask')} onFlashcards={() => void generate('flashcards')} onReview={() => router.push({ pathname: '/revision', params: { documentId: document.id } })} onBrain={() => router.push({ pathname: '/brain', params: { documentId: document.id } })} />
      <CollectionAssignment document={document} collections={collections} busy={busy === 'collection'} onAssign={(collectionId) => void action('collection', () => api(`/library/documents/${id}/collection`, { method: 'PATCH', body: { collectionId } }))} />
    </ScrollView>
  );
}

function DocumentHeader({ document }: { document: LibraryDocumentDetail }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  return <View style={{ gap: spacing.xs }}>
    <Text style={[typography.overline, { color: c.primary }]}>{t('library7.document.intelligence')}</Text>
    <Text accessibilityRole="header" style={[typography.headline, { color: c.textPrimary }]}>{document.title}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
      <Badge label={t(`lib.status.${document.status}`)} tone={document.status === 'ready' ? 'success' : document.status === 'failed' ? 'error' : 'ai'} />
      <Badge label={document.source.toUpperCase()} />
      {document.sourceRef && document.sourceRef !== document.title ? <Badge label={document.sourceRef} tone="info" /> : null}
    </View>
  </View>;
}

function DocumentPane({ document }: { document: LibraryDocumentDetail }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t, formatLocale } = useI18n();
  return <Card style={{ gap: spacing.md }} testID="document-reading-pane">
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('library7.tab.document')}</Text>
      <Text style={[typography.caption, { color: c.textMuted }]}>{document.charCount.toLocaleString(formatLocale)} {t('lib.chars')} · {new Date(document.createdAt).toLocaleDateString(formatLocale)}</Text>
    </View>
    <Text selectable style={[typography.body, { color: c.textPrimary, lineHeight: 25 }]}>{document.content.slice(0, 12000)}</Text>
    {document.content.length > 12000 ? <Alert tone="info" title={t('library7.document.previewLimited')} detail={t('library7.document.previewLimitedDetail')} /> : null}
  </Card>;
}

function IntelligencePane(props: {
  document: LibraryDocumentDetail;
  contexts: ContextItem[];
  prerequisites: DocumentPrerequisites | null;
  integration: KnowledgeIntegration | null;
  resources: StudyResource[];
  understanding: UnderstandResponse | null;
  comparison: CompareResponse | null;
  others: LibraryDocument[] | null;
  busy: string | null;
  section: MobileSection;
  onSection: (section: MobileSection) => void;
  onUnderstand: (mode: UnderstandMode) => void;
  onGenerate: (type: StudyResourceType) => void;
  onCompareList: () => void;
  onCompare: (id: string) => void;
  onOpenDocument: (id: string) => void;
  onOpenResource: (id: string) => void;
  onUsage: () => void;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  if (props.section === 'ask') return <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('library7.ask.documentTitle')}</Text><GroundedAsk scope={{ documentId: props.document.id }} contexts={props.contexts} onOpenDocument={props.onOpenDocument} onOpenUsage={props.onUsage} /></Card>;
  return <View style={{ gap: spacing.md }} testID="document-intelligence-pane">
    <Card style={{ gap: spacing.sm }}>
      <Text style={[typography.overline, { color: c.aiAccent }]}>{t('library7.understood')}</Text>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('lib.summary')}</Text>
      {props.document.summary ? <Text style={[typography.body, { color: c.textPrimary }]}>{props.document.summary}</Text> : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('library7.summaryUnavailable')}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {(['summarize', 'explain', 'simplify'] as UnderstandMode[]).map((mode) => <Button key={mode} label={t(`lib.u.${mode}`)} variant="ghost" size="sm" loading={props.busy === `understand-${mode}`} onPress={() => props.onUnderstand(mode)} />)}
      </View>
      {props.understanding ? <View style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.sm, gap: spacing.xs }}><Badge label={t(`lib.level.${props.understanding.level}`)} tone="ai" /><Text selectable style={[typography.body, { color: c.textPrimary }]}>{props.understanding.text}</Text></View> : null}
    </Card>

    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('library7.concepts').replace('{n}', String(props.document.concepts.length))}</Text>
      {props.document.concepts.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{props.document.concepts.map((concept) => <Badge key={concept.id} label={concept.name} tone="info" />)}</View> : <Text style={[typography.bodySmall, { color: c.textMuted }]}>{t('library7.noConcepts')}</Text>}
      {props.prerequisites?.prerequisites.length ? <View style={{ gap: spacing.xs }}><Text style={[typography.overline, { color: c.textMuted }]}>{t('lib.u.prereqTitle')}</Text>{props.prerequisites.prerequisites.slice(0, 6).map((item) => <Text key={`${item.id}-${item.forConcept}`} style={[typography.bodySmall, { color: c.textSecondary }]}>{item.name} → {item.forConcept}{item.mastery === null ? '' : ` · ${Math.round(item.mastery * 100)}%`}</Text>)}</View> : null}
    </Card>

    {props.integration ? <BrainImpact integration={props.integration} documentId={props.document.id} /> : null}

    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('library7.resources')}</Text>
      <Text style={[typography.caption, { color: c.textMuted }]}>{t('library7.resources.trace').replace('{title}', props.document.title)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>{RESOURCE_TYPES.map((type) => <Button key={type} label={t(resourceLabelKey(type))} variant="secondary" size="sm" loading={props.busy === `resource-${type}`} onPress={() => props.onGenerate(type)} />)}</View>
      {props.resources.map((resource) => <Pressable key={resource.id} accessibilityRole="link" onPress={() => props.onOpenResource(resource.id)} style={{ minHeight: 44, justifyContent: 'center', borderTopWidth: 1, borderTopColor: c.borderSubtle }}><Text style={[typography.bodySmall, { color: c.primary, fontWeight: '700' }]}>{resource.title}</Text></Pressable>)}
    </Card>

    <Card style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('lib.u.compareTitle')}</Text>
      <Button label={t('library7.compare.with')} variant="secondary" size="sm" onPress={props.onCompareList} />
      {props.others?.map((other) => <Button key={other.id} label={other.title} variant="ghost" size="sm" loading={props.busy === `compare-${other.id}`} onPress={() => props.onCompare(other.id)} />)}
      {props.comparison ? <View style={{ gap: spacing.xs }}><Text style={[typography.overline, { color: c.aiAccent }]}>{props.comparison.documentTitle} ⇄ {props.comparison.otherTitle}</Text><Text selectable style={[typography.bodySmall, { color: c.textPrimary }]}>{props.comparison.text}</Text></View> : null}
    </Card>
  </View>;
}

function BrainImpact({ integration, documentId }: { integration: KnowledgeIntegration; documentId: string }) {
  const router = useRouter();
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  return <Card style={{ gap: spacing.sm }}>
    <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('lib.integ.title')}</Text>
    <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('library7.brainImpact').replace('{known}', String(integration.knownConcepts.length)).replace('{new}', String(integration.newConcepts.length)).replace('{links}', String(integration.linksToExisting.length))}</Text>
    <Button label={t('library7.brain.open')} variant="ghost" size="sm" onPress={() => router.push({ pathname: '/brain', params: { documentId } })} />
  </Card>;
}

function NextDocumentActions({ document, integration, resources, onLearn, onAsk, onFlashcards, onReview, onBrain }: { document: LibraryDocumentDetail; integration: KnowledgeIntegration | null; resources: StudyResource[]; onLearn: () => void; onAsk: () => void; onFlashcards: () => void; onReview: () => void; onBrain: () => void }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  const actions = [
    ...(integration?.newConcepts.length ? [{ key: 'learn', label: t('library7.nba.learn').replace('{n}', String(integration.newConcepts.length)), onPress: onLearn }] : [{ key: 'ask', label: t('library7.nba.ask'), onPress: onAsk }]),
    ...(resources.some((resource) => resource.type === 'flashcards') ? [{ key: 'review', label: t('review9.documentReview'), onPress: onReview }] : []),
    ...(!resources.some((resource) => resource.type === 'flashcards') ? [{ key: 'flashcards', label: t('library7.nba.flashcards'), onPress: onFlashcards }] : []),
    ...(integration?.linksToExisting.length ? [{ key: 'brain', label: t('library7.nba.brain'), onPress: onBrain }] : []),
  ].slice(0, 3);
  return <Card style={{ gap: spacing.sm }} testID="document-next-best-action"><Text style={[typography.overline, { color: c.primary }]}>{t('library7.nba.title')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{actions.map((item, index) => <Button key={item.key} label={item.label} variant={index === 0 ? 'primary' : 'secondary'} onPress={item.onPress} />)}</View></Card>;
}

function CollectionAssignment({ document, collections, busy, onAssign }: { document: LibraryDocumentDetail; collections: Collection[]; busy: boolean; onAssign: (id: string | null) => void }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  return <Card style={{ gap: spacing.sm }}><Text style={[typography.overline, { color: c.textMuted }]}>{t('lib.m.collection')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}><Button label={t('library7.collection.none')} variant={!document.collectionId ? 'primary' : 'ghost'} size="sm" loading={busy} onPress={() => onAssign(null)} />{collections.map((collection) => <Button key={collection.id} label={collection.name} variant={document.collectionId === collection.id ? 'primary' : 'ghost'} size="sm" loading={busy && document.collectionId === collection.id} onPress={() => onAssign(collection.id)} />)}</View></Card>;
}
