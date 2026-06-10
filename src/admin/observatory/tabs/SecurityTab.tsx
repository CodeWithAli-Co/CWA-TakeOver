import { useMemo, useState } from "react";
import { manifest, Finding, Severity } from "../data/manifest";
import { SEVERITY_ORDER } from "../lib/scoring";
import { Badge, Modal, ModalHeader, Field, Eyebrow, sevColor, sensColor } from "../components/ui";
import {
  FindingStatus, useTriageVersion, effectiveStatus, triageOf, setTriage, resetTriage, isTriaged, triagedCount,
} from "../lib/triage";
import { downloadRemediationPlan } from "../lib/remediation";

/**
 * Threat Board — every known weakness, ranked, filterable, and now WORKABLE.
 * Each finding opens a dossier: what goes wrong, how we know, exactly what to
 * do — plus triage controls (status, owner, target) that re-score the whole
 * dashboard live and export to a shareable remediation plan.
 */
const STATUS_META: Record<FindingStatus, { label: string; color: string }> = {
  open: { label: "Open", color: "var(--obs-high)" },
  mitigated: { label: "Mitigated", color: "var(--obs-safe)" },
  accepted: { label: "Accepted", color: "var(--obs-low)" },
};

export default function SecurityTab() {
  const v = useTriageVersion(); // re-render + re-score when triage changes
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [selId, setSelId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return manifest.findings
      .filter((f) => (statusFilter === "open" ? effectiveStatus(f.id) === "open" : true))
      .filter((f) => (sevFilter === "all" ? true : f.severity === sevFilter))
      .filter((f) => (nodeFilter === "all" ? true : f.nodeIds.includes(nodeFilter)))
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sevFilter, nodeFilter, statusFilter, v]);

  const sel: Finding | null = selId ? manifest.findings.find((f) => f.id === selId) ?? null : null;
  const nodeLabel = (id: string) => manifest.nodes.find((n) => n.id === id)?.label ?? id;
  const effortColor = { hours: "var(--obs-safe)", days: "var(--obs-medium)", "week+": "var(--obs-high)" } as const;
  const nTriaged = triagedCount();

  return (
    <div>
      {/* filters + actions */}
      <div className="obs-panel" style={{ padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <span className="obs-eyebrow" style={{ marginRight: 4 }}>Severity</span>
        {(["all", ...SEVERITY_ORDER.filter((s) => s !== "info")] as const).map((s) => (
          <button key={s} className="obs-tab" data-active={sevFilter === s} onClick={() => setSevFilter(s as any)}
                  style={s !== "all" ? { color: sevFilter === s ? sevColor[s as Severity] : undefined } : undefined}>
            {s}
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: "var(--obs-line)" }} />
        <span className="obs-eyebrow" style={{ marginRight: 4 }}>Component</span>
        <select value={nodeFilter} onChange={(e) => setNodeFilter(e.target.value)} className="obs-mono"
                style={{ background: "var(--obs-panel-2)", color: "var(--obs-text)", border: "1px solid var(--obs-line)", borderRadius: 8, padding: "7px 10px", fontSize: 11.5 }}>
          <option value="all">all components</option>
          {manifest.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {nTriaged > 0 && <span className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-safe)" }}>{nTriaged} triaged</span>}
          <button className="obs-tab" data-active={statusFilter === "all"} onClick={() => setStatusFilter(statusFilter === "open" ? "all" : "open")}>
            {statusFilter === "open" ? "showing open" : "showing all"}
          </button>
          <button className="obs-tab" onClick={() => downloadRemediationPlan()} title="Download a prioritized Markdown plan"
                  style={{ borderColor: "var(--obs-line-strong)", color: "var(--obs-text)" }}>
            export plan ↓
          </button>
        </div>
      </div>

      {/* board */}
      {filtered.length === 0 ? (
        <div className="obs-panel" style={{ padding: 40, textAlign: "center", color: "var(--obs-dim)" }}>
          No findings match this filter. Widen it, or enjoy the moment.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 12 }}>
          {filtered.map((f) => {
            const st = effectiveStatus(f.id);
            const closed = st !== "open";
            return (
              <button key={f.id} className="obs-panel obs-panel-hover" onClick={() => setSelId(f.id)}
                      style={{ textAlign: "left", padding: 18, borderTop: `3px solid ${sevColor[f.severity]}`, cursor: "pointer", color: "inherit", display: "flex", flexDirection: "column", gap: 10, opacity: closed ? 0.62 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <Badge color={sevColor[f.severity]}>{f.severity}</Badge>
                  <Badge color={STATUS_META[st].color}>{closed ? `✓ ${STATUS_META[st].label}` : `fix: ${f.effort}`}</Badge>
                </div>
                <div className="obs-display" style={{ fontSize: 18, lineHeight: 1.25, textDecoration: closed ? "line-through" : "none", textDecorationColor: "var(--obs-faint)" }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "var(--obs-dim)", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {f.risk}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto", alignItems: "center" }}>
                  {triageOf(f.id).owner && <span className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-safe)" }}>@{triageOf(f.id).owner}</span>}
                  {f.nodeIds.map((id) => (
                    <span key={id} className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-faint)", border: "1px solid var(--obs-line)", borderRadius: 99, padding: "2px 8px" }}>
                      {nodeLabel(id)}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* dossier */}
      <Modal open={!!sel} onClose={() => setSelId(null)}>
        {sel && (
          <>
            <ModalHeader
              eyebrow={`Finding · ${sel.id} · ${effectiveStatus(sel.id)}`}
              title={sel.title}
              right={<Badge color={sevColor[sel.severity]}>{sel.severity}</Badge>}
            />
            <div style={{ padding: "20px 28px" }}>
              {/* triage control */}
              <div className="obs-panel" style={{ padding: 16, marginBottom: 18, background: "var(--obs-panel-2)" }}>
                <Eyebrow>Triage</Eyebrow>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 8 }}>
                  {(Object.keys(STATUS_META) as FindingStatus[]).map((s) => {
                    const active = effectiveStatus(sel.id) === s;
                    return (
                      <button key={s} className="obs-tab" data-active={active} onClick={() => setTriage(sel.id, { status: s })}
                              style={{ color: active ? STATUS_META[s].color : undefined, borderColor: active ? STATUS_META[s].color : undefined }}>
                        {STATUS_META[s].label}
                      </button>
                    );
                  })}
                  {isTriaged(sel.id) && (
                    <button className="obs-tab" onClick={() => resetTriage(sel.id)} style={{ marginLeft: "auto", color: "var(--obs-faint)" }}>
                      revert to audit
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
                    <span className="obs-eyebrow">Owner</span>
                    <input value={triageOf(sel.id).owner ?? ""} onChange={(e) => setTriage(sel.id, { owner: e.target.value })} placeholder="who owns this"
                           className="obs-mono" style={{ background: "var(--obs-bg)", color: "var(--obs-text)", border: "1px solid var(--obs-line)", borderRadius: 8, padding: "7px 10px", fontSize: 12 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 160px" }}>
                    <span className="obs-eyebrow">Target date</span>
                    <input type="date" value={triageOf(sel.id).target ?? ""} onChange={(e) => setTriage(sel.id, { target: e.target.value })}
                           className="obs-mono" style={{ background: "var(--obs-bg)", color: "var(--obs-text)", border: "1px solid var(--obs-line)", borderRadius: 8, padding: "7px 10px", fontSize: 12 }} />
                  </label>
                </div>
              </div>

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
