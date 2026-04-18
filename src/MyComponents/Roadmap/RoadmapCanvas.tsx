import { useEffect, useMemo, useRef } from "react";
import type {
  Checkpoint,
  Dependency,
  Lane,
  RoadmapProfile,
} from "./lib/types";
import { computeDagLayout, computeLineage } from "./lib/layout";
import { usePanZoom } from "./hooks/usePanZoom";
import { CheckpointNode } from "./CheckpointNode";
import { DependencyArrow } from "./DependencyArrow";
import { LaneLegend } from "./LaneLegend";

interface Props {
  lanes: Lane[];
  checkpoints: Checkpoint[];
  dependencies: Dependency[];
  profiles: RoadmapProfile[];
  selectedId: string | null;
  onSelect: (cp: Checkpoint | null) => void;
}

/**
 * Pure DAG renderer.
 *
 * Layout + lineage computation are pure functions of (checkpoints,
 * dependencies, selectedId). RoadmapPage owns all state above this line.
 *
 * Click on the canvas background (not on a node) clears the selection.
 */
export function RoadmapCanvas({
  lanes,
  checkpoints,
  dependencies,
  profiles,
  selectedId,
  onSelect,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  usePanZoom(scrollRef);

  const layout = useMemo(
    () => computeDagLayout(checkpoints, dependencies),
    [checkpoints, dependencies],
  );

  const cpById = useMemo(
    () => new Map(checkpoints.map((c) => [c.id, c])),
    [checkpoints],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  // Lineage: nodes in the selected node's upstream/downstream chain.
  const lineage = useMemo(
    () => (selectedId ? computeLineage(selectedId, dependencies) : null),
    [selectedId, dependencies],
  );

  // Reset scroll to the top-left when the checkpoint set changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    el.scrollTop = Math.max(0, (layout.height - el.clientHeight) / 2);
  }, [layout.height, layout.width]);

  return (
    <div
      ref={scrollRef}
      className="relative h-full w-full select-none overflow-auto"
      style={{
        background: [
          // Subtle warm top-left glow
          "radial-gradient(ellipse 60% 40% at 10% 0%, color-mix(in srgb, hsl(var(--primary)) 6%, transparent), transparent 60%)",
          // Cool bottom-right glow
          "radial-gradient(ellipse 50% 40% at 95% 100%, color-mix(in srgb, hsl(var(--ring)) 5%, transparent), transparent 60%)",
          // Base
          "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
        ].join(", "),
      }}
      onClick={() => onSelect(null)}
    >
      <svg
        width={layout.width}
        height={layout.height}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{ display: "block", shapeRendering: "geometricPrecision" }}
      >
        {/* Edges */}
        <g>
          {dependencies.map((d) => {
            const from = cpById.get(d.fromId);
            const fromPos = layout.positions.get(d.fromId);
            const toPos = layout.positions.get(d.toId);
            if (!from || !fromPos || !toPos) return null;
            const highlighted =
              !!lineage && lineage.has(d.fromId) && lineage.has(d.toId);
            const dimmed = !!lineage && !highlighted;
            return (
              <DependencyArrow
                key={d.id}
                from={from}
                fromPos={fromPos}
                toPos={toPos}
                dimmed={dimmed}
                highlighted={highlighted}
              />
            );
          })}
        </g>

        {/* Nodes */}
        <g>
          {checkpoints.map((cp) => {
            const pos = layout.positions.get(cp.id);
            const author = profileById.get(cp.authorId);
            if (!pos || !author) return null;
            const owner = cp.ownerId ? profileById.get(cp.ownerId) : undefined;
            const selected = selectedId === cp.id;
            const dimmed = !!lineage && !lineage.has(cp.id);
            return (
              <CheckpointNode
                key={cp.id}
                cp={cp}
                pos={pos}
                author={author}
                owner={owner}
                selected={selected}
                dimmed={dimmed}
                onSelect={(picked) => onSelect(picked)}
              />
            );
          })}
        </g>
      </svg>

      <LaneLegend lanes={lanes} />

      <div className="pointer-events-none sticky bottom-2 left-0 ml-2 inline-block rounded-md border border-border bg-card/80 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur">
        scroll · shift-wheel horizontal · space-drag · click a node for details
      </div>
    </div>
  );
}
