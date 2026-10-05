import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { AdminStepUpDialog } from './AdminStepUpDialog';
import { useAuth, type AdminIdentity } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import { type ApiProblem } from '../lib/api';
import { cc } from '../lib/commercial-i18n';
import {
  commercialNumber,
  commercialString,
  commercialValue,
  getCommercialSection,
  type CommercialRecord,
  type CommercialSection,
  type CommercialSectionName,
  type PricingUpdate,
  updatePlanPricing,
} from '../lib/commercial';
import { isAdminStepUpRequired } from '../lib/admin-step-up';
import { completeAdminStepUp } from '../lib/users';

type Theme = {
  surface: string; mutedSurface: string; border: string; text: string; muted: string;
  primary: string; primarySoft: string; danger: string; dangerSoft: string;
  success: string; successSoft: string; warning: string; warningSoft: string;
};

type CommercialTab = CommercialSectionName;

type TabDefinition = {
  id: CommercialTab;
  label: Parameters<typeof cc>[1];
  capability: string;
};

const tabs: readonly TabDefinition[] = [
  { id: 'overview', label: 'overview', capability: 'plans.read' },
  { id: 'plans', label: 'plans', capability: 'plans.read' },
  { id: 'subscriptions', label: 'subscriptions', capability: 'subscriptions.read' },
  { id: 'payments', label: 'payments', capability: 'payments.read' },
  { id: 'usage', label: 'usage', capability: 'usage.read' },
  { id: 'features', label: 'features', capability: 'feature_flags.read' },
  { id: 'settings', label: 'settings', capability: 'settings.read' },
  { id: 'audit', label: 'audit', capability: 'audit.read' },
] as const;

const forbiddenField = /(secret|password|passphrase|token|credential|authorization|cookie|connection(?:string|url)?|private|api[_-]?key|smtp|jwt|totp|hash)/i;
const dateField = /(at|date|timestamp|renewal|expiry|expires|cycle)/i;
const moneyField = /(price|amount|cost)/i;
const sentinel = new Set(['NOT_CONFIGURED', 'NOT_AVAILABLE', 'NOT_SUPPORTED', 'BUSINESS_DECISION_REQUIRED', 'UNKNOWN', 'NOT_INSTRUMENTED', 'INSUFFICIENT_DATA']);

const fieldsByTab: Record<CommercialTab, readonly string[]> = {
  overview: ['status', 'plan', 'activeSubscriptions', 'currency', 'configuredAt', 'updatedAt'],
  plans: ['code', 'slug', 'name', 'status', 'priceMonthly', 'priceYearly', 'currency', 'version', 'configurationVersion', 'configuredAt', 'updatedAt', 'entitlements', 'quotas', 'fallback'],
  subscriptions: ['user', 'email', 'plan', 'status', 'interval', 'cycleStart', 'cycleEnd', 'nextRenewal', 'cancellation', 'expiry', 'entitlementState', 'quotaState'],
  payments: ['status', 'providerReference', 'amount', 'currency', 'plan', 'user', 'email', 'purchaseType', 'occurredAt'],
  usage: ['user', 'email', 'plan', 'feature', 'provider', 'model', 'period', 'used', 'limit', 'quotaState', 'status'],
  features: ['key', 'name', 'status', 'enabled', 'scope', 'targeting', 'support'],
  settings: ['key', 'name', 'value', 'status', 'authority', 'updatedAt'],
  audit: ['actor', 'role', 'action', 'resource', 'before', 'after', 'timestamp', 'correlationId', 'reason'],
};

function themeFor(dark: boolean): Theme {
  return dark
    ? { surface: '#111827', mutedSurface: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', danger: '#f87171', dangerSoft: '#450a0a', success: '#34d399', successSoft: '#052e2b', warning: '#fbbf24', warningSoft: '#422006' }
    : { surface: '#fff', mutedSurface: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#64748b', primary: '#2563eb', primarySoft: '#dbeafe', danger: '#dc2626', dangerSoft: '#fee2e2', success: '#047857', successSoft: '#ecfdf5', warning: '#b45309', warningSoft: '#fef3c7' };
}

function hasCapability(identity: AdminIdentity | null, capability: string): boolean {
  return identity?.roles.includes('SUPER_ADMIN') === true || identity?.capabilities.includes(capability) === true;
}

function isSafeKey(key: string): boolean {
  return !forbiddenField.test(key);
}

function safeText(value: unknown, depth = 0): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    // A JWT-like value must never leak through an otherwise safe field name.
    if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) return '[REDACTED]';
    return trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (depth >= 2) return undefined;
  if (Array.isArray(value)) {
    const values = value.map((item) => safeText(item, depth + 1)).filter((item): item is string => Boolean(item));
    return values.length ? values.slice(0, 6).join(', ') : undefined;
  }
  if (typeof value === 'object') {
    const entries: Array<[string, string]> = [];
    for (const [key, item] of Object.entries(value as CommercialRecord)) {
      if (!isSafeKey(key)) continue;
      const text = safeText(item, depth + 1);
      if (text) entries.push([key, text]);
    }
    return entries.length ? entries.slice(0, 4).map(([key, item]) => `${key}: ${item}`).join(' · ') : undefined;
  }
  return undefined;
}

function labelFor(locale: 'en' | 'fr', key: string): string {
  const labels: Record<string, Parameters<typeof cc>[1]> = {
    code: 'code', slug: 'code', name: 'name', plan: 'plan', user: 'user', status: 'status', currency: 'currency', version: 'version', configurationVersion: 'version',
    configuredAt: 'configuredAt', updatedAt: 'configuredAt', priceMonthly: 'monthlyPrice', priceMonthlyCents: 'monthlyPrice', monthlyPrice: 'monthlyPrice',
    priceYearly: 'annualPrice', priceYearlyCents: 'annualPrice', yearlyPrice: 'annualPrice', entitlements: 'entitlements', quotas: 'quotas', fallback: 'fallback',
    quotaState: 'quotaState', entitlementState: 'entitlementState', interval: 'interval', cycleStart: 'cycleStart', cycleStartAt: 'cycleStart', cycleEnd: 'cycleEnd', cycleEndAt: 'cycleEnd',
    nextRenewal: 'nextRenewal', nextRenewalAt: 'nextRenewal', cancellation: 'cancellation', cancelAt: 'cancellation', expiry: 'expiry', expiresAt: 'expiry',
    providerReference: 'providerReference', amount: 'amount', purchaseType: 'purchaseType', occurredAt: 'occurredAt', createdAt: 'occurredAt',
    feature: 'feature', provider: 'provider', model: 'model', period: 'period', used: 'used', limit: 'limit', scope: 'scope', targeting: 'targeting', authority: 'authority', value: 'value',
    actor: 'actor', role: 'role', action: 'action', resource: 'resource', before: 'before', after: 'after', timestamp: 'timestamp', correlationId: 'correlationId', reason: 'reason',
  };
  return cc(locale, labels[key] ?? 'value');
}

function formatDate(locale: 'en' | 'fr', value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
}

function formatMoney(locale: 'en' | 'fr', minor: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${minor / 100} ${currency}`;
  }
}

function formatCell(locale: 'en' | 'fr', key: string, value: unknown, row: CommercialRecord): string {
  const text = safeText(value);
  if (!text) return cc(locale, 'notAvailable');
  if (sentinel.has(text.toUpperCase())) return text.toUpperCase();
  if (dateField.test(key) && typeof value === 'string') return formatDate(locale, value);
  if (moneyField.test(key)) {
    const amount = typeof value === 'number' ? value : Number(value);
    const currency = commercialString(row, ['currency']);
    if (Number.isSafeInteger(amount) && currency) return formatMoney(locale, amount, currency);
  }
  return text;
}

function rowKeys(tab: CommercialTab, row: CommercialRecord): string[] {
  const configured = fieldsByTab[tab].filter((key) => row[key] !== undefined && row[key] !== null && isSafeKey(key));
  if (configured.length) return configured;
  return Object.keys(row).filter(isSafeKey).slice(0, 8);
}

function statusStyle(theme: Theme, value: string | undefined): { backgroundColor: string; color: string } {
  const normalized = value?.toUpperCase() ?? '';
  if (normalized === 'PRIMARY' || normalized === 'ACTIVE' || normalized === 'SUCCESS' || normalized === 'ENABLED') return { backgroundColor: theme.successSoft, color: theme.success };
  if (normalized === 'FALLBACK' || normalized === 'PENDING' || normalized === 'NOT_CONFIGURED' || normalized === 'NOT_AVAILABLE' || normalized === 'NOT_SUPPORTED' || normalized === 'BUSINESS_DECISION_REQUIRED') return { backgroundColor: theme.warningSoft, color: theme.warning };
  if (normalized === 'BLOCKED' || normalized === 'FAILED' || normalized === 'ERROR' || normalized === 'DISABLED') return { backgroundColor: theme.dangerSoft, color: theme.danger };
  return { backgroundColor: theme.primarySoft, color: theme.primary };
}

function StatePanel({ section, locale, theme, onRetry }: { section: CommercialSection; locale: 'en' | 'fr'; theme: Theme; onRetry(): void }) {
  if (section.state === 'available') return null;
  const isForbidden = section.state === 'forbidden';
  const unavailable = section.state === 'unavailable';
  const title = isForbidden ? cc(locale, 'noPermission') : unavailable ? cc(locale, 'unavailable') : section.state === 'empty' ? cc(locale, 'noData') : cc(locale, 'pricingFailed');
  const detail = isForbidden ? cc(locale, 'noPermissionDetail') : section.state === 'empty' ? cc(locale, 'emptyItems') : section.reason;
  return <View accessibilityRole={section.state === 'error' || isForbidden ? 'alert' : 'text'} style={{ padding: 18, alignItems: 'center', gap: 9, borderRadius: 12, borderWidth: 1, borderColor: isForbidden || section.state === 'error' ? theme.danger : theme.border, backgroundColor: isForbidden || section.state === 'error' ? theme.dangerSoft : theme.surface }}>
    <Text style={{ color: isForbidden || section.state === 'error' ? theme.danger : theme.text, fontWeight: '800', fontSize: 15, textAlign: 'center' }}>{title}</Text>
    {detail ? <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 12 }}>{detail}</Text> : null}
    {section.state === 'error' || unavailable ? <Pressable accessibilityRole="button" accessibilityLabel={cc(locale, 'retry')} onPress={onRetry} style={{ backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{cc(locale, 'retry')}</Text></Pressable> : null}
  </View>;
}

function RecordTable({ tab, rows, locale, theme }: { tab: CommercialTab; rows: CommercialRecord[]; locale: 'en' | 'fr'; theme: Theme }) {
  const columns = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => rowKeys(tab, row).forEach((key) => values.add(key)));
    return Array.from(values).slice(0, 12);
  }, [rows, tab]);
  if (!rows.length || !columns.length) return <View style={{ padding: 16, borderRadius: 10, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted }}>{cc(locale, 'emptyItems')}</Text></View>;
  return <ScrollView horizontal showsHorizontalScrollIndicator accessibilityLabel={cc(locale, 'title')} contentContainerStyle={{ minWidth: '100%' }}>
    <View style={{ minWidth: Math.max(680, columns.length * 145), borderWidth: 1, borderColor: theme.border, borderRadius: 10, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', backgroundColor: theme.mutedSurface }}>{columns.map((key) => <View key={key} style={{ width: 145, padding: 10 }}><Text accessibilityRole="header" style={{ color: theme.muted, fontSize: 10, fontWeight: '800' }}>{labelFor(locale, key)}</Text></View>)}</View>
      {rows.map((row, index) => <View key={commercialString(row, ['id', 'slug', 'code', 'correlationId']) ?? String(index)} style={{ flexDirection: 'row', backgroundColor: index % 2 ? theme.mutedSurface : theme.surface, borderTopWidth: index ? 1 : 0, borderColor: theme.border }}>
        {columns.map((key) => <View key={key} style={{ width: 145, padding: 10 }}><Text selectable numberOfLines={3} style={{ color: theme.text, fontSize: 12 }}>{formatCell(locale, key, row[key], row)}</Text></View>)}
      </View>)}
    </View>
  </ScrollView>;
}

function MinorCurrencyInput({ label, value, locale, theme, onChange }: { label: string; value: string; locale: 'en' | 'fr'; theme: Theme; onChange(value: string): void }) {
  return <View style={{ gap: 5 }}><Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={theme.muted} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text, backgroundColor: theme.surface }} /></View>;
}

function minorToInput(value: number | undefined): string {
  return value === undefined || !Number.isSafeInteger(value) ? '' : (value / 100).toFixed(2);
}

/** Accept only a USD decimal amount that can be represented exactly as cents. */
function usdToMinor(value: string): number | undefined {
  const match = value.trim().match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) return undefined;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100 + fraction;
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : undefined;
}

function planSlug(row: CommercialRecord | undefined): string | undefined {
  return commercialString(row, ['slug', 'code', 'planCode']);
}

function planCurrency(row: CommercialRecord | undefined): string | undefined {
  return commercialString(row, ['currency'])?.toUpperCase();
}

function PlanCards({ rows, locale, theme, canManage, onEdit }: { rows: CommercialRecord[]; locale: 'en' | 'fr'; theme: Theme; canManage: boolean; onEdit(row: CommercialRecord): void }) {
  if (!rows.length) return <View style={{ padding: 16, borderRadius: 10, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted }}>{cc(locale, 'emptyItems')}</Text></View>;
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{rows.map((row, index) => {
    const currency = planCurrency(row);
    const monthly = commercialNumber(row, ['priceMonthly', 'priceMonthlyCents', 'monthlyPrice']);
    const yearly = commercialNumber(row, ['priceYearly', 'priceYearlyCents', 'yearlyPrice']);
    const version = commercialNumber(row, ['expectedVersion', 'version', 'configurationVersion']);
    const slug = planSlug(row);
    const status = commercialString(row, ['status', 'state']);
    const quotaStates = [commercialString(row, ['primaryState']), commercialString(row, ['fallbackState']), commercialString(row, ['blockedState'])].filter((value): value is string => Boolean(value));
    const editable = canManage && Boolean(slug) && currency === 'USD' && Number.isSafeInteger(version);
    return <View key={slug ?? String(index)} style={{ flexBasis: 290, flexGrow: 1, maxWidth: 470, padding: 16, gap: 11, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{commercialString(row, ['name', 'displayName', 'code', 'slug']) ?? cc(locale, 'notConfigured')}</Text><Text style={{ color: theme.muted, marginTop: 2, fontSize: 11 }}>{slug ?? cc(locale, 'notConfigured')}</Text></View>{status ? <StatusBadge value={status} theme={theme} /> : null}</View>
      <View style={{ flexDirection: 'row', gap: 16 }}><Metric label={cc(locale, 'monthlyPrice')} value={monthly === undefined || !currency ? cc(locale, 'notConfigured') : formatMoney(locale, monthly, currency)} theme={theme} /><Metric label={cc(locale, 'annualPrice')} value={yearly === undefined || !currency ? cc(locale, 'notConfigured') : formatMoney(locale, yearly, currency)} theme={theme} /></View>
      <View style={{ gap: 4 }}><Text style={{ color: theme.muted, fontSize: 11 }}>{cc(locale, 'quotaPolicy')}</Text><Text numberOfLines={3} style={{ color: theme.text, fontSize: 12 }}>{formatCell(locale, 'quotas', commercialValue(row, ['quotas']), row)}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{cc(locale, 'fallback')}</Text><Text numberOfLines={2} style={{ color: theme.text, fontSize: 12 }}>{formatCell(locale, 'fallback', commercialValue(row, ['fallback', 'fallbackPolicy']), row)}</Text></View>
      {quotaStates.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{quotaStates.map((value) => <StatusBadge key={value} value={value} theme={theme} />)}</View> : null}
      {canManage ? <Pressable accessibilityRole="button" accessibilityLabel={`${cc(locale, 'editPricing')} ${slug ?? ''}`} accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={() => onEdit(row)} style={{ alignSelf: 'flex-start', opacity: editable ? 1 : .55, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{cc(locale, 'editPricing')}</Text></Pressable> : null}
      {canManage && !editable ? <Text style={{ color: theme.warning, fontSize: 11 }}>{cc(locale, 'pricingUnavailable')}</Text> : null}
    </View>;
  })}</View>;
}

function Metric({ label, value, theme }: { label: string; value: string; theme: Theme }) {
  return <View style={{ flex: 1, gap: 2 }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '700' }}>{label}</Text><Text style={{ color: theme.text, fontSize: 15, fontWeight: '800' }}>{value}</Text></View>;
}

function StatusBadge({ value, theme }: { value: string; theme: Theme }) {
  const style = statusStyle(theme, value);
  return <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: style.backgroundColor }}><Text style={{ color: style.color, fontSize: 10, fontWeight: '900' }}>{value}</Text></View>;
}

function PricingDialog({ visible, plan, monthly, yearly, reason, error, busy, locale, theme, onMonthly, onYearly, onReason, onClose, onSubmit }: { visible: boolean; plan: CommercialRecord | null; monthly: string; yearly: string; reason: string; error: string | null; busy: boolean; locale: 'en' | 'fr'; theme: Theme; onMonthly(value: string): void; onYearly(value: string): void; onReason(value: string): void; onClose(): void; onSubmit(): void }) {
  if (!plan) return null;
  const version = commercialNumber(plan, ['expectedVersion', 'version']);
  const title = commercialString(plan, ['name', 'code', 'slug']) ?? cc(locale, 'plans');
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008' }}><View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, padding: 20, gap: 13, borderRadius: 13, backgroundColor: theme.surface }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{cc(locale, 'officialPricing')}</Text><Text style={{ color: theme.muted, marginTop: 3 }}>{title}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={cc(locale, 'close')} disabled={busy} onPress={onClose}><Text style={{ color: theme.primary, fontWeight: '800' }}>{cc(locale, 'close')}</Text></Pressable></View>
      <MinorCurrencyInput locale={locale} label={cc(locale, 'priceMonthly')} value={monthly} theme={theme} onChange={onMonthly} />
      <MinorCurrencyInput locale={locale} label={cc(locale, 'priceYearly')} value={yearly} theme={theme} onChange={onYearly} />
      <View style={{ gap: 5 }}><Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{cc(locale, 'reason')}</Text><TextInput accessibilityLabel={cc(locale, 'reason')} value={reason} onChangeText={onReason} multiline maxLength={500} placeholder={cc(locale, 'reasonHint')} placeholderTextColor={theme.muted} style={{ minHeight: 76, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 10, color: theme.text, backgroundColor: theme.surface }} /></View>
      <Text style={{ color: theme.muted, fontSize: 11 }}>{cc(locale, 'expectedVersion')}: {version ?? cc(locale, 'notConfigured')}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{cc(locale, 'pricingSafety')}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger, fontSize: 12 }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, alignItems: 'center' }}><Pressable accessibilityRole="button" disabled={busy} onPress={onClose}><Text style={{ color: theme.muted, fontWeight: '800' }}>{cc(locale, 'cancel')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={cc(locale, 'savePricing')} disabled={busy} onPress={onSubmit} style={{ opacity: busy ? .6 : 1, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: theme.primary }}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{cc(locale, 'savePricing')}</Text>}</Pressable></View>
    </View></View>
  </Modal>;
}

export function CommercialControlCenter({ initialSection }: { initialSection: CommercialTab }) {
  const { identity } = useAuth(); const { dark, locale } = useAdminUi(); const { width } = useWindowDimensions();
  const theme = useMemo(() => themeFor(dark), [dark]);
  const [activeTab, setActiveTab] = useState<CommercialTab>(initialSection);
  const [section, setSection] = useState<CommercialSection>({ state: 'loading', items: [] });
  const [loading, setLoading] = useState(false); const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CommercialRecord | null>(null);
  const [monthly, setMonthly] = useState(''); const [yearly, setYearly] = useState(''); const [reason, setReason] = useState('');
  const [pricingError, setPricingError] = useState<string | null>(null); const [pricingMessage, setPricingMessage] = useState<string | null>(null); const [mutationBusy, setMutationBusy] = useState(false);
  const [stepUpVisible, setStepUpVisible] = useState(false); const [stepUpCode, setStepUpCode] = useState(''); const [stepUpError, setStepUpError] = useState<string | null>(null);
  const tab = tabs.find((item) => item.id === activeTab) ?? tabs[0];
  const canRead = hasCapability(identity, tab.capability);
  const canManagePricing = hasCapability(identity, 'plans.manage') && hasCapability(identity, 'provider_pricing.manage');

  useEffect(() => { setActiveTab(initialSection); }, [initialSection]);
  const load = useCallback(async () => {
    if (!canRead) { setSection({ state: 'forbidden', items: [] }); return; }
    setLoading(true); setSection({ state: 'loading', items: [] }); setPricingMessage(null);
    try { setSection(await getCommercialSection(activeTab)); setUpdatedAt(new Date().toISOString()); }
    finally { setLoading(false); }
  }, [activeTab, canRead]);
  useEffect(() => { void load(); }, [load]);

  const selectTab = (next: CommercialTab) => { setActiveTab(next); setSelectedPlan(null); setPricingError(null); setPricingMessage(null); };
  const openPricing = (row: CommercialRecord) => {
    setSelectedPlan(row); setMonthly(minorToInput(commercialNumber(row, ['priceMonthly', 'priceMonthlyCents', 'monthlyPrice']))); setYearly(minorToInput(commercialNumber(row, ['priceYearly', 'priceYearlyCents', 'yearlyPrice']))); setReason(''); setPricingError(null); setPricingMessage(null);
  };
  const closePricing = () => { if (!mutationBusy) { setSelectedPlan(null); setPricingError(null); } };
  const pricingPayload = (): PricingUpdate | null => {
    const priceMonthly = usdToMinor(monthly); const priceYearly = usdToMinor(yearly); const expectedVersion = commercialNumber(selectedPlan ?? undefined, ['expectedVersion', 'version', 'configurationVersion']);
    if (priceMonthly === undefined || priceYearly === undefined) { setPricingError(cc(locale, 'invalidPrice')); return null; }
    if (typeof expectedVersion !== 'number' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) { setPricingError(cc(locale, 'invalidVersion')); return null; }
    if (!reason.trim()) { setPricingError(cc(locale, 'invalidReason')); return null; }
    return { priceMonthly, priceYearly, expectedVersion, reason: reason.trim() };
  };
  const savePricing = async (afterStepUp: boolean) => {
    const payload = pricingPayload(); const slug = planSlug(selectedPlan ?? undefined);
    if (!payload || !slug) return;
    setMutationBusy(true); setPricingError(null);
    try {
      await updatePlanPricing(slug, payload);
      setSelectedPlan(null); setStepUpVisible(false); setStepUpCode(''); setPricingMessage(cc(locale, 'pricingSaved')); await load();
    } catch (error) {
      const problem = error as ApiProblem;
      if (!afterStepUp && isAdminStepUpRequired(problem)) { setStepUpVisible(true); setStepUpError(null); }
      else setPricingError(problem.message || cc(locale, 'pricingFailed'));
    } finally { setMutationBusy(false); }
  };
  const confirmStepUp = async () => {
    const payload = pricingPayload();
    if (!payload) return;
    setMutationBusy(true); setStepUpError(null);
    try { await completeAdminStepUp(stepUpCode); setStepUpVisible(false); setStepUpCode(''); }
    catch (error) { const problem = error as ApiProblem; setStepUpError(problem.message || cc(locale, 'pricingFailed')); setMutationBusy(false); return; }
    setMutationBusy(false); await savePricing(true);
  };
  const explanation = activeTab === 'features' ? cc(locale, 'featureReadOnly') : activeTab === 'settings' ? cc(locale, 'settingsReadOnly') : activeTab === 'audit' ? cc(locale, 'auditReadOnly') : activeTab === 'plans' ? cc(locale, 'commercialStatuses') : null;
  const displayRows = activeTab === 'overview' && !section.items.length && section.data ? [section.data] : section.items;

  return <View style={{ gap: 16, paddingBottom: 32 }} testID="commercial-control-center">
    <View style={{ flexDirection: width < 700 ? 'column' : 'row', gap: 12, justifyContent: 'space-between', alignItems: width < 700 ? 'flex-start' : 'flex-start' }}>
      <View style={{ flex: 1, maxWidth: 930 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{cc(locale, 'title')}</Text><View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.primarySoft }}><Text style={{ color: theme.primary, fontSize: 9, fontWeight: '900' }}>{cc(locale, 'dataAuthority')}</Text></View></View><Text style={{ color: theme.muted, marginTop: 7, fontSize: 13 }}>{cc(locale, 'subtitle')}</Text>{pricingMessage ? <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={{ color: theme.success, marginTop: 7, fontSize: 12, fontWeight: '700' }}>{pricingMessage}</Text> : null}</View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 11 }}>{updatedAt ? `${cc(locale, 'updated')}: ${formatDate(locale, updatedAt)}` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel={cc(locale, 'refresh')} disabled={loading} onPress={() => void load()} style={{ opacity: loading ? .6 : 1, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary }}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{cc(locale, 'refresh')}</Text>}</Pressable></View>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }} accessibilityRole="tablist">{tabs.map((item) => <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: activeTab === item.id }} aria-selected={activeTab === item.id} accessibilityLabel={cc(locale, item.label)} onPress={() => selectTab(item.id)} style={{ paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: activeTab === item.id ? theme.primary : theme.border, borderRadius: 999, backgroundColor: activeTab === item.id ? theme.primarySoft : theme.surface }}><Text style={{ color: activeTab === item.id ? theme.primary : theme.muted, fontWeight: '800', fontSize: 12 }}>{cc(locale, item.label)}</Text></Pressable>)}</ScrollView>
    {explanation ? <View style={{ padding: 12, borderLeftWidth: 3, borderColor: theme.primary, borderRadius: 8, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted, fontSize: 12 }}>{explanation}</Text></View> : null}
    {loading && section.state === 'loading' ? <View accessibilityLabel={cc(locale, 'loading')} style={{ minHeight: 220, justifyContent: 'center', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted }}>{cc(locale, 'loading')}</Text></View> : <StatePanel section={section} locale={locale} theme={theme} onRetry={() => void load()} />}
    {section.state === 'available' ? <View style={{ gap: 14 }}>
      {activeTab === 'plans' ? <PlanCards rows={section.items} locale={locale} theme={theme} canManage={canManagePricing} onEdit={openPricing} /> : <RecordTable tab={activeTab} rows={displayRows} locale={locale} theme={theme} />}
      {activeTab === 'plans' && section.items.length ? <View style={{ padding: 13, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{cc(locale, 'quotaPolicy')}</Text><Text style={{ color: theme.muted, marginTop: 4, fontSize: 12 }}>{cc(locale, 'commercialStatuses')}</Text></View> : null}
    </View> : null}
    <PricingDialog visible={Boolean(selectedPlan)} plan={selectedPlan} monthly={monthly} yearly={yearly} reason={reason} error={pricingError} busy={mutationBusy} locale={locale} theme={theme} onMonthly={setMonthly} onYearly={setYearly} onReason={setReason} onClose={closePricing} onSubmit={() => void savePricing(false)} />
    <AdminStepUpDialog visible={stepUpVisible} code={stepUpCode} error={stepUpError} busy={mutationBusy} labels={{ title: cc(locale, 'stepUpTitle'), hint: cc(locale, 'stepUpHint'), code: cc(locale, 'authenticationCode'), cancel: cc(locale, 'cancel'), confirm: cc(locale, 'verify') }} onChange={setStepUpCode} onCancel={() => { if (!mutationBusy) { setStepUpVisible(false); setStepUpCode(''); setStepUpError(null); } }} onConfirm={() => void confirmStepUp()} />
  </View>;
}
