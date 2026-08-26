import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  DocumentDifficulty,
  LibraryDocument,
  LibraryFacets,
  LibraryFilter,
  PipelineStage,
} from '@second-brain/shared';
import { api, apiUpload } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useResponsive } from '../lib/responsive';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const SHELVES: { filter: LibraryFilter; key: TranslationKey; icon: string }[] = [
  { filter: 'all', key: 'lib.all', icon: '📚' },
  { filter: 'favorites', key: 'lib.favorites', icon: '⭐' },
  { filter: 'recent', key: 'lib.recent', icon: '🕑' },
  { filter: 'shared', key: 'lib.shared', icon: '🤝' },
  { filter: 'trash', key: 'lib.trash', icon: '🗑️' },
];

const DIFFICULTY_KEY: Record<DocumentDifficulty, TranslationKey> = {
  beginner: 'lib.diff.beginner',
  intermediate: 'lib.diff.intermediate',
  advanced: 'lib.diff.advanced',
};
const difficultyColor = (c: ColorScale): Record<DocumentDifficulty, string> => ({
  beginner: c.success,
  intermediate: c.warning,
  advanced: c.error,
});
const SOURCE_ICON: Record<string, string> = {
  text: '📝',
  file: '📄',
  url: '🔗',
};

/** The Smart Upload Pipeline stages, in order, for the live progress row. */
const PIPELINE: { stage: PipelineStage; key: TranslationKey; icon: string }[] = [
  { stage: 'cleaning', key: 'lib.stage.cleaning', icon: '🧹' },
  { stage: 'segmenting', key: 'lib.stage.segmenting', icon: '✂️' },
  { stage: 'embedding', key: 'lib.stage.embedding', icon: '🧠' },
  { stage: 'indexing', key: 'lib.stage.indexing', icon: '🗂️' },
  { stage: 'graphing', key: 'lib.stage.graphing', icon: '🕸️' },
];

/** Selected cross-cutting facet (a subject / language / collection). */
type Facet =
  | { kind: 'subject'; value: string }
  | { kind: 'language'; value: string }
  | { kind: 'collection'; id: string; name: string }
  | null;

/**
 * 📚 Smart Library (Sprint 6.1) — an Evernote-style home for every document,
 * organized by shelves (All/Favorites/Recent/Shared/Trash) and cross-cutting
 * facets (Subjects/Languages/Collections). Each card shows the AI-derived
 * metadata: preview, summary, detected concepts, difficulty, subject, language,
 * author and date. Nothing is faked — a document still being analysed says so.
 */
export default function LibraryScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const { width } = useResponsive();
  const wide = width >= 1024;
  const [facets, setFacets] = useState<LibraryFacets | null>(null);
  const [docs, setDocs] = useState<LibraryDocument[] | null>(null);
  const [shelf, setShelf] = useState<LibraryFilter>('all');
  const [facet, setFacet] = useState<Facet>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const query = useCallback((): string => {
    const params = new URLSearchParams({ filter: shelf });
    if (facet?.kind === 'subject') params.set('subject', facet.value);
    if (facet?.kind === 'language') params.set('language', facet.value);
    if (facet?.kind === 'collection') params.set('collectionId', facet.id);
    return params.toString();
  }, [shelf, facet]);

  const load = useCallback(async () => {
    try {
      const [f, d] = await Promise.all([
        api<LibraryFacets>('/library/facets'),
        api<LibraryDocument[]>(`/library?${query()}`),
      ]);
      setFacets(f);
      setDocs(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [query]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live progress: while any document is still moving through the pipeline,
  // re-poll so the learner watches the automatic stages advance on their own.
  const processing = docs?.some((d) => d.status === 'pending' || d.status === 'processing') ?? false;
  useEffect(() => {
    if (!processing) return;
    const timer = setTimeout(() => void load(), 2500);
    return () => clearTimeout(timer);
  }, [processing, docs, load]);

  const pickShelf = (f: LibraryFilter) => {
    setShelf(f);
    setFacet(null);
    setDocs(null);
    // load() re-runs via focus effect? No — trigger explicitly.
    void reload(f, null);
  };
  const pickFacet = (next: Facet) => {
    setFacet(next);
    setShelf('all');
    setDocs(null);
    void reload('all', next);
  };

  // Explicit reload so a tap reflects immediately (state updates are async).
  const reload = async (f: LibraryFilter, fc: Facet) => {
    const params = new URLSearchParams({ filter: f });
    if (fc?.kind === 'subject') params.set('subject', fc.value);
    if (fc?.kind === 'language') params.set('language', fc.value);
    if (fc?.kind === 'collection') params.set('collectionId', fc.id);
    try {
      const [facetsRes, list] = await Promise.all([
        api<LibraryFacets>('/library/facets'),
        api<LibraryDocument[]>(`/library?${params.toString()}`),
      ]);
      setFacets(facetsRes);
      setDocs(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleFavorite = async (doc: LibraryDocument) => {
    try {
      await api<LibraryDocument>(`/library/documents/${doc.id}/favorite`, {
        method: 'PATCH',
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const trash = async (doc: LibraryDocument) => {
    try {
      const action = doc.deletedAt ? 'restore' : 'trash';
      await api<LibraryDocument>(`/library/documents/${doc.id}/${action}`, {
        method: 'POST',
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !docs) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!facets || !docs) return <Loading label={t('lib.loading')} />;

  const count = (f: LibraryFilter): number => facets[f];

  // Filters (shelves + subject/language/collection facets) — rendered vertically
  // in the desktop LEFT rail, or as the current horizontal chips on mobile.
  const shelfChips = SHELVES.map((s) => (
    <Chip key={s.filter} label={`${s.icon} ${t(s.key)}`} badge={count(s.filter)} on={shelf === s.filter && !facet} onPress={() => pickShelf(s.filter)} />
  ));
  const facetGroups = (
    <>
      {facets.subjects.length > 0 ? (
        <FacetGroup title={t('lib.subjects')}>
          {facets.subjects.map((s) => (
            <Chip key={s.value} label={s.value} badge={s.count} on={facet?.kind === 'subject' && facet.value === s.value} onPress={() => pickFacet({ kind: 'subject', value: s.value })} />
          ))}
        </FacetGroup>
      ) : null}
      {facets.languages.length > 0 ? (
        <FacetGroup title={t('lib.languages')}>
          {facets.languages.map((l) => (
            <Chip key={l.value} label={l.value} badge={l.count} on={facet?.kind === 'language' && facet.value === l.value} onPress={() => pickFacet({ kind: 'language', value: l.value })} />
          ))}
        </FacetGroup>
      ) : null}
      {facets.collections.length > 0 ? (
        <FacetGroup title={t('lib.collections')}>
          {facets.collections.map((col) => (
            <Chip key={col.id} label={`📁 ${col.name}`} badge={col.documentCount} on={facet?.kind === 'collection' && facet.id === col.id} onPress={() => pickFacet({ kind: 'collection', id: col.id, name: col.name })} />
          ))}
        </FacetGroup>
      ) : null}
    </>
  );

  const filtersRail = (
    <>
      <View style={styles.chips}>{shelfChips}</View>
      {facetGroups}
    </>
  );
  const filtersMobile = (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {shelfChips}
      </ScrollView>
      {facetGroups}
    </>
  );

  const docNodes =
    shelf === 'shared' && !facet ? (
      <Text style={styles.empty}>{t('lib.sharedSoon')}</Text>
    ) : docs.length === 0 ? (
      <Text style={styles.empty}>{t('lib.empty')}</Text>
    ) : (
      docs.map((doc) => (
        <View key={doc.id} style={wide ? styles.docCell : undefined}>
          <DocCard
            doc={doc}
            onOpen={() => router.push(`/library/${doc.id}`)}
            onFavorite={() => toggleFavorite(doc)}
            onTrash={() => trash(doc)}
          />
        </View>
      ))
    );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>📚 {t('lib.title')}</Text>
        <Text style={styles.intro}>{t('lib.intro')}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Add row */}
      <View style={styles.addRow}>
        <Button label={t('lib.add')} onPress={() => setAdding((v) => !v)} />
        <Button variant="ghost" label={`📷 ${t('lib.scan')}`} onPress={() => router.push('/scan')} />
        <Button variant="ghost" label={`❓ ${t('lib.askLibrary')}`} onPress={() => router.push('/library/ask')} />
      </View>
      {adding ? <AddPanel onDone={() => { setAdding(false); void load(); }} /> : null}

      {wide ? (
        // Desktop: LEFT filters rail + RIGHT documents grid filling the width.
        <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
          <View style={{ width: 260, gap: 12 }}>{filtersRail}</View>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', alignContent: 'flex-start' }}>
            {docNodes}
          </View>
        </View>
      ) : (
        // Mobile / tablet: unchanged single-column stack.
        <>
          {filtersMobile}
          {docNodes}
        </>
      )}
    </ScrollView>
  );
}

/** Inline quick-add: paste text, or ingest a URL. */
function AddPanel({ onDone }: { onDone: () => void }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [mode, setMode] = useState<'text' | 'url'>('text');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'text') {
        if (!title.trim() || !body.trim()) throw new Error(t('lib.addTextRequired'));
        await api('/documents', {
          method: 'POST',
          body: { title: title.trim(), content: body },
        });
      } else {
        if (!body.trim()) throw new Error(t('lib.addUrlRequired'));
        await api('/documents/from-url', { method: 'POST', body: { url: body.trim() } });
      }
      setTitle('');
      setBody('');
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Web file picker → the upload pipeline. Handles text PDFs AND scanned PDFs
  // (those are OCR'd server-side by Document Intelligence). Web-only for now;
  // native document-picker is a follow-up.
  const pickFile = () => {
    const g = globalThis as unknown as { document?: any };
    if (!g.document) return;
    const input = g.document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.txt,.md,application/pdf,text/plain';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setBusy(true);
      setErr(null);
      try {
        const form = new FormData();
        form.append('file', file);
        await apiUpload('/documents/upload', form);
        onDone();
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  return (
    <Card style={styles.addCard}>
      <View style={styles.chips}>
        <Chip label={t('lib.addText')} on={mode === 'text'} onPress={() => setMode('text')} />
        <Chip label={t('lib.addUrl')} on={mode === 'url'} onPress={() => setMode('url')} />
      </View>
      {Platform.OS === 'web' ? (
        <Button variant="ghost" label={t('lib.addFile')} onPress={pickFile} busy={busy} />
      ) : null}
      {err ? <ErrorBanner message={err} /> : null}
      {mode === 'text' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder={t('lib.addTitle')}
            placeholderTextColor={c.textMuted}
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={t('lib.addBody')}
            placeholderTextColor={c.textMuted}
            value={body}
            onChangeText={setBody}
            multiline
          />
        </>
      ) : (
        <TextInput
          style={styles.input}
          placeholder="https://…"
          placeholderTextColor={c.textMuted}
          value={body}
          onChangeText={setBody}
          autoCapitalize="none"
        />
      )}
      <Button label={t('lib.addBtn')} onPress={submit} busy={busy} />
    </Card>
  );
}

function DocCard({
  doc,
  onOpen,
  onFavorite,
  onTrash,
}: {
  doc: LibraryDocument;
  onOpen: () => void;
  onFavorite: () => void;
  onTrash: () => void;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, locale } = useI18n();
  return (
    <Card style={styles.doc}>
      <View style={styles.docHead}>
        <Pressable style={styles.flex} onPress={onOpen} accessibilityRole="button">
          <Text style={styles.docTitle} numberOfLines={2}>
            {SOURCE_ICON[doc.source] ?? '📄'} {doc.title}
          </Text>
        </Pressable>
        <Pressable onPress={onFavorite} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.star}>{doc.isFavorite ? '⭐' : '☆'}</Text>
        </Pressable>
        <Pressable onPress={onTrash} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.trash}>{doc.deletedAt ? '♻️' : '🗑️'}</Text>
        </Pressable>
      </View>

      {/* Metadata badges */}
      <View style={styles.badges}>
        {doc.subject ? <Badge label={doc.subject} tone={c.primary} /> : null}
        {doc.language ? <Badge label={doc.language} tone={c.textSecondary} /> : null}
        {doc.difficulty ? (
          <Badge label={t(DIFFICULTY_KEY[doc.difficulty])} tone={difficultyColor(c)[doc.difficulty]} />
        ) : null}
        {doc.status === 'failed' ? (
          <Badge label={t('lib.status.failed')} tone={c.error} />
        ) : null}
      </View>

      {/* Smart Upload Pipeline progress, or the AI summary once ready */}
      {doc.status === 'pending' || doc.status === 'processing' ? (
        <PipelineProgress stage={doc.stage} />
      ) : doc.summary ? (
        <Text style={styles.summary} numberOfLines={3}>{doc.summary}</Text>
      ) : doc.enriched ? (
        <Text style={styles.preview} numberOfLines={2}>{doc.preview}</Text>
      ) : (
        <Text style={styles.analysing}>{t('lib.analysing')}</Text>
      )}

      {/* Detected concepts */}
      {doc.concepts.length > 0 ? (
        <View style={styles.concepts}>
          {doc.concepts.slice(0, 6).map((c) => (
            <Text key={c.id} style={styles.concept}>🧩 {c.name}</Text>
          ))}
        </View>
      ) : null}

      {/* Footer: author + date */}
      <Text style={styles.meta}>
        {doc.author ? `✍️ ${doc.author} · ` : ''}
        {new Date(doc.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </Text>
    </Card>
  );
}

/** The automatic Smart Upload Pipeline, shown live while a document processes.
 *  Completed stages are green, the running one is highlighted, the rest faint —
 *  the learner watches it advance without doing anything. */
function PipelineProgress({ stage }: { stage: PipelineStage | null }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const currentIndex = stage ? PIPELINE.findIndex((s) => s.stage === stage) : -1;
  return (
    <View style={styles.pipeline}>
      <Text style={styles.pipelineLabel}>⚙️ {t('lib.pipelineRunning')}</Text>
      <View style={styles.pipelineSteps}>
        {PIPELINE.map((s, i) => {
          const done = currentIndex > i;
          const active = currentIndex === i;
          return (
            <View
              key={s.stage}
              style={[
                styles.stagePill,
                done && styles.stageDone,
                active && styles.stageActive,
              ]}
            >
              <Text
                style={[
                  styles.stageText,
                  done && styles.stageDoneText,
                  active && styles.stageActiveText,
                ]}
              >
                {done ? '✓' : s.icon} {t(s.key)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Chip({
  label,
  badge,
  on,
  onPress,
}: {
  label: string;
  badge?: number;
  on: boolean;
  onPress: () => void;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.chipText, on && styles.chipTextOn]}>
        {label}
        {badge !== undefined && badge > 0 ? `  ${badge}` : ''}
      </Text>
    </Pressable>
  );
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.facetGroup}>
      <Text style={styles.facetTitle}>{title}</Text>
      <View style={styles.facetChips}>{children}</View>
    </View>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.badge, { borderColor: tone }]}>
      <Text style={[styles.badgeText, { color: tone }]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  addRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  addCard: { gap: 10 },
  input: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 15, color: c.textPrimary },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 2 },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.surfaceElevated },
  chipOn: { borderColor: c.primary, backgroundColor: c.primary },
  chipText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  chipTextOn: { color: c.onPrimary },
  facetGroup: { gap: 6 },
  facetTitle: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  facetChips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  empty: { fontSize: 14, color: c.textSecondary, paddingVertical: 12 },
  docCell: { width: '48%', flexGrow: 1, minWidth: 320 },
  doc: { gap: 8 },
  docHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1 },
  docTitle: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  star: { fontSize: 20 },
  trash: { fontSize: 18 },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  summary: { fontSize: 14, color: c.textPrimary, lineHeight: 20 },
  preview: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
  analysing: { fontSize: 13, color: c.textMuted, fontStyle: 'italic' },
  pipeline: { gap: 6 },
  pipelineLabel: { fontSize: 12, color: c.primary, fontWeight: '700' },
  pipelineSteps: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  stagePill: { borderWidth: 1, borderColor: c.border, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: c.surfaceElevated },
  stageDone: { borderColor: c.success },
  stageActive: { borderColor: c.primary, backgroundColor: c.primary },
  stageText: { fontSize: 11, color: c.textMuted, fontWeight: '600' },
  stageDoneText: { color: c.success },
  stageActiveText: { color: c.onPrimary },
  concepts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  concept: { fontSize: 12, color: c.primary, fontWeight: '600' },
  meta: { fontSize: 12, color: c.textMuted },
});
