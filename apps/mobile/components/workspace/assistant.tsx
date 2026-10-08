import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  WORKSPACE_ASSIST_ACTIONS,
  type PersistentWorkspaceAssistRequest,
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
  onApplyProposal,
  onUndo,
  canUndo,
}: {
  workspaceId: string;
  initialHistory: WorkspaceAssistantHistoryEntry[];
  selectedText: string;
  onApplyProposal: (proposal: string, mode: 'insert' | 'replace') => void;
  onUndo: () => void;
  canUndo: boolean;
}) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [history, setHistory] = useState(initialHistory);
  const [action, setAction] = useState<WorkspaceAssistAction>('suggest');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<PersistentWorkspaceAssistRequest | null>(null);
  const latestProposal = [...history].reverse().find((entry) => entry.role === 'assistant')?.content ?? null;

  const send = async (requestOverride?: PersistentWorkspaceAssistRequest) => {
    const request: PersistentWorkspaceAssistRequest = requestOverride ?? {
      action,
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(selectedText.trim() ? { selectedText: selectedText.trim() } : {}),
    };
    if (!request.message?.trim() && !request.selectedText?.trim()) return;
    const userEntry: WorkspaceAssistantHistoryEntry = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: request.message?.trim() || request.selectedText?.trim() || '',
      createdAt: new Date().toISOString(),
    };
    setHistory((current) => [...current, userEntry]);
    setBusy(true);
    setError(null);
    try {
      const response = await api<PersistentWorkspaceAssistResponse>(`/workspaces/${workspaceId}/assistant`, { method: 'POST', body: request });
      setHistory((current) => [...current, response.reply].slice(-30));
      setLastRequest(request);
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
    <ScrollView
      style={{ maxHeight: 360 }}
      contentContainerStyle={{ gap: spacing.sm }}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      testID="workspace-assistant-history"
    >
      {history.slice(-10).map((entry) => <View key={entry.id} style={{ alignSelf: entry.role === 'user' ? 'flex-end' : 'stretch', maxWidth: entry.role === 'user' ? '85%' : '100%', backgroundColor: entry.role === 'user' ? c.primary : c.surfaceSunken, padding: spacing.sm, borderRadius: 10 }}><Text style={[typography.bodySmall, { color: entry.role === 'user' ? c.onPrimary : c.textPrimary }]}>{entry.content}</Text></View>)}
    </ScrollView>
    {latestProposal ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        <Button size="sm" variant="secondary" label={t('globalPath.insertProposal')} onPress={() => onApplyProposal(latestProposal, 'insert')} />
        {selectedText ? <Button size="sm" variant="secondary" label={t('globalPath.replaceSelection')} onPress={() => onApplyProposal(latestProposal, 'replace')} /> : null}
        {lastRequest ? <Button size="sm" variant="ghost" label={t('globalPath.anotherProposal')} loading={busy} onPress={() => void send(lastRequest)} /> : null}
        {canUndo ? <Button size="sm" variant="ghost" label={t('globalPath.undoInsertion')} onPress={onUndo} /> : null}
      </View>
    ) : null}
    {error ? <Alert tone="error" title={t('state.error')} detail={error} /> : null}
    <Input label={t('workspace10.assistantQuestion')} value={message} onChangeText={setMessage} placeholder={t('workspace10.assistantPlaceholder')} multiline />
    <Button label={t('workspace10.assistantSend')} variant="ai" loading={busy} disabled={!message.trim() && !selectedText.trim()} onPress={() => void send()} />
  </Card>;
}
