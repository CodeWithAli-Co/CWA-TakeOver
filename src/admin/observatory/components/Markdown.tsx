import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { langOf } from "./CodeViewer";

/** Minimal markdown: fenced code blocks get Prism highlighting (matching the
 *  app), everything else renders as readable prose. Enough for Axon's answers. */
export default function Markdown({ text }: { text: string }) {
  const parts: { type: "code" | "text"; v: string; lang?: string }[] = [];
  const re = /```([\w.+-]*)\n([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ type: "text", v: text.slice(last, m.index) });
    parts.push({ type: "code", lang: m[1] || "text", v: m[2].replace(/\n$/, "") });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", v: text.slice(last) });

  return (
    <div>
      {parts.map((p, i) =>
        p.type === "code" ? (
          <div key={i} style={{ border: "1px solid var(--obs-line)", borderRadius: 8, background: "#0c0c0e", margin: "8px 0", overflow: "auto" }}>
            <SyntaxHighlighter language={langOf("x." + (p.lang || "text"))} style={vscDarkPlus}
              customStyle={{ margin: 0, padding: 12, background: "transparent", fontSize: 11.5, lineHeight: 1.5 }}
              codeTagProps={{ style: { fontFamily: '"JetBrains Mono", ui-monospace, monospace' } }}>
              {p.v}
            </SyntaxHighlighter>
          </div>
        ) : (
          <div key={i} style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.7, color: "var(--obs-text)" }}>{p.v.trim()}</div>
        )
      )}
    </div>
  );
}
