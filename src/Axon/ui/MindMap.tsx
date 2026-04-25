// ───────────────────────────────────────────────────────────────────
// AXON — Live Mind Map.
//
// Real-time directed graph of what Axon is thinking, touching, and
// running. Subscribes to the graphStore and renders to a single
// HTML canvas at devicePixelRatio with a tiny force-directed layout
// engine. No external graph lib; everything is hand-tuned to match
// the Orb's plasma + glow language.
//
// Reads:
//   • axonGraph.getState() — sessions[], currentSessionId, replayIndex
//
// Visual language:
//   • Background — deep void, faint dotted grid
//   • Root node — large, plasma core that pulses with the orb accent
//   • Plan nodes — slate diamonds chained off the root
//   • Tool nodes — circular, color by category (find/read/write/etc.)
//   • File nodes — pill-shaped, sized by visited frequency,
//     amber for modify, teal for write, blue for read, indigo for find
//   • Active node pulses with a soft halo while running
//   • Edges — gradient strokes that flow from source → target,
//     thickening when traversed recently
//   • Hover — node grows and a glassy tooltip shows label / detail
//   • Click — pin a node so the tooltip stays open
//   • Replay scrubber at the bottom — drag to rewind through events
//
// All measurements use a tiny coord system; the canvas renders at
// dpr-aware size and we map mouse events back through getBoundingClientRect.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  axonGraph,
  type GraphEdge,
  type GraphNode,
  type GraphNodeKind,
  type FileOp,
  type GraphSession,
} from "../engine/graphStore";

// ── color tokens — tuned per node kind, sourced from the brand
// accent rgb to keep the map cohesive with the Orb. ────────────────
const KIND_COLOR: Record<GraphNodeKind, string> = {
  root: "rgb(var(--axon-accent-rgb))",
  plan: "rgb(165, 180, 252)", // indigo-300
  tool: "rgb(94, 234, 212)", // teal-300
  file: "rgb(125, 211, 252)", // sky-300 (overridden per fileOp)
  thought: "rgb(212, 212, 216)", // zinc-300
  error: "rgb(248, 113, 113)", // rose-400
  summary: "rgb(134, 239, 172)", // emerald-300
};

const FILE_OP_COLOR: Record<FileOp, string> = {
  find: "rgb(165, 180, 252)", // indigo-300
  search: "rgb(192, 132, 252)", // purple-300
  list: "rgb(212, 212, 216)", // zinc-300
  read: "rgb(125, 211, 252)", // sky-300
  write: "rgb(94, 234, 212)", // teal-300
  modify: "rgb(252, 211, 77)", // amber-300
  delete: "rgb(248, 113, 113)", // rose-400
};

function nodeColor(n: GraphNode): string {
  if (n.kind === "file" && n.fileOp) return FILE_OP_COLOR[n.fileOp];
  return KIND_COLOR[n.kind];
}

function nodeRadius(n: GraphNode): number {
  switch (n.kind) {
    case "root":
      return 28;
    case "summary":
      return 20;
    case "plan":
      return 14;
    case "tool":
      return 16;
    case "file":
      return 12;
    case "thought":
      return 9;
    case "error":
      return 16;
  }
}

// ── Layout — minimalist force-directed.
// We don't use a heavy graph lib; for typical session sizes (≤ 80 nodes)
// a 60-iter spring relax is silky-smooth at 60fps and responds visually
// to live updates. ──────────────────────────────────────────────────

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Time the layout first saw this node — used for the materialize-in
   *  scale animation. */
  bornAt: number;
}

const LAYOUT_PARAMS = {
  attraction: 0.04,
  repulsion: 1800,
  minDistance: 64,
  damping: 0.78,
  iterPerFrame: 4,
};

function relayout(layoutMap: Map<string, LayoutNode>, edges: GraphEdge[], width: number, height: number) {
  const cx = width / 2;
  const cy = height / 2;
  // Pin the root to center.
  for (const n of layoutMap.values()) {
    if (n.kind === "root") {
      n.x = cx;
      n.y = cy;
      n.vx = 0;
      n.vy = 0;
    }
  }

  for (let it = 0; it < LAYOUT_PARAMS.iterPerFrame; it++) {
    // Repulsion — every pair pushes apart.
    const arr = Array.from(layoutMap.values());
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = arr[i];
        const b = arr[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = Math.max(dx * dx + dy * dy, 1);
        const dist = Math.sqrt(distSq);
        const force = LAYOUT_PARAMS.repulsion / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        if (a.kind !== "root") {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (b.kind !== "root") {
          b.vx += fx;
          b.vy += fy;
        }
      }
    }
    // Attraction along edges.
    for (const e of edges) {
      const a = layoutMap.get(e.from);
      const b = layoutMap.get(e.to);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (a.kind !== "root") {
        a.vx += dx * LAYOUT_PARAMS.attraction;
        a.vy += dy * LAYOUT_PARAMS.attraction;
      }
      if (b.kind !== "root") {
        b.vx -= dx * LAYOUT_PARAMS.attraction;
        b.vy -= dy * LAYOUT_PARAMS.attraction;
      }
    }
    // Integrate.
    for (const n of layoutMap.values()) {
      if (n.kind === "root") continue;
      n.vx *= LAYOUT_PARAMS.damping;
      n.vy *= LAYOUT_PARAMS.damping;
      n.x += n.vx;
      n.y += n.vy;
      // Soft cling toward center to keep the graph in-frame.
      n.x += (cx - n.x) * 0.0015;
      n.y += (cy - n.y) * 0.0015;
      // Soft bounds.
      const margin = 32;
      n.x = Math.max(margin, Math.min(width - margin, n.x));
      n.y = Math.max(margin, Math.min(height - margin, n.y));
    }
  }
}

// ── Component ───────────────────────────────────────────────────────

export function MindMap({ fullScreen = false }: { fullScreen?: boolean }) {
  // Subscribe to the store. useSyncExternalStore lets us read store
  // state synchronously without going through React state — the
  // canvas redraws in its own loop anyway.
  const state = useSyncExternalStore(axonGraph.subscribe, axonGraph.getState, axonGraph.getState);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layoutRef = useRef<Map<string, LayoutNode>>(new Map());
  const sizeRef = useRef({ w: 600, h: 400, dpr: 1 });
  const hoverRef = useRef<{ id: string | null; x: number; y: number }>({ id: null, x: 0, y: 0 });
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Pick the active session — the latest one that has nodes, or the
  // most recent overall.
  const session: GraphSession | null = useMemo(() => {
    if (state.currentSessionId) {
      return state.sessions.find((s) => s.id === state.currentSessionId) ?? null;
    }
    return state.sessions[state.sessions.length - 1] ?? null;
  }, [state.sessions, state.currentSessionId]);

  // Apply replay slicing. When replayIndex >= 0, only events created
  // up through that index are visible — the canvas effectively rewinds.
  const visible = useMemo(() => {
    if (!session) return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    if (state.replayIndex < 0) return { nodes: session.nodes, edges: session.edges };
    const cutoff = state.replayIndex;
    return {
      nodes: session.nodes.slice(0, cutoff + 1),
      edges: session.edges.filter((e) =>
        session.nodes.findIndex((n) => n.id === e.from) <= cutoff &&
        session.nodes.findIndex((n) => n.id === e.to) <= cutoff,
      ),
    };
  }, [session, state.replayIndex]);

  // Materialize / re-use layout nodes. New graph nodes get an initial
  // position scattered around the root so they don't all spawn at the
  // exact same coords (which would NaN the spring forces).
  useEffect(() => {
    if (!session) {
      layoutRef.current = new Map();
      return;
    }
    const map = layoutRef.current;
    const live = new Set(visible.nodes.map((n) => n.id));
    // Drop layout nodes that no longer exist (e.g. session switch / clear).
    for (const id of Array.from(map.keys())) {
      if (!live.has(id)) map.delete(id);
    }
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    for (const n of visible.nodes) {
      if (map.has(n.id)) {
        // Keep position; refresh data (state changes pulse).
        const existing = map.get(n.id)!;
        Object.assign(existing, n);
        continue;
      }
      // New node — scatter around the parent if we know it, else the center.
      const parent = visible.edges.find((e) => e.to === n.id);
      const parentNode = parent ? map.get(parent.from) : null;
      const baseX = parentNode?.x ?? cx;
      const baseY = parentNode?.y ?? cy;
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 40;
      map.set(n.id, {
        ...n,
        x: baseX + Math.cos(angle) * radius,
        y: baseY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        bornAt: performance.now(),
      });
    }
  }, [visible.nodes, visible.edges, session]);

  // Resize observer — keep the canvas synced with the wrapper.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    sizeRef.current.dpr = dpr;
    const apply = () => {
      const r = wrap.getBoundingClientRect();
      sizeRef.current.w = r.width;
      sizeRef.current.h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Render loop. Drives the layout + paints the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const { w, h, dpr } = sizeRef.current;
      const map = layoutRef.current;
      relayout(map, visible.edges, w, h);

      ctx.save();
      ctx.scale(dpr, dpr);
      // Clear with the app background tone (translucent so the panel's
      // glass shows through).
      ctx.clearRect(0, 0, w, h);

      // Background dot grid — subtle.
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      const step = 28;
      for (let x = step; x < w; x += step) {
        for (let y = step; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Edges first so nodes paint on top.
      for (const e of visible.edges) {
        const a = map.get(e.from);
        const b = map.get(e.to);
        if (!a || !b) continue;

        const isActiveTrail =
          session?.activeNodeId === b.id || session?.activeNodeId === a.id;
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        const aColor = nodeColor(a);
        const bColor = nodeColor(b);
        grad.addColorStop(0, aColor.replace("rgb", "rgba").replace(")", ", 0.55)"));
        grad.addColorStop(1, bColor.replace("rgb", "rgba").replace(")", ", 0.85)"));

        ctx.strokeStyle = grad;
        ctx.lineWidth = isActiveTrail ? 2.2 : 1.4;
        ctx.shadowBlur = isActiveTrail ? 12 : 0;
        ctx.shadowColor = isActiveTrail ? bColor : "transparent";

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        // Slight curve so parallel edges don't overlap.
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const cx = mx - dy * 0.06;
        const cy = my + dx * 0.06;
        ctx.quadraticCurveTo(cx, cy, b.x, b.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Nodes. Sort so root + active draw last (on top).
      const nodes = Array.from(map.values()).sort((n1, n2) => {
        const score = (n: LayoutNode) =>
          n.kind === "root" ? 3 : session?.activeNodeId === n.id ? 2 : n.kind === "summary" ? 1 : 0;
        return score(n1) - score(n2);
      });

      const now = performance.now();
      for (const n of nodes) {
        // Materialize-in scale: a node born <300ms ago grows from 0 → 1.
        const age = now - n.bornAt;
        const intro = age < 300 ? Math.min(1, age / 300) : 1;
        const ease = 1 - Math.pow(1 - intro, 3);
        const r = nodeRadius(n) * ease;

        const color = nodeColor(n);
        const isActive = session?.activeNodeId === n.id;
        const isHover = hoverRef.current.id === n.id;
        const isPinned = pinnedId === n.id;

        // Outer glow halo for active / running.
        if (n.state === "running" || isActive) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 280);
          const haloR = r * (1.6 + pulse * 0.5);
          const halo = ctx.createRadialGradient(n.x, n.y, r * 0.6, n.x, n.y, haloR);
          halo.addColorStop(0, color.replace("rgb", "rgba").replace(")", `, ${0.35 + pulse * 0.2})`));
          halo.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(n.x, n.y, haloR, 0, Math.PI * 2);
          ctx.fill();
        } else if (isHover || isPinned) {
          // Hover / pinned glow — softer, no pulse.
          const halo = ctx.createRadialGradient(n.x, n.y, r * 0.7, n.x, n.y, r * 2);
          halo.addColorStop(0, color.replace("rgb", "rgba").replace(")", ", 0.3)"));
          halo.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"));
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Body — gradient sphere.
        const body = ctx.createRadialGradient(
          n.x - r * 0.35,
          n.y - r * 0.35,
          r * 0.2,
          n.x,
          n.y,
          r,
        );
        body.addColorStop(0, "rgba(255,255,255,0.9)");
        body.addColorStop(0.4, color);
        body.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0.6)"));
        ctx.fillStyle = body;
        if (n.kind === "plan") {
          // Diamond.
          ctx.beginPath();
          ctx.moveTo(n.x, n.y - r);
          ctx.lineTo(n.x + r, n.y);
          ctx.lineTo(n.x, n.y + r);
          ctx.lineTo(n.x - r, n.y);
          ctx.closePath();
          ctx.fill();
        } else if (n.kind === "file") {
          // Pill.
          const w2 = r * 1.7;
          const h2 = r * 0.95;
          const x = n.x - w2;
          const y = n.y - h2;
          const rad = h2;
          ctx.beginPath();
          ctx.moveTo(x + rad, y);
          ctx.lineTo(x + w2 * 2 - rad, y);
          ctx.quadraticCurveTo(x + w2 * 2, y, x + w2 * 2, y + rad);
          ctx.lineTo(x + w2 * 2, y + h2 * 2 - rad);
          ctx.quadraticCurveTo(x + w2 * 2, y + h2 * 2, x + w2 * 2 - rad, y + h2 * 2);
          ctx.lineTo(x + rad, y + h2 * 2);
          ctx.quadraticCurveTo(x, y + h2 * 2, x, y + h2 * 2 - rad);
          ctx.lineTo(x, y + rad);
          ctx.quadraticCurveTo(x, y, x + rad, y);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Outline — crisp.
        ctx.strokeStyle =
          n.state === "error"
            ? "rgba(248,113,113,0.9)"
            : "rgba(255,255,255,0.55)";
        ctx.lineWidth = n.kind === "root" ? 1.5 : 1;
        ctx.stroke();

        // Inner specular for non-pill kinds — sells the depth.
        if (n.kind !== "file") {
          ctx.fillStyle = "rgba(255,255,255,0.18)";
          ctx.beginPath();
          ctx.arc(n.x - r * 0.3, n.y - r * 0.35, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }

        // Label below.
        ctx.fillStyle = "rgba(240,240,245,0.86)";
        ctx.font = `${n.kind === "root" ? 13 : 11}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const labelY = n.y + r + 6;
        const truncated = n.label.length > 28 ? n.label.slice(0, 26) + "…" : n.label;
        ctx.fillText(truncated, n.x, labelY);
      }
      ctx.restore();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [visible.edges, session, pinnedId]);

  // Hover hit-test — find the closest node under the cursor.
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit: string | null = null;
    let bestD = Infinity;
    for (const n of layoutRef.current.values()) {
      const dx = mx - n.x;
      const dy = my - n.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = nodeRadius(n) + 4;
      if (d < r && d < bestD) {
        bestD = d;
        hit = n.id;
      }
    }
    hoverRef.current = { id: hit, x: mx, y: my };
  };

  const onMouseLeave = () => {
    hoverRef.current = { id: null, x: 0, y: 0 };
  };

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit: string | null = null;
    let bestD = Infinity;
    for (const n of layoutRef.current.values()) {
      const dx = mx - n.x;
      const dy = my - n.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const r = nodeRadius(n) + 4;
      if (d < r && d < bestD) {
        bestD = d;
        hit = n.id;
      }
    }
    setPinnedId((cur) => (cur === hit ? null : hit));
  };

  // Tooltip — derived from hovered or pinned node.
  const focusNode: GraphNode | null = (() => {
    const id = pinnedId ?? hoverRef.current.id;
    if (!id || !session) return null;
    return session.nodes.find((n) => n.id === id) ?? null;
  })();

  const stats = useMemo(() => {
    if (!session) return { nodes: 0, edges: 0, files: 0, tools: 0, errors: 0 };
    return {
      nodes: session.nodes.length,
      edges: session.edges.length,
      files: session.nodes.filter((n) => n.kind === "file").length,
      tools: session.nodes.filter((n) => n.kind === "tool").length,
      errors: session.nodes.filter((n) => n.state === "error").length,
    };
  }, [session]);

  const totalEvents = session ? session.nodes.length - 1 : 0; // excl. root

  return (
    <div className={"axon-mindmap " + (fullScreen ? "axon-mindmap--full" : "")} ref={wrapRef}>
      {/* Header — session info + small stats. Anchored to the top so
          the canvas owns the full height beneath. */}
      <header className="axon-mindmap-header">
        <div className="axon-mindmap-title">
          <span className="axon-mindmap-pulse" data-running={!!session?.activeNodeId} />
          <strong>Mind Map</strong>
          <span className="axon-mindmap-prompt">
            {session?.prompt
              ? session.prompt.length > 80
                ? session.prompt.slice(0, 78) + "…"
                : session.prompt
              : "Idle — speak or type a command to see Axon think."}
          </span>
        </div>
        <div className="axon-mindmap-stats">
          <span title="Total nodes (root + plans + tools + files + thoughts)">
            <em>{stats.nodes}</em> nodes
          </span>
          <span title="Tool calls in this session">
            <em>{stats.tools}</em> tools
          </span>
          <span title="Files Axon touched (find/read/write/modify/delete)">
            <em>{stats.files}</em> files
          </span>
          {stats.errors > 0 && (
            <span className="axon-mindmap-stat-error" title="Failed tool calls">
              <em>{stats.errors}</em> err
            </span>
          )}
        </div>
      </header>

      <canvas
        ref={canvasRef}
        className="axon-mindmap-canvas"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />

      {/* Tooltip overlay — positioned near the focused node. */}
      {focusNode && (
        <div
          className="axon-mindmap-tooltip"
          style={(() => {
            const n = layoutRef.current.get(focusNode.id);
            if (!n) return { display: "none" };
            const r = nodeRadius(n);
            return {
              left: Math.min(sizeRef.current.w - 280, Math.max(8, n.x + r + 8)),
              top: Math.min(sizeRef.current.h - 100, Math.max(8, n.y - 10)),
            };
          })()}
        >
          <div className="axon-mindmap-tt-head">
            <span
              className="axon-mindmap-tt-dot"
              style={{ background: nodeColor(focusNode) }}
            />
            <strong>{kindLabel(focusNode.kind, focusNode.fileOp)}</strong>
            {focusNode.durationMs !== undefined && (
              <span className="axon-mindmap-tt-dur">{formatDuration(focusNode.durationMs)}</span>
            )}
          </div>
          <div className="axon-mindmap-tt-label">{focusNode.label}</div>
          {focusNode.detail && (
            <div className="axon-mindmap-tt-detail">{focusNode.detail}</div>
          )}
          {focusNode.error && (
            <div className="axon-mindmap-tt-error">{focusNode.error}</div>
          )}
          {focusNode.filePath && (
            <div className="axon-mindmap-tt-path">{focusNode.filePath}</div>
          )}
        </div>
      )}

      {/* Replay scrubber — only meaningful when there are >1 events. */}
      {totalEvents > 1 && (
        <footer className="axon-mindmap-scrubber">
          <button
            className="axon-mindmap-scrub-btn"
            onClick={() => axonGraph.setReplayIndex(-1)}
            data-active={state.replayIndex === -1}
            title="Resume live"
          >
            ● Live
          </button>
          <input
            type="range"
            min={0}
            max={totalEvents}
            step={1}
            value={state.replayIndex < 0 ? totalEvents : state.replayIndex}
            onChange={(e) => {
              const v = Number(e.target.value);
              axonGraph.setReplayIndex(v >= totalEvents ? -1 : v);
            }}
            className="axon-mindmap-scrub-range"
          />
          <span className="axon-mindmap-scrub-pos">
            {state.replayIndex < 0
              ? `${totalEvents}/${totalEvents}`
              : `${state.replayIndex}/${totalEvents}`}
          </span>
        </footer>
      )}

      {/* Empty state when no session yet. */}
      {!session && (
        <div className="axon-mindmap-empty">
          <div className="axon-mindmap-empty-orb" />
          <p>
            Mind Map awaits.<br />
            <span>Speak a command or ask Axon to do something — the graph will draw itself.</span>
          </p>
        </div>
      )}
    </div>
  );
}

function kindLabel(k: GraphNodeKind, op?: FileOp): string {
  if (k === "file" && op) return op.toUpperCase();
  return k.toUpperCase();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
