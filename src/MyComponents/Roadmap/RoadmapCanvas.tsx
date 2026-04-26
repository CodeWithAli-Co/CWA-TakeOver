import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
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
 *
 * Zoom: the SVG renders at its native layout.width/height, but a
 * wrapper applies a CSS scale so the operator can fit-to-viewport
 * without horizontal scrolling. On mount we auto-fit so the entire
 * roadmap is visible at a glance; the operator can zoom in/out via
 * the bottom-right toolbar.
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
  const innerRef = useRef<HTMLDivElement>(null);
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

  // ── Zoom state ────────────────────────────────────────────────────
  // 1.0 = native scale. We auto-fit on mount + on layout changes so
  // the operator never has to scroll horizontally just to see the
  // last column on first load. Manual zoom buttons override this.
  const [scale, setScale] = useState(1);
  const [autoFitOnce, setAutoFitOnce] = useState(true);

  const fitToViewport = () => {
    const el = scrollRef.current;
    if (!el) return;
    // Leave 32px of padding on each side so nodes never kiss the rim.
    const usableW = Math.max(1, el.clientWidth - 64);
    const usableH = Math.max(1, el.clientHeight - 96);
    const scaleX = usableW / layout.width;
    const scaleY = usableH / layout.height;
    const next = Math.min(1, Math.min(scaleX, scaleY));
    // Don't let auto-fit shrink past 0.45 — past that, labels become
    // unreadable. Operator can still pinch-zoom in.
    setScale(Math.max(0.45, next));
  };

  useEffect(() => {
    if (!autoFitOnce) return;
    fitToViewport();
    setAutoFitOnce(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);

  // Re-fit when the viewport resizes — keeps the whole roadmap in
  // view as the operator drags the panel / changes monitors.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitToViewport());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);

  // Reset scroll to top-left whenever the checkpoint set changes so
  // the entire graph is visible without manual panning.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }, [layout.height, layout.width]);

  return (
    <div
      ref={scrollRef}
      className="relative h-full w-full select-none overflow-auto"
      style={{
        // Lighter, paper-like canvas — was reading too dark / HUD-y.
        // Three layers: warm top-left wash, cool bottom-right wash,
        // and a near-card base so the panel reads as a designed
        // surface, not a void. Plus a subtle 24px dot grid that
        // adds texture without noise.
        background: [
          "radial-gradient(ellipse 70% 50% at 8% 0%, color-mix(in srgb, hsl(var(--primary)) 9%, transparent), transparent 55%)",
          "radial-gradient(ellipse 55% 45% at 96% 100%, color-mix(in srgb, hsl(var(--ring)) 7%, transparent), transparent 55%)",
          "radial-gradient(circle, color-mix(in srgb, hsl(var(--foreground)) 5%, transparent) 1px, transparent 1px) 0 0/24px 24px",
          "linear-gradient(180deg, color-mix(in srgb, hsl(var(--card)) 96%, hsl(var(--foreground)) 4%) 0%, hsl(var(--card)) 100%)",
        ].join(", "),
      }}
      onClick={(e) => {
        // Only clear on bare-canvas clicks — clicks on nodes / toolbar
        // bubble up here too but we want them to win. Cheap guard:
        // ignore if the click target wasn't us.
        if (e.target === e.currentTarget || e.target === innerRef.current) {
          onSelect(null);
        }
      }}
    >
      {/* Inner scaled wrapper. Width/height stay native so scroll
          containers can size correctly when zoomed in past 1.0. */}
      <div
        ref={innerRef}
        style={{
          width: layout.width * scale,
          height: layout.height * scale,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          // We sized the wrapper to the SCALED dimensions, so the
          // inner SVG (still at native size) needs to compensate.
          // Apply scale via transform instead of letting the wrapper
          // crop — the parent already accounts for size.
        }}
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
      </div>

      <LaneLegend lanes={lanes} />

      {/* Zoom toolbar — bottom-right corner. Sticky so it follows the
          viewport even if the operator pans away. */}
      <div className="pointer-events-none sticky bottom-4 left-0 right-0 z-10 flex justify-end px-4">
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-border bg-card/85 p-1 shadow-lg backdrop-blur">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(0.3, s - 0.1)); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Zoom out"
          >
            <Minus className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); fitToViewport(); }}
            className="flex h-7 items-center gap-1 rounded-md px-2 font-mono text-[10.5px] tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Fit to viewport"
          >
            <Maximize2 className="size-3" />
            FIT
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setScale(1); }}
            className="flex h-7 items-center rounded-md px-2 font-mono text-[10.5px] tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="100% zoom"
          >
            <RefreshCw className="size-3" />
            <span className="ml-1">{Math.round(scale * 100)}%</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(2, s + 0.1)); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Zoom in"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom-left hint pill — slimmer, more discreet. */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-md border border-border/70 bg-card/70 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70 backdrop-blur md:inline-block">
        scroll · shift-wheel · space-drag
      </div>
    </div>
  );
}
