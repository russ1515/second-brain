import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useAdminUi } from '../contexts/admin-ui';
import { type ApiProblem } from '../lib/api';
import { cp } from '../lib/copilot-i18n';
import { getCopilotCapabilities, queryAdminCopilot, type CopilotReply, type CopilotSource, type CopilotTrace } from '../lib/copilot';

type Theme = { surface: string; mutedSurface: string; border: string; text: string; muted: string; primary: string; primarySoft: string; danger: string; dangerSoft: string; success: string; successSoft: string; warning: string; warningSoft: string };
type Message = { id: string; kind: 'user' | 'assistant'; text: string; reply?: CopilotReply };

const sentinel = new Set(['UNKNOWN', 'NOT_AVAILABLE', 'NOT_CONFIGURED', 'NOT_SUPPORTED', 'NOT_INSTRUMENTED', 'INSUFFICIENT_DATA', 'BUSINESS_DECISION_REQUIRED']);

function themeFor(dark: boolean): Theme {
  return dark
    ? { surface: '#111827', mutedSurface: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', danger: '#f87171', dangerSoft: '#450a0a', success: '#34d399', successSoft: '#052e2b', warning: '#fbbf24', warningSoft: '#422006' }
    : { surface: '#fff', mutedSurface: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#64748b', primary: '#2563eb', primarySoft: '#dbeafe', danger: '#dc2626', dangerSoft: '#fef2f2', success: '#047857', successSoft: '#ecfdf5', warning: '#b45309', warningSoft: '#fef3c7' };
}

/** Safety belt for a server response or typed prompt that contains an obvious secret. */
function redact(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._-]+\b/gi, 'Bearer [REDACTED]')
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[REDACTED_PRIVATE_MATERIAL]')
    .replace(/\b(?:password|passphrase|secret|token|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED]')
    .replace(/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]');
}

function appearsSensitive(value: string): boolean {
  return /\bsk-[A-Za-z0-9_-]{12,}\b|\bBearer\s+[A-Za-z0-9._-]+\b|-----BEGIN |\b(?:password|passphrase|secret|token|api[_ -]?key)\s*[:=]\s*\S+/i.test(value);
}

function statusColor(theme: Theme, value: string | undefined): { color: string; backgroundColor: string } {
  const normalized = value?.toUpperCase() ?? '';
  if (normalized === 'AVAILABLE' || normalized === 'MEASURED' || normalized === 'SUCCESS') return { color: theme.success, backgroundColor: theme.successSoft };
  if (sentinel.has(normalized) || normalized === 'ESTIMATED') return { color: theme.warning, backgroundColor: theme.warningSoft };
  if (normalized === 'ERROR' || normalized === 'FAILED' || normalized === 'UNAVAILABLE') return { color: theme.danger, backgroundColor: theme.dangerSoft };
  return { color: theme.primary, backgroundColor: theme.primarySoft };
}

function Badge({ value, theme }: { value: string; theme: Theme }) {
  const style = statusColor(theme, value);
  return <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: style.backgroundColor }}><Text style={{ color: style.color, fontSize: 10, fontWeight: '900' }}>{value}</Text></View>;
}

function SafeSource({ source, theme }: { source: CopilotSource; theme: Theme }) {
  const label = redact(source.label) ?? 'NOT_AVAILABLE'; const kind = redact(source.kind) ?? 'NOT_AVAILABLE'; const status = redact(source.status) ?? 'NOT_AVAILABLE';
  return <View style={{ padding: 9, gap: 4, borderWidth: 1, borderColor: theme.border, borderRadius: 8, backgroundColor: theme.surface }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}><Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>{label}</Text><Badge value={status} theme={theme} /></View><Text style={{ color: theme.muted, fontSize: 11 }}>{kind}</Text></View>;
}

function Trace({ trace, locale, theme }: { trace: CopilotTrace | undefined; locale: 'en' | 'fr'; theme: Theme }) {
  if (!trace) return null;
  const entries: Array<[string, string | undefined]> = [[cp(locale, 'provider'), redact(trace.provider)], [cp(locale, 'model'), redact(trace.model)], [cp(locale, 'costStatus'), redact(trace.costStatus)], [cp(locale, 'correlation'), redact(trace.correlation)]];
  const present: Array<[string, string]> = [];
  for (const [label, value] of entries) if (value) present.push([label, value]);
  if (!present.length) return null;
  return <View style={{ marginTop: 10, padding: 10, gap: 7, borderRadius: 8, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '900' }}>{cp(locale, 'trace')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{present.map(([label, value]) => <View key={label} style={{ gap: 3 }}><Text style={{ color: theme.muted, fontSize: 10 }}>{label}</Text>{sentinel.has(value.toUpperCase()) ? <Badge value={value} theme={theme} /> : <Text selectable style={{ color: theme.text, fontSize: 11 }}>{value}</Text>}</View>)}</View></View>;
}

function Reply({ reply, locale, theme }: { reply: CopilotReply; locale: 'en' | 'fr'; theme: Theme }) {
  const answer = redact(reply.answer) ?? cp(locale, 'noAnswer'); const status = redact(reply.status);
  const proposalStatus = redact(reply.proposal?.status); const proposalReason = redact(reply.proposal?.reason);
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '900' }}>{cp(locale, 'answer')}</Text>{status ? <Badge value={status} theme={theme} /> : null}</View>
    <Text selectable style={{ color: theme.text, fontSize: 14, lineHeight: 21 }}>{answer}</Text>
    <View style={{ gap: 7 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '900' }}>{cp(locale, 'sources')}</Text>{reply.sources.length ? reply.sources.map((source, index) => <SafeSource key={`${source.kind ?? 'source'}-${index}`} source={source} theme={theme} />) : <Badge value={cp(locale, 'noSources')} theme={theme} />}</View>
    {reply.proposal ? <View style={{ padding: 10, gap: 5, borderWidth: 1, borderColor: theme.warning, borderRadius: 8, backgroundColor: theme.warningSoft }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}><Text style={{ color: theme.warning, fontSize: 11, fontWeight: '900' }}>{cp(locale, 'proposal')}</Text>{proposalStatus ? <Badge value={proposalStatus} theme={theme} /> : null}</View>{proposalReason ? <Text style={{ color: theme.text, fontSize: 12 }}>{proposalReason}</Text> : null}<Text style={{ color: theme.warning, fontSize: 11, fontWeight: '800' }}>{cp(locale, 'proposalReadOnly')}</Text></View> : null}
    <Trace trace={reply.trace} locale={locale} theme={theme} />
  </View>;
}

export function AdminCopilot() {
  const { dark, locale } = useAdminUi(); const { width } = useWindowDimensions(); const theme = useMemo(() => themeFor(dark), [dark]);
  const [capabilityState, setCapabilityState] = useState<'loading' | 'available' | 'forbidden' | 'unavailable' | 'error'>('loading');
  const [capabilityError, setCapabilityError] = useState<string | undefined>();
  const [messages, setMessages] = useState<Message[]>([]); const [query, setQuery] = useState(''); const [conversationId, setConversationId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const loadCapabilities = useCallback(async () => { setCapabilityState('loading'); const result = await getCopilotCapabilities(); setCapabilityState(result.state); setCapabilityError(result.reason); }, []);
  useEffect(() => { void loadCapabilities(); }, [loadCapabilities]);
  const submit = async () => {
    const trimmed = query.trim();
    if (!trimmed) { setError(cp(locale, 'inputRequired')); return; }
    if (appearsSensitive(trimmed)) { setError(cp(locale, 'promptHint')); return; }
    setBusy(true); setError(null); setQuery('');
    const userMessage: Message = { id: `user-${Date.now()}`, kind: 'user', text: redact(trimmed) ?? cp(locale, 'notAvailable') };
    setMessages((current) => [...current, userMessage]);
    try {
      const reply = await queryAdminCopilot(trimmed, conversationId);
      if (reply.conversationId) setConversationId(reply.conversationId);
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, kind: 'assistant', text: redact(reply.answer) ?? cp(locale, 'noAnswer'), reply }]);
    } catch (requestError) {
      const problem = requestError as ApiProblem;
      setError(problem.message || cp(locale, 'serverError'));
    } finally { setBusy(false); }
  };
  const newConversation = () => { if (!busy) { setMessages([]); setConversationId(undefined); setError(null); } };
  const panelStyle = { borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface } as const;
  if (capabilityState === 'loading') return <View accessibilityLabel={cp(locale, 'loading')} style={{ minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: 10, ...panelStyle }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted }}>{cp(locale, 'loading')}</Text></View>;
  if (capabilityState !== 'available') {
    const title = capabilityState === 'forbidden' ? cp(locale, 'forbidden') : cp(locale, 'capabilityUnavailable');
    return <View accessibilityRole={capabilityState === 'forbidden' || capabilityState === 'error' ? 'alert' : 'text'} style={{ minHeight: 240, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10, ...panelStyle }}><Text style={{ color: capabilityState === 'error' ? theme.danger : theme.text, fontWeight: '800', textAlign: 'center' }}>{title}</Text>{capabilityError ? <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>{capabilityError}</Text> : null}{capabilityState !== 'forbidden' ? <Pressable accessibilityRole="button" accessibilityLabel={cp(locale, 'retry')} onPress={() => void loadCapabilities()} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800' }}>{cp(locale, 'retry')}</Text></Pressable> : null}</View>;
  }
  return <View style={{ gap: 15, paddingBottom: 32 }} testID="admin-copilot">
    <View style={{ flexDirection: width < 700 ? 'column' : 'row', gap: 12, justifyContent: 'space-between', alignItems: width < 700 ? 'flex-start' : 'center' }}><View style={{ flex: 1 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{cp(locale, 'title')}</Text><Badge value={cp(locale, 'readOnly')} theme={theme} /></View><Text style={{ color: theme.muted, marginTop: 6, fontSize: 13 }}>{cp(locale, 'subtitle')}</Text></View><View style={{ flexDirection: 'row', gap: 8 }}><Pressable accessibilityRole="button" accessibilityLabel={cp(locale, 'newConversation')} disabled={busy} onPress={newConversation} style={{ opacity: busy ? .6 : 1, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}><Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>{cp(locale, 'newConversation')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={cp(locale, 'refresh')} disabled={busy} onPress={() => void loadCapabilities()} style={{ opacity: busy ? .6 : 1, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{cp(locale, 'refresh')}</Text></Pressable></View></View>
    <View style={{ minHeight: 320, maxHeight: width < 700 ? undefined : 650, padding: 14, gap: 12, ...panelStyle }}><ScrollView accessibilityLabel={cp(locale, 'conversation')} contentContainerStyle={{ gap: 12, flexGrow: 1 }}>{messages.length ? messages.map((message) => <View key={message.id} style={{ alignSelf: message.kind === 'user' ? 'flex-end' : 'stretch', maxWidth: message.kind === 'user' ? '86%' : undefined, padding: 12, borderRadius: 11, backgroundColor: message.kind === 'user' ? theme.primarySoft : theme.mutedSurface }}><Text style={{ color: message.kind === 'user' ? theme.primary : theme.text, fontSize: 10, fontWeight: '900', marginBottom: 6 }}>{message.kind === 'user' ? cp(locale, 'prompt') : cp(locale, 'title')}</Text>{message.reply ? <Reply reply={message.reply} locale={locale} theme={theme} /> : <Text selectable style={{ color: theme.text, lineHeight: 20 }}>{message.text}</Text>}</View>) : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}><Text style={{ color: theme.muted, textAlign: 'center' }}>{cp(locale, 'subtitle')}</Text></View>}</ScrollView>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 12 }}>{error}</Text> : null}
      <View style={{ gap: 7, borderTopWidth: 1, borderColor: theme.border, paddingTop: 12 }}><TextInput accessibilityLabel={cp(locale, 'prompt')} value={query} onChangeText={setQuery} editable={!busy} multiline maxLength={1500} placeholder={cp(locale, 'promptHint')} placeholderTextColor={theme.muted} style={{ minHeight: 78, textAlignVertical: 'top', padding: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 8, color: theme.text, backgroundColor: theme.surface }} /><View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}><Pressable accessibilityRole="button" accessibilityLabel={cp(locale, 'send')} accessibilityState={{ disabled: busy || !query.trim() }} disabled={busy || !query.trim()} onPress={() => void submit()} style={{ opacity: busy || !query.trim() ? .6 : 1, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{cp(locale, 'send')}</Text>}</Pressable></View></View>
    </View>
  </View>;
}
