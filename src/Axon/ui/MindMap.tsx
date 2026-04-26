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
//
// IMPORTANT: canvas color strings can't reference CSS variables —
// addColorStop/strokeStyle expects a fully-resolved literal. We
// resolve --axon-accent-rgb once at module load and stash the
// literal "rgb(R, G, B)" form so the rest of the renderer can
// blindly do the .replace("rgb","rgba")... trick without blowing up.
function resolveAccentRgb(): string {
  if (typeof window === "undefined") return "rgb(248, 113, 113)";
  try {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--axon-accent-rgb")
      .trim();
    if (raw && /^\d+\s*,\s*\d+\s*,\s*\d+$/.test(raw)) {
      return `rgb(${raw})`;
    }
  } catch {}
  return "rgb(248, 113, 113)"; // rose-400 fallback — matches Orb tone.
}
const ACCENT_RGB = resolveAccentRgb();

const KIND_COLOR: Record<GraphNodeKind, string> = {
  root: ACCENT_RGB,
  plan: "rgb(165, 180, 252)", // indigo-300
  tool: "rgb(94, 234, 212)", // teal-300
  file: "rgb(125, 211, 252)", // sky-300 (overridden per fileOp)
  thought: "rgb(212, 212, 216)", // zinc-300
  error: "rgb(248, 113, 113)", // rose-400
  summary: "rgb(134, 239, 172)", // emerald-300
  critique: "rgb(252, 211, 77)", // amber-300 — Critic verdict node
  vision: "rgb(186, 230, 253)", // sky-200 — ambient observation
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

// ── Ensemble-role visual identity ───────────────────────────────────
//
// When an ensemble session is running, its nodes belong to one of
// three "roles": Architect (planning), Engineer (executing), Critic
// (judging). Each role gets a distinct color + animation so the
// operator can read the phase at a glance.
//
// Role detection rules (no graphStore schema change needed):
//   • Session is ensemble  ↔  prompt starts with "[ensemble]"
//   • Architect            ↔  kind === "plan"
//   • Critic               ↔  kind === "critique"  (color tinted by verdict)
//   • Engineer             ↔  any other non-root/non-summary node IN an
//                              ensemble session (tools, files, thoughts)
//
// In a non-ensemble session, every node falls back to its standard
// kind color — the role overrides only kick in inside an ensemble.

type EnsembleRole = "architect" | "engineer" | "critic" | null;

const ROLE_COLOR = {
  // Architect — cool indigo, blueprint feel.
  architect: "rgb(129, 140, 248)", // indigo-400
  // Engineer — bright sky, active, "live cursor" feel.
  engineer: "rgb(56, 189, 248)", // sky-400
  // Critic — neutral default; verdict-specific overrides below.
  critic: "rgb(251, 191, 36)", // amber-400
} as const;

const CRITIC_VERDICT_COLOR = {
  ship: "rgb(74, 222, 128)", // green-400 — go.
  revise: "rgb(251, 191, 36)", // amber-400 — needs work.
  abort: "rgb(248, 113, 113)", // rose-400 — stop.
} as const;

function isEnsembleSession(s: GraphSession | null | undefined): boolean {
  return !!s && typeof s.prompt === "string" && s.prompt.startsWith("[ensemble]");
}

function ensembleRole(n: GraphNode, s: GraphSession | null | undefined): EnsembleRole {
  if (!isEnsembleSession(s)) return null;
  if (n.kind === "plan") return "architect";
  if (n.kind === "critique") return "critic";
  if (n.kind === "root" || n.kind === "summary") return null;
  return "engineer";
}

/** Read the critic's verdict from a critique node's label. The label
 *  is set by addCritique to one of "✓ SHIP", "↺ REVISE", "✕ ABORT". */
function criticVerdictColor(n: GraphNode): string {
  const lbl = (n.label || "").toUpperCase();
  if (lbl.includes("SHIP")) return CRITIC_VERDICT_COLOR.ship;
  if (lbl.includes("REVISE")) return CRITIC_VERDICT_COLOR.revise;
  if (lbl.includes("ABORT")) return CRITIC_VERDICT_COLOR.abort;
  return ROLE_COLOR.critic;
}

function roleColor(n: GraphNode, role: EnsembleRole): string | null {
  if (!role) return null;
  if (role === "architect") return ROLE_COLOR.architect;
  if (role === "critic") return criticVerdictColor(n);
  // engineer — only override for non-default kinds; let file-op tints
  // (write/modify/etc) keep their meaning, but harmonize tools/thoughts.
  if (role === "engineer") {
    if (n.kind === "thought" || n.kind === "tool") return ROLE_COLOR.engineer;
    return null;
  }
  return null;
}

function nodeRadius(n: GraphNode): number {
  // Used for force-directed layout repulsion — keeps spacing right
  // even though we render rectangles. The actual hit-test uses the
  // box bounds stored on the LayoutNode (see hit-test below).
  switch (n.kind) {
    case "root":
      return 28;
    case "summary":
      return 22;
    case "plan":
      return 18;
    case "tool":
      return 22;
    case "file":
      return 24;
    case "thought":
      return 14;
    case "error":
      return 22;
    case "critique":
      return 22;
    case "vision":
      return 20;
  }
}

// ── Tech / CWA-style boxy node helpers ───────────────────────────────
// Replaces the cartoon sphere look with terminal-window tags: dark
// fill, monospace label inside, 1px accent-color border, optional
// brand-glow shadow when active. Boxes are sized to fit their label.

function nodeBoxLabel(n: GraphNode): string {
  const trunc = (s: string, len: number) =>
    s.length > len ? s.slice(0, len - 1) + "…" : s;
  if (n.kind === "root") return "GOAL";
  if (n.kind === "summary") return "DONE";
  if (n.kind === "file" && n.fileOp) {
    return `${n.fileOp.toUpperCase()}  ${trunc(n.label, 22)}`;
  }
  if (n.kind === "tool") return `TOOL  ${trunc(n.label.toUpperCase(), 18)}`;
  if (n.kind === "plan") return `PLAN  ${trunc(n.label.toUpperCase(), 18)}`;
  if (n.kind === "thought") return trunc(n.label, 24);
  if (n.kind === "error") return `ERR  ${trunc(n.label.toUpperCase(), 18)}`;
  if (n.kind === "critique") return `CRITIC  ${trunc(n.label, 18)}`;
  if (n.kind === "vision") return `👁  ${trunc(n.label, 28)}`;
  return n.label.toUpperCase();
}

function nodeFontPx(n: GraphNode): number {
  if (n.kind === "root") return 11;
  if (n.kind === "thought") return 9.5;
  if (n.kind === "summary") return 10.5;
  return 10;
}

function nodeBoxDims(
  n: GraphNode,
  ctx: CanvasRenderingContext2D,
): { w: number; h: number } {
  const fontSize = nodeFontPx(n);
  ctx.font = `500 ${fontSize}px ui-monospace, "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`;
  const textW = ctx.measureText(nodeBoxLabel(n)).width;
  const padX = n.kind === "root" || n.kind === "summary" ? 14 : 11;
  const padY = n.kind === "thought" ? 4 : n.kind === "root" ? 8 : 6;
  return {
    w: Math.ceil(textW + padX * 2),
    h: Math.ceil(fontSize + padY * 2),
  };
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
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
   *  fade animation. */
  bornAt: number;
  /** Last-rendered box dimensions; written during draw, read during
   *  the rect-based hit test. */
  boxW?: number;
  boxH?: number;
}

const LAYOUT_PARAMS = {
  // Bumped from 0.04 → 0.025: weaker spring pull lets edges run longer
  // before snapping the leaf node back, so groups breathe instead of
  // pancaking into the parent.
  attraction: 0.025,
  // Bumped from 1800 → 4200: ~2.3× harder push between every pair so
  // labeled boxes (READ / TOOL / FIND / etc.) stop overlapping when
  // the goal spawns 8+ siblings off the root.
  repulsion: 4200,
  // Bumped from 64 → 110: minimum visual gap between nodes; pairs
  // closer than this get extra outward kick.
  minDistance: 110,
  damping: 0.82,
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

        // Anti-overlap shove — when two box outlines actually touch
        // (using last-rendered boxW/boxH plus a 16px gutter), apply a
        // hard separation impulse on top of the normal repulsion so
        // labels never sit on top of each other.
        const halfA = ((a.boxW ?? 80) + (a.boxH ?? 22)) / 4;
        const halfB = ((b.boxW ?? 80) + (b.boxH ?? 22)) / 4;
        const minGap = halfA + halfB + 16;
        if (dist < minGap) {
          const overlap = (minGap - dist) * 0.5;
          const ux = dx / (dist || 1);
          const uy = dy / (dist || 1);
          if (a.kind !== "root") {
            a.vx -= ux * overlap;
            a.vy -= uy * overlap;
          }
          if (b.kind !== "root") {
            b.vx += ux * overlap;
            b.vy += uy * overlap;
          }
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
      // Soft bounds — wider margin so labeled boxes don't collide
      // with the canvas edge or the header.
      const halfW = (n.boxW ?? 80) / 2;
      const halfH = (n.boxH ?? 24) / 2;
      const marginX = halfW + 24;
      const marginY = halfH + 24;
      n.x = Math.max(marginX, Math.min(width - marginX, n.x));
      n.y = Math.max(marginY, Math.min(height - marginY, n.y));
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
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 4>(1);

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
  // Replay auto-advance — when playing, step the replay index forward
  // at a rate driven by the speed setting. Stops at the end and
  // resumes live mode (replayIndex = -1) so the visual flips back to
  // showing fresh activity.
  useEffect(() => {
    if (!replayPlaying) return;
    let raf = 0;
    let last = performance.now();
    const stepMs = 600 / replaySpeed; // 600ms per step at 1x
    const tick = (now: number) => {
      const cur = axonGraph.getState().replayIndex;
      const sess = axonGraph.getState().sessions.find((s) => s.id === axonGraph.getState().currentSessionId);
      const total = sess ? sess.nodes.length - 1 : 0;
      if (now - last >= stepMs) {
        last = now;
        const next = cur < 0 ? 0 : cur + 1;
        if (next >= total) {
          axonGraph.setReplayIndex(-1);
          setReplayPlaying(false);
          return;
        }
        axonGraph.setReplayIndex(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [replayPlaying, replaySpeed]);

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

      // Background dot grid — barely there. Sovereign restraint.
      ctx.fillStyle = "rgba(255,255,255,0.014)";
      const step = 36;
      for (let x = step; x < w; x += step) {
        for (let y = step; y < h; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 0.6, 0, Math.PI * 2);
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
        grad.addColorStop(0, aColor.replace("rgb", "rgba").replace(")", ", 0.32)"));
        grad.addColorStop(1, bColor.replace("rgb", "rgba").replace(")", ", 0.62)"));

        ctx.strokeStyle = grad;
        ctx.lineWidth = isActiveTrail ? 1.6 : 0.9;
        ctx.shadowBlur = isActiveTrail ? 10 : 0;
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
        // Materialize-in: quick fade, no bouncy scale (tech feel).
        const age = now - n.bornAt;
        const intro = age < 220 ? Math.min(1, age / 220) : 1;

        const role = ensembleRole(n, session);
        const roleOverride = roleColor(n, role);
        const color = roleOverride ?? nodeColor(n);
        const isActive = session?.activeNodeId === n.id;
        const isHover = hoverRef.current.id === n.id;
        const isPinned = pinnedId === n.id;
        const isError = n.state === "error";

        // Box dimensions, centered on n.x/n.y. Cache on the node so
        // the rect-hit test below uses the same dims we're drawing.
        const { w: boxW, h: boxH } = nodeBoxDims(n, ctx);
        n.boxW = boxW;
        n.boxH = boxH;
        const x = n.x - boxW / 2;
        const y = n.y - boxH / 2;
        const radius = 2; // sharp, terminal-window corners

        ctx.globalAlpha = intro;

        // ── Per-role glow signature ─────────────────────────────────
        // Architect: slow, deliberate breathing pulse (~1.6s) — the
        //   "drafting" cadence. Always glows, even when state==done,
        //   for the lifetime of the session, because the plan stays
        //   relevant the whole run.
        // Engineer: fast, bright pulse (~0.5s) when active/running —
        //   reads as "live cursor".
        // Critic:   flash burst — bright glow for 600ms after birth
        //   then settles to a faint tint.
        // Default:  the existing pulse on running/active.
        let glowPulse = 0; // 0 = no glow, 1 = full glow
        let glowBlur = 0;
        if (role === "architect") {
          // Constant slow shimmer. Range 0.30–0.55 → soft, never aggressive.
          glowPulse = 0.42 + 0.13 * Math.sin(now / 800);
          glowBlur = 12;
        } else if (role === "engineer" && (n.state === "running" || isActive)) {
          // Quick "scan-tick" pulse when actively executing.
          glowPulse = 0.55 + 0.30 * Math.sin(now / 250);
          glowBlur = 16;
        } else if (role === "critic") {
          if (age < 600) {
            // Verdict flash — bright burst on appear.
            const t = age / 600;
            glowPulse = 0.95 * (1 - t * t);
            glowBlur = 22 - 14 * t;
          } else {
            // Settled: faint constant glow that says "verdict is here".
            glowPulse = 0.32;
            glowBlur = 8;
          }
        } else if (n.state === "running" || isActive) {
          glowPulse = 0.45 + 0.25 * Math.sin(now / 360);
          glowBlur = 14;
        }

        // Drop shadow / brand glow when active or running.
        if (glowPulse > 0) {
          ctx.save();
          ctx.shadowColor = (isError
            ? "rgb(248, 113, 113)"
            : color
          )
            .replace("rgb", "rgba")
            .replace(")", `, ${glowPulse})`);
          ctx.shadowBlur = glowBlur;
          ctx.fillStyle = "rgba(10, 11, 14, 0.96)";
          drawRoundRect(ctx, x, y, boxW, boxH, radius);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = "rgba(10, 11, 14, 0.94)";
          drawRoundRect(ctx, x, y, boxW, boxH, radius);
          ctx.fill();
          ctx.restore();
        }

        // Subtle inner tint when active / hovered / pinned.
        if (isActive || isHover || isPinned) {
          ctx.fillStyle = (isError ? "rgb(248, 113, 113)" : color)
            .replace("rgb", "rgba")
            .replace(")", ", 0.10)");
          drawRoundRect(ctx, x, y, boxW, boxH, radius);
          ctx.fill();
        }

        // Border — kind-color accent, brighter when interactive.
        // Simulated nodes get a dashed stroke so they read as preview.
        const borderAlpha =
          isError ? 0.9 : isActive || isHover || isPinned ? 0.95 : 0.5;
        ctx.strokeStyle = (isError ? "rgb(248, 113, 113)" : color)
          .replace("rgb", "rgba")
          .replace(")", `, ${borderAlpha})`);
        ctx.lineWidth = n.kind === "root" ? 1.5 : 1;
        if (n.simulated) {
          ctx.setLineDash([3, 3]);
        }
        drawRoundRect(ctx, x, y, boxW, boxH, radius);
        ctx.stroke();
        if (n.simulated) ctx.setLineDash([]);

        // Left edge accent bar (1.5px) — gives the box a tag look.
        ctx.fillStyle = isError ? "rgb(248, 113, 113)" : color;
        ctx.fillRect(x, y + 1, 1.5, boxH - 2);

        // ── Per-role decorations ────────────────────────────────────
        // Architect — animated blueprint dashes along the TOP edge.
        // The dash phase shifts over time so it reads as "drafting".
        if (role === "architect") {
          ctx.save();
          const phase = (now / 80) % 8;
          ctx.setLineDash([3, 3]);
          ctx.lineDashOffset = -phase;
          ctx.strokeStyle = color
            .replace("rgb", "rgba")
            .replace(")", ", 0.85)");
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 1, y);
          ctx.lineTo(x + boxW - 1, y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;
          ctx.restore();
        }

        // Engineer — animated scanner bar along the BOTTOM edge while
        // the node is active or running. Sweeps L→R like a cursor.
        if (role === "engineer" && (n.state === "running" || isActive)) {
          ctx.save();
          // Travel: a short bright segment that moves from left to right
          // and wraps. Period ~900ms.
          const t = ((now / 900) % 1);
          const segW = Math.max(8, boxW * 0.28);
          const segX = x + (boxW - segW) * t;
          const grad = ctx.createLinearGradient(segX, 0, segX + segW, 0);
          grad.addColorStop(0, color.replace("rgb", "rgba").replace(")", ", 0)"));
          grad.addColorStop(0.5, color.replace("rgb", "rgba").replace(")", ", 0.95)"));
          grad.addColorStop(1, color.replace("rgb", "rgba").replace(")", ", 0)"));
          ctx.fillStyle = grad;
          ctx.fillRect(segX, y + boxH - 1.5, segW, 1.5);
          ctx.restore();
        }

        // Critic — verdict stamp on the right edge: ✓ for ship,
        // ↺ for revise, ✕ for abort. Stamps in with a 220ms pop.
        if (role === "critic") {
          const lbl = (n.label || "").toUpperCase();
          const stamp = lbl.includes("SHIP")
            ? "✓"
            : lbl.includes("REVISE")
              ? "↺"
              : lbl.includes("ABORT")
                ? "✕"
                : "•";
          // Pop-in scale: 0 → 1 over the first 220ms.
          const popT = Math.min(1, age / 220);
          const popScale = 0.6 + 0.4 * popT;
          const stampX = x + boxW - 9;
          const stampY = y + boxH / 2;
          ctx.save();
          ctx.translate(stampX, stampY);
          ctx.scale(popScale, popScale);
          ctx.fillStyle = color;
          ctx.font = `700 11px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(stamp, 0, 0);
          ctx.restore();
        }

        // Label — monospace, centered inside.
        const label = nodeBoxLabel(n);
        const fontSize = nodeFontPx(n);
        ctx.font = `500 ${fontSize}px ui-monospace, "JetBrains Mono", "Fira Code", Menlo, Consolas, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle =
          isError
            ? "rgba(255, 220, 220, 0.95)"
            : isActive || isHover || isPinned
              ? "rgba(255, 255, 255, 0.96)"
              : "rgba(225, 225, 232, 0.78)";
        ctx.fillText(label, n.x + 0.75, n.y + 0.5);

        // SIM pill above simulated nodes.
        if (n.simulated) {
          const pillW = 24;
          const pillH = 11;
          const pillX = n.x - pillW / 2;
          const pillY = y - pillH - 3;
          ctx.fillStyle = "rgba(252, 211, 77, 0.16)";
          drawRoundRect(ctx, pillX, pillY, pillW, pillH, 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(252, 211, 77, 0.55)";
          ctx.lineWidth = 0.8;
          drawRoundRect(ctx, pillX, pillY, pillW, pillH, 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(254, 240, 138, 0.95)";
          ctx.font = `600 8px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("SIM", n.x, pillY + pillH / 2);
        }

        ctx.globalAlpha = 1;
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
      // Rect-based hit test using last-rendered box dims. Falls back
      // to a generous circle radius if the box hasn't been drawn yet.
      const halfW = (n.boxW ?? nodeRadius(n) * 2) / 2 + 4;
      const halfH = (n.boxH ?? nodeRadius(n) * 1.2) / 2 + 4;
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        const d = Math.abs(dx) / halfW + Math.abs(dy) / halfH;
        if (d < bestD) {
          bestD = d;
          hit = n.id;
        }
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
      // Rect-based hit test using last-rendered box dims. Falls back
      // to a generous circle radius if the box hasn't been drawn yet.
      const halfW = (n.boxW ?? nodeRadius(n) * 2) / 2 + 4;
      const halfH = (n.boxH ?? nodeRadius(n) * 1.2) / 2 + 4;
      const dx = mx - n.x;
      const dy = my - n.y;
      if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
        const d = Math.abs(dx) / halfW + Math.abs(dy) / halfH;
        if (d < bestD) {
          bestD = d;
          hit = n.id;
        }
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
          {isEnsembleSession(session) && (
            <span
              className="axon-mindmap-ensemble-legend"
              title="Ensemble session — three-agent pipeline"
            >
              <span
                className="axon-mindmap-role-chip"
                style={{ ["--role-color" as never]: ROLE_COLOR.architect }}
                title="Architect — planning"
              >
                ARCH
              </span>
              <span
                className="axon-mindmap-role-chip"
                style={{ ["--role-color" as never]: ROLE_COLOR.engineer }}
                title="Engineer — building"
              >
                ENG
              </span>
              <span
                className="axon-mindmap-role-chip"
                style={{ ["--role-color" as never]: ROLE_COLOR.critic }}
                title="Critic — judging"
              >
                CRIT
              </span>
            </span>
          )}
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
              style={{
                background:
                  roleColor(focusNode, ensembleRole(focusNode, session)) ??
                  nodeColor(focusNode),
              }}
            />
            <strong>
              {(() => {
                const r = ensembleRole(focusNode, session);
                if (r === "architect") return "ARCHITECT";
                if (r === "engineer") return "ENGINEER";
                if (r === "critic") return "CRITIC";
                return kindLabel(focusNode.kind, focusNode.fileOp);
              })()}
            </strong>
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
            onClick={() => {
              setReplayPlaying(false);
              axonGraph.setReplayIndex(-1);
            }}
            data-active={state.replayIndex === -1}
            title="Resume live"
          >
            ● Live
          </button>
          <button
            className="axon-mindmap-scrub-btn"
            onClick={() => setReplayPlaying((p) => !p)}
            data-active={replayPlaying}
            title={replayPlaying ? "Pause replay" : "Play replay"}
          >
            {replayPlaying ? "❚❚ Pause" : "▶ Play"}
          </button>
          <button
            className="axon-mindmap-scrub-btn"
            onClick={() => setReplaySpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
            title="Replay speed"
          >
            {replaySpeed}×
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
            Quiet.<br />
            <span>Speak when ready</span>
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
