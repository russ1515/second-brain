import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type {
  WorkAnalysis,
  WorkspaceAssistResponse,
  WorkspaceMessage,
  WorkspaceMode,
} from '@second-brain/shared';
import { api } from '../../../lib/client';
import { theme } from '../../../lib/theme';
import { useI18n, type TranslationKey } from '../../../lib/i18n';
import { Button, Card, ErrorBanner } from '../../../components/ui';
import { Markdown } from '../../../components/markdown';

const MODES: { mode: WorkspaceMode; key: TranslationKey; icon: string }[] = [
  { mode: 'guide', key: 'ws.mode.guide', icon: '👨‍🏫' },
  { mode: 'accompany', key: 'ws.mode.accompany', icon: '📝' },
  { mode: 'solve', key: 'ws.mode.solve', icon: '✅' },
];

const OPENER: Record<WorkspaceMode, string> = {
  guide: 'Aide-moi à comprendre et démarrer ce travail — guide-moi sans le résoudre à ma place.',
  accompany: 'Résolvons ce travail ensemble, étape par étape. Commence par la première étape.',
  solve: 'Donne-moi la solution complète et entièrement expliquée de ce travail.',
};

/**
 * 🎓 AI Academic Workspace (Sprint 6.7). The student works on an academic
 * document with the AI teacher: an automatic twin-adapted analysis, then one of
 * three accompaniment modes (guidance / accompanied / full solution), and a
 * one-tap turn of the finished work into saved study resources.
 */
export default function WorkspaceScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const { t } = useI18n();
  const [analysis, setAnalysis] = useState<WorkAnalysis | null>(null);
  const [mode, setMode] = useState<WorkspaceMode>('guide');
  const [sent, setSent] = useState<WorkspaceMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [genDone, setGenDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-analyse on open.
  useEffect(() => {
    api<WorkAnalysis>(`/library/documents/${id}/workspace/analyze`, { method: 'POST', body: {} })
      .then(setAnalysis)
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const openMode = useCallback(
    async (m: WorkspaceMode) => {
      setMode(m);
      setBusy(true);
      setError(null);
      const history: WorkspaceMessage[] = [{ role: 'user', content: OPENER[m] }];
      try {
        const res = await api<WorkspaceAssistResponse>(
          `/library/documents/${id}/workspace/assist`,
          { method: 'POST', body: { mode: m, messages: history } },
        );
        setSent([...history, { role: 'assistant', content: res.reply }]);
      } catch (e) {
        setError((e as Error).message);
        setSent([]);
      } finally {
        setBusy(false);
      }
    },
    [id],
  );

  // Open the default mode once.
  useEffect(() => {
    void openMode('guide');
  }, [openMode]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    const history: WorkspaceMessage[] = [...sent, { role: 'user', content: q }];
    setSent(history);
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await api<WorkspaceAssistResponse>(
        `/library/documents/${id}/workspace/assist`,
        { method: 'POST', body: { mode, messages: history } },
      );
      setSent([...history, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  // Turn the finished work into saved resources (feeds FSRS via flashcards).
  const generateResources = async () => {
    setGenBusy(true);
    setError(null);
    try {
      for (const type of ['summary', 'flashcards', 'quiz'] as const) {
        await api(`/library/documents/${id}/resources`, { method: 'POST', body: { type } });
      }
      setGenDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  };

  const conversation = sent.slice(1); // hide the synthetic opener turn

  return (
    <ScrollView contentContainerStyle={styles.container} ref={scrollRef}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🎓 {t('ws.title')}</Text>
        <Text style={styles.docTitle}>{title || t('header.document')}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Automatic work analysis */}
      {analysis ? <AnalysisCard analysis={analysis} /> : (
        <Text style={styles.analysing}>{t('ws.analysing')}</Text>
      )}

      {/* Mode selector */}
      <Text style={styles.sectionLabel}>{t('ws.chooseMode')}</Text>
      <View style={styles.modeRow}>
        {MODES.map((m) => (
          <Pressable
            key={m.mode}
            style={[styles.modeChip, mode === m.mode && styles.modeChipOn]}
            onPress={() => openMode(m.mode)}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={[styles.modeText, mode === m.mode && styles.modeTextOn]}>
              {m.icon} {t(m.key)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Conversation */}
      {conversation.map((m, i) => (
        <View key={i} style={m.role === 'user' ? styles.userBubble : styles.aiBubble}>
          {m.role === 'user' ? (
            <Text style={styles.userText}>{m.content}</Text>
          ) : (
            <Markdown text={m.content} />
          )}
        </View>
      ))}
      {busy ? <Text style={styles.analysing}>{t('ws.thinking')}</Text> : null}

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={t('ws.placeholder')}
          placeholderTextColor={theme.textFaint}
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Button label={t('ws.send')} onPress={send} busy={busy} disabled={!input.trim()} />
      </View>

      {/* Finish → generate resources (feeds the brain) */}
      <Card style={styles.finishCard}>
        <Text style={styles.finishTitle}>✅ {t('ws.finishTitle')}</Text>
        <Text style={styles.muted}>{t('ws.finishHint')}</Text>
        {genDone ? (
          <Text style={styles.done}>{t('ws.generated')}</Text>
        ) : (
          <Button label={t('ws.generate')} onPress={generateResources} busy={genBusy} />
        )}
      </Card>
    </ScrollView>
  );
}

function AnalysisCard({ analysis }: { analysis: WorkAnalysis }) {
  const { t } = useI18n();
  return (
    <Card style={styles.analysisCard}>
      <Text style={styles.analysisTitle}>
        🔍 {t('ws.analysisTitle')} · {t('ws.levelAdapted')} {analysis.level}
      </Text>
      <AnalysisBlock label={t('ws.objectives')} items={analysis.objectives} />
      <AnalysisBlock label={t('ws.skills')} items={analysis.skillsEvaluated} />
      <AnalysisBlock label={t('ws.prerequisites')} items={analysis.prerequisites} />
      <AnalysisBlock label={t('ws.successCriteria')} items={analysis.successCriteria} />
      <AnalysisBlock label={t('ws.keyNotions')} items={analysis.keyNotions} />
      {analysis.likelyDifficult.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>⚠️ {t('ws.likelyHard')}</Text>
          {analysis.likelyDifficult.map((d, i) => (
            <Text key={i} style={styles.hardItem}>
              • <Text style={styles.hardConcept}>{d.concept}</Text>
              {d.reason ? ` — ${d.reason}` : ''}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function AnalysisBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      {items.map((it, i) => (
        <Text key={i} style={styles.blockItem}>• {it}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2 },
  docTitle: { fontSize: 20, fontWeight: '700', color: theme.text },
  analysing: { fontSize: 14, color: theme.textFaint, fontStyle: 'italic' },
  thinking: { fontSize: 14, color: theme.textFaint },
  analysisCard: { gap: 10, borderColor: theme.accent },
  analysisTitle: { fontSize: 13, fontWeight: '700', color: theme.accent },
  block: { gap: 3 },
  blockLabel: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 },
  blockItem: { fontSize: 14, color: theme.text, lineHeight: 20 },
  hardItem: { fontSize: 14, color: theme.text, lineHeight: 20 },
  hardConcept: { fontWeight: '700', color: theme.warn },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.8 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeChip: { borderWidth: 1, borderColor: theme.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.surfaceAlt },
  modeChipOn: { borderColor: theme.accent, backgroundColor: theme.accent },
  modeText: { fontSize: 13, color: theme.textMuted, fontWeight: '600' },
  modeTextOn: { color: theme.accentText },
  aiBubble: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12 },
  userBubble: { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.accent, borderRadius: 12, padding: 12, alignSelf: 'flex-end', maxWidth: '90%' },
  userText: { fontSize: 15, color: theme.text, lineHeight: 21 },
  inputRow: { gap: 8 },
  input: { backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 15, color: theme.text, minHeight: 70, textAlignVertical: 'top' },
  finishCard: { gap: 8, borderColor: theme.ok },
  finishTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  muted: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  done: { fontSize: 14, color: theme.ok, fontWeight: '700' },
});
