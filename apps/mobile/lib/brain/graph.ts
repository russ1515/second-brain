import type { LearningCategory, LearningStatus, TwinGraph, TwinGraphNode } from '@second-brain/shared';

/**
 * Knowledge-graph layout + visual mapping (UI/UX Sprint 5, Mon Cerveau).
 *
 * No SVG/graph library is available, so the graph is laid out deterministically
 * (layered by prerequisite depth — foundations on top, what builds on them
 * below) and drawn with plain Views: nodes as circles, edges as thin rotated
 * line Views. Pure functions here; the component only renders the result.
 */

export const NODE = 64;
export const LEVEL_H = 132;
export const COL_W = 116;
export const PAD = 40;

export interface PlacedNode {
  node: TwinGraphNode;
  x: number; // centre x
  y: number; // centre y
}
export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** True when it links to/from a fragile concept — drawn with emphasis. */
  weak: boolean;
}
export interface GraphLayout {
  placed: PlacedNode[];
  segments: Segment[];
  width: number;
  height: number;
}

/** Longest prerequisite chain to each node = its depth (0 = a foundation). */
function computeDepths(graph: TwinGraph): Map<string, number> {
  const prereqs = new Map<string, string[]>(); // node -> its prerequisite ids
  for (const n of graph.nodes) prereqs.set(n.id, []);
  for (const e of graph.edges) {
    if (e.relation === 'prerequisite') {
      // source is a prerequisite OF target → target depends on source.
      prereqs.get(e.targetId)?.push(e.sourceId);
    }
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const ps = prereqs.get(id) ?? [];
    const d = ps.length === 0 ? 0 : 1 + Math.max(...ps.map(resolve));
    visiting.delete(id);
    depth.set(id, d);
    return d;
  };
  for (const n of graph.nodes) resolve(n.id);
  return depth;
}

export function layoutGraph(graph: TwinGraph): GraphLayout {
  if (graph.nodes.length === 0) {
    return { placed: [], segments: [], width: 0, height: 0 };
  }
  const depth = computeDepths(graph);
  // Bucket nodes per depth, stable order for a deterministic layout.
  const levels = new Map<number, TwinGraphNode[]>();
  for (const n of graph.nodes) {
    const d = depth.get(n.id) ?? 0;
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d)!.push(n);
  }
  const maxCols = Math.max(...[...levels.values()].map((l) => l.length));
  const width = Math.max(maxCols, 1) * COL_W + PAD * 2;
  const maxDepth = Math.max(...levels.keys());
  const height = (maxDepth + 1) * LEVEL_H + PAD * 2;

  const pos = new Map<string, PlacedNode>();
  const placed: PlacedNode[] = [];
  for (const [d, nodes] of [...levels.entries()].sort((a, b) => a[0] - b[0])) {
    const rowW = nodes.length * COL_W;
    const startX = (width - rowW) / 2 + COL_W / 2;
    nodes.forEach((node, i) => {
      const p: PlacedNode = { node, x: startX + i * COL_W, y: PAD + d * LEVEL_H + NODE / 2 };
      pos.set(node.id, p);
      placed.push(p);
    });
  }

  const segments: Segment[] = [];
  for (const e of graph.edges) {
    const a = pos.get(e.sourceId);
    const b = pos.get(e.targetId);
    if (!a || !b) continue;
    const weak = isWeak(a.node.status) || isWeak(b.node.status);
    segments.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, weak });
  }
  return { placed, segments, width, height };
}

function isWeak(s: LearningStatus): boolean {
  return s === 'at_risk' || s === 'blocked';
}

// ── Status → visual (colour + icon + accessible French label, task 3) ────────
export interface StatusVisual {
  key: LearningStatus;
  icon: string;
  label: string;
  /** Token role name resolved by the component against the live theme. */
  tone: 'success' | 'primary' | 'warning' | 'error' | 'muted';
}

export const STATUS_VISUAL: Record<LearningStatus, StatusVisual> = {
  mastered: { key: 'mastered', icon: '🟢', label: 'Maîtrisé', tone: 'success' },
  in_progress: { key: 'in_progress', icon: '🟡', label: 'En cours', tone: 'primary' },
  at_risk: { key: 'at_risk', icon: '🟠', label: 'Fragile', tone: 'warning' },
  blocked: { key: 'blocked', icon: '🔴', label: 'À consolider', tone: 'error' },
  ready: { key: 'ready', icon: '⚪', label: 'Non étudié', tone: 'muted' },
};

/** The legend order shown under the graph. */
export const LEGEND: LearningStatus[] = ['mastered', 'in_progress', 'at_risk', 'blocked', 'ready'];

// ── KYC personalisation of the cognitive view (task 11) ──────────────────────
export interface BrainPersona {
  /** How much depth to expose. */
  depth: 'simple' | 'structured' | 'detailed';
  /** Child-friendly status wording. */
  childLabels: boolean;
  intro: string;
}

export function brainPersona(category?: LearningCategory | null): BrainPersona {
  switch (category) {
    case 'kindergarten':
    case 'primary':
      return { depth: 'simple', childLabels: true, intro: 'Voici tout ce que tu as déjà appris !' };
    case 'secondary':
    case 'highschool':
      return { depth: 'structured', childLabels: false, intro: 'Ce que tu maîtrises, ce qui reste à renforcer, et comment tout est lié.' };
    case 'research':
      return { depth: 'detailed', childLabels: false, intro: 'Ta carte de connaissances : concepts, prérequis, relations et niveaux de maîtrise.' };
    case 'university':
      return { depth: 'detailed', childLabels: false, intro: 'Voilà ce que Second Brain sait de ton apprentissage.' };
    default:
      return { depth: 'structured', childLabels: false, intro: 'Voilà ce que Second Brain sait de ton apprentissage.' };
  }
}

/** Child-friendly relabelling of a status (task 11, Maternelle/Primaire). */
export function childLabel(status: LearningStatus): string {
  switch (status) {
    case 'mastered': return '🔥 Je maîtrise';
    case 'in_progress': return '⭐ Je connais';
    case 'at_risk':
    case 'blocked': return '🌱 Je découvre';
    default: return '🌱 À découvrir';
  }
}
