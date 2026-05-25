/**
 * CodeBlock.tsx — Shared syntax-highlighted code surface for the
 * /code module. Wraps react-syntax-highlighter (Prism) with the
 * conventions already established by RegistryCodePreview:
 *   · vscDarkPlus theme so colours read in both app themes (the
 *     code block keeps an editor's signature dark surface even
 *     in light mode — same convention VS Code / Linear use)
 *   · transparent container background so the panel surrounding
 *     it provides the chrome
 *   · line numbers on by default; subtle muted-foreground tint
 *   · optional `lineStates` map for diff overlays — per-line
 *     "add" / "del" / "ctx" applies a coloured background +
 *     left-border rail without breaking syntax tokenization
 *
 * The supported language list mirrors what we actually use across
 * mock data + likely real repos; unknown languages fall through
 * to plain "text" which still renders cleanly.
 */

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export type DiffLineState = "add" | "del" | "ctx";

interface Props {
  code: string;
  /** Either a Prism language id ("typescript", "rust", "json", …)
   *  OR a file extension we map to one. */
  language?: string;
  /** Map of 1-indexed line number → diff state. When provided,
   *  the highlighter renders each line wrapped + we colour the
   *  background to show diff intent. */
  lineStates?: Record<number, DiffLineState>;
  /** Hide gutter line numbers (defaults to showing them). */
  hideLineNumbers?: boolean;
  /** Optional max-height before scroll kicks in. */
  maxHeight?: string;
}

/** Maps a few extension-style hints to Prism language ids so
 *  callers don't have to remember which token Prism expects. */
function normaliseLanguage(input?: string): string {
  if (!input) return "text";
  const v = input.toLowerCase().trim();
  const map: Record<string, string> = {
    ts: "typescript", tsx: "tsx",
    js: "javascript", jsx: "jsx",
    py: "python",
    rs: "rust",
    md: "markdown", mdx: "markdown",
    yml: "yaml",
    sh: "bash",
    html: "markup",
    css: "css",
    json: "json",
    sql: "sql",
    toml: "toml",
  };
  return map[v] ?? v;
}

export function CodeBlock({
  code, language, lineStates, hideLineNumbers, maxHeight,
}: Props) {
  const lang = normaliseLanguage(language);

  return (
    <SyntaxHighlighter
      language={lang}
      style={vscDarkPlus}
      showLineNumbers={!hideLineNumbers}
      wrapLines
      lineProps={(lineNumber: number) => {
        const state = lineStates?.[lineNumber];
        if (!state || state === "ctx") {
          return {
            style: { display: "block" },
          } as any;
        }
        // Coloured background + left-border rail so the diff
        // intent reads at a glance even on dark code surfaces.
        const bg =
          state === "add"
            ? "rgba(16, 185, 129, 0.10)"  // emerald-500/10
            : "rgba(239, 68, 68, 0.10)";  // red-500/10
        const rail =
          state === "add"
            ? "rgba(16, 185, 129, 0.70)"
            : "rgba(239, 68, 68, 0.70)";
        return {
          style: {
            display: "block",
            background: bg,
            borderLeft: `2px solid ${rail}`,
            marginLeft: -2,
            paddingLeft: 6,
          },
        } as any;
      }}
      customStyle={{
        margin: 0,
        padding: "12px 4px 12px 0",
        background: "transparent",
        fontSize: 12,
        lineHeight: 1.55,
        maxHeight,
        overflow: "auto",
      }}
      lineNumberStyle={{
        color: "rgba(255, 255, 255, 0.30)",
        fontSize: 10,
        minWidth: "2.4em",
        paddingRight: 12,
        userSelect: "none",
      }}
      codeTagProps={{
        style: {
          fontFamily:
            'ui-monospace, "JetBrains Mono", "Fira Code", Consolas, monospace',
        },
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
}
