/**
 * MessageText.tsx — Render chat message body with minimal markdown,
 * auto-linking, @mention highlighting, and URL preview cards.
 *
 * Supported syntax (parsed top-down):
 *   · Fenced code blocks:  ```lang\n...\n```
 *   · Inline code:         `code`
 *   · Bold:                **bold**
 *   · Italic:              *italic* (but not _underscore to avoid username pain)
 *   · Strike:              ~~strike~~
 *   · Links:               [label](https://...)
 *   · Bare URLs            → auto-linked (with preview if YouTube/Loom/GitHub)
 *   · @mention             highlighted chip; triggers notifications on send
 *
 * Purposefully lightweight — no npm dep. Good enough for chat.
 */

import { memo, useState } from "react";
import { Check, Copy, ExternalLink, Play } from "lucide-react";

interface Props {
  text: string;
  /** Current user's name, used to highlight self-mentions differently. */
  currentUsername?: string;
}

// Tokenise into segments: code-block | text.
// Then render each text segment with inline formatting.

interface CodeBlock {
  kind: "code";
  lang: string;
  body: string;
}
interface Para {
  kind: "para";
  body: string;
}

const FENCE = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;

function tokenize(src: string): (CodeBlock | Para)[] {
  const out: (CodeBlock | Para)[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  FENCE.lastIndex = 0;
  while ((match = FENCE.exec(src)) !== null) {
    if (match.index > last) {
      out.push({ kind: "para", body: src.slice(last, match.index) });
    }
    out.push({ kind: "code", lang: match[1] || "", body: match[2] || "" });
    last = FENCE.lastIndex;
  }
  if (last < src.length) {
    out.push({ kind: "para", body: src.slice(last) });
  }
  return out;
}

export const MessageText = memo(function MessageText({
  text, currentUsername,
}: Props) {
  if (!text) return null;
  const tokens = tokenize(text);
  return (
    <div className="text-[13.5px] text-foreground/85 break-words leading-relaxed">
      {tokens.map((tok, i) =>
        tok.kind === "code" ? (
          <CodeBlockView key={i} lang={tok.lang} body={tok.body} />
        ) : (
          <ParaView
            key={i}
            body={tok.body}
            currentUsername={currentUsername}
          />
        ),
      )}
    </div>
  );
});

// ── Paragraph (inline formatting) ----------------------------------------

function ParaView({
  body, currentUsername,
}: {
  body: string;
  currentUsername?: string;
}) {
  // Each paragraph keeps whitespace but goes line-by-line for embed detection.
  const lines = body.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const embeds = detectEmbeds(line);
    if (embeds.length > 0) {
      // Render the line text + an embed card underneath.
      out.push(
        <span key={`l-${i}`} className="whitespace-pre-wrap">
          {renderInline(line, currentUsername)}
          {i < lines.length - 1 ? "\n" : ""}
        </span>,
      );
      for (const e of embeds) out.push(<EmbedCard key={`e-${i}-${e.url}`} embed={e} />);
    } else {
      out.push(
        <span key={`l-${i}`} className="whitespace-pre-wrap">
          {renderInline(line, currentUsername)}
          {i < lines.length - 1 ? "\n" : ""}
        </span>,
      );
    }
  });
  return <>{out}</>;
}

// ── Inline tokenizer -----------------------------------------------------

const URL_RE = /(https?:\/\/[^\s<]+)/g;

function renderInline(line: string, currentUsername?: string): React.ReactNode[] {
  // Process in multiple passes: code → bold → italic → strike → mentions → links
  // We split then recombine. Order matters: code first so markdown inside
  // backticks is preserved as literal.

  // Split on inline-code first
  const nodes: React.ReactNode[] = [];
  const codeRe = /`([^`\n]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = codeRe.exec(line)) !== null) {
    if (m.index > last) {
      nodes.push(...renderNonCode(line.slice(last, m.index), currentUsername));
    }
    nodes.push(
      <code
        key={`c-${m.index}`}
        className="rounded border border-border bg-muted/40 px-1 py-0.5 text-[12px] font-mono text-foreground/90"
      >
        {m[1]}
      </code>,
    );
    last = codeRe.lastIndex;
  }
  if (last < line.length) {
    nodes.push(...renderNonCode(line.slice(last), currentUsername));
  }
  return nodes;
}

function renderNonCode(src: string, currentUsername?: string): React.ReactNode[] {
  // Bold **x**
  const nodes: React.ReactNode[] = [];
  const boldRe = /\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterBold(src.slice(last, m.index), currentUsername));
    }
    nodes.push(
      <strong key={`b-${m.index}`} className="font-semibold text-foreground">
        {m[1]}
      </strong>,
    );
    last = boldRe.lastIndex;
  }
  if (last < src.length) {
    nodes.push(...renderAfterBold(src.slice(last), currentUsername));
  }
  return nodes;
}

function renderAfterBold(src: string, currentUsername?: string): React.ReactNode[] {
  // Italic *x* — avoid ** (already handled), be strict about surrounding
  const italicRe = /(?<![*\w])\*([^\s*][^*\n]*?)\*(?!\w)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = italicRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterItalic(src.slice(last, m.index), currentUsername));
    }
    nodes.push(
      <em key={`i-${m.index}`} className="italic text-foreground/90">
        {m[1]}
      </em>,
    );
    last = italicRe.lastIndex;
  }
  if (last < src.length) {
    nodes.push(...renderAfterItalic(src.slice(last), currentUsername));
  }
  return nodes;
}

function renderAfterItalic(src: string, currentUsername?: string): React.ReactNode[] {
  // Strike ~~x~~
  const strikeRe = /~~([^~\n]+)~~/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = strikeRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterStrike(src.slice(last, m.index), currentUsername));
    }
    nodes.push(
      <s key={`s-${m.index}`} className="text-muted-foreground line-through">
        {m[1]}
      </s>,
    );
    last = strikeRe.lastIndex;
  }
  if (last < src.length) {
    nodes.push(...renderAfterStrike(src.slice(last), currentUsername));
  }
  return nodes;
}

function renderAfterStrike(src: string, currentUsername?: string): React.ReactNode[] {
  // Labeled links [label](url)
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterLinks(src.slice(last, m.index), currentUsername));
    }
    nodes.push(
      <a
        key={`a-${m.index}`}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
      >
        {m[1]}
      </a>,
    );
    last = linkRe.lastIndex;
  }
  if (last < src.length) {
    nodes.push(...renderAfterLinks(src.slice(last), currentUsername));
  }
  return nodes;
}

function renderAfterLinks(src: string, currentUsername?: string): React.ReactNode[] {
  // Auto-link bare URLs + highlight @mentions
  const combined = /(@[A-Za-z0-9_\-.]+)|(https?:\/\/[^\s<]+)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(src.slice(last, m.index));
    }
    if (m[1]) {
      const name = m[1].slice(1);
      const isSelf = currentUsername != null && name === currentUsername;
      nodes.push(
        <span
          key={`m-${m.index}`}
          className={
            isSelf
              ? "rounded px-1 py-0.5 bg-primary/25 text-primary font-semibold"
              : "rounded px-0.5 text-primary font-medium"
          }
        >
          {m[1]}
        </span>,
      );
    } else if (m[2]) {
      nodes.push(
        <a
          key={`u-${m.index}`}
          href={m[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          {m[2]}
        </a>,
      );
    }
    last = combined.lastIndex;
  }
  if (last < src.length) {
    nodes.push(src.slice(last));
  }
  return nodes;
}

// ── Code block view ------------------------------------------------------

function CodeBlockView({ lang, body }: { lang: string; body: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };
  return (
    <pre className="relative my-1.5 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 font-mono text-[11.5px] leading-relaxed text-foreground/85">
      {lang && (
        <span className="absolute left-2 top-1 text-[9px] uppercase tracking-widest text-muted-foreground">
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      </button>
      <code className={`block ${lang ? "pt-3" : ""}`}>{body}</code>
    </pre>
  );
}

// ── Embed detection + cards ---------------------------------------------

interface Embed {
  kind: "youtube" | "loom" | "github" | "image" | "generic";
  url: string;
  videoId?: string;
}

function detectEmbeds(line: string): Embed[] {
  const out: Embed[] = [];
  URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = URL_RE.exec(line)) !== null) {
    const url = m[1]!;
    // YouTube
    const ytMatch = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/,
    );
    if (ytMatch) {
      out.push({ kind: "youtube", url, videoId: ytMatch[1] });
      continue;
    }
    // Loom
    if (/loom\.com\/share\/[a-f0-9]+/i.test(url)) {
      out.push({ kind: "loom", url });
      continue;
    }
    // GitHub
    if (/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(url)) {
      out.push({ kind: "github", url });
      continue;
    }
    // Image (already rendered by MessageBubble image gallery; skip here)
    if (/\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url)) continue;
  }
  return out;
}

function EmbedCard({ embed }: { embed: Embed }) {
  if (embed.kind === "youtube" && embed.videoId) {
    return (
      <a
        href={embed.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex max-w-[320px] items-center gap-3 rounded-md border border-border bg-card p-2 hover:border-primary/40"
      >
        <div className="relative h-16 w-24 overflow-hidden rounded bg-black">
          <img
            src={`https://i.ytimg.com/vi/${embed.videoId}/mqdefault.jpg`}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Play className="h-5 w-5 fill-white text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary">
            YouTube
          </div>
          <div className="truncate text-[11.5px] text-foreground/80">
            {embed.url.replace(/^https?:\/\/(www\.)?/, "")}
          </div>
        </div>
      </a>
    );
  }
  if (embed.kind === "loom") {
    return (
      <EmbedLink label="LOOM" url={embed.url} />
    );
  }
  if (embed.kind === "github") {
    return (
      <EmbedLink label="GITHUB" url={embed.url} />
    );
  }
  return null;
}

function EmbedLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] text-foreground/85 hover:border-primary/40"
    >
      <span className="font-mono text-[9.5px] uppercase tracking-widest text-primary">
        {label}
      </span>
      <span className="truncate max-w-[260px]">
        {url.replace(/^https?:\/\/(www\.)?/, "")}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  );
}
