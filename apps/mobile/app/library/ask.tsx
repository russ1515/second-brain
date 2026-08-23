import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AskRequest, AskResponse, LibraryFacets } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n } from '../../lib/i18n';
import { Button, Card, ErrorBanner } from '../../components/ui';

type Scope =
  | { kind: 'all' }
  | { kind: 'document'; id: string; label: string }
  | { kind: 'subject'; value: string }
  | { kind: 'collection'; id: string; label: string };

/**
 * ❓ Ask my library (Sprint 6.4 — Adaptive RAG). One question, answered ONLY from
 * the learner's own documents, with the source passages cited. The scope is
 * adaptive: the whole library, a subject, a collection, or a single document.
 * Grounded — when nothing relevant is found it says so instead of inventing.
 */
export default function AskScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams<{ documentId?: string; title?: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [facets, setFacets] = useState<LibraryFacets | null>(null);
  const [question, setQuestion] = useState('');
  const [scope, setScope] = useState<Scope>(
    params.documentId
      ? { kind: 'document', id: params.documentId, label: params.title || t('lib.ask.thisDoc') }
      : { kind: 'all' },
  );
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<LibraryFacets>('/library/facets').then(setFacets).catch(() => undefined);
  }, []);

  const scopeBody = useCallback((): Partial<AskRequest> => {
    switch (scope.kind) {
      case 'document': return { documentId: scope.id };
      case 'subject': return { subject: scope.value };
      case 'collection': return { collectionId: scope.id };
      default: return {};
    }
  }, [scope]);

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const body: AskRequest = { question: question.trim(), ...scopeBody() };
      setAnswer(await api<AskResponse>('/documents/ask', { method: 'POST', body }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const active = (s: Scope): boolean => {
    if (s.kind !== scope.kind) return false;
    if (s.kind === 'subject' && scope.kind === 'subject') return s.value === scope.value;
    if (s.kind === 'document' && scope.kind === 'document') return s.id === scope.id;
    if (s.kind === 'collection' && scope.kind === 'collection') return s.id === scope.id;
    return true;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>❓ {t('lib.ask.title')}</Text>
        <Text style={styles.intro}>{t('lib.ask.intro')}</Text>
      </View>

      {/* Scope selector */}
      <Text style={styles.scopeLabel}>{t('lib.ask.scope')}</Text>
      <View style={styles.chips}>
        {params.documentId ? (
          <Chip
            label={`📄 ${params.title || t('lib.ask.thisDoc')}`}
            on={active({ kind: 'document', id: params.documentId, label: '' })}
            onPress={() => setScope({ kind: 'document', id: params.documentId!, label: params.title || '' })}
          />
        ) : null}
        <Chip label={`📚 ${t('lib.ask.all')}`} on={active({ kind: 'all' })} onPress={() => setScope({ kind: 'all' })} />
        {facets?.subjects.map((s) => (
          <Chip
            key={`s-${s.value}`}
            label={s.value}
            on={active({ kind: 'subject', value: s.value })}
            onPress={() => setScope({ kind: 'subject', value: s.value })}
          />
        ))}
        {facets?.collections.map((c) => (
          <Chip
            key={`c-${c.id}`}
            label={`📁 ${c.name}`}
            on={active({ kind: 'collection', id: c.id, label: c.name })}
            onPress={() => setScope({ kind: 'collection', id: c.id, label: c.name })}
          />
        ))}
      </View>

      {/* Question */}
      <TextInput
        style={styles.input}
        placeholder={t('lib.ask.placeholder')}
        placeholderTextColor={c.textMuted}
        value={question}
        onChangeText={setQuestion}
        multiline
      />
      <Button label={t('lib.ask.btn')} onPress={ask} busy={busy} disabled={!question.trim()} />

      {error ? <ErrorBanner message={error} /> : null}

      {/* Answer */}
      {answer ? (
        <>
          <Card style={styles.answerCard}>
            <Text style={styles.answerLabel}>💡 {t('lib.ask.answer')}</Text>
            <Text style={styles.answer}>{answer.answer}</Text>
            {!answer.usedContext ? (
              <Text style={styles.grounded}>{t('lib.ask.noContext')}</Text>
            ) : null}
          </Card>

          {answer.citations.length > 0 ? (
            <View style={styles.sources}>
              <Text style={styles.scopeLabel}>{t('lib.ask.sources')}</Text>
              {answer.citations.map((c, i) => (
                <Pressable
                  key={`${c.documentId}-${c.chunkIndex}`}
                  onPress={() => router.push(`/library/${c.documentId}`)}
                  accessibilityRole="button"
                >
                  <View style={styles.citation}>
                    <Text style={styles.citHead}>
                      [{i + 1}] {c.documentTitle}  ·  {Math.round(c.score * 100)}%
                    </Text>
                    {c.content ? <Text style={styles.citSnippet} numberOfLines={4}>{c.content}</Text> : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  scopeLabel: { fontSize: 11, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: c.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: c.surfaceElevated },
  chipOn: { borderColor: c.primary, backgroundColor: c.primary },
  chipText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
  chipTextOn: { color: c.onPrimary },
  input: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, fontSize: 15, color: c.textPrimary, minHeight: 80, textAlignVertical: 'top' },
  answerCard: { gap: 8, borderColor: c.primary },
  answerLabel: { fontSize: 12, fontWeight: '700', color: c.primary },
  answer: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
  grounded: { fontSize: 13, color: c.textMuted, fontStyle: 'italic' },
  sources: { gap: 8 },
  citation: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 12, gap: 4 },
  citHead: { fontSize: 13, fontWeight: '700', color: c.primary },
  citSnippet: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
});
