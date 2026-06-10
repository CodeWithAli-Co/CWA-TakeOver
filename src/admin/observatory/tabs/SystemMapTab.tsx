import { useMemo, useState } from "react";
import { manifest, SystemNode, SystemEdge, Layer } from "../data/manifest";
import { nodeFindings, nodeRisk } from "../lib/scoring";
import {
  Badge, Dot, Modal, ModalHeader, Field,
  verdictColor, verdictLabel, sevColor, sensColor,
} from "../components/ui";

/**
 * The system map — Takeover drawn as a left-to-right pipeline. Nodes auto-layout
 * into layer columns; wires are quiet until you hover a node, which traces its
 * data flows and reveals their labels. Click anything for the full dossier.
 */

const W = 1440;
const PAD_X = 48;
const TOP = 70;
const BOT = 44;
const NODE_W = 188;

const COL_ORDER: Layer[] = ["client", "core", "edge", "planned", "persistence", "external"];
const COL_TITLE: Record<Layer, string> = {
  client: "operator machine",
  core: "rust core",
  edge: "your server",
  planned: "not built yet",
  persistence: "databases",
  external: "saas & models",
};

// split a long label onto two lines, preferring the " · " seam
function wrapLabel(label: string): string[] {
  if (label.length <= 19) return [label];
  const dot = label.indexOf(" · ");
  if (dot > 2 && dot < label.length - 3) return [label.slice(0, dot), label.slice(dot + 3)];
  const mid = Math.floor(label.length / 2);
  let i = label.lastIndexOf(" ", mid);
  if (i < 4) i = label.indexOf(" ", mid);
  if (i > 0) return [label.slice(0, i), label.slice(i + 1)];
  return [label];
}

export default function SystemMapTab() {
  const [selNode, setSelNode] = useState<SystemNode | null>(null);
  const [selEdge, setSelEdge] = useState<SystemEdge | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const [layerFilter, setLayerFilter] = useState<Layer | "all">("all");

  const byId = useMemo(() => Object.fromEntries(manifest.nodes.map((n) => [n.id, n])), []);

  const { pos, colX, colW, H, counts } = useMemo(() => {
    const cols = COL_ORDER.map((l) => manifest.nodes.filter((n) => n.layer === l));
    const tallest = Math.max(...cols.map((c) => c.length), 1);
    const H = TOP + tallest * 92 + BOT;
    const innerH = H - TOP - BOT;
    const colW = (W - PAD_X * 2) / COL_ORDER.length;
    const colX: Record<Layer, number> = {} as any;
    const counts: Record<Layer, number> = {} as any;
    COL_ORDER.forEach((l, i) => { colX[l] = PAD_X + colW * i + colW / 2; });
    const pos: Record<string, { x: number; y: number }> = {};
    cols.forEach((nodes, ci) => {
      const l = COL_ORDER[ci];
      counts[l] = nodes.length;
      nodes.forEach((n, i) => {
        const y = TOP + ((i + 0.5) / nodes.length) * innerH;
        pos[n.id] = { x: colX[l], y };
      });
    });
    return { pos, colX, colW, H, counts };
  }, []);

  const colIndex = (l: Layer) => COL_ORDER.indexOf(l);

  const neighbors = (id: string) => {
    const s = new Set<string>([id]);
    manifest.edges.forEach((e) => { if (e.from === id) s.add(e.to); if (e.to === id) s.add(e.from); });
    return s;
  };
  const connectedEdges = (id: string) => new Set(manifest.edges.filter((e) => e.from === id || e.to === id).map((e) => e.id));

  const activeEdges: Set<string> | null = hoverEdge ? new Set([hoverEdge])
    : hoverNode ? connectedEdges(hoverNode) : null;
  const activeNodes: Set<string> | null = hoverEdge
    ? new Set([manifest.edges.find((e) => e.id === hoverEdge)!.from, manifest.edges.find((e) => e.id === hoverEdge)!.to])
    : hoverNode ? neighbors(hoverNode) : null;

  // geometry for one wire: anchors + bezier + midpoint
  function geom(e: SystemEdge) {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b) return null;
    const half = NODE_W / 2;
    if (e.from === e.to) {
      const rx = a.x + half;
      return { d: `M ${rx} ${a.y - 12} C ${rx + 58} ${a.y - 36}, ${rx + 58} ${a.y + 36}, ${rx} ${a.y + 12}`, tx: rx, ty: a.y + 12, mx: rx + 44, my: a.y };
    }
    const sc = colIndex(byId[e.from].layer), tc = colIndex(byId[e.to].layer);
    let sx: number, tx: number;
    if (tc > sc) { sx = a.x + half; tx = b.x - half; }
    else if (tc < sc) { sx = a.x - half; tx = b.x + half; }
    else { sx = a.x + half; tx = b.x + half; }
    const sy = a.y, ty = b.y;
    if (sc === tc) {
      const off = 60;
      return { d: `M ${sx} ${sy} C ${sx + off} ${sy}, ${tx + off} ${ty}, ${tx} ${ty}`, tx, ty, mx: tx + off * 0.7, my: (sy + ty) / 2 };
    }
    const mx = (sx + tx) / 2;
    return { d: `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`, tx, ty, mx, my: (sy + ty) / 2 - 9 };
  }
  const edgeColor = (e: SystemEdge) => e.planned ? "var(--obs-planned)" : !e.encrypted ? "var(--obs-critical)" : "var(--obs-data)";

  return (
    <div>
      {/* legend + filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14, alignItems: "center" }}>
        {(["safe", "watch", "at-risk"] as const).map((v) => (
          <span key={v} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
            <Dot color={verdictColor[v]} size={7} /> {verdictLabel[v]}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
          <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--obs-data)" strokeWidth="2" /></svg> Encrypted
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
          <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--obs-critical)" strokeWidth="2" /></svg> Unencrypted at rest
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
          <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--obs-planned)" strokeWidth="1.5" strokeDasharray="3 4" /></svg> Planned
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value as any)} className="obs-mono"
                  style={{ background: "var(--obs-panel-2)", color: "var(--obs-text)", border: "1px solid var(--obs-line)", borderRadius: 8, padding: "6px 10px", fontSize: 11 }}>
            <option value="all">all layers</option>
            {COL_ORDER.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-faint)" }}>hover a node to trace its flows</span>
        </div>
      </div>

      {/* the map */}
      <div className="obs-panel" style={{ padding: 6, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 940, display: "block" }} role="img" aria-label="Takeover system architecture map">
          <defs>
            <pattern id="obs-grid" width="46" height="46" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="var(--obs-line)" opacity=".45" />
            </pattern>
            <linearGradient id="obs-card" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#26262c" />
              <stop offset="0.42" stopColor="#1a1b20" />
              <stop offset="1" stopColor="#131316" />
            </linearGradient>
            <linearGradient id="obs-card-base" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#1f1f24" />
              <stop offset="1" stopColor="#151518" />
            </linearGradient>
            <linearGradient id="obs-card-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.075" />
              <stop offset="0.55" stopColor="#ffffff" stopOpacity="0.01" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="obs-vign" cx="50%" cy="0%" r="90%">
              <stop offset="0" stopColor="#1a1a1f" stopOpacity=".9" /><stop offset="60%" stopColor="#0c0c0e" stopOpacity="0" />
            </radialGradient>
            <filter id="obs-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.2" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect x="1" y="1" width={W - 2} height={H - 2} rx="16" fill="#0c0c0e" />
          <rect x="1" y="1" width={W - 2} height={H - 2} rx="16" fill="url(#obs-vign)" />
          <rect x="1" y="1" width={W - 2} height={H - 2} rx="16" fill="url(#obs-grid)" />

          {/* lanes + headers */}
          {COL_ORDER.map((l, i) => {
            const laneX = PAD_X + colW * i;
            const on = layerFilter === "all" || layerFilter === l;
            return (
              <g key={l} opacity={on ? 1 : 0.3} style={{ transition: "opacity .2s" }}>
                <rect x={laneX + 6} y={54} width={colW - 12} height={H - 54 - 14} rx="14"
                      fill="#ffffff" fillOpacity={i % 2 === 0 ? 0.011 : 0.004} />
                <text x={colX[l]} y={32} textAnchor="middle" className="obs-mono" fontSize="10.5" letterSpacing="2.5" fill="var(--obs-dim)">
                  {l.toUpperCase()}
                  <tspan fill="var(--obs-faint)">  {counts[l]}</tspan>
                </text>
                <text x={colX[l]} y={46} textAnchor="middle" fontSize="9.5" className="obs-mono" fill="var(--obs-faint)" letterSpacing="1">{COL_TITLE[l]}</text>
              </g>
            );
          })}

          {/* wires */}
          {manifest.edges.map((e) => {
            const g = geom(e);
            if (!g) return null;
            const color = edgeColor(e);
            const isActive = activeEdges ? activeEdges.has(e.id) : false;
            const dim = (activeEdges && !isActive) || (layerFilter !== "all" && byId[e.from].layer !== layerFilter && byId[e.to].layer !== layerFilter);
            return (
              <g key={e.id} style={{ cursor: "pointer", opacity: dim ? 0.06 : isActive ? 1 : 0.22, transition: "opacity .2s" }}
                 onClick={() => setSelEdge(e)} onMouseEnter={() => setHoverEdge(e.id)} onMouseLeave={() => setHoverEdge(null)}>
                <path d={g.d} fill="none" stroke="transparent" strokeWidth="20" />
                <path d={g.d} fill="none" stroke={color} strokeWidth={isActive ? 2 : 1.3}
                      strokeDasharray={e.planned ? "3 5" : undefined} strokeLinecap="round"
                      filter={isActive ? "url(#obs-glow)" : undefined} />
                {isActive && !e.planned && <path className="obs-wire" d={g.d} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />}
                {isActive && <circle cx={g.tx} cy={g.ty} r="3.4" fill={color} filter="url(#obs-glow)" />}
                {isActive && (
                  <g>
                    <rect x={g.mx - e.label.length * 3.05 - 7} y={g.my - 11} width={e.label.length * 6.1 + 14} height="18" rx="6"
                          fill="#0c0c0e" stroke="var(--obs-line-strong)" strokeWidth=".6" />
                    <text className="obs-mono" fontSize="9.5" fill="var(--obs-text)" textAnchor="middle" x={g.mx} y={g.my + 1.5}>{e.label}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* nodes */}
          {manifest.nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const c = verdictColor[n.verdict];
            const count = nodeFindings(n.id).length;
            const risk = nodeRisk(n.id);
            const lines = wrapLabel(n.label);
            const NH = lines.length > 1 ? 66 : 54;
            const left = p.x - NODE_W / 2, top = p.y - NH / 2;
            const dim = (activeNodes && !activeNodes.has(n.id)) || (layerFilter !== "all" && n.layer !== layerFilter);
            const focused = activeNodes ? activeNodes.has(n.id) : false;
            const riskC = risk >= 25 ? "var(--obs-critical)" : "var(--obs-high)";
            return (
              <g key={n.id} style={{ cursor: "pointer", opacity: dim ? 0.14 : 1, transition: "opacity .2s" }}
                 onClick={() => setSelNode(n)} onMouseEnter={() => setHoverNode(n.id)} onMouseLeave={() => setHoverNode(null)}
                 tabIndex={0} onKeyDown={(ev) => ev.key === "Enter" && setSelNode(n)}
                 role="button" aria-label={`${n.label}, ${verdictLabel[n.verdict]}, ${count} open findings`}>
                {focused && <rect x={left - 2.5} y={top - 2.5} width={NODE_W + 5} height={NH + 5} rx="10" fill="none" stroke={c} strokeOpacity=".22" strokeWidth="4" />}
                <rect x={left} y={top} width={NODE_W} height={NH} rx="8" fill="url(#obs-card-base)"
                      stroke={focused ? c : "#27272a"} strokeWidth="1"
                      strokeDasharray={n.planned ? "5 4" : undefined}
                      style={{ filter: focused ? "drop-shadow(0 4px 14px rgba(0,0,0,.5))" : "drop-shadow(0 1px 2px rgba(0,0,0,.55))", transition: "stroke .15s, filter .15s" }} />
                <rect x={left + 1} y={top + 1} width={NODE_W - 2} height={NH - 2} rx="7" fill="url(#obs-card-sheen)" pointerEvents="none" />
                <rect x={left + 8} y={top + 12} width="3.5" height={NH - 22} rx="1.5" fill={n.planned ? "var(--obs-planned)" : c} />
                {lines.map((ln, i) => (
                  <text key={i} x={left + 22} y={lines.length > 1 ? top + 24 + i * 16 : p.y - 2}
                        fontSize="13" fill="var(--obs-text)" fontFamily="var(--obs-body)" fontWeight="600">{ln}</text>
                ))}
                <text x={left + 22} y={top + NH - 12} fontSize="9" className="obs-mono" fill="var(--obs-faint)" letterSpacing="1.4">{n.layer.toUpperCase()}</text>
                {count > 0 && (
                  <g>
                    <circle cx={left + NODE_W - 17} cy={top + 17} r="10.5" fill={riskC} fillOpacity=".14" stroke={riskC} strokeWidth="1.1" />
                    <text x={left + NODE_W - 17} y={top + 20.5} textAnchor="middle" fontSize="10" className="obs-mono" fill={riskC}>{count}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── node dossier ─────────────────────────────────────────────────── */}
      <Modal open={!!selNode} onClose={() => setSelNode(null)}>
        {selNode && (
          <>
            <ModalHeader
              eyebrow={`${COL_TITLE[selNode.layer]} · ${selNode.tech}`}
              title={selNode.label}
              right={<Badge color={verdictColor[selNode.verdict]}>{verdictLabel[selNode.verdict]}</Badge>}
            />
            <div style={{ padding: "20px 28px" }}>
              <Field label="What this is">{selNode.detail}</Field>
              <Field label="Lives in" mono>{selNode.paths.join("  ·  ")}</Field>
              {selNode.owns.length > 0 && (
                <Field label="Data resting here">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selNode.owns.map((id) => {
                      const a = manifest.assets.find((x) => x.id === id);
                      return a ? <Badge key={id} color={sensColor[a.sensitivity]}>{a.name}</Badge> : null;
                    })}
                  </div>
                </Field>
              )}
              {nodeFindings(selNode.id).length > 0 && (
                <Field label="Open findings against this component">
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {nodeFindings(selNode.id).map((f) => (
                      <div key={f.id} className="obs-panel" style={{ padding: 14, borderLeft: `3px solid ${sevColor[f.severity]}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <strong style={{ fontSize: 13.5 }}>{f.title}</strong>
                          <Badge color={sevColor[f.severity]}>{f.severity}</Badge>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--obs-dim)", lineHeight: 1.6 }}>{f.fix}</div>
                      </div>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Wires touching this node">
                {manifest.edges.filter((e) => e.from === selNode.id || e.to === selNode.id).map((e) => (
                  <div key={e.id} className="obs-row" style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 8px", borderRadius: 8, fontSize: 13 }}
                       onClick={() => { setSelEdge(e); setSelNode(null); }}>
                    <Dot color={e.encrypted ? "var(--obs-data)" : "var(--obs-critical)"} size={6} />
                    <span className="obs-mono" style={{ fontSize: 11.5, color: "var(--obs-dim)" }}>
                      {(byId[e.from]?.label ?? e.from)} → {(byId[e.to]?.label ?? e.to)}
                    </span>
                    <span style={{ color: "var(--obs-faint)", fontSize: 12 }}>· {e.label}</span>
                  </div>
                ))}
              </Field>
            </div>
          </>
        )}
      </Modal>

      {/* ── wire dossier ─────────────────────────────────────────────────── */}
      <Modal open={!!selEdge} onClose={() => setSelEdge(null)}>
        {selEdge && (
          <>
            <ModalHeader
              eyebrow={selEdge.protocol}
              title={`${byId[selEdge.from]?.label} → ${byId[selEdge.to]?.label}`}
              right={
                <div style={{ display: "flex", gap: 8 }}>
                  <Badge color={selEdge.encrypted ? "var(--obs-safe)" : "var(--obs-critical)"}>{selEdge.encrypted ? "Encrypted" : "Plaintext"}</Badge>
                  <Badge color={selEdge.authenticated ? "var(--obs-safe)" : "var(--obs-critical)"}>{selEdge.authenticated ? "Authed" : "Open"}</Badge>
                </div>
              }
            />
            <div style={{ padding: "20px 28px" }}>
              <Field label="What travels on this wire">{selEdge.detail}</Field>
              {selEdge.carries.length > 0 && (
                <Field label="Data assets in flight">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selEdge.carries.map((id) => {
                      const a = manifest.assets.find((x) => x.id === id);
                      return a ? <Badge key={id} color={sensColor[a.sensitivity]}>{a.name}</Badge> : null;
                    })}
                  </div>
                </Field>
              )}
              {selEdge.planned && <Field label="Status"><Badge color="var(--obs-planned)">Planned — not yet in the codebase</Badge></Field>}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
