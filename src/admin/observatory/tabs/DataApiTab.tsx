import { useEffect, useState } from "react";
import { useFocus, clearFocus } from "../lib/focus";
import { manifest, DataAsset, ApiRoute } from "../data/manifest";
import {
  Badge, Dot, Modal, ModalHeader, Field,
  sensColor, verdictColor, verdictLabel,
} from "../components/ui";

/**
 * The answer to "what data is going to what table, and what API is going where."
 * Left: the data registry — every asset, its sensitivity, every place it rests.
 * Right: the route registry — every endpoint, its auth, what it reads/writes.
 */
export default function DataApiTab() {
  const [view, setView] = useState<"data" | "api">("data");
  const [asset, setAsset] = useState<DataAsset | null>(null);
  const [route, setRoute] = useState<ApiRoute | null>(null);
  const focus = useFocus();
  useEffect(() => {
    if (!focus || focus.tab !== "data") return;
    if (focus.kind === "asset") { const a = manifest.assets.find((x) => x.id === focus.id); if (a) { setView("data"); setAsset(a); clearFocus(); } }
    else if (focus.kind === "route") { const r = manifest.apis.find((x) => x.id === focus.id); if (r) { setView("api"); setRoute(r); clearFocus(); } }
  }, [focus]);

  const nodeLabel = (id: string) => manifest.nodes.find((n) => n.id === id)?.label ?? id;
  const rlsBadge = (rls?: string) =>
    !rls || rls === "n/a" ? null : (
      <Badge color={rls === "full" ? "var(--obs-safe)" : rls === "partial" ? "var(--obs-high)" : "var(--obs-critical)"}>
        RLS {rls}
      </Badge>
    );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className="obs-tab" data-active={view === "data"} onClick={() => setView("data")}>
          Data Registry · {manifest.assets.length}
        </button>
        <button className="obs-tab" data-active={view === "api"} onClick={() => setView("api")}>
          API Routes · {manifest.apis.length}
        </button>
      </div>

      {/* ── DATA REGISTRY ─────────────────────────────────────────────────── */}
      {view === "data" && (
        <div className="obs-panel" style={{ overflow: "hidden" }}>
          <div className="obs-mono" style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 2fr 1fr", gap: 12, padding: "12px 18px", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--obs-faint)", borderBottom: "1px solid var(--obs-line)" }}>
            <span>Asset</span><span>Sensitivity</span><span>Rests in</span><span>RLS</span>
          </div>
          {manifest.assets
            .slice()
            .sort((a, b) => ["secret", "pii", "internal", "public"].indexOf(a.sensitivity) - ["secret", "pii", "internal", "public"].indexOf(b.sensitivity))
            .map((a) => (
              <div key={a.id} className="obs-row" onClick={() => setAsset(a)}
                   style={{ display: "grid", gridTemplateColumns: "2.2fr 1fr 2fr 1fr", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--obs-line)", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
                  <div className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-faint)", marginTop: 3 }}>{a.shape.length > 56 ? a.shape.slice(0, 56) + "…" : a.shape}</div>
                </div>
                <div><Badge color={sensColor[a.sensitivity]}>{a.sensitivity}</Badge></div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {a.storedIn.map((s, i) => (
                    <span key={i} className="obs-mono" style={{ fontSize: 10.5, color: ["localstorage"].includes(s.nodeId) ? "var(--obs-critical)" : "var(--obs-dim)", border: "1px solid var(--obs-line)", borderRadius: 99, padding: "2px 8px" }}>
                      {nodeLabel(s.nodeId)}{s.table ? ` · ${s.table.split(",")[0]}` : ""}
                    </span>
                  ))}
                </div>
                <div>{rlsBadge(a.rls) ?? <span style={{ color: "var(--obs-faint)", fontSize: 12 }}>—</span>}</div>
              </div>
            ))}
        </div>
      )}

      {/* ── API ROUTES ────────────────────────────────────────────────────── */}
      {view === "api" && (
        <div className="obs-panel" style={{ overflow: "hidden" }}>
          <div className="obs-mono" style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 1.4fr 1.6fr 0.9fr", gap: 12, padding: "12px 18px", fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--obs-faint)", borderBottom: "1px solid var(--obs-line)" }}>
            <span>Method</span><span>Route</span><span>Auth</span><span>Upstream</span><span>Verdict</span>
          </div>
          {manifest.apis.map((r) => (
            <div key={r.id} className="obs-row" onClick={() => setRoute(r)}
                 style={{ display: "grid", gridTemplateColumns: "0.7fr 2.4fr 1.4fr 1.6fr 0.9fr", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--obs-line)", alignItems: "center" }}>
              <span className="obs-mono" style={{ fontSize: 11.5, color: "var(--obs-data)", fontWeight: 600 }}>{r.method}</span>
              <span className="obs-mono" style={{ fontSize: 12.5 }}>{r.path}</span>
              <span style={{ fontSize: 12.5, color: r.auth === "none" ? "var(--obs-high)" : "var(--obs-dim)" }}>{r.auth}</span>
              <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-faint)" }}>{r.upstream ?? "—"}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Dot color={verdictColor[r.verdict]} size={7} />
                <span style={{ fontSize: 12, color: "var(--obs-dim)" }}>{verdictLabel[r.verdict]}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── asset dossier ─────────────────────────────────────────────────── */}
      <Modal open={!!asset} onClose={() => setAsset(null)}>
        {asset && (
          <>
            <ModalHeader eyebrow={`Data asset · ${asset.id}`} title={asset.name}
                         right={<div style={{ display: "flex", gap: 8 }}><Badge color={sensColor[asset.sensitivity]}>{asset.sensitivity}</Badge>{rlsBadge(asset.rls)}</div>} />
            <div style={{ padding: "20px 28px" }}>
              <Field label="Shape" mono>{asset.shape}</Field>
              <Field label="Everywhere this data rests">
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {asset.storedIn.map((s, i) => (
                    <div key={i} className="obs-panel" style={{ padding: 14, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{nodeLabel(s.nodeId)}</div>
                        <div className="obs-mono" style={{ fontSize: 11, color: "var(--obs-dim)", marginTop: 3 }}>
                          {s.medium}{s.table ? ` · tables: ${s.table}` : ""}
                        </div>
                      </div>
                      {s.ttl && <Badge color="var(--obs-dim)">retained: {s.ttl}</Badge>}
                    </div>
                  ))}
                </div>
              </Field>
              <Field label="Wires it travels on">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {asset.flowsThrough.map((eid) => {
                    const e = manifest.edges.find((x) => x.id === eid);
                    return e ? (
                      <span key={eid} className="obs-mono" style={{ fontSize: 11, color: e.encrypted ? "var(--obs-dim)" : "var(--obs-critical)", border: "1px solid var(--obs-line)", borderRadius: 99, padding: "3px 9px" }}>
                        {nodeLabel(e.from)} → {nodeLabel(e.to)}
                      </span>
                    ) : null;
                  })}
                </div>
              </Field>
              <Field label="Notes">{asset.notes}</Field>
            </div>
          </>
        )}
      </Modal>

      {/* ── route dossier ─────────────────────────────────────────────────── */}
      <Modal open={!!route} onClose={() => setRoute(null)}>
        {route && (
          <>
            <ModalHeader eyebrow={`${route.method} · served by ${nodeLabel(route.nodeId)}`} title={route.path}
                         right={<Badge color={verdictColor[route.verdict]}>{verdictLabel[route.verdict]}</Badge>} />
            <div style={{ padding: "20px 28px" }}>
              <Field label="Auth"><Badge color={route.auth === "none" ? "var(--obs-high)" : "var(--obs-safe)"}>{route.auth}</Badge></Field>
              {route.upstream && <Field label="Proxies to" mono>{route.upstream}</Field>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Field label="Reads">
                  {route.reads.length === 0 ? <span style={{ color: "var(--obs-faint)" }}>nothing sensitive</span> :
                    route.reads.map((id) => { const a = manifest.assets.find((x) => x.id === id); return a ? <div key={id} style={{ marginBottom: 6 }}><Badge color={sensColor[a.sensitivity]}>{a.name}</Badge></div> : null; })}
                </Field>
                <Field label="Writes">
                  {route.writes.length === 0 ? <span style={{ color: "var(--obs-faint)" }}>nothing</span> :
                    route.writes.map((id) => { const a = manifest.assets.find((x) => x.id === id); return a ? <div key={id} style={{ marginBottom: 6 }}><Badge color={sensColor[a.sensitivity]}>{a.name}</Badge></div> : null; })}
                </Field>
              </div>
              <Field label="Notes">{route.notes}</Field>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
