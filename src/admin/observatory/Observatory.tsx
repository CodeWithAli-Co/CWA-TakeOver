import { useEffect, useRef, useState } from "react";
import { manifest } from "./data/manifest";
import { securityScore, severityCounts } from "./lib/scoring";
import { useTriageVersion } from "./lib/triage";
import { OBS_STYLES, Dot } from "./components/ui";
import OverviewTab from "./tabs/OverviewTab";
import SystemMapTab from "./tabs/SystemMapTab";
import SecurityTab from "./tabs/SecurityTab";
import DataApiTab from "./tabs/DataApiTab";
import ScenariosTab from "./tabs/ScenariosTab";
import CommandPalette from "./components/CommandPalette";
import { useFocus } from "./lib/focus";

/**
 * TAKEOVER OBSERVATORY
 * Drop-in admin module. Route it at /admin/observatory (see README).
 * Everything renders from data/manifest.ts — regenerate that file with the
 * Claude Code prompt in the README whenever the codebase moves.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "map", label: "System Map" },
  { id: "security", label: "Threat Board" },
  { id: "data", label: "Data & APIs" },
  { id: "scenarios", label: "Scenarios" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Observatory() {
  useTriageVersion(); // masthead posture re-scores live when findings are triaged
  const [tab, setTab] = useState<TabId>("overview");
  const score = securityScore();
  const counts = severityCounts();
  const scoreColor =
    score >= 80 ? "var(--obs-safe)" : score >= 55 ? "var(--obs-medium)" : "var(--obs-critical)";

  const [palette, setPalette] = useState(false);
  const focus = useFocus();
  const lastNonce = useRef(0);
  useEffect(() => {
    if (focus && focus.nonce !== lastNonce.current) { lastNonce.current = focus.nonce; setTab(focus.tab as TabId); }
  }, [focus]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="obs-root">
      <style>{OBS_STYLES}</style>

      <div style={{ maxWidth: 1760, margin: "0 auto", padding: "30px 36px 96px" }}>
        {/* ── Masthead ─────────────────────────────────────────────────── */}
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 26 }}>
          <div>
            <div className="obs-eyebrow" style={{ marginBottom: 10 }}>
              Takeover · Internal · {manifest.generatedAt}
            </div>
            <h1 className="obs-display" style={{ fontSize: "clamp(34px, 5vw, 52px)", margin: 0, lineHeight: 1.02 }}>
              The Observatory
            </h1>
            <p style={{ color: "var(--obs-dim)", margin: "10px 0 0", fontSize: 14, maxWidth: 560, lineHeight: 1.6 }}>
              The whole system on one screen — every store, wire, table, route, risk, and
              what-if. Rendered live from <span className="obs-mono" style={{ fontSize: 12 }}>data/manifest.ts</span>.
            </p>
          </div>

          {/* live posture strip */}
          <div className="obs-panel" style={{ display: "flex", alignItems: "center", gap: 22, padding: "14px 20px" }}>
            <div style={{ textAlign: "center" }}>
              <div className="obs-display" style={{ fontSize: 34, lineHeight: 1, color: scoreColor }}>{score}</div>
              <div className="obs-eyebrow" style={{ marginTop: 4 }}>Posture</div>
            </div>
            <div style={{ width: 1, height: 40, background: "var(--obs-line)" }} />
            {(["critical", "high", "medium"] as const).map((s) => (
              <div key={s} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, justifyContent: "center" }}>
                  <Dot color={`var(--obs-${s})`} size={7} />
                  <span className="obs-mono" style={{ fontSize: 18 }}>{counts[s]}</span>
                </div>
                <div className="obs-eyebrow" style={{ marginTop: 4 }}>{s}</div>
              </div>
            ))}
          </div>
        </header>

        {/* ── Tabs ─────────────────────────────────────────────────────── */}
        <nav style={{ display: "flex", gap: 6, marginBottom: 26, overflowX: "auto", paddingBottom: 4 }} aria-label="Observatory sections">
          {TABS.map((t) => (
            <button key={t.id} className="obs-tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <button className="obs-tab" onClick={() => setPalette(true)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }} title="Search (Cmd/Ctrl+K)">
            <span>Search</span>
            <span className="obs-kbd">⌘K</span>
          </button>
        </nav>

        {/* ── Active tab ───────────────────────────────────────────────── */}
        <main className="obs-rise" key={tab}>
          {tab === "overview" && <OverviewTab onNavigate={(t) => setTab(t as TabId)} />}
          {tab === "map" && <SystemMapTab />}
          {tab === "security" && <SecurityTab />}
          {tab === "data" && <DataApiTab />}
          {tab === "scenarios" && <ScenariosTab />}
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
