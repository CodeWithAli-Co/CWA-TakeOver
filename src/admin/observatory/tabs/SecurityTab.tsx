import { useMemo, useState } from "react";
import { manifest, Finding, Severity } from "../data/manifest";
import { SEVERITY_ORDER } from "../lib/scoring";
import { Badge, Modal, ModalHeader, Field, Eyebrow, sevColor, sensColor } from "../components/ui";

/**
 * Threat Board — every known weakness, ranked, filterable, and actionable.
 * Each finding opens a dossier: what goes wrong, how we know, exactly what to
 * do, and how long it takes. "Pain points" with a remediation attached.
 */
export default function SecurityTab() {
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [sel, setSel] = useState<Finding | null>(null);

  const filtered = useMemo(() => {
    return manifest.findings
      .filter((f) => (statusFilter === "open" ? f.status === "open" : true))
      .filter((f) => (sevFilter === "all" ? true : f.severity === sevFilter))
      .filter((f) => (nodeFilter === "all" ? true : f.nodeIds.includes(nodeFilter)))
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
  }, [sevFilter, nodeFilter, statusFilter]);

  const nodeLabel = (id: string) => manifest.nodes.find((n) => n.id === id)?.label ?? id;
  const effortColor = { hours: "var(--obs-safe)", days: "var(--obs-medium)", "week+": "var(--obs-high)" } as const;

  return (
    <div>
      {/* filters */}
      <div className="obs-panel" style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <span className="obs-eyebrow" style={{ marginRight: 4 }}>Severity</span>
        {(["all", ...SEVERITY_ORDER.filter(s => s !== "info")] as const).map((s) => (
          <button key={s} className="obs-tab" data-active={sevFilter === s} onClick={() => setSevFilter(s as any)}
                  style={s !== "all" ? { color: sevFilter === s ? sevColor[s as Severity] : undefined } : undefined}>
            {s}
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: "var(--obs-line)" }} />
        <span className="obs-eyebrow" style={{ marginRight: 4 }}>Component</span>
        <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)}
                className="obs-mono"
                style={{ background: "var(--obs-panel-2)", color: "var(--obs-text)", border: "1px solid var(--obs-line)", borderRadius: 8, padding: "7px 10px", fontSize: 11.5 }}>
          <option value="all">all components</option>
          {manifest.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <button className="obs-tab" data-active={statusFilter === "all"} onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")} style={{ marginLeft: "auto" }}>
          {statusFilter === "open" ? "showing open" : "showing all"}
        </button>
      </div>

      {/* board */}
      {filtered.length === 0 ? (
        <div className="obs-panel" style={{ padding: 40, textAlign: "center", color: "var(--obs-dim)" }}>
          No findings match this filter. Widen it, or enjoy the moment.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
          {filtered.map((f) => (
            <button key={f.id} className="obs-panel obs-panel-hover" onClick={() => setSel(f)}
                    style={{ textAlign: "left", padding: 18, borderTop: `3px solid ${sevColor[f.severity]}`, cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <Badge color={sevColor[f.severity]}>{f.severity}</Badge>
                <Badge color={effortColor[f.effort]}>fix: {f.effort}</Badge>
              </div>
              <div className="obs-display" style={{ fontSize: 18, lineHeight: 1.25 }}>{f.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--obs-dim)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {f.risk}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto" }}>
                {f.nodeIds.map((id) => (
                  <span key={id} className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-faint)", border: "1px solid var(--obs-line)", borderRadius: 99, padding: "2px 8px" }}>
                    {nodeLabel(id)}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* dossier */}
      <Modal open={!!sel} onClose={() => setSel(null)}>
        {sel && (
          <>
            <ModalHeader
              eyebrow={`Finding · ${sel.id} · ${sel.status}`}
              title={sel.title}
              right={<Badge color={sevColor[sel.severity]}>{sel.severity}</Badge>}
            />
            <div style={{ padding: "20px 28px" }}>
              <Field label="What actually goes wrong">{sel.risk}</Field>
              <Field label="How we know" mono>{sel.evidence}</Field>
              <div className="obs-panel" style={{ padding: 18, borderLeft: "3px solid var(--obs-safe)", marginBottom: 18 }}>
                <Eyebrow>The fix</Eyebrow>
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>{sel.fix}</div>
                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Badge color={effortColor[sel.effort]}>effort: {sel.effort}</Badge>
                </div>
              </div>
              <Field label="Components implicated">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {sel.nodeIds.map((id) => <Badge key={id} color="var(--obs-dim)">{nodeLabel(id)}</Badge>)}
                </div>
              </Field>
              {sel.assetIds.length > 0 && (
                <Field label="Data at stake">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {sel.assetIds.map((id) => {
                      const a = manifest.assets.find((x) => x.id === id);
                      return a ? <Badge key={id} color={sensColor[a.sensitivity]}>{a.name}</Badge> : null;
                    })}
                  </div>
                </Field>
              )}
              {/* related scenarios */}
              {manifest.scenarios.filter((s) => s.retrieval.some((r) => r.source.includes(sel.id)) || s.assetsAffected.some((a) => sel.assetIds.includes(a))).length > 0 && (
                <Field label="Scenarios that move this finding">
                  {manifest.scenarios
                    .filter((s) => s.retrieval.some((r) => r.source.includes(sel.id)) || s.assetsAffected.some((a) => sel.assetIds.includes(a)))
                    .map((s) => (
                      <div key={s.id} style={{ fontSize: 13, color: "var(--obs-scenario)", marginBottom: 4 }}>↳ {s.title}</div>
                    ))}
                </Field>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
