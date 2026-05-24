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
import { useChatStore } from "@/stores/chatStore";

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
  // Subscribe at the top so shortcodes inside renderInline can read them.
  const customEmojis = useChatStore((s) => s.customEmojis);
  if (!text) return null;
  const tokens = tokenize(text);
  return (
    // `[overflow-wrap:anywhere]` is the aggressive sibling of `break-words`
    // — it can break inside long unbroken tokens (URLs, base64 blobs,
    // SQL strings) instead of pushing the message out of its container.
    // Without it, a long unspaced string in a message body forces the
    // bubble wider than the chat column, which is exactly the bug
    // that made the right edge of long pins/messages get clipped.
    <div className="text-[13.5px] text-foreground/85 break-words [overflow-wrap:anywhere] leading-relaxed min-w-0 max-w-full">
      {tokens.map((tok, i) =>
        tok.kind === "code" ? (
          <CodeBlockView key={i} lang={tok.lang} body={tok.body} />
        ) : (
          <ParaView
            key={i}
            body={tok.body}
            currentUsername={currentUsername}
            customEmojis={customEmojis}
          />
        ),
      )}
    </div>
  );
});

// ── Paragraph (inline formatting) ----------------------------------------

function ParaView({
  body, currentUsername, customEmojis,
}: {
  body: string;
  currentUsername?: string;
  customEmojis: Record<string, string>;
}) {
  // Each paragraph keeps whitespace but goes line-by-line for embed detection.
  const lines = body.split("\n");
  const out: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const embeds = detectEmbeds(line);
    out.push(
      <span key={`l-${i}`} className="whitespace-pre-wrap">
        {renderInline(line, currentUsername, customEmojis)}
        {i < lines.length - 1 ? "\n" : ""}
      </span>,
    );
    for (const e of embeds) out.push(<EmbedCard key={`e-${i}-${e.url}`} embed={e} />);
  });
  return <>{out}</>;
}

// ── Inline tokenizer -----------------------------------------------------

const URL_RE = /(https?:\/\/[^\s<]+)/g;

function renderInline(
  line: string,
  currentUsername?: string,
  customEmojis: Record<string, string> = {},
): React.ReactNode[] {
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
      nodes.push(...renderNonCode(line.slice(last, m.index), currentUsername, customEmojis));
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
    nodes.push(...renderNonCode(line.slice(last), currentUsername, customEmojis));
  }
  return nodes;
}

function renderNonCode(
  src: string,
  currentUsername?: string,
  customEmojis: Record<string, string> = {},
): React.ReactNode[] {
  // Bold **x**
  const nodes: React.ReactNode[] = [];
  const boldRe = /\*\*([^*\n]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = boldRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterBold(src.slice(last, m.index), currentUsername, customEmojis));
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

function renderAfterBold(
  src: string,
  currentUsername?: string,
  customEmojis: Record<string, string> = {},
): React.ReactNode[] {
  // Italic *x* — avoid ** (already handled), be strict about surrounding
  const italicRe = /(?<![*\w])\*([^\s*][^*\n]*?)\*(?!\w)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = italicRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterItalic(src.slice(last, m.index), currentUsername, customEmojis));
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

function renderAfterItalic(
  src: string,
  currentUsername?: string,
  customEmojis: Record<string, string> = {},
): React.ReactNode[] {
  // Strike ~~x~~
  const strikeRe = /~~([^~\n]+)~~/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = strikeRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterStrike(src.slice(last, m.index), currentUsername, customEmojis));
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

function renderAfterStrike(
  src: string,
  currentUsername?: string,
  customEmojis: Record<string, string> = {},
): React.ReactNode[] {
  // Labeled links [label](url)
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(src)) !== null) {
    if (m.index > last) {
      nodes.push(...renderAfterLinks(src.slice(last, m.index), currentUsername, customEmojis));
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

function renderAfterLinks(
  src: string,
  currentUsername?: string,
  customEmojis: Record<string, string> = {},
): React.ReactNode[] {
  // Auto-link bare URLs, highlight @mentions, render :shortcode: emojis.
  const combined = /(@[A-Za-z0-9_\-.]+)|(https?:\/\/[^\s<]+)|(:[A-Za-z0-9_+-]{2,32}:)/g;
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
    } else if (m[3]) {
      // :shortcode: → custom emoji image, if registered. Otherwise leave
      // the literal :shortcode: text in place.
      const shortcode = m[3].slice(1, -1);
      const url = customEmojis[shortcode];
      if (url) {
        nodes.push(
          <img
            key={`ce-${m.index}`}
            src={url}
            alt={`:${shortcode}:`}
            title={`:${shortcode}:`}
            className="inline-block h-[18px] w-[18px] align-text-bottom"
            draggable={false}
          />,
        );
      } else {
        nodes.push(m[3]);
      }
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
  kind: "youtube" | "loom" | "github-pr" | "github-issue" | "github"
      | "linear" | "figma" | "notion" | "image" | "generic";
  url: string;
  videoId?: string;
  /** Human-readable ID/slug for cards that show one (PR #123, ISSUE #45). */
  label?: string;
  /** repo / project / page slug shown as subtitle. */
  subtitle?: string;
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
    // GitHub — detect PR / issue specifically so we can show richer info.
    const ghPr = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
    if (ghPr) {
      out.push({ kind: "github-pr", url, label: `#${ghPr[3]}`, subtitle: `${ghPr[1]}/${ghPr[2]}` });
      continue;
    }
    const ghIssue = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/i);
    if (ghIssue) {
      out.push({ kind: "github-issue", url, label: `#${ghIssue[3]}`, subtitle: `${ghIssue[1]}/${ghIssue[2]}` });
      continue;
    }
    if (/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(url)) {
      const repo = url.match(/github\.com\/([^/]+)\/([^/]+)/i);
      out.push({ kind: "github", url, subtitle: repo ? `${repo[1]}/${repo[2]}` : undefined });
      continue;
    }
    // Linear
    const linearIssue = url.match(/linear\.app\/[^/]+\/issue\/([A-Z]+-\d+)/i);
    if (linearIssue) {
      out.push({ kind: "linear", url, label: linearIssue[1] });
      continue;
    }
    // Figma
    if (/^https?:\/\/(www\.)?figma\.com\/(file|proto|design)\//i.test(url)) {
      const name = url.match(/figma\.com\/(?:file|proto|design)\/[^/]+\/([^?]+)/i);
      out.push({
        kind: "figma",
        url,
        subtitle: name ? decodeURIComponent(name[1]).replace(/-/g, " ") : undefined,
      });
      continue;
    }
    // Notion
    if (/^https?:\/\/(www\.)?notion\.so\//i.test(url)) {
      out.push({ kind: "notion", url });
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
    return <EmbedLink label="LOOM" url={embed.url} tone="violet" />;
  }
  if (embed.kind === "github-pr") {
    return (
      <EmbedLink
        label={`GITHUB PR ${embed.label ?? ""}`.trim()}
        url={embed.url}
        subtitle={embed.subtitle}
        tone="emerald"
      />
    );
  }
  if (embed.kind === "github-issue") {
    return (
      <EmbedLink
        label={`GITHUB ISSUE ${embed.label ?? ""}`.trim()}
        url={embed.url}
        subtitle={embed.subtitle}
        tone="amber"
      />
    );
  }
  if (embed.kind === "github") {
    return (
      <EmbedLink label="GITHUB" url={embed.url} subtitle={embed.subtitle} tone="slate" />
    );
  }
  if (embed.kind === "linear") {
    return (
      <EmbedLink
        label={`LINEAR ${embed.label ?? ""}`.trim()}
        url={embed.url}
        tone="indigo"
      />
    );
  }
  if (embed.kind === "figma") {
    return (
      <EmbedLink
        label="FIGMA"
        url={embed.url}
        subtitle={embed.subtitle}
        tone="pink"
      />
    );
  }
  if (embed.kind === "notion") {
    return <EmbedLink label="NOTION" url={embed.url} tone="slate" />;
  }
  return null;
}

const TONE_CLS: Record<string, { border: string; label: string; ring: string }> = {
  slate:   { border: "border-slate-500/30",   label: "text-slate-300",   ring: "bg-slate-500/10" },
  emerald: { border: "border-emerald-500/30", label: "text-emerald-300", ring: "bg-emerald-500/10" },
  amber:   { border: "border-amber-500/30",   label: "text-amber-300",   ring: "bg-amber-500/10" },
  violet:  { border: "border-violet-500/30",  label: "text-violet-300",  ring: "bg-violet-500/10" },
  indigo:  { border: "border-indigo-500/30",  label: "text-indigo-300",  ring: "bg-indigo-500/10" },
  pink:    { border: "border-pink-500/30",    label: "text-pink-300",    ring: "bg-pink-500/10" },
};

function EmbedLink({
  label, url, subtitle, tone = "slate",
}: {
  label: string;
  url: string;
  subtitle?: string;
  tone?: keyof typeof TONE_CLS;
}) {
  const t = TONE_CLS[tone] ?? TONE_CLS.slate;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-1.5 inline-flex max-w-[360px] items-center gap-2 rounded-md border ${t.border} ${t.ring} px-2.5 py-1.5 text-[11px] text-foreground/85 hover:brightness-110`}
    >
      <span className={`font-mono text-[9.5px] uppercase tracking-widest ${t.label}`}>
        {label}
      </span>
      {subtitle ? (
        <span className="truncate max-w-[200px] text-foreground/70">{subtitle}</span>
      ) : (
        <span className="truncate max-w-[220px]">
          {url.replace(/^https?:\/\/(www\.)?/, "")}
        </span>
      )}
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
    </a>
  );
}
