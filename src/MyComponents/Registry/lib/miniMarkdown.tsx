/**
 * miniMarkdown.tsx — zero-dep markdown renderer good enough for
 * READMEs. Supports:
 *   · # H1, ## H2, ### H3
 *   · **bold**, *italic*, `inline code`
 *   · [links](url)
 *   · ```fenced code blocks``` (optional language)
 *   · - bullet lists, 1. numbered lists
 *   · > blockquotes
 *   · --- horizontal rules
 *   · HTML-escaped body text
 *
 * Not supported: tables, images (intentionally — tarballs don't
 * bundle assets reliably), nested lists, inline HTML.
 *
 * Why not react-markdown? One more dep + we already have
 * react-syntax-highlighter for code blocks. This keeps the bundle
 * lean and rendering fully under our control.
 */

import { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Props {
  source: string;
}

export function MiniMarkdown({ source }: Props) {
  const blocks = useMemo(() => parseBlocks(source), [source]);
  return (
    <div className="prose-invert max-w-none text-[13px] leading-relaxed text-foreground/90">
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}

// ── Block-level types + parsing ────────────────────────────────────

type BlockNode =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "hr" }
  | { kind: "code"; lang: string; body: string };

function parseBlocks(src: string): BlockNode[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const ln = lines[i];

    // Fenced code block.
    const fence = /^```(\w*)\s*$/.exec(ln);
    if (fence) {
      const lang = fence[1] || "text";
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ kind: "code", lang, body: body.join("\n") });
      continue;
    }

    // Horizontal rule.
    if (/^\s*(?:---|___|\*\*\*)\s*$/.test(ln)) {
      blocks.push({ kind: "hr" });
      i++;
      continue;
    }

    // Heading.
    const h = /^(#{1,3})\s+(.*)$/.exec(ln);
    if (h) {
      const level = h[1].length;
      blocks.push({ kind: (`h${level}`) as "h1" | "h2" | "h3", text: h[2].trim() });
      i++;
      continue;
    }

    // Bullet list — consume consecutive bullet lines.
    if (/^\s*[-*+]\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Numbered list.
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(ln)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ kind: "quote", text: buf.join(" ") });
      continue;
    }

    // Paragraph — read until blank line.
    if (ln.trim() === "") {
      i++;
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: para.join(" ") });
  }

  return blocks;
}

// ── Inline token parsing (bold / italic / code / link) ─────────────

function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Walk the string, handling the 4 inline patterns in priority order.
  // Priority: code > link > bold > italic (to avoid `*` inside backticks
  // getting italic-wrapped).
  const tokens: Array<{ re: RegExp; render: (m: RegExpExecArray) => React.ReactNode }> = [
    {
      re: /`([^`\n]+)`/,
      render: (m) => <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[11.5px]">{m[1]}</code>,
    },
    {
      re: /\[([^\]]+)\]\(([^)\s]+)\)/,
      render: (m) => (
        <a key={key} href={m[2]} target="_blank" rel="noreferrer" className="text-blue-400 underline-offset-2 hover:underline">{m[1]}</a>
      ),
    },
    {
      re: /\*\*([^*\n]+)\*\*/,
      render: (m) => <strong key={key} className="font-semibold">{m[1]}</strong>,
    },
    {
      re: /\*([^*\n]+)\*/,
      render: (m) => <em key={key} className="italic">{m[1]}</em>,
    },
  ];

  while (remaining.length > 0) {
    // Find earliest match across all patterns.
    let best: { idx: number; tokIdx: number; m: RegExpExecArray } | null = null;
    for (let t = 0; t < tokens.length; t++) {
      const m = tokens[t].re.exec(remaining);
      if (m && (!best || m.index < best.idx)) {
        best = { idx: m.index, tokIdx: t, m };
      }
    }
    if (!best) {
      out.push(remaining);
      break;
    }
    if (best.idx > 0) {
      out.push(remaining.slice(0, best.idx));
    }
    key += 1;
    out.push(tokens[best.tokIdx].render(best.m));
    remaining = remaining.slice(best.idx + best.m[0].length);
  }

  return out;
}

// ── Block renderer ─────────────────────────────────────────────────

function Block({ block }: { block: BlockNode }) {
  switch (block.kind) {
    case "h1": return <h1 className="mt-4 mb-2 text-[18px] font-bold text-foreground">{renderInline(block.text)}</h1>;
    case "h2": return <h2 className="mt-4 mb-2 text-[15px] font-semibold text-foreground">{renderInline(block.text)}</h2>;
    case "h3": return <h3 className="mt-3 mb-1.5 text-[13px] font-semibold text-foreground">{renderInline(block.text)}</h3>;
    case "p":  return <p  className="my-2 leading-relaxed">{renderInline(block.text)}</p>;
    case "hr": return <hr className="my-3 border-border/60" />;
    case "quote":
      return (
        <blockquote className="my-2 border-l-2 border-blue-500/40 bg-blue-500/5 pl-3 py-1 italic text-foreground/80">
          {renderInline(block.text)}
        </blockquote>
      );
    case "ul":
      return (
        <ul className="my-2 list-disc list-inside space-y-1">
          {block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
        </ul>
      );
    case "ol":
      return (
        <ol className="my-2 list-decimal list-inside space-y-1">
          {block.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
        </ol>
      );
    case "code":
      return (
        <div className="my-2 overflow-hidden rounded-md border border-border/60">
          <SyntaxHighlighter
            language={block.lang}
            style={vscDarkPlus}
            customStyle={{ margin: 0, fontSize: 11.5, background: "hsl(var(--muted) / 0.3)" }}
            showLineNumbers={false}
          >
            {block.body}
          </SyntaxHighlighter>
        </div>
      );
  }
}
