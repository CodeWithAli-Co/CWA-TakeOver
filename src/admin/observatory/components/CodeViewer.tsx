import { useEffect, useMemo, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { CodeRef, LineAnnotation, readCode, openInEditor } from "../lib/code";
import { Eyebrow } from "./ui";

export function langOf(file: string): string {
  const ext = (file.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript",
    rs: "rust", sql: "sql", json: "json", env: "bash", sh: "bash",
    yml: "yaml", yaml: "yaml", md: "markdown", html: "markup", css: "css", toml: "toml",
  };
  return map[ext] ?? "text";
}

const KIND = {
  problem: { rail: "var(--obs-critical)", bg: "rgba(242,85,90,0.13)", label: "problem" },
  change: { rail: "var(--obs-safe)", bg: "rgba(74,222,128,0.13)", label: "change" },
  context: { rail: "var(--obs-low)", bg: "rgba(95,180,217,0.12)", label: "context" },
} as const;

/** Read-only source viewer with Prism styling + line-level review annotations. */
export default function CodeViewer({ refs, annotations = [], locators = [] }: { refs: CodeRef[]; annotations?: LineAnnotation[]; locators?: string[] }) {
  const [active, setActive] = useState(0);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const ref = refs[active];

  // annotations for the active file, indexed by line (change > problem > context)
  const fileExplicit = useMemo(
    () => annotations.filter((a) => ref && a.repo === ref.repo && a.file === ref.file),
    [annotations, ref?.repo, ref?.file]
  );
  // fallback: when the evidence has no explicit lines, highlight lines that
  // mention the finding's identifiers (env vars, snake_case, dotted access…).
  const searchMarks = useMemo<LineAnnotation[]>(() => {
    if (!ref || fileExplicit.length > 0 || !code || locators.length === 0) return [];
    const out: LineAnnotation[] = [];
    const lines = code.split("\n");
    for (let i = 0; i < lines.length && out.length < 24; i++) {
      let hit = "";
      for (const t of locators) if (t && lines[i].includes(t) && t.length > hit.length) hit = t;
      if (hit) out.push({ repo: ref.repo, file: ref.file, line: i + 1, kind: "problem", note: `uses ${hit}` });
    }
    return out;
  }, [code, fileExplicit.length, locators, ref?.repo, ref?.file]);
  const fileAnns = fileExplicit.length ? fileExplicit : searchMarks;
  const byLine = useMemo(() => {
    const m = new Map<number, LineAnnotation>();
    const rank = { context: 0, problem: 1, change: 2 };
    for (const a of fileAnns) {
      const cur = m.get(a.line);
      if (!cur || rank[a.kind] > rank[cur.kind]) m.set(a.line, a);
    }
    return m;
  }, [fileAnns]);
  const steps = useMemo(() => {
    const sorted = [...fileAnns].sort((a, b) => a.line - b.line);
    const g: { from: number; to: number; kind: LineAnnotation["kind"]; note?: string; order?: number }[] = [];
    for (const a of sorted) {
      const last = g[g.length - 1];
      if (last && last.kind === a.kind && last.note === a.note && a.line === last.to + 1) last.to = a.line;
      else g.push({ from: a.line, to: a.line, kind: a.kind, note: a.note, order: a.order });
    }
    return g.sort((x, y) => (x.order ?? 99) - (y.order ?? 99) || x.from - y.from);
  }, [fileAnns]);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setLoading(true); setError(null); setCode("");
    readCode(ref).then((t) => !cancelled && setCode(t))
      .catch((e) => !cancelled && setError(e.message || String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [active, ref?.repo, ref?.file]);

  const scrollToLine = (line?: number) => {
    const target = line ?? ref?.line ?? steps[0]?.from;
    if (target && scroller.current) {
      const el = scroller.current.querySelector(`#obs-l-${target}`);
      if (el) (el as HTMLElement).scrollIntoView({ block: "center" });
    }
  };
  useEffect(() => { if (code) scrollToLine(); }, [code]);

  if (refs.length === 0) return null;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <Eyebrow>Source {fileAnns.length > 0 ? `· ${fileAnns.length} marked` : ""}</Eyebrow>
        <button className="obs-tab" onClick={() => ref && openInEditor(ref)} style={{ padding: "5px 10px", fontSize: 10 }}>open in editor ↗</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {refs.map((r, i) => {
          const marks = annotations.filter((a) => a.repo === r.repo && a.file === r.file).length;
          return (
            <button key={r.repo + r.file} className="obs-mono" onClick={() => setActive(i)}
                    style={{ fontSize: 11, padding: "4px 9px", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                             border: `1px solid ${i === active ? "var(--obs-line-strong)" : "var(--obs-line)"}`,
                             background: i === active ? "var(--obs-panel-2)" : "transparent",
                             color: i === active ? "var(--obs-text)" : "var(--obs-dim)" }}>
              {r.repo === "b2b" ? "b2b:" : ""}{r.file.split("/").pop()}
              {marks > 0 && <span style={{ fontSize: 9, color: "var(--obs-critical)" }}>●{marks}</span>}
            </button>
          );
        })}
      </div>

      <div style={{ border: "1px solid var(--obs-line)", borderRadius: 10, background: "#0c0c0e", overflow: "hidden" }}>
        <div className="obs-mono" style={{ fontSize: 10.5, color: "var(--obs-faint)", padding: "8px 12px", borderBottom: "1px solid var(--obs-line)" }}>
          {ref?.repo === "b2b" ? "takeover_b2b/" : ""}{ref?.file}
        </div>
        <div ref={scroller} style={{ maxHeight: 380, overflow: "auto" }}>
          {loading && <div style={{ padding: 18, color: "var(--obs-dim)", fontSize: 12.5 }}>Reading file…</div>}
          {error && <div style={{ padding: 18, color: "var(--obs-high)", fontSize: 12.5, lineHeight: 1.6 }}>{error}</div>}
          {!loading && !error && code && (
            <SyntaxHighlighter
              language={langOf(ref?.file || "")} style={vscDarkPlus} showLineNumbers wrapLines
              lineProps={(n: number) => {
                const a = byLine.get(n);
                if (a) return { id: `obs-l-${n}`, style: { display: "block", background: KIND[a.kind].bg, borderLeft: `3px solid ${KIND[a.kind].rail}`, marginLeft: -3, paddingLeft: 6 } } as any;
                if (n === ref?.line) return { id: `obs-l-${n}`, style: { display: "block", background: "rgba(240,146,62,0.14)", borderLeft: "3px solid var(--obs-high)", marginLeft: -3, paddingLeft: 6 } } as any;
                return { style: { display: "block" } } as any;
              }}
              customStyle={{ margin: 0, padding: "10px 4px 12px 0", background: "transparent", fontSize: 12, lineHeight: 1.55 }}
              lineNumberStyle={{ color: "rgba(255,255,255,0.28)", fontSize: 10, minWidth: "2.8em", paddingRight: 12, userSelect: "none" }}
              codeTagProps={{ style: { fontFamily: '"JetBrains Mono", ui-monospace, monospace' } }}
            >
              {code}
            </SyntaxHighlighter>
          )}
        </div>
      </div>

      {/* ordered review steps */}
      {steps.length > 0 && !loading && !error && (
        <div className="obs-panel" style={{ marginTop: 8, padding: "12px 14px", background: "var(--obs-panel-2)" }}>
          <Eyebrow>Review · {steps.length} {steps.some((s) => s.kind === "change") ? "steps" : "spots"}</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
            {steps.map((a, i) => (
              <button key={i} onClick={() => scrollToLine(a.from)}
                      style={{ display: "flex", alignItems: "baseline", gap: 10, textAlign: "left", cursor: "pointer", background: "transparent", border: "none", padding: 0, color: "inherit" }}>
                <span className="obs-mono" style={{ fontSize: 10, color: KIND[a.kind].rail, minWidth: 72, flexShrink: 0 }}>
                  {a.order ? `${a.order}.` : KIND[a.kind].label} L{a.from}{a.to > a.from ? `–${a.to}` : ""}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--obs-dim)", lineHeight: 1.5 }}>{a.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
