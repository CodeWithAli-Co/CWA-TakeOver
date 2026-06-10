import { useEffect, useState } from "react";
import { useFocus, clearFocus, requestFocus } from "../lib/focus";
import { openInEditor, parseRef } from "../lib/code";
import { manifest, Scenario } from "../data/manifest";
import { Badge, Dot, Eyebrow, Modal, ModalHeader, Field, sensColor } from "../components/ui";

/**
 * The what-if engine. Pick a swap — "Redis instead of localStorage" — and the
 * Observatory answers like a RAG system: it retrieves the evidence from its own
 * map, threat board, and registry, shows the deltas, and renders the blast
 * radius: every node, file, API, and asset the change touches.
 */

const DELTA_AXES = [
  { key: "security", label: "Security" },
  { key: "performance", label: "Performance" },
  { key: "complexity", label: "Complexity cost" },
  { key: "cost", label: "Infra cost" },
] as const;

const CHANGE_COLOR: Record<string, string> = {
  added: "var(--obs-safe)", removed: "var(--obs-critical)", rewired: "var(--obs-scenario)",
  modified: "var(--obs-medium)", unchanged: "var(--obs-faint)",
};

function DeltaBar({ value, label }: { value: number; label: string }) {
  // -5..+5; for complexity/cost, negative numbers shown as red (more burden)
  const pct = (Math.abs(value) / 5) * 50;
  const positive = value >= 0;
  const color = positive ? "var(--obs-safe)" : "var(--obs-critical)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12.5 }}>{label}</span>
        <span className="obs-mono" style={{ fontSize: 12, color }}>{value > 0 ? `+${value}` : value}</span>
      </div>
      <div style={{ position: "relative", height: 5, background: "var(--obs-line)", borderRadius: 99 }}>
        <div style={{ position: "absolute", left: "50%", top: -2, bottom: -2, width: 1, background: "var(--obs-line-strong)" }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0, borderRadius: 99, background: color,
          left: positive ? "50%" : `${50 - pct}%`, width: `${pct}%`, transition: "all .5s ease",
        }} />
      </div>
    </div>
  );
}

export default function ScenariosTab() {
  const [selId, setSelId] = useState(manifest.scenarios[0]?.id);
  const [impactModal, setImpactModal] = useState<Scenario["impacts"][number] | null>(null);
  const focus = useFocus();
  useEffect(() => {
    if (focus && focus.tab === "scenarios" && focus.kind === "scenario" && manifest.scenarios.some((x) => x.id === focus.id)) {
      setSelId(focus.id); clearFocus();
    }
  }, [focus]);
  const s = manifest.scenarios.find((x) => x.id === selId)!;
  const nodeLabel = (id: string) => manifest.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 14, alignItems: "start" }}>
      {/* ── scenario picker ──────────────────────────────────────────────── */}
      <aside style={{ display: "flex", flexDirection: "column", gap: 10, position: "sticky", top: 16 }}>
        <Eyebrow>What if we…</Eyebrow>
        {manifest.scenarios.map((sc) => (
          <button key={sc.id} className="obs-panel obs-panel-hover" onClick={() => setSelId(sc.id)}
                  style={{
                    textAlign: "left", padding: 16, cursor: "pointer", color: "inherit",
                    borderColor: sc.id === selId ? "var(--obs-scenario)" : undefined,
                    background: sc.id === selId ? "var(--obs-panel-2)" : undefined,
                  }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{sc.title}</span>
              {sc.recommended && <Dot color="var(--obs-safe)" size={7} />}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--obs-dim)", lineHeight: 1.5 }}>
              {sc.swap.from} <span style={{ color: "var(--obs-scenario)" }}>→</span> {sc.swap.to}
            </div>
          </button>
        ))}
        <div style={{ fontSize: 11.5, color: "var(--obs-faint)", lineHeight: 1.6, padding: "4px 2px" }}>
          <Dot color="var(--obs-safe)" size={7} /> = recommended now. Add scenarios by appending to
          <span className="obs-mono"> manifest.scenarios</span> — the engine renders them automatically.
        </div>
      </aside>

      {/* ── scenario detail ──────────────────────────────────────────────── */}
      <div key={s.id} className="obs-rise" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* header */}
        <section className="obs-panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <Eyebrow>Scenario · effort {s.effort}{s.recommended ? " · recommended" : ""}</Eyebrow>
              <h2 className="obs-display" style={{ fontSize: 30, margin: "2px 0 8px", fontStyle: "italic" }}>{s.question}</h2>
              <div className="obs-mono" style={{ fontSize: 12, color: "var(--obs-dim)" }}>
                {s.swap.from} <span style={{ color: "var(--obs-scenario)" }}>⇢</span> {s.swap.to}
              </div>
            </div>
            <Badge color={s.recommended ? "var(--obs-safe)" : "var(--obs-dim)"}>{s.recommended ? "Do it" : "Hold"}</Badge>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.75, color: "var(--obs-text)", margin: "16px 0 0", maxWidth: 720 }}>
            {s.narrative}
          </p>
        </section>

        {/* deltas + retrieval */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14 }}>
          <section className="obs-panel" style={{ padding: 20 }}>
            <Eyebrow>If adopted, the needles move</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
              {DELTA_AXES.map((a) => <DeltaBar key={a.key} value={s.verdictDelta[a.key]} label={a.label} />)}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--obs-faint)", marginTop: 14, lineHeight: 1.6 }}>
              Scored −5…+5 against today's system. Positive complexity/cost means the system gets simpler/cheaper to run.
            </div>
          </section>

          <section className="obs-panel" style={{ padding: 20 }}>
            <Eyebrow>Retrieved evidence · pulled from this Observatory</Eyebrow>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {s.retrieval.map((r, i) => {
                const fm = r.source.match(/\b(f-[a-z0-9-]+)\b/);
                const sm = r.source.match(/\b(s-[a-z0-9-]+)\b/);
                const go = fm ? () => requestFocus("finding", fm[1]) : sm ? () => requestFocus("scenario", sm[1]) : undefined;
                return (
                  <div key={i} style={{ borderLeft: "2px solid var(--obs-scenario)", paddingLeft: 12 }}>
                    <button disabled={!go} onClick={go} className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-scenario)", letterSpacing: ".08em", marginBottom: 3, background: "transparent", border: "none", padding: 0, cursor: go ? "pointer" : "default", textAlign: "left" }}>{r.source}{go ? " →" : ""}</button>
                    <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--obs-dim)" }}>{r.insight}</div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* blast radius */}
        <section className="obs-panel" style={{ padding: 20 }}>
          <Eyebrow>Blast radius · what this change touches</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10, marginTop: 12 }}>
            {s.impacts.map((imp) => (
              <button key={imp.nodeId} className="obs-panel obs-panel-hover" onClick={() => setImpactModal(imp)}
                      style={{ textAlign: "left", padding: 14, cursor: "pointer", color: "inherit", borderLeft: `3px solid ${CHANGE_COLOR[imp.change]}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{nodeLabel(imp.nodeId)}</span>
                  <Badge color={CHANGE_COLOR[imp.change]}>{imp.change}</Badge>
                </div>
                <div style={{ fontSize: 12, color: "var(--obs-dim)", lineHeight: 1.55 }}>{imp.note}</div>
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18 }}>
            <div>
              <Eyebrow>API routes affected</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {s.apisAffected.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--obs-faint)" }}>none</span> :
                  s.apisAffected.map((id) => {
                    const r = manifest.apis.find((x) => x.id === id);
                    return r ? <button key={id} onClick={() => requestFocus("route", id)} className="obs-mono" style={{ fontSize: 11, border: "1px solid var(--obs-line)", borderRadius: 6, padding: "3px 9px", color: "var(--obs-data)", background: "transparent", cursor: "pointer" }}>{r.method} {r.path} →</button> : null;
                  })}
              </div>
            </div>
            <div>
              <Eyebrow>Data assets affected</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                {s.assetsAffected.length === 0 ? <span style={{ fontSize: 12.5, color: "var(--obs-faint)" }}>none</span> :
                  s.assetsAffected.map((id) => {
                    const a = manifest.assets.find((x) => x.id === id);
                    return a ? <button key={id} onClick={() => requestFocus("asset", id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}><Badge color={sensColor[a.sensitivity]}>{a.name} →</Badge></button> : null;
                  })}
              </div>
            </div>
          </div>
        </section>

        {/* migration plan */}
        <section className="obs-panel" style={{ padding: 20 }}>
          <Eyebrow>Migration order</Eyebrow>
          <ol style={{ margin: "12px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {s.migration.map((step, i) => (
              <li key={i} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span className="obs-display" style={{ fontStyle: "italic", color: "var(--obs-scenario)", fontSize: 18, minWidth: 22 }}>{i + 1}.</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.6 }}>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* impact file modal */}
      <Modal open={!!impactModal} onClose={() => setImpactModal(null)}>
        {impactModal && (
          <>
            <ModalHeader eyebrow={`Impact · ${impactModal.change}`} title={nodeLabel(impactModal.nodeId)}
                         right={<Badge color={CHANGE_COLOR[impactModal.change]}>{impactModal.change}</Badge>} />
            <div style={{ padding: "20px 28px" }}>
              <Field label="What changes here">{impactModal.note}</Field>
              <Field label="Files in the diff" mono>
                {impactModal.files.length === 0 ? "No file changes — behavior shifts around this node." :
                  impactModal.files.map((f) => {
                    const ref = /\(new\)/.test(f) ? null : parseRef(f);
                    return ref
                      ? <button key={f} onClick={() => openInEditor(ref)} style={{ display: "block", padding: "3px 0", background: "transparent", border: "none", color: "var(--obs-data)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontSize: "inherit" }}>{f} ↗</button>
                      : <div key={f} style={{ padding: "3px 0" }}>{f}</div>;
                  })}
              </Field>
              <button className="obs-tab" onClick={() => { requestFocus("node", impactModal.nodeId); setImpactModal(null); }} style={{ marginTop: 8 }}>Show {nodeLabel(impactModal.nodeId)} on the map →</button>
            </div>
          </>
        )}
      </Modal>

      <style>{`@media (max-width: 880px) { .obs-root [style*="grid-template-columns: 300px"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
