import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  WORKSPACE_ASSIST_ACTIONS,
  type PersistentWorkspaceAssistResponse,
  type WorkspaceAssistAction,
  type WorkspaceAssistantHistoryEntry,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useTokens } from '../../lib/design/theme';
import { Alert, Button, Card, Input } from '../ds/core';

export function WorkspaceAssistant({
  workspaceId,
  initialHistory,
  selectedText,
}: {
  workspaceId: string;
  initialHistory: WorkspaceAssistantHistoryEntry[];
  selectedText: string;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [history, setHistory] = useState(initialHistory);
  const [action, setAction] = useState<WorkspaceAssistAction>('suggest');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!message.trim() && !selectedText.trim()) return;
    const userEntry: WorkspaceAssistantHistoryEntry = { id: `local-${Date.now()}`, role: 'user', content: message.trim() || selectedText.trim(), createdAt: new Date().toISOString() };
    setHistory((current) => [...current, userEntry]);
    setBusy(true);
    setError(null);
    try {
      const response = await api<PersistentWorkspaceAssistResponse>(`/workspaces/${workspaceId}/assistant`, { method: 'POST', body: { action, ...(message.trim() ? { message: message.trim() } : {}), ...(selectedText.trim() ? { selectedText: selectedText.trim() } : {}) } });
      setHistory((current) => [...current, response.reply].slice(-30));
      setMessage('');
    } catch (caught) {
      setHistory((current) => current.filter((entry) => entry.id !== userEntry.id));
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return <Card style={{ gap: spacing.md }} testID="workspace-assistant">
    <View style={{ gap: spacing.xs }}><Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('workspace10.assistant')}</Text><Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('workspace10.assistantDetail')}</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>{WORKSPACE_ASSIST_ACTIONS.map((value) => <Button key={value} size="sm" variant={action === value ? 'ai' : 'secondary'} label={t(`workspace10.assist.${value}` as TranslationKey)} onPress={() => setAction(value)} />)}</ScrollView>
    {selectedText ? <Alert tone="info" title={t('workspace10.selection')} detail={selectedText.slice(0, 180)} /> : null}
    <View style={{ maxHeight: 360, gap: spacing.sm }}>{history.slice(-10).map((entry) => <View key={entry.id} style={{ alignSelf: entry.role === 'user' ? 'flex-end' : 'stretch', maxWidth: entry.role === 'user' ? '85%' : '100%', backgroundColor: entry.role === 'user' ? c.primary : c.surfaceSunken, padding: spacing.sm, borderRadius: 10 }}><Text style={[typography.bodySmall, { color: entry.role === 'user' ? c.onPrimary : c.textPrimary }]}>{entry.content}</Text></View>)}</View>
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
    <Input label={t('workspace10.assistantQuestion')} value={message} onChangeText={setMessage} placeholder={t('workspace10.assistantPlaceholder')} multiline />
    <Button label={t('workspace10.assistantSend')} variant="ai" loading={busy} disabled={!message.trim() && !selectedText.trim()} onPress={() => void send()} />
  </Card>;
}
