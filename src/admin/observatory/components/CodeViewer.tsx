import { useEffect, useRef, useState } from "react";
import { CodeRef, readCode, openInEditor } from "../lib/code";
import { Eyebrow } from "./ui";

/** Read-only source viewer: pick a file, see the code, jump to the cited line. */
export default function CodeViewer({ refs }: { refs: CodeRef[] }) {
  const [active, setActive] = useState(0);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const ref = refs[active];

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setLoading(true); setError(null); setCode("");
    readCode(ref)
      .then((txt) => { if (!cancelled) setCode(txt); })
      .catch((e) => { if (!cancelled) setError(e.message || String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, ref?.repo, ref?.file]);

  useEffect(() => {
    if (code && lineRef.current) lineRef.current.scrollIntoView({ block: "center" });
  }, [code]);

  if (refs.length === 0) return null;
  const lines = code ? code.split("\n") : [];

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <Eyebrow>Source</Eyebrow>
        <button className="obs-tab" onClick={() => ref && openInEditor(ref)} style={{ padding: "5px 10px", fontSize: 10 }}>open in editor ↗</button>
      </div>

      {/* file tabs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {refs.map((r, i) => (
          <button key={r.repo + r.file} className="obs-mono" onClick={() => setActive(i)}
                  style={{ fontSize: 11, padding: "4px 9px", borderRadius: 7, cursor: "pointer",
                           border: `1px solid ${i === active ? "var(--obs-line-strong)" : "var(--obs-line)"}`,
                           background: i === active ? "var(--obs-panel-2)" : "transparent",
                           color: i === active ? "var(--obs-text)" : "var(--obs-dim)" }}>
            {r.repo === "b2b" ? "b2b:" : ""}{r.file.split("/").pop()}{r.line ? `:${r.line}` : ""}
          </button>
        ))}
      </div>

      {/* code panel */}
      <div style={{ border: "1px solid var(--obs-line)", borderRadius: 10, background: "#0c0c0e", overflow: "hidden" }}>
        <div className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-faint)", padding: "8px 12px", borderBottom: "1px solid var(--obs-line)" }}>
          {ref?.repo === "b2b" ? "takeover_b2b/" : ""}{ref?.file}
        </div>
        <div style={{ maxHeight: 360, overflow: "auto" }}>
          {loading && <div style={{ padding: 18, color: "var(--obs-dim)", fontSize: 12.5 }}>Reading file…</div>}
          {error && <div style={{ padding: 18, color: "var(--obs-high)", fontSize: 12.5, lineHeight: 1.6 }}>{error}</div>}
          {!loading && !error && (
            <pre style={{ margin: 0, padding: 0, fontFamily: "var(--obs-mono)", fontSize: 12, lineHeight: 1.55 }}>
              {lines.map((ln, i) => {
                const n = i + 1;
                const hot = ref?.line === n;
                return (
                  <div key={i} ref={hot ? lineRef : undefined}
                       style={{ display: "flex", background: hot ? "color-mix(in srgb, var(--obs-high) 14%, transparent)" : "transparent", borderLeft: hot ? "2px solid var(--obs-high)" : "2px solid transparent" }}>
                    <span style={{ width: 46, textAlign: "right", paddingRight: 12, color: "var(--obs-faint)", userSelect: "none", flexShrink: 0 }}>{n}</span>
                    <code style={{ whiteSpace: "pre", color: "var(--obs-text)", paddingRight: 16 }}>{ln || " "}</code>
                  </div>
                );
              })}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
