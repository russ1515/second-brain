import { type ReactNode, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useAdminUi } from '../contexts/admin-ui';
import { normalizeIdentifier, type DataAvailability, type Severity } from '../lib/bugs';

export type DiagnosticTheme = {
  surface: string;
  mutedSurface: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
};

export type DiagnosticLocale = 'fr' | 'en';

const copy = {
  fr: {
    refresh: 'Actualiser', refreshing: 'Actualisation…', retry: 'Réessayer', unavailable: 'NOT_INSTRUMENTED', notAvailable: 'NOT_AVAILABLE', insufficient: 'INSUFFICIENT_DATA',
    noData: 'Aucune donnée vérifiable pour les filtres actuels.', noDataDetail: 'L’absence de donnée ne signifie jamais qu’un incident, un bug ou un coût est nul.',
    unavailableDetail: 'Cette vue n’est pas encore instrumentée dans cet environnement.', error: 'La donnée n’a pas pu être chargée. Aucune conclusion n’est déduite.',
    forbidden: 'Votre rôle ne dispose pas de la capacité requise.', updated: 'Mis à jour', loading: 'Chargement des données observées…',
    observed: 'OBSERVED', correlated: 'CORRELATED', probable: 'PROBABLE', unconfirmed: 'UNCONFIRMED', confirmed: 'CONFIRMED',
    critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW',
  },
  en: {
    refresh: 'Refresh', refreshing: 'Refreshing…', retry: 'Retry', unavailable: 'NOT_INSTRUMENTED', notAvailable: 'NOT_AVAILABLE', insufficient: 'INSUFFICIENT_DATA',
    noData: 'No verifiable data for the active filters.', noDataDetail: 'Missing data never means that an incident, bug, or cost is zero.',
    unavailableDetail: 'This view is not instrumented in this environment yet.', error: 'The data could not be loaded. No conclusion is inferred.',
    forbidden: 'Your role does not have the required capability.', updated: 'Updated', loading: 'Loading observed data…',
    observed: 'OBSERVED', correlated: 'CORRELATED', probable: 'PROBABLE', unconfirmed: 'UNCONFIRMED', confirmed: 'CONFIRMED',
    critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW',
  },
} as const;

export type DiagnosticCopyKey = keyof typeof copy.en;

export function d(locale: DiagnosticLocale, key: DiagnosticCopyKey): string { return copy[locale][key]; }

export function diagnosticTheme(dark: boolean): DiagnosticTheme {
  return dark
    ? { surface: '#111827', mutedSurface: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', danger: '#f87171', dangerSoft: '#450a0a', warning: '#fbbf24', warningSoft: '#422006', success: '#34d399', successSoft: '#052e2b' }
    : { surface: '#ffffff', mutedSurface: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#475569', primary: '#1d4ed8', primarySoft: '#dbeafe', danger: '#b91c1c', dangerSoft: '#fee2e2', warning: '#92400e', warningSoft: '#fef3c7', success: '#065f46', successSoft: '#d1fae5' };
}

export function useDiagnosticPresentation(): { locale: DiagnosticLocale; theme: DiagnosticTheme } {
  const { dark, locale } = useAdminUi();
  return { locale, theme: useMemo(() => diagnosticTheme(dark), [dark]) };
}

export function hasCapability(identity: { roles: string[]; capabilities: string[] } | null, capability: string): boolean {
  return identity?.roles.includes('SUPER_ADMIN') === true || identity?.capabilities.includes(capability) === true;
}

export function formatDate(locale: DiagnosticLocale, value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function formatNumber(locale: DiagnosticLocale, value: unknown): string {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
  return number === undefined ? '—' : new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }).format(number);
}

function statusPalette(theme: DiagnosticTheme, status: string): { color: string; backgroundColor: string } {
  const value = normalizeIdentifier(status);
  if (value === 'CRITICAL' || value === 'HIGH' || value === 'REOPENED' || value === 'ERROR') return { color: theme.danger, backgroundColor: theme.dangerSoft };
  if (value === 'MEDIUM' || value === 'INVESTIGATING' || value === 'TRIAGED' || value === 'WAITING_FOR_ENGINEERING') return { color: theme.warning, backgroundColor: theme.warningSoft };
  if (value === 'FIXED' || value === 'MONITORING' || value === 'RESOLVED' || value === 'LOW' || value === 'CLOSED') return { color: theme.success, backgroundColor: theme.successSoft };
  return { color: theme.muted, backgroundColor: theme.mutedSurface };
}

export function SeverityBadge({ severity, locale, theme }: { severity: string | undefined; locale: DiagnosticLocale; theme: DiagnosticTheme }) {
  const normalized = normalizeIdentifier(severity || 'LOW') as Severity;
  const label = normalized === 'CRITICAL' ? d(locale, 'critical') : normalized === 'HIGH' ? d(locale, 'high') : normalized === 'MEDIUM' ? d(locale, 'medium') : d(locale, 'low');
  const icon = normalized === 'CRITICAL' ? '●' : normalized === 'HIGH' ? '▲' : normalized === 'MEDIUM' ? '◆' : '○';
  const palette = statusPalette(theme, normalized);
  return <View accessibilityLabel={`${label} severity`} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.backgroundColor }}><Text aria-hidden style={{ color: palette.color, fontSize: 10 }}>{icon}</Text><Text style={{ color: palette.color, fontSize: 10, fontWeight: '900', letterSpacing: .35 }}>{label}</Text></View>;
}

export function StatusBadge({ status, theme }: { status: string | undefined; theme: DiagnosticTheme }) {
  const raw = normalizeIdentifier(status || 'UNCONFIRMED'); const palette = statusPalette(theme, raw);
  return <View accessibilityLabel={`Status ${raw}`} style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: palette.backgroundColor }}><Text aria-hidden style={{ color: palette.color, fontSize: 10 }}>●</Text><Text style={{ color: palette.color, fontSize: 10, fontWeight: '900', letterSpacing: .25 }}>{raw}</Text></View>;
}

export function AvailabilityBadge({ availability, locale, theme }: { availability: DataAvailability; locale: DiagnosticLocale; theme: DiagnosticTheme }) {
  if (availability === 'AVAILABLE') return null;
  const label = availability === 'NOT_INSTRUMENTED' ? d(locale, 'unavailable') : availability === 'NOT_AVAILABLE' ? d(locale, 'notAvailable') : d(locale, 'insufficient');
  return <View accessibilityLabel={label} style={{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: theme.mutedSurface }}><Text style={{ color: theme.muted, fontSize: 10, fontWeight: '900', letterSpacing: .3 }}>{label}</Text></View>;
}

export function EmptyDiagnosticState({ availability = 'INSUFFICIENT_DATA', locale, theme }: { availability?: DataAvailability; locale: DiagnosticLocale; theme: DiagnosticTheme }) {
  const detail = availability === 'NOT_INSTRUMENTED' || availability === 'NOT_AVAILABLE' ? d(locale, 'unavailableDetail') : d(locale, 'noDataDetail');
  return <View style={{ minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 }}><AvailabilityBadge availability={availability} locale={locale} theme={theme} /><Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center' }}>{availability === 'NOT_INSTRUMENTED' || availability === 'NOT_AVAILABLE' ? d(locale, 'unavailableDetail') : d(locale, 'noData')}</Text><Text style={{ color: theme.muted, fontSize: 11, textAlign: 'center' }}>{detail}</Text></View>;
}

export function Panel({ title, children, theme, right }: { title: string; children: ReactNode; theme: DiagnosticTheme; right?: ReactNode }) {
  return <View style={{ flexGrow: 1, flexBasis: 360, minWidth: 0, padding: 16, borderRadius: 13, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}><View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}><Text accessibilityRole="header" style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>{right}</View>{children}</View>;
}

export function LoadingOrError({ loading, error, onRetry, locale, theme, children }: { loading: boolean; error: string | null; onRetry: () => void; locale: DiagnosticLocale; theme: DiagnosticTheme; children: ReactNode }) {
  if (loading) return <View accessibilityLabel={d(locale, 'loading')} style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center', gap: 9 }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted, fontSize: 12 }}>{d(locale, 'loading')}</Text></View>;
  if (error) return <View accessibilityRole="alert" style={{ minHeight: 120, justifyContent: 'center', alignItems: 'center', gap: 10 }}><Text style={{ color: theme.muted, textAlign: 'center', fontSize: 12 }}>{d(locale, 'error')}</Text><Text selectable style={{ color: theme.muted, fontSize: 10 }}>{error}</Text><Pressable accessibilityRole="button" accessibilityLabel={d(locale, 'retry')} onPress={onRetry} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{d(locale, 'retry')}</Text></Pressable></View>;
  return <>{children}</>;
}

export function PrimaryButton({ label, onPress, disabled, theme, accessibilityHint }: { label: string; onPress: () => void; disabled?: boolean; theme: DiagnosticTheme; accessibilityHint?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: Boolean(disabled) }} onPress={onPress} disabled={disabled} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary, opacity: disabled ? .58 : 1 }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{label}</Text></Pressable>;
}

export function SecondaryButton({ label, onPress, disabled, theme, accessibilityHint }: { label: string; onPress: () => void; disabled?: boolean; theme: DiagnosticTheme; accessibilityHint?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={{ disabled: Boolean(disabled) }} onPress={onPress} disabled={disabled} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 7, borderWidth: 1, borderColor: theme.border, opacity: disabled ? .58 : 1 }}><Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>{label}</Text></Pressable>;
}

export function SimpleTable({ headers, rows, theme }: { headers: string[]; rows: Array<{ key: string; cells: ReactNode[] }>; theme: DiagnosticTheme }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator><View style={{ width: '100%', minWidth: Math.max(650, headers.length * 118) }}><View style={{ flexDirection: 'row', gap: 9, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: theme.border }}>{headers.map((header) => <Text key={header} style={{ minWidth: 110, flex: 1, color: theme.muted, fontSize: 10, fontWeight: '800' }}>{header}</Text>)}</View>{rows.map((row) => <View key={row.key} style={{ flexDirection: 'row', gap: 9, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>{row.cells.map((cell, index) => <View key={index} style={{ minWidth: 110, flex: 1 }}>{typeof cell === 'string' ? <Text numberOfLines={2} style={{ color: theme.text, fontSize: 12 }}>{cell}</Text> : cell}</View>)}</View>)}</View></ScrollView>;
}
