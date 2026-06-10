import React, { useState } from "react";
import { manifest, Severity, Sensitivity, Layer } from "../data/manifest";
import {
  securityScore, severityCounts, verdictCounts, riskiestNodes,
  exposedAssets, coverage, nodeFindings, SEVERITY_ORDER,
} from "../lib/scoring";
import { useTriageVersion, effectiveStatus } from "../lib/triage";
import { scan, relTime } from "../lib/scan";
import { Badge, Dot, Eyebrow, ScoreRing, verdictColor, verdictLabel, sevColor, sensColor } from "../components/ui";

/** Bento-grid situation report. Every cell deep-links into the tab that explains it. */
export default function OverviewTab({ onNavigate }: { onNavigate: (tab: string) => void }) {
  useTriageVersion(); // re-render when findings are triaged
  const [rescanning, setRescanning] = useState(false);
  async function rescan() {
    setRescanning(true);
    try { await fetch("/__obs/rescan"); setTimeout(() => location.reload(), 450); }
    catch { setRescanning(false); }
  }
  const score = securityScore();
  const sev = severityCounts();
  const verdicts = verdictCounts();
  const cov = coverage();
  const risky = riskiestNodes(3);
  const exposed = exposedAssets();
  const recs = manifest.scenarios.filter((s) => s.recommended);
  const scoreColor = score >= 80 ? "var(--obs-safe)" : score >= 55 ? "var(--obs-medium)" : "var(--obs-critical)";

  // derived for the new widgets
  const status = manifest.findings.reduce(
    (a, f) => ((a[effectiveStatus(f.id)] = (a[effectiveStatus(f.id)] ?? 0) + 1), a),
    {} as Record<string, number>
  );
  const sensOrder: Sensitivity[] = ["secret", "pii", "internal", "public"];
  const sensCounts = sensOrder.map((s) => ({ s, n: manifest.assets.filter((a) => a.sensitivity === s).length }));
  const apisUnauth = manifest.apis.filter((r) => r.auth === "none").length;
  const externals = manifest.nodes.filter((n) => n.layer === "external");
  const planned = manifest.nodes.filter((n) => n.planned);
  const layerOrder: Layer[] = ["client", "core", "edge", "persistence", "external", "planned"];
  const layerCounts = layerOrder
    .map((l) => ({ l, n: manifest.nodes.filter((n) => n.layer === l).length }))
    .filter((x) => x.n > 0);

  const cell: React.CSSProperties = { padding: 22, display: "flex", flexDirection: "column", cursor: "pointer" };

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div style={{ height: 5, background: "var(--obs-line)", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width .8s ease" }} />
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 14 }}>

      {/* Posture — hero */}
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

      {/* Component verdicts + riskiest */}
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
            <Bar pct={m.pct} color={m.pct >= 90 ? "var(--obs-safe)" : m.pct >= 60 ? "var(--obs-medium)" : "var(--obs-critical)"} />
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

      {/* Triage progress */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("security")}>
        <Eyebrow>Remediation progress</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 14px" }}>
          <span className="obs-display" style={{ fontSize: 38, color: scoreColor }}>{status.open ?? 0}</span>
          <span style={{ fontSize: 13, color: "var(--obs-dim)" }}>open · {status.mitigated ?? 0} mitigated · {status.accepted ?? 0} accepted</span>
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", border: "1px solid var(--obs-line)" }}>
          {([["open", "var(--obs-critical)"], ["mitigated", "var(--obs-safe)"], ["accepted", "var(--obs-low)"]] as const).map(([k, c]) => {
            const n = status[k] ?? 0;
            return n ? <div key={k} title={`${n} ${k}`} style={{ flex: n, background: c }} /> : null;
          })}
        </div>
        <p style={{ color: "var(--obs-faint)", fontSize: 11.5, lineHeight: 1.6, marginTop: 12 }}>
          Triage findings on the Threat Board — status, owner, target. Mitigating an item re-scores this dashboard live.
        </p>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 12 }}>Work the board →</span>
      </section>

      {/* Findings by severity */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("security")}>
        <Eyebrow>Open findings by severity</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 12 }}>
          {SEVERITY_ORDER.filter((s) => s !== "info").map((s) => {
            const n = sev[s as Severity];
            const max = Math.max(1, ...SEVERITY_ORDER.map((x) => sev[x as Severity]));
            return (
              <div key={s}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, textTransform: "capitalize" }}>{s}</span>
                  <span className="obs-mono" style={{ fontSize: 13, color: sevColor[s as Severity] }}>{n}</span>
                </div>
                <Bar pct={(n / max) * 100} color={sevColor[s as Severity]} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Data by sensitivity */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("data")}>
        <Eyebrow>Data assets by sensitivity · {manifest.assets.length}</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 12 }}>
          {sensCounts.map(({ s, n }) => {
            const max = Math.max(1, ...sensCounts.map((x) => x.n));
            return (
              <div key={s}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 13, textTransform: "capitalize" }}>{s}</span>
                  <span className="obs-mono" style={{ fontSize: 13, color: sensColor[s] }}>{n}</span>
                </div>
                <Bar pct={(n / max) * 100} color={sensColor[s]} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Attack surface */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("data")}>
        <Eyebrow>Attack surface · API routes</Eyebrow>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "10px 0 6px" }}>
          <span className="obs-display" style={{ fontSize: 38, color: "var(--obs-critical)" }}>{apisUnauth}</span>
          <span style={{ fontSize: 13, color: "var(--obs-dim)" }}>of {manifest.apis.length} routes have no real auth</span>
        </div>
        <Bar pct={(apisUnauth / Math.max(1, manifest.apis.length)) * 100} color="var(--obs-critical)" />
        <p style={{ color: "var(--obs-faint)", fontSize: 11.5, lineHeight: 1.6, marginTop: 12 }}>
          "No real auth" = public or a spoofable header gate only. The Data &amp; APIs registry lists each route, its auth, and what it touches.
        </p>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 12 }}>Open API registry →</span>
      </section>

      {/* External integrations */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("map")}>
        <Eyebrow>External integrations · {externals.length}</Eyebrow>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
          {externals.map((n) => (
            <span key={n.id} className="obs-mono" style={{ fontSize: 11, color: "var(--obs-dim)", border: "1px solid var(--obs-line)", borderRadius: 99, padding: "4px 10px" }}>
              {n.label}
            </span>
          ))}
        </div>
        <p style={{ color: "var(--obs-faint)", fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>
          Every third party Takeover touches. Anthropic &amp; ElevenLabs are still called client-side with bundled keys.
        </p>
        <span className="obs-mono" style={{ fontSize: 11, color: "var(--obs-scenario)", marginTop: "auto", paddingTop: 12 }}>Trace on the map →</span>
      </section>

      {/* System layers */}
      <section className="obs-panel obs-panel-hover" style={{ ...cell, gridColumn: "span 4" }} onClick={() => onNavigate("map")}>
        <Eyebrow>System layers</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
          {layerCounts.map(({ l, n }) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, textTransform: "capitalize", display: "flex", alignItems: "center", gap: 9 }}>
                <Dot color={l === "external" ? "var(--obs-data)" : l === "planned" ? "var(--obs-planned)" : l === "persistence" ? "var(--obs-medium)" : l === "edge" ? "var(--obs-high)" : "var(--obs-scenario)"} size={7} />
                {l}
              </span>
              <span className="obs-mono" style={{ fontSize: 13, color: "var(--obs-dim)" }}>{n}{l === "planned" ? " · not built" : ""}</span>
            </div>
          ))}
        </div>
        <p style={{ color: "var(--obs-faint)", fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>
          {planned.length} planned node{planned.length === 1 ? "" : "s"} (server, Redis) shown dashed on the map.
        </p>
      </section>

      {/* Live repo scan strip */}
      <section className="obs-panel" style={{ gridColumn: "span 12", padding: "15px 22px", display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <Dot color="var(--obs-safe)" size={8} />
          <div>
            <div className="obs-eyebrow">Live repo scan</div>
            <div className="obs-mono" style={{ fontSize: 11.5, color: "var(--obs-faint)" }}>scanned {relTime(scan.generatedAt)} · auto-refreshes on launch</div>
          </div>
          <button className="obs-tab" onClick={rescan} disabled={rescanning} style={{ padding: "5px 11px", fontSize: 10, marginLeft: 4 }}>{rescanning ? "re-scanning…" : "re-scan ↻"}</button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: 22 }}>
          {[
            { label: "routes", val: String(scan.summary.routes), sub: `${scan.summary.routesNoRealAuth} no real auth`, bad: scan.summary.routesNoRealAuth > 0 },
            { label: "bundled secrets", val: String(scan.summary.bundledSecrets), sub: "in the client binary", bad: scan.summary.bundledSecrets > 0 },
            { label: "anon-readable tables", val: String(scan.summary.anonReadableTables), sub: "of " + scan.summary.migrationsTables + " in migrations", bad: scan.summary.anonReadableTables > 0 },
            { label: "session storage", val: scan.summary.customStorageAdapter ? "encrypted" : "localStorage", sub: scan.summary.customStorageAdapter ? "custom adapter" : "plaintext on disk", bad: !scan.summary.customStorageAdapter },
          ].map((m) => (
            <div key={m.label} style={{ textAlign: "right" }}>
              <div className="obs-display" style={{ fontSize: 22, lineHeight: 1.1, color: m.bad ? "var(--obs-critical)" : "var(--obs-safe)" }}>{m.val}</div>
              <div className="obs-eyebrow" style={{ marginTop: 3 }}>{m.label}</div>
              <div style={{ fontSize: 10.5, color: "var(--obs-faint)" }}>{m.sub}</div>
            </div>
          ))}
        </div>
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

      <style>{`
        @media (max-width: 1180px) { .obs-root section { grid-column: span 6 !important; } }
        @media (max-width: 760px) { .obs-root section { grid-column: span 12 !important; } }
      `}</style>
    </div>
  );
}
