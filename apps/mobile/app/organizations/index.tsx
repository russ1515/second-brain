import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ORGANIZATION_TYPES,
  type OrganizationSummary,
  type OrganizationType,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, Empty, ErrorBanner, Loading } from '../../components/ui';

export default function OrganizationsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrganizationSummary[] | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('school');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrgs(await api<OrganizationSummary[]>('/organizations'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const org = await api<OrganizationSummary>('/organizations', {
        method: 'POST',
        body: { name: name.trim(), type },
      });
      setName('');
      router.push(`/organizations/${org.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('org.title')}</Text>
      <Text style={styles.intro}>{t('org.intro')}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <Text style={styles.label}>{t('org.create')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('org.namePlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={name}
          onChangeText={setName}
          testID="org-name"
        />
        <View style={styles.chips}>
          {ORGANIZATION_TYPES.map((ty) => (
            <Text
              key={ty}
              onPress={() => setType(ty)}
              style={[styles.chip, ty === type && styles.chipOn]}
            >
              {t(`org.type.${ty}` as TranslationKey)}
            </Text>
          ))}
        </View>
        <Button label={t('org.createBtn')} onPress={create} busy={busy} disabled={!name.trim()} />
      </Card>

      {orgs === null ? (
        <Loading />
      ) : orgs.length === 0 ? (
        <Empty title={t('org.emptyTitle')} detail={t('org.emptyDetail')} />
      ) : (
        orgs.map((o) => (
          <Card key={o.id}>
            <Text style={styles.name} onPress={() => router.push(`/organizations/${o.id}`)}>
              {o.name}
            </Text>
            <Text style={styles.meta}>
              {t(`org.type.${o.type}` as TranslationKey)} · {t(`org.role.${o.role}` as TranslationKey)} ·{' '}
              {t('org.memberCount').replace('{n}', String(o.memberCount))}
            </Text>
            <Button variant="ghost" label={t('org.open')} onPress={() => router.push(`/organizations/${o.id}`)} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: theme.text },
  intro: { fontSize: 14, color: theme.textMuted, lineHeight: 20, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
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
  name: { fontSize: 17, fontWeight: '700', color: theme.text },
  meta: { fontSize: 13, color: theme.textMuted, marginTop: 4, marginBottom: 8 },
});
