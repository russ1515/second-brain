import { useCallback, useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth';
import { useAdminUi } from '../contexts/admin-ui';
import {
  getInfrastructure,
  INFRASTRUCTURE_RANGES,
  type AlertState,
  type DataStatus,
  type InfrastructureOverview,
  type InfrastructureRange,
  type InfrastructureResult,
  type SystemHealthStatus,
} from '../lib/infrastructure';

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

const copy = {
  fr: {
    title: 'Santé système',
    subtitle: 'Observation en lecture seule. Cette vue ne redémarre, ne déploie et ne modifie aucun service, quota, fournisseur ou paramètre.',
    refresh: 'Actualiser', refreshing: 'Actualisation…',
    range: 'Fenêtre d’observation', now: 'Maintenant', h1: '1 heure', h24: '24 heures', d7: '7 jours',
    observed: 'OBSERVED', insufficient: 'INSUFFICIENT_DATA', notInstrumented: 'NOT_INSTRUMENTED', unknownData: 'UNKNOWN',
    healthy: 'HEALTHY', degraded: 'DEGRADED', unavailable: 'UNAVAILABLE', unknown: 'UNKNOWN',
    overall: 'État global', components: 'Composants', providers: 'Fournisseurs et instrumentation',
    resourceMetrics: 'Ressources hôte et conteneurs', performance: 'Performance et erreurs', alerts: 'États d’alerte', correlations: 'Corrélations opérationnelles',
    restricted: 'Votre rôle ne dispose pas de infrastructure.read.',
    restrictedDetail: 'Le serveur reste l’autorité. Aucune donnée de santé n’est demandée sans cette capacité.',
    unavailableEndpoint: 'L’endpoint Infrastructure n’est pas disponible dans cet environnement.',
    genericError: 'Les données n’ont pas pu être chargées. Aucun état n’est supposé.', retry: 'Réessayer', loading: 'Chargement des observations…',
    observedAt: 'Observé le', generatedAt: 'Généré le', noComponents: 'Aucun composant vérifiable n’a été retourné.',
    noProviders: 'Aucune tentative fournisseur vérifiable pour cette période.',
    noAlerts: 'Aucun enregistrement d’alerte n’a été retourné pour cette période.',
    noCorrelations: 'Aucune corrélation Bug/Incident vérifiable pour cette période.',
    currentProcess: 'Processus API actuel', selectedRange: 'Fenêtre sélectionnée', currentProcessOnly: 'Mesures du processus actuel uniquement — elles ne représentent pas un historique 1 h / 24 h / 7 j.',
    requestCount: 'Requêtes observées', serverErrors: 'Erreurs serveur', errorRate: 'Taux d’erreur', p50: 'Latence P50', p95: 'Latence P95', processMemory: 'Mémoire processus', uptime: 'Uptime',
    errorEvents: 'Error Events', httpErrorRate: 'Taux HTTP', slowRequests: 'Requêtes lentes',
    notInstrumentedDetail: 'Cette mesure n’est pas instrumentée. Elle n’est jamais assimilée à zéro.',
    insufficientDetail: 'Le jeu de données est insuffisant pour une conclusion.',
    unknownDetail: 'L’état n’est pas vérifiable avec les données disponibles.',
    host: 'Hôte', containers: 'Conteneurs', cpuCores: 'Cœurs CPU', load: 'Charge', memory: 'Mémoire disponible', disk: 'Disque disponible',
    total: 'Total', running: 'En cours', unhealthy: 'Non sains', restarting: 'Redémarrages',
    service: 'Service', provider: 'Fournisseur', model: 'Modèle', attempts: 'Tentatives', failures: 'Échecs', retries: 'Retries', averageLatency: 'Latence moyenne',
    inputTokens: 'Tokens entrée', cachedTokens: 'Tokens cache', outputTokens: 'Tokens sortie', lastObserved: 'Dernière observation', lastSuccess: 'Dernier succès', lastError: 'Dernière erreur observée', sampledProviderDetail: 'Échantillon borné : les comptes affichés sont des minimums observés, pas des totaux de période.',
    active: 'ACTIVE', noActiveAlert: 'NO_ACTIVE_ALERT', businessDecision: 'BUSINESS_DECISION_REQUIRED', severity: 'Sévérité', component: 'Composant',
    bugGroup: 'Bug Group', incident: 'Incident', source: 'Source', occurrences: 'Occurrences', affectedUsers: 'Utilisateurs affectés', lastSeen: 'Dernière occurrence',
    noAutomaticIncident: 'Les corrélations sont des éléments de diagnostic ; elles ne créent aucun incident automatiquement.',
    alertSafety: 'Les alertes signalent un état à examiner. Elles n’exécutent aucune action automatique.',
    readOnly: 'LECTURE SEULE',
  },
  en: {
    title: 'System health',
    subtitle: 'Read-only observation. This view never restarts, deploys, or changes services, quotas, providers, or configuration.',
    refresh: 'Refresh', refreshing: 'Refreshing…',
    range: 'Observation window', now: 'Now', h1: '1 hour', h24: '24 hours', d7: '7 days',
    observed: 'OBSERVED', insufficient: 'INSUFFICIENT_DATA', notInstrumented: 'NOT_INSTRUMENTED', unknownData: 'UNKNOWN',
    healthy: 'HEALTHY', degraded: 'DEGRADED', unavailable: 'UNAVAILABLE', unknown: 'UNKNOWN',
    overall: 'Overall state', components: 'Components', providers: 'Providers and instrumentation',
    resourceMetrics: 'Host and container resources', performance: 'Performance and errors', alerts: 'Alert states', correlations: 'Operational correlations',
    restricted: 'Your role does not have infrastructure.read.',
    restrictedDetail: 'The server remains authoritative. No health data is requested without this capability.',
    unavailableEndpoint: 'The Infrastructure endpoint is not available in this environment.',
    genericError: 'The data could not be loaded. No state is assumed.', retry: 'Retry', loading: 'Loading observations…',
    observedAt: 'Observed at', generatedAt: 'Generated at', noComponents: 'No verifiable component was returned.',
    noProviders: 'No verifiable provider attempt for this range.',
    noAlerts: 'No alert record was returned for this range.',
    noCorrelations: 'No verifiable Bug/Incident correlation for this range.',
    currentProcess: 'Current API process', selectedRange: 'Selected range', currentProcessOnly: 'Current-process measurements only — they are not a 1 h / 24 h / 7 d history.',
    requestCount: 'Observed requests', serverErrors: 'Server errors', errorRate: 'Error rate', p50: 'P50 latency', p95: 'P95 latency', processMemory: 'Process memory', uptime: 'Uptime',
    errorEvents: 'Error Events', httpErrorRate: 'HTTP error rate', slowRequests: 'Slow requests',
    notInstrumentedDetail: 'This metric is not instrumented. It is never treated as zero.',
    insufficientDetail: 'The dataset is insufficient for a conclusion.',
    unknownDetail: 'The state cannot be verified from available data.',
    host: 'Host', containers: 'Containers', cpuCores: 'CPU cores', load: 'Load', memory: 'Available memory', disk: 'Available disk',
    total: 'Total', running: 'Running', unhealthy: 'Unhealthy', restarting: 'Restarting',
    service: 'Service', provider: 'Provider', model: 'Model', attempts: 'Attempts', failures: 'Failures', retries: 'Retries', averageLatency: 'Average latency',
    inputTokens: 'Input tokens', cachedTokens: 'Cached tokens', outputTokens: 'Output tokens', lastObserved: 'Last observation', lastSuccess: 'Last success', lastError: 'Last observed error', sampledProviderDetail: 'Bounded sample: displayed counts are observed lower bounds, not period totals.',
    active: 'ACTIVE', noActiveAlert: 'NO_ACTIVE_ALERT', businessDecision: 'BUSINESS_DECISION_REQUIRED', severity: 'Severity', component: 'Component',
    bugGroup: 'Bug Group', incident: 'Incident', source: 'Source', occurrences: 'Occurrences', affectedUsers: 'Affected users', lastSeen: 'Last seen',
    noAutomaticIncident: 'Correlations are diagnostic evidence; they never create an incident automatically.',
    alertSafety: 'Alerts identify a state for review. They perform no automatic action.',
    readOnly: 'READ ONLY',
  },
} as const;

type CopyKey = keyof typeof copy.en;
type Locale = 'fr' | 'en';

const rangeLabels: Record<InfrastructureRange, CopyKey> = { now: 'now', '1h': 'h1', '24h': 'h24', '7d': 'd7' };
const statusLabels: Record<SystemHealthStatus, CopyKey> = { HEALTHY: 'healthy', DEGRADED: 'degraded', UNAVAILABLE: 'unavailable', UNKNOWN: 'unknown' };
const dataLabels: Record<DataStatus, CopyKey> = { OBSERVED: 'observed', INSUFFICIENT_DATA: 'insufficient', NOT_INSTRUMENTED: 'notInstrumented', UNKNOWN: 'unknownData' };
const alertLabels: Record<AlertState, CopyKey> = { ACTIVE: 'active', NO_ACTIVE_ALERT: 'noActiveAlert', NOT_INSTRUMENTED: 'notInstrumented', BUSINESS_DECISION_REQUIRED: 'businessDecision' };

function c(locale: Locale, key: CopyKey): string { return copy[locale][key]; }

function themeFor(dark: boolean): Theme {
  return dark
    ? { surface: '#111827', surfaceMuted: '#172033', border: '#263244', text: '#f1f5f9', muted: '#94a3b8', primary: '#60a5fa', primarySoft: '#172554', success: '#34d399', successSoft: '#052e2b', warning: '#fbbf24', warningSoft: '#422006', danger: '#f87171', dangerSoft: '#450a0a' }
    : { surface: '#ffffff', surfaceMuted: '#f8fafc', border: '#dbe4ee', text: '#0f172a', muted: '#475569', primary: '#1d4ed8', primarySoft: '#dbeafe', success: '#047857', successSoft: '#d1fae5', warning: '#92400e', warningSoft: '#fef3c7', danger: '#b91c1c', dangerSoft: '#fee2e2' };
}

function statusColors(theme: Theme, status: SystemHealthStatus | DataStatus | AlertState): { color: string; backgroundColor: string } {
  switch (status) {
    case 'HEALTHY': case 'OBSERVED': case 'NO_ACTIVE_ALERT': return { color: theme.success, backgroundColor: theme.successSoft };
    case 'DEGRADED': case 'INSUFFICIENT_DATA': case 'BUSINESS_DECISION_REQUIRED': return { color: theme.warning, backgroundColor: theme.warningSoft };
    case 'UNAVAILABLE': case 'ACTIVE': return { color: theme.danger, backgroundColor: theme.dangerSoft };
    default: return { color: theme.muted, backgroundColor: theme.surfaceMuted };
  }
}

function displayDate(locale: Locale, value: string | null): string {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function displayNumber(locale: Locale, value: number | null, suffix?: string): string {
  if (value === null) return '—';
  const number = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }).format(value);
  return suffix ? `${number} ${suffix}` : number;
}

function displayPercent(locale: Locale, value: number | null): string {
  if (value === null) return 'NOT_INSTRUMENTED';
  const percent = value <= 1 ? value * 100 : value;
  return `${displayNumber(locale, percent)} %`;
}

function displayBytes(locale: Locale, value: number | null): string {
  if (value === null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = value; let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
  return `${displayNumber(locale, amount)} ${units[index]}`;
}

function displayDuration(locale: Locale, seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return displayNumber(locale, seconds, 's');
  if (seconds < 3600) return displayNumber(locale, seconds / 60, 'min');
  return displayNumber(locale, seconds / 3600, 'h');
}

function componentLabel(locale: Locale, key: string): string {
  const known: Record<string, { fr: string; en: string }> = {
    API: { fr: 'API', en: 'API' }, POSTGRESQL: { fr: 'PostgreSQL', en: 'PostgreSQL' }, REDIS: { fr: 'Redis', en: 'Redis' }, QDRANT: { fr: 'Qdrant', en: 'Qdrant' },
    SMTP: { fr: 'SMTP', en: 'SMTP' }, MAILER: { fr: 'Messagerie', en: 'Mailer' }, STORAGE: { fr: 'Stockage', en: 'Storage' }, JOBS: { fr: 'Jobs', en: 'Jobs' }, QUEUES: { fr: 'Files', en: 'Queues' },
    LLM: { fr: 'LLM', en: 'LLM' }, OPENAI: { fr: 'OpenAI', en: 'OpenAI' }, SPEECH: { fr: 'Voix', en: 'Speech' }, SEARCH: { fr: 'Recherche', en: 'Search' }, EMBEDDINGS: { fr: 'Embeddings', en: 'Embeddings' },
  };
  return known[key]?.[locale] ?? key;
}

function dataStatusDetail(locale: Locale, status: DataStatus): string {
  if (status === 'NOT_INSTRUMENTED') return c(locale, 'notInstrumentedDetail');
  if (status === 'INSUFFICIENT_DATA') return c(locale, 'insufficientDetail');
  if (status === 'UNKNOWN') return c(locale, 'unknownDetail');
  return '';
}

function StatusPill({ locale, theme, status }: { locale: Locale; theme: Theme; status: SystemHealthStatus }) {
  const style = statusColors(theme, status);
  return <View accessibilityRole="text" accessibilityLabel={c(locale, statusLabels[status])} style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: style.backgroundColor }}><Text style={{ color: style.color, fontSize: 10, fontWeight: '800', letterSpacing: .35 }}>{c(locale, statusLabels[status])}</Text></View>;
}

function DataPill({ locale, theme, status }: { locale: Locale; theme: Theme; status: DataStatus }) {
  const style = statusColors(theme, status);
  return <View accessibilityRole="text" accessibilityLabel={c(locale, dataLabels[status])} style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: style.backgroundColor }}><Text style={{ color: style.color, fontSize: 10, fontWeight: '800', letterSpacing: .25 }}>{c(locale, dataLabels[status])}</Text></View>;
}

function AlertPill({ locale, theme, state }: { locale: Locale; theme: Theme; state: AlertState }) {
  const style = statusColors(theme, state);
  return <View accessibilityRole="text" accessibilityLabel={c(locale, alertLabels[state])} style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: style.backgroundColor }}><Text style={{ color: style.color, fontSize: 10, fontWeight: '800', letterSpacing: .25 }}>{c(locale, alertLabels[state])}</Text></View>;
}

function Panel({ title, children, theme, right }: PropsWithChildren<{ title: string; theme: Theme; right?: ReactNode }>) {
  return <View style={{ flexGrow: 1, flexBasis: 360, minWidth: 0, padding: 17, borderWidth: 1, borderColor: theme.border, borderRadius: 14, backgroundColor: theme.surface }}>
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
      <Text accessibilityRole="header" style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>{right}
    </View>
    {children}
  </View>;
}

function Metric({ label, value, theme, detail }: { label: string; value: string; theme: Theme; detail?: string }) {
  return <View style={{ flexGrow: 1, flexBasis: 130, minWidth: 0, gap: 4 }}>
    <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    <Text accessibilityLabel={`${label}: ${value}`} style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{value}</Text>
    {detail ? <Text style={{ color: theme.muted, fontSize: 10, lineHeight: 14 }}>{detail}</Text> : null}
  </View>;
}

function EmptyData({ text, theme }: { text: string; theme: Theme }) {
  return <View style={{ minHeight: 86, alignItems: 'center', justifyContent: 'center', padding: 12 }}><Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center' }}>{text}</Text></View>;
}

function Loading({ locale, theme }: { locale: Locale; theme: Theme }) {
  return <View accessibilityLiveRegion="polite" style={{ minHeight: 180, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.muted }}>{c(locale, 'loading')}</Text></View>;
}

function Failure({ state, locale, theme, onRetry }: { state: InfrastructureResult['state']; locale: Locale; theme: Theme; onRetry: () => void }) {
  const text = state === 'forbidden' ? c(locale, 'restricted') : state === 'unavailable' ? c(locale, 'unavailableEndpoint') : c(locale, 'genericError');
  const detail = state === 'forbidden' ? c(locale, 'restrictedDetail') : undefined;
  return <View style={{ minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 }}>
    <Text style={{ color: state === 'forbidden' ? theme.danger : theme.muted, textAlign: 'center', fontWeight: '700' }}>{text}</Text>
    {detail ? <Text style={{ color: theme.muted, textAlign: 'center', fontSize: 12 }}>{detail}</Text> : null}
    {state === 'error' ? <Pressable accessibilityRole="button" accessibilityLabel={c(locale, 'retry')} onPress={onRetry} style={{ borderRadius: 8, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800' }}>{c(locale, 'retry')}</Text></Pressable> : null}
  </View>;
}

function Overall({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  return <Panel title={c(locale, 'overall')} theme={theme} right={<StatusPill locale={locale} theme={theme} status={data.overall.status} />}>
    <View style={{ gap: 10 }}>
      <DataPill locale={locale} theme={theme} status={data.overall.dataStatus} />
      {data.overall.dataStatus !== 'OBSERVED' ? <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 17 }}>{dataStatusDetail(locale, data.overall.dataStatus)}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 }}>
        <Metric label={c(locale, 'generatedAt')} value={displayDate(locale, data.generatedAt)} theme={theme} />
        <Metric label={c(locale, 'range')} value={`${displayDate(locale, data.range.from)} — ${displayDate(locale, data.range.to)}`} theme={theme} />
      </View>
    </View>
  </Panel>;
}

function Components({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  return <Panel title={c(locale, 'components')} theme={theme}>
    {data.components.length === 0 ? <EmptyData text={c(locale, 'noComponents')} theme={theme} /> : <View style={{ gap: 8 }}>
      {data.components.map((component) => <View key={component.key} testID={`system-health-component-${component.key}`} style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 7 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.text, fontWeight: '800', flexGrow: 1 }}>{componentLabel(locale, component.key)}</Text>
          <StatusPill locale={locale} theme={theme} status={component.status} />
          <DataPill locale={locale} theme={theme} status={component.dataStatus} />
        </View>
        <Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'observedAt')}: {displayDate(locale, component.observedAt)}</Text>
        {component.dataStatus !== 'OBSERVED' ? <Text style={{ color: theme.muted, fontSize: 11 }}>{dataStatusDetail(locale, component.dataStatus)}</Text> : null}
      </View>)}
    </View>}
  </Panel>;
}

function Performance({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  const current = data.performance.currentProcess; const selected = data.performance.selectedRange;
  return <Panel title={c(locale, 'performance')} theme={theme} right={<DataPill locale={locale} theme={theme} status={current.dataStatus} />}>
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.text, fontWeight: '800' }}>{c(locale, 'currentProcess')}</Text>
        <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 15 }}>{c(locale, 'currentProcessOnly')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 3 }}>
          <Metric label={c(locale, 'requestCount')} value={displayNumber(locale, current.requestCount)} theme={theme} />
          <Metric label={c(locale, 'serverErrors')} value={displayNumber(locale, current.serverErrors)} theme={theme} />
          <Metric label={c(locale, 'errorRate')} value={displayPercent(locale, current.errorRate)} theme={theme} />
          <Metric label={c(locale, 'p50')} value={displayNumber(locale, current.p50Ms, 'ms')} theme={theme} />
          <Metric label={c(locale, 'p95')} value={displayNumber(locale, current.p95Ms, 'ms')} theme={theme} />
          <Metric label={c(locale, 'processMemory')} value={displayNumber(locale, current.processRssMb, 'MB')} theme={theme} />
          <Metric label={c(locale, 'uptime')} value={displayDuration(locale, current.uptimeSeconds)} theme={theme} />
        </View>
        {current.dataStatus !== 'OBSERVED' ? <Text style={{ color: theme.muted, fontSize: 11 }}>{dataStatusDetail(locale, current.dataStatus)}</Text> : null}
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 15, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: theme.text, fontWeight: '800' }}>{c(locale, 'selectedRange')}</Text><DataPill locale={locale} theme={theme} status={selected.dataStatus} /></View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
          <Metric label={c(locale, 'errorEvents')} value={displayNumber(locale, selected.errorEvents)} theme={theme} />
          <Metric label={c(locale, 'httpErrorRate')} value="NOT_INSTRUMENTED" theme={theme} detail={c(locale, 'notInstrumentedDetail')} />
          <Metric label={c(locale, 'slowRequests')} value="NOT_INSTRUMENTED" theme={theme} detail={c(locale, 'notInstrumentedDetail')} />
        </View>
        {selected.dataStatus !== 'OBSERVED' ? <Text style={{ color: theme.muted, fontSize: 11 }}>{dataStatusDetail(locale, selected.dataStatus)}</Text> : null}
      </View>
    </View>
  </Panel>;
}

function Resources({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  const { resources } = data;
  return <View testID="system-health-resources"><Panel title={c(locale, 'resourceMetrics')} theme={theme} right={<DataPill locale={locale} theme={theme} status={resources.dataStatus} />}>
    {resources.dataStatus !== 'OBSERVED' || !resources.host || !resources.containers ? <View style={{ gap: 9 }}><Text style={{ color: theme.muted, fontSize: 12 }}>{dataStatusDetail(locale, resources.dataStatus)}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'observedAt')}: {displayDate(locale, resources.observedAt)}</Text></View> : <View style={{ gap: 17 }}>
      <View style={{ gap: 8 }}><Text style={{ color: theme.text, fontWeight: '800' }}>{c(locale, 'host')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
        <Metric label={c(locale, 'cpuCores')} value={displayNumber(locale, resources.host.cpuCores)} theme={theme} />
        <Metric label={c(locale, 'load')} value={[resources.host.load1, resources.host.load5, resources.host.load15].map((value) => displayNumber(locale, value)).join(' / ')} theme={theme} />
        <Metric label={c(locale, 'memory')} value={displayBytes(locale, resources.host.memoryAvailableBytes)} theme={theme} />
        <Metric label={c(locale, 'disk')} value={displayBytes(locale, resources.host.diskAvailableBytes)} theme={theme} />
        <Metric label={c(locale, 'uptime')} value={displayDuration(locale, resources.host.uptimeSeconds)} theme={theme} />
      </View></View>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 15, gap: 8 }}><Text style={{ color: theme.text, fontWeight: '800' }}>{c(locale, 'containers')}</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 15 }}>
        <Metric label={c(locale, 'total')} value={displayNumber(locale, resources.containers.total)} theme={theme} />
        <Metric label={c(locale, 'running')} value={displayNumber(locale, resources.containers.running)} theme={theme} />
        <Metric label={c(locale, 'unhealthy')} value={displayNumber(locale, resources.containers.unhealthy)} theme={theme} />
        <Metric label={c(locale, 'restarting')} value={displayNumber(locale, resources.containers.restarting)} theme={theme} />
      </View></View>
      <Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'observedAt')}: {displayDate(locale, resources.observedAt)}</Text>
    </View>}
  </Panel></View>;
}

function Providers({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  return <Panel title={c(locale, 'providers')} theme={theme}>
    {data.providers.length === 0 ? <EmptyData text={c(locale, 'noProviders')} theme={theme} /> : <View style={{ gap: 12 }}>{data.providers.map((provider, index) => <View key={`${provider.provider}-${provider.service}-${provider.model ?? index}`} testID={`system-health-provider-${index}`} style={{ borderTopWidth: index ? 1 : 0, borderTopColor: theme.border, paddingTop: index ? 12 : 0, gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><View style={{ flexGrow: 1, minWidth: 0 }}><Text style={{ color: theme.text, fontWeight: '800' }}>{provider.provider} · {provider.service}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'model')}: {provider.model ?? '—'}</Text></View><StatusPill locale={locale} theme={theme} status={provider.status} /><DataPill locale={locale} theme={theme} status={provider.dataStatus} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Metric label={c(locale, 'attempts')} value={displayNumber(locale, provider.recentAttempts)} theme={theme} />
        <Metric label={c(locale, 'failures')} value={displayNumber(locale, provider.recentFailures)} theme={theme} />
        <Metric label={c(locale, 'retries')} value={displayNumber(locale, provider.recentRetryOperations)} theme={theme} />
        <Metric label={c(locale, 'averageLatency')} value={displayNumber(locale, provider.averageLatencyMs, 'ms')} theme={theme} />
        <Metric label={c(locale, 'inputTokens')} value={displayNumber(locale, provider.inputTokens)} theme={theme} />
        <Metric label={c(locale, 'cachedTokens')} value={displayNumber(locale, provider.cachedInputTokens)} theme={theme} />
        <Metric label={c(locale, 'outputTokens')} value={displayNumber(locale, provider.outputTokens)} theme={theme} />
      </View>
      <Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'lastObserved')}: {displayDate(locale, provider.lastObservedAt)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        <Metric label={c(locale, 'lastSuccess')} value={displayDate(locale, provider.lastSuccessAt)} theme={theme} />
        <Metric label={c(locale, 'lastError')} value={displayDate(locale, provider.lastErrorAt)} theme={theme} />
      </View>
      {provider.sampled ? <Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'sampledProviderDetail')}</Text> : null}
      {provider.dataStatus !== 'OBSERVED' ? <Text style={{ color: theme.muted, fontSize: 11 }}>{dataStatusDetail(locale, provider.dataStatus)}</Text> : null}
    </View>)}</View>}
  </Panel>;
}

function Alerts({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  return <Panel title={c(locale, 'alerts')} theme={theme}>
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 15 }}>{c(locale, 'alertSafety')}</Text>
      {data.alerts.length === 0 ? <EmptyData text={c(locale, 'noAlerts')} theme={theme} /> : data.alerts.map((alert, index) => <View key={`${alert.component}-${alert.key}-${index}`} style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 7 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: theme.text, fontWeight: '800', flexGrow: 1 }}>{componentLabel(locale, alert.component)}</Text><AlertPill locale={locale} theme={theme} state={alert.state} /></View>
        <Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'severity')}: {alert.severity ?? '—'} · {c(locale, 'observedAt')}: {displayDate(locale, alert.observedAt)}</Text>
      </View>)}
    </View>
  </Panel>;
}

function Correlations({ data, locale, theme }: { data: InfrastructureOverview; locale: Locale; theme: Theme }) {
  const router = useRouter();
  return <Panel title={c(locale, 'correlations')} theme={theme}>
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.muted, fontSize: 11, lineHeight: 15 }}>{c(locale, 'noAutomaticIncident')}</Text>
      {data.correlations.length === 0 ? <EmptyData text={c(locale, 'noCorrelations')} theme={theme} /> : data.correlations.map((correlation, index) => <View key={`${correlation.bugGroupId}-${index}`} style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 7 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: theme.text, fontWeight: '800' }}>{componentLabel(locale, correlation.component)} · {correlation.source}</Text><Text style={{ color: theme.muted, fontSize: 11 }}>{correlation.severity}</Text></View>
        <Pressable accessibilityRole="link" accessibilityLabel={`${c(locale, 'bugGroup')}: ${correlation.bugGroupId}`} onPress={() => router.push(`/bugs/${encodeURIComponent(correlation.bugGroupId)}` as never)} style={{ alignSelf: 'flex-start' }}><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>{c(locale, 'bugGroup')}: {correlation.bugGroupId}</Text></Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}><Metric label={c(locale, 'occurrences')} value={displayNumber(locale, correlation.occurrenceCount)} theme={theme} /><Metric label={c(locale, 'affectedUsers')} value={displayNumber(locale, correlation.affectedUsersCount)} theme={theme} /><Metric label={c(locale, 'lastSeen')} value={displayDate(locale, correlation.lastSeen)} theme={theme} /></View>
        {correlation.incidentId ? <Pressable accessibilityRole="link" accessibilityLabel={`${c(locale, 'incident')}: ${correlation.incidentId}`} onPress={() => router.push('/incidents' as never)} style={{ alignSelf: 'flex-start' }}><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>{c(locale, 'incident')}: {correlation.incidentId}</Text></Pressable> : <Text style={{ color: theme.muted, fontSize: 11 }}>{c(locale, 'incident')}: —</Text>}
      </View>)}
    </View>
  </Panel>;
}

/** Read-only Operations Control Center. Backend capability enforcement remains authoritative. */
export function SystemHealthCenter() {
  const { dark, locale } = useAdminUi(); const auth = useAuth(); const { width } = useWindowDimensions();
  const [range, setRange] = useState<InfrastructureRange>('now');
  const [result, setResult] = useState<InfrastructureResult>({ state: 'loading' });
  const theme = useMemo(() => themeFor(dark), [dark]);
  const canRead = auth.identity?.roles.includes('SUPER_ADMIN') === true || auth.identity?.capabilities.includes('infrastructure.read') === true;
  const compact = width < 720;

  const load = useCallback(async () => {
    if (!canRead) { setResult({ state: 'forbidden' }); return; }
    setResult({ state: 'loading' });
    setResult(await getInfrastructure(range));
  }, [canRead, range]);

  useEffect(() => { void load(); }, [load]);

  return <View style={{ gap: 18 }}>
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: compact ? 'flex-start' : 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 5 }}><Text accessibilityRole="header" style={{ color: theme.text, fontSize: 27, fontWeight: '800' }}>{c(locale, 'title')}</Text><Text style={{ color: theme.muted, maxWidth: 900, lineHeight: 19 }}>{c(locale, 'subtitle')}</Text></View>
        <View accessibilityRole="text" style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.primarySoft }}><Text style={{ color: theme.primary, fontSize: 10, fontWeight: '800', letterSpacing: .35 }}>{c(locale, 'readOnly')}</Text></View>
      </View>
      <View style={{ flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'stretch' : 'center', justifyContent: 'space-between', gap: 10 }}>
        <View accessibilityRole="radiogroup" accessibilityLabel={c(locale, 'range')} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{INFRASTRUCTURE_RANGES.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: range === item }} accessibilityLabel={c(locale, rangeLabels[item])} onPress={() => setRange(item)} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: range === item ? theme.primary : theme.border, backgroundColor: range === item ? theme.primarySoft : theme.surface }}><Text style={{ color: range === item ? theme.primary : theme.muted, fontSize: 12, fontWeight: '800' }}>{c(locale, rangeLabels[item])}</Text></Pressable>)}</View>
        <Pressable accessibilityRole="button" accessibilityLabel={result.state === 'loading' ? c(locale, 'refreshing') : c(locale, 'refresh')} accessibilityState={{ disabled: result.state === 'loading' || !canRead }} disabled={result.state === 'loading' || !canRead} onPress={() => { void load(); }} style={{ alignSelf: compact ? 'flex-start' : 'auto', opacity: result.state === 'loading' || !canRead ? .55 : 1, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 8, backgroundColor: theme.primary }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>{result.state === 'loading' ? c(locale, 'refreshing') : c(locale, 'refresh')}</Text></Pressable>
      </View>
    </View>
    {result.state === 'loading' ? <Loading locale={locale} theme={theme} /> : result.state !== 'available' || !result.data ? <Failure state={result.state} locale={locale} theme={theme} onRetry={() => { void load(); }} /> : <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Overall data={result.data} locale={locale} theme={theme} /><Components data={result.data} locale={locale} theme={theme} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Performance data={result.data} locale={locale} theme={theme} /><Resources data={result.data} locale={locale} theme={theme} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}><Providers data={result.data} locale={locale} theme={theme} /><Alerts data={result.data} locale={locale} theme={theme} /></View>
      <Correlations data={result.data} locale={locale} theme={theme} />
    </View>}
  </View>;
}
