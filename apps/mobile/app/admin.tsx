import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type {
  AdminStats,
  AdminUsersResponse,
  AiUsageView,
  AuditLogView,
  IncidentView,
  ReportView,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

export default function AdminScreen() {
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUsersResponse | null>(null);
  const [ai, setAi] = useState<AiUsageView | null>(null);
  const [incidents, setIncidents] = useState<IncidentView[]>([]);
  const [reports, setReports] = useState<ReportView[]>([]);
  const [logs, setLogs] = useState<AuditLogView[]>([]);
  const [incTitle, setIncTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, u, a, inc, rep, lg] = await Promise.all([
        api<AdminStats>('/admin/stats'),
        api<AdminUsersResponse>('/admin/users'),
        api<AiUsageView>('/admin/ai-usage'),
        api<IncidentView[]>('/admin/incidents'),
        api<ReportView[]>('/admin/reports'),
        api<AuditLogView[]>('/admin/audit-logs'),
      ]);
      setStats(s); setUsers(u); setAi(a); setIncidents(inc); setReports(rep); setLogs(lg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (!loaded && !error) return <Loading />;

  const money = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('admin.title')}</Text>
      <Text style={styles.intro}>{t('admin.intro')}</Text>
      {error ? <ErrorBanner message={error} /> : null}

      {/* Stat tiles */}
      {stats ? (
        <View style={styles.grid}>
          <Stat label={t('admin.stat.users')} value={String(stats.totalUsers)} />
          <Stat label={t('admin.stat.orgs')} value={String(stats.totalOrganizations)} />
          <Stat label={t('admin.stat.docs')} value={String(stats.totalDocuments)} />
          <Stat label={t('admin.stat.revenue')} value={money(stats.invoicesTotal)} />
          <Stat label={t('admin.stat.incidents')} value={String(stats.openIncidents)} />
          <Stat label={t('admin.stat.reports')} value={String(stats.openReports)} />
        </View>
      ) : null}

      {/* AI usage */}
      {ai ? (
        <>
          <Text style={styles.section}>{t('admin.aiUsage')} · {ai.period}</Text>
          <Card>
            <Text style={styles.line}>{t('admin.aiQuestions')}: <Text style={styles.strong}>{ai.totals.aiQuestions}</Text></Text>
            <Text style={styles.line}>{t('admin.voiceMinutes')}: <Text style={styles.strong}>{ai.totals.voiceMinutes}</Text></Text>
            {ai.top.slice(0, 5).map((r) => (
              <Text key={r.userId} style={styles.sub}>{r.email} — {r.aiQuestions} Q · {r.voiceMinutes} min</Text>
            ))}
          </Card>
        </>
      ) : null}

      {/* Users */}
      <Text style={styles.section}>{t('admin.users')} ({users?.total ?? 0})</Text>
      {users?.items.slice(0, 20).map((u) => (
        <Card key={u.id} style={styles.rowCard}>
          <View style={styles.flex}>
            <Text style={styles.rowName}>{u.email}{u.isAdmin ? ' ★' : ''}</Text>
            <Text style={styles.sub}>{u.planSlug ?? 'free'}{u.suspended ? ` · ${t('admin.suspended')}` : ''}</Text>
          </View>
          <Button
            variant="ghost"
            label={u.suspended ? t('admin.reactivate') : t('admin.suspend')}
            disabled={busy}
            onPress={() => act(() => api(`/admin/users/${u.id}/${u.suspended ? 'reactivate' : 'suspend'}`, { method: 'POST' }))}
          />
        </Card>
      ))}

      {/* Incidents */}
      <Text style={styles.section}>{t('admin.incidents')}</Text>
      <Card>
        <TextInput
          style={styles.input}
          placeholder={t('admin.incidentPlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={incTitle}
          onChangeText={setIncTitle}
        />
        <Button
          label={t('admin.createIncident')}
          disabled={busy || !incTitle.trim()}
          onPress={() => act(async () => {
            await api('/admin/incidents', { method: 'POST', body: { title: incTitle.trim(), severity: 'medium' } });
            setIncTitle('');
          })}
        />
      </Card>
      {incidents.slice(0, 10).map((i) => (
        <Card key={i.id} style={styles.rowCard}>
          <View style={styles.flex}>
            <Text style={styles.rowName}>{i.title}</Text>
            <Text style={styles.sub}>{t(`admin.sev.${i.severity}` as TranslationKey)} · {t(`admin.istatus.${i.status}` as TranslationKey)}</Text>
          </View>
          {i.status !== 'resolved' ? (
            <Button variant="ghost" label={t('admin.resolve')} disabled={busy}
              onPress={() => act(() => api(`/admin/incidents/${i.id}/status`, { method: 'PUT', body: { status: 'resolved' } }))} />
          ) : null}
        </Card>
      ))}

      {/* Reports */}
      <Text style={styles.section}>{t('admin.reports')}</Text>
      {reports.length === 0 ? <Text style={styles.sub}>{t('admin.noReports')}</Text> : null}
      {reports.slice(0, 10).map((r) => (
        <Card key={r.id} style={styles.rowCard}>
          <View style={styles.flex}>
            <Text style={styles.rowName}>{r.category} · {t(`admin.rstatus.${r.status}` as TranslationKey)}</Text>
            <Text style={styles.sub}>{r.message}</Text>
          </View>
          {r.status === 'open' ? (
            <Button variant="ghost" label={t('admin.review')} disabled={busy}
              onPress={() => act(() => api(`/admin/reports/${r.id}/resolve`, { method: 'PUT', body: { status: 'reviewed' } }))} />
          ) : null}
        </Card>
      ))}

      {/* Audit log */}
      <Text style={styles.section}>{t('admin.logs')}</Text>
      {logs.slice(0, 12).map((l) => (
        <Text key={l.id} style={styles.log}>
          {new Date(l.createdAt).toLocaleString()} · {l.action}{l.detail ? ` — ${l.detail}` : ''}
        </Text>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10, maxWidth: 820, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: theme.text },
  intro: { fontSize: 14, color: theme.textMuted, lineHeight: 20, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '30%', minWidth: 96, alignItems: 'center', paddingVertical: 16 },
  statValue: { fontSize: 26, fontWeight: '800', color: theme.accent, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 12, color: theme.textMuted, marginTop: 4, textAlign: 'center' },
  section: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: 14 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  rowName: { fontSize: 14, fontWeight: '600', color: theme.text },
  sub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  line: { fontSize: 14, color: theme.text, marginBottom: 2 },
  strong: { fontWeight: '700', color: theme.text },
  input: {
    backgroundColor: theme.surfaceAlt, borderWidth: 1, borderColor: theme.border,
    borderRadius: 10, padding: 12, fontSize: 15, color: theme.text, marginBottom: 10,
  },
  log: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },
});
