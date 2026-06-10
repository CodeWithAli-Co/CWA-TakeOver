import { useEffect, useMemo, useRef, useState } from "react";
import { manifest } from "../data/manifest";
import { requestFocus, FocusKind } from "../lib/focus";
import { sevColor, sensColor, verdictColor } from "./ui";

interface Item { kind: FocusKind; id: string; label: string; sub: string; color: string; tag: string }

function buildIndex(): Item[] {
  const out: Item[] = [];
  manifest.findings.forEach((f) => out.push({ kind: "finding", id: f.id, label: f.title, sub: `${f.severity} · fix ${f.effort}`, color: sevColor[f.severity], tag: "finding" }));
  manifest.nodes.forEach((n) => out.push({ kind: "node", id: n.id, label: n.label, sub: n.layer, color: verdictColor[n.verdict], tag: "node" }));
  manifest.apis.forEach((r) => out.push({ kind: "route", id: r.id, label: r.path, sub: `${r.method} · auth ${r.auth}`, color: verdictColor[r.verdict], tag: "route" }));
  manifest.assets.forEach((a) => out.push({ kind: "asset", id: a.id, label: a.name, sub: a.sensitivity, color: sensColor[a.sensitivity], tag: "data" }));
  manifest.scenarios.forEach((s) => out.push({ kind: "scenario", id: s.id, label: s.title, sub: `scenario · ${s.effort}`, color: "var(--obs-scenario)", tag: "what-if" }));
  return out;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const index = useMemo(buildIndex, []);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const r = t ? index.filter((i) => (i.label + " " + i.sub + " " + i.tag).toLowerCase().includes(t)) : index;
    return r.slice(0, 50);
  }, [q, index]);

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${active}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;
  const choose = (i: Item) => { requestFocus(i.kind, i.id); onClose(); };

  return (
    <div className="obs-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" style={{ alignItems: "flex-start", paddingTop: "12vh" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "#141417", border: "1px solid var(--obs-line-strong)", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,.6)" }}>
        <input
          ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Jump to a finding, node, route, scenario…"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); if (results[active]) choose(results[active]); }
            else if (e.key === "Escape") onClose();
          }}
          style={{ width: "100%", boxSizing: "border-box", background: "transparent", color: "var(--obs-text)", border: "none", borderBottom: "1px solid var(--obs-line)", padding: "16px 18px", fontSize: 15, outline: "none", fontFamily: "var(--obs-body)" }}
        />
        <div ref={listRef} style={{ maxHeight: "52vh", overflowY: "auto" }}>
          {results.length === 0 && <div style={{ padding: 22, color: "var(--obs-dim)", fontSize: 13 }}>No matches.</div>}
          {results.map((i, idx) => (
            <button key={i.kind + i.id} data-i={idx} onMouseEnter={() => setActive(idx)} onClick={() => choose(i)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", textAlign: "left", background: idx === active ? "var(--obs-panel-2)" : "transparent", border: "none", cursor: "pointer", color: "inherit" }}>
              <span style={{ width: 6, height: 6, borderRadius: 9, background: i.color, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.label}</span>
              <span className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-faint)", flexShrink: 0 }}>{i.sub}</span>
              <span className="obs-mono" style={{ fontSize: 9.5, color: i.color, border: `1px solid color-mix(in srgb, ${i.color} 40%, transparent)`, borderRadius: 5, padding: "2px 6px", flexShrink: 0, textTransform: "uppercase", letterSpacing: ".1em" }}>{i.tag}</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 14, padding: "9px 18px", borderTop: "1px solid var(--obs-line)", color: "var(--obs-faint)" }}>
          <span className="obs-mono" style={{ fontSize: 10 }}>↑↓ navigate</span>
          <span className="obs-mono" style={{ fontSize: 10 }}>↵ open</span>
          <span className="obs-mono" style={{ fontSize: 10 }}>esc close</span>
        </div>
      </div>
    </div>
  );
}
