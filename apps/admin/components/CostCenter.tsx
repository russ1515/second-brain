import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import {
  getCostCenter,
  type CostCenterSections,
  type CostFilters,
  type CostRange,
  type CostRecord,
  type CostSection,
  type CostStatus,
} from '../lib/costs';

type Theme = {
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
};

type CopyKey = keyof typeof copy.en;

const copy = {
  fr: {
    title: 'Cost Center',
    subtitle: 'Télémétrie fournisseur et attribution des coûts. Cette vue observe les données réelles ; elle ne modifie ni tarifs, ni quotas, ni routage.',
    telemetryFirst: 'TÉLÉMÉTRIE AVANT ANALYTIQUE',
    refresh: 'Actualiser', refreshing: 'Actualisation…', apply: 'Appliquer les filtres', clear: 'Réinitialiser',
    range: 'Période', today: 'Aujourd’hui', days7: '7 jours', days30: '30 jours', days90: '90 jours',
    plan: 'Plan', feature: 'Fonction', provider: 'Fournisseur', model: 'Modèle', status: 'Statut de coût',
    planHint: 'Tous les plans', featureHint: 'Toutes les fonctions', providerHint: 'Tous les fournisseurs', modelHint: 'Tous les modèles', statusHint: 'Tous les statuts',
    noPermission: 'Votre rôle ne dispose pas de costs.read.',
    noPermissionDetail: 'Le serveur reste l’autorité : aucun coût n’est demandé ou affiché sans cette capacité.',
    overview: 'Vue d’ensemble des coûts', totalCost: 'Coût total', measuredCost: 'Coût mesuré', estimatedCost: 'Coût estimé', unknownCost: 'Coût inconnu / non instrumenté',
    measurementCoverage: 'Couverture mesurée', providerCalls: 'Appels fournisseur', unattributed: 'Coût non attribué', blockedCalls: 'Appels après BLOCKED',
    costsByPlan: 'Coûts par plan', costsByFeature: 'Coûts par moteur / fonction', costsByProvider: 'Coûts par fournisseur', costsByModel: 'Coûts par modèle', costsByUser: 'Coûts par utilisateur',
    languageCosts: 'Language Text et Language Voice', languageText: 'Language Text', languageVoice: 'Language Voice', voiceCosts: 'Voix', documentCosts: 'Documents / OCR / Embeddings', researchCosts: 'Research / Deep Research',
    anomalies: 'Anomalies et signaux de fiabilité', instrumentation: 'Couverture d’instrumentation', pricing: 'Catalogue de tarifs', pricingReadOnly: 'LECTURE SEULE — aucune modification automatique des prix, quotas, plans ou routage.',
    measured: 'MEASURED', estimated: 'ESTIMATED', unknown: 'UNKNOWN', notInstrumented: 'NOT_INSTRUMENTED', insufficientData: 'INSUFFICIENT_DATA',
    unavailable: 'Donnée non disponible', endpointUnavailable: 'Cette section n’est pas encore disponible dans cet environnement.',
    loadError: 'Cette section n’a pas pu être chargée. Aucune valeur n’est supposée.', retry: 'Réessayer', loading: 'Chargement de la télémétrie…',
    noRows: 'Aucune ligne vérifiable pour les filtres actuels.', noRowsDetail: 'Une absence de ligne ne représente jamais un coût nul.',
    label: 'Libellé', cost: 'Coût', calls: 'Appels', units: 'Unités', coverage: 'Couverture', updated: 'Mis à jour',
    user: 'Utilisateur', engine: 'Moteur', version: 'Version', unit: 'Unité tarifée', price: 'Tarif', effectiveFrom: 'Applicable depuis',
    severity: 'Sévérité', signal: 'Signal', observedAt: 'Observé le', source: 'Source', lastObserved: 'Dernière observation',
    unknownPrice: 'Tarif inconnu', noAutomaticChange: 'Le Cost Center alerte et simule ; il ne prend aucune décision commerciale automatique.',
    shownAs: 'Affiché comme', requestId: 'Identifiant de requête', dataStatus: 'Statut de données', activeFilters: 'Filtres actifs',
  },
  en: {
    title: 'Cost Center',
    subtitle: 'Provider telemetry and cost attribution. This view observes real data; it never changes pricing, quotas, routing, or plans.',
    telemetryFirst: 'TELEMETRY BEFORE ANALYTICS',
    refresh: 'Refresh', refreshing: 'Refreshing…', apply: 'Apply filters', clear: 'Clear',
    range: 'Range', today: 'Today', days7: '7 days', days30: '30 days', days90: '90 days',
    plan: 'Plan', feature: 'Feature', provider: 'Provider', model: 'Model', status: 'Cost status',
    planHint: 'All plans', featureHint: 'All features', providerHint: 'All providers', modelHint: 'All models', statusHint: 'All statuses',
    noPermission: 'Your role does not have costs.read.',
    noPermissionDetail: 'The server remains authoritative: no cost is requested or displayed without that capability.',
    overview: 'Cost overview', totalCost: 'Total cost', measuredCost: 'Measured cost', estimatedCost: 'Estimated cost', unknownCost: 'Unknown / not instrumented cost',
    measurementCoverage: 'Measured coverage', providerCalls: 'Provider calls', unattributed: 'Unattributed cost', blockedCalls: 'Calls after BLOCKED',
    costsByPlan: 'Costs by plan', costsByFeature: 'Costs by engine / feature', costsByProvider: 'Costs by provider', costsByModel: 'Costs by model', costsByUser: 'Costs by user',
    languageCosts: 'Language Text and Language Voice', languageText: 'Language Text', languageVoice: 'Language Voice', voiceCosts: 'Voice', documentCosts: 'Documents / OCR / Embeddings', researchCosts: 'Research / Deep Research',
    anomalies: 'Anomalies and reliability signals', instrumentation: 'Instrumentation coverage', pricing: 'Pricing catalog', pricingReadOnly: 'READ ONLY — no automatic change to pricing, quotas, plans, or routing.',
    measured: 'MEASURED', estimated: 'ESTIMATED', unknown: 'UNKNOWN', notInstrumented: 'NOT_INSTRUMENTED', insufficientData: 'INSUFFICIENT_DATA',
    unavailable: 'Data unavailable', endpointUnavailable: 'This section is not available in this environment yet.',
    loadError: 'This section could not be loaded. No value is assumed.', retry: 'Retry', loading: 'Loading telemetry…',
    noRows: 'No verifiable row for the active filters.', noRowsDetail: 'The absence of a row never represents a zero cost.',
    label: 'Label', cost: 'Cost', calls: 'Calls', units: 'Units', coverage: 'Coverage', updated: 'Updated',
    user: 'User', engine: 'Engine', version: 'Version', unit: 'Priced unit', price: 'Price', effectiveFrom: 'Effective from',
    severity: 'Severity', signal: 'Signal', observedAt: 'Observed at', source: 'Source', lastObserved: 'Last observed',
    unknownPrice: 'Unknown price', noAutomaticChange: 'The Cost Center alerts and simulates; it makes no automatic commercial decision.',
    shownAs: 'Shown as', requestId: 'Request ID', dataStatus: 'Data status', activeFilters: 'Active filters',
  },
} as const;

const ranges: CostRange[] = ['today', '7d', '30d', '90d'];
const rangeLabels: Record<CostRange, 'today' | 'days7' | 'days30' | 'days90'> = { today: 'today', '7d': 'days7', '30d': 'days30', '90d': 'days90' };
const statusFilters: Array<CostStatus | undefined> = [undefined, 'MEASURED', 'ESTIMATED', 'UNKNOWN', 'NOT_AVAILABLE', 'NOT_INSTRUMENTED'];
const knownCostStatuses: CostStatus[] = ['MEASURED', 'ESTIMATED', 'UNKNOWN', 'NOT_AVAILABLE', 'NOT_INSTRUMENTED', 'INSUFFICIENT_DATA'];

function c(locale: 'fr' | 'en', key: CopyKey): string { return copy[locale][key]; }

function themeFor(dark: boolean): Theme {
  return dark
    ? { surface: '#111827', surfaceMuted: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', success: '#34d399', successSoft: '#052e2b', warning: '#fbbf24', warningSoft: '#422006', danger: '#f87171', dangerSoft: '#450a0a' }
    : { surface: '#ffffff', surfaceMuted: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#475569', primary: '#1d4ed8', primarySoft: '#dbeafe', success: '#065f46', successSoft: '#d1fae5', warning: '#92400e', warningSoft: '#fef3c7', danger: '#b91c1c', dangerSoft: '#fee2e2' };
}

function record(value: unknown): CostRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as CostRecord : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numeric(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function pick(source: CostRecord | undefined, names: readonly string[]): unknown {
  if (!source) return undefined;
  for (const name of names) if (source[name] !== undefined && source[name] !== null) return source[name];
  return undefined;
}

function normalize(value: unknown): string { return String(value ?? '').trim().toUpperCase().replace(/[ -]/g, '_'); }

function costStatus(source: CostRecord | undefined, names = ['costStatus', 'status', 'measurementStatus', 'pricingStatus']): CostStatus | undefined {
  const value = normalize(pick(source, names));
  if (value === 'LEGACY_NOT_INSTRUMENTED') return 'NOT_INSTRUMENTED';
  if (value === 'CURRENCY_CONVERSION_NOT_AVAILABLE') return 'UNKNOWN';
  return knownCostStatuses.includes(value as CostStatus) ? value as CostStatus : undefined;
}

function sectionRecord(section: CostSection | undefined): CostRecord | undefined {
  const outer = record(section?.data);
  return record(outer?.data) ?? outer;
}

function sectionRows(section: CostSection | undefined, names = ['items', 'rows', 'breakdowns', 'results', 'events', 'entries']): CostRecord[] {
  const data = section?.data;
  if (Array.isArray(data)) return data.map(record).filter((row): row is CostRecord => Boolean(row));
  const source = sectionRecord(section);
  for (const name of names) {
    if (Array.isArray(source?.[name])) return source[name].map(record).filter((row): row is CostRecord => Boolean(row));
    const nested = record(source?.[name]);
    if (!nested) continue;
    for (const nestedName of ['items', 'rows', 'results', 'entries']) {
      if (Array.isArray(nested[nestedName])) return nested[nestedName].map(record).filter((row): row is CostRecord => Boolean(row));
    }
  }
  return [];
}

function nestedValue(source: CostRecord | undefined, names: readonly string[]): CostRecord | undefined {
  for (const name of names) {
    const value = record(source?.[name]);
    if (value) return value;
  }
  return undefined;
}

function currencyOf(source: CostRecord | undefined, fallback?: CostRecord): string {
  return text(pick(source, ['currency', 'currencyCode'])) ?? text(pick(fallback, ['currency', 'currencyCode'])) ?? 'USD';
}

type CostMetric = { amount?: number; status: CostStatus; currency: string };

function metric(source: CostRecord | undefined, options: {
  amount: readonly string[];
  minor: readonly string[];
  status?: readonly string[];
  fallbackStatus?: CostStatus;
  fallback?: CostRecord;
}): CostMetric {
  const direct = numeric(pick(source, options.amount));
  const minor = numeric(pick(source, options.minor));
  return {
    amount: direct ?? (minor === undefined ? undefined : minor / 100),
    status: costStatus(source, options.status ? [...options.status] : undefined) ?? options.fallbackStatus ?? 'UNKNOWN',
    currency: currencyOf(source, options.fallback),
  };
}

function formatMoney(locale: 'fr' | 'en', value: CostMetric): string {
  // Cost statuses are mandatory before showing an amount. This avoids making a
  // missing price look like $0 even if a transport default accidentally exists.
  if (value.amount === undefined || (value.status !== 'MEASURED' && value.status !== 'ESTIMATED')) return value.status;
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: value.currency, maximumFractionDigits: 4 }).format(value.amount);
  } catch {
    return `${value.amount} ${value.currency}`;
  }
}

function formatNumber(locale: 'fr' | 'en', value: unknown): string {
  const amount = numeric(value);
  return amount === undefined ? 'NOT_INSTRUMENTED' : new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }).format(amount);
}

function formatPercent(locale: 'fr' | 'en', value: unknown): string {
  const amount = numeric(value);
  if (amount === undefined) return 'NOT_INSTRUMENTED';
  return `${new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }).format(amount <= 1 ? amount * 100 : amount)} %`;
}

function formatDate(locale: 'fr' | 'en', value: unknown): string {
  const raw = text(value);
  if (!raw || Number.isNaN(Date.parse(raw))) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(raw));
}

function displayStatus(locale: 'fr' | 'en', status: CostStatus | undefined): string {
  const labels: Record<CostStatus, CopyKey> = { MEASURED: 'measured', ESTIMATED: 'estimated', UNKNOWN: 'unknown', NOT_AVAILABLE: 'unavailable', NOT_INSTRUMENTED: 'notInstrumented', INSUFFICIENT_DATA: 'insufficientData' };
  return status ? c(locale, labels[status]) : c(locale, 'unknown');
}

function statusStyle(theme: Theme, status: CostStatus | undefined): { color: string; backgroundColor: string } {
  switch (status) {
    case 'MEASURED': return { color: theme.success, backgroundColor: theme.successSoft };
    case 'ESTIMATED': return { color: theme.warning, backgroundColor: theme.warningSoft };
    case 'UNKNOWN': return { color: theme.danger, backgroundColor: theme.dangerSoft };
    case 'NOT_AVAILABLE': return { color: theme.muted, backgroundColor: theme.surfaceMuted };
    case 'NOT_INSTRUMENTED': return { color: theme.muted, backgroundColor: theme.surfaceMuted };
    case 'INSUFFICIENT_DATA': return { color: theme.warning, backgroundColor: theme.warningSoft };
    default: return { color: theme.muted, backgroundColor: theme.surfaceMuted };
  }
}

function StatusPill({ locale, theme, status }: { locale: 'fr' | 'en'; theme: Theme; status?: CostStatus }) {
  const style = statusStyle(theme, status);
  return <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: style.backgroundColor }}><Text style={{ color: style.color, fontSize: 10, fontWeight: '800', letterSpacing: .3 }}>{displayStatus(locale, status)}</Text></View>;
}

function EmptyData({ locale, theme, status = 'INSUFFICIENT_DATA' as CostStatus }: { locale: 'fr' | 'en'; theme: Theme; status?: CostStatus }) {
  return <View style={{ minHeight: 92, alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 }}><StatusPill locale={locale} theme={theme} status={status} /><Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>{c(locale, 'noRows')}</Text><Text style={{ color: theme.muted, fontSize: 11, textAlign: 'center' }}>{c(locale, 'noRowsDetail')}</Text></View>;
}

function Panel({ title, section, loading, locale, theme, children, onRetry, minHeight = 190 }: {
  title: string;
  section: CostSection | undefined;
  loading: boolean;
  locale: 'fr' | 'en';
  theme: Theme;
  children: ReactNode;
  onRetry: () => void;
  minHeight?: number;
}) {
  const state = section?.state ?? 'loading';
  const root = sectionRecord(section);
  const domainStatus = costStatus(root);
  const unavailable = state === 'unavailable';
  const failed = state === 'error';
  const denied = state === 'forbidden';
  const empty = state === 'empty';
  return <View style={{ flexGrow: 1, flexBasis: 360, minWidth: 0, minHeight, padding: 17, borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 13 }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
      {!loading && <StatusPill locale={locale} theme={theme} status={domainStatus ?? (empty ? 'INSUFFICIENT_DATA' : unavailable ? 'NOT_INSTRUMENTED' : undefined)} />}
    </View>
    {loading ? <View accessibilityLabel={c(locale, 'loading')} style={{ minHeight: 90, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator color={theme.primary} /><Text style={{ color: theme.muted, fontSize: 12, marginTop: 9 }}>{c(locale, 'loading')}</Text></View>
      : denied ? <View style={{ minHeight: 90, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: theme.danger, fontSize: 12, textAlign: 'center' }}>{c(locale, 'noPermission')}</Text></View>
        : unavailable ? <View style={{ minHeight: 90, justifyContent: 'center', alignItems: 'center', gap: 7 }}><StatusPill locale={locale} theme={theme} status="NOT_INSTRUMENTED" /><Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>{c(locale, 'endpointUnavailable')}</Text></View>
          : failed ? <View style={{ minHeight: 90, justifyContent: 'center', alignItems: 'center', gap: 10 }}><Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>{c(locale, 'loadError')}</Text><Pressable accessibilityRole="button" accessibilityLabel={c(locale, 'retry')} onPress={onRetry} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 7, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{c(locale, 'retry')}</Text></Pressable></View>
            : empty ? <EmptyData locale={locale} theme={theme} status={domainStatus ?? 'INSUFFICIENT_DATA'} />
              : children}
  </View>;
}

function MetricCard({ title, value, status, detail, locale, theme }: { title: string; value: string; status: CostStatus; detail?: string; locale: 'fr' | 'en'; theme: Theme }) {
  return <View style={{ flexGrow: 1, flexBasis: 190, minHeight: 138, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface }}>
    <Text style={{ color: theme.muted, fontSize: 12, fontWeight: '700' }}>{title}</Text>
    <Text accessibilityLabel={`${title}: ${value}`} numberOfLines={2} style={{ color: theme.text, marginTop: 11, fontSize: 23, fontWeight: '800' }}>{value}</Text>
    <View style={{ marginTop: 9 }}><StatusPill locale={locale} theme={theme} status={status} /></View>
    {detail && <Text numberOfLines={1} style={{ color: theme.muted, marginTop: 7, fontSize: 11 }}>{detail}</Text>}
  </View>;
}

function overviewMetric(source: CostRecord | undefined, key: 'total' | 'measured' | 'estimated' | 'unknown' | 'unattributed'): CostMetric {
  const cost = nestedValue(source, ['cost']) ?? source;
  const definitions = {
    total: { amount: ['knownUsd', 'totalCost', 'cost', 'totalCostAmount'], minor: ['totalCostMinor', 'costMinor', 'totalMinor'], status: ['totalCostStatus', 'costStatus', 'status'], fallbackStatus: numeric(pick(cost, ['knownUsd'])) === undefined ? 'UNKNOWN' as CostStatus : numeric(pick(cost, ['estimatedUsd', 'estimatedCost'])) ? 'ESTIMATED' as CostStatus : 'MEASURED' as CostStatus },
    measured: { amount: ['measuredUsd', 'measuredCost', 'measuredCostAmount'], minor: ['measuredCostMinor', 'measuredMinor'], status: ['measuredCostStatus', 'measurementStatus'], fallbackStatus: 'MEASURED' as CostStatus },
    estimated: { amount: ['estimatedUsd', 'estimatedCost', 'estimatedCostAmount'], minor: ['estimatedCostMinor', 'estimatedMinor'], status: ['estimatedCostStatus'], fallbackStatus: 'ESTIMATED' as CostStatus },
    unknown: { amount: ['unknownCost', 'unknownCostAmount'], minor: ['unknownCostMinor', 'unknownMinor'], status: ['unknownCostStatus'], fallbackStatus: 'UNKNOWN' as CostStatus },
    unattributed: { amount: ['unattributedCost', 'unallocatedCost'], minor: ['unattributedCostMinor', 'unallocatedCostMinor'], status: ['unattributedCostStatus'], fallbackStatus: 'UNKNOWN' as CostStatus },
  } as const;
  const definition = definitions[key];
  return metric(cost, definition);
}

function Overview({ section, loading, locale, theme, onRetry }: { section: CostSection | undefined; loading: boolean; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const root = sectionRecord(section);
  const total = overviewMetric(root, 'total'); const measured = overviewMetric(root, 'measured'); const estimated = overviewMetric(root, 'estimated'); const unknown = overviewMetric(root, 'unknown');
  const cost = nestedValue(root, ['cost']) ?? root;
  const coverage = pick(nestedValue(cost, ['coverage']) ?? cost, ['measured', 'measuredCoverage', 'coverage', 'coveragePercent', 'measurementCoverage']);
  const unknownAttempts = pick(cost, ['unknownAttempts', 'unknownCostAttempts']);
  const notInstrumentedAttempts = pick(cost, ['notInstrumentedAttempts', 'notInstrumentedCostAttempts']);
  const calls = pick(root, ['providerCalls', 'calls', 'requestCount', 'operations', 'attempts', 'providerAttempts']);
  const blocked = pick(root, ['callsAfterBlocked', 'blockedProviderCalls', 'providerCallsAfterBlocked']);
  const unattributed = overviewMetric(root, 'unattributed');
  return <View style={{ gap: 12 }}>
    <Panel title={c(locale, 'overview')} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry} minHeight={132}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 11 }}>
        <MetricCard title={c(locale, 'totalCost')} value={formatMoney(locale, total)} status={total.status} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'measuredCost')} value={formatMoney(locale, measured)} status={measured.status} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'estimatedCost')} value={formatMoney(locale, estimated)} status={estimated.status} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'unknownCost')} value={formatMoney(locale, unknown)} status={unknown.status} detail={`${formatNumber(locale, unknownAttempts)} UNKNOWN · ${formatNumber(locale, notInstrumentedAttempts)} NOT_INSTRUMENTED`} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'measurementCoverage')} value={formatPercent(locale, coverage)} status={numeric(coverage) === undefined ? 'NOT_INSTRUMENTED' : 'MEASURED'} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'providerCalls')} value={formatNumber(locale, calls)} status={numeric(calls) === undefined ? 'NOT_INSTRUMENTED' : 'MEASURED'} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'unattributed')} value={formatMoney(locale, unattributed)} status={unattributed.status} locale={locale} theme={theme} />
        <MetricCard title={c(locale, 'blockedCalls')} value={formatNumber(locale, blocked)} status={numeric(blocked) === undefined ? 'NOT_INSTRUMENTED' : 'MEASURED'} locale={locale} theme={theme} />
      </View>
    </Panel>
  </View>;
}

type BreakdownKind = 'plan' | 'feature' | 'provider' | 'model' | 'user';

function rowLabel(row: CostRecord, kind: BreakdownKind): string {
  const names: Record<BreakdownKind, string[]> = {
    plan: ['plan', 'planSlug', 'label', 'name', 'id'], feature: ['feature', 'engine', 'resource', 'label', 'name', 'id'],
    provider: ['provider', 'providerName', 'label', 'name', 'id'], model: ['model', 'modelName', 'label', 'name', 'id'],
    user: ['maskedIdentity', 'userEmail', 'email', 'user', 'label', 'id'],
  };
  return text(pick(row, names[kind])) ?? '—';
}

function rowCost(row: CostRecord, parent?: CostRecord): CostMetric {
  const cost = nestedValue(row, ['cost']) ?? row;
  const known = numeric(pick(cost, ['knownUsd', 'totalCost', 'cost', 'costAmount', 'amount']));
  const estimated = numeric(pick(cost, ['estimatedUsd', 'estimatedCost']));
  const unknownAttempts = numeric(pick(cost, ['unknownAttempts', 'unknownCostAttempts']));
  const notInstrumentedAttempts = numeric(pick(cost, ['notInstrumentedAttempts', 'notInstrumentedCostAttempts']));
  const fallbackStatus: CostStatus = known !== undefined
    ? (estimated ? 'ESTIMATED' : 'MEASURED')
    : unknownAttempts && unknownAttempts > 0 ? 'UNKNOWN'
      : notInstrumentedAttempts && notInstrumentedAttempts > 0 ? 'NOT_INSTRUMENTED'
        : 'UNKNOWN';
  return metric(cost, {
    amount: ['knownUsd', 'totalCost', 'cost', 'costAmount', 'amount'],
    minor: ['costMinor', 'totalCostMinor', 'amountMinor'],
    status: ['costStatus', 'measurementStatus', 'status'],
    fallbackStatus,
    fallback: parent,
  });
}

function BreakdownTable({ title, section, loading, kind, locale, theme, onRetry }: { title: string; section: CostSection | undefined; loading: boolean; kind: BreakdownKind; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const root = sectionRecord(section); const rows = sectionRows(section);
  return <Panel title={title} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry}>
    {rows.length === 0 ? <EmptyData locale={locale} theme={theme} status={costStatus(root) ?? 'INSUFFICIENT_DATA'} /> : <ScrollView horizontal showsHorizontalScrollIndicator focusable>
      <View style={{ minWidth: 625, width: '100%' }}>
        <TableHeader locale={locale} theme={theme} labels={[c(locale, 'label'), c(locale, 'cost'), c(locale, 'dataStatus'), c(locale, 'calls'), c(locale, 'units')]} />
        {rows.map((row, index) => {
          const cost = rowCost(row, root); const status = costStatus(row) ?? cost.status;
          return <TableRow key={`${rowLabel(row, kind)}-${index}`} theme={theme} values={[rowLabel(row, kind), formatMoney(locale, cost), displayStatus(locale, status), formatNumber(locale, pick(row, ['calls', 'providerCalls', 'requests', 'requestCount', 'count'])), formatNumber(locale, pick(row, ['units', 'totalUnits', 'inputTokens', 'tokens', 'quantity']))]} />;
        })}
      </View>
    </ScrollView>}
  </Panel>;
}

function TableHeader({ labels, locale: _locale, theme }: { labels: string[]; locale: 'fr' | 'en'; theme: Theme }) {
  return <View style={{ flexDirection: 'row', gap: 9, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border }}>
    {labels.map((label) => <Text key={label} style={{ flex: 1, minWidth: 100, color: theme.muted, fontSize: 10, fontWeight: '800' }}>{label}</Text>)}
  </View>;
}

function TableRow({ values, theme }: { values: string[]; theme: Theme }) {
  return <View style={{ flexDirection: 'row', gap: 9, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
    {values.map((value, index) => <Text key={`${value}-${index}`} numberOfLines={2} style={{ flex: 1, minWidth: 100, color: index === 0 ? theme.text : theme.muted, fontSize: 12 }}>{value}</Text>)}
  </View>;
}

function EnginePanel({ title, section, loading, locale, theme, onRetry }: { title: string; section: CostSection | undefined; loading: boolean; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const root = sectionRecord(section); const rows = sectionRows(section);
  const cost = rowCost(root ?? {});
  const calls = pick(root, ['providerCalls', 'calls', 'requestCount', 'operations', 'attempts', 'providerAttempts']);
  return <Panel title={title} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 11 }}>
      <MetricCard title={c(locale, 'cost')} value={formatMoney(locale, cost)} status={cost.status} locale={locale} theme={theme} />
      <MetricCard title={c(locale, 'calls')} value={formatNumber(locale, calls)} status={numeric(calls) === undefined ? 'NOT_INSTRUMENTED' : 'MEASURED'} locale={locale} theme={theme} />
    </View>
    {rows.length === 0 ? <EmptyData locale={locale} theme={theme} status={costStatus(root) ?? 'INSUFFICIENT_DATA'} /> : <ScrollView horizontal showsHorizontalScrollIndicator focusable>
      <View style={{ minWidth: 540, width: '100%' }}><TableHeader locale={locale} theme={theme} labels={[c(locale, 'engine'), c(locale, 'cost'), c(locale, 'dataStatus'), c(locale, 'units')]} />
        {rows.map((row, index) => { const rowMetric = rowCost(row, root); return <TableRow key={`${index}-${rowLabel(row, 'feature')}`} theme={theme} values={[rowLabel(row, 'feature'), formatMoney(locale, rowMetric), displayStatus(locale, costStatus(row) ?? rowMetric.status), formatNumber(locale, pick(row, ['units', 'totalUnits', 'tokens', 'pages', 'seconds', 'count']))]} />; })}
      </View>
    </ScrollView>}
  </Panel>;
}

function LanguagePanel({ section, loading, locale, theme, onRetry }: { section: CostSection | undefined; loading: boolean; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const root = sectionRecord(section); const rows = sectionRows(section);
  const textRow = rows.find((row) => ['LANGUAGE_TEXT', 'TEXT'].includes(normalize(pick(row, ['feature', 'engine', 'mode', 'channel', 'type'])))) ?? nestedValue(root, ['text', 'languageText']);
  const voiceRow = rows.find((row) => ['LANGUAGE_VOICE', 'VOICE'].includes(normalize(pick(row, ['feature', 'engine', 'mode', 'channel', 'type'])))) ?? nestedValue(root, ['voice', 'languageVoice']);
  const renderMode = (label: string, source: CostRecord | undefined) => {
    const cost = rowCost(source ?? {});
    const units = pick(source, ['units', 'totalUnits', 'tokens', 'seconds', 'calls']);
    return <View style={{ flexGrow: 1, flexBasis: 240, padding: 13, borderRadius: 10, backgroundColor: theme.surfaceMuted }}><Text style={{ color: theme.text, fontWeight: '800', fontSize: 13 }}>{label}</Text><Text style={{ color: theme.text, marginTop: 9, fontWeight: '800', fontSize: 19 }}>{formatMoney(locale, cost)}</Text><View style={{ marginTop: 7 }}><StatusPill locale={locale} theme={theme} status={cost.status} /></View><Text style={{ color: theme.muted, marginTop: 8, fontSize: 11 }}>{c(locale, 'units')}: {formatNumber(locale, units)}</Text></View>;
  };
  return <Panel title={c(locale, 'languageCosts')} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{renderMode(c(locale, 'languageText'), textRow)}{renderMode(c(locale, 'languageVoice'), voiceRow)}</View>
  </Panel>;
}

function Anomalies({ section, loading, locale, theme, onRetry }: { section: CostSection | undefined; loading: boolean; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const rows = sectionRows(section);
  return <Panel title={c(locale, 'anomalies')} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry}>
    {rows.length === 0 ? <EmptyData locale={locale} theme={theme} /> : <ScrollView horizontal showsHorizontalScrollIndicator focusable><View style={{ minWidth: 620, width: '100%' }}>
      <TableHeader locale={locale} theme={theme} labels={[c(locale, 'severity'), c(locale, 'signal'), c(locale, 'shownAs'), c(locale, 'observedAt'), c(locale, 'dataStatus')]} />
      {rows.map((row, index) => <TableRow key={`${text(pick(row, ['id', 'type', 'signal'])) ?? 'signal'}-${index}`} theme={theme} values={[text(pick(row, ['severity', 'level'])) ?? '—', text(pick(row, ['type', 'signal', 'code'])) ?? '—', text(pick(row, ['message', 'description', 'label', 'count'])) ?? '—', formatDate(locale, pick(row, ['observedAt', 'createdAt', 'detectedAt', 'at'])), displayStatus(locale, costStatus(row))]} />)}
    </View></ScrollView>}
  </Panel>;
}

function Instrumentation({ section, loading, locale, theme, onRetry }: { section: CostSection | undefined; loading: boolean; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const root = sectionRecord(section); const rows = sectionRows(section, ['items', 'rows', 'coverage', 'features', 'sources']);
  return <Panel title={c(locale, 'instrumentation')} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry}>
    {rows.length === 0 ? <EmptyData locale={locale} theme={theme} status={costStatus(root) ?? 'NOT_INSTRUMENTED'} /> : <ScrollView horizontal showsHorizontalScrollIndicator focusable><View style={{ minWidth: 650, width: '100%' }}>
      <TableHeader locale={locale} theme={theme} labels={[c(locale, 'source'), c(locale, 'coverage'), c(locale, 'dataStatus'), c(locale, 'lastObserved'), c(locale, 'shownAs')]} />
      {rows.map((row, index) => <TableRow key={`${text(pick(row, ['source', 'feature', 'engine', 'id'])) ?? 'source'}-${index}`} theme={theme} values={[text(pick(row, ['source', 'feature', 'engine', 'provider', 'id'])) ?? '—', formatPercent(locale, pick(row, ['coverage', 'coveragePercent', 'instrumentedPercent'])), displayStatus(locale, costStatus(row)), formatDate(locale, pick(row, ['lastObservedAt', 'updatedAt', 'observedAt'])), text(pick(row, ['reason', 'missing', 'message', 'note'])) ?? '—']} />)}
    </View></ScrollView>}
  </Panel>;
}

function CatalogPrice({ locale, row, root, theme }: { locale: 'fr' | 'en'; row: CostRecord; root?: CostRecord; theme: Theme }) {
  const direct = numeric(pick(row, ['price', 'priceUsd', 'pricePerUnit', 'unitPrice', 'amount', 'usdPerUnit', 'usdPerMillion']));
  const minor = numeric(pick(row, ['priceMinor', 'pricePerUnitMinor', 'unitPriceMinor']));
  const value = direct ?? (minor === undefined ? undefined : minor / 100);
  const rawStatus = normalize(pick(row, ['pricingStatus', 'status', 'costStatus']));
  const known = ['ACTIVE', 'KNOWN', 'MEASURED', 'ESTIMATED'].includes(rawStatus);
  if (value === undefined || !known) return <Text style={{ color: theme.danger, fontSize: 12 }}>{c(locale, 'unknownPrice')}</Text>;
  try { return <Text style={{ color: theme.muted, fontSize: 12 }}>{new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: currencyOf(row, root), maximumFractionDigits: 8 }).format(value)}</Text>; }
  catch { return <Text style={{ color: theme.muted, fontSize: 12 }}>{value} {currencyOf(row, root)}</Text>; }
}

const catalogRateFields: ReadonlyArray<readonly [string, string]> = [
  ['inputTokenPrice', 'INPUT_TOKEN'], ['cachedInputTokenPrice', 'CACHED_INPUT_TOKEN'], ['outputTokenPrice', 'OUTPUT_TOKEN'], ['reasoningTokenPrice', 'REASONING_TOKEN'],
  ['audioInputSecondPrice', 'AUDIO_INPUT_SECOND'], ['audioOutputSecondPrice', 'AUDIO_OUTPUT_SECOND'], ['ocrPagePrice', 'OCR_PAGE'], ['visionCallPrice', 'VISION_CALL'],
  ['embeddingUnitPrice', 'EMBEDDING_UNIT'], ['searchUnitPrice', 'SEARCH_UNIT'], ['otherUnitPrice', 'OTHER_UNIT'],
];

function catalogRates(rows: CostRecord[]): CostRecord[] {
  return rows.flatMap((row) => {
    if (text(pick(row, ['unit'])) && numeric(pick(row, ['price', 'priceUsd', 'pricePerUnit', 'unitPrice', 'amount'])) !== undefined) return [row];
    const rates = catalogRateFields.flatMap(([field, unit]) => numeric(row[field]) === undefined
      ? []
      : [{ ...row, unit: field === 'otherUnitPrice' ? text(pick(row, ['otherUnitName'])) ?? unit : unit, price: row[field] }]);
    return rates.length ? rates : [{ ...row, unit: 'NOT_PUBLISHED', price: undefined }];
  });
}

function Pricing({ section, loading, locale, theme, onRetry }: { section: CostSection | undefined; loading: boolean; locale: 'fr' | 'en'; theme: Theme; onRetry: () => void }) {
  const root = sectionRecord(section); const rows = catalogRates(sectionRows(section, ['items', 'rows', 'prices', 'entries', 'catalog']));
  return <Panel title={c(locale, 'pricing')} section={section} loading={loading} locale={locale} theme={theme} onRetry={onRetry} minHeight={220}>
    <Text style={{ color: theme.warning, fontSize: 11, fontWeight: '800', marginBottom: 10 }}>{c(locale, 'pricingReadOnly')}</Text>
    {rows.length === 0 ? <EmptyData locale={locale} theme={theme} status={costStatus(root) ?? 'NOT_INSTRUMENTED'} /> : <ScrollView horizontal showsHorizontalScrollIndicator focusable><View style={{ minWidth: 730, width: '100%' }}>
      <TableHeader locale={locale} theme={theme} labels={[c(locale, 'provider'), c(locale, 'model'), c(locale, 'unit'), c(locale, 'price'), c(locale, 'version'), c(locale, 'effectiveFrom')]} />
      {rows.map((row, index) => <View key={`${text(pick(row, ['id', 'provider', 'model'])) ?? 'price'}-${index}`} style={{ flexDirection: 'row', gap: 9, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Text style={{ flex: 1, minWidth: 112, color: theme.text, fontSize: 12 }}>{text(pick(row, ['provider', 'providerName'])) ?? '—'}</Text>
        <Text style={{ flex: 1, minWidth: 112, color: theme.muted, fontSize: 12 }}>{text(pick(row, ['model', 'modelName'])) ?? '—'}</Text>
        <Text style={{ flex: 1, minWidth: 112, color: theme.muted, fontSize: 12 }}>{text(pick(row, ['unit', 'unitType', 'meter'])) ?? '—'}</Text>
        <View style={{ flex: 1, minWidth: 112 }}><CatalogPrice locale={locale} row={row} root={root} theme={theme} /></View>
        <Text style={{ flex: 1, minWidth: 112, color: theme.muted, fontSize: 12 }}>{text(pick(row, ['version', 'catalogVersion', 'versionId'])) ?? '—'}</Text>
        <Text style={{ flex: 1, minWidth: 112, color: theme.muted, fontSize: 12 }}>{formatDate(locale, pick(row, ['effectiveFrom', 'startsAt', 'createdAt']))}</Text>
      </View>)}
    </View></ScrollView>}
    <Text style={{ color: theme.muted, fontSize: 11, marginTop: 10 }}>{c(locale, 'noAutomaticChange')}</Text>
  </Panel>;
}

function FilterInput({ label, placeholder, value, onChange, theme }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; theme: Theme }) {
  return <View style={{ flexGrow: 1, flexBasis: 155, minWidth: 130, gap: 5 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={theme.muted} autoCapitalize="none" style={{ color: theme.text, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 8, fontSize: 13 }} /></View>;
}

function hasCostRead(identity: { roles: string[]; capabilities: string[] } | null): boolean {
  return identity?.roles.includes('SUPER_ADMIN') === true || identity?.capabilities.includes('costs.read') === true;
}

const initialFilters: CostFilters = { range: '30d' };

export function CostCenter() {
  const { identity } = useAuth(); const { dark, locale } = useAdminUi(); const { width } = useWindowDimensions();
  const theme = useMemo(() => themeFor(dark), [dark]); const allowed = hasCostRead(identity);
  const [draft, setDraft] = useState<CostFilters>(initialFilters); const [filters, setFilters] = useState<CostFilters>(initialFilters);
  const [sections, setSections] = useState<CostCenterSections | null>(null); const [loading, setLoading] = useState(false); const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try { setSections(await getCostCenter(filters)); setUpdatedAt(new Date().toISOString()); }
    finally { setLoading(false); }
  }, [allowed, filters]);
  useEffect(() => { void load(); }, [load]);

  const retry = () => { void load(); };
  const useFilter = (key: keyof CostFilters, value: string | CostStatus | CostRange | undefined) => setDraft((current) => ({ ...current, [key]: value || undefined }));
  const apply = () => setFilters({ ...draft, range: draft.range ?? '30d' });
  const clear = () => { setDraft(initialFilters); setFilters(initialFilters); };
  const section = (key: keyof CostCenterSections) => sections?.[key];
  const active = [filters.plan, filters.feature, filters.provider, filters.model, filters.status].filter(Boolean).join(' · ');

  if (!allowed) return <View style={{ gap: 14 }}><View style={{ padding: 20, borderWidth: 1, borderColor: theme.danger, borderRadius: 14, backgroundColor: theme.dangerSoft }}><Text accessibilityRole="header" style={{ color: theme.danger, fontSize: 21, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.text, marginTop: 8, fontSize: 14 }}>{c(locale, 'noPermission')}</Text><Text style={{ color: theme.muted, marginTop: 6, fontSize: 12 }}>{c(locale, 'noPermissionDetail')}</Text></View></View>;

  return <View style={{ gap: 17, paddingBottom: 28 }}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 260 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{c(locale, 'title')}</Text><View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.primarySoft }}><Text style={{ color: theme.primary, fontSize: 9, fontWeight: '900', letterSpacing: .3 }}>{c(locale, 'telemetryFirst')}</Text></View></View><Text style={{ color: theme.muted, marginTop: 7, fontSize: 13, maxWidth: 900 }}>{c(locale, 'subtitle')}</Text>{active ? <Text style={{ color: theme.muted, marginTop: 6, fontSize: 11 }}>{c(locale, 'activeFilters')}: {active}</Text> : null}</View>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 11 }}>{updatedAt ? `${c(locale, 'updated')}: ${formatDate(locale, updatedAt)}` : ''}</Text><Pressable accessibilityRole="button" accessibilityLabel={c(locale, 'refresh')} disabled={loading} onPress={retry} style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary, opacity: loading ? .65 : 1 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{loading ? c(locale, 'refreshing') : c(locale, 'refresh')}</Text></Pressable></View>
    </View>

    <View style={{ padding: 14, gap: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 13, backgroundColor: theme.surfaceMuted }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
        <View style={{ flexGrow: 1, flexBasis: width < 700 ? '100%' : 250, gap: 6 }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{c(locale, 'range')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{ranges.map((range) => <Pressable key={range} accessibilityRole="button" accessibilityLabel={c(locale, rangeLabels[range])} accessibilityState={{ selected: draft.range === range }} onPress={() => useFilter('range', range)} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 7, borderWidth: 1, borderColor: draft.range === range ? theme.primary : theme.border, backgroundColor: draft.range === range ? theme.primarySoft : theme.surface }}><Text style={{ color: draft.range === range ? theme.primary : theme.text, fontWeight: '800', fontSize: 12 }}>{c(locale, rangeLabels[range])}</Text></Pressable>)}</View></View>
        <FilterInput label={c(locale, 'plan')} placeholder={c(locale, 'planHint')} value={draft.plan ?? ''} onChange={(value) => useFilter('plan', value)} theme={theme} />
        <FilterInput label={c(locale, 'feature')} placeholder={c(locale, 'featureHint')} value={draft.feature ?? ''} onChange={(value) => useFilter('feature', value)} theme={theme} />
        <FilterInput label={c(locale, 'provider')} placeholder={c(locale, 'providerHint')} value={draft.provider ?? ''} onChange={(value) => useFilter('provider', value)} theme={theme} />
        <FilterInput label={c(locale, 'model')} placeholder={c(locale, 'modelHint')} value={draft.model ?? ''} onChange={(value) => useFilter('model', value)} theme={theme} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}><Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{c(locale, 'status')}</Text>{statusFilters.map((status) => <Pressable key={status ?? 'all'} accessibilityRole="button" accessibilityLabel={status ? displayStatus(locale, status) : c(locale, 'statusHint')} accessibilityState={{ selected: draft.status === status }} onPress={() => useFilter('status', status)} style={{ paddingVertical: 7, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1, borderColor: draft.status === status ? theme.primary : theme.border, backgroundColor: draft.status === status ? theme.primarySoft : theme.surface }}><Text style={{ color: draft.status === status ? theme.primary : theme.text, fontSize: 10, fontWeight: '800' }}>{status ? displayStatus(locale, status) : c(locale, 'statusHint')}</Text></Pressable>)}<View style={{ flexGrow: 1 }} /><Pressable accessibilityRole="button" accessibilityLabel={c(locale, 'clear')} onPress={clear} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 7 }}><Text style={{ color: theme.muted, fontSize: 12, fontWeight: '800' }}>{c(locale, 'clear')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={c(locale, 'apply')} onPress={apply} style={{ paddingVertical: 8, paddingHorizontal: 11, borderRadius: 7, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{c(locale, 'apply')}</Text></Pressable></View>
    </View>

    <Overview section={section('overview')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <BreakdownTable title={c(locale, 'costsByPlan')} section={section('plans')} loading={sections === null} kind="plan" locale={locale} theme={theme} onRetry={retry} />
      <BreakdownTable title={c(locale, 'costsByFeature')} section={section('features')} loading={sections === null} kind="feature" locale={locale} theme={theme} onRetry={retry} />
      <BreakdownTable title={c(locale, 'costsByProvider')} section={section('providers')} loading={sections === null} kind="provider" locale={locale} theme={theme} onRetry={retry} />
      <BreakdownTable title={c(locale, 'costsByModel')} section={section('models')} loading={sections === null} kind="model" locale={locale} theme={theme} onRetry={retry} />
      <BreakdownTable title={c(locale, 'costsByUser')} section={section('users')} loading={sections === null} kind="user" locale={locale} theme={theme} onRetry={retry} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      <LanguagePanel section={section('languages')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} />
      <EnginePanel title={c(locale, 'voiceCosts')} section={section('voice')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} />
      <EnginePanel title={c(locale, 'documentCosts')} section={section('documents')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} />
      <EnginePanel title={c(locale, 'researchCosts')} section={section('research')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><Anomalies section={section('anomalies')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} /><Instrumentation section={section('instrumentation')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} /></View>
    <Pricing section={section('pricing')} loading={sections === null} locale={locale} theme={theme} onRetry={retry} />
  </View>;
}
