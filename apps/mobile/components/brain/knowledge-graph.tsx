import { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import type { TwinGraph, TwinGraphNode } from '@second-brain/shared';
import { useTokens } from '../../lib/design/theme';
import {
  LEGEND,
  NODE,
  STATUS_VISUAL,
  layoutGraph,
  type PlacedNode,
  type Segment,
} from '../../lib/brain/graph';

/**
 * The Knowledge Graph (UI/UX Sprint 5, tasks 3-4) — the centrepiece of Mon
 * Cerveau. Concepts are nodes coloured by mastery state (never colour alone: an
 * icon + the detail panel carry the state too), prerequisite relations are the
 * edges. Living but not gadgety: it can be panned (drag) and zoomed (buttons),
 * and selecting a node opens its detail. No graph library — pure layout + Views.
 */

function toneColor(c: ReturnType<typeof useTokens>['colors'], tone: string): string {
  switch (tone) {
    case 'success': return c.success;
    case 'primary': return c.primary;
    case 'warning': return c.warning;
    case 'error': return c.error;
    default: return c.textMuted;
  }
}

function Edge({ seg, color, weakColor }: { seg: Segment; color: string; weakColor: string }) {
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (seg.x1 + seg.x2) / 2;
  const midY = (seg.y1 + seg.y2) / 2;
  const thickness = seg.weak ? 2.5 : 1.5;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: midX - len / 2,
        top: midY - thickness / 2,
        width: len,
        height: thickness,
        backgroundColor: seg.weak ? weakColor : color,
        opacity: seg.weak ? 0.9 : 0.5,
        borderRadius: thickness,
        transform: [{ rotateZ: `${angle}deg` }],
      }}
    />
  );
}

function GraphNode({ p, selected, onPress }: { p: PlacedNode; selected: boolean; onPress: () => void }) {
  const { colors: c, radius } = useTokens();
  const v = STATUS_VISUAL[p.node.status];
  const col = toneColor(c, v.tone);
  return (
    <View style={{ position: 'absolute', left: p.x - COLW / 2, top: p.y - NODE / 2, width: COLW, alignItems: 'center' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${p.node.name} — ${v.label}`}
        style={{
          width: NODE,
          height: NODE,
          borderRadius: radius.full,
          backgroundColor: c.surfaceElevated,
          borderWidth: selected ? 3 : 2,
          borderColor: col,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }}>{v.icon}</Text>
      </Pressable>
      <Text numberOfLines={2} style={{ color: selected ? c.textPrimary : c.textSecondary, fontSize: 11, fontWeight: selected ? '700' : '500', textAlign: 'center', marginTop: 4, maxWidth: COLW }}>
        {p.node.name}
      </Text>
    </View>
  );
}
const COLW = 104;

export function KnowledgeGraph({
  graph,
  selectedId,
  onSelect,
  height = 360,
}: {
  graph: TwinGraph;
  selectedId: string | null;
  onSelect: (node: TwinGraphNode) => void;
  height?: number;
}) {
  const { colors: c, radius } = useTokens();
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const [zoom, setZoom] = useState(1);
  const pan = useRef({ x: 20, y: 10 });
  const [, force] = useState(0);

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        pan.current = { x: pan.current.x + g.dx, y: pan.current.y + g.dy };
        force((n) => n + 1);
      },
      onPanResponderGrant: () => undefined,
    }),
  ).current;

  const reset = () => { pan.current = { x: 20, y: 10 }; setZoom(1); force((n) => n + 1); };

  return (
    <View style={{ borderWidth: 1, borderColor: c.borderSubtle, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surfaceSunken, height }}>
      <View style={{ flex: 1 }} {...responder.panHandlers}>
        <View
          style={{
            position: 'absolute',
            width: layout.width || 100,
            height: layout.height || 100,
            transform: [{ translateX: pan.current.x }, { translateY: pan.current.y }, { scale: zoom }],
          }}
        >
          {layout.segments.map((seg, i) => (
            <Edge key={i} seg={seg} color={c.border} weakColor={c.warning} />
          ))}
          {layout.placed.map((p) => (
            <GraphNode key={p.node.id} p={p} selected={p.node.id === selectedId} onPress={() => onSelect(p.node)} />
          ))}
        </View>
      </View>

      {/* Zoom / recenter controls */}
      <View style={{ position: 'absolute', right: 10, bottom: 10, gap: 6 }}>
        <ZoomBtn label="＋" onPress={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))} />
        <ZoomBtn label="－" onPress={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))} />
        <ZoomBtn label="⟳" onPress={reset} />
      </View>
    </View>
  );
}

function ZoomBtn({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c, radius } = useTokens();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

/** Accessible legend — colour is never the only signal (task 3). */
export function MasteryLegend() {
  const { colors: c } = useTokens();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {LEGEND.map((s) => {
        const v = STATUS_VISUAL[s];
        return (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 12 }}>{v.icon}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>{v.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
