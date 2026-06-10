import { useMemo, useState } from "react";
import { manifest, SystemNode, SystemEdge } from "../data/manifest";
import { nodeFindings, nodeRisk } from "../lib/scoring";
import {
  Badge, Dot, Modal, ModalHeader, Field,
  verdictColor, verdictLabel, sevColor, sensColor,
} from "../components/ui";

/**
 * The signature surface: Takeover drawn as a living circuit. Pulses run along
 * every wire that carries data; planned infrastructure is sketched in dashes.
 * Click anything — node or wire — for the full dossier.
 */

const W = 1000, H = 640;
const px = (x: number) => 60 + (x / 100) * (W - 200);
const py = (y: number) => 50 + (y / 100) * (H - 110);

const LAYER_LABEL: Record<string, string> = {
  client: "Client · operator machine",
  core: "Rust core",
  edge: "Edge · your servers",
  persistence: "Persistence",
  external: "External SaaS & models",
  planned: "Planned",
};

export default function SystemMapTab() {
  const [selNode, setSelNode] = useState<SystemNode | null>(null);
  const [selEdge, setSelEdge] = useState<SystemEdge | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const byId = useMemo(() => Object.fromEntries(manifest.nodes.map((n) => [n.id, n])), []);
  const connected = (nodeId: string) =>
    manifest.edges.filter((e) => e.from === nodeId || e.to === nodeId).map((e) => e.id);
  const hot = hover ? new Set([hover, ...connected(hover)]) : null;

  return (
    <div>
      {/* legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14, alignItems: "center" }}>
        {(["safe", "watch", "at-risk"] as const).map((v) => (
          <span key={v} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
            <Dot color={verdictColor[v]} size={7} /> {verdictLabel[v]}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
          <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--obs-planned)" strokeWidth="1.5" strokeDasharray="3 4" /></svg>
          Planned
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--obs-dim)" }}>
          <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke="var(--obs-critical)" strokeWidth="2" /></svg>
          Unencrypted at rest
        </span>
        <span className="obs-mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--obs-faint)" }}>
          click any node or wire · hover to trace connections
        </span>
      </div>

      {/* the map */}
      <div className="obs-panel" style={{ padding: 8, overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 760, display: "block" }} role="img" aria-label="Takeover system architecture map">
          {/* faint grid */}
          <defs>
            <pattern id="obs-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--obs-line)" strokeWidth=".4" opacity=".5" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#obs-grid)" rx="10" />

          {/* wires */}
          {manifest.edges.map((e) => {
            const a = byId[e.from], b = byId[e.to];
            if (!a || !b) return null;
            const x1 = px(a.x), y1 = py(a.y), x2 = px(b.x), y2 = py(b.y);
            const mx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
            const base = e.planned ? "var(--obs-planned)" : !e.encrypted ? "var(--obs-critical)" : "var(--obs-data)";
            const dim = hot && !hot.has(e.id);
            return (
              <g key={e.id} style={{ cursor: "pointer", opacity: dim ? 0.12 : 1, transition: "opacity .2s" }}
                 onClick={() => setSelEdge(e)}
                 onMouseEnter={() => setHover(e.from)} onMouseLeave={() => setHover(null)}>
                <path d={d} fill="none" stroke="transparent" strokeWidth="16" />
                <path d={d} fill="none" stroke={base} strokeWidth={e.planned ? 1.2 : 1.6}
                      strokeDasharray={e.planned ? "3 5" : undefined} opacity={e.planned ? 0.7 : 0.45} />
                {!e.planned && (
                  <path className="obs-wire" d={d} fill="none" stroke={base} strokeWidth="2.4" strokeLinecap="round" />
                )}
                <text className="obs-mono" fontSize="9" fill="var(--obs-faint)" textAnchor="middle"
                      x={mx} y={(y1 + y2) / 2 - 7}>{e.label}</text>
              </g>
            );
          })}

          {/* nodes */}
          {manifest.nodes.map((n) => {
            const x = px(n.x), y = py(n.y);
            const c = verdictColor[n.verdict];
            const risk = nodeRisk(n.id);
            const dim = hot && !hot.has(n.id);
            return (
              <g key={n.id} style={{ cursor: "pointer", opacity: dim ? 0.18 : 1, transition: "opacity .2s" }}
                 onClick={() => setSelNode(n)}
                 onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                 tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setSelNode(n)}
                 role="button" aria-label={`${n.label}, ${verdictLabel[n.verdict]}`}>
                <rect x={x - 78} y={y - 26} width="156" height="52" rx="11"
                      fill="var(--obs-panel-2)"
                      stroke={n.planned ? "var(--obs-planned)" : c}
                      strokeWidth={n.verdict === "at-risk" ? 1.8 : 1.2}
                      strokeDasharray={n.planned ? "4 4" : undefined} />
                {risk > 0 && (
                  <g>
                    <circle cx={x + 70} cy={y - 22} r="10" fill="var(--obs-bg)" stroke={risk >= 25 ? "var(--obs-critical)" : "var(--obs-high)"} strokeWidth="1.2" />
                    <text x={x + 70} y={y - 18.5} textAnchor="middle" fontSize="10" className="obs-mono"
                          fill={risk >= 25 ? "var(--obs-critical)" : "var(--obs-high)"}>{nodeFindings(n.id).length}</text>
                  </g>
                )}
                <circle cx={x - 64} cy={y - 8} r="3.5" fill={c} />
                <text x={x - 54} y={y - 4} fontSize="12.5" fill="var(--obs-text)" fontFamily="var(--obs-body)" fontWeight="600">
                  {n.label.length > 22 ? n.label.slice(0, 22) + "…" : n.label}
                </text>
                <text x={x - 64} y={y + 13} fontSize="9.5" className="obs-mono" fill="var(--obs-faint)">
                  {LAYER_LABEL[n.layer].split(" ·")[0].toUpperCase()}
                </text>
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
              eyebrow={`${LAYER_LABEL[selNode.layer]} · ${selNode.tech}`}
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
                      {(manifest.nodes.find(n => n.id === e.from)?.label ?? e.from)} → {(manifest.nodes.find(n => n.id === e.to)?.label ?? e.to)}
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
              {selEdge.planned && (
                <Field label="Status">
                  <Badge color="var(--obs-planned)">Planned — not yet in the codebase</Badge>
                </Field>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
