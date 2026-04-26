import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import type {
  Checkpoint,
  Dependency,
  Lane,
  RoadmapProfile,
} from "./lib/types";
import { computeLineage } from "./lib/layout";
import { computeRadialLayout } from "./lib/radialLayout";
import { RadialNode } from "./RadialNode";

interface Props {
  lanes: Lane[];
  checkpoints: Checkpoint[];
  dependencies: Dependency[];
  profiles: RoadmapProfile[];
  selectedId: string | null;
  onSelect: (cp: Checkpoint | null) => void;
}

/**
 * Radial / orbit roadmap renderer.
 *
 *   • Center  — TODAY disc with a soft pulse
 *   • Sectors — angular slice per lane (60° each for 6 lanes)
 *   • Rings   — inner ring (urgent), deadline ring (e.g. YC), outer
 *   • Nodes   — RadialNode chips orbit at radius ∝ days remaining
 *   • Edges   — dependency arcs curve toward the center
 *
 * Replaces the previous DAG-with-arrows display. Time becomes
 * distance: closer to center = more urgent. Lane = angular sector.
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

  const layout = useMemo(
    () => computeRadialLayout(checkpoints, lanes, 1200),
    [checkpoints, lanes],
  );

  const cpById = useMemo(
    () => new Map(checkpoints.map((c) => [c.id, c])),
    [checkpoints],
  );
  const profileById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles],
  );

  const lineage = useMemo(
    () => (selectedId ? computeLineage(selectedId, dependencies) : null),
    [selectedId, dependencies],
  );

  // ── Auto-fit on mount + on resize. The radial canvas is square at
  //     `layout.width` (1200 by default); we scale-fit so the entire
  //     wheel is visible without scrolling. ──────────────────────────
  const [scale, setScale] = useState(1);
  const fitToViewport = () => {
    const el = scrollRef.current;
    if (!el) return;
    const usableW = Math.max(1, el.clientWidth - 32);
    const usableH = Math.max(1, el.clientHeight - 32);
    const next = Math.min(1, Math.min(usableW, usableH) / layout.width);
    setScale(Math.max(0.3, next));
  };
  useEffect(() => {
    fitToViewport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width, layout.height]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitToViewport());
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.width]);

  return (
    <div
      ref={scrollRef}
      className="relative h-full w-full select-none overflow-auto"
      style={{
        background: [
          "radial-gradient(ellipse 70% 50% at 50% 50%, color-mix(in srgb, hsl(var(--primary)) 8%, transparent), transparent 60%)",
          "radial-gradient(circle, color-mix(in srgb, hsl(var(--foreground)) 5%, transparent) 1px, transparent 1px) 0 0/24px 24px",
          "linear-gradient(180deg, color-mix(in srgb, hsl(var(--card)) 96%, hsl(var(--foreground)) 4%) 0%, hsl(var(--card)) 100%)",
        ].join(", "),
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === innerRef.current) {
          onSelect(null);
        }
      }}
    >
      <div
        ref={innerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <div
          style={{
            width: layout.width * scale,
            height: layout.height * scale,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ display: "block", shapeRendering: "geometricPrecision" }}
          >
            {/* ── Lane sectors (background tint) ──────────────────── */}
            <g>
              {layout.sectors.map((s) => {
                const inner = layout.innerRadius - 6;
                const outer = layout.outerRadius + 12;
                const path = describeSector(
                  layout.cx,
                  layout.cy,
                  inner,
                  outer,
                  s.startAngle,
                  s.endAngle,
                );
                return (
                  <path
                    key={s.laneId}
                    d={path}
                    fill={`color-mix(in srgb, hsl(${s.accentHsl}) 4%, transparent)`}
                    stroke={`color-mix(in srgb, hsl(${s.accentHsl}) 12%, transparent)`}
                    strokeWidth={1}
                  />
                );
              })}
            </g>

            {/* ── Concentric rings (deadline + outer horizon) ─────── */}
            <g>
              <circle
                cx={layout.cx}
                cy={layout.cy}
                r={layout.deadlineRadius}
                fill="none"
                stroke="hsl(42 95% 58% / 0.35)"
                strokeWidth={1.2}
                strokeDasharray="4 4"
              />
              <circle
                cx={layout.cx}
                cy={layout.cy}
                r={layout.outerRadius}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeDasharray="2 6"
                opacity={0.45}
              />
            </g>

            {/* ── Lane labels (around the outer ring) ─────────────── */}
            <g>
              {layout.sectors.map((s) => {
                const labelR = layout.outerRadius + 30;
                const lx = layout.cx + Math.cos(s.midAngle) * labelR;
                const ly = layout.cy + Math.sin(s.midAngle) * labelR;
                return (
                  <text
                    key={s.laneId}
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontFamily: "ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                      fill: `hsl(${s.accentHsl})`,
                    }}
                  >
                    {s.title}
                  </text>
                );
              })}
            </g>

            {/* Deadline marker — small "MAY 4 ▸ YC" label on the
                deadline ring at the 12 o'clock-ish position. */}
            <g>
              <text
                x={layout.cx}
                y={layout.cy - layout.deadlineRadius - 8}
                textAnchor="middle"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  fill: "hsl(42 95% 58%)",
                }}
              >
                YC DEADLINE
              </text>
            </g>

            {/* ── Dependency arcs ─────────────────────────────────── */}
            <g>
              {dependencies.map((d) => {
                const fromPos = layout.positions.get(d.fromId);
                const toPos = layout.positions.get(d.toId);
                if (!fromPos || !toPos) return null;
                const highlighted =
                  !!lineage && lineage.has(d.fromId) && lineage.has(d.toId);
                const dimmed = !!lineage && !highlighted;
                // Curve toward the center — control point pulled
                // ~30% toward the canvas center so the arcs don't
                // criss-cross the wheel.
                const mx = (fromPos.x + toPos.x) / 2;
                const my = (fromPos.y + toPos.y) / 2;
                const cx = mx + (layout.cx - mx) * 0.45;
                const cy = my + (layout.cy - my) * 0.45;
                return (
                  <path
                    key={d.id}
                    d={`M ${fromPos.x} ${fromPos.y} Q ${cx} ${cy} ${toPos.x} ${toPos.y}`}
                    fill="none"
                    stroke={
                      highlighted
                        ? "hsl(var(--primary))"
                        : "hsl(var(--foreground) / 0.18)"
                    }
                    strokeWidth={highlighted ? 1.5 : 0.8}
                    strokeDasharray={highlighted ? "0" : "3 3"}
                    opacity={dimmed ? 0.15 : 1}
                  />
                );
              })}
            </g>

            {/* ── TODAY disc (center) ─────────────────────────────── */}
            <g>
              {/* Outer pulse halo */}
              <circle
                cx={layout.cx}
                cy={layout.cy}
                r={layout.todayRadius + 14}
                fill="none"
                stroke="hsl(var(--primary) / 0.18)"
                strokeWidth={1}
                style={{
                  transformOrigin: `${layout.cx}px ${layout.cy}px`,
                  animation: "roadmapTodayPulse 3s ease-in-out infinite",
                }}
              />
              <circle
                cx={layout.cx}
                cy={layout.cy}
                r={layout.todayRadius}
                fill="hsl(var(--card))"
                stroke="hsl(var(--primary) / 0.55)"
                strokeWidth={1.5}
                style={{
                  filter: "drop-shadow(0 0 24px hsl(var(--primary) / 0.35))",
                }}
              />
              <text
                x={layout.cx}
                y={layout.cy - 8}
                textAnchor="middle"
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fill: "hsl(var(--muted-foreground))",
                }}
              >
                TODAY
              </text>
              <text
                x={layout.cx}
                y={layout.cy + 14}
                textAnchor="middle"
                style={{
                  fontFamily: "ui-sans-serif, system-ui",
                  fontSize: 16,
                  fontWeight: 700,
                  fill: "hsl(var(--foreground))",
                }}
              >
                {new Date().toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </text>
            </g>

            {/* ── Nodes (orbital chips) ───────────────────────────── */}
            <g>
              {checkpoints.map((cp) => {
                const pos = layout.positions.get(cp.id);
                const author = profileById.get(cp.authorId);
                if (!pos || !author) return null;
                const owner = cp.ownerId
                  ? profileById.get(cp.ownerId)
                  : undefined;
                const selected = selectedId === cp.id;
                const dimmed = !!lineage && !lineage.has(cp.id);
                return (
                  <RadialNode
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
      </div>

      {/* Zoom toolbar */}
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

      {/* Legend pill — explains the metaphor */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-10 hidden rounded-md border border-border/70 bg-card/70 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/80 backdrop-blur md:inline-block">
        center = today · radius = days due · sector = lane
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Annular-sector path: a wedge between two angles bounded by an
 *  inner and outer radius. Used to tint the lane background. */
function describeSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startA: number,
  endA: number,
): string {
  const x1 = cx + Math.cos(startA) * outerR;
  const y1 = cy + Math.sin(startA) * outerR;
  const x2 = cx + Math.cos(endA) * outerR;
  const y2 = cy + Math.sin(endA) * outerR;
  const x3 = cx + Math.cos(endA) * innerR;
  const y3 = cy + Math.sin(endA) * innerR;
  const x4 = cx + Math.cos(startA) * innerR;
  const y4 = cy + Math.sin(startA) * innerR;
  const largeArc = endA - startA > Math.PI ? 1 : 0;
  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}
