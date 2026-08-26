import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LearningStatus, TwinGraph, TwinGraphNode } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const statusColor = (c: ColorScale): Record<LearningStatus, string> => ({
  mastered: c.success,
  in_progress: c.primary,
  ready: c.textSecondary,
  at_risk: c.warning,
  blocked: c.error,
});
const STATUS_KEY: Record<LearningStatus, TranslationKey> = {
  mastered: 'graph.s.mastered',
  in_progress: 'graph.s.in_progress',
  ready: 'graph.s.ready',
  at_risk: 'graph.s.at_risk',
  blocked: 'graph.s.blocked',
};

interface FlatNode {
  node: TwinGraphNode;
  depth: number;
  related: string[];
}

/**
 * Knowledge Graph (task 4.4). Concepts and their prerequisite dependencies as
 * an indented tree — foundations at the top, what builds on them nested beneath.
 * The same graph the AI teacher already reads to sequence what to study.
 */
export default function GraphScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [graph, setGraph] = useState<TwinGraph | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setGraph(await api<TwinGraph>('/twin/graph'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flat = useMemo(() => (graph ? flatten(graph) : []), [graph]);

  if (error && !graph) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!graph) return <Loading label={t('graph.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🕸️ {t('graph.title')}</Text>
        <Text style={styles.intro}>{t('graph.intro')}</Text>
      </View>

      {graph.nodes.length === 0 ? (
        <Text style={styles.empty}>{t('graph.empty')}</Text>
      ) : (
        <View style={styles.tree}>
          {flat.map(({ node, depth, related }) => (
            <View key={node.id} style={[styles.row, { paddingLeft: depth * 20 }]}>
              {depth > 0 ? <Text style={styles.branch}>└─</Text> : null}
              <View style={[styles.dot, { backgroundColor: statusColor(c)[node.status] }]} />
              <View style={styles.rowBody}>
                <Text style={styles.name}>{node.name}</Text>
                <Text style={styles.meta}>
                  {t(STATUS_KEY[node.status])}
                  {node.mastery !== null ? ` · ${Math.round(node.mastery * 100)}%` : ''}
                  {related.length ? ` · ↔ ${related.join(', ')}` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Legend. */}
      <View style={styles.legend}>
        {(Object.keys(statusColor(c)) as LearningStatus[]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: statusColor(c)[s] }]} />
            <Text style={styles.legendText}>{t(STATUS_KEY[s])}</Text>
          </View>
        ))}
      </View>

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

/**
 * Depth-first flatten of the prerequisite forest. An edge (source→target) means
 * source is a prerequisite of target, so prerequisites are parents and what
 * depends on them are children. Roots are concepts with no prerequisites; a
 * visited set renders each node once and breaks any cycle.
 */
function flatten(graph: TwinGraph): FlatNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const hasPrereq = new Set<string>();
  const related = new Map<string, string[]>();

  const push = (map: Map<string, string[]>, key: string, value: string) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };

  for (const e of graph.edges) {
    if (e.relation === 'prerequisite') {
      push(children, e.sourceId, e.targetId);
      hasPrereq.add(e.targetId);
    } else {
      // Related (non-hierarchical): note it on both ends.
      const targetName = byId.get(e.targetId)?.name;
      const sourceName = byId.get(e.sourceId)?.name;
      if (targetName) push(related, e.sourceId, targetName);
      if (sourceName) push(related, e.targetId, sourceName);
    }
  }

  const roots = graph.nodes
    .filter((n) => !hasPrereq.has(n.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const out: FlatNode[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (!node) return;
    out.push({ node, depth, related: related.get(id) ?? [] });
    for (const child of (children.get(id) ?? []).sort((a, b) =>
      (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? ''),
    )) {
      walk(child, depth + 1);
    }
  };
  roots.forEach((r) => walk(r.id, 0));
  // Any node left unvisited (part of a cycle with no clear root) — surface it.
  graph.nodes.forEach((n) => walk(n.id, 0));
  return out;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  empty: { fontSize: 14, color: c.textSecondary },
  tree: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingRight: 12,
    marginBottom: 6,
  },
  branch: { color: c.textMuted, fontSize: 14, marginLeft: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowBody: { flex: 1, gap: 1 },
  name: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 12, color: c.textSecondary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontSize: 12, color: c.textSecondary },
});
