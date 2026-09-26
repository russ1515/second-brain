import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import {
  isQuotaError,
  type AskRequest,
  type AskResponse,
  type Citation,
  type ContextItem,
  type QuotaErrorContract,
} from '@second-brain/shared';
import { ApiError, api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { ContextBar } from '../context/context-bar';
import { Alert, Button, Card } from '../ds/core';
import { SourceCitation, SourcePreview } from '../ds/sources';

export function GroundedAsk({
  scope,
  contexts,
  onOpenDocument,
  onOpenUsage,
  initialQuestion = '',
}: {
  scope: Omit<AskRequest, 'question'>;
  contexts: readonly ContextItem[];
  onOpenDocument: (documentId: string) => void;
  onOpenUsage?: () => void;
  initialQuestion?: string;
}) {
  const { colors: c, spacing, typography, reducedMotion } = useTokens();
  const { t, formatLocale } = useI18n();
  const { width } = useResponsive();
  const mobile = width < 768;
  const [question, setQuestion] = useState(initialQuestion);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [selected, setSelected] = useState<Citation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; quota: QuotaErrorContract | null } | null>(null);

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true); setError(null); setResponse(null); setSelected(null);
    try {
      setResponse(await api<AskResponse>('/documents/ask', {
        method: 'POST', body: { ...scope, question: question.trim() },
      }));
    } catch (caught) { setError(toError(caught)); } finally { setBusy(false); }
  };

  const preview = selected ? (
    <SourcePreview documentCitation={selected} kind="document" onOpen={() => onOpenDocument(selected.documentId)} onClose={() => setSelected(null)} />
  ) : null;

  return (
    <View style={{ gap: spacing.md }} testID="grounded-document-ask">
      <ContextBar items={contexts} />
      <View style={{ gap: spacing.sm }}>
        <TextInput
          accessibilityLabel={t('lib.ask.placeholder')}
          placeholder={t('lib.ask.placeholder')}
          placeholderTextColor={c.textMuted}
          value={question}
          onChangeText={setQuestion}
          multiline
          style={{ minHeight: 96, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, color: c.textPrimary, padding: 14, textAlignVertical: 'top' }}
        />
        <Button label={t('lib.ask.btn')} icon="?" loading={busy} disabled={!question.trim()} onPress={() => void ask()} />
      </View>

      {error ? <View style={{ gap: spacing.sm }}>
        <Alert tone={error.quota ? 'warning' : 'error'} title={error.quota ? t('library7.quota.title') : t('state.error')} detail={quotaDetail(error, formatLocale, t)} />
        {error.quota && onOpenUsage ? <Button label={t('library7.quota.usage')} variant="secondary" size="sm" onPress={onOpenUsage} /> : null}
      </View> : null}

      {response ? (
        <View style={{ flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ flex: 1, width: '100%', gap: spacing.md }}>
            <Card style={{ gap: spacing.sm }}>
              <Text style={[typography.overline, { color: c.aiAccent }]}>{t('lib.ask.answer')}</Text>
              <Text selectable style={[typography.body, { color: c.textPrimary }]}>{response.answer}</Text>
              {!response.usedContext ? <Alert tone="warning" title={t('library7.ask.noAnswer')} detail={t('lib.ask.noContext')} /> : null}
            </Card>
            {response.citations.length ? <View style={{ gap: spacing.xs }}>
              <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('lib.ask.sources')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                {response.citations.map((citation, index) => <SourceCitation key={`${citation.documentId}-${citation.chunkIndex}`} title={citation.documentTitle} index={index + 1} kind="document" compact={false} onPress={() => setSelected(citation)} />)}
              </View>
            </View> : null}
          </View>
          {!mobile && selected ? <View style={{ width: 340 }}>{preview}</View> : null}
        </View>
      ) : null}

      {mobile ? <Modal visible={Boolean(selected)} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={() => setSelected(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('source.close')} onPress={() => setSelected(null)} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.overlay }}>
          <Pressable onPress={(event) => event.stopPropagation()} style={{ backgroundColor: c.background, padding: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '72%' }}>
            {preview}
          </Pressable>
        </Pressable>
      </Modal> : null}
    </View>
  );
}

function quotaDetail(
  error: { message: string; quota: QuotaErrorContract | null },
  formatLocale: string,
  t: (key: Parameters<ReturnType<typeof useI18n>['t']>[0]) => string,
): string {
  if (!error.quota) return error.message;
  const reset = error.quota.resetAt ? new Date(error.quota.resetAt).toLocaleString(formatLocale) : null;
  const alternatives = error.quota.availableFeatures.length
    ? ` ${t('library7.quota.alternatives')}: ${error.quota.availableFeatures.join(', ')}.`
    : '';
  return `${error.message}${reset ? ` ${t('library7.quota.reset').replace('{date}', reset)}` : ''}${alternatives}`;
}

function toError(error: unknown): { message: string; quota: QuotaErrorContract | null } {
  if (error instanceof ApiError) {
    const direct = isQuotaError(error.payload) ? error.payload : null;
    const nested = !direct && error.payload && typeof error.payload === 'object' && 'message' in error.payload && isQuotaError((error.payload as { message: unknown }).message)
      ? (error.payload as { message: QuotaErrorContract }).message : null;
    return { message: error.message, quota: direct ?? nested };
  }
  return { message: (error as Error).message, quota: null };
}
