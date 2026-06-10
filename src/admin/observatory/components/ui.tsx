import React, { useEffect } from "react";
import { Severity, Verdict, Sensitivity } from "../data/manifest";

/* ────────────────────────────────────────────────────────────────────────────
 * OBSERVATORY DESIGN TOKENS
 * Editorial control-room: Takeover's existing editorial system (Newsreader /
 * Hanken Grotesk / JetBrains Mono) applied to an ops surface. Deep oxide-slate
 * ground, warm paper ink, strict semantic color — color always *means* state.
 * Everything is scoped under .obs-root so it can't fight the app's theme.
 * ──────────────────────────────────────────────────────────────────────────── */
export const OBS_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..600&family=Hanken+Grotesk:wght@300..700&family=JetBrains+Mono:wght@400;500;600&display=swap');

.obs-root {
  --obs-bg: #10141D;
  --obs-panel: #151A26;
  --obs-panel-2: #1B2130;
  --obs-line: #262E41;
  --obs-line-strong: #36405A;
  --obs-text: #EDE9E0;
  --obs-dim: #8C94A8;
  --obs-faint: #5A6275;

  --obs-critical: #E5484D;
  --obs-high: #E8893D;
  --obs-medium: #D9B54A;
  --obs-low: #5FB4D9;
  --obs-safe: #4CC38A;
  --obs-watch: #D9B54A;
  --obs-scenario: #9B8AFB;
  --obs-data: #5FB4D9;
  --obs-planned: #7C87A5;

  --obs-display: 'Newsreader', Georgia, serif;
  --obs-body: 'Hanken Grotesk', system-ui, sans-serif;
  --obs-mono: 'JetBrains Mono', ui-monospace, monospace;

  background: var(--obs-bg);
  color: var(--obs-text);
  font-family: var(--obs-body);
  min-height: 100vh;
  font-feature-settings: 'ss01';
}

.obs-root ::selection { background: rgba(155,138,251,.35); }
.obs-root *:focus-visible { outline: 2px solid var(--obs-scenario); outline-offset: 2px; border-radius: 4px; }

.obs-display { font-family: var(--obs-display); font-weight: 400; letter-spacing: -0.01em; }
.obs-mono { font-family: var(--obs-mono); }

.obs-eyebrow {
  font-family: var(--obs-mono); font-size: 10px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--obs-faint); font-weight: 500;
}

.obs-panel {
  background: var(--obs-panel);
  border: 1px solid var(--obs-line);
  border-radius: 14px;
}
.obs-panel-hover { transition: border-color .18s ease, transform .18s ease, background .18s ease; }
.obs-panel-hover:hover { border-color: var(--obs-line-strong); background: var(--obs-panel-2); }

.obs-tab {
  font-family: var(--obs-mono); font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
  color: var(--obs-dim); padding: 10px 14px; border: 1px solid transparent; border-radius: 999px;
  cursor: pointer; background: transparent; transition: all .15s ease; white-space: nowrap;
}
.obs-tab:hover { color: var(--obs-text); }
.obs-tab[data-active="true"] { color: var(--obs-text); border-color: var(--obs-line-strong); background: var(--obs-panel-2); }

.obs-row { transition: background .12s ease; cursor: pointer; }
.obs-row:hover { background: var(--obs-panel-2); }

/* signature: data pulses along the system map wires */
@keyframes obs-flow { to { stroke-dashoffset: -28; } }
.obs-wire { stroke-dasharray: 4 24; animation: obs-flow 1.6s linear infinite; }
@media (prefers-reduced-motion: reduce) {
  .obs-wire { animation: none; stroke-dasharray: none; opacity: .5; }
  .obs-root * { transition: none !important; animation: none !important; }
}

@keyframes obs-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.obs-rise { animation: obs-rise .35s ease both; }

.obs-modal-backdrop {
  position: fixed; inset: 0; background: rgba(8,10,16,.72);
  backdrop-filter: blur(6px); z-index: 60; display: flex;
  align-items: center; justify-content: center; padding: 24px;
}
.obs-modal {
  background: var(--obs-panel); border: 1px solid var(--obs-line-strong);
  border-radius: 18px; max-width: 880px; width: 100%; max-height: 86vh;
  overflow-y: auto; box-shadow: 0 40px 90px rgba(0,0,0,.55);
  animation: obs-rise .25s ease both;
}
.obs-modal::-webkit-scrollbar { width: 8px; }
.obs-modal::-webkit-scrollbar-thumb { background: var(--obs-line-strong); border-radius: 99px; }

.obs-kbd {
  font-family: var(--obs-mono); font-size: 10px; border: 1px solid var(--obs-line-strong);
  border-bottom-width: 2px; border-radius: 5px; padding: 1px 6px; color: var(--obs-dim);
}
`;

/* ── semantic color helpers ────────────────────────────────────────────────── */
export const sevColor: Record<Severity, string> = {
  critical: "var(--obs-critical)", high: "var(--obs-high)",
  medium: "var(--obs-medium)", low: "var(--obs-low)", info: "var(--obs-dim)",
};
export const verdictColor: Record<Verdict, string> = {
  safe: "var(--obs-safe)", watch: "var(--obs-watch)", "at-risk": "var(--obs-critical)",
};
export const verdictLabel: Record<Verdict, string> = {
  safe: "Safe", watch: "Watch", "at-risk": "At risk",
};
export const sensColor: Record<Sensitivity, string> = {
  secret: "var(--obs-critical)", pii: "var(--obs-high)",
  internal: "var(--obs-medium)", public: "var(--obs-safe)",
};

/* ── atoms ────────────────────────────────────────────────────────────────── */
export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="obs-mono"
      style={{
        fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase",
        color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
        borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 99, background: color, display: "inline-block",
      boxShadow: `0 0 ${size}px color-mix(in srgb, ${color} 60%, transparent)`,
    }} />
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="obs-eyebrow" style={{ marginBottom: 8 }}>{children}</div>;
}

export function ScoreRing({ value, label, color, size = 132 }: { value: number; label: string; color: string; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${value} of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--obs-line)" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)" }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div className="obs-display" style={{ fontSize: size / 3.4, lineHeight: 1 }}>{value}</div>
        <div className="obs-eyebrow" style={{ marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── modal ────────────────────────────────────────────────────────────────── */
export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="obs-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="obs-modal" onClick={(e) => e.stopPropagation()}>
        {children}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 24px 18px" }}>
          <span className="obs-kbd">esc to close</span>
        </div>
      </div>
    </div>
  );
}

export function ModalHeader({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "26px 28px 14px", borderBottom: "1px solid var(--obs-line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="obs-display" style={{ fontSize: 28, margin: 0 }}>{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function Field({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="obs-eyebrow" style={{ marginBottom: 6 }}>{label}</div>
      <div className={mono ? "obs-mono" : ""} style={{ fontSize: mono ? 12 : 14, lineHeight: 1.65, color: "var(--obs-text)" }}>
        {children}
      </div>
    </div>
  );
}
