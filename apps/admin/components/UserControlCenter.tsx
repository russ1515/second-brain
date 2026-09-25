import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CriticalActionDialog, type CriticalActionDialogCopy } from './CriticalActionDialog';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import { type ApiProblem } from '../lib/api';
import {
  completeAdminStepUp,
  createAdminSupportNote,
  getAdminUser,
  getAdminUserSection,
  mutateAdminUser,
  nestedRecord,
  recordNumber,
  recordRows,
  recordString,
  recordValue,
  requestAdminUserLearnerProfileAccess,
  sectionRecord,
  type AdminSection,
  type UnknownRecord,
  type UserAction,
  type UserSectionName,
} from '../lib/users';
import { u, userStatusLabel, type UserCopyKey } from '../lib/user-i18n';

type Theme = { surface: string; mutedSurface: string; border: string; text: string; muted: string; primary: string; primarySoft: string; danger: string; dangerSoft: string; warning: string; warningSoft: string; success: string; successSoft: string };
type TabKey = 'overview' | 'account' | 'profile' | 'subscription' | 'quotas' | 'usage' | 'payments' | 'security' | 'activity' | 'support';
type Sections = Record<UserSectionName, AdminSection>;

const sectionNames: UserSectionName[] = ['subscription', 'quotas', 'usage', 'payments', 'sessions', 'security', 'audit', 'activity', 'reports', 'learner-profile', 'support-notes'];
const tabDefinitions: { id: TabKey; label: UserCopyKey }[] = [
  { id: 'overview', label: 'overview' }, { id: 'account', label: 'account' }, { id: 'profile', label: 'learnerProfile' }, { id: 'subscription', label: 'subscriptionPanel' }, { id: 'quotas', label: 'quotas' }, { id: 'usage', label: 'usage' }, { id: 'payments', label: 'payments' }, { id: 'security', label: 'security' }, { id: 'activity', label: 'activity' }, { id: 'support', label: 'supportAudit' },
];
const emptySection = (): AdminSection => ({ state: 'loading' });

function initialSections(): Sections {
  return Object.fromEntries(sectionNames.map((name) => [name, emptySection()])) as Sections;
}

function themeFor(dark: boolean): Theme {
  return dark
    ? { surface: '#111827', mutedSurface: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', danger: '#f87171', dangerSoft: '#450a0a', warning: '#fbbf24', warningSoft: '#422006', success: '#34d399', successSoft: '#052e2b' }
    : { surface: '#fff', mutedSurface: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#64748b', primary: '#2563eb', primarySoft: '#dbeafe', danger: '#dc2626', dangerSoft: '#fee2e2', warning: '#b45309', warningSoft: '#fef3c7', success: '#047857', successSoft: '#d1fae5' };
}

function capability(identity: { roles: string[]; capabilities: string[] } | null, required: string): boolean {
  return identity?.roles.includes('SUPER_ADMIN') === true || identity?.capabilities.includes(required) === true;
}

function formatDate(locale: 'fr' | 'en', value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatNumber(locale: 'fr' | 'en', value: unknown, percent = false): string {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
  if (number === undefined) return '—';
  const display = percent && number <= 1 ? number * 100 : number;
  return `${new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }).format(display)}${percent ? ' %' : ''}`;
}

function formatValue(locale: 'fr' | 'en', value: unknown, kind?: 'date' | 'status' | 'percent' | 'masked'): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'date') return formatDate(locale, value);
  if (kind === 'status') return userStatusLabel(locale, value);
  if (kind === 'percent') return formatNumber(locale, value, true);
  if (kind === 'masked') return maskReference(value);
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string' || typeof entry === 'number').map(String).join(', ') || '—';
  if (typeof value === 'boolean') return value ? u(locale, 'yes') : u(locale, 'no');
  if (typeof value === 'number') return formatNumber(locale, value);
  return typeof value === 'string' ? value : '—';
}

function maskReference(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '—';
  if (value.length <= 4) return '••••';
  return `•••• ${value.slice(-4)}`;
}

function statusColor(theme: Theme, value: unknown): { color: string; background: string } {
  const status = String(value ?? '').toUpperCase().replace(/[ -]/g, '_');
  if (['BANNED', 'BLOCKED', 'PAYMENT_FAILED', 'EXPIRED', 'ERROR', 'HIGH'].includes(status)) return { color: theme.danger, background: theme.dangerSoft };
  if (['SUSPENDED', 'DELETION_PENDING', 'FALLBACK', 'PAST_DUE', 'WARNING', 'MEDIUM'].includes(status)) return { color: theme.warning, background: theme.warningSoft };
  if (['ACTIVE', 'PRIMARY', 'FREE', 'PRO', 'PRO_MAX', 'HEALTHY', 'AVAILABLE'].includes(status)) return { color: theme.success, background: theme.successSoft };
  return { color: theme.muted, background: theme.mutedSurface };
}

function StatusPill({ locale, theme, value }: { locale: 'fr' | 'en'; theme: Theme; value: unknown }) {
  const tone = statusColor(theme, value);
  return <View style={{ alignSelf: 'flex-start', backgroundColor: tone.background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: tone.color, fontSize: 10, fontWeight: '800' }}>{userStatusLabel(locale, value).toUpperCase()}</Text></View>;
}

function Panel({
  title, section, theme, locale, onRetry, children, emptyLabel = 'noData', renderWhenEmpty = false,
}: { title: string; section: AdminSection; theme: Theme; locale: 'fr' | 'en'; onRetry(): void; children: ReactNode; emptyLabel?: UserCopyKey; renderWhenEmpty?: boolean }) {
  const message = section.reason;
  return <View style={{ gap: 14, minHeight: 210, padding: 18, borderRadius: 13, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><Text accessibilityRole="header" style={{ flex: 1, color: theme.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>{section.state === 'available' && <View style={{ backgroundColor: theme.successSoft, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 }}><Text style={{ color: theme.success, fontSize: 9, fontWeight: '800' }}>{u(locale, 'available').toUpperCase()}</Text></View>}</View>
    {section.state === 'loading' ? <View accessibilityLabel={u(locale, 'loading')} style={{ minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 9 }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted }}>{u(locale, 'loading')}</Text></View>
      : section.state === 'forbidden' ? <View accessibilityRole="alert" style={{ minHeight: 105, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.muted, textAlign: 'center' }}>{u(locale, 'forbidden')}</Text></View>
        : section.state === 'unavailable' ? <View style={{ minHeight: 105, alignItems: 'center', justifyContent: 'center', gap: 5 }}><Text style={{ color: theme.muted, textAlign: 'center' }}>{u(locale, 'unavailableEnvironment')}</Text>{message && <Text style={{ color: theme.muted, fontSize: 10, textAlign: 'center' }}>{message}</Text>}</View>
          : section.state === 'error' ? <View accessibilityRole="alert" style={{ minHeight: 105, alignItems: 'center', justifyContent: 'center', gap: 10 }}><Text style={{ color: theme.danger, textAlign: 'center' }}>{message || u(locale, 'notAvailable')}</Text><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'retry')} onPress={onRetry} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800' }}>{u(locale, 'retry')}</Text></Pressable></View>
            : section.state === 'empty' ? (renderWhenEmpty ? children : <View style={{ minHeight: 105, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.muted }}>{u(locale, emptyLabel)}</Text></View>)
              : children}
  </View>;
}

function KeyValueGrid({ locale, theme, fields }: { locale: 'fr' | 'en'; theme: Theme; fields: { label: UserCopyKey; value: unknown; kind?: 'date' | 'status' | 'percent' | 'masked' }[] }) {
  const values = fields.filter((field) => field.value !== undefined && field.value !== null && field.value !== '');
  if (values.length === 0) return <Text style={{ color: theme.muted }}>{u(locale, 'noData')}</Text>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{values.map((field) => <View key={field.label} style={{ minWidth: 155, flexGrow: 1, flexBasis: 190, padding: 11, borderRadius: 8, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800' }}>{u(locale, field.label)}</Text>{field.kind === 'status' ? <View style={{ marginTop: 6 }}><StatusPill locale={locale} theme={theme} value={field.value} /></View> : <Text selectable style={{ color: theme.text, marginTop: 5, fontSize: 13, fontWeight: '700' }}>{formatValue(locale, field.value, field.kind)}</Text>}</View>)}</View>;
}

/** Only explicitly summarized learner fields are rendered after elevated
 * access. Documents, conversations and arbitrary pedagogical content are
 * intentionally never enumerated by this client. */
function restrictedProfileText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === 'string' || typeof entry === 'number').map(String).join(', ');
  if (value && typeof value === 'object') {
    try { return JSON.stringify(value).slice(0, 500); } catch { return ''; }
  }
  return '';
}

function RestrictedProfileSummary({ locale, theme, data }: { locale: 'fr' | 'en'; theme: Theme; data: UnknownRecord | undefined }) {
  const classification = recordString(data, ['classification'])?.toUpperCase();
  if (classification !== 'RESTRICTED' && classification !== 'HIGHLY_RESTRICTED') return null;
  const values = [
    { label: 'learningGoals' as const, value: restrictedProfileText(recordValue(data, ['goals'])) },
    { label: 'learningPreferences' as const, value: restrictedProfileText(recordValue(data, ['preferences'])) },
    { label: 'teacherPreferences' as const, value: restrictedProfileText(recordValue(data, ['teacherPreferences'])) },
  ].filter((entry) => entry.value);
  if (!values.length) return null;
  return <View style={{ marginTop: 10, gap: 8, padding: 12, borderRadius: 8, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{u(locale, classification === 'HIGHLY_RESTRICTED' ? 'highlyRestricted' : 'restricted')}</Text>{values.map((entry) => <View key={entry.label}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800' }}>{u(locale, entry.label)}</Text><Text selectable numberOfLines={4} style={{ color: theme.text, marginTop: 3, fontSize: 12 }}>{entry.value}</Text></View>)}</View>;
}

function SmallTable({ locale, theme, columns, rows }: { locale: 'fr' | 'en'; theme: Theme; columns: { label: UserCopyKey; value(row: UnknownRecord): unknown; kind?: 'date' | 'status' | 'percent' | 'masked' }[]; rows: UnknownRecord[] }) {
  if (!rows.length) return <Text style={{ color: theme.muted }}>{u(locale, 'noData')}</Text>;
  return <ScrollView horizontal><View style={{ minWidth: Math.max(520, columns.length * 135), borderWidth: 1, borderColor: theme.border, borderRadius: 8, overflow: 'hidden' }}><View style={{ flexDirection: 'row', backgroundColor: theme.mutedSurface }}>{columns.map((column) => <View key={column.label} style={{ minWidth: 135, flex: 1, padding: 9 }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800' }}>{u(locale, column.label)}</Text></View>)}</View>{rows.map((row, rowIndex) => <View key={String(recordValue(row, ['id', 'eventId', 'createdAt']) ?? rowIndex)} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: theme.border }}>{columns.map((column) => <View key={column.label} style={{ minWidth: 135, flex: 1, padding: 9 }}><Text selectable numberOfLines={2} style={{ color: theme.text, fontSize: 12 }}>{formatValue(locale, column.value(row), column.kind)}</Text></View>)}</View>)}</View></ScrollView>;
}

function ActionButton({ locale, theme, label, allowed, onPress, danger = false }: { locale: 'fr' | 'en'; theme: Theme; label: UserCopyKey; allowed: boolean; onPress(): void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={u(locale, label)} accessibilityHint={allowed ? undefined : u(locale, 'forbidden')} accessibilityState={{ disabled: !allowed }} disabled={!allowed} onPress={onPress} style={{ opacity: allowed ? 1 : .48, borderWidth: 1, borderColor: danger ? theme.danger : theme.primary, backgroundColor: danger ? theme.dangerSoft : theme.primarySoft, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9 }}><Text style={{ color: danger ? theme.danger : theme.primary, fontSize: 12, fontWeight: '800' }}>{u(locale, label)}</Text></Pressable>;
}

type PendingAction = { action: UserAction; title: UserCopyKey; consequence: UserCopyKey; dangerous: boolean; capability: string; refresh: UserSectionName[] };
type StepUpOperation =
  | { kind: 'user-action'; pending: PendingAction; body: UnknownRecord }
  | { kind: 'profile-access'; reason: string };

const actions: Record<UserAction, PendingAction> = {
  suspend: { action: 'suspend', title: 'suspendUser', consequence: 'suspendConsequence', dangerous: false, capability: 'users.suspend', refresh: ['security', 'sessions', 'audit'] },
  reactivate: { action: 'reactivate', title: 'reactivateUser', consequence: 'reactivateConsequence', dangerous: false, capability: 'users.suspend', refresh: ['security', 'sessions', 'audit'] },
  ban: { action: 'ban', title: 'banUser', consequence: 'banConsequence', dangerous: true, capability: 'users.ban', refresh: ['security', 'sessions', 'audit'] },
  'revoke-sessions': { action: 'revoke-sessions', title: 'revokeAllSessions', consequence: 'revokeConsequence', dangerous: false, capability: 'users.sessions.revoke', refresh: ['sessions', 'security', 'audit'] },
  'deletion-request': { action: 'deletion-request', title: 'requestDeletion', consequence: 'deletionConsequence', dangerous: true, capability: 'users.delete_request', refresh: ['security', 'audit'] },
  'plan-override': { action: 'plan-override', title: 'planOverride', consequence: 'actionRequiresMfa', dangerous: true, capability: 'subscriptions.manage', refresh: ['subscription', 'audit'] },
  'beta-access': { action: 'beta-access', title: 'grantBetaAccess', consequence: 'actionRequiresMfa', dangerous: true, capability: 'subscriptions.manage', refresh: ['subscription', 'audit'] },
  'quota-adjustment': { action: 'quota-adjustment', title: 'adjustQuota', consequence: 'actionRequiresMfa', dangerous: true, capability: 'quotas.adjust', refresh: ['quotas', 'audit'] },
};

function userFromDetail(detail: AdminSection): UnknownRecord | undefined {
  const root = sectionRecord(detail);
  return nestedRecord(root, ['header', 'user', 'overview', 'account']) ?? root;
}

function sectionFromDetail(detail: AdminSection, name: UserSectionName): AdminSection | undefined {
  const root = sectionRecord(detail);
  const allSections = nestedRecord(root, ['sections']);
  const aliases: Partial<Record<UserSectionName, string[]>> = {
    'learner-profile': ['learnerProfile'],
  };
  const keys = [name, name.replace('-', '_'), ...(aliases[name] ?? [])];
  const nested = nestedRecord(allSections, keys) ?? nestedRecord(root, keys);
  if (!nested) return undefined;
  const status = recordString(nested, ['status'])?.toLowerCase();
  if (status === 'forbidden') return { state: 'forbidden', reason: recordString(nested, ['reason', 'message']) };
  if (status === 'unavailable') return { state: 'unavailable', reason: recordString(nested, ['reason', 'message']) };
  if (status === 'error') return { state: 'error', reason: recordString(nested, ['reason', 'message']) };
  return { state: 'available', data: nestedRecord(nested, ['data']) ?? nested };
}

export function UserControlCenter({ userId }: { userId: string }) {
  const { locale, dark } = useAdminUi(); const { identity } = useAuth(); const router = useRouter(); const { width } = useWindowDimensions(); const theme = useMemo(() => themeFor(dark), [dark]);
  const canRead = capability(identity, 'users.read');
  const [activeTab, setActiveTab] = useState<TabKey>('overview'); const [detail, setDetail] = useState<AdminSection>(emptySection); const [sections, setSections] = useState<Sections>(initialSections); const requestedSections = useRef(new Set<UserSectionName>());
  // A user detail response can outlive a route transition. Keep a synchronous
  // identity/epoch guard alongside the route key so a late response for user A
  // can never populate the screen for user B.
  const currentUserId = useRef(userId);
  const requestEpoch = useRef(0);
  if (currentUserId.current !== userId) {
    currentUserId.current = userId;
    requestEpoch.current += 1;
    requestedSections.current.clear();
  }
  const isCurrentRequest = useCallback((expectedUserId: string, expectedEpoch: number) => currentUserId.current === expectedUserId && requestEpoch.current === expectedEpoch, []);
  useEffect(() => () => { requestEpoch.current += 1; }, []);
  const [dialogAction, setDialogAction] = useState<PendingAction | null>(null); const [actionError, setActionError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [stepUp, setStepUp] = useState<StepUpOperation | null>(null); const [stepUpCode, setStepUpCode] = useState(''); const [stepUpError, setStepUpError] = useState<string | null>(null); const [profileAccessError, setProfileAccessError] = useState<string | null>(null); const [profileAccessBusy, setProfileAccessBusy] = useState(false); const [noteBody, setNoteBody] = useState(''); const [noteReason, setNoteReason] = useState(''); const [noteBusy, setNoteBusy] = useState(false); const [noteError, setNoteError] = useState<string | null>(null);
  const [overridePlan, setOverridePlan] = useState('pro'); const [betaPlan, setBetaPlan] = useState('pro'); const [startsAt, setStartsAt] = useState(''); const [expiresAt, setExpiresAt] = useState(''); const [quotaResource, setQuotaResource] = useState(''); const [quotaAmount, setQuotaAmount] = useState(''); const [quotaCycleId, setQuotaCycleId] = useState(''); const [profileReason, setProfileReason] = useState('');
  const fetchSection = useCallback(async (name: UserSectionName, query: Record<string, string | number | undefined> = {}) => {
    const expectedUserId = userId; const expectedEpoch = requestEpoch.current;
    requestedSections.current.add(name);
    if (isCurrentRequest(expectedUserId, expectedEpoch)) setSections((current) => ({ ...current, [name]: emptySection() }));
    const next = await getAdminUserSection(userId, name, query);
    if (isCurrentRequest(expectedUserId, expectedEpoch)) setSections((current) => ({ ...current, [name]: next }));
  }, [isCurrentRequest, userId]);
  const requestSensitiveProfile = useCallback(async (reason = profileReason.trim(), afterStepUp = false) => {
    const expectedUserId = userId; const expectedEpoch = requestEpoch.current;
    if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
    setProfileAccessBusy(true); setProfileAccessError(null);
    const next = await requestAdminUserLearnerProfileAccess(userId, reason);
    if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
    if (next.code === 'ADMIN_STEP_UP_REQUIRED' && !afterStepUp) {
      setStepUp({ kind: 'profile-access', reason }); setStepUpCode(''); setStepUpError(null);
    } else if (next.state === 'available') {
      setSections((current) => ({ ...current, 'learner-profile': next }));
    } else {
      // Keep the standard summary visible if elevated access is denied or
      // unavailable; a failed request must not erase already-authorized data.
      setProfileAccessError(next.reason || u(locale, 'actionFailed'));
    }
    setProfileAccessBusy(false);
  }, [isCurrentRequest, locale, profileReason, userId]);
  const addSupportNote = useCallback(async () => {
    if (noteBody.trim().length < 1 || noteReason.trim().length < 5) return;
    const expectedUserId = userId; const expectedEpoch = requestEpoch.current;
    if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
    setNoteBusy(true); setNoteError(null);
    try {
      await createAdminSupportNote(userId, noteBody.trim(), noteReason.trim());
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      setNoteBody(''); setNoteReason('');
      await fetchSection('support-notes', { page: 1, pageSize: 20 });
    } catch (error) {
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      const problem = error as ApiProblem;
      setNoteError(problem.message || u(locale, 'actionFailed'));
    } finally { if (isCurrentRequest(expectedUserId, expectedEpoch)) setNoteBusy(false); }
  }, [fetchSection, isCurrentRequest, locale, noteBody, noteReason, userId]);
  const load = useCallback(async () => {
    if (!canRead) return;
    const expectedUserId = userId; const expectedEpoch = requestEpoch.current;
    requestedSections.current.clear(); setDetail(emptySection()); setSections(initialSections());
    const result = await getAdminUser(userId);
    if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
    setDetail(result);
    if (result.state !== 'available') return;
    // Detail is deliberately the only eager request. Individual panels load on
    // selection, which prevents an unauthorized role from needlessly probing
    // payments, security or learner data just by opening a user header.
    for (const name of sectionNames) {
      const embedded = sectionFromDetail(result, name);
      if (embedded) setSections((current) => ({ ...current, [name]: embedded }));
    }
  }, [canRead, isCurrentRequest, userId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const required: Partial<Record<TabKey, UserSectionName[]>> = {
      profile: ['learner-profile'], subscription: ['subscription'], quotas: ['quotas'], usage: ['usage'], payments: ['payments'], security: ['security', 'sessions'], activity: ['activity'], support: ['audit', 'reports', 'support-notes'],
    };
    for (const name of required[activeTab] ?? []) if (sections[name].state === 'loading' && !requestedSections.current.has(name)) void fetchSection(name);
  }, [activeTab, fetchSection, sections]);
  const user = userFromDetail(detail);
  const detailRoot = sectionRecord(detail);
  const identityVerification = recordValue(nestedRecord(detailRoot, ['identityVerification']), ['status']) ?? recordValue(detailRoot, ['identityVerification']);
  const overviewEnvelope = nestedRecord(nestedRecord(detailRoot, ['sections']), ['overview']);
  const accountOverview = nestedRecord(overviewEnvelope, ['data']) ?? overviewEnvelope;
  const displayName = recordString(user, ['displayName', 'name', 'fullName']) ?? '—';
  const accountStatus = recordString(user, ['accountStatus', 'status']); const normalizedAccountStatus = accountStatus?.toUpperCase(); const plan = recordString(user, ['plan', 'planSlug']); const subscriptionStatus = recordString(user, ['subscriptionStatus', 'subscriptionStatusCode', 'subscription']); const quotaState = recordString(user, ['quotaState', 'quotaStatus']);
  const section = (name: UserSectionName) => sections[name];
  const perform = async (pending: PendingAction, body: UnknownRecord) => {
    const expectedUserId = userId; const expectedEpoch = requestEpoch.current;
    if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
    setBusy(true); setActionError(null);
    try {
      await mutateAdminUser(userId, pending.action, body);
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      setDialogAction(null); setStepUp(null); setStepUpCode('');
      const refreshed = await getAdminUser(userId);
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      setDetail(refreshed);
      await Promise.all(pending.refresh.map((name) => fetchSection(name)));
    } catch (error) {
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      const problem = error as ApiProblem;
      if (problem.code === 'ADMIN_STEP_UP_REQUIRED' || problem.status === 428) { setDialogAction(null); setStepUp({ kind: 'user-action', pending, body }); setStepUpError(null); }
      else setActionError(problem.message || u(locale, 'actionFailed'));
    } finally { if (isCurrentRequest(expectedUserId, expectedEpoch)) setBusy(false); }
  };
  const createBody = (action: UserAction, reason: string): UnknownRecord => {
    const base: UnknownRecord = { reason };
    if (action === 'ban') return { ...base, internalNote: reason };
    if (action === 'plan-override') return { ...base, plan: overridePlan, ...(startsAt.trim() ? { startsAt: startsAt.trim() } : {}), ...(expiresAt.trim() ? { expiresAt: expiresAt.trim() } : {}) };
    if (action === 'beta-access') return { ...base, plan: betaPlan, startsAt: startsAt.trim(), expiresAt: expiresAt.trim() };
    if (action === 'quota-adjustment') return { ...base, resource: quotaResource.trim(), amount: Number(quotaAmount), ...(quotaCycleId.trim() ? { cycleId: quotaCycleId.trim() } : {}) };
    return base;
  };
  const submitDialog = (reason: string) => {
    if (!dialogAction) return;
    const body = createBody(dialogAction.action, reason);
    if (dialogAction.action === 'quota-adjustment' && (!quotaResource.trim() || !Number.isInteger(Number(quotaAmount)) || Number(quotaAmount) <= 0)) { setActionError(u(locale, 'actionFailed')); return; }
    if (dialogAction.action === 'beta-access' && (!startsAt.trim() || !expiresAt.trim())) { setActionError(u(locale, 'actionFailed')); return; }
    void perform(dialogAction, body);
  };
  const begin = (action: UserAction) => { setActionError(null); setStartsAt(''); setExpiresAt(''); setQuotaResource(''); setQuotaAmount(''); setQuotaCycleId(''); setDialogAction(actions[action]); };
  const dialogCopy: CriticalActionDialogCopy = { description: dialogAction ? `${u(locale, dialogAction.consequence)} ${u(locale, 'actionRequiresMfa')}` : u(locale, 'actionRequiresMfa'), reason: u(locale, 'reason'), reasonPlaceholder: u(locale, 'reason'), confirmation: u(locale, 'typeConfirm'), confirmationPlaceholder: 'CONFIRM', cancel: u(locale, 'cancel'), confirm: u(locale, 'confirm') };
  const resumeAfterStepUp = async () => {
    if (!stepUp) return;
    const expectedUserId = userId; const expectedEpoch = requestEpoch.current;
    const operation = stepUp;
    setBusy(true); setStepUpError(null);
    try {
      await completeAdminStepUp(stepUpCode);
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      if (operation.kind === 'user-action') await perform(operation.pending, operation.body);
      else { await requestSensitiveProfile(operation.reason, true); setStepUp(null); setStepUpCode(''); }
    } catch (error) {
      if (!isCurrentRequest(expectedUserId, expectedEpoch)) return;
      const problem = error as ApiProblem;
      setStepUpError(problem.message || u(locale, 'actionFailed'));
    } finally { if (isCurrentRequest(expectedUserId, expectedEpoch)) setBusy(false); }
  };
  const profile = section('learner-profile'); const subscription = section('subscription'); const quotas = section('quotas'); const usage = section('usage'); const payments = section('payments'); const security = section('security'); const sessions = section('sessions'); const audit = section('audit'); const activity = section('activity'); const reports = section('reports'); const supportNotes = section('support-notes');
  const profileData = sectionRecord(profile); const subscriptionData = sectionRecord(subscription); const quotaData = sectionRecord(quotas); const usageData = sectionRecord(usage); const paymentData = sectionRecord(payments); const securityData = sectionRecord(security); const sessionData = sectionRecord(sessions); const auditData = sectionRecord(audit); const activityData = sectionRecord(activity); const reportsData = sectionRecord(reports); const supportNotesData = sectionRecord(supportNotes);
  if (!canRead) return <View accessibilityRole="alert" style={{ padding: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}><Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{u(locale, 'usersTitle')}</Text><Text style={{ color: theme.muted, marginTop: 8 }}>{u(locale, 'forbidden')}</Text></View>;
  if (detail.state === 'forbidden') return <View accessibilityRole="alert" style={{ padding: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}><Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{u(locale, 'userControlCenter')}</Text><Text style={{ color: theme.muted, marginTop: 8 }}>{u(locale, 'forbidden')}</Text></View>;
  if (detail.state === 'loading') return <View accessibilityLabel={u(locale, 'loading')} style={{ minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted }}>{u(locale, 'loading')}</Text></View>;
  if (detail.state === 'error' || detail.state === 'unavailable' || detail.state === 'empty') return <View accessibilityRole="alert" style={{ minHeight: 250, alignItems: 'center', justifyContent: 'center', gap: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}><Text style={{ color: detail.state === 'error' ? theme.danger : theme.muted, textAlign: 'center' }}>{detail.reason || u(locale, 'detailsUnavailable')}</Text><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'retry')} onPress={() => void load()} style={{ backgroundColor: theme.primary, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 9 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{u(locale, 'retry')}</Text></Pressable></View>;
  const paymentRows = recordRows(paymentData, ['items', 'payments', 'history']); const auditRows = recordRows(auditData, ['items', 'events', 'audit']); const activityRows = recordRows(activityData, ['items', 'events', 'activity']); const reportRows = recordRows(reportsData, ['items', 'reports']); const supportNoteRows = recordRows(supportNotesData, ['items', 'notes']); const sessionRows = recordRows(sessionData, ['items', 'sessions']); const quotaRows = recordRows(quotaData, ['resources', 'items', 'quotas']); const usageRows = recordRows(usageData, ['engines', 'items', 'metrics', 'resources']);
  const profileSummary = nestedRecord(profileData, ['summary', 'profile']) ?? profileData; const securitySummary = nestedRecord(securityData, ['summary', 'security']) ?? securityData; const paymentSummary = nestedRecord(paymentData, ['summary', 'payment']) ?? paymentData;
  const profileLanguages = recordRows(profileSummary, ['languages']);
  const nativeLanguages = profileLanguages.map((language) => recordString(language, ['nativeLanguage'])).filter((value): value is string => Boolean(value));
  const studyLanguages = profileLanguages.map((language) => recordString(language, ['language'])).filter((value): value is string => Boolean(value));
  const cefrLevels = profileLanguages.map((language) => recordString(language, ['cefrLevel'])).filter((value): value is string => Boolean(value));
  return <View style={{ gap: 16, paddingBottom: 30 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'backToUsers')} onPress={() => router.push('/users' as never)} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}><Text style={{ color: theme.primary, fontWeight: '800' }}>← {u(locale, 'backToUsers')}</Text></Pressable>
    <View style={{ gap: 14, padding: width < 700 ? 15 : 20, borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.surface }}>
      <View style={{ flexDirection: width < 700 ? 'column' : 'row', gap: 15, justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', gap: 13, flex: 1 }}><View accessibilityLabel={u(locale, 'user')} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primarySoft, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.primary, fontWeight: '800', fontSize: 19 }}>{displayName === '—' ? '?' : displayName.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1, gap: 2 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>{displayName}</Text><Text selectable style={{ color: theme.muted, fontSize: 13 }}>{recordString(user, ['email']) ?? '—'}</Text><Text selectable style={{ color: theme.muted, fontSize: 10 }}>{userId}</Text></View></View><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'refresh')} onPress={() => void load()} style={{ alignSelf: width < 700 ? 'flex-start' : 'center', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800' }}>{u(locale, 'refresh')}</Text></Pressable></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><StatusPill locale={locale} theme={theme} value={accountStatus} /><StatusPill locale={locale} theme={theme} value={plan} /><StatusPill locale={locale} theme={theme} value={subscriptionStatus} /><StatusPill locale={locale} theme={theme} value={quotaState} /></View>
      <KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'createdAt', value: recordString(user, ['createdAt']), kind: 'date' }, { label: 'lastActive', value: recordString(user, ['lastActiveAt', 'lastActive']), kind: 'date' }]} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><ActionButton locale={locale} theme={theme} label="suspendUser" allowed={capability(identity, actions.suspend.capability) && normalizedAccountStatus !== 'SUSPENDED'} onPress={() => begin('suspend')} /><ActionButton locale={locale} theme={theme} label="reactivateUser" allowed={capability(identity, actions.reactivate.capability) && normalizedAccountStatus === 'SUSPENDED'} onPress={() => begin('reactivate')} /><ActionButton locale={locale} theme={theme} label="banUser" allowed={capability(identity, actions.ban.capability) && normalizedAccountStatus !== 'BANNED'} onPress={() => begin('ban')} danger /><ActionButton locale={locale} theme={theme} label="revokeAllSessions" allowed={capability(identity, actions['revoke-sessions'].capability)} onPress={() => begin('revoke-sessions')} /></View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }} accessibilityRole="tablist">{tabDefinitions.map((tab) => <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.id }} aria-selected={activeTab === tab.id} onPress={() => setActiveTab(tab.id)} style={{ backgroundColor: activeTab === tab.id ? theme.primarySoft : theme.surface, borderColor: activeTab === tab.id ? theme.primary : theme.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: activeTab === tab.id ? theme.primary : theme.muted, fontSize: 12, fontWeight: '800' }}>{u(locale, tab.label)}</Text></Pressable>)}</ScrollView>
    {activeTab === 'overview' && <Panel title={u(locale, 'overview')} section={detail} theme={theme} locale={locale} onRetry={() => void load()}><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'userId', value: userId }, { label: 'email', value: recordString(user, ['email']) }, { label: 'accountStatus', value: accountStatus, kind: 'status' }, { label: 'plan', value: plan, kind: 'status' }, { label: 'subscription', value: subscriptionStatus, kind: 'status' }, { label: 'quotaState', value: quotaState, kind: 'status' }, { label: 'country', value: recordString(user, ['country', 'countryCode']) }, { label: 'interfaceLanguage', value: recordString(user, ['interfaceLanguage', 'locale', 'language']) }, { label: 'createdAt', value: recordString(user, ['createdAt']), kind: 'date' }, { label: 'lastActive', value: recordString(user, ['lastActiveAt', 'lastActive']), kind: 'date' }]} /></Panel>}
    {activeTab === 'account' && <Panel title={u(locale, 'account')} section={detail} theme={theme} locale={locale} onRetry={() => void load()}><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'accountStatus', value: recordValue(accountOverview, ['accountStatus']) ?? accountStatus, kind: 'status' }, { label: 'emailVerified', value: recordValue(accountOverview, ['emailVerified', 'isEmailVerified']) }, { label: 'interfaceLanguage', value: recordValue(accountOverview, ['interfaceLanguage', 'locale']) }, { label: 'createdAt', value: recordString(accountOverview, ['createdAt']) ?? recordString(user, ['createdAt']), kind: 'date' }, { label: 'lastActive', value: recordString(accountOverview, ['lastActiveAt', 'lastActive']) ?? recordString(user, ['lastActiveAt', 'lastActive']), kind: 'date' }]} /><View style={{ marginTop: 5, padding: 12, borderRadius: 8, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '800' }}>{u(locale, 'identityVerification')}</Text><Text style={{ color: theme.text, marginTop: 4, fontWeight: '800' }}>{identityVerification === undefined ? u(locale, 'identityNotImplemented') : userStatusLabel(locale, identityVerification)}</Text></View></Panel>}
    {activeTab === 'profile' && <Panel title={u(locale, 'learnerProfile')} section={profile} theme={theme} locale={locale} onRetry={() => void fetchSection('learner-profile')}>
      <KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'educationLevel', value: recordValue(profileSummary, ['educationLevel', 'level']) }, { label: 'curriculum', value: recordValue(profileSummary, ['curriculum', 'track']) }, { label: 'subjects', value: recordValue(profileSummary, ['subjects']) }, { label: 'nativeLanguage', value: recordValue(profileSummary, ['nativeLanguage']) ?? (nativeLanguages.length ? nativeLanguages : undefined) }, { label: 'interfaceLanguage', value: recordValue(profileSummary, ['interfaceLanguage', 'locale']) }, { label: 'studyLanguage', value: recordValue(profileSummary, ['studyLanguage', 'targetLanguage']) ?? (studyLanguages.length ? studyLanguages : undefined) }, { label: 'cefr', value: recordValue(profileSummary, ['cefr', 'cefrLevel']) ?? (cefrLevels.length ? cefrLevels : undefined) }]} />
      <RestrictedProfileSummary locale={locale} theme={theme} data={profileData} />
      <View style={{ marginTop: 4, gap: 8, padding: 12, borderRadius: 8, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{u(locale, 'profileClassification')}</Text><Text style={{ color: theme.muted, fontSize: 12 }}>{u(locale, 'standard')} · {u(locale, 'restricted')} · {u(locale, 'highlyRestricted')}</Text><Text style={{ color: theme.muted, fontSize: 12 }}>{u(locale, 'sensitiveAccessHint')}</Text><TextInput accessibilityLabel={u(locale, 'sensitiveReason')} value={profileReason} onChangeText={setProfileReason} placeholder={u(locale, 'sensitiveReason')} placeholderTextColor={theme.muted} multiline style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9, backgroundColor: theme.surface }} />{profileAccessError && <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 12 }}>{profileAccessError}</Text>}<Pressable accessibilityRole="button" accessibilityState={{ disabled: profileReason.trim().length < 5 || profileAccessBusy }} disabled={profileReason.trim().length < 5 || profileAccessBusy} onPress={() => void requestSensitiveProfile()} style={{ alignSelf: 'flex-start', opacity: profileReason.trim().length < 5 || profileAccessBusy ? .45 : 1, backgroundColor: theme.primary, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8 }}>{profileAccessBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{u(locale, 'requestSensitiveAccess')}</Text>}</Pressable></View>
    </Panel>}
    {activeTab === 'subscription' && <Panel title={u(locale, 'subscriptionPanel')} section={subscription} theme={theme} locale={locale} onRetry={() => void fetchSection('subscription')}><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'plan', value: recordValue(subscriptionData, ['effectivePlan', 'plan', 'planSlug', 'currentPlan']), kind: 'status' }, { label: 'subscription', value: recordValue(subscriptionData, ['status', 'subscriptionStatus']), kind: 'status' }, { label: 'adminOverride', value: recordValue(subscriptionData, ['planSource']) }, { label: 'billingInterval', value: recordValue(subscriptionData, ['billingInterval', 'interval']) }, { label: 'currentPeriodStart', value: recordValue(subscriptionData, ['currentPeriodStart', 'periodStart']), kind: 'date' }, { label: 'currentPeriodEnd', value: recordValue(subscriptionData, ['currentPeriodEnd', 'periodEnd']), kind: 'date' }, { label: 'nextRenewal', value: recordValue(subscriptionData, ['nextRenewal', 'renewalAt']), kind: 'date' }, { label: 'provider', value: recordValue(subscriptionData, ['provider']) }, { label: 'providerReference', value: recordValue(subscriptionData, ['providerReferenceMasked']), kind: 'masked' }, { label: 'cancelAtPeriodEnd', value: recordValue(subscriptionData, ['cancelAtPeriodEnd']) }]} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 }}><ActionButton locale={locale} theme={theme} label="planOverride" allowed={capability(identity, actions['plan-override'].capability)} onPress={() => begin('plan-override')} /><ActionButton locale={locale} theme={theme} label="grantBetaAccess" allowed={capability(identity, actions['beta-access'].capability)} onPress={() => begin('beta-access')} /></View><Text style={{ color: theme.text, marginTop: 7, fontSize: 14, fontWeight: '800' }}>{u(locale, 'planHistory')}</Text><SmallTable locale={locale} theme={theme} rows={recordRows(subscriptionData, ['overrides', 'history', 'planHistory', 'items'])} columns={[{ label: 'when', value: (row) => recordValue(row, ['at', 'createdAt', 'date']), kind: 'date' }, { label: 'plan', value: (row) => recordValue(row, ['plan', 'planSlug']), kind: 'status' }, { label: 'reason', value: (row) => recordValue(row, ['reason', 'event']) }, { label: 'who', value: (row) => recordValue(row, ['grantedById', 'actor', 'adminActor']) }]} /></Panel>}
    {activeTab === 'quotas' && <Panel title={u(locale, 'quotas')} section={quotas} theme={theme} locale={locale} onRetry={() => void fetchSection('quotas')}><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'overallUsage', value: recordValue(quotaData, ['overallUsagePercent', 'overallUsage', 'usagePercent']), kind: 'percent' }]} /><SmallTable locale={locale} theme={theme} rows={quotaRows} columns={[{ label: 'resource', value: (row) => recordValue(row, ['resource', 'resourceType', 'key']) }, { label: 'state', value: (row) => recordValue(row, ['state', 'status']), kind: 'status' }, { label: 'primaryUsed', value: (row) => recordValue(nestedRecord(row, ['primary']), ['used']) ?? recordValue(row, ['primaryUsed', 'used']) }, { label: 'primaryLimit', value: (row) => recordValue(nestedRecord(row, ['primary']), ['limit']) ?? recordValue(row, ['primaryLimit', 'limit']) }, { label: 'fallbackUsed', value: (row) => recordValue(nestedRecord(row, ['fallback']), ['used']) ?? recordValue(row, ['fallbackUsed']) }, { label: 'fallbackLimit', value: (row) => recordValue(nestedRecord(row, ['fallback']), ['limit']) ?? recordValue(row, ['fallbackLimit']) }, { label: 'percentage', value: (row) => recordValue(row, ['percentage', 'usagePercent']), kind: 'percent' }, { label: 'resetAt', value: (row) => recordValue(row, ['resetAt', 'endsAt']), kind: 'date' }]} /><View style={{ marginTop: 4 }}><ActionButton locale={locale} theme={theme} label="adjustQuota" allowed={capability(identity, actions['quota-adjustment'].capability)} onPress={() => begin('quota-adjustment')} /></View></Panel>}
    {activeTab === 'usage' && <Panel title={u(locale, 'usage')} section={usage} theme={theme} locale={locale} onRetry={() => void fetchSection('usage')} emptyLabel="notInstrumented"><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'languageText', value: recordValue(nestedRecord(nestedRecord(usageData, ['language']), ['text']), ['status']), kind: 'status' }, { label: 'languageVoice', value: recordValue(nestedRecord(nestedRecord(usageData, ['language']), ['voice']), ['status']), kind: 'status' }, { label: 'documentsMetadata', value: recordValue(nestedRecord(usageData, ['documents']), ['count']) }]} /><SmallTable locale={locale} theme={theme} rows={usageRows} columns={[{ label: 'engine', value: (row) => recordValue(row, ['engine', 'resource', 'key', 'name']) }, { label: 'state', value: (row) => recordValue(row, ['instrumentation', 'status']), kind: 'status' }, { label: 'value', value: (row) => recordValue(row, ['calls', 'value', 'count', 'total']) }, { label: 'metric', value: (row) => recordValue(row, ['inputTokens', 'audioInputSeconds', 'pages', 'searches']) }]} /></Panel>}
    {activeTab === 'payments' && <Panel title={u(locale, 'payments')} section={payments} theme={theme} locale={locale} onRetry={() => void fetchSection('payments')}><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'lastPayment', value: recordValue(paymentSummary, ['lastPayment', 'lastPaymentAt']), kind: 'date' }, { label: 'amount', value: recordValue(paymentSummary, ['amount', 'lastAmount']) }, { label: 'currency', value: recordValue(paymentSummary, ['currency']) }, { label: 'paymentStatus', value: recordValue(paymentSummary, ['status', 'lastStatus']), kind: 'status' }, { label: 'nextRenewal', value: recordValue(paymentSummary, ['nextRenewal']), kind: 'date' }, { label: 'paymentFailures', value: recordValue(paymentSummary, ['paymentFailures', 'failedCount']) }, { label: 'refunds', value: recordValue(paymentSummary, ['refunds', 'refundCount']) }]} /><Text style={{ color: theme.text, marginTop: 6, fontSize: 14, fontWeight: '800' }}>{u(locale, 'paymentHistory')}</Text><SmallTable locale={locale} theme={theme} rows={paymentRows} columns={[{ label: 'paymentDate', value: (row) => recordValue(row, ['createdAt', 'date', 'paidAt']), kind: 'date' }, { label: 'provider', value: (row) => recordValue(row, ['provider']) }, { label: 'referenceMasked', value: (row) => recordValue(row, ['referenceMasked', 'providerReferenceMasked']), kind: 'masked' }, { label: 'amount', value: (row) => recordValue(row, ['amount']) }, { label: 'currency', value: (row) => recordValue(row, ['currency']) }, { label: 'paymentStatus', value: (row) => recordValue(row, ['status']), kind: 'status' }, { label: 'invoice', value: (row) => recordValue(row, ['invoiceNumber', 'invoice']) }]} /><PageButtons locale={locale} theme={theme} data={paymentData} onChange={(page) => void fetchSection('payments', { page, pageSize: 20 })} /></Panel>}
    {activeTab === 'security' && <Panel title={u(locale, 'security')} section={security} theme={theme} locale={locale} onRetry={() => void fetchSection('security')}><KeyValueGrid locale={locale} theme={theme} fields={[{ label: 'emailVerified', value: recordValue(securitySummary, ['emailVerified', 'isEmailVerified']) }, { label: 'accountStatus', value: recordValue(securitySummary, ['accountStatus', 'status']) ?? accountStatus, kind: 'status' }, { label: 'activeSessions', value: recordValue(securitySummary, ['activeSessions']) }, { label: 'suspensionHistory', value: recordValue(securitySummary, ['suspendedAt']), kind: 'date' }, { label: 'banHistory', value: recordValue(securitySummary, ['bannedAt']), kind: 'date' }]} /><Text style={{ color: theme.text, marginTop: 7, fontSize: 14, fontWeight: '800' }}>{u(locale, 'activeSessions')}</Text><Panel title={u(locale, 'activeSessions')} section={sessions} theme={theme} locale={locale} onRetry={() => void fetchSection('sessions')}><SmallTable locale={locale} theme={theme} rows={sessionRows} columns={[{ label: 'sessionCreated', value: (row) => recordValue(row, ['createdAt', 'sessionCreatedAt']), kind: 'date' }, { label: 'lastUsed', value: (row) => recordValue(row, ['lastUsedAt', 'lastActiveAt']), kind: 'date' }, { label: 'device', value: (row) => recordValue(row, ['device', 'userAgentSummary']) }, { label: 'ipMetadata', value: (row) => recordValue(row, ['ipMetadata', 'ipCountry']) }, { label: 'sessionStatus', value: (row) => recordValue(row, ['status']), kind: 'status' }]} /></Panel><Text style={{ color: theme.text, marginTop: 7, fontSize: 14, fontWeight: '800' }}>{u(locale, 'securityEvents')}</Text><SmallTable locale={locale} theme={theme} rows={recordRows(securityData, ['events', 'securityEvents'])} columns={[{ label: 'when', value: (row) => recordValue(row, ['createdAt', 'at']), kind: 'date' }, { label: 'action', value: (row) => recordValue(row, ['action', 'type']) }, { label: 'result', value: (row) => recordValue(row, ['status', 'result']), kind: 'status' }]} /></Panel>}
    {activeTab === 'activity' && <Panel title={u(locale, 'activity')} section={activity} theme={theme} locale={locale} onRetry={() => void fetchSection('activity')}><SmallTable locale={locale} theme={theme} rows={activityRows} columns={[{ label: 'when', value: (row) => recordValue(row, ['occurredAt', 'createdAt', 'at', 'timestamp']), kind: 'date' }, { label: 'action', value: (row) => recordValue(row, ['kind', 'action', 'event', 'type']) }, { label: 'result', value: (row) => recordValue(row, ['result', 'status']), kind: 'status' }]} /><PageButtons locale={locale} theme={theme} data={activityData} onChange={(page) => void fetchSection('activity', { page, pageSize: 20 })} /></Panel>}
    {activeTab === 'support' && <View style={{ gap: 14 }}><Panel title={u(locale, 'supportNotes')} section={supportNotes} theme={theme} locale={locale} onRetry={() => void fetchSection('support-notes', { page: 1, pageSize: 20 })} renderWhenEmpty><View style={{ gap: 9 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{u(locale, 'notesSafetyHint')}</Text><TextInput accessibilityLabel={u(locale, 'noteBody')} value={noteBody} onChangeText={setNoteBody} multiline placeholder={u(locale, 'noteBody')} placeholderTextColor={theme.muted} style={{ minHeight: 84, color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9 }} /><TextInput accessibilityLabel={u(locale, 'noteReason')} value={noteReason} onChangeText={setNoteReason} multiline placeholder={u(locale, 'noteReason')} placeholderTextColor={theme.muted} style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9 }} />{noteError && <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 12 }}>{noteError}</Text>}<Pressable accessibilityRole="button" accessibilityState={{ disabled: noteBusy || noteBody.trim().length < 1 || noteReason.trim().length < 5 }} disabled={noteBusy || noteBody.trim().length < 1 || noteReason.trim().length < 5} onPress={() => void addSupportNote()} style={{ alignSelf: 'flex-start', opacity: noteBusy || noteBody.trim().length < 1 || noteReason.trim().length < 5 ? .45 : 1, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 7, backgroundColor: theme.primary }}>{noteBusy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{u(locale, 'addSupportNote')}</Text>}</Pressable></View><SmallTable locale={locale} theme={theme} rows={supportNoteRows} columns={[{ label: 'supportNote', value: (row) => recordValue(row, ['body']) }, { label: 'who', value: (row) => recordValue(row, ['actorId']) }, { label: 'when', value: (row) => recordValue(row, ['createdAt']), kind: 'date' }]} /><PageButtons locale={locale} theme={theme} data={supportNotesData} onChange={(page) => void fetchSection('support-notes', { page, pageSize: 20 })} /></Panel><Panel title={u(locale, 'auditHistory')} section={audit} theme={theme} locale={locale} onRetry={() => void fetchSection('audit')}><SmallTable locale={locale} theme={theme} rows={auditRows} columns={[{ label: 'who', value: (row) => recordValue(row, ['actorId', 'actor', 'actorEmail', 'adminActor']) }, { label: 'action', value: (row) => recordValue(row, ['action', 'event', 'type']) }, { label: 'when', value: (row) => recordValue(row, ['createdAt', 'at']), kind: 'date' }, { label: 'reason', value: (row) => recordValue(row, ['reason']) }, { label: 'result', value: (row) => recordValue(row, ['result', 'status']), kind: 'status' }]} /><PageButtons locale={locale} theme={theme} data={auditData} onChange={(page) => void fetchSection('audit', { page, pageSize: 20 })} /></Panel><Panel title={u(locale, 'reportsIncidents')} section={reports} theme={theme} locale={locale} onRetry={() => void fetchSection('reports')}><SmallTable locale={locale} theme={theme} rows={reportRows} columns={[{ label: 'when', value: (row) => recordValue(row, ['createdAt']), kind: 'date' }, { label: 'metric', value: (row) => recordValue(row, ['category']) }, { label: 'result', value: (row) => recordValue(row, ['status']), kind: 'status' }]} /><Text style={{ color: theme.muted, marginTop: 10, fontSize: 12 }}>{u(locale, 'userErrors')}: {u(locale, 'notInstrumented')}</Text></Panel></View>}
    <View style={{ gap: 10, marginTop: 5, padding: 17, borderWidth: 1, borderColor: theme.danger, borderRadius: 13, backgroundColor: theme.dangerSoft }}><Text accessibilityRole="header" style={{ color: theme.danger, fontSize: 18, fontWeight: '800' }}>{u(locale, 'dangerZone')}</Text><Text style={{ color: theme.text, fontSize: 12 }}>{u(locale, 'noBulkActions')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><ActionButton locale={locale} theme={theme} label="suspendUser" allowed={capability(identity, actions.suspend.capability) && normalizedAccountStatus !== 'SUSPENDED'} onPress={() => begin('suspend')} danger /><ActionButton locale={locale} theme={theme} label="banUser" allowed={capability(identity, actions.ban.capability) && normalizedAccountStatus !== 'BANNED'} onPress={() => begin('ban')} danger /><ActionButton locale={locale} theme={theme} label="requestDeletion" allowed={capability(identity, actions['deletion-request'].capability)} onPress={() => begin('deletion-request')} danger /></View></View>
    <CriticalActionDialog visible={Boolean(dialogAction)} title={dialogAction ? u(locale, dialogAction.title) : ''} production={dialogAction?.dangerous ?? false} onCancel={() => { if (!busy) { setDialogAction(null); setActionError(null); } }} onConfirm={submitDialog} copy={dialogCopy} busy={busy} error={actionError}>
      {dialogAction?.action === 'plan-override' && <MutationFields locale={locale} theme={theme} plan={overridePlan} onPlan={setOverridePlan} startsAt={startsAt} onStartsAt={setStartsAt} expiresAt={expiresAt} onExpiresAt={setExpiresAt} />}
      {dialogAction?.action === 'beta-access' && <MutationFields locale={locale} theme={theme} plan={betaPlan} onPlan={setBetaPlan} startsAt={startsAt} onStartsAt={setStartsAt} expiresAt={expiresAt} onExpiresAt={setExpiresAt} beta />}
      {dialogAction?.action === 'quota-adjustment' && <QuotaFields locale={locale} theme={theme} resource={quotaResource} onResource={setQuotaResource} amount={quotaAmount} onAmount={setQuotaAmount} cycleId={quotaCycleId} onCycleId={setQuotaCycleId} />}
    </CriticalActionDialog>
    <StepUpDialog locale={locale} visible={Boolean(stepUp)} code={stepUpCode} error={stepUpError} busy={busy} onChange={setStepUpCode} onCancel={() => { if (!busy) { setStepUp(null); setStepUpCode(''); setStepUpError(null); } }} onConfirm={() => { void resumeAfterStepUp(); }} />
  </View>;
}

function PageButtons({ locale, theme, data, onChange }: { locale: 'fr' | 'en'; theme: Theme; data: UnknownRecord | undefined; onChange(page: number): void }) {
  const page = recordNumber(data, ['page']) ?? 1; const totalPages = recordNumber(data, ['totalPages']);
  if (!totalPages || totalPages <= 1) return null;
  return <View style={{ marginTop: 11, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 9 }}><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'previous')} accessibilityState={{ disabled: page <= 1 }} disabled={page <= 1} onPress={() => onChange(page - 1)} style={{ opacity: page <= 1 ? .45 : 1, padding: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 7 }}><Text style={{ color: theme.text }}>{u(locale, 'previous')}</Text></Pressable><Text style={{ color: theme.muted, fontSize: 12 }}>{u(locale, 'page')} {page} / {totalPages}</Text><Pressable accessibilityRole="button" accessibilityLabel={u(locale, 'next')} accessibilityState={{ disabled: page >= totalPages }} disabled={page >= totalPages} onPress={() => onChange(page + 1)} style={{ opacity: page >= totalPages ? .45 : 1, padding: 8, borderWidth: 1, borderColor: theme.border, borderRadius: 7 }}><Text style={{ color: theme.text }}>{u(locale, 'next')}</Text></Pressable></View>;
}

function MutationFields({ locale, theme, plan, onPlan, startsAt, onStartsAt, expiresAt, onExpiresAt, beta = false }: { locale: 'fr' | 'en'; theme: Theme; plan: string; onPlan(value: string): void; startsAt: string; onStartsAt(value: string): void; expiresAt: string; onExpiresAt(value: string): void; beta?: boolean }) {
  const choices = beta ? [{ value: 'pro', label: 'betaProTest' as const }, { value: 'pro_max', label: 'betaProMaxTest' as const }] : [{ value: 'pro', label: 'pro' as const }, { value: 'pro_max', label: 'proMax' as const }];
  return <View style={{ gap: 8 }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{u(locale, 'selectPlan')}</Text><View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{choices.map((choice) => <Pressable key={choice.value} accessibilityRole="radio" accessibilityState={{ selected: plan === choice.value }} onPress={() => onPlan(choice.value)} style={{ borderWidth: 1, borderColor: plan === choice.value ? theme.primary : theme.border, backgroundColor: plan === choice.value ? theme.primarySoft : 'transparent', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 }}><Text style={{ color: plan === choice.value ? theme.primary : theme.text, fontWeight: '700', fontSize: 12 }}>{u(locale, choice.label)}</Text></Pressable>)}</View><TextInput accessibilityLabel={u(locale, 'startsAt')} value={startsAt} onChangeText={onStartsAt} placeholder="2026-09-15T00:00:00Z" placeholderTextColor={theme.muted} style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9 }} /><TextInput accessibilityLabel={u(locale, 'expiresAt')} value={expiresAt} onChangeText={onExpiresAt} placeholder="2026-10-15T00:00:00Z" placeholderTextColor={theme.muted} style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9 }} /></View>;
}

function QuotaFields({ locale, theme, resource, onResource, amount, onAmount, cycleId, onCycleId }: { locale: 'fr' | 'en'; theme: Theme; resource: string; onResource(value: string): void; amount: string; onAmount(value: string): void; cycleId: string; onCycleId(value: string): void }) {
  const style = { color: theme.text, borderWidth: 1, borderColor: theme.border, borderRadius: 7, padding: 9 } as const;
  return <View style={{ gap: 8 }}><TextInput accessibilityLabel={u(locale, 'adjustmentResource')} value={resource} onChangeText={onResource} placeholder="AI_TEXT" placeholderTextColor={theme.muted} autoCapitalize="characters" style={style} /><TextInput accessibilityLabel={u(locale, 'adjustmentAmount')} value={amount} onChangeText={onAmount} placeholder="100" placeholderTextColor={theme.muted} keyboardType="numeric" style={style} /><TextInput accessibilityLabel={u(locale, 'adjustmentCycleId')} value={cycleId} onChangeText={onCycleId} placeholder={u(locale, 'adjustmentCycleId')} placeholderTextColor={theme.muted} style={style} /></View>;
}

function StepUpDialog({ locale, visible, code, error, busy, onChange, onCancel, onConfirm }: { locale: 'fr' | 'en'; visible: boolean; code: string; error: string | null; busy: boolean; onChange(value: string): void; onCancel(): void; onConfirm(): void }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}><View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0008' }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 440, padding: 22, borderRadius: 12, gap: 12, backgroundColor: '#fff' }}><Text accessibilityRole="header" style={{ color: '#0f172a', fontSize: 20, fontWeight: '800' }}>{u(locale, 'stepUpRequired')}</Text><Text style={{ color: '#334155' }}>{u(locale, 'stepUpHint')}</Text><TextInput accessibilityLabel={u(locale, 'authenticationCode')} value={code} onChangeText={onChange} keyboardType="number-pad" maxLength={6} placeholder="000000" style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, padding: 10 }} />{error && <Text accessibilityRole="alert" style={{ color: '#b91c1c' }}>{error}</Text>}<View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 11 }}><Pressable accessibilityRole="button" disabled={busy} onPress={onCancel}><Text>{u(locale, 'cancel')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || code.length !== 6 }} disabled={busy || code.length !== 6} onPress={onConfirm} style={{ opacity: busy || code.length !== 6 ? .5 : 1, backgroundColor: '#2563eb', borderRadius: 7, paddingHorizontal: 11, paddingVertical: 9 }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{u(locale, 'verifyAndContinue')}</Text>}</Pressable></View></View></View></Modal>;
}
