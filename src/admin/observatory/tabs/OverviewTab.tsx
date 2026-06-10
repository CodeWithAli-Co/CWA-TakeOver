import React, { useState } from "react";
import { manifest } from "../data/manifest";
import {
  securityScore, severityCounts, verdictCounts, riskiestNodes,
  exposedAssets, coverage, nodeFindings, SEVERITY_ORDER,
} from "../lib/scoring";
import { useTriageVersion, effectiveStatus, triageOf } from "../lib/triage";
import { scan, relTime, grade, exposureSeries } from "../lib/scan";
import { Badge, Dot, Eyebrow, verdictColor, verdictLabel, sevColor, sensColor } from "../components/ui";

/** Exposure sparkline from the scan history. */
function Spark({ data }: { data: number[] }) {
  if (data.length < 2)
    return <div style={{ fontSize: 11.5, color: "var(--obs-faint)", padding: "10px 0" }}>Collecting history — re-scan over time to see the trend.</div>;
  const w = 240, h = 52;
  const max = Math.max(...data), min = Math.min(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rng) * h}`).join(" ");
  const last = data[data.length - 1], first = data[0];
  const color = last <= first ? "var(--obs-safe)" : "var(--obs-critical)";
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", height: 52 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={h - ((last - min) / rng) * h} r="3" fill={color} />
    </svg>
  );
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export default function OverviewTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  useTriageVersion();
  const [rescanning, setRescanning] = useState(false);
  async function rescan() {
    setRescanning(true);
    try { await fetch("/__obs/rescan"); setTimeout(() => location.reload(), 450); } catch { setRescanning(false); }
  }

  const score = securityScore();
  const sev = severityCounts();
  const verdicts = verdictCounts();
  const cov = coverage();
  const risky = riskiestNodes(3);
  const exposed = exposedAssets();
  const recs = manifest.scenarios.filter((s) => s.recommended);

  const g = grade(score);
  const gColor = g === "A" || g === "B" ? "var(--obs-safe)" : g === "C" ? "var(--obs-medium)" : g === "D" ? "var(--obs-high)" : "var(--obs-critical)";
  const verdictWord = sev.critical > 0 ? "AT RISK" : sev.high > 0 ? "NEEDS WORK" : "HOLDING";
  const verdictCol = sev.critical > 0 ? "var(--obs-critical)" : sev.high > 0 ? "var(--obs-high)" : "var(--obs-safe)";

  const issues: string[] = [];
  if (scan.summary.bundledSecrets > 0) issues.push(`${scan.summary.bundledSecrets} secrets ship in the client binary`);
  if (scan.summary.routesNoRealAuth > 0) issues.push(`${scan.summary.routesNoRealAuth} of ${scan.summary.routes} API routes have no real auth`);
  if (scan.summary.anonReadableTables > 0) issues.push(`${scan.summary.anonReadableTables} tables are anon-readable`);
  if (!scan.summary.customStorageAdapter) issues.push("session tokens rest in plaintext localStorage");
  const summary = issues.length ? capitalize(issues.slice(0, 2).join(", and ")) + " — fix those first." : "No major exposure detected. Hold the line.";

  const series = exposureSeries();
  const curExp = series[series.length - 1];
  const expDelta = series.length > 1 ? curExp - series[series.length - 2] : null;
  const deltaCol = expDelta == null ? "var(--obs-dim)" : expDelta < 0 ? "var(--obs-safe)" : expDelta > 0 ? "var(--obs-critical)" : "var(--obs-dim)";

  const todo = [...manifest.findings]
    .filter((f) => effectiveStatus(f.id) === "open")
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
    .slice(0, 4);

  const drift = scan.drift;
  const driftNew = drift ? drift.newUnauthRoutes.length + drift.bundledSecrets.added.length + drift.anonReadable.added.length : 0;
  const externals = manifest.nodes.filter((n) => n.layer === "external");

  const cell: React.CSSProperties = { padding: 22, display: "flex", flexDirection: "column", cursor: "pointer" };
  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 5, background: "var(--obs-line)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width .8s ease" }} />
    </div>
  );
  const meterColor = (p: number) => (p >= 90 ? "var(--obs-safe)" : p >= 60 ? "var(--obs-medium)" : "var(--obs-critical)");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>

      {/* HERO briefing */}
      <section className="obs-panel" style={{ gridColumn: "span 12", padding: "24px 28px", display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", borderTop: `2px solid ${verdictCol}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 92, height: 92, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${gColor} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${gColor} 45%, transparent)`, flexShrink: 0 }}>
            <span className="obs-display" style={{ fontSize: 54, lineHeight: 1, color: gColor }}>{g}</span>
          </div>
          <div>
            <div className="obs-display" style={{ fontSize: 25, letterSpacing: ".01em", color: verdictCol }}>{verdictWord}</div>
            <div className="obs-mono" style={{ fontSize: 11, color: "var(--obs-dim)", marginTop: 5 }}>posture {score}/100 · scanned {relTime(scan.generatedAt)}</div>
            <button className="obs-tab" onClick={rescan} disabled={rescanning} style={{ marginTop: 9, padding: "4px 11px", fontSize: 10 }}>{rescanning ? "re-scanning…" : "re-scan ↻"}</button>
          </div>
        </div>
        <p style={{ flex: "1 1 320px", minWidth: 260, fontSize: 16, lineHeight: 1.55, color: "var(--obs-text)", margin: 0, fontFamily: "var(--obs-display)" }}>{summary}</p>
        <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
          {(["critical", "high", "medium"] as const).map((s) => (
            <div key={s} style={{ textAlign: "center" }}>
              <div className="obs-display" style={{ fontSize: 28, color: `var(--obs-${s})` }}>{sev[s]}</div>
              <div className="obs-eyebrow" style={{ marginTop: 2 }}>{s}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Do this next */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 5" }} onClick={() => onNavigate("security")}>
        <Eyebrow>Do this next · top open findings</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 12 }}>
          {todo.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Dot color={sevColor[f.severity]} size={7} />
              <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.35 }}>{f.title}</span>
              {triageOf(f.id).owner && <span className="obs-mono" style={{ fontSize: 10, color: "var(--obs-safe)" }}>@{triageOf(f.id).owner}</span>}
              <Badge color={sevColor[f.severity]}>{f.effort}</Badge>
            </div>
          ))}
        </div>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 14 }}>Open Threat Board →</span>
      </section>

      {/* Exposure trend */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("security")}>
        <Eyebrow>Exposure trend</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "8px 0 10px" }}>
          <span className="obs-display" style={{ fontSize: 34, color: deltaCol }}>{curExp}</span>
          {expDelta != null && <span className="obs-mono" style={{ fontSize: 12.5, color: deltaCol }}>{expDelta > 0 ? `+${expDelta}` : expDelta} since last</span>}
        </div>
        <Spark data={series} />
        <div style={{ fontSize: 11.5, color: "var(--obs-faint)", marginTop: 10, lineHeight: 1.55 }}>Weighted index of bundled secrets, unauth routes, anon tables &amp; plaintext sessions. Lower is safer.</div>
      </section>

      {/* Since last scan (drift) */}
      <section className="obs-panel" style={{ ...cell, gridColumn: "span 3", cursor: "default" }}>
        <Eyebrow>Since last scan</Eyebrow>
        {!drift ? (
          <p style={{ fontSize: 12.5, color: "var(--obs-dim)", lineHeight: 1.6, marginTop: 12 }}>Baseline saved. Re-scan after edits to track what enters the attack surface.</p>
        ) : driftNew === 0 ? (
          <div style={{ marginTop: 12 }}>
            <div className="obs-display" style={{ fontSize: 19, color: "var(--obs-safe)" }}>No new exposure ✓</div>
            <p style={{ fontSize: 11.5, color: "var(--obs-faint)", marginTop: 8, lineHeight: 1.6 }}>Nothing new since {relTime(drift.since)}.</p>
          </div>
        ) : (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { n: drift.newUnauthRoutes.length, label: "new unauth routes" },
              { n: drift.bundledSecrets.added.length, label: "new bundled secrets" },
              { n: drift.anonReadable.added.length, label: "new anon-readable tables" },
            ].filter((d) => d.n > 0).map((d) => (
              <div key={d.label} style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
                <span className="obs-display" style={{ fontSize: 22, color: "var(--obs-critical)" }}>+{d.n}</span>
                <span style={{ fontSize: 12, color: "var(--obs-dim)", lineHeight: 1.4 }}>{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Control coverage */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 5" }} onClick={() => onNavigate("data")}>
        <Eyebrow>Control coverage</Eyebrow>
        {[
          { label: "API routes behind auth", pct: cov.apiAuthPct, note: "Goal: 100% with an explicit public allowlist" },
          { label: "Wires encrypted in transit", pct: cov.edgeEncPct, note: "localStorage writes are the unencrypted holdout" },
          { label: "PII tables with full RLS", pct: cov.rlsPct, note: "The single most important meter on this page" },
        ].map((m) => (
          <div key={m.label} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 13.5 }}>{m.label}</span>
              <span className="obs-mono" style={{ fontSize: 13, color: meterColor(m.pct) }}>{m.pct}%</span>
            </div>
            <Bar pct={m.pct} color={meterColor(m.pct)} />
            <div style={{ fontSize: 11.5, color: "var(--obs-faint)", marginTop: 4 }}>{m.note}</div>
          </div>
        ))}
      </section>

      {/* Recommended moves */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 7" }} onClick={() => onNavigate("scenarios")}>
        <Eyebrow>Recommended moves · from the scenario engine</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
          {recs.map((s, i) => (
            <div key={s.id} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
              <span className="obs-display" style={{ fontSize: 22, color: "var(--obs-scenario)", fontStyle: "italic", minWidth: 24 }}>{String.fromCharCode(97 + i)}.</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{s.title}</span>
                  <Badge color="var(--obs-scenario)">{s.effort}</Badge>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--obs-dim)", marginTop: 3, lineHeight: 1.55 }}>{s.swap.from} → {s.swap.to}</div>
              </div>
            </div>
          ))}
        </div>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 14 }}>Run the what-ifs →</span>
      </section>

      {/* Sensitive data client-side */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("data")}>
        <Eyebrow>Sensitive data resting client-side</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {exposed.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13.5 }}>{a.name}</span>
              <Badge color={sensColor[a.sensitivity]}>{a.sensitivity}</Badge>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--obs-faint)", fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>On the operator's disk or in webview memory — outside every server-side control.</p>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 12 }}>Open Data Registry →</span>
      </section>

      {/* Components & risk */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("map")}>
        <Eyebrow>Components · {manifest.nodes.length} nodes</Eyebrow>
        <div style={{ display: "flex", gap: 18, margin: "12px 0 16px" }}>
          {(Object.keys(verdicts) as (keyof typeof verdicts)[]).map((v) => (
            <div key={v}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Dot color={verdictColor[v]} /><span className="obs-display" style={{ fontSize: 28 }}>{verdicts[v]}</span>
              </div>
              <div className="obs-eyebrow" style={{ marginTop: 2 }}>{verdictLabel[v]}</div>
            </div>
          ))}
        </div>
        <Eyebrow>Carrying the most risk</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
          {risky.map((n) => (
            <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13.5 }}>{n.label}</span>
              <div style={{ display: "flex", gap: 5 }}>{nodeFindings(n.id).slice(0, 3).map((f) => <Dot key={f.id} color={sevColor[f.severity]} size={7} />)}</div>
            </div>
          ))}
        </div>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 12 }}>Open System Map →</span>
      </section>

      {/* Attack surface & integrations */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("data")}>
        <Eyebrow>Attack surface</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 6px" }}>
          <span className="obs-display" style={{ fontSize: 34, color: "var(--obs-critical)" }}>{scan.summary.routesNoRealAuth}</span>
          <span style={{ fontSize: 13, color: "var(--obs-dim)" }}>of {scan.summary.routes} routes · no real auth</span>
        </div>
        <Bar pct={(scan.summary.routesNoRealAuth / Math.max(1, scan.summary.routes)) * 100} color="var(--obs-critical)" />
        <div style={{ marginTop: 16 }}><Eyebrow>{externals.length} external integrations</Eyebrow></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {externals.map((n) => (
            <span key={n.id} className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-dim)", border: "1px solid var(--obs-line)", borderRadius: 5, padding: "3px 9px" }}>{n.label.replace(/ API$/, "")}</span>
          ))}
        </div>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 12 }}>Open API registry →</span>
      </section>

      {/* provenance footer */}
      <section className="obs-panel" style={{ gridColumn: "span 12", padding: "13px 22px", display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
        <span className="obs-mono" style={{ fontSize: 11.5, color: "var(--obs-faint)" }}>
          manifest · {manifest.nodes.length} nodes · {manifest.edges.length} wires · {manifest.assets.length} assets · {manifest.apis.length} routes · {manifest.findings.length} findings · {manifest.scenarios.length} scenarios
        </span>
        <span className="obs-mono" style={{ fontSize: 11.5, color: manifest.generatedBy.includes("seed") ? "var(--obs-high)" : "var(--obs-safe)" }}>
          {manifest.generatedBy.includes("seed") ? "⚠ seed data — regenerate from repo" : `regenerated ${manifest.generatedAt}`}
        </span>
      </section>

      <style>{`
        @media (max-width: 1180px) { .obs-root section { grid-column: span 6 !important; } }
        @media (max-width: 760px) { .obs-root section { grid-column: span 12 !important; } }
      `}</style>
    </div>
  );
}
