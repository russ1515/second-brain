import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth';
import { adminEnvironment } from '../lib/api';
import {
  assignBug,
  diagnoseBug,
  getBug,
  getBugDiagnostics,
  getBugEvents,
  getBugUsers,
  markBugDuplicate,
  publicReference,
  recordNumber,
  recordString,
  recordTextList,
  recordValue,
  safeProblem,
  safeText,
  setBugStatus,
  triageBug,
  type BugStatus,
  type DiagnosticRecord,
  type PageData,
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
  SeverityBadge,
  SimpleTable,
  StatusBadge,
  formatDate,
  formatNumber,
  hasCapability,
  useDiagnosticPresentation,
} from './DiagnosticUi';

type ActionKind = 'triage' | 'status' | 'assign' | 'duplicate' | 'diagnose' | null;
type PendingAction = {
  kind: Exclude<ActionKind, null>;
  reason: string;
  targetStatus: BugStatus;
  assignee: string;
  duplicateOf: string;
  fixReference: string;
  targetRelease: string;
};

const copy = {
  fr: {
    back: 'Retour aux bugs', summary: 'Résumé', impact: 'Impact', timeline: 'Chronologie', occurrences: 'Occurrences', affectedUsers: 'Utilisateurs affectés', technical: 'Contexte technique', providers: 'Providers & versions', diagnostics: 'Diagnostic assisté', related: 'Liens & résolution', audit: 'Historique auditable',
    title: 'Bug', evidenceFirst: 'EVIDENCE FIRST', observedOnly: 'Seuls les faits observés et les corrélations justifiées sont affichés. CONFIRMED exige une preuve technique suffisante.',
    severity: 'Sévérité', status: 'Statut', feature: 'Fonction', environment: 'Environnement', firstSeen: 'Premier signal', lastSeen: 'Dernier signal', occurrencesCount: 'Occurrences', affectedCount: 'Utilisateurs affectés',
    source: 'Source', route: 'Route', provider: 'Provider', model: 'Modèle', version: 'Version', platform: 'Plateforme', quota: 'État quota', httpStatus: 'HTTP', latency: 'Latence', retries: 'Retries',
    timestamp: 'Horodatage', request: 'Request ID', user: 'Utilisateur masqué', incident: 'Incident', reports: 'Signalements', fix: 'Référence de correction',
    triage: 'Trier', changeStatus: 'Changer le statut', assign: 'Assigner', duplicate: 'Marquer doublon', analyze: 'Diagnostic déterministe', refresh: 'Actualiser',
    noPermission: 'Votre rôle ne peut pas effectuer cette action.', sensitiveHidden: 'Les détails techniques sensibles restent masqués sans error_events.sensitive.',
    observed: 'OBSERVED', correlated: 'CORRELATED', hypothesis: 'HYPOTHESIS', confidence: 'CONFIDENCE', evidence: 'EVIDENCE', nextChecks: 'NEXT CHECKS',
    noDiagnostics: 'Aucun diagnostic vérifiable. Un diagnostic manuel ne sera jamais déclenché automatiquement.',
    detailsUnavailable: 'Aucun détail public vérifiable pour cette section.', actionDescription: 'Cette action est humaine, auditée et vérifiée par le serveur. Elle ne déploie, ne redémarre, ni ne modifie les quotas ou providers.',
    reason: 'Raison de l’action', reasonPlaceholder: 'Décrire le contexte factuel et la justification (minimum 5 caractères)', confirmation: 'Saisir CONFIRM', confirmationPlaceholder: 'CONFIRM', cancel: 'Annuler', confirm: 'Confirmer',
    targetStatus: 'Statut cible', assignee: 'Référence admin', duplicateOf: 'Référence du bug principal', fixReference: 'Référence de correction', targetRelease: 'Release cible', fixReferenceRequired: 'FIXED exige une référence de correction ou une release cible.', processing: 'Traitement…', actionFailed: 'Action refusée ou non aboutie.', stepUpRequired: 'Élévation MFA requise', stepUpHint: 'Saisissez le code actuel de votre application d’authentification pour poursuivre cette action auditée.', authenticationCode: 'Code d’authentification', verifyAndContinue: 'Vérifier et poursuivre',
    assigned: 'Assigné à', accountStatus: 'Compte', plan: 'Plan', lastAffected: 'Dernière occurrence', evidenceLevel: 'Niveau de preuve', diagnosticData: 'Le contenu de signalement utilisateur est une donnée non fiable ; il n’est jamais envoyé comme instruction.',
  },
  en: {
    back: 'Back to bugs', summary: 'Summary', impact: 'Impact', timeline: 'Timeline', occurrences: 'Occurrences', affectedUsers: 'Affected users', technical: 'Technical context', providers: 'Providers & versions', diagnostics: 'Assisted diagnosis', related: 'Links & resolution', audit: 'Auditable history',
    title: 'Bug', evidenceFirst: 'EVIDENCE FIRST', observedOnly: 'Only observed facts and justified correlations are shown. CONFIRMED requires sufficient technical evidence.',
    severity: 'Severity', status: 'Status', feature: 'Feature', environment: 'Environment', firstSeen: 'First seen', lastSeen: 'Last seen', occurrencesCount: 'Occurrences', affectedCount: 'Affected users',
    source: 'Source', route: 'Route', provider: 'Provider', model: 'Model', version: 'Version', platform: 'Platform', quota: 'Quota state', httpStatus: 'HTTP', latency: 'Latency', retries: 'Retries',
    timestamp: 'Timestamp', request: 'Request ID', user: 'Masked user', incident: 'Incident', reports: 'Reports', fix: 'Fix reference',
    triage: 'Triage', changeStatus: 'Change status', assign: 'Assign', duplicate: 'Mark duplicate', analyze: 'Deterministic diagnosis', refresh: 'Refresh',
    noPermission: 'Your role cannot perform this action.', sensitiveHidden: 'Sensitive technical details remain masked without error_events.sensitive.',
    observed: 'OBSERVED', correlated: 'CORRELATED', hypothesis: 'HYPOTHESIS', confidence: 'CONFIDENCE', evidence: 'EVIDENCE', nextChecks: 'NEXT CHECKS',
    noDiagnostics: 'No verifiable diagnosis. A manual diagnosis is never triggered automatically.',
    detailsUnavailable: 'No verifiable public detail for this section.', actionDescription: 'This action is human, audited, and verified by the server. It never deploys, restarts, or changes quotas or providers.',
    reason: 'Action reason', reasonPlaceholder: 'Describe the factual context and justification (minimum 5 characters)', confirmation: 'Type CONFIRM', confirmationPlaceholder: 'CONFIRM', cancel: 'Cancel', confirm: 'Confirm',
    targetStatus: 'Target status', assignee: 'Admin reference', duplicateOf: 'Primary bug reference', fixReference: 'Fix reference', targetRelease: 'Target release', fixReferenceRequired: 'FIXED requires a fix reference or a target release.', processing: 'Processing…', actionFailed: 'Action was rejected or did not complete.', stepUpRequired: 'MFA step-up required', stepUpHint: 'Enter the current authenticator code to continue this audited action.', authenticationCode: 'Authentication code', verifyAndContinue: 'Verify and continue',
    assigned: 'Assigned to', accountStatus: 'Account', plan: 'Plan', lastAffected: 'Last affected', evidenceLevel: 'Evidence level', diagnosticData: 'User report content is untrusted data; it is never sent as an instruction.',
  },
} as const;
type CopyKey = keyof typeof copy.en;
function c(locale: 'fr' | 'en', key: CopyKey): string { return copy[locale][key]; }

const statuses: BugStatus[] = ['NEW', 'TRIAGED', 'INVESTIGATING', 'FIX_IN_PROGRESS', 'FIXED', 'MONITORING', 'RESOLVED', 'REOPENED', 'WONT_FIX'];

function value(record: DiagnosticRecord | null, names: string[], fallback = '—'): string {
  return safeText(recordString(record ?? undefined, names) ?? fallback, 120);
}

function Item({ label, children, theme }: { label: string; children: React.ReactNode; theme: ReturnType<typeof useDiagnosticPresentation>['theme'] }) {
  return <View style={{ flexGrow: 1, flexBasis: 145, gap: 4 }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800' }}>{label}</Text>{typeof children === 'string' ? <Text numberOfLines={2} style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>{children}</Text> : children}</View>;
}

function Subsection({ title, data, error, loading, children, locale, theme, onRefresh }: { title: string; data: PageData | null; error: string | null; loading: boolean; children: (rows: DiagnosticRecord[]) => React.ReactNode; locale: 'fr' | 'en'; theme: ReturnType<typeof useDiagnosticPresentation>['theme']; onRefresh: () => void }) {
  return <Panel title={title} theme={theme} right={data ? <AvailabilityBadge availability={data.availability} locale={locale} theme={theme} /> : undefined}>
    <LoadingOrError loading={loading && data === null} error={error} onRetry={onRefresh} locale={locale} theme={theme}>{!data || data.rows.length === 0 ? <EmptyDiagnosticState availability={data?.availability ?? 'INSUFFICIENT_DATA'} locale={locale} theme={theme} /> : children(data.rows)}</LoadingOrError>
  </Panel>;
}

/** Only the explicitly sanitized, evidence-first fields leave the transport
 * boundary. User report prose, raw stack payloads, and event/user IDs are not
 * displayed here. */
function DiagnosticEvidence({ rows, locale, theme }: { rows: DiagnosticRecord[]; locale: 'fr' | 'en'; theme: ReturnType<typeof useDiagnosticPresentation>['theme'] }) {
  const sections: Array<[CopyKey, string[]]> = [
    ['observed', rows.flatMap((row) => recordTextList(row, ['observed']))],
    ['correlated', rows.flatMap((row) => recordTextList(row, ['correlated']))],
    ['hypothesis', rows.flatMap((row) => recordTextList(row, ['hypotheses']))],
    ['evidence', rows.flatMap((row) => recordTextList(row, ['evidence']))],
    ['nextChecks', rows.flatMap((row) => recordTextList(row, ['nextChecks']))],
  ];
  if (!sections.some(([, values]) => values.length)) return null;
  return <Panel title={c(locale, 'diagnostics')} theme={theme}><View style={{ gap: 14 }}>{sections.map(([label, values]) => <View key={label} style={{ gap: 6 }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '900', letterSpacing: .35 }}>{c(locale, label)}</Text>{values.length === 0 ? <Text style={{ color: theme.muted, fontSize: 12 }}>—</Text> : values.slice(0, 12).map((entry, index) => <View key={`${label}-${index}`} style={{ flexDirection: 'row', gap: 7 }}><Text aria-hidden style={{ color: theme.primary, fontSize: 12 }}>•</Text><Text style={{ flex: 1, color: theme.text, fontSize: 12 }}>{entry}</Text></View>)}</View>)}</View></Panel>;
}

export function BugDetail({ bugId }: { bugId: string }) {
  const { identity } = useAuth(); const router = useRouter(); const { locale, theme } = useDiagnosticPresentation();
  const canRead = hasCapability(identity, 'bugs.read'); const canManage = hasCapability(identity, 'bugs.manage'); const canDiagnose = hasCapability(identity, 'bugs.diagnose') || hasCapability(identity, 'diagnostics.run'); const canSensitive = hasCapability(identity, 'error_events.sensitive');
  const [bug, setBug] = useState<DiagnosticRecord | null>(null); const [events, setEvents] = useState<PageData | null>(null); const [users, setUsers] = useState<PageData | null>(null); const [diagnostics, setDiagnostics] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true); const [eventsLoading, setEventsLoading] = useState(true); const [usersLoading, setUsersLoading] = useState(true); const [diagnosticsLoading, setDiagnosticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const [eventsError, setEventsError] = useState<string | null>(null); const [usersError, setUsersError] = useState<string | null>(null); const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionKind>(null); const [actionBusy, setActionBusy] = useState(false); const [actionError, setActionError] = useState<string | null>(null); const [targetStatus, setTargetStatus] = useState<BugStatus>('TRIAGED'); const [assignee, setAssignee] = useState(''); const [duplicateOf, setDuplicateOf] = useState(''); const [fixReference, setFixReference] = useState(''); const [targetRelease, setTargetRelease] = useState(''); const [stepUp, setStepUp] = useState<PendingAction | null>(null); const [stepUpCode, setStepUpCode] = useState(''); const [stepUpError, setStepUpError] = useState<string | null>(null);

  const loadBug = useCallback(async () => {
    if (!canRead) return;
    setLoading(true); setError(null);
    try { setBug(await getBug(bugId)); } catch (problem) { setError(safeProblem(problem)); }
    finally { setLoading(false); }
  }, [bugId, canRead]);
  const loadEvents = useCallback(async () => { if (!canRead) return; setEventsLoading(true); setEventsError(null); try { setEvents(await getBugEvents(bugId, { page: 1, pageSize: 25 })); } catch (problem) { setEventsError(safeProblem(problem)); } finally { setEventsLoading(false); } }, [bugId, canRead]);
  const loadUsers = useCallback(async () => { if (!canRead) return; setUsersLoading(true); setUsersError(null); try { setUsers(await getBugUsers(bugId, { page: 1, pageSize: 25 })); } catch (problem) { setUsersError(safeProblem(problem)); } finally { setUsersLoading(false); } }, [bugId, canRead]);
  const loadDiagnostics = useCallback(async () => { if (!canRead) return; setDiagnosticsLoading(true); setDiagnosticsError(null); try { setDiagnostics(await getBugDiagnostics(bugId)); } catch (problem) { setDiagnosticsError(safeProblem(problem)); } finally { setDiagnosticsLoading(false); } }, [bugId, canRead]);
  const loadAll = useCallback(() => { void loadBug(); void loadEvents(); void loadUsers(); void loadDiagnostics(); }, [loadBug, loadEvents, loadUsers, loadDiagnostics]);
  useEffect(() => { loadAll(); }, [loadAll]);

  const executeAction = async (pending: PendingAction) => {
    if (pending.kind === 'triage') await triageBug(bugId, pending.reason);
    if (pending.kind === 'status') await setBugStatus(bugId, pending.targetStatus, pending.reason, { fixReference: pending.fixReference, targetRelease: pending.targetRelease });
    if (pending.kind === 'assign') await assignBug(bugId, pending.assignee, pending.reason);
    if (pending.kind === 'duplicate') await markBugDuplicate(bugId, pending.duplicateOf, pending.reason);
    if (pending.kind === 'diagnose') await diagnoseBug(bugId, pending.reason);
    setAction(null); setStepUp(null); setStepUpCode(''); loadAll();
  };
  const runAction = async (reason: string) => {
    if (!action) return;
    if (action === 'status' && targetStatus === 'FIXED' && !fixReference.trim() && !targetRelease.trim()) { setActionError(c(locale, 'fixReferenceRequired')); return; }
    const pending: PendingAction = { kind: action, reason, targetStatus, assignee, duplicateOf, fixReference, targetRelease };
    setActionBusy(true); setActionError(null);
    try { await executeAction(pending); }
    catch (problem) {
      if (isAdminStepUpRequired(problem)) { setAction(null); setStepUp(pending); setStepUpError(null); }
      else setActionError(safeProblem(problem));
    } finally { setActionBusy(false); }
  };
  const resumeAfterStepUp = async () => {
    if (!stepUp) return;
    setActionBusy(true); setStepUpError(null);
    try { await completeAdminStepUp(stepUpCode); await executeAction(stepUp); }
    catch (problem) { setStepUpError(safeProblem(problem)); }
    finally { setActionBusy(false); }
  };

  if (!canRead) return <View style={{ padding: 20, borderRadius: 14, borderWidth: 1, borderColor: theme.danger, backgroundColor: theme.dangerSoft }}><Text accessibilityRole="header" style={{ color: theme.danger, fontSize: 22, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.text, marginTop: 8 }}>{c(locale, 'noPermission')}</Text></View>;

  const dialogTitle = action === 'triage' ? c(locale, 'triage') : action === 'status' ? c(locale, 'changeStatus') : action === 'assign' ? c(locale, 'assign') : action === 'duplicate' ? c(locale, 'duplicate') : c(locale, 'analyze');
  return <View style={{ gap: 16, paddingBottom: 28 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, minWidth: 250 }}><Pressable accessibilityRole="button" accessibilityLabel={c(locale, 'back')} onPress={() => router.replace('/bugs' as never)}><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '800' }}>← {c(locale, 'back')}</Text></Pressable><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 9 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 26, fontWeight: '800' }}>{value(bug, ['title', 'summary', 'errorCode', 'fingerprint'])}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{publicReference(bug ?? undefined)}</Text></View><Text style={{ color: theme.muted, marginTop: 6, fontSize: 12, maxWidth: 900 }}>{c(locale, 'observedOnly')}</Text></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><PrimaryButton label={c(locale, 'refresh')} onPress={loadAll} theme={theme} disabled={loading} />{canManage && <SecondaryButton label={c(locale, 'triage')} onPress={() => { setActionError(null); setAction('triage'); }} theme={theme} />}{canManage && <SecondaryButton label={c(locale, 'changeStatus')} onPress={() => { setActionError(null); setAction('status'); }} theme={theme} />}{canDiagnose && <PrimaryButton label={c(locale, 'analyze')} onPress={() => { setActionError(null); setAction('diagnose'); }} theme={theme} accessibilityHint={c(locale, 'diagnosticData')} />}</View></View>

    <Panel title={c(locale, 'summary')} theme={theme} right={bug ? <StatusBadge status={recordString(bug, ['status'])} theme={theme} /> : undefined}>
      <LoadingOrError loading={loading} error={error} onRetry={() => { void loadBug(); }} locale={locale} theme={theme}>{!bug ? <EmptyDiagnosticState availability="INSUFFICIENT_DATA" locale={locale} theme={theme} /> : <View style={{ gap: 15 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Item label={c(locale, 'severity')} theme={theme}><SeverityBadge severity={recordString(bug, ['severity', 'level'])} locale={locale} theme={theme} /></Item><Item label={c(locale, 'status')} theme={theme}><StatusBadge status={recordString(bug, ['status'])} theme={theme} /></Item><Item label={c(locale, 'feature')} theme={theme}>{value(bug, ['feature', 'featureKey'])}</Item><Item label={c(locale, 'environment')} theme={theme}>{value(bug, ['environment'])}</Item><Item label={c(locale, 'firstSeen')} theme={theme}>{formatDate(locale, recordValue(bug, ['firstSeen', 'firstOccurredAt', 'createdAt']))}</Item><Item label={c(locale, 'lastSeen')} theme={theme}>{formatDate(locale, recordValue(bug, ['lastSeen', 'lastOccurredAt', 'updatedAt']))}</Item><Item label={c(locale, 'occurrencesCount')} theme={theme}>{formatNumber(locale, recordNumber(bug, ['occurrenceCount', 'occurrences', 'count']))}</Item><Item label={c(locale, 'affectedCount')} theme={theme}>{formatNumber(locale, recordNumber(bug, ['affectedUsersCount', 'affectedUsers']))}</Item></View><Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'sensitiveHidden')}</Text></View>}</LoadingOrError>
    </Panel>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <Panel title={c(locale, 'impact')} theme={theme}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Item label={c(locale, 'affectedCount')} theme={theme}>{formatNumber(locale, recordNumber(bug ?? undefined, ['affectedUsersCount', 'affectedUsers']))}</Item><Item label={c(locale, 'occurrencesCount')} theme={theme}>{formatNumber(locale, recordNumber(bug ?? undefined, ['occurrenceCount', 'occurrences']))}</Item><Item label={c(locale, 'version')} theme={theme}>{value(bug, ['affectedVersions', 'appVersion', 'buildVersion'])}</Item><Item label={c(locale, 'platform')} theme={theme}>{value(bug, ['affectedPlatforms', 'platform'])}</Item><Item label={c(locale, 'feature')} theme={theme}>{value(bug, ['feature', 'featureKey'])}</Item></View></Panel>
      <Panel title={c(locale, 'technical')} theme={theme}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Item label={c(locale, 'source')} theme={theme}>{value(bug, ['source'])}</Item><Item label={c(locale, 'route')} theme={theme}>{value(bug, ['route'])}</Item><Item label={c(locale, 'provider')} theme={theme}>{value(bug, ['provider'])}</Item><Item label={c(locale, 'model')} theme={theme}>{value(bug, ['model'])}</Item><Item label={c(locale, 'quota')} theme={theme}>{value(bug, ['quotaState'])}</Item><Item label={c(locale, 'version')} theme={theme}>{value(bug, ['appVersion', 'buildVersion'])}</Item></View><Text style={{ color: canSensitive ? theme.muted : theme.warning, marginTop: 12, fontSize: 11 }}>{canSensitive ? c(locale, 'sensitiveHidden') : c(locale, 'sensitiveHidden')}</Text></Panel>
    </View>

    <Subsection title={c(locale, 'occurrences')} data={events} error={eventsError} loading={eventsLoading} onRefresh={() => { void loadEvents(); }} locale={locale} theme={theme}>{(rows) => <SimpleTable theme={theme} headers={[c(locale, 'timestamp'), c(locale, 'request'), c(locale, 'user'), c(locale, 'route'), c(locale, 'platform'), c(locale, 'version'), c(locale, 'provider'), c(locale, 'httpStatus')]} rows={rows.map((row, index) => ({ key: publicReference(row, 'REPORT') + index, cells: [formatDate(locale, recordValue(row, ['timestamp', 'occurredAt', 'createdAt'])), safeText(recordString(row, ['requestId', 'requestReference']) ?? '—', 70), safeText(recordString(row, ['maskedIdentity', 'maskedUser', 'user']) ?? '—', 64), safeText(recordString(row, ['route']) ?? '—', 80), safeText(recordString(row, ['platform']) ?? '—', 38), safeText(recordString(row, ['appVersion', 'buildVersion']) ?? '—', 45), safeText(recordString(row, ['provider']) ?? '—', 45), formatNumber(locale, recordNumber(row, ['httpStatus', 'statusCode']))] }))} />}</Subsection>

    <Subsection title={c(locale, 'affectedUsers')} data={users} error={usersError} loading={usersLoading} onRefresh={() => { void loadUsers(); }} locale={locale} theme={theme}>{(rows) => <SimpleTable theme={theme} headers={[c(locale, 'user'), c(locale, 'plan'), c(locale, 'accountStatus'), c(locale, 'occurrencesCount'), c(locale, 'lastAffected')]} rows={rows.map((row, index) => ({ key: `affected-${index}`, cells: [safeText(recordString(row, ['maskedIdentity', 'maskedUser', 'userDisplay', 'identity']) ?? '—', 64), safeText(recordString(row, ['plan', 'planSlug']) ?? '—', 35), safeText(recordString(row, ['accountStatus', 'status']) ?? '—', 35), formatNumber(locale, recordNumber(row, ['occurrenceCount', 'occurrences', 'count'])), formatDate(locale, recordValue(row, ['lastAffectedAt', 'lastSeen', 'updatedAt']))] }))} />}</Subsection>

    <Subsection title={c(locale, 'diagnostics')} data={diagnostics} error={diagnosticsError} loading={diagnosticsLoading} onRefresh={() => { void loadDiagnostics(); }} locale={locale} theme={theme}>{(rows) => <View style={{ gap: 11 }}><Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'diagnosticData')}</Text>{rows.map((row, index) => <View key={`diagnostic-${index}`} style={{ padding: 12, borderRadius: 9, backgroundColor: theme.mutedSurface, gap: 6 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><StatusBadge status={recordString(row, ['evidenceLevel', 'classification', 'status'])} theme={theme} /><Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{safeText(recordString(row, ['title', 'kind', 'type']) ?? c(locale, 'noDiagnostics'), 120)}</Text></View><Text style={{ color: theme.muted, fontSize: 12 }}>{safeText(recordString(row, ['summary', 'hypothesisSanitized', 'statement']) ?? '—', 240)}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Item label={c(locale, 'confidence')} theme={theme}>{safeText(recordString(row, ['confidence']) ?? 'UNCONFIRMED', 20)}</Item><Item label={c(locale, 'evidence')} theme={theme}>{safeText(recordString(row, ['evidenceReference', 'evidenceSummary']) ?? '—', 100)}</Item><Item label={c(locale, 'nextChecks')} theme={theme}>{safeText(recordString(row, ['nextChecks', 'suggestedCheck']) ?? '—', 120)}</Item></View></View>)}</View>}</Subsection>
    {diagnostics?.rows.length ? <DiagnosticEvidence rows={diagnostics.rows} locale={locale} theme={theme} /> : null}

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><Panel title={c(locale, 'related')} theme={theme}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}><Item label={c(locale, 'incident')} theme={theme}>{value(bug, ['incidentReference', 'incidentTitle', 'incidentId'])}</Item><Item label={c(locale, 'reports')} theme={theme}>{formatNumber(locale, recordNumber(bug ?? undefined, ['relatedReportsCount', 'reportsCount']))}</Item><Item label={c(locale, 'fix')} theme={theme}>{value(bug, ['fixReference', 'targetRelease', 'releaseVersion'])}</Item><Item label={c(locale, 'assigned')} theme={theme}>{value(bug, ['assignedToMasked', 'assignedToDisplay'])}</Item></View></Panel><Panel title={c(locale, 'audit')} theme={theme}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'detailsUnavailable')}</Text><Text style={{ color: theme.muted, fontSize: 11, marginTop: 7 }}>{c(locale, 'actionDescription')}</Text></Panel></View>

    {canManage && <Panel title={c(locale, 'title')} theme={theme}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><SecondaryButton label={c(locale, 'assign')} onPress={() => { setActionError(null); setAction('assign'); }} theme={theme} /><SecondaryButton label={c(locale, 'duplicate')} onPress={() => { setActionError(null); setAction('duplicate'); }} theme={theme} /></View></Panel>}

    <CriticalActionDialog visible={action !== null} title={dialogTitle} production={adminEnvironment === 'PRODUCTION'} onCancel={() => { if (!actionBusy) setAction(null); }} onConfirm={(reason) => { void runAction(reason); }} busy={actionBusy} error={actionError ? `${c(locale, 'actionFailed')} ${actionError}` : null} copy={{ description: c(locale, 'actionDescription'), reason: c(locale, 'reason'), reasonPlaceholder: c(locale, 'reasonPlaceholder'), confirmation: c(locale, 'confirmation'), confirmationPlaceholder: c(locale, 'confirmationPlaceholder'), cancel: c(locale, 'cancel'), confirm: c(locale, 'confirm') }}>
      {action === 'status' && <View style={{ gap: 7 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'targetStatus')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{statuses.map((status) => <Pressable key={status} accessibilityRole="button" accessibilityState={{ selected: targetStatus === status }} onPress={() => setTargetStatus(status)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: targetStatus === status ? theme.primary : theme.border, backgroundColor: targetStatus === status ? theme.primarySoft : theme.surface }}><Text style={{ color: targetStatus === status ? theme.primary : theme.text, fontSize: 10, fontWeight: '800' }}>{status}</Text></Pressable>)}</View></View>}
      {action === 'status' && targetStatus === 'FIXED' && <View style={{ gap: 7 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'fixReferenceRequired')}</Text><TextInput accessibilityLabel={c(locale, 'fixReference')} value={fixReference} onChangeText={setFixReference} autoCapitalize="none" placeholder={c(locale, 'fixReference')} placeholderTextColor={theme.muted} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10 }} /><TextInput accessibilityLabel={c(locale, 'targetRelease')} value={targetRelease} onChangeText={setTargetRelease} autoCapitalize="none" placeholder={c(locale, 'targetRelease')} placeholderTextColor={theme.muted} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10 }} /></View>}
      {action === 'assign' && <View style={{ gap: 6 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'assignee')}</Text><TextInput accessibilityLabel={c(locale, 'assignee')} value={assignee} onChangeText={setAssignee} autoCapitalize="none" style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10 }} /></View>}
      {action === 'duplicate' && <View style={{ gap: 6 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{c(locale, 'duplicateOf')}</Text><TextInput accessibilityLabel={c(locale, 'duplicateOf')} value={duplicateOf} onChangeText={setDuplicateOf} autoCapitalize="characters" style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10 }} /></View>}
    </CriticalActionDialog>
    <AdminStepUpDialog visible={Boolean(stepUp)} code={stepUpCode} error={stepUpError} busy={actionBusy} labels={{ title: c(locale, 'stepUpRequired'), hint: c(locale, 'stepUpHint'), code: c(locale, 'authenticationCode'), cancel: c(locale, 'cancel'), confirm: c(locale, 'verifyAndContinue') }} onChange={setStepUpCode} onCancel={() => { if (!actionBusy) { setStepUp(null); setStepUpCode(''); setStepUpError(null); } }} onConfirm={() => { void resumeAfterStepUp(); }} />
  </View>;
}
