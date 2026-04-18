import type { Checkpoint, Dependency, LaneId } from "./types";
import {
  CANVAS_PADDING,
  LANE_ORDER,
  LAYER_GAP,
  MAX_PER_COL,
  NODE_H,
  NODE_W,
  ROW_STRIDE,
  SUBCOL_STRIDE,
} from "./constants";

/**
 * DAG layered layout with dense-layer splitting.
 *
 * 1. Kahn's topological sort → nodes in layer N depend only on nodes in
 *    layers 0..N-1.
 * 2. Within each layer, nodes group by lane then sort by target_date so
 *    same-company work clusters vertically.
 * 3. Layers with > MAX_PER_COL nodes split into multiple sub-columns, so
 *    Layer 0 (which holds every root) doesn't stack 20-high.
 * 4. Layers are vertically centered to the tallest sub-column in the graph.
 *
 * Cycles (shouldn't happen, guarded anyway) drop into a final orphan layer.
 */

export interface NodePosition {
  x: number;
  y: number;
  layer: number;
}

export interface DagLayout {
  positions: Map<string, NodePosition>;
  width: number;
  height: number;
  layerCount: number;
}

export function computeDagLayout(
  checkpoints: Checkpoint[],
  dependencies: Dependency[],
): DagLayout {
  const active = checkpoints.filter((c) => c.approvalStatus !== "rejected");
  const byId = new Map(active.map((c) => [c.id, c]));
  const edges = dependencies.filter(
    (d) => byId.has(d.fromId) && byId.has(d.toId),
  );

  const outEdges = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const c of active) {
    outEdges.set(c.id, []);
    inDegree.set(c.id, 0);
  }
  for (const e of edges) {
    outEdges.get(e.fromId)!.push(e.toId);
    inDegree.set(e.toId, (inDegree.get(e.toId) ?? 0) + 1);
  }

  // Kahn's layering.
  const layers: string[][] = [];
  let frontier = active
    .map((c) => c.id)
    .filter((id) => (inDegree.get(id) ?? 0) === 0);

  const visited = new Set<string>();
  while (frontier.length > 0) {
    layers.push(frontier);
    for (const id of frontier) visited.add(id);
    const next: string[] = [];
    for (const id of frontier) {
      for (const to of outEdges.get(id) ?? []) {
        const d = (inDegree.get(to) ?? 0) - 1;
        inDegree.set(to, d);
        if (d === 0 && !visited.has(to)) next.push(to);
      }
    }
    frontier = next;
  }

  const orphans = active.filter((c) => !visited.has(c.id)).map((c) => c.id);
  if (orphans.length > 0) layers.push(orphans);

  // Sort within layers: by lane then target_date.
  const laneRank = new Map<LaneId, number>(
    LANE_ORDER.map((l, i) => [l, i]),
  );
  for (const layer of layers) {
    layer.sort((a, b) => {
      const ca = byId.get(a)!;
      const cb = byId.get(b)!;
      const la = laneRank.get(ca.laneId) ?? 99;
      const lb = laneRank.get(cb.laneId) ?? 99;
      if (la !== lb) return la - lb;
      return ca.targetDate.localeCompare(cb.targetDate);
    });
  }

  // Compute per-layer geometry: how many sub-columns + rows per sub-column.
  interface LayerGeom {
    cols: number;
    rowsPerCol: number;
    width: number;
    height: number;
  }
  const laneGeoms: LayerGeom[] = layers.map((layer) => {
    const cols = Math.max(1, Math.ceil(layer.length / MAX_PER_COL));
    const rowsPerCol = Math.ceil(layer.length / cols);
    const width =
      cols * NODE_W + (cols - 1) * (SUBCOL_STRIDE - NODE_W);
    const height =
      rowsPerCol * NODE_H + (rowsPerCol - 1) * (ROW_STRIDE - NODE_H);
    return { cols, rowsPerCol, width, height };
  });

  // Total canvas height = tallest layer + padding.
  const totalHeight =
    CANVAS_PADDING * 2 +
    laneGeoms.reduce((m, g) => Math.max(m, g.height), NODE_H);

  // Place nodes, laying them into their sub-columns column-by-column.
  const positions = new Map<string, NodePosition>();
  let cursorX = CANVAS_PADDING;

  layers.forEach((layer, layerIdx) => {
    const g = laneGeoms[layerIdx]!;
    const yStart = (totalHeight - g.height) / 2;

    // Fill column-major so "taller" sub-columns fall on the left and the
    // residue spills rightward (most natural reading order).
    layer.forEach((id, i) => {
      const col = Math.floor(i / g.rowsPerCol);
      const row = i % g.rowsPerCol;
      positions.set(id, {
        x: cursorX + col * SUBCOL_STRIDE,
        y: yStart + row * ROW_STRIDE,
        layer: layerIdx,
      });
    });

    // Advance cursor by this layer's full width + the standard layer gap.
    cursorX += g.width + LAYER_GAP;
  });

  const width = cursorX - LAYER_GAP + CANVAS_PADDING;

  return {
    positions,
    width,
    height: totalHeight,
    layerCount: layers.length,
  };
}

/** Convenience: the four anchor points of a node card. */
export function nodeAnchors(pos: NodePosition) {
  return {
    left: { x: pos.x, y: pos.y + NODE_H / 2 },
    right: { x: pos.x + NODE_W, y: pos.y + NODE_H / 2 },
    top: { x: pos.x + NODE_W / 2, y: pos.y },
    bottom: { x: pos.x + NODE_W / 2, y: pos.y + NODE_H },
  };
}

/**
 * Given a target node, compute the set of nodes that are either its
 * ancestors (can reach it) or descendants (it reaches them), plus itself.
 * Used for the focus / lineage dimming mode.
 */
export function computeLineage(
  rootId: string,
  dependencies: Dependency[],
): Set<string> {
  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const d of dependencies) {
    if (!parents.has(d.toId)) parents.set(d.toId, []);
    parents.get(d.toId)!.push(d.fromId);
    if (!children.has(d.fromId)) children.set(d.fromId, []);
    children.get(d.fromId)!.push(d.toId);
  }
  const lineage = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const p of parents.get(id) ?? []) {
      if (!lineage.has(p)) {
        lineage.add(p);
        queue.push(p);
      }
    }
  }
  queue.push(rootId);
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const c of children.get(id) ?? []) {
      if (!lineage.has(c)) {
        lineage.add(c);
        queue.push(c);
      }
    }
  }
  return lineage;
}
