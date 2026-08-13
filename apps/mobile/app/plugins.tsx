import type { PluginKind, PluginManifest, PluginStatus, PluginCatalog } from '@second-brain/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiQuery } from '../lib/query';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<PluginKind, string> = {
  space: '🧠',
  connector: '🔌',
  'ai-engine': '🤖',
};

const STATUS_KEY: Record<PluginStatus, TranslationKey> = {
  active: 'plg.active',
  available: 'plg.available',
  planned: 'plg.planned',
};

const STATUS_COLOR: Record<PluginStatus, string> = {
  active: theme.ok,
  available: theme.accent,
  planned: theme.textFaint,
};

const ORDER: PluginStatus[] = ['active', 'available', 'planned'];

/**
 * 🧩 Extensions (Sprint 10 ⭐ — Plugin Engine). Everything Second Brain can grow
 * into: spaces ("Brains"), connectors and AI engines — each a plugin that
 * registers without touching the core. Shows what's active today and the roadmap.
 */
export default function PluginsScreen() {
  const { t } = useI18n();
  const { data, error, refetch } = useApiQuery<PluginCatalog>(['plugins'], '/plugins');

  if (error && !data) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={(error as Error).message} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void refetch()} />
      </ScrollView>
    );
  }
  if (!data) return <Loading label={t('plg.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧩 {t('plg.title')}</Text>
        <Text style={styles.intro}>{t('plg.intro')}</Text>
      </View>

      {ORDER.map((status) => {
        const group = data.plugins.filter((p) => p.status === status);
        if (group.length === 0) return null;
        return (
          <View key={status} style={styles.group}>
            <Text style={[styles.groupLabel, { color: STATUS_COLOR[status] }]}>
              {t(STATUS_KEY[status])} · {group.length}
            </Text>
            {group.map((p) => (
              <PluginCard key={p.id} p={p} t={t} />
            ))}
          </View>
        );
      })}

      <Text style={styles.note}>{t('plg.note')}</Text>
    </ScrollView>
  );
}

function PluginCard({ p, t }: { p: PluginManifest; t: (k: TranslationKey) => string }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.icon}>{KIND_ICON[p.kind]}</Text>
        <Text style={styles.name}>{p.name}</Text>
        <View style={[styles.dot, { backgroundColor: STATUS_COLOR[p.status] }]} />
      </View>
      <Text style={styles.desc}>{p.description}</Text>
      {p.requires ? <Text style={styles.requires}>{t('plg.requires')}: {p.requires}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: { fontSize: 13, fontWeight: '700', color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2 },
  intro: { fontSize: 15, color: theme.textMuted, lineHeight: 21 },
  group: { gap: 8 },
  groupLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
  card: { gap: 5 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { fontSize: 20 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: theme.text },
  dot: { width: 10, height: 10, borderRadius: 5 },
  desc: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  requires: { fontSize: 12, color: theme.textFaint, fontStyle: 'italic' },
  note: { fontSize: 12, color: theme.textFaint, lineHeight: 17, marginTop: 6 },
});
