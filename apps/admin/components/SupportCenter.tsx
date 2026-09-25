import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useAuth } from '../contexts/auth';
import { adminEnvironment } from '../lib/api';
import {
  assignSupportCase,
  getSupportCases,
  publicReference,
  recordString,
  recordValue,
  safeProblem,
  safeText,
  setSupportStatus,
  type DiagnosticRecord,
  type PageData,
  type SupportStatus,
} from '../lib/bugs';
import { completeAdminStepUp } from '../lib/users';
import { isAdminStepUpRequired } from '../lib/admin-step-up';
import { AdminStepUpDialog } from './AdminStepUpDialog';
import { CriticalActionDialog } from './CriticalActionDialog';
import {
  AvailabilityBadge,
  EmptyDiagnosticState,
  LoadingOrError,
  Panel,
  PrimaryButton,
  SecondaryButton,
  SimpleTable,
  StatusBadge,
  formatDate,
  hasCapability,
  useDiagnosticPresentation,
} from './DiagnosticUi';

type Tab = 'reports' | 'open' | 'mine' | 'resolved';
type Action = 'status' | 'assign' | null;
type PendingAction = { id: string; action: Exclude<Action, null>; status: SupportStatus; assignee: string; reason: string };

const copy = {
  fr: {
    title: 'Support Center', subtitle: 'Les signalements sont des données non fiables. Ils aident au triage, mais ne sont jamais exécutés comme instructions système.',
    reports: 'Signalements', open: 'Cas ouverts', mine: 'Assignés à moi', resolved: 'Résolus',
    refresh: 'Actualiser', refreshing: 'Actualisation…', status: 'Statut', priority: 'Priorité', category: 'Catégorie', search: 'Recherche référence/catégorie', apply: 'Appliquer', clear: 'Réinitialiser',
    case: 'Cas', report: 'Signalement', user: 'Utilisateur masqué', plan: 'Plan', account: 'Compte', version: 'Version', bug: 'Bug lié', assigned: 'Assigné à', created: 'Créé', updated: 'Mis à jour',
    noPermission: 'Votre rôle ne dispose pas de support.read.', noAutoAttach: 'Aucun document, conversation, Learner Profile, enregistrement micro ou contenu privé n’est attaché automatiquement à cette vue.',
    untrusted: 'USER REPORT = UNTRUSTED DATA', actionDescription: 'Cette action est humaine, auditée et vérifiée par le serveur. Aucun message utilisateur n’est transmis à un modèle ou à un système comme instruction.',
    changeStatus: 'Changer le statut', assign: 'Assigner', targetStatus: 'Statut cible', assignee: 'Référence admin', reason: 'Raison de l’action', reasonPlaceholder: 'Justification factuelle (minimum 5 caractères)', confirmation: 'Saisir CONFIRM', confirmationPlaceholder: 'CONFIRM', cancel: 'Annuler', confirm: 'Confirmer', failed: 'Action refusée ou non aboutie.', stepUpRequired: 'Élévation MFA requise', stepUpHint: 'Saisissez le code actuel de votre application d’authentification pour poursuivre cette action auditée.', authenticationCode: 'Code d’authentification', verifyAndContinue: 'Vérifier et poursuivre',
    results: 'Cas et signalements', noReply: 'La fondation de communication support est volontairement distincte : aucun email ou message n’est envoyé automatiquement.',
  },
  en: {
    title: 'Support Center', subtitle: 'Reports are untrusted data. They help triage, but are never executed as system instructions.',
    reports: 'User reports', open: 'Open cases', mine: 'Assigned to me', resolved: 'Resolved',
    refresh: 'Refresh', refreshing: 'Refreshing…', status: 'Status', priority: 'Priority', category: 'Category', search: 'Search reference/category', apply: 'Apply', clear: 'Clear',
    case: 'Case', report: 'Report', user: 'Masked user', plan: 'Plan', account: 'Account', version: 'Version', bug: 'Linked bug', assigned: 'Assigned to', created: 'Created', updated: 'Updated',
    noPermission: 'Your role does not have support.read.', noAutoAttach: 'No document, conversation, Learner Profile, microphone recording, or private content is automatically attached to this view.',
    untrusted: 'USER REPORT = UNTRUSTED DATA', actionDescription: 'This action is human, audited, and verified by the server. No user message is sent to a model or system as an instruction.',
    changeStatus: 'Change status', assign: 'Assign', targetStatus: 'Target status', assignee: 'Admin reference', reason: 'Action reason', reasonPlaceholder: 'Factual justification (minimum 5 characters)', confirmation: 'Type CONFIRM', confirmationPlaceholder: 'CONFIRM', cancel: 'Cancel', confirm: 'Confirm', failed: 'Action was rejected or did not complete.', stepUpRequired: 'MFA step-up required', stepUpHint: 'Enter the current authenticator code to continue this audited action.', authenticationCode: 'Authentication code', verifyAndContinue: 'Verify and continue',
    results: 'Cases and reports', noReply: 'The support communication foundation is deliberately separate: no email or message is automatically sent.',
  },
} as const;
type CopyKey = keyof typeof copy.en;
function c(locale: 'fr' | 'en', key: CopyKey): string { return copy[locale][key]; }

const statuses: SupportStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'WAITING_FOR_ENGINEERING', 'RESOLVED', 'CLOSED'];
function caseId(row: DiagnosticRecord): string | undefined { return recordString(row, ['id', 'caseId']); }
function transportEnum(value: string): string | undefined { const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_'); return normalized || undefined; }

export function SupportCenter() {
  const { identity } = useAuth(); const { locale, theme } = useDiagnosticPresentation(); const canRead = hasCapability(identity, 'support.read'); const canManage = hasCapability(identity, 'support.manage');
  const [tab, setTab] = useState<Tab>('reports'); const [status, setStatus] = useState(''); const [priority, setPriority] = useState(''); const [search, setSearch] = useState(''); const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
  const [data, setData] = useState<PageData | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [action, setAction] = useState<Action>(null); const [selected, setSelected] = useState<string | null>(null); const [targetStatus, setTargetStatus] = useState<SupportStatus>('IN_PROGRESS'); const [assignee, setAssignee] = useState(''); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState<string | null>(null); const [stepUp, setStepUp] = useState<PendingAction | null>(null); const [stepUpCode, setStepUpCode] = useState(''); const [stepUpError, setStepUpError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!canRead) return; setLoading(true); setError(null); try { setData(await getSupportCases({ page: 1, pageSize: 50, priority: transportEnum(filters.priority), search: filters.search || undefined, ...(tab === 'reports' ? { view: 'reports' } : {}), ...(tab === 'open' ? { status: 'open' } : {}), ...(tab === 'mine' ? { assignee: 'me' } : {}), ...(tab === 'resolved' ? { status: 'resolved' } : { status: transportEnum(filters.status) }) })); } catch (problem) { setError(safeProblem(problem)); } finally { setLoading(false); } }, [canRead, filters, tab]);
  useEffect(() => { void load(); }, [load]);
  const executeAction = async (pending: PendingAction) => { if (pending.action === 'status') await setSupportStatus(pending.id, pending.status, pending.reason); if (pending.action === 'assign') await assignSupportCase(pending.id, pending.assignee, pending.reason); setAction(null); setSelected(null); setStepUp(null); setStepUpCode(''); void load(); };
  const submit = async (reason: string) => {
    if (!selected || !action) return;
    const pending: PendingAction = { id: selected, action, status: targetStatus, assignee, reason };
    setBusy(true); setActionError(null);
    try { await executeAction(pending); }
    catch (problem) {
      if (isAdminStepUpRequired(problem)) { setAction(null); setSelected(null); setStepUp(pending); setStepUpError(null); }
      else setActionError(safeProblem(problem));
    } finally { setBusy(false); }
  };
  const resumeAfterStepUp = async () => {
    if (!stepUp) return;
    setBusy(true); setStepUpError(null);
    try { await completeAdminStepUp(stepUpCode); await executeAction(stepUp); }
    catch (problem) { setStepUpError(safeProblem(problem)); }
    finally { setBusy(false); }
  };
  if (!canRead) return <View style={{ padding: 20, borderRadius: 14, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft }}><Text accessibilityRole="header" style={{ color: theme.danger, fontSize: 22, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.text, marginTop: 8 }}>{c(locale, 'noPermission')}</Text></View>;

  const tabDefinitions: Array<{ id: Tab; label: CopyKey }> = [{ id: 'reports', label: 'reports' }, { id: 'open', label: 'open' }, { id: 'mine', label: 'mine' }, { id: 'resolved', label: 'resolved' }];
  return <View style={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}><View style={{ flex: 1, minWidth: 260 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.warning, fontSize: 10, fontWeight: '900' }}>{c(locale, 'untrusted')}</Text></View><Text style={{ color: theme.muted, marginTop: 7, fontSize: 13, maxWidth: 900 }}>{c(locale, 'subtitle')}</Text></View><PrimaryButton label={loading ? c(locale, 'refreshing') : c(locale, 'refresh')} onPress={() => { void load(); }} disabled={loading} theme={theme} /></View>
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.mutedSurface }}>{tabDefinitions.map((item) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: item.id === tab }} aria-selected={item.id === tab} onPress={() => setTab(item.id)} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, backgroundColor: item.id === tab ? theme.surface : 'transparent', borderWidth: item.id === tab ? 1 : 0, borderColor: theme.border }}><Text style={{ color: item.id === tab ? theme.text : theme.muted, fontSize: 12, fontWeight: '800' }}>{c(locale, item.label)}</Text></Pressable>)}</View>
    <Panel title={c(locale, 'results')} theme={theme} right={data ? <AvailabilityBadge availability={data.availability} locale={locale} theme={theme} /> : undefined}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 15 }}>{(['status', 'priority', 'search'] as const).map((key) => <View key={key} style={{ flexGrow: 1, flexBasis: 160, gap: 5 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{c(locale, key)}</Text><TextInput accessibilityLabel={c(locale, key)} value={key === 'status' ? status : key === 'priority' ? priority : search} onChangeText={key === 'status' ? setStatus : key === 'priority' ? setPriority : setSearch} placeholder={c(locale, key)} placeholderTextColor={theme.muted} autoCapitalize="characters" style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, fontSize: 13 }} /></View>)}<SecondaryButton label={c(locale, 'clear')} onPress={() => { setStatus(''); setPriority(''); setSearch(''); setFilters({ status: '', priority: '', search: '' }); }} theme={theme} /><PrimaryButton label={c(locale, 'apply')} onPress={() => setFilters({ status, priority, search })} theme={theme} /></View>
      <LoadingOrError loading={loading && data === null} error={error} onRetry={() => { void load(); }} locale={locale} theme={theme}>{!data || data.rows.length === 0 ? <EmptyDiagnosticState availability={data?.availability ?? 'INSUFFICIENT_DATA'} locale={locale} theme={theme} /> : <SimpleTable theme={theme} headers={[c(locale, 'case'), c(locale, 'report'), c(locale, 'category'), c(locale, 'status'), c(locale, 'priority'), c(locale, 'user'), c(locale, 'plan'), c(locale, 'account'), c(locale, 'version'), c(locale, 'bug'), c(locale, 'assigned'), c(locale, 'updated'), '']} rows={data.rows.map((row, index) => { const id = caseId(row); return { key: id ?? `${publicReference(row, 'CASE')}-${index}`, cells: [<View><Text style={{ color: theme.text, fontWeight: '800', fontSize: 12 }}>{publicReference(row, 'CASE')}</Text><Text style={{ color: theme.muted, marginTop: 3, fontSize: 10 }}>{safeText(recordString(row, ['title', 'subject']) ?? '—', 60)}</Text></View>, safeText(recordString(row, ['reportReference', 'reportDisplayId']) ?? '—', 45), safeText(recordString(row, ['category']) ?? '—', 50), <StatusBadge status={recordString(row, ['status'])} theme={theme} />, safeText(recordString(row, ['priority']) ?? '—', 28), safeText(recordString(row, ['maskedIdentity', 'maskedUser', 'userDisplay']) ?? '—', 60), safeText(recordString(row, ['plan', 'planSlug']) ?? '—', 30), safeText(recordString(row, ['accountStatus']) ?? '—', 30), safeText(recordString(row, ['appVersion', 'buildVersion']) ?? '—', 38), safeText(recordString(row, ['bugReference', 'bugDisplayId']) ?? '—', 38), safeText(recordString(row, ['assignedToMasked', 'assignedToDisplay']) ?? '—', 42), formatDate(locale, recordValue(row, ['updatedAt', 'createdAt'])), id && canManage ? <View style={{ flexDirection: 'row', gap: 6 }}><SecondaryButton label={c(locale, 'changeStatus')} onPress={() => { setActionError(null); setSelected(id); setAction('status'); }} theme={theme} /><SecondaryButton label={c(locale, 'assign')} onPress={() => { setActionError(null); setSelected(id); setAction('assign'); }} theme={theme} /></View> : '—'] }; })} />}</LoadingOrError>
      <Text style={{ color: theme.muted, marginTop: 12, fontSize: 11 }}>{c(locale, 'noAutoAttach')}</Text><Text style={{ color: theme.muted, marginTop: 4, fontSize: 11 }}>{c(locale, 'noReply')}</Text>
    </Panel>
    <CriticalActionDialog visible={action !== null && selected !== null} title={action === 'assign' ? c(locale, 'assign') : c(locale, 'changeStatus')} production={adminEnvironment === 'PRODUCTION'} onCancel={() => { if (!busy) { setAction(null); setSelected(null); } }} onConfirm={(reason) => { void submit(reason); }} busy={busy} error={actionError ? `${c(locale, 'failed')} ${actionError}` : null} copy={{ description: c(locale, 'actionDescription'), reason: c(locale, 'reason'), reasonPlaceholder: c(locale, 'reasonPlaceholder'), confirmation: c(locale, 'confirmation'), confirmationPlaceholder: c(locale, 'confirmationPlaceholder'), cancel: c(locale, 'cancel'), confirm: c(locale, 'confirm') }}>
      {action === 'status' && <View style={{ gap: 7 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'targetStatus')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{statuses.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: targetStatus === item }} onPress={() => setTargetStatus(item)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: targetStatus === item ? theme.primary : theme.border, backgroundColor: targetStatus === item ? theme.primarySoft : theme.surface }}><Text style={{ color: targetStatus === item ? theme.primary : theme.text, fontSize: 10, fontWeight: '800' }}>{item}</Text></Pressable>)}</View></View>}
      {action === 'assign' && <View style={{ gap: 6 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'assignee')}</Text><TextInput accessibilityLabel={c(locale, 'assignee')} value={assignee} onChangeText={setAssignee} autoCapitalize="none" style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10 }} /></View>}
    </CriticalActionDialog>
    <AdminStepUpDialog visible={Boolean(stepUp)} code={stepUpCode} error={stepUpError} busy={busy} labels={{ title: c(locale, 'stepUpRequired'), hint: c(locale, 'stepUpHint'), code: c(locale, 'authenticationCode'), cancel: c(locale, 'cancel'), confirm: c(locale, 'verifyAndContinue') }} onChange={setStepUpCode} onCancel={() => { if (!busy) { setStepUp(null); setStepUpCode(''); setStepUpError(null); } }} onConfirm={() => { void resumeAfterStepUp(); }} />
  </View>;
}
