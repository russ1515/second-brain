import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type {
  CompareResponse,
  DocumentDifficulty,
  DocumentPrerequisites,
  IntegrationConcept,
  KnowledgeIntegration,
  LearnerLevel,
  LibraryDocument,
  LibraryDocumentDetail,
  StudyResource,
  StudyResourceType,
  UnderstandMode,
  UnderstandResponse,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

const DIFFICULTY_KEY: Record<DocumentDifficulty, TranslationKey> = {
  beginner: 'lib.diff.beginner',
  intermediate: 'lib.diff.intermediate',
  advanced: 'lib.diff.advanced',
};

const MODES: { mode: UnderstandMode; key: TranslationKey; icon: string }[] = [
  { mode: 'summarize', key: 'lib.u.summarize', icon: '📝' },
  { mode: 'rephrase', key: 'lib.u.rephrase', icon: '🔄' },
  { mode: 'simplify', key: 'lib.u.simplify', icon: '💡' },
  { mode: 'explain', key: 'lib.u.explain', icon: '👨‍🏫' },
];

const LEVEL_KEY: Record<LearnerLevel, TranslationKey> = {
  new: 'lib.level.new',
  beginner: 'lib.level.beginner',
  intermediate: 'lib.level.intermediate',
  advanced: 'lib.level.advanced',
};

function masteryColor(m: number | null, c: ColorScale): string {
  if (m === null) return c.textMuted;
  return m >= 0.7 ? c.success : m >= 0.4 ? c.warning : c.error;
}

const RESOURCES: { type: StudyResourceType; key: TranslationKey; icon: string }[] = [
  { type: 'summary', key: 'lib.r.summary', icon: '📝' },
  { type: 'revision_sheet', key: 'lib.r.revisionSheet', icon: '🗂️' },
  { type: 'flashcards', key: 'lib.r.flashcards', icon: '🎴' },
  { type: 'quiz', key: 'lib.r.quiz', icon: '❓' },
  { type: 'exercises', key: 'lib.r.exercises', icon: '✏️' },
  { type: 'open_questions', key: 'lib.r.openQuestions', icon: '💬' },
  { type: 'course_plan', key: 'lib.r.coursePlan', icon: '🗺️' },
];

const RESOURCE_KEY: Record<StudyResourceType, TranslationKey> = {
  summary: 'lib.r.summary',
  revision_sheet: 'lib.r.revisionSheet',
  flashcards: 'lib.r.flashcards',
  quiz: 'lib.r.quiz',
  exercises: 'lib.r.exercises',
  open_questions: 'lib.r.openQuestions',
  course_plan: 'lib.r.coursePlan',
};

/** One document in the Smart Library: full derived metadata + text + actions
 *  (favorite, re-analyse, detect concepts, trash/restore, delete). */
export default function LibraryDocumentScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [doc, setDoc] = useState<LibraryDocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // AI Document Understanding (Sprint 6.5)
  const [understanding, setUnderstanding] = useState<UnderstandResponse | null>(null);
  const [prereqs, setPrereqs] = useState<DocumentPrerequisites | null>(null);
  const [others, setOthers] = useState<LibraryDocument[] | null>(null);
  const [comparison, setComparison] = useState<CompareResponse | null>(null);
  // AI Study Resources (Sprint 6.6)
  const [resources, setResources] = useState<StudyResource[]>([]);
  // Smart Knowledge Integration (Sprint 6.8)
  const [integration, setIntegration] = useState<KnowledgeIntegration | null>(null);

  const load = useCallback(async () => {
    try {
      setDoc(await api<LibraryDocumentDetail>(`/library/documents/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Load the twin-adapted key notions + prerequisites once.
  useEffect(() => {
    api<DocumentPrerequisites>(`/library/documents/${id}/prerequisites`)
      .then(setPrereqs)
      .catch(() => undefined);
    api<KnowledgeIntegration>(`/library/documents/${id}/integration`)
      .then(setIntegration)
      .catch(() => undefined);
  }, [id]);

  const loadResources = useCallback(() => {
    api<StudyResource[]>(`/library/documents/${id}/resources`)
      .then(setResources)
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const generateResource = async (type: StudyResourceType) => {
    setBusy(`r-${type}`);
    setError(null);
    try {
      await api<StudyResource>(`/library/documents/${id}/resources`, {
        method: 'POST',
        body: { type },
      });
      loadResources();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const understand = async (mode: UnderstandMode) => {
    setBusy(`u-${mode}`);
    setError(null);
    setUnderstanding(null);
    try {
      setUnderstanding(
        await api<UnderstandResponse>(`/library/documents/${id}/understand`, {
          method: 'POST',
          body: { mode },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openCompare = async () => {
    setBusy('compare-list');
    try {
      const all = await api<LibraryDocument[]>('/library?filter=all');
      setOthers(all.filter((d) => d.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const compareWith = async (otherId: string) => {
    setBusy(`cmp-${otherId}`);
    setError(null);
    setComparison(null);
    try {
      setComparison(
        await api<CompareResponse>(`/library/documents/${id}/compare`, {
          method: 'POST',
          body: { otherDocumentId: otherId },
        }),
      );
      setOthers(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const act = async (label: string, fn: () => Promise<unknown>, back = false) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      if (back) {
        router.back();
        return;
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error && !doc) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!doc) return <Loading label={t('lib.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.head}>
        <Text style={styles.title}>{doc.title}</Text>
        <Pressable
          onPress={() => act('fav', () => api(`/library/documents/${doc.id}/favorite`, { method: 'PATCH' }))}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.star}>{doc.isFavorite ? '⭐' : '☆'}</Text>
        </Pressable>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Metadata grid */}
      <Card style={styles.metaCard}>
        <MetaRow label={t('lib.m.subject')} value={doc.subject} />
        <MetaRow label={t('lib.m.language')} value={doc.language} />
        <MetaRow
          label={t('lib.m.difficulty')}
          value={doc.difficulty ? t(DIFFICULTY_KEY[doc.difficulty]) : null}
        />
        <MetaRow label={t('lib.m.author')} value={doc.author} />
        <MetaRow label={t('lib.m.collection')} value={doc.collectionName} />
        <MetaRow
          label={t('lib.m.added')}
          value={new Date(doc.createdAt).toLocaleDateString(
            locale === 'fr' ? 'fr-FR' : 'en-US',
            { day: 'numeric', month: 'long', year: 'numeric' },
          )}
        />
        <MetaRow label={t('lib.m.size')} value={`${doc.charCount.toLocaleString()} ${t('lib.chars')}`} />
      </Card>

      {/* One-click learning (§13): teach directly from this document. */}
      <Button
        label={`👨‍🏫 ${t('lib.learnWithTeacher')}`}
        onPress={() => router.push({ pathname: '/tutor', params: { docId: doc.id, title: doc.title, mode: 'explain' } })}
      />

      {/* AI summary */}
      <Section title={`🤖 ${t('lib.summary')}`}>
        {doc.summary ? (
          <Text style={styles.body}>{doc.summary}</Text>
        ) : (
          <Text style={styles.analysing}>{t('lib.analysing')}</Text>
        )}
      </Section>

      {/* Detected concepts */}
      <Section title={`🧩 ${t('lib.concepts')}`}>
        {doc.concepts.length > 0 ? (
          <View style={styles.concepts}>
            {doc.concepts.map((c) => (
              <View key={c.id} style={styles.conceptChip}>
                <Text style={styles.conceptText}>{c.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{t('lib.noConcepts')}</Text>
        )}
      </Section>

      {/* Smart Knowledge Integration (Sprint 6.8) — how this doc enriched the brain */}
      {integration && integration.summary.concepts > 0 ? (
        <Section title={`🧠 ${t('lib.integ.title')}`}>
          <Text style={styles.muted}>
            {t('lib.integ.summary')
              .replace('{c}', String(integration.summary.concepts))
              .replace('{ch}', String(integration.summary.chunks))
              .replace('{e}', String(integration.summary.edges))}
          </Text>
          <IntegBlock label={`🆕 ${t('lib.integ.new')}`} items={integration.newConcepts} />
          <IntegBlock label={`🔗 ${t('lib.integ.known')}`} items={integration.knownConcepts} />
          <IntegBlock label={`✅ ${t('lib.integ.mastered')}`} items={integration.mastered} />
          <IntegBlock label={`⚠️ ${t('lib.integ.fragile')}`} items={integration.fragile} />
          <IntegBlock label={`📎 ${t('lib.integ.prereq')}`} items={integration.prerequisites} />
          <IntegBlock label={`🧩 ${t('lib.integ.dependents')}`} items={integration.dependents} />
          {integration.linksToExisting.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>🌐 {t('lib.integ.links')}</Text>
              {integration.linksToExisting.slice(0, 10).map((l, i) => (
                <Text key={i} style={styles.body}>
                  • {l.concept} → {l.relatedTo}{' '}
                  <Text style={styles.prereqFor}>({l.relation})</Text>
                </Text>
              ))}
            </View>
          ) : null}
        </Section>
      ) : null}

      {/* AI Document Understanding (Sprint 6.5) — twin-adapted */}
      <Section title={`🧠 ${t('lib.u.title')}`}>
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <Button
              key={m.mode}
              label={`${m.icon} ${t(m.key)}`}
              variant="ghost"
              busy={busy === `u-${m.mode}`}
              onPress={() => understand(m.mode)}
            />
          ))}
        </View>
        {understanding ? (
          <Card style={styles.uCard}>
            <Text style={styles.uLevel}>🎯 {t('lib.u.adapted')} {t(LEVEL_KEY[understanding.level])}</Text>
            <Text style={styles.body}>{understanding.text}</Text>
          </Card>
        ) : null}
      </Section>

      {/* Compare with another document */}
      <Section title={`⚖️ ${t('lib.u.compareTitle')}`}>
        <Button
          label={t('lib.u.compare')}
          variant="ghost"
          busy={busy === 'compare-list'}
          onPress={openCompare}
        />
        {others ? (
          others.length === 0 ? (
            <Text style={styles.muted}>{t('lib.u.noOther')}</Text>
          ) : (
            others.map((o) => (
              <Pressable
                key={o.id}
                onPress={() => compareWith(o.id)}
                accessibilityRole="button"
                disabled={busy === `cmp-${o.id}`}
              >
                <View style={styles.otherRow}>
                  <Text style={styles.otherText} numberOfLines={1}>
                    {busy === `cmp-${o.id}` ? '⏳ ' : '📄 '}{o.title}
                  </Text>
                </View>
              </Pressable>
            ))
          )
        ) : null}
        {comparison ? (
          <Card style={styles.uCard}>
            <Text style={styles.uLevel}>
              {comparison.documentTitle} ⇄ {comparison.otherTitle}
            </Text>
            <Text style={styles.body}>{comparison.text}</Text>
          </Card>
        ) : null}
      </Section>

      {/* Prerequisites to review first (graph + twin, no LLM) */}
      {prereqs && prereqs.prerequisites.length > 0 ? (
        <Section title={`🔗 ${t('lib.u.prereqTitle')}`}>
          <Text style={styles.muted}>{t('lib.u.reviewFirst')}</Text>
          {prereqs.prerequisites.map((p) => (
            <View key={`${p.id}-${p.forConcept}`} style={styles.prereqRow}>
              <Text style={styles.prereqName} numberOfLines={1}>
                {p.name} <Text style={styles.prereqFor}>→ {p.forConcept}</Text>
              </Text>
              <Text style={[styles.prereqMastery, { color: masteryColor(p.mastery, c) }]}>
                {p.mastery === null ? t('lib.u.untracked') : `${Math.round(p.mastery * 100)}%`}
              </Text>
            </View>
          ))}
        </Section>
      ) : null}

      {/* AI Study Resources (Sprint 6.6) — generate + saved, persisted */}
      <Section title={`📦 ${t('lib.r.title')}`}>
        <View style={styles.modeRow}>
          {RESOURCES.map((r) => (
            <Button
              key={r.type}
              label={`${r.icon} ${t(r.key)}`}
              variant="ghost"
              busy={busy === `r-${r.type}`}
              onPress={() => generateResource(r.type)}
            />
          ))}
          <Button label={`🧠 ${t('lib.r.mindmap')}`} variant="ghost" disabled onPress={() => undefined} />
        </View>
        {resources.length > 0 ? (
          <>
            <Text style={styles.muted}>{t('lib.r.saved')}</Text>
            {resources.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => router.push(`/library/resource/${r.id}`)}
                accessibilityRole="button"
              >
                <View style={styles.otherRow}>
                  <Text style={styles.otherText} numberOfLines={1}>
                    {RESOURCES.find((x) => x.type === r.type)?.icon ?? '📦'} {t(RESOURCE_KEY[r.type])}
                    {'  ·  '}
                    <Text style={styles.prereqFor}>
                      {new Date(r.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                        day: 'numeric', month: 'short',
                      })}
                    </Text>
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </Section>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label={t('lib.workspace')}
          onPress={() =>
            router.push({ pathname: '/library/workspace/[id]', params: { id: doc.id, title: doc.title } })
          }
        />
        <Button
          label={t('lib.askThisDoc')}
          variant="ghost"
          onPress={() =>
            router.push({ pathname: '/library/ask', params: { documentId: doc.id, title: doc.title } })
          }
        />
        <Button
          label={t('lib.reanalyse')}
          variant="ghost"
          busy={busy === 'enrich'}
          onPress={() => act('enrich', () => api(`/library/documents/${doc.id}/enrich`, { method: 'POST' }))}
        />
        <Button
          label={t('lib.detectConcepts')}
          variant="ghost"
          busy={busy === 'concepts'}
          onPress={() => act('concepts', () => api(`/documents/${doc.id}/extract-concepts`, { method: 'POST', body: {} }))}
        />
        {doc.deletedAt ? (
          <Button
            label={t('lib.restore')}
            variant="ghost"
            busy={busy === 'restore'}
            onPress={() => act('restore', () => api(`/library/documents/${doc.id}/restore`, { method: 'POST' }))}
          />
        ) : (
          <Button
            label={t('lib.moveToTrash')}
            variant="ghost"
            busy={busy === 'trash'}
            onPress={() => act('trash', () => api(`/library/documents/${doc.id}/trash`, { method: 'POST' }))}
          />
        )}
        <Button
          label={t('lib.deleteForever')}
          variant="danger"
          busy={busy === 'delete'}
          onPress={() => act('delete', () => api(`/documents/${doc.id}`, { method: 'DELETE' }), true)}
        />
      </View>

      {/* Full text */}
      <Section title={`📄 ${t('lib.content')}`}>
        <Text style={styles.content}>{doc.content.slice(0, 4000)}</Text>
        {doc.content.length > 4000 ? <Text style={styles.muted}>…</Text> : null}
      </Section>
    </ScrollView>
  );
}

function MetaRow({ label, value }: { label: string; value: string | null }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, !value && styles.metaEmpty]}>
        {value ?? t('lib.unknown')}
      </Text>
    </View>
  );
}

function IntegBlock({ label, items }: { label: string; items: IntegrationConcept[] }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.concepts}>
        {items.map((c) => (
          <View key={c.id} style={styles.conceptChip}>
            <Text style={styles.conceptText}>
              {c.name}
              {c.mastery !== null ? ` · ${Math.round(c.mastery * 100)}%` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 960, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: c.textPrimary },
  star: { fontSize: 24 },
  metaCard: { gap: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  metaLabel: { fontSize: 13, color: c.textMuted, fontWeight: '600' },
  metaValue: { fontSize: 13, color: c.textPrimary, flexShrink: 1, textAlign: 'right' },
  metaEmpty: { color: c.textMuted, fontStyle: 'italic' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  body: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
  analysing: { fontSize: 14, color: c.textMuted, fontStyle: 'italic' },
  muted: { fontSize: 14, color: c.textSecondary },
  concepts: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  conceptChip: { borderWidth: 1, borderColor: c.primary, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  conceptText: { fontSize: 13, color: c.primary, fontWeight: '600' },
  actions: { gap: 8 },
  content: { fontSize: 13, color: c.textSecondary, lineHeight: 20 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uCard: { gap: 8, borderColor: c.primary, marginTop: 4 },
  uLevel: { fontSize: 12, fontWeight: '700', color: c.primary },
  otherRow: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12 },
  otherText: { fontSize: 14, color: c.textPrimary },
  prereqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10 },
  prereqName: { flex: 1, fontSize: 14, color: c.textPrimary },
  prereqFor: { fontSize: 12, color: c.textMuted },
  prereqMastery: { fontSize: 13, fontWeight: '700' },
  block: { gap: 4 },
  blockLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
});
