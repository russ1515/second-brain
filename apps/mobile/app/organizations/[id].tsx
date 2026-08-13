import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ORG_ROLES,
  type OrgInsights,
  type OrgRole,
  type OrganizationDetail,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

export default function OrganizationDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [insights, setInsights] = useState<OrgInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<OrgRole>('student');
  const [groupName, setGroupName] = useState('');

  const load = useCallback(async () => {
    try {
      const o = await api<OrganizationDetail>(`/organizations/${id}`);
      setOrg(o);
      // Tenant Intelligence — admin/teacher only (students get 403 → skip).
      if (o.role === 'admin' || o.role === 'teacher') {
        setInsights(await api<OrgInsights>(`/organizations/${id}/insights`).catch(() => null));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addMember = () =>
    run(async () => {
      await api(`/organizations/${id}/members`, {
        method: 'POST',
        body: { email: memberEmail.trim(), role: memberRole },
      });
      setMemberEmail('');
    });

  const createGroup = () =>
    run(async () => {
      await api(`/organizations/${id}/groups`, {
        method: 'POST',
        body: { name: groupName.trim(), kind: 'class' },
      });
      setGroupName('');
    });

  if (!org && !error) return <Loading />;

  const isAdmin = org?.role === 'admin';
  const canManageGroups = org?.role === 'admin' || org?.role === 'teacher';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.title}>{org?.name}</Text>
      {org ? (
        <Text style={styles.meta}>
          {t(`org.type.${org.type}` as TranslationKey)} · {t(`org.role.${org.role}` as TranslationKey)}
        </Text>
      ) : null}

      {/* Tenant Intelligence (8.7 ⭐) — aggregated, anonymised */}
      {insights ? (
        <Card style={styles.insightsCard}>
          <Text style={styles.insightsTitle}>{t('org.insights')}</Text>
          <Text style={styles.sub}>
            {t('org.insightsMembers')
              .replace('{s}', String(insights.members.students))
              .replace('{t}', String(insights.members.teachers))}
            {' · '}
            {t('org.insightsActive').replace('{n}', String(insights.activeStudents7d))}
          </Text>
          {insights.difficultSubjects.length > 0 ? (
            <>
              <Text style={styles.insightsLabel}>{t('org.difficultSubjects')}</Text>
              {insights.difficultSubjects.map((s) => (
                <Text key={s.subject} style={styles.insightLine}>
                  • {s.subject} — {Math.round(s.avgMastery * 100)}%
                </Text>
              ))}
            </>
          ) : null}
          <Text style={styles.insightsLabel}>{t('org.recommendations')}</Text>
          {insights.recommendations.map((r, i) => (
            <Text key={i} style={styles.insightLine}>→ {r}</Text>
          ))}
        </Card>
      ) : null}

      {/* Members */}
      <Text style={styles.section}>{t('org.members')}</Text>
      {org?.members.map((m) => (
        <Card key={m.userId} style={styles.rowCard}>
          <View style={styles.flex}>
            <Text style={styles.memberName}>{m.displayName || m.email}</Text>
            <Text style={styles.memberEmail}>{m.email}</Text>
          </View>
          <Text style={[styles.roleBadge, roleStyle(m.role)]}>
            {t(`org.role.${m.role}` as TranslationKey)}
          </Text>
        </Card>
      ))}

      {isAdmin ? (
        <Card>
          <Text style={styles.label}>{t('org.addMember')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('org.emailPlaceholder')}
            placeholderTextColor={theme.textFaint}
            value={memberEmail}
            onChangeText={setMemberEmail}
            autoCapitalize="none"
            testID="member-email"
          />
          <View style={styles.chips}>
            {ORG_ROLES.map((r) => (
              <Text
                key={r}
                onPress={() => setMemberRole(r)}
                style={[styles.chip, r === memberRole && styles.chipOn]}
              >
                {t(`org.role.${r}` as TranslationKey)}
              </Text>
            ))}
          </View>
          <Button label={t('org.addMemberBtn')} onPress={addMember} busy={busy} disabled={!memberEmail.trim()} />
        </Card>
      ) : null}

      {/* Groups & classes */}
      <Text style={styles.section}>{t('org.groups')}</Text>
      {org && org.groups.length === 0 ? (
        <Text style={styles.note}>{t('org.noGroups')}</Text>
      ) : (
        org?.groups.map((g) => (
          <Card key={g.id} style={styles.rowCard}>
            <View style={styles.flex}>
              <Text style={styles.memberName}>{g.name}</Text>
              <Text style={styles.memberEmail}>{t(`org.kind.${g.kind}` as TranslationKey)}</Text>
            </View>
            <Text style={styles.memberEmail}>
              {t('org.memberCount').replace('{n}', String(g.memberCount))}
            </Text>
          </Card>
        ))
      )}

      {canManageGroups ? (
        <Card>
          <Text style={styles.label}>{t('org.createGroup')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('org.groupNamePlaceholder')}
            placeholderTextColor={theme.textFaint}
            value={groupName}
            onChangeText={setGroupName}
            testID="group-name"
          />
          <Button label={t('org.createGroupBtn')} onPress={createGroup} busy={busy} disabled={!groupName.trim()} />
        </Card>
      ) : null}

      <Button variant="ghost" label={t('org.back')} onPress={() => router.replace('/organizations')} />
    </ScrollView>
  );
}

function roleStyle(role: OrgRole) {
  return role === 'admin'
    ? { backgroundColor: theme.accent, color: theme.text }
    : role === 'teacher'
      ? { backgroundColor: '#78350F', color: theme.warn }
      : { backgroundColor: theme.surfaceAlt, color: theme.textMuted };
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: theme.text },
  meta: { fontSize: 13, color: theme.textMuted, textTransform: 'capitalize' },
  section: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10 },
  label: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: theme.text },
  memberEmail: { fontSize: 12, color: theme.textMuted, marginTop: 2, textTransform: 'capitalize' },
  roleBadge: { fontSize: 11, fontWeight: '700', paddingVertical: 3, paddingHorizontal: 9, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' },
  input: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.text,
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    color: theme.textMuted,
    fontSize: 13,
  },
  chipOn: { borderColor: theme.accent, color: theme.text, backgroundColor: theme.accent },
  note: { fontSize: 13, color: theme.textFaint, fontStyle: 'italic' },
  sub: { fontSize: 12, color: theme.textMuted, marginTop: 2 },
  insightsCard: { borderColor: theme.accent, gap: 4 },
  insightsTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  insightsLabel: { fontSize: 11, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  insightLine: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
});
