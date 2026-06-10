import { useEffect, useMemo, useState } from "react";
import { manifest, Finding, Severity } from "../data/manifest";
import { SEVERITY_ORDER } from "../lib/scoring";
import { Badge, Modal, ModalHeader, Field, Eyebrow, sevColor, sensColor } from "../components/ui";
import {
  FindingStatus, useTriageVersion, effectiveStatus, triageOf, setTriage, resetTriage, isTriaged, triagedCount,
} from "../lib/triage";
import { downloadRemediationPlan } from "../lib/remediation";
import CodeViewer from "../components/CodeViewer";
import { extractRefs, refsFromPaths, readCode, extractAnnotations, parseRef, deriveLocators, LineAnnotation } from "../lib/code";
import { askAxonForPlan } from "../lib/axon";
import { useFocus, clearFocus, requestFocus } from "../lib/focus";
import Markdown from "../components/Markdown";

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
  const focus = useFocus();
  useEffect(() => {
    if (focus && focus.tab === "security" && focus.kind === "finding" && manifest.findings.some((f) => f.id === focus.id)) {
      setSelId(focus.id); clearFocus();
    }
  }, [focus]);

  const filtered = useMemo(() => {
    return manifest.findings
      .filter((f) => (statusFilter === "open" ? effectiveStatus(f.id) === "open" : true))
      .filter((f) => (sevFilter === "all" ? true : f.severity === sevFilter))
      .filter((f) => (nodeFilter === "all" ? true : f.nodeIds.includes(nodeFilter)))
      .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sevFilter, nodeFilter, statusFilter, v]);

  const sel: Finding | null = selId ? manifest.findings.find((f) => f.id === selId) ?? null : null;
  const codeRefs = sel
    ? (extractRefs(sel.evidence).length
        ? extractRefs(sel.evidence)
        : refsFromPaths(sel.nodeIds.flatMap((id) => manifest.nodes.find((n) => n.id === id)?.paths ?? [])))
    : [];
  const [axonText, setAxonText] = useState("");
  const [axonLoading, setAxonLoading] = useState(false);
  const [axonError, setAxonError] = useState<string | null>(null);
  const [axonChanges, setAxonChanges] = useState<LineAnnotation[]>([]);
  useEffect(() => { setAxonText(""); setAxonError(null); setAxonLoading(false); setAxonChanges([]); }, [selId]);
  const problemAnns: LineAnnotation[] = sel ? extractAnnotations(sel.evidence, sel.title) : [];
  const allAnns: LineAnnotation[] = [...problemAnns, ...axonChanges];
  async function handleAskAxon() {
    if (!sel) return;
    setAxonLoading(true); setAxonError(null); setAxonText(""); setAxonChanges([]);
    try {
      const code: { file: string; text: string }[] = [];
      for (const r of codeRefs.slice(0, 3)) {
        try { code.push({ file: r.file, text: await readCode(r) }); } catch { /* skip unreadable */ }
      }
      const plan = await askAxonForPlan(sel, code);
      setAxonText(plan.summary);
      const anns: LineAnnotation[] = [];
      for (const ch of plan.changes) {
        const pr = parseRef((ch.file || "") + ":1");
        if (pr && ch.line) anns.push({ repo: pr.repo, file: pr.file, line: ch.line, kind: "change", order: ch.order, note: ch.note });
      }
      setAxonChanges(anns);
    } catch (e: any) { setAxonError(e.message || String(e)); }
    finally { setAxonLoading(false); }
  }
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

      {/* board — grouped by severity for a clear top-down reading order */}
      {filtered.length === 0 ? (
        <div className="obs-panel" style={{ padding: 40, textAlign: "center", color: "var(--obs-dim)" }}>
          No findings match this filter. Widen it, or enjoy the moment.
        </div>
      ) : (
        <div className="obs-panel" style={{ padding: "4px 2px 8px" }}>
          {SEVERITY_ORDER.filter((sv) => filtered.some((f) => f.severity === sv)).map((sv) => {
            const group = filtered.filter((f) => f.severity === sv);
            return (
              <div key={sv}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "16px 18px 8px" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 9, background: sevColor[sv], display: "inline-block" }} />
                  <span className="obs-mono" style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: sevColor[sv] }}>{sv}</span>
                  <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-faint)" }}>· {group.length}</span>
                </div>
                {group.map((f) => {
                  const st = effectiveStatus(f.id);
                  const closed = st !== "open";
                  const owner = triageOf(f.id).owner;
                  return (
                    <button key={f.id} className="obs-row" onClick={() => setSelId(f.id)}
                            style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", padding: "11px 18px", textAlign: "left", background: "transparent", border: "none", borderTop: "1px solid var(--obs-line)", cursor: "pointer", color: "inherit", opacity: closed ? 0.48 : 1 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ width: 5, height: 5, borderRadius: 9, background: sevColor[f.severity], flexShrink: 0, display: "inline-block" }} />
                          <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, textDecoration: closed ? "line-through" : "none", textDecorationColor: "var(--obs-faint)" }}>{f.title}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--obs-dim)", lineHeight: 1.5, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 14 }}>{f.risk}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        {owner && <span className="obs-mono" style={{ fontSize: 10, color: "var(--obs-safe)" }}>@{owner}</span>}
                        {closed
                          ? <Badge color={STATUS_META[st].color}>✓ {STATUS_META[st].label}</Badge>
                          : <span className="obs-mono" style={{ fontSize: 10.5, color: effortColor[f.effort] }}>fix: {f.effort}</span>}
                        <span style={{ color: "var(--obs-faint)", fontSize: 13 }}>→</span>
                      </div>
                    </button>
                  );
                })}
              </div>
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
              {codeRefs.length > 0 && <div style={{ marginBottom: 18 }}><CodeViewer refs={codeRefs} annotations={allAnns} locators={deriveLocators([sel.evidence, sel.risk, sel.fix].join(" "))} /></div>}
              <div style={{ marginBottom: 18 }}>
                <button className="obs-tab" onClick={handleAskAxon} disabled={axonLoading}
                        style={{ borderColor: "var(--obs-scenario)", color: "var(--obs-scenario)" }}>
                  {axonLoading ? "Axon is reading the code…" : "✦ Ask Axon to fix this"}
                </button>
                {axonError && <div style={{ marginTop: 10, color: "var(--obs-high)", fontSize: 12.5, lineHeight: 1.6 }}>{axonError}</div>}
                {axonText && (
                  <div className="obs-panel" style={{ marginTop: 12, padding: 16, borderLeft: "3px solid var(--obs-scenario)" }}>
                    <Eyebrow>Axon's remediation</Eyebrow>
                    <div style={{ marginTop: 8 }}><Markdown text={axonText} /></div>
                  </div>
                )}
              </div>
              <Field label="Components implicated">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {sel.nodeIds.map((id) => (
                    <button key={id} onClick={() => { requestFocus("node", id); setSelId(null); }} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }} title="Show on the System Map">
                      <Badge color="var(--obs-dim)">{nodeLabel(id)} →</Badge>
                    </button>
                  ))}
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
