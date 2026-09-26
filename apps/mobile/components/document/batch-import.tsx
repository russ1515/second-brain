import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  isQuotaError,
  summarizeDocumentBatch,
  type DocumentBatchItemStatus,
  type DocumentDetail,
  type LibraryDocumentDetail,
  type PipelineStage,
} from '@second-brain/shared';
import { ApiError, api } from '../../lib/client';
import { pickDocuments, uploadPickedDocument, type PickedDocument } from '../../lib/document-import';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { Button, Card, Progress } from '../ds/core';
import { DocumentPipeline } from './document-pipeline';

type BatchItem = {
  key: string;
  file: PickedDocument;
  status: DocumentBatchItemStatus;
  documentId: string | null;
  stage: PipelineStage | null;
  error: string | null;
  quota: boolean;
  conceptCount: number;
  subject: string | null;
};

function localKey(file: PickedDocument, index: number): string {
  return `${file.name}-${file.size ?? 0}-${index}`;
}

/** Client-side bounded orchestrator over the existing single-document engine.
 * A failed item never rolls back or hides successful siblings. */
export function BatchImport({
  onOpen,
  onChanged,
  onUsage,
}: {
  onOpen: (documentId: string) => void;
  onChanged: () => void;
  onUsage: () => void;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { formatLocale, t } = useI18n();
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const cancelled = useRef(false);
  const summary = useMemo(() => summarizeDocumentBatch(items), [items]);
  const conceptCount = items.reduce((sum, item) => sum + item.conceptCount, 0);
  const commonSubjects = [...new Set(items.map((item) => item.subject).filter((value): value is string => Boolean(value)))];

  const update = (key: string, value: Partial<BatchItem>) => {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...value } : item));
  };

  const choose = async () => {
    const files = await pickDocuments(true);
    if (!files.length) return;
    setItems(files.map((file, index) => ({
      key: localKey(file, index), file, status: 'waiting', documentId: null, stage: null, error: null, quota: false, conceptCount: 0, subject: null,
    })));
  };

  const uploadOne = async (item: BatchItem) => {
    if (cancelled.current) return;
    update(item.key, { status: 'uploading', error: null, quota: false });
    try {
      const document = await uploadPickedDocument(item.file);
      update(item.key, {
        documentId: document.id,
        status: document.status === 'ready' ? 'ready' : document.status === 'failed' ? 'failed' : 'processing',
        error: document.error ?? null,
      });
    } catch (error) {
      update(item.key, { status: 'failed', error: (error as Error).message, quota: quotaError(error) });
    }
  };

  const start = async () => {
    cancelled.current = false;
    setRunning(true);
    const queue = items.filter((item) => item.status === 'waiting');
    let cursor = 0;
    const worker = async () => {
      while (!cancelled.current) {
        const item = queue[cursor++];
        if (!item) break;
        await uploadOne(item);
      }
    };
    await Promise.all([worker(), worker()]);
    setRunning(false);
    onChanged();
  };

  const retry = async (item: BatchItem) => {
    if (item.documentId) {
      update(item.key, { status: 'processing', error: null, quota: false });
      try {
        await api<DocumentDetail>(`/documents/${item.documentId}/reindex`, { method: 'POST' });
      } catch (error) {
        update(item.key, { status: 'failed', error: (error as Error).message, quota: quotaError(error) });
      }
      return;
    }
    await uploadOne(item);
  };

  useEffect(() => {
    const pending = items.filter((item) => item.documentId && item.status === 'processing');
    if (!pending.length) return;
    const timer = setTimeout(() => {
      void Promise.all(pending.map(async (item) => {
        try {
          const document = await api<LibraryDocumentDetail>(`/library/documents/${item.documentId}`);
          update(item.key, {
            status: document.status === 'ready' ? 'ready' : document.status === 'failed' ? 'failed' : 'processing',
            stage: document.stage,
            error: document.error ?? null,
            conceptCount: document.concepts.length,
            subject: document.subject,
          });
        } catch (error) {
          update(item.key, { error: (error as Error).message });
        }
      }));
    }, 2500);
    return () => clearTimeout(timer);
  }, [items]);

  useEffect(() => () => { cancelled.current = true; }, []);

  return (
    <Card style={{ gap: spacing.md }} testID="document-batch">
      <View style={{ gap: spacing.xs }}>
        <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{t('document.batch.title')}</Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('document.batch.detail')}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button label={t('document.batch.choose')} variant="secondary" onPress={choose} disabled={running} />
        {items.some((item) => item.status === 'waiting') ? <Button label={t('document.batch.start')} onPress={() => void start()} loading={running} /> : null}
        {running ? <Button label={t('document.batch.cancel')} variant="ghost" onPress={() => { cancelled.current = true; setRunning(false); }} /> : null}
      </View>

      {items.length ? (
        <>
          <View accessibilityRole="summary" style={{ gap: spacing.xs }}>
            <Text style={[typography.bodySmall, { color: c.textPrimary, fontWeight: '700' }]}>
              {t('document.batch.summary')
                .replace('{total}', String(summary.total))
                .replace('{done}', String(summary.completed))
                .replace('{processing}', String(summary.processing))
                .replace('{failed}', String(summary.failed))}
            </Text>
            <Progress value={summary.percent} color={summary.failed ? c.warning : c.primary} />
          </View>
          <View style={{ gap: spacing.xs }}>
            {items.map((item) => (
              <View key={item.key} style={{ borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingVertical: spacing.sm, gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Pressable disabled={!item.documentId} onPress={() => item.documentId && onOpen(item.documentId)} accessibilityRole={item.documentId ? 'link' : undefined} style={{ flex: 1, minHeight: 44, justifyContent: 'center' }}>
                    <Text numberOfLines={1} style={[typography.bodySmall, { color: item.documentId ? c.primary : c.textPrimary, fontWeight: '700' }]}>{item.file.name}</Text>
                    {item.file.size ? <Text style={[typography.caption, { color: c.textMuted }]}>{new Intl.NumberFormat(formatLocale).format(Math.ceil(item.file.size / 1024))} KB</Text> : null}
                  </Pressable>
                  {item.status === 'waiting' ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('document.batch.waiting')}</Text> : null}
                </View>
                {item.status !== 'waiting' && item.status !== 'uploading' ? (
                  <DocumentPipeline status={item.status === 'ready' ? 'ready' : item.status === 'failed' ? 'failed' : 'processing'} stage={item.stage} error={item.error} compact onRetry={item.status === 'failed' ? () => void retry(item) : undefined} />
                ) : item.status === 'uploading' ? <Text style={[typography.caption, { color: c.aiAccent }]}>{t('document.batch.uploading')}</Text> : null}
              </View>
            ))}
          </View>
          {items.some((item) => item.quota) ? <View style={{ gap: spacing.xs }}><Text style={[typography.bodySmall, { color: c.warning }]}>{t('library7.quota.title')}</Text><Button label={t('library7.quota.usage')} variant="secondary" size="sm" onPress={onUsage} /></View> : null}
          {summary.total > 0 && summary.completed + summary.failed === summary.total ? <View accessibilityRole="summary" style={{ gap: spacing.xs, borderTopWidth: 1, borderTopColor: c.borderSubtle, paddingTop: spacing.sm }}>
            <Text style={[typography.title, { color: c.textPrimary }]}>{t('document.batch.result')}</Text>
            <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('document.batch.resultDetail').replace('{documents}', String(summary.completed)).replace('{concepts}', String(conceptCount))}</Text>
            {commonSubjects.length ? <Text style={[typography.caption, { color: c.textMuted }]}>{t('document.batch.subjects')}: {commonSubjects.join(' · ')}</Text> : null}
          </View> : null}
        </>
      ) : null}
    </Card>
  );
}

function quotaError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (isQuotaError(error.payload)) return true;
  return Boolean(error.payload && typeof error.payload === 'object' && 'message' in error.payload && isQuotaError((error.payload as { message: unknown }).message));
}
