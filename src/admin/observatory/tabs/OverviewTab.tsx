import React from "react";
import { manifest } from "../data/manifest";
import {
  securityScore, severityCounts, verdictCounts, riskiestNodes,
  exposedAssets, coverage, nodeFindings,
} from "../lib/scoring";
import { Badge, Dot, Eyebrow, ScoreRing, verdictColor, verdictLabel, sevColor, sensColor } from "../components/ui";

/** Bento-grid situation report. Every cell deep-links into the tab that explains it. */
export default function OverviewTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const score = securityScore();
  const sev = severityCounts();
  const verdicts = verdictCounts();
  const cov = coverage();
  const risky = riskiestNodes(3);
  const exposed = exposedAssets();
  const recs = manifest.scenarios.filter((s) => s.recommended);
  const scoreColor = score >= 80 ? "var(--obs-safe)" : score >= 55 ? "var(--obs-medium)" : "var(--obs-critical)";

  const cell: React.CSSProperties = { padding: 22, display: "flex", flexDirection: "column", cursor: "pointer" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>

      {/* Posture — hero cell */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4", alignItems: "center", textAlign: "center", gap: 14 }} onClick={() => onNavigate("security")}>
        <Eyebrow>Security posture</Eyebrow>
        <ScoreRing value={score} label="of 100" color={scoreColor} size={150} />
        <p style={{ color: "var(--obs-dim)", fontSize: 13, lineHeight: 1.6, margin: 0 }}>
          {sev.critical > 0
            ? <>Two moves change this number the most: getting tokens off plaintext disk and finishing RLS. Both are scoped on the Threat Board.</>
            : <>No open criticals. Hold the line — every new table ships with a policy, every new route ships behind auth.</>}
        </p>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)" }}>Open Threat Board →</span>
      </section>

      {/* Component verdicts */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("map")}>
        <Eyebrow>Components · {manifest.nodes.length} nodes</Eyebrow>
        <div style={{ display: "flex", gap: 18, margin: "12px 0 16px" }}>
          {(Object.keys(verdicts) as (keyof typeof verdicts)[]).map((v) => (
            <div key={v}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Dot color={verdictColor[v]} />
                <span className="obs-display" style={{ fontSize: 30 }}>{verdicts[v]}</span>
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
              <div style={{ display: "flex", gap: 5 }}>
                {nodeFindings(n.id).slice(0, 3).map((f) => <Dot key={f.id} color={sevColor[f.severity]} size={7} />)}
              </div>
            </div>
          ))}
        </div>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 14 }}>Open System Map →</span>
      </section>

      {/* Exposed data */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("data")}>
        <Eyebrow>Sensitive data resting client-side</Eyebrow>
        {exposed.length === 0 ? (
          <p style={{ color: "var(--obs-dim)", fontSize: 13.5, lineHeight: 1.6 }}>
            Nothing secret-shaped rests in localStorage or a persisted cache. Keep it that way.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
            {exposed.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 13.5 }}>{a.name}</span>
                <Badge color={sensColor[a.sensitivity]}>{a.sensitivity}</Badge>
              </div>
            ))}
          </div>
        )}
        <p style={{ color: "var(--obs-dim)", fontSize: 12.5, lineHeight: 1.6, marginTop: 14 }}>
          "Client-side" means on the operator's disk or in webview memory — outside every
          server-side control you have. The Data Registry shows each asset's full resting map.
        </p>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 14 }}>Open Data Registry →</span>
      </section>

      {/* Coverage meters */}
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
              <span className="obs-mono" style={{ fontSize: 13, color: m.pct >= 90 ? "var(--obs-safe)" : m.pct >= 60 ? "var(--obs-medium)" : "var(--obs-critical)" }}>{m.pct}%</span>
            </div>
            <div style={{ height: 5, background: "var(--obs-line)", borderRadius: 99 }}>
              <div style={{ height: "100%", width: `${m.pct}%`, borderRadius: 99, background: m.pct >= 90 ? "var(--obs-safe)" : m.pct >= 60 ? "var(--obs-medium)" : "var(--obs-critical)", transition: "width .8s ease" }} />
            </div>
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
                <div style={{ fontSize: 12.5, color: "var(--obs-dim)", marginTop: 3, lineHeight: 1.55 }}>
                  {s.swap.from} → {s.swap.to}
                </div>
              </div>
            </div>
          ))}
        </div>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 14 }}>Run the what-ifs →</span>
      </section>

      {/* Footer strip: manifest provenance */}
      <section className="obs-panel" style={{ gridColumn: "span 12", padding: "14px 22px", display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", justifyContent: "space-between" }}>
        <span className="obs-mono" style={{ fontSize: 11.5, color: "var(--obs-faint)" }}>
          manifest · {manifest.nodes.length} nodes · {manifest.edges.length} wires · {manifest.assets.length} data assets · {manifest.apis.length} routes · {manifest.findings.length} findings · {manifest.scenarios.length} scenarios
        </span>
        <span className="obs-mono" style={{ fontSize: 11.5, color: manifest.generatedBy.includes("seed") ? "var(--obs-high)" : "var(--obs-safe)" }}>
          {manifest.generatedBy.includes("seed") ? "⚠ seed data — regenerate from repo (README)" : `regenerated ${manifest.generatedAt}`}
        </span>
      </section>

      <style>{`@media (max-width: 900px) { .obs-root section { grid-column: span 12 !important; } }`}</style>
    </div>
  );
}
