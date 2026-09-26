import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  isQuotaError,
  type DocumentDifficulty,
  type LibraryDocument,
  type LibraryFacets,
  type LibraryFilter,
  type LibraryPage,
  type LibrarySort,
  type QuotaErrorContract,
} from '@second-brain/shared';
import { ApiError, api } from '../lib/client';
import { pickDocuments, uploadPickedDocument } from '../lib/document-import';
import { loadLibraryCache, saveLibraryCache } from '../lib/library-cache';
import { useAuth } from '../lib/auth-context';
import { useTokens } from '../lib/design/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useResponsive } from '../lib/responsive';
import { Alert, Badge, Button, Card, SegmentedControl } from '../components/ds/core';
import { SmartEmptyState, SmartLoadingState } from '../components/ds/states';
import { DocumentPipeline } from '../components/document/document-pipeline';
import { BatchImport } from '../components/document/batch-import';

const SHELVES: Array<{ filter: LibraryFilter; key: TranslationKey; icon: string }> = [
  { filter: 'all', key: 'lib.all', icon: '▤' },
  { filter: 'favorites', key: 'lib.favorites', icon: '★' },
  { filter: 'recent', key: 'lib.recent', icon: '◷' },
  { filter: 'trash', key: 'lib.trash', icon: '⌫' },
];

const DIFFICULTY_KEY: Record<DocumentDifficulty, TranslationKey> = {
  beginner: 'lib.diff.beginner', intermediate: 'lib.diff.intermediate', advanced: 'lib.diff.advanced',
};

type Facet =
  | { kind: 'subject'; value: string }
  | { kind: 'language'; value: string }
  | { kind: 'collection'; id: string; name: string }
  | null;

type ErrorState = { message: string; quota: QuotaErrorContract | null } | null;

export default function LibraryScreen() {
  const { user, offline } = useAuth();
  const router = useRouter();
  const { width } = useResponsive();
  const desktop = width >= 1024;
  const { colors: c, spacing, typography } = useTokens();
  const { t, formatLocale } = useI18n();
  const [facets, setFacets] = useState<LibraryFacets | null>(null);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [shelf, setShelf] = useState<LibraryFilter>('all');
  const [facet, setFacet] = useState<Facet>(null);
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const [panel, setPanel] = useState<'import' | 'batch' | 'collection' | null>(null);
  const request = useRef<AbortController | null>(null);
  const documentsRef = useRef<LibraryDocument[]>([]);

  useEffect(() => { documentsRef.current = documents; }, [documents]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ filter: shelf, sort, limit: '24' });
    if (search.trim()) params.set('q', search.trim());
    if (facet?.kind === 'subject') params.set('subject', facet.value);
    if (facet?.kind === 'language') params.set('language', facet.value);
    if (facet?.kind === 'collection') params.set('collectionId', facet.id);
    return params.toString();
  }, [facet, search, shelf, sort]);

  const load = useCallback(async (append = false) => {
    if (!user) { setLoading(false); return; }
    if (append && !cursor) return;
    if (!append) request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    append ? setLoadingMore(true) : setLoading(true);
    const pageQuery = append && cursor ? `${query}&cursor=${encodeURIComponent(cursor)}` : query;
    try {
      if (offline) throw new ApiError(0, t('library7.offline'));
      const [nextFacets, page] = await Promise.all([
        api<LibraryFacets>('/library/facets', { signal: controller.signal }),
        api<LibraryPage>(`/library/paged?${pageQuery}`, { signal: controller.signal }),
      ]);
      const currentDocuments = documentsRef.current;
      const nextDocuments = append
        ? [...currentDocuments, ...page.items.filter((item) => !currentDocuments.some((existing) => existing.id === item.id))]
        : page.items;
      setFacets(nextFacets);
      setDocuments(nextDocuments);
      setCursor(page.nextCursor);
      setStale(false);
      setError(null);
      await saveLibraryCache(user.id, { query, documents: nextDocuments, facets: nextFacets, nextCursor: page.nextCursor });
    } catch (caught) {
      if ((caught as { name?: string }).name === 'AbortError') return;
      if (!append) {
        const cached = await loadLibraryCache(user.id, query);
        if (cached) {
          setDocuments(cached.documents);
          setFacets(cached.facets);
          setCursor(cached.nextCursor);
          setStale(true);
        }
      }
      setError(errorState(caught));
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, [cursor, offline, query, t, user]);

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => void load(false), search ? 300 : 0);
    return () => { clearTimeout(timer); request.current?.abort(); };
  }, [query, offline]));

  const processing = documents.some((document) => document.status === 'pending' || document.status === 'processing');
  useEffect(() => {
    if (!processing || offline) return;
    const timer = setTimeout(() => void load(false), 3000);
    return () => clearTimeout(timer);
  }, [processing, offline, documents, load]);

  const chooseShelf = (next: LibraryFilter) => { setShelf(next); setFacet(null); setCursor(null); };
  const chooseFacet = (next: Facet) => { setFacet(next); setShelf('all'); setCursor(null); };
  const mutate = async (document: LibraryDocument, action: 'favorite' | 'trash' | 'restore') => {
    try {
      await api(`/library/documents/${document.id}/${action === 'favorite' ? 'favorite' : action}`, { method: action === 'favorite' ? 'PATCH' : 'POST' });
      await load(false);
    } catch (caught) { setError(errorState(caught)); }
  };

  const filters = facets ? (
    <View style={{ gap: spacing.md }}>
      <View style={{ gap: spacing.xs }}>
        {SHELVES.map((item) => <FilterButton key={item.filter} label={`${item.icon} ${t(item.key)}`} count={facets[item.filter]} selected={shelf === item.filter && !facet} onPress={() => chooseShelf(item.filter)} />)}
      </View>
      <FacetGroup title={t('lib.collections')}>
        {facets.collections.map((collection) => <FilterButton key={collection.id} label={collection.name} count={collection.documentCount} selected={facet?.kind === 'collection' && facet.id === collection.id} onPress={() => chooseFacet({ kind: 'collection', id: collection.id, name: collection.name })} />)}
        <Button label={t('library7.collection.create')} variant="ghost" size="sm" onPress={() => setPanel(panel === 'collection' ? null : 'collection')} />
      </FacetGroup>
      {facets.subjects.length ? <FacetGroup title={t('lib.subjects')}>{facets.subjects.slice(0, 8).map((item) => <FilterButton key={item.value} label={item.value} count={item.count} selected={facet?.kind === 'subject' && facet.value === item.value} onPress={() => chooseFacet({ kind: 'subject', value: item.value })} />)}</FacetGroup> : null}
      {facets.languages.length ? <FacetGroup title={t('lib.languages')}>{facets.languages.slice(0, 8).map((item) => <FilterButton key={item.value} label={item.value} count={item.count} selected={facet?.kind === 'language' && facet.value === item.value} onPress={() => chooseFacet({ kind: 'language', value: item.value })} />)}</FacetGroup> : null}
    </View>
  ) : null;

  return (
    <ScrollView contentContainerStyle={{ padding: desktop ? 28 : 16, gap: spacing.lg, maxWidth: 1320, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.overline, { color: c.primary }]}>{t('library7.owned')}</Text>
        <Text accessibilityRole="header" style={[typography.display, { color: c.textPrimary }]}>{t('lib.title')}</Text>
        <Text style={[typography.body, { color: c.textSecondary, maxWidth: 700 }]}>{t('library7.mission')}</Text>
      </View>

      {stale || offline ? <Alert tone="warning" title={t('library7.stale.title')} detail={t('library7.stale.detail')} /> : null}
      {error ? <LibraryError value={error} onRetry={() => void load(false)} onUsage={() => router.push('/usage')} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('library7.import')} icon="＋" onPress={() => setPanel(panel === 'import' ? null : 'import')} />
        <Button label={t('library7.scan')} variant="secondary" icon="▣" onPress={() => router.push('/scan')} />
        <Button label={t('library7.batch')} variant="secondary" icon="▤" onPress={() => setPanel(panel === 'batch' ? null : 'batch')} />
        <Button label={t('library7.ask')} variant="ghost" icon="?" onPress={() => router.push('/library/ask')} />
      </View>

      {panel === 'import' ? <ImportPanel onDone={(id) => { setPanel(null); void load(false); router.push(`/library/${id}`); }} /> : null}
      {panel === 'batch' ? <BatchImport onChanged={() => void load(false)} onOpen={(id) => router.push(`/library/${id}`)} onUsage={() => router.push('/usage')} /> : null}
      {panel === 'collection' ? <CollectionPanel onDone={() => { setPanel(null); void load(false); }} /> : null}

      <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: spacing.lg }}>
        {desktop ? <View style={{ width: 240 }}>{filters}</View> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxWidth: '100%' }} contentContainerStyle={{ gap: spacing.xs }}>
            {SHELVES.map((item) => <FilterButton key={item.filter} label={`${item.icon} ${t(item.key)}`} count={facets?.[item.filter]} selected={shelf === item.filter && !facet} onPress={() => chooseShelf(item.filter)} />)}
            {facets?.collections.map((collection) => <FilterButton key={collection.id} label={collection.name} count={collection.documentCount} selected={facet?.kind === 'collection' && facet.id === collection.id} onPress={() => chooseFacet({ kind: 'collection', id: collection.id, name: collection.name })} />)}
          </ScrollView>
        )}

        <View style={{ flex: 1, width: '100%', gap: spacing.md }}>
          <View style={{ flexDirection: desktop ? 'row' : 'column', gap: spacing.sm, justifyContent: 'space-between' }}>
            <TextInput accessibilityLabel={t('library7.search')} placeholder={t('library7.search')} placeholderTextColor={c.textMuted} value={search} onChangeText={setSearch} style={{ minHeight: 46, flex: 1, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, color: c.textPrimary, paddingHorizontal: 14, borderRadius: 10 }} />
            <SegmentedControl options={['newest', 'oldest', 'title'] as const} value={sort} onChange={(value) => { setSort(value); setCursor(null); }} labelFor={(value) => t(`library7.sort.${value}`)} />
          </View>

          {loading && !documents.length ? <SmartLoadingState title={t('lib.loading')} /> : documents.length === 0 ? (
            <LibraryEmpty onImport={() => setPanel('import')} onScan={() => router.push('/scan')} />
          ) : (
            <View accessibilityRole="list" style={{ gap: spacing.sm }}>
              {documents.map((document) => <DocumentRow key={document.id} document={document} formatLocale={formatLocale} onOpen={() => router.push(`/library/${document.id}`)} onFavorite={() => void mutate(document, 'favorite')} onTrash={() => void mutate(document, document.deletedAt ? 'restore' : 'trash')} />)}
            </View>
          )}
          {cursor ? <Button label={t('library7.more')} variant="secondary" loading={loadingMore} onPress={() => void load(true)} /> : null}
        </View>
      </View>
    </ScrollView>
  );
}

function LibraryEmpty({ onImport, onScan }: { onImport: () => void; onScan: () => void }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  return (
    <Card style={{ gap: spacing.md }}>
      <SmartEmptyState icon="▤" title={t('library7.empty.title')} detail={t('library7.empty.detail')} />
      <View accessibilityLabel={t('library7.empty.pipeline')} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs }}>
        {(['import', 'read', 'understand', 'connect', 'ready'] as const).map((step, index) => <Text key={step} style={[typography.caption, { color: c.textMuted }]}>{index ? '→ ' : ''}{t(`library7.empty.${step}`)}</Text>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm }}>
        <Button label={t('library7.import')} onPress={onImport} />
        <Button label={t('library7.scan')} variant="secondary" onPress={onScan} />
      </View>
    </Card>
  );
}

function DocumentRow({ document, formatLocale, onOpen, onFavorite, onTrash }: { document: LibraryDocument; formatLocale: string; onOpen: () => void; onFavorite: () => void; onTrash: () => void }) {
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  return (
    <Card testID={`library-document-${document.id}`} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <Pressable onPress={onOpen} accessibilityRole="link" style={{ flex: 1, minHeight: 44 }}>
          <Text numberOfLines={2} style={[typography.title, { color: c.textPrimary }]}>{document.source === 'url' ? '↗' : document.source === 'text' ? '≡' : '▤'} {document.title}</Text>
          <Text style={[typography.caption, { color: c.textMuted }]}>{new Date(document.createdAt).toLocaleDateString(formatLocale)} · {document.charCount.toLocaleString(formatLocale)} {t('lib.chars')}</Text>
        </Pressable>
        <Button label={document.isFavorite ? '★' : '☆'} accessibilityLabel={t('library7.favorite')} variant="ghost" size="sm" onPress={onFavorite} />
        <Button label={document.deletedAt ? '↺' : '⌫'} accessibilityLabel={document.deletedAt ? t('lib.restore') : t('lib.moveToTrash')} variant="ghost" size="sm" onPress={onTrash} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Badge label={t(`lib.status.${document.status}`)} tone={document.status === 'ready' ? 'success' : document.status === 'failed' ? 'error' : 'ai'} />
        {document.subject ? <Badge label={document.subject} /> : null}
        {document.difficulty ? <Badge label={t(DIFFICULTY_KEY[document.difficulty])} tone="info" /> : null}
        {document.collectionName ? <Badge label={document.collectionName} tone="primary" /> : null}
      </View>
      {document.status === 'pending' || document.status === 'processing' || document.status === 'failed' ? <DocumentPipeline status={document.status} stage={document.stage} compact /> : <Text numberOfLines={3} style={[typography.bodySmall, { color: c.textSecondary }]}>{document.summary ?? document.preview}</Text>}
      {document.concepts.length ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('library7.conceptsCount').replace('{n}', String(document.concepts.length))} · {document.concepts.slice(0, 4).map((concept) => concept.name).join(' · ')}</Text> : null}
    </Card>
  );
}

function ImportPanel({ onDone }: { onDone: (documentId: string) => void }) {
  const router = useRouter();
  const { colors: c, spacing, typography } = useTokens();
  const { t } = useI18n();
  const [mode, setMode] = useState<'file' | 'text' | 'url'>('file');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      if (mode === 'file') {
        const picked = (await pickDocuments(false))[0];
        if (!picked) return;
        onDone((await uploadPickedDocument(picked)).id);
      } else if (mode === 'text') {
        if (!title.trim() || !content.trim()) throw new Error(t('lib.addTextRequired'));
        onDone((await api<{ id: string }>('/documents', { method: 'POST', body: { title: title.trim(), content } })).id);
      } else {
        if (!content.trim()) throw new Error(t('lib.addUrlRequired'));
        onDone((await api<{ id: string }>('/documents/from-url', { method: 'POST', body: { url: content.trim(), ...(title.trim() ? { title: title.trim() } : {}) } })).id);
      }
    } catch (caught) { setError(errorState(caught)); } finally { setBusy(false); }
  };
  return (
    <Card style={{ gap: spacing.md }}>
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('library7.import.title')}</Text>
      <SegmentedControl options={['file', 'text', 'url'] as const} value={mode} onChange={setMode} labelFor={(value) => t(`library7.import.${value}`)} />
      {mode !== 'file' ? <>
        <TextInput placeholder={t('lib.addTitle')} placeholderTextColor={c.textMuted} value={title} onChangeText={setTitle} style={{ minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, color: c.textPrimary }} />
        <TextInput multiline={mode === 'text'} placeholder={mode === 'text' ? t('lib.addBody') : 'https://…'} placeholderTextColor={c.textMuted} value={content} onChangeText={setContent} autoCapitalize="none" style={{ minHeight: mode === 'text' ? 120 : 46, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, color: c.textPrimary, textAlignVertical: 'top' }} />
      </> : <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('library7.import.formats')}</Text>}
      {error ? <LibraryError value={error} onUsage={() => router.push('/usage')} /> : null}
      <Button label={mode === 'file' ? t('library7.import.choose') : t('lib.addBtn')} loading={busy} onPress={() => void submit()} />
    </Card>
  );
}

function CollectionPanel({ onDone }: { onDone: () => void }) {
  const { colors: c, spacing } = useTokens();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <Card style={{ gap: spacing.sm }}>
    <TextInput accessibilityLabel={t('library7.collection.name')} placeholder={t('library7.collection.name')} placeholderTextColor={c.textMuted} value={name} onChangeText={setName} style={{ minHeight: 46, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, color: c.textPrimary }} />
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
    <Button label={t('library7.collection.create')} disabled={!name.trim()} loading={busy} onPress={() => { setBusy(true); setError(null); void api('/library/collections', { method: 'POST', body: { name: name.trim() } }).then(onDone).catch((caught) => setError((caught as Error).message)).finally(() => setBusy(false)); }} />
  </Card>;
}

function FilterButton({ label, count, selected, onPress }: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const { colors: c, radius, spacing, typography } = useTokens();
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: selected ? c.surfaceSunken : 'transparent' }}>
    <Text numberOfLines={1} style={[typography.bodySmall, { color: selected ? c.primary : c.textSecondary, fontWeight: selected ? '700' : '500' }]}>{label}</Text>
    {count !== undefined ? <Text style={[typography.caption, { color: c.textMuted }]}>{count}</Text> : null}
  </Pressable>;
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: c, spacing, typography } = useTokens();
  return <View style={{ gap: spacing.xxs }}><Text style={[typography.overline, { color: c.textMuted }]}>{title}</Text>{children}</View>;
}

function LibraryError({ value, onRetry, onUsage }: { value: NonNullable<ErrorState>; onRetry?: () => void; onUsage?: () => void }) {
  const { spacing } = useTokens();
  const { t, formatLocale } = useI18n();
  const reset = value.quota?.resetAt ? new Date(value.quota.resetAt).toLocaleString(formatLocale) : null;
  return <View style={{ gap: spacing.sm }}>
    <Alert tone={value.quota ? 'warning' : 'error'} title={value.quota ? t('library7.quota.title') : t('state.error')} detail={value.quota ? `${value.message}${reset ? ` ${t('library7.quota.reset').replace('{date}', reset)}` : ''}` : value.message} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {onRetry ? <Button label={t('app.tryAgain')} variant="secondary" size="sm" onPress={onRetry} /> : null}
      {value.quota && onUsage ? <Button label={t('library7.quota.usage')} variant="ghost" size="sm" onPress={onUsage} /> : null}
    </View>
  </View>;
}

function errorState(error: unknown): NonNullable<ErrorState> {
  if (error instanceof ApiError) {
    const direct = isQuotaError(error.payload) ? error.payload : null;
    const nested = !direct && error.payload && typeof error.payload === 'object' && 'message' in error.payload && isQuotaError((error.payload as { message: unknown }).message)
      ? (error.payload as { message: QuotaErrorContract }).message
      : null;
    return { message: error.message, quota: direct ?? nested };
  }
  return { message: (error as Error).message, quota: null };
}
