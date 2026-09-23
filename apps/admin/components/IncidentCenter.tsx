import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../contexts/auth';
import { adminEnvironment } from '../lib/api';
import {
  getIncidents,
  publicReference,
  recordNumber,
  recordString,
  recordValue,
  safeProblem,
  safeText,
  setIncidentStatus,
  type DiagnosticRecord,
  type IncidentStatus,
  type PageData,
} from '../lib/bugs';
import { CriticalActionDialog } from './CriticalActionDialog';
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

const copy = {
  fr: {
    title: 'Incident Control Center', subtitle: 'Les incidents regroupent des problèmes opérationnels plus larges. Corrélation ne signifie pas causalité confirmée.',
    refresh: 'Actualiser', refreshing: 'Actualisation…', severity: 'Sévérité', status: 'Statut', source: 'Source', search: 'Recherche titre/référence', apply: 'Appliquer', clear: 'Réinitialiser',
    incident: 'Incident', impact: 'Impact observé', affected: 'Utilisateurs affectés', bugs: 'Bugs liés', detected: 'Détecté', updated: 'Dernière mise à jour', timeline: 'Chronologie', owner: 'Responsable',
    noPermission: 'Votre rôle ne dispose pas de incidents.read.', noManage: 'Votre rôle ne peut pas modifier un incident.',
    noAuto: 'Aucune création, atténuation, réparation, redémarrage ou déploiement automatique n’est disponible ici.', changeStatus: 'Changer le statut', targetStatus: 'Statut cible', actionDescription: 'Cette transition est humaine, auditée et vérifiée par le serveur. Elle ne modifie aucun service automatiquement.',
    reason: 'Raison de la transition', reasonPlaceholder: 'Justification factuelle (minimum 5 caractères)', confirmation: 'Saisir CONFIRM', confirmationPlaceholder: 'CONFIRM', cancel: 'Annuler', confirm: 'Confirmer', failed: 'Transition refusée ou non aboutie.',
    results: 'Incidents', evidence: 'OBSERVED / CORRELATED',
  },
  en: {
    title: 'Incident Control Center', subtitle: 'Incidents group broader operational problems. Correlation does not mean confirmed causation.',
    refresh: 'Refresh', refreshing: 'Refreshing…', severity: 'Severity', status: 'Status', source: 'Source', search: 'Search title/reference', apply: 'Apply', clear: 'Clear',
    incident: 'Incident', impact: 'Observed impact', affected: 'Affected users', bugs: 'Linked bugs', detected: 'Detected', updated: 'Last update', timeline: 'Timeline', owner: 'Owner',
    noPermission: 'Your role does not have incidents.read.', noManage: 'Your role cannot modify an incident.',
    noAuto: 'No automatic creation, mitigation, repair, restart, or deployment is available here.', changeStatus: 'Change status', targetStatus: 'Target status', actionDescription: 'This transition is human, audited, and verified by the server. It changes no service automatically.',
    reason: 'Transition reason', reasonPlaceholder: 'Factual justification (minimum 5 characters)', confirmation: 'Type CONFIRM', confirmationPlaceholder: 'CONFIRM', cancel: 'Cancel', confirm: 'Confirm', failed: 'Transition was rejected or did not complete.',
    results: 'Incidents', evidence: 'OBSERVED / CORRELATED',
  },
} as const;
type CopyKey = keyof typeof copy.en;
function c(locale: 'fr' | 'en', key: CopyKey): string { return copy[locale][key]; }

const statuses: IncidentStatus[] = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'];
type Filters = { severity: string; status: string; source: string; search: string };
const initial: Filters = { severity: '', status: '', source: '', search: '' };
function incidentId(row: DiagnosticRecord): string | undefined { return recordString(row, ['id', 'incidentId']); }
function transportEnum(value: string): string | undefined { const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_'); return normalized || undefined; }

export function IncidentCenter() {
  const { identity } = useAuth(); const { locale, theme } = useDiagnosticPresentation(); const canRead = hasCapability(identity, 'incidents.read'); const canManage = hasCapability(identity, 'incidents.manage');
  const [draft, setDraft] = useState<Filters>(initial); const [filters, setFilters] = useState<Filters>(initial); const [data, setData] = useState<PageData | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [targetStatus, setTargetStatus] = useState<IncidentStatus>('IDENTIFIED'); const [actionBusy, setActionBusy] = useState(false); const [actionError, setActionError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!canRead) return; setLoading(true); setError(null); try { setData(await getIncidents({ page: 1, pageSize: 50, severity: transportEnum(filters.severity), status: transportEnum(filters.status), source: transportEnum(filters.source), search: filters.search || undefined })); } catch (problem) { setError(safeProblem(problem)); } finally { setLoading(false); } }, [canRead, filters]);
  useEffect(() => { void load(); }, [load]);
  const submitStatus = async (reason: string) => { if (!selected) return; setActionBusy(true); setActionError(null); try { await setIncidentStatus(selected, targetStatus, reason); setSelected(null); void load(); } catch (problem) { setActionError(safeProblem(problem)); } finally { setActionBusy(false); } };

  if (!canRead) return <View style={{ padding: 20, borderRadius: 14, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft }}><Text accessibilityRole="header" style={{ color: theme.danger, fontSize: 22, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.text, marginTop: 8 }}>{c(locale, 'noPermission')}</Text></View>;
  return <View style={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}><View style={{ flex: 1, minWidth: 260 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.warning, fontSize: 10, fontWeight: '900' }}>{c(locale, 'evidence')}</Text></View><Text style={{ color: theme.muted, marginTop: 7, fontSize: 13 }}>{c(locale, 'subtitle')}</Text></View><PrimaryButton label={loading ? c(locale, 'refreshing') : c(locale, 'refresh')} onPress={() => { void load(); }} disabled={loading} theme={theme} /></View>
    <Panel title={`${c(locale, 'results')}${data?.total !== undefined ? ` · ${formatNumber(locale, data.total)}` : ''}`} theme={theme} right={data ? <AvailabilityBadge availability={data.availability} locale={locale} theme={theme} /> : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 15 }}>{(['severity', 'status', 'source', 'search'] as const).map((key) => <View key={key} style={{ flexGrow: 1, flexBasis: 160, gap: 5 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{c(locale, key)}</Text><TextInput accessibilityLabel={c(locale, key)} value={draft[key]} onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))} placeholder={c(locale, key)} placeholderTextColor={theme.muted} autoCapitalize="characters" style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, fontSize: 13 }} /></View>)}<SecondaryButton label={c(locale, 'clear')} onPress={() => { setDraft(initial); setFilters(initial); }} theme={theme} /><PrimaryButton label={c(locale, 'apply')} onPress={() => setFilters(draft)} theme={theme} /></View>
      <LoadingOrError loading={loading && data === null} error={error} onRetry={() => { void load(); }} locale={locale} theme={theme}>{!data || data.rows.length === 0 ? <EmptyDiagnosticState availability={data?.availability ?? 'INSUFFICIENT_DATA'} locale={locale} theme={theme} /> : <SimpleTable theme={theme} headers={[c(locale, 'severity'), c(locale, 'incident'), c(locale, 'status'), c(locale, 'impact'), c(locale, 'affected'), c(locale, 'bugs'), c(locale, 'detected'), c(locale, 'updated'), c(locale, 'owner'), '']} rows={data.rows.map((row, index) => { const id = incidentId(row); return { key: id ?? `${publicReference(row, 'INCIDENT')}-${index}`, cells: [<SeverityBadge severity={recordString(row, ['severity', 'level'])} locale={locale} theme={theme} />, <View><Text numberOfLines={2} style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{safeText(recordString(row, ['title', 'summary', 'source']) ?? '—', 140)}</Text><Text style={{ color: theme.muted, fontSize: 10, marginTop: 3 }}>{publicReference(row, 'INCIDENT')}</Text></View>, <StatusBadge status={recordString(row, ['status'])} theme={theme} />, safeText(recordString(row, ['impactSummary', 'impact']) ?? '—', 90), formatNumber(locale, recordNumber(row, ['affectedUsersCount', 'affectedUsers'])), formatNumber(locale, recordNumber(row, ['bugCount', 'linkedBugsCount'])), formatDate(locale, recordValue(row, ['detectedAt', 'firstSeen', 'createdAt'])), formatDate(locale, recordValue(row, ['updatedAt', 'lastSeen'])), safeText(recordString(row, ['assignedToMasked', 'ownerMasked', 'ownerDisplay']) ?? '—', 45), id && canManage ? <SecondaryButton label={c(locale, 'changeStatus')} onPress={() => { setActionError(null); setSelected(id); }} theme={theme} /> : '—'] }; })} />}</LoadingOrError>
    </Panel>
    <Panel title={c(locale, 'timeline')} theme={theme}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'noAuto')}</Text></Panel>
    <CriticalActionDialog visible={selected !== null} title={c(locale, 'changeStatus')} production={adminEnvironment === 'PRODUCTION'} onCancel={() => { if (!actionBusy) setSelected(null); }} onConfirm={(reason) => { void submitStatus(reason); }} busy={actionBusy} error={actionError ? `${c(locale, 'failed')} ${actionError}` : null} copy={{ description: c(locale, 'actionDescription'), reason: c(locale, 'reason'), reasonPlaceholder: c(locale, 'reasonPlaceholder'), confirmation: c(locale, 'confirmation'), confirmationPlaceholder: c(locale, 'confirmationPlaceholder'), cancel: c(locale, 'cancel'), confirm: c(locale, 'confirm') }}>
      <View style={{ gap: 7 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'targetStatus')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{statuses.map((status) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: targetStatus === status }} onPress={() => setTargetStatus(status)} style={{ paddingHorizontal: 9, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: targetStatus === status ? theme.primary : theme.border, backgroundColor: targetStatus === status ? theme.primarySoft : theme.surface }}><Text style={{ color: targetStatus === status ? theme.primary : theme.text, fontSize: 10, fontWeight: '800' }}>{status}</Text></Pressable>)}</View></View>
    </CriticalActionDialog>
  </View>;
}
