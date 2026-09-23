import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import { api, type ApiProblem } from '../lib/api';
import {
  dashboardList,
  dashboardNumber,
  dashboardRecord,
  dashboardSectionStatus,
  dashboardString,
  getDashboardSection,
  type DashboardRange,
  type DashboardResponse,
  type DashboardSection,
  type DashboardSectionKey,
} from '../lib/dashboard';
import { t, type Locale } from '../lib/i18n';

type Theme = {
  dark: boolean;
  page: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
};

const ranges: DashboardRange[] = ['today', '7d', '30d'];
const rangeLabels: Record<DashboardRange, 'today' | 'days7' | 'days30'> = { today: 'today', '7d': 'days7', '30d': 'days30' };

const kpiDefinitions = [
  { id: 'totalUsers', label: 'totalUsers', names: ['totalUsers', 'usersTotal', 'total_users'] },
  { id: 'activeToday', label: 'activeToday', names: ['activeToday', 'active_today'] },
  { id: 'active7d', label: 'active7d', names: ['active7d', 'active7Days', 'active_7d', 'active_7_days'] },
  { id: 'active30d', label: 'active30d', names: ['active30d', 'active30Days', 'active_30d', 'active_30_days'] },
  { id: 'newUsersToday', label: 'newUsersToday', names: ['newUsersToday', 'new_users_today'] },
  { id: 'newUsersThisMonth', label: 'newUsersThisMonth', names: ['newUsersThisMonth', 'new_users_this_month'] },
] as const;

const planDefinitions = [
  { id: 'FREE', label: 'planFree' },
  { id: 'PRO', label: 'planPro' },
  { id: 'PRO_MAX', label: 'planProMax' },
] as const;

const quotaDefinitions = [
  { id: 'PRIMARY', label: 'primary', color: 'success' },
  { id: 'FALLBACK', label: 'fallback', color: 'warning' },
  { id: 'BLOCKED', label: 'blocked', color: 'danger' },
] as const;

const subscriptionDefinitions = [
  { id: 'ACTIVE', label: 'active' },
  { id: 'PAYMENT_PENDING', label: 'paymentPending' },
  { id: 'PAST_DUE', label: 'pastDue' },
  { id: 'PAYMENT_FAILED', label: 'paymentFailed' },
  { id: 'CANCELED', label: 'canceled' },
  { id: 'EXPIRED', label: 'expired' },
] as const;

function makeTheme(dark: boolean): Theme {
  return dark
    ? {
      dark, page: '#090f1a', surface: '#111827', surfaceMuted: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8',
      primary: '#60a5fa', primarySoft: '#172554', warning: '#fbbf24', warningSoft: '#422006', danger: '#f87171', dangerSoft: '#450a0a', success: '#34d399', successSoft: '#052e2b',
    }
    : {
      dark, page: '#f1f5f9', surface: '#ffffff', surfaceMuted: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#64748b',
      primary: '#2563eb', primarySoft: '#dbeafe', warning: '#b45309', warningSoft: '#fef3c7', danger: '#dc2626', dangerSoft: '#fee2e2', success: '#047857', successSoft: '#d1fae5',
    };
}

function recordValue(record: Record<string, unknown> | undefined, names: readonly string[]): unknown {
  if (!record) return undefined;
  for (const name of names) if (record[name] !== undefined) return record[name];
  return undefined;
}

function normalizeId(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/[ -]/g, '_');
}

function pickNumber(record: Record<string, unknown> | undefined, names: readonly string[]): number | undefined {
  return dashboardNumber(recordValue(record, names));
}

function findNamedRecord(data: unknown, names: readonly string[]): Record<string, unknown> | undefined {
  const root = dashboardRecord(data);
  const sources = [root, dashboardRecord(root?.metrics), dashboardRecord(root?.kpis), dashboardRecord(root?.values), dashboardRecord(root?.states)];
  for (const source of sources) {
    const direct = dashboardRecord(recordValue(source, names));
    if (direct) return direct;
  }
  const wanted = names.map(normalizeId);
  const rows = dashboardList(data, ['kpis', 'metrics', 'items', 'values', 'states']);
  return rows.find((row) => wanted.includes(normalizeId(recordValue(row, ['id', 'key', 'metric', 'name', 'code', 'state', 'status', 'plan']))));
}

function readNamedMetric(data: unknown, names: readonly string[]) {
  const root = dashboardRecord(data);
  const metric = findNamedRecord(data, names);
  const value = pickNumber(metric, ['value', 'count', 'total', 'users', 'amount'])
    ?? dashboardNumber(recordValue(root, names))
    ?? pickNumber(dashboardRecord(root?.metrics), names)
    ?? pickNumber(dashboardRecord(root?.kpis), names);
  const rawChange = recordValue(metric, ['change', 'delta', 'variation', 'percentChange']);
  const change = dashboardNumber(rawChange)
    ?? pickNumber(dashboardRecord(rawChange), ['percentage', 'percent', 'value', 'absolute'])
    ?? pickNumber(root, names.map((name) => `${name}Change`));
  const period = dashboardString(recordValue(metric, ['period', 'comparisonPeriod']));
  const unit = dashboardString(recordValue(metric, ['unit', 'suffix']));
  return { value, change, period, unit };
}

function sectionData<T>(section: DashboardSection<T>): T | undefined {
  return section.status === 'available' ? section.data : undefined;
}

function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }).format(value);
}

function formatMetric(locale: Locale, value: number | undefined, unit?: string): string {
  if (value === undefined) return '—';
  const normalized = unit?.toLowerCase();
  if (normalized === '%' || normalized === 'percent' || normalized === 'percentage') {
    const percent = value <= 1 ? value * 100 : value;
    return `${formatNumber(locale, percent)} %`;
  }
  return unit ? `${formatNumber(locale, value)} ${unit}` : formatNumber(locale, value);
}

function formatTimestamp(locale: Locale, value: unknown): string | undefined {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function statusColor(theme: Theme, status: string | undefined): { text: string; background: string } {
  switch (normalizeId(status)) {
    case 'HEALTHY': case 'AVAILABLE': case 'ACTIVE': case 'PRIMARY': return { text: theme.success, background: theme.successSoft };
    case 'DEGRADED': case 'WARNING': case 'FALLBACK': case 'MEDIUM': return { text: theme.warning, background: theme.warningSoft };
    case 'DOWN': case 'ERROR': case 'BLOCKED': case 'CRITICAL': case 'HIGH': return { text: theme.danger, background: theme.dangerSoft };
    default: return { text: theme.muted, background: theme.surfaceMuted };
  }
}

function statusLabel(locale: Locale, status: string | undefined): string {
  const normalized = normalizeId(status);
  const labels: Record<string, Parameters<typeof t>[1]> = {
    HEALTHY: 'healthy', DEGRADED: 'degraded', DOWN: 'down', UNKNOWN: 'unknown', AVAILABLE: 'available', UNAVAILABLE: 'unavailable', ERROR: 'error',
    PRIMARY: 'primary', FALLBACK: 'fallback', BLOCKED: 'blocked', ACTIVE: 'active', PAYMENT_PENDING: 'paymentPending', PAST_DUE: 'pastDue',
    PAYMENT_FAILED: 'paymentFailed', CANCELED: 'canceled', EXPIRED: 'expired', CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low',
  };
  return labels[normalized] ? t(locale, labels[normalized]) : (status ? String(status) : t(locale, 'unknown'));
}

function displayLabel(locale: Locale, value: unknown): string {
  const known: Record<string, Parameters<typeof t>[1]> = {
    AI_TEXT: 'aiText', DOCUMENTS: 'documentResource', DOCUMENT_PAGES: 'documentPagesResource', VOICE: 'voiceResource', VOICE_SECONDS: 'voiceSecondsResource',
    LANGUAGE_TEXT: 'languageText', LANGUAGE_VOICE: 'languageVoice', WEB_SEARCH: 'webSearch', DEEP_RESEARCH: 'deepResearch', ACADEMIC_AI: 'academicAiResource',
    OCR_PAGES: 'ocrPagesResource', EMBEDDING_UNITS: 'embeddingUnitsResource', ACADEMIC_WORKSPACE: 'academicWorkspace', TUTOR: 'tutor', FLASHCARDS: 'flashcards', QUIZ: 'quiz', FSRS: 'fsrs',
    FSRS_REVIEWS: 'fsrsReviews', DIGITAL_TWIN: 'digitalTwin', KNOWLEDGE_GRAPH: 'knowledgeGraph', LANGUAGES: 'languages',
    API: 'healthApi', POSTGRESQL: 'healthPostgresql', REDIS: 'healthRedis', QDRANT: 'healthQdrant', MAILER: 'healthMailer',
    LLM_PROVIDER: 'healthLlmProvider', SPEECH: 'healthSpeech', STORAGE: 'healthStorage', PAYMENT_PROVIDER: 'healthPaymentProvider', WORKERS_QUEUES: 'healthWorkersQueues',
    SUSPENDED_USERS: 'securitySuspendedUsers', BANNED_USERS: 'securityBannedUsers', ADMIN_SECURITY_EVENTS: 'securityAdminEvents',
    FAILED_ADMIN_MFA: 'securityFailedAdminMfa', TOKEN_REUSE_DETECTIONS: 'securityTokenReuseDetections',
    REGISTRATION: 'activityRegistration', PAYMENT_EVENT: 'activityPaymentEvent', INCIDENT_EVENT: 'activityIncidentEvent', QUOTA_BLOCKED: 'activityQuotaBlocked',
  };
  const raw = dashboardString(value);
  if (!raw) return t(locale, 'notAvailable');
  return known[normalizeId(raw)] ? t(locale, known[normalizeId(raw)]) : raw;
}

function alertLabel(locale: Locale, row: Record<string, unknown>): string {
  const explicit = dashboardString(recordValue(row, ['label', 'title']));
  if (explicit) return displayLabel(locale, explicit);
  const component = dashboardString(recordValue(row, ['component']));
  const key = dashboardString(recordValue(row, ['key', 'type', 'code', 'id']));
  if (component && normalizeId(key).startsWith('DEPENDENCY_DOWN')) {
    return `${displayLabel(locale, component)} — ${t(locale, 'down')}`;
  }
  return displayLabel(locale, component ?? key);
}

function useCapability(required: string[]): boolean {
  const { identity } = useAuth();
  const capabilities = identity?.capabilities ?? [];
  return identity?.roles.includes('SUPER_ADMIN') === true || required.some((capability) => capabilities.includes(capability));
}

function Skeleton({ theme, width = '100%', height = 14 }: { theme: Theme; width?: number | `${number}%`; height?: number }) {
  return <View accessibilityLabel={t(useAdminUi().locale, 'loading')} style={{ width, height, borderRadius: 6, backgroundColor: theme.surfaceMuted }} />;
}

function Tooltip({ locale, theme }: { locale: Locale; theme: Theme }) {
  const [visible, setVisible] = useState(false);
  return <View style={{ position: 'relative', marginLeft: 6 }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(locale, 'tooltipKpi')}
      accessibilityHint={t(locale, 'tooltipKpi')}
      onPress={() => setVisible((value) => !value)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      style={{ width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surfaceMuted }}
    >
      <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '800' }}>i</Text>
    </Pressable>
    {visible && <View accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 26, right: 0, zIndex: 50, width: 230, padding: 10, borderRadius: 8, backgroundColor: theme.dark ? '#020617' : '#0f172a', shadowColor: '#000', shadowOpacity: .18, shadowRadius: 8 }}>
      <Text style={{ color: '#fff', fontSize: 12, lineHeight: 17 }}>{t(locale, 'tooltipKpi')}</Text>
    </View>}
  </View>;
}

function Availability({ locale, theme, status }: { locale: Locale; theme: Theme; status: DashboardSection['status'] }) {
  const text = status === 'available' ? t(locale, 'available') : status === 'error' ? t(locale, 'error') : t(locale, 'notAvailable');
  const color = status === 'available' ? statusColor(theme, 'AVAILABLE') : status === 'error' ? statusColor(theme, 'ERROR') : statusColor(theme, 'UNKNOWN');
  return <View style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: color.background }}><Text style={{ color: color.text, fontSize: 10, fontWeight: '800', letterSpacing: .4 }}>{text.toUpperCase()}</Text></View>;
}

function EmptyState({ locale, theme, kind = 'noData' }: { locale: Locale; theme: Theme; kind?: 'noData' | 'unavailable' | 'restricted' }) {
  const label = kind === 'restricted' ? t(locale, 'noPermission') : kind === 'unavailable' ? t(locale, 'sectionUnavailable') : t(locale, 'noMetrics');
  return <View style={{ minHeight: 96, justifyContent: 'center', alignItems: 'center', padding: 14 }}><Text style={{ color: theme.muted, textAlign: 'center', fontSize: 13 }}>{label}</Text></View>;
}

function SectionFrame({
  title, section, loading, restricted, onRetry, children, theme, locale, minHeight = 210,
}: {
  title: string;
  section: DashboardSection;
  loading: boolean;
  restricted?: boolean;
  onRetry: () => void;
  children: React.ReactNode;
  theme: Theme;
  locale: Locale;
  minHeight?: number;
}) {
  const state = restricted ? 'restricted' : section.status === 'error' ? 'error' : section.status === 'unavailable' ? 'unavailable' : undefined;
  return <View style={{ flex: 1, minWidth: 0, minHeight, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
      <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
      {!loading && !restricted && <Availability locale={locale} theme={theme} status={section.status} />}
    </View>
    {loading ? <View style={{ gap: 11 }}><Skeleton theme={theme} /><Skeleton theme={theme} width="74%" /><Skeleton theme={theme} width="52%" /></View>
      : state === 'error' ? <View style={{ minHeight: 100, justifyContent: 'center', alignItems: 'center', gap: 12 }}><Text style={{ color: theme.muted, textAlign: 'center' }}>{t(locale, 'unableToLoad')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'retry')} onPress={onRetry} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800' }}>{t(locale, 'retry')}</Text></Pressable></View>
        : state === 'unavailable' ? <EmptyState locale={locale} theme={theme} kind="unavailable" />
          : state === 'restricted' ? <EmptyState locale={locale} theme={theme} kind="restricted" />
            : children}
  </View>;
}

function KpiCard({
  definition, data, locale, theme,
}: {
  definition: (typeof kpiDefinitions)[number]; data: unknown; locale: Locale; theme: Theme;
}) {
  const metric = readNamedMetric(data, definition.names);
  const change = metric.change;
  const changeColor = change === undefined ? theme.muted : change < 0 ? theme.danger : theme.success;
  return <View style={{ flexGrow: 1, flexBasis: 175, minHeight: 130, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ flex: 1, color: theme.muted, fontSize: 12, fontWeight: '700' }}>{t(locale, definition.label)}</Text><Tooltip locale={locale} theme={theme} /></View>
    <Text accessibilityLabel={`${t(locale, definition.label)}: ${formatMetric(locale, metric.value, metric.unit)}`} style={{ color: theme.text, marginTop: 13, fontSize: 26, fontWeight: '800' }}>{formatMetric(locale, metric.value, metric.unit)}</Text>
    <Text style={{ color: changeColor, marginTop: 6, fontSize: 11 }}>{change === undefined ? t(locale, 'changeUnavailable') : `${change > 0 ? '+' : ''}${formatMetric(locale, change, '%')}`}{metric.period ? ` · ${metric.period}` : ''}</Text>
  </View>;
}

function Overview({ section, loading, locale, theme, onRetry }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void }) {
  if (loading) return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{kpiDefinitions.map((definition) => <View key={definition.id} style={{ flexGrow: 1, flexBasis: 175, minHeight: 130, padding: 16, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, gap: 12 }}><Skeleton theme={theme} width="72%" /><Skeleton theme={theme} width="42%" height={26} /><Skeleton theme={theme} width="55%" /></View>)}</View>;
  if (section.status === 'error') return <SectionFrame title={t(locale, 'globalKpis')} section={section} loading={false} onRetry={onRetry} theme={theme} locale={locale} minHeight={170}><View /></SectionFrame>;
  if (section.status === 'unavailable') return <SectionFrame title={t(locale, 'globalKpis')} section={section} loading={false} onRetry={onRetry} theme={theme} locale={locale} minHeight={170}><View /></SectionFrame>;
  return <View style={{ gap: 10 }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>{t(locale, 'globalKpis')}</Text><Availability locale={locale} theme={theme} status={section.status} /></View><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{kpiDefinitions.map((definition) => <KpiCard key={definition.id} definition={definition} data={sectionData(section)} locale={locale} theme={theme} />)}</View></View>;
}

function PlanOverview({ section, loading, locale, theme, onRetry, restricted }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; restricted: boolean }) {
  const data = sectionData(section);
  const root = dashboardRecord(data);
  return <SectionFrame title={t(locale, 'subscriptions')} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale}>
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{planDefinitions.map((plan) => {
        const row = findNamedRecord(root?.plans ?? root?.subscriptions ?? data, [plan.id, plan.id.replace('_', '-')]);
        const count = pickNumber(row, ['users', 'count', 'total', 'value']) ?? dashboardNumber(dashboardRecord(root?.plans)?.[plan.id]);
        const percent = pickNumber(row, ['percent', 'percentage', 'share']);
        const active = pickNumber(row, ['activeSubscriptions', 'active', 'subscriptionsActive']);
        return <View key={plan.id} style={{ flexGrow: 1, flexBasis: 105, padding: 12, borderRadius: 9, backgroundColor: theme.surfaceMuted }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '800' }}>{t(locale, plan.label)}</Text><Text style={{ color: theme.text, marginTop: 6, fontSize: 20, fontWeight: '800' }}>{count === undefined ? '—' : formatNumber(locale, count)}</Text><Text style={{ color: theme.muted, marginTop: 4, fontSize: 11 }}>{percent === undefined ? t(locale, 'noData') : `${formatMetric(locale, percent, '%')}`}</Text>{active !== undefined && <Text style={{ color: theme.muted, marginTop: 2, fontSize: 10 }}>{t(locale, 'activeSubscriptions')}: {formatNumber(locale, active)}</Text>}</View>;
      })}</View>
      <View style={{ height: 1, backgroundColor: theme.border }} />
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{t(locale, 'subscriptionStates')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{subscriptionDefinitions.map((state) => {
        const row = findNamedRecord(root?.states ?? root?.subscriptionStates ?? data, [state.id]);
        const value = pickNumber(row, ['count', 'value', 'total', 'subscriptions']) ?? dashboardNumber(dashboardRecord(root?.states)?.[state.id]);
        return <View key={state.id} style={{ minWidth: 92, paddingVertical: 7, paddingHorizontal: 9, borderRadius: 8, backgroundColor: theme.surfaceMuted }}><Text style={{ color: theme.muted, fontSize: 10 }}>{t(locale, state.label)}</Text><Text style={{ color: theme.text, marginTop: 2, fontWeight: '800' }}>{value === undefined ? '—' : formatNumber(locale, value)}</Text></View>;
      })}</View>
    </View>
  </SectionFrame>;
}

function QuotaOverview({ section, loading, locale, theme, onRetry, restricted }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; restricted: boolean }) {
  const data = sectionData(section); const root = dashboardRecord(data); const thresholdData = dashboardRecord(root?.items) ?? root;
  const thresholds = [
    { label: 'usersFallback', names: ['usersInFallback', 'usersFallback', 'fallbackUsers'] }, { label: 'usersBlocked', names: ['usersBlocked', 'blockedUsers'] },
    { label: 'usersAt70', names: ['usersAtOrAbove70', 'usersAt70', 'at70'] }, { label: 'usersAt85', names: ['usersAtOrAbove85', 'usersAt85', 'at85'] }, { label: 'usersAt95', names: ['usersAtOrAbove95', 'usersAt95', 'at95'] },
  ] as const;
  return <SectionFrame title={t(locale, 'quotaStates')} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale}>
    <View style={{ gap: 14 }}>{quotaDefinitions.map((state) => {
      const row = findNamedRecord(root?.states ?? data, [state.id]);
      const percent = pickNumber(row, ['percent', 'percentage', 'share']);
      const count = pickNumber(row, ['count', 'value', 'users', 'total']) ?? dashboardNumber(dashboardRecord(root?.states)?.[state.id]);
      const color = statusColor(theme, state.id);
      return <View key={state.id} style={{ gap: 6 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{t(locale, state.label)}</Text><Text style={{ color: color.text, fontSize: 12, fontWeight: '800' }}>{percent === undefined ? (count === undefined ? '—' : formatNumber(locale, count)) : formatMetric(locale, percent, '%')}</Text></View>{percent !== undefined && <View accessibilityLabel={`${t(locale, state.label)} ${formatMetric(locale, percent, '%')}`} style={{ height: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: theme.surfaceMuted }}><View style={{ height: '100%', width: `${Math.max(0, Math.min(100, percent <= 1 ? percent * 100 : percent))}%`, backgroundColor: color.text }} /></View>}</View>;
    })}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>{thresholds.map((metric) => <View key={metric.label} style={{ flexGrow: 1, flexBasis: 120, padding: 9, borderRadius: 8, backgroundColor: theme.surfaceMuted }}><Text style={{ color: theme.muted, fontSize: 10 }}>{t(locale, metric.label)}</Text><Text style={{ color: theme.text, marginTop: 3, fontWeight: '800' }}>{formatMetric(locale, pickNumber(thresholdData, metric.names))}</Text></View>)}</View></View>
  </SectionFrame>;
}

function MetricRows({ section, loading, locale, theme, onRetry, title, emptyKey, restricted, listKeys = ['items'] }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; title: string; emptyKey: Parameters<typeof t>[1]; restricted?: boolean; listKeys?: string[] }) {
  const rows = dashboardList(sectionData(section), listKeys);
  return <SectionFrame title={title} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale}>
    {rows.length === 0 ? <View style={{ minHeight: 96, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.muted, textAlign: 'center' }}>{t(locale, emptyKey)}</Text></View>
      : <View style={{ gap: 10 }}>{rows.slice(0, 12).map((row, index) => {
        const label = displayLabel(locale, recordValue(row, ['label', 'name', 'key', 'resource', 'engine', 'component', 'type', 'code', 'id']));
        const value = pickNumber(row, ['value', 'count', 'total', 'users', 'requests', 'minutes', 'sessions', 'operations']);
        const unit = dashboardString(recordValue(row, ['unit', 'suffix']));
        const status = dashboardString(recordValue(row, ['status', 'health', 'severity']));
        const reason = dashboardString(recordValue(row, ['reason']));
        const badge = statusColor(theme, status);
        const isNotInstrumented = normalizeId(reason) === 'NOT_INSTRUMENTED';
        return <View key={`${label}-${index}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingBottom: 10, borderBottomWidth: index === rows.slice(0, 12).length - 1 ? 0 : 1, borderBottomColor: theme.border }}><Text numberOfLines={1} style={{ flex: 1, color: theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>{status && <View style={{ borderRadius: 999, backgroundColor: badge.background, paddingHorizontal: 7, paddingVertical: 3 }}><Text style={{ color: badge.text, fontSize: 9, fontWeight: '800' }}>{statusLabel(locale, status).toUpperCase()}</Text></View>}<Text style={{ color: isNotInstrumented ? theme.muted : theme.text, fontSize: 13, fontWeight: '800' }}>{isNotInstrumented ? t(locale, 'notInstrumented') : formatMetric(locale, value, unit)}</Text></View>;
      })}</View>}
  </SectionFrame>;
}

function nestedSection(value: unknown): DashboardSection {
  const record = dashboardRecord(value);
  if (!record) return { status: 'unavailable' };
  if (typeof record.status === 'string') return {
    status: dashboardSectionStatus(record),
    data: record.data,
    message: dashboardString(record.message),
  };
  return { status: 'available', data: record };
}

type UsageDomain = {
  id: 'ai' | 'voice' | 'documents' | 'languages';
  title: Parameters<typeof t>[1];
  metrics: { label: Parameters<typeof t>[1]; names: string[]; unit?: string }[];
};

const usageDomains: UsageDomain[] = [
  { id: 'ai', title: 'aiActivity', metrics: [
    { label: 'requestsToday', names: ['requestsToday', 'requests_today'] }, { label: 'requestsThisMonth', names: ['requestsThisMonth', 'requests_this_month'] },
    { label: 'successRate', names: ['successRate', 'success_rate'], unit: '%' }, { label: 'errorRate', names: ['errorRate', 'error_rate'], unit: '%' },
    { label: 'averageLatency', names: ['averageLatencyMs', 'averageLatency', 'average_latency_ms'], unit: 'ms' },
  ] },
  { id: 'voice', title: 'voiceActivity', metrics: [
    { label: 'voiceSessions', names: ['sessions', 'voiceSessions'] }, { label: 'voiceMinutes', names: ['minutes', 'voiceMinutes'], unit: 'min' },
    { label: 'sttOperations', names: ['sttOperations', 'stt_operations'] }, { label: 'ttsOperations', names: ['ttsOperations', 'tts_operations'] },
    { label: 'errors', names: ['errors', 'errorCount'] }, { label: 'averageLatency', names: ['averageLatencyMs', 'averageLatency', 'average_latency_ms'], unit: 'ms' },
  ] },
  { id: 'documents', title: 'documentActivity', metrics: [
    { label: 'documentsToday', names: ['uploadedToday', 'documentsToday', 'uploaded_today'] }, { label: 'documentsThisMonth', names: ['uploadedThisMonth', 'documentsThisMonth', 'uploaded_this_month'] },
    { label: 'pagesProcessed', names: ['pagesProcessed', 'pages_processed'] }, { label: 'processing', names: ['processing'] }, { label: 'ready', names: ['ready'] }, { label: 'failed', names: ['failed'] },
  ] },
  { id: 'languages', title: 'languageActivity', metrics: [
    { label: 'learnersConfigured', names: ['learnersConfigured', 'learners_configured'] }, { label: 'languageSessions', names: ['sessions', 'languageSessions'] },
    { label: 'textLanguageUsage', names: ['textUsage', 'text_usage'] }, { label: 'voiceLanguageUsage', names: ['voiceUsage', 'voice_usage'] },
  ] },
];

function usageMetric(data: unknown, names: string[]) {
  const record = dashboardRecord(data); const raw = recordValue(record, names); const rawRecord = dashboardRecord(raw);
  const value = dashboardNumber(raw) ?? pickNumber(rawRecord, ['value', 'count', 'total', 'requests', 'sessions', 'minutes']) ?? pickNumber(record, names);
  const status = rawRecord && typeof rawRecord.status === 'string' ? dashboardSectionStatus(rawRecord) : undefined;
  return { value, status };
}

function UsageDomainCard({ domain, value, locale, theme }: { domain: UsageDomain; value: unknown; locale: Locale; theme: Theme }) {
  const nested = nestedSection(value); const data = sectionData(nested); const metrics = domain.metrics.map((metric) => ({ ...metric, ...usageMetric(data, metric.names) }));
  const hasMetric = metrics.some((metric) => metric.value !== undefined || metric.status !== undefined);
  const stateColor = statusColor(theme, nested.status === 'available' ? 'AVAILABLE' : nested.status === 'error' ? 'ERROR' : 'UNKNOWN');
  return <View style={{ flexGrow: 1, flexBasis: 230, minHeight: 190, padding: 13, borderRadius: 10, backgroundColor: theme.surfaceMuted }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}><Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{t(locale, domain.title)}</Text><View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: stateColor.text }} /></View>
    {nested.status === 'unavailable' ? <Text style={{ color: theme.muted, fontSize: 12 }}>{t(locale, 'notInstrumented')}</Text>
      : nested.status === 'error' ? <Text style={{ color: theme.muted, fontSize: 12 }}>{t(locale, 'unableToLoad')}</Text>
        : !hasMetric ? <Text style={{ color: theme.muted, fontSize: 12 }}>{t(locale, 'noData')}</Text>
          : <View style={{ gap: 6 }}>{metrics.map((metric) => <View key={metric.label} style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}><Text numberOfLines={1} style={{ flex: 1, color: theme.muted, fontSize: 11 }}>{t(locale, metric.label)}</Text><Text style={{ color: metric.status === 'unavailable' ? theme.muted : theme.text, fontSize: 11, fontWeight: '800' }}>{metric.status === 'unavailable' ? t(locale, 'notInstrumented') : formatMetric(locale, metric.value, metric.unit)}</Text></View>)}</View>}
  </View>;
}

function UsageOverview({ section, loading, locale, theme, onRetry, restricted }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; restricted: boolean }) {
  const data = sectionData(section); const root = dashboardRecord(data); const resources = dashboardList(data, ['resources', 'items', 'usage']);
  return <SectionFrame title={t(locale, 'resourceUsage')} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale} minHeight={300}>
    <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>{usageDomains.map((domain) => <UsageDomainCard key={domain.id} domain={domain} value={root?.[domain.id]} locale={locale} theme={theme} />)}</View>
      {resources.length > 0 && <View style={{ gap: 9, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 14 }}>{resources.slice(0, 10).map((row, index) => {
        const label = displayLabel(locale, recordValue(row, ['label', 'name', 'key', 'resource', 'type', 'code', 'id'])); const value = pickNumber(row, ['value', 'count', 'total', 'requests', 'minutes', 'sessions']); const unit = dashboardString(recordValue(row, ['unit', 'suffix']));
        return <View key={`${label}-${index}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{label}</Text><Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{formatMetric(locale, value, unit)}</Text></View>;
      })}</View>}</View>
  </SectionFrame>;
}

function IncidentSummary({ section, loading, locale, theme, onRetry, restricted }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; restricted: boolean }) {
  const root = dashboardRecord(sectionData(section)); const data = dashboardRecord(root?.items) ?? root;
  const metrics = [
    { label: 'open', names: ['open'] }, { label: 'critical', names: ['critical'] }, { label: 'high', names: ['high'] }, { label: 'medium', names: ['medium'] }, { label: 'resolvedToday', names: ['resolvedToday', 'resolved_today'] },
  ] as const;
  const values = metrics.map((metric) => ({ ...metric, value: pickNumber(data, metric.names) })); const hasData = values.some((metric) => metric.value !== undefined); const open = values.find((metric) => metric.label === 'open')?.value;
  return <SectionFrame title={t(locale, 'incidents')} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale}>
    {!hasData ? <EmptyState locale={locale} theme={theme} kind="noData" /> : <View style={{ gap: 12 }}>{open === 0 && <Text style={{ color: theme.success, fontSize: 12, fontWeight: '700' }}>{t(locale, 'noOpenIncidents')}</Text>}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map((metric) => <View key={metric.label} style={{ flexGrow: 1, flexBasis: 90, padding: 9, borderRadius: 8, backgroundColor: theme.surfaceMuted }}><Text style={{ color: theme.muted, fontSize: 10 }}>{t(locale, metric.label)}</Text><Text style={{ color: theme.text, marginTop: 3, fontWeight: '800' }}>{formatMetric(locale, metric.value)}</Text></View>)}</View></View>}
  </SectionFrame>;
}

function AlertList({ section, loading, locale, theme, onRetry }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void }) {
  const rows = dashboardList(sectionData(section), ['items', 'alerts']);
  return <SectionFrame title={t(locale, 'alerts')} section={section} loading={loading} onRetry={onRetry} theme={theme} locale={locale}>
    {rows.length === 0 ? <View style={{ minHeight: 96, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.muted, textAlign: 'center' }}>{t(locale, 'noOpenAlerts')}</Text></View> : <View style={{ gap: 10 }}>{rows.slice(0, 8).map((row, index) => {
      const severity = dashboardString(recordValue(row, ['severity', 'level', 'status'])); const color = statusColor(theme, severity);
      const label = alertLabel(locale, row); const count = pickNumber(row, ['count', 'value', 'total']);
      return <View key={`${label}-${index}`} style={{ flexDirection: 'row', gap: 10, padding: 10, borderRadius: 8, backgroundColor: color.background }}><View style={{ width: 3, borderRadius: 99, backgroundColor: color.text }} /><View style={{ flex: 1 }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{label}</Text>{count !== undefined && <Text style={{ color: theme.muted, fontSize: 11, marginTop: 3 }}>{formatNumber(locale, count)}</Text>}</View><Text style={{ color: color.text, fontSize: 10, fontWeight: '800' }}>{statusLabel(locale, severity).toUpperCase()}</Text></View>;
    })}</View>}
  </SectionFrame>;
}

function HealthGrid({ section, loading, locale, theme, onRetry, restricted }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; restricted: boolean }) {
  const rows = dashboardList(sectionData(section), ['components', 'items', 'services']);
  return <SectionFrame title={t(locale, 'systemHealth')} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale}>
    {rows.length === 0 ? <View style={{ minHeight: 96, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.muted }}>{t(locale, 'noHealthData')}</Text></View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{rows.slice(0, 12).map((row, index) => {
      const component = displayLabel(locale, recordValue(row, ['label', 'component', 'key', 'name', 'service', 'code', 'id'])); const health = dashboardString(recordValue(row, ['status', 'health', 'state'])); const color = statusColor(theme, health);
      return <View key={`${component}-${index}`} style={{ flexGrow: 1, flexBasis: 130, padding: 10, borderRadius: 8, backgroundColor: theme.surfaceMuted }}><Text numberOfLines={1} style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{component}</Text><View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}><View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: color.text }} /><Text style={{ color: color.text, fontSize: 10, fontWeight: '800' }}>{statusLabel(locale, health).toUpperCase()}</Text></View></View>;
    })}</View>}
  </SectionFrame>;
}

function ActivityList({ section, loading, locale, theme, onRetry, restricted }: { section: DashboardSection; loading: boolean; locale: Locale; theme: Theme; onRetry: () => void; restricted?: boolean }) {
  const rows = dashboardList(sectionData(section), ['items', 'events', 'activity']);
  return <SectionFrame title={t(locale, 'recentActivity')} section={section} loading={loading} restricted={restricted} onRetry={onRetry} theme={theme} locale={locale} minHeight={190}>
    {rows.length === 0 ? <View style={{ minHeight: 100, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.muted }}>{t(locale, 'noRecentActivity')}</Text></View> : <View style={{ gap: 8 }}>{rows.slice(0, 10).map((row, index) => {
      const label = displayLabel(locale, recordValue(row, ['label', 'kind', 'type', 'event', 'code', 'action', 'id'])); const count = pickNumber(row, ['count', 'value', 'total']); const date = formatTimestamp(locale, recordValue(row, ['occurredAt', 'createdAt', 'timestamp', 'at']));
      return <View key={`${label}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: index === rows.slice(0, 10).length - 1 ? 0 : 1, borderBottomColor: theme.border }}><View style={{ width: 7, height: 7, borderRadius: 99, backgroundColor: theme.primary }} /><Text style={{ flex: 1, color: theme.text, fontSize: 13 }}>{label}</Text>{count !== undefined && <Text style={{ color: theme.text, fontWeight: '800' }}>{formatNumber(locale, count)}</Text>}{date && <Text style={{ color: theme.muted, fontSize: 11 }}>{date}</Text>}</View>;
    })}</View>}
  </SectionFrame>;
}

export function ControlDashboard() {
  const { locale, dark } = useAdminUi(); const { width } = useWindowDimensions(); const theme = useMemo(() => makeTheme(dark), [dark]);
  const [range, setRange] = useState<DashboardRange>('today'); const [response, setResponse] = useState<DashboardResponse | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [networkError, setNetworkError] = useState<ApiProblem | null>(null);
  const canPlans = useCapability(['plans.read', 'subscriptions.read']); const canQuotas = useCapability(['quotas.read']); const canUsage = useCapability(['usage.read']); const canHealth = useCapability(['infrastructure.read']); const canSecurity = useCapability(['security.read']); const canIncidents = useCapability(['bugs.read']); const canActivity = useCapability(['audit.read']);
  const load = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) { setLoading(true); setResponse(null); } else setRefreshing(true);
    setNetworkError(null);
    try { const result = await api<DashboardResponse>(`/admin/dashboard?range=${range}`); setResponse(result); }
    catch (problem) { setNetworkError(problem as ApiProblem); }
    finally { setLoading(false); setRefreshing(false); }
  }, [range]);
  useEffect(() => { void load(true); const timer = setInterval(() => { void load(false); }, 60_000); return () => clearInterval(timer); }, [load]);
  const section = useCallback((key: DashboardSectionKey): DashboardSection => networkError ? { status: 'error' } : getDashboardSection(response, key), [networkError, response]);
  const overview = section('overview'); const plans = section('plans'); const quotas = section('quotas'); const usage = section('usage'); const learning = section('learning'); const health = section('health'); const alerts = section('alerts'); const activity = section('activity'); const security = section('security'); const incidents = section('incidents');
  const generated = formatTimestamp(locale, response?.generatedAt);
  const column = width >= 1180 ? '48.8%' : width >= 760 ? '48.5%' : '100%';
  return <View style={{ gap: 18, paddingBottom: 30 }}>
    <View style={{ flexDirection: width < 680 ? 'column' : 'row', gap: 14, alignItems: width < 680 ? 'flex-start' : 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: width < 680 ? 25 : 30, fontWeight: '800' }}>{t(locale, 'dashboardTitle')}</Text><Text style={{ color: theme.muted, fontSize: 13 }}>{t(locale, 'dashboardSubtitle')}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{t(locale, 'privacyAggregate')} · {t(locale, 'timezoneUtc')}</Text></View>
<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}><View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 3, borderRadius: 9, backgroundColor: theme.surfaceMuted }}>{ranges.map((option) => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: range === option }} aria-selected={range === option} onPress={() => setRange(option)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, backgroundColor: range === option ? theme.surface : 'transparent' }}><Text style={{ color: range === option ? theme.text : theme.muted, fontSize: 12, fontWeight: '800' }}>{t(locale, rangeLabels[option])}</Text></Pressable>)}</View><Pressable accessibilityRole="button" accessibilityLabel={t(locale, 'refresh')} onPress={() => { void load(false); }} disabled={refreshing} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary, opacity: refreshing ? .72 : 1 }}>{refreshing && <ActivityIndicator size="small" color="#fff" />}<Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{refreshing ? t(locale, 'refreshing') : t(locale, 'refresh')}</Text></Pressable></View>
    </View>
    {generated && <Text accessibilityLiveRegion="polite" style={{ color: theme.muted, fontSize: 11 }}>{t(locale, 'updated')}: {generated}</Text>}
    <Overview section={overview} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ width: column, flexGrow: 1 }}><PlanOverview section={plans} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} restricted={!canPlans} /></View><View style={{ width: column, flexGrow: 1 }}><QuotaOverview section={quotas} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} restricted={!canQuotas} /></View></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ width: column, flexGrow: 1 }}><UsageOverview section={usage} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} restricted={!canUsage} /></View><View style={{ width: column, flexGrow: 1 }}><MetricRows title={t(locale, 'learningActivity')} section={learning} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} emptyKey="notInstrumented" restricted={!canUsage} listKeys={['engines', 'items', 'learning']} /></View></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ width: column, flexGrow: 1 }}><HealthGrid section={health} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} restricted={!canHealth} /></View><View style={{ width: column, flexGrow: 1 }}><AlertList section={alerts} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} /></View></View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><View style={{ width: column, flexGrow: 1 }}><MetricRows title={t(locale, 'securitySummary')} section={security} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} emptyKey="noSecurityData" restricted={!canSecurity} listKeys={['metrics', 'items', 'events']} /></View><View style={{ width: column, flexGrow: 1 }}><IncidentSummary section={incidents} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} restricted={!canIncidents} /></View></View>
    <View style={{ width: '100%' }}><ActivityList section={activity} loading={loading} locale={locale} theme={theme} onRetry={() => { void load(false); }} restricted={!canActivity} /></View>
  </View>;
}
