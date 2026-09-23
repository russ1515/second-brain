import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth';
import {
  getBugs,
  publicReference,
  recordNumber,
  recordString,
  recordValue,
  safeProblem,
  safeText,
  type DiagnosticRecord,
  type PageData,
} from '../lib/bugs';
import {
  AvailabilityBadge,
  EmptyDiagnosticState,
  LoadingOrError,
  Panel,
  PrimaryButton,
  SecondaryButton,
  SeverityBadge,
  SimpleTable,
  StatusBadge,
  formatDate,
  formatNumber,
  hasCapability,
  useDiagnosticPresentation,
} from './DiagnosticUi';

type Tab = 'overview' | 'open' | 'provider' | 'frontend' | 'backend' | 'resolved' | 'diagnostics';

const copy = {
  fr: {
    title: 'Bug, Support & Diagnostics Control Center',
    subtitle: 'Vue evidence-first : les faits observés, corrélations et hypothèses restent distincts. Aucune réparation ni déploiement automatique.',
    open: 'Bugs ouverts', provider: 'Erreurs provider', frontend: 'Erreurs frontend', backend: 'Erreurs backend', resolved: 'Résolus', diagnostics: 'Diagnostics', overview: 'Vue d’ensemble',
    incidents: 'Incidents', support: 'Support', refresh: 'Actualiser', refreshing: 'Actualisation…',
    severity: 'Sévérité', status: 'Statut', feature: 'Fonction', source: 'Source', search: 'Recherche titre/code', apply: 'Appliquer', clear: 'Réinitialiser',
    bug: 'Bug', occurrences: 'Occurrences', affectedUsers: 'Utilisateurs affectés', firstSeen: 'Premier signal', lastSeen: 'Dernier signal', version: 'Version', assignedTo: 'Assigné à', view: 'Voir',
    openBugs: 'Bugs ouverts', critical: 'Critiques', high: 'Élevés', newToday: 'Nouveaux aujourd’hui', affected: 'Utilisateurs touchés', regressions: 'Régressions', openIncidents: 'Incidents ouverts', reportsWaiting: 'Signalements en attente',
    evidenceFirst: 'EVIDENCE FIRST', noPermission: 'Votre rôle ne dispose pas de bugs.read.', noPermissionDetail: 'Les données de diagnostic ne sont jamais chargées uniquement pour simuler cette vue.',
    noSummary: 'NOT_INSTRUMENTED', filters: 'Filtres', results: 'Résultats', displayOnly: 'Données de diagnostic affichées en lecture seule. Les actions restent dans le détail et nécessitent une permission serveur.',
  },
  en: {
    title: 'Bug, Support & Diagnostics Control Center',
    subtitle: 'Evidence-first view: observed facts, correlations, and hypotheses stay distinct. No automatic repair or deployment.',
    open: 'Open bugs', provider: 'Provider errors', frontend: 'Frontend errors', backend: 'Backend errors', resolved: 'Resolved', diagnostics: 'Diagnostics', overview: 'Overview',
    incidents: 'Incidents', support: 'Support', refresh: 'Refresh', refreshing: 'Refreshing…',
    severity: 'Severity', status: 'Status', feature: 'Feature', source: 'Source', search: 'Search title/code', apply: 'Apply', clear: 'Clear',
    bug: 'Bug', occurrences: 'Occurrences', affectedUsers: 'Affected users', firstSeen: 'First seen', lastSeen: 'Last seen', version: 'Version', assignedTo: 'Assigned to', view: 'View',
    openBugs: 'Open bugs', critical: 'Critical', high: 'High', newToday: 'New today', affected: 'Affected users', regressions: 'Regressions', openIncidents: 'Open incidents', reportsWaiting: 'Reports waiting',
    evidenceFirst: 'EVIDENCE FIRST', noPermission: 'Your role does not have bugs.read.', noPermissionDetail: 'Diagnostic data is never loaded merely to simulate this view.',
    noSummary: 'NOT_INSTRUMENTED', filters: 'Filters', results: 'Results', displayOnly: 'Diagnostic data is displayed read-only. Actions remain in the detail screen and require server permission.',
  },
} as const;

type CopyKey = keyof typeof copy.en;
function c(locale: 'fr' | 'en', key: CopyKey): string { return copy[locale][key]; }

const tabs: Array<{ id: Tab; label: CopyKey; source?: string; status?: string; open?: boolean }> = [
  { id: 'overview', label: 'overview' }, { id: 'open', label: 'open', open: true }, { id: 'provider', label: 'provider', source: 'provider' },
  { id: 'frontend', label: 'frontend', source: 'frontend' }, { id: 'backend', label: 'backend', source: 'backend' }, { id: 'resolved', label: 'resolved', status: 'resolved' }, { id: 'diagnostics', label: 'diagnostics' },
];

type Filters = { severity: string; status: string; feature: string; source: string; search: string };
const initialFilters: Filters = { severity: '', status: '', feature: '', source: '', search: '' };

function bugId(row: DiagnosticRecord): string | undefined { return recordString(row, ['id', 'bugId']); }
function transportEnum(value: string): string | undefined { const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_'); return normalized || undefined; }

function title(row: DiagnosticRecord): string {
  return safeText(recordString(row, ['title', 'summary', 'errorCode', 'fingerprint']) ?? '—', 150);
}

function metric(summary: DiagnosticRecord | undefined, names: string[]): string {
  const value = recordNumber(summary, names);
  return value === undefined ? 'NOT_INSTRUMENTED' : String(value);
}

function SummaryCard({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useDiagnosticPresentation>['theme'] }) {
  return <View style={{ flexGrow: 1, flexBasis: 148, minHeight: 108, padding: 13, borderRadius: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{label}</Text><Text accessibilityLabel={`${label}: ${value}`} style={{ color: value === 'NOT_INSTRUMENTED' ? theme.muted : theme.text, marginTop: 11, fontSize: value === 'NOT_INSTRUMENTED' ? 13 : 23, fontWeight: '800' }}>{value}</Text></View>;
}

export function BugCenter() {
  const { identity } = useAuth(); const router = useRouter(); const { locale, theme } = useDiagnosticPresentation();
  const allowed = hasCapability(identity, 'bugs.read');
  const [tab, setTab] = useState<Tab>('overview'); const [draft, setDraft] = useState<Filters>(initialFilters); const [filters, setFilters] = useState<Filters>(initialFilters);
  const [data, setData] = useState<PageData | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];
  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true); setError(null);
    try {
      const result = await getBugs({
        page: 1, pageSize: 50, feature: filters.feature || undefined, search: filters.search || undefined,
        severity: transportEnum(filters.severity), status: activeTab.status ?? transportEnum(filters.status), source: activeTab.source ?? transportEnum(filters.source),
        ...(activeTab.open ? { open: 'true' } : {}), ...(tab === 'diagnostics' ? { hasDiagnostics: 'true' } : {}),
      });
      setData(result); setUpdatedAt(new Date().toISOString());
    } catch (problem) { setError(safeProblem(problem)); }
    finally { setLoading(false); }
  }, [activeTab.open, activeTab.source, activeTab.status, allowed, filters, tab]);
  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(() => data?.summary, [data]);
  const summaryCards: Array<[CopyKey, string[]]> = [
    ['openBugs', ['openBugs', 'open', 'openCount']], ['critical', ['critical', 'criticalBugs']], ['high', ['high', 'highBugs']], ['newToday', ['newToday', 'newBugsToday']],
    ['affected', ['affectedUsers', 'affectedUsersCount']], ['regressions', ['regressions', 'reopened']], ['openIncidents', ['openIncidents', 'incidentsOpen']], ['reportsWaiting', ['reportsWaiting', 'userReportsWaiting']],
  ];

  if (!allowed) return <View style={{ padding: 20, borderWidth: 1, borderColor: theme.danger, borderRadius: 14, backgroundColor: theme.dangerSoft }}><Text accessibilityRole="header" style={{ color: theme.danger, fontSize: 22, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.text, marginTop: 8 }}>{c(locale, 'noPermission')}</Text><Text style={{ color: theme.muted, marginTop: 6, fontSize: 12 }}>{c(locale, 'noPermissionDetail')}</Text></View>;

  return <View style={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 260 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{c(locale, 'title')}</Text><View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.primarySoft }}><Text style={{ color: theme.primary, fontSize: 9, fontWeight: '900', letterSpacing: .35 }}>{c(locale, 'evidenceFirst')}</Text></View></View><Text style={{ color: theme.muted, marginTop: 7, fontSize: 13, maxWidth: 980 }}>{c(locale, 'subtitle')}</Text></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 11 }}>{updatedAt ? `${c(locale, 'refresh')}: ${formatDate(locale, updatedAt)}` : ''}</Text><SecondaryButton label={c(locale, 'incidents')} onPress={() => router.push('/incidents' as never)} theme={theme} /><SecondaryButton label={c(locale, 'support')} onPress={() => router.push('/support' as never)} theme={theme} /><PrimaryButton label={loading ? c(locale, 'refreshing') : c(locale, 'refresh')} onPress={() => { void load(); }} disabled={loading} theme={theme} /></View>
    </View>

    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.mutedSurface }}>{tabs.map((item) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: tab === item.id }} aria-selected={tab === item.id} onPress={() => setTab(item.id)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, backgroundColor: tab === item.id ? theme.surface : 'transparent', borderWidth: tab === item.id ? 1 : 0, borderColor: theme.border }}><Text style={{ color: tab === item.id ? theme.text : theme.muted, fontSize: 12, fontWeight: '800' }}>{c(locale, item.label)}</Text></Pressable>)}</View>

    <Panel title={c(locale, 'filters')} theme={theme} right={data ? <AvailabilityBadge availability={data.availability} locale={locale} theme={theme} /> : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        {(['severity', 'status', 'feature', 'source', 'search'] as const).map((key) => <View key={key} style={{ flexGrow: 1, flexBasis: 150, gap: 5 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{c(locale, key)}</Text><TextInput accessibilityLabel={c(locale, key)} value={draft[key]} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))} placeholder={c(locale, key)} placeholderTextColor={theme.muted} autoCapitalize="characters" style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, fontSize: 13 }} /></View>)}
        <SecondaryButton label={c(locale, 'clear')} onPress={() => { setDraft(initialFilters); setFilters(initialFilters); }} theme={theme} /><PrimaryButton label={c(locale, 'apply')} onPress={() => setFilters(draft)} theme={theme} />
      </View>
    </Panel>

    {tab === 'overview' && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>{summaryCards.map(([label, names]) => <SummaryCard key={label} label={c(locale, label)} value={metric(summary, names)} theme={theme} />)}</View>}

    <Panel title={`${c(locale, 'results')}${data?.total !== undefined ? ` · ${formatNumber(locale, data.total)}` : ''}`} theme={theme} right={data ? <AvailabilityBadge availability={data.availability} locale={locale} theme={theme} /> : undefined}>
      <LoadingOrError loading={loading && data === null} error={error} onRetry={() => { void load(); }} locale={locale} theme={theme}>
        {!data || data.rows.length === 0 ? <EmptyDiagnosticState availability={data?.availability ?? 'INSUFFICIENT_DATA'} locale={locale} theme={theme} /> : <SimpleTable theme={theme} headers={[c(locale, 'severity'), c(locale, 'bug'), c(locale, 'feature'), c(locale, 'status'), c(locale, 'occurrences'), c(locale, 'affectedUsers'), c(locale, 'firstSeen'), c(locale, 'lastSeen'), c(locale, 'version'), c(locale, 'assignedTo'), '']} rows={data.rows.map((row, index) => {
          const id = bugId(row); const severity = recordString(row, ['severity', 'level']); const status = recordString(row, ['status']);
          const maskedAssignee = safeText(recordString(row, ['assignedToMasked', 'assignedToDisplay', 'assignedToName', 'assignedTo']) ?? '—', 56);
          return { key: id ?? `${publicReference(row)}-${index}`, cells: [
            <SeverityBadge severity={severity} locale={locale} theme={theme} />, <View><Text numberOfLines={2} style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{title(row)}</Text><Text style={{ color: theme.muted, marginTop: 3, fontSize: 10 }}>{publicReference(row)}</Text></View>,
            safeText(recordString(row, ['feature', 'featureKey']) ?? '—', 50), <StatusBadge status={status} theme={theme} />, formatNumber(locale, recordNumber(row, ['occurrenceCount', 'occurrences', 'count'])), formatNumber(locale, recordNumber(row, ['affectedUsersCount', 'affectedUsers'])),
            formatDate(locale, recordValue(row, ['firstSeen', 'firstOccurredAt', 'createdAt'])), formatDate(locale, recordValue(row, ['lastSeen', 'lastOccurredAt', 'updatedAt'])), safeText(recordString(row, ['affectedVersion', 'appVersion', 'buildVersion']) ?? '—', 45), maskedAssignee,
            id ? <SecondaryButton label={c(locale, 'view')} theme={theme} onPress={() => router.push(`/bugs/${encodeURIComponent(id)}` as never)} accessibilityHint={publicReference(row)} /> : '—',
          ] };
        })} />}
      </LoadingOrError>
      <Text style={{ color: theme.muted, marginTop: 11, fontSize: 11 }}>{c(locale, 'displayOnly')}</Text>
    </Panel>
  </View>;
}
