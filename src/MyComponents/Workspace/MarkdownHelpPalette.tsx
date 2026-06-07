/**
 * MarkdownHelpPalette.tsx — Insert palette listing every
 * markdown syntax the doc editor supports.
 *
 * Opens via Cmd+/ (or "/" with Cmd, configurable) and the
 * "Markdown" button in the doc detail header. Searchable across
 * names, syntax, and keywords. Sectioned by category. Each row
 * shows the icon, name, monospace syntax sample, optional
 * keyboard shortcut, and a one-line description.
 *
 * Click ANY row -> the formatting is applied to the active editor
 * at the current cursor / selection. For simple inline marks
 * (bold, italic, code, strike) we use TipTap's toggle commands so
 * the operation is reversible and respects current selection. For
 * block-level constructs (callouts, page links, dividers) we
 * insert the markdown text directly and let TipTap's input rules
 * convert it. The editor is read from markdownHelpStore, which
 * DocEditor registers on mount.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, X,
  Bold, Italic, Strikethrough, Code, Underline,
  Heading1, Heading2, Heading3, Heading4,
  ListOrdered, ListChecks,
  Quote, Code2, Minus,
  Image as ImageIcon, Table as TableIcon,
  Link2, FileSymlink,
  EyeOff, Sparkles, Info, AlertTriangle, CheckCircle2,
  Pencil as NoteIcon, XCircle,
  Highlighter, Superscript as SupIcon, Subscript as SubIcon,
  type LucideIcon,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { useMarkdownHelp } from "./markdownHelpStore";

type Section =
  | "Inline"
  | "Headings"
  | "Lists"
  | "Blocks"
  | "Callouts"
  | "Media"
  | "Embeds";

interface Cheat {
  icon: LucideIcon;
  name: string;
  /** Markdown syntax sample, rendered in monospace. */
  syntax: string;
  /** Optional keyboard shortcut shown as a kbd chip. */
  shortcut?: string;
  description: string;
  section: Section;
  keywords?: string[];
  /**
   * What happens when the user clicks this row. Receives the active
   * TipTap editor. If undefined, falls back to inserting `syntax` as
   * raw text -- TipTap input rules pick most markdown up from there.
   *
   * Prefer TipTap commands (toggleBold, toggleHeading) for inline
   * marks + headings because they respect the existing selection and
   * are reversible. Block-level inserts (callouts, page links) drop
   * raw markdown text + position the cursor inside the placeholder.
   */
  apply?: (editor: Editor) => void;
}

// Helper: insert a block of markdown text at cursor position. Used by
// cheats that don't have a corresponding TipTap command. We focus
// first so the insertion happens at the right place (palette steals
// focus while open).
function insertRaw(editor: Editor, text: string): void {
  editor.chain().focus().insertContent(text).run();
}

// Helper: invoke the Callout extension's custom setCallout command.
// The command lives on the editor's chain but isn't in the base
// ChainedCommands type, so we cast through unknown to call it.
type CalloutType = "info" | "note" | "warning" | "success" | "danger" | "axon";
function applyCallout(editor: Editor, type: CalloutType): void {
  const chain = editor.chain().focus() as unknown as {
    setCallout: (type: CalloutType) => { run: () => void };
  };
  chain.setCallout(type).run();
}

// Normalise whatever the user types into the prompt into a valid
// link href. Bare domains get "https://" prepended; mailto: / tel: /
// existing schemes pass through; empty input returns null so the
// caller knows to abort.
function normaliseHref(raw: string | null): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// Helper: apply a Link mark properly so the result is clickable. The
// old palette path inserted "[text](url)" as plain text -- TipTap has
// no input rule for that markdown shape, so the result just sat as
// characters. Now we prompt for the URL, then either wrap the current
// selection or insert "link" and select it before setting the mark.
function applyLink(editor: Editor): void {
  const { state } = editor;
  const { from, to, empty } = state.selection;
  // Best-effort URL prompt. Falls back to a placeholder so the user can
  // still edit via the bubble menu if they cancel.
  const input = typeof window !== "undefined"
    ? window.prompt("Link URL", "https://")
    : "https://";
  const href = normaliseHref(input) ?? "https://";

  if (empty) {
    // No selection -- insert "link", select it, then apply the mark.
    // We compute the explicit range so setLink applies cleanly.
    const placeholder = "link";
    editor
      .chain()
      .focus()
      .insertContent(placeholder)
      .setTextSelection({ from, to: from + placeholder.length })
      .setLink({ href })
      .run();
  } else {
    // Wrap the existing selection. extendMarkRange covers the case
    // where the caret is in the middle of an already-linked word.
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href })
      .setTextSelection({ from, to })
      .run();
  }
}

// Helper: insert an Image node via the TipTap Image extension's
// setImage command. Like applyLink, this prompts for the URL so the
// result is a real rendered image rather than literal markdown text.
function applyImage(editor: Editor): void {
  const raw = typeof window !== "undefined"
    ? window.prompt("Image URL", "https://")
    : null;
  const src = normaliseHref(raw);
  if (!src) return;
  const altInput = typeof window !== "undefined"
    ? window.prompt("Alt text (optional)", "")
    : "";
  const alt = (altInput ?? "").trim() || "Image";
  editor.chain().focus().setImage({ src, alt }).run();
}

const CHEATS: Cheat[] = [
  // ── Inline ───────────────────────────────────────────────
  // For toggle marks: if there's a selection we wrap it; if there
  // isn't, TipTap enters mark-active mode so the next typed char
  // gets the mark. That's the right "click then type" UX.
  { icon: Bold, name: "Bold", syntax: "**text**", shortcut: "Cmd+B", description: "Strong emphasis", section: "Inline", keywords: ["strong", "weight"],
    apply: (e) => e.chain().focus().toggleBold().run() },
  { icon: Italic, name: "Italic", syntax: "*text* or _text_", shortcut: "Cmd+I", description: "Emphasis", section: "Inline", keywords: ["em", "emphasize"],
    apply: (e) => e.chain().focus().toggleItalic().run() },
  { icon: Strikethrough, name: "Strikethrough", syntax: "~~text~~", shortcut: "Cmd+Shift+S", description: "Cross out", section: "Inline", keywords: ["strike", "delete"],
    apply: (e) => e.chain().focus().toggleStrike().run() },
  { icon: Underline, name: "Underline", syntax: "—", shortcut: "Cmd+U", description: "Underline (no markdown shorthand)", section: "Inline", keywords: ["underscore"],
    // Underline extension may or may not be installed; fall back via
    // commands.toggleMark which is a no-op if the mark isn't registered.
    apply: (e) => {
      const chain = e.chain().focus() as ReturnType<Editor["chain"]> & {
        toggleUnderline?: () => ReturnType<Editor["chain"]>;
      };
      if (chain.toggleUnderline) chain.toggleUnderline().run();
      else e.chain().focus().insertContent("<u>text</u>").run();
    } },
  { icon: Code, name: "Inline code", syntax: "`text`", shortcut: "Cmd+E", description: "Monospace text", section: "Inline", keywords: ["monospace", "snippet"],
    apply: (e) => e.chain().focus().toggleCode().run() },
  { icon: Highlighter, name: "Highlight", syntax: "==text==", description: "Highlighted background", section: "Inline", keywords: ["mark", "yellow"],
    apply: (e) => {
      const chain = e.chain().focus() as ReturnType<Editor["chain"]> & {
        toggleHighlight?: () => ReturnType<Editor["chain"]>;
      };
      if (chain.toggleHighlight) chain.toggleHighlight().run();
      else insertRaw(e, "==text==");
    } },
  { icon: EyeOff, name: "Spoiler", syntax: "||text||", shortcut: "Cmd+Shift+X", description: "Hidden until clicked", section: "Inline", keywords: ["hide", "blur", "discord"],
    // Spoiler is a custom Mark named "spoiler". insertContent doesn't
    // fire TipTap input rules, so the raw `||text||` syntax would just
    // sit as plain text. Use toggleMark directly so the next typed
    // char (or any existing selection) actually gets the mark.
    apply: (e) => e.chain().focus().toggleMark("spoiler").run() },
  { icon: SubIcon, name: "Subscript", syntax: "~text~", shortcut: "Cmd+,", description: "Lowered baseline (H₂O)", section: "Inline", keywords: ["below", "chemistry"],
    // Same input-rule bypass issue -- use the underlying mark.
    apply: (e) => e.chain().focus().toggleMark("subscript").run() },
  { icon: SupIcon, name: "Superscript", syntax: "^text^", shortcut: "Cmd+.", description: "Raised baseline (x²)", section: "Inline", keywords: ["above", "exponent"],
    apply: (e) => e.chain().focus().toggleMark("superscript").run() },
  { icon: Link2, name: "Link", syntax: "[text](url)", shortcut: "Cmd+K", description: "External hyperlink", section: "Inline", keywords: ["url", "href", "hyperlink"],
    // TipTap's Link extension has no `[text](url)` input rule, so the
    // old insertContent path left the markdown shape as literal text.
    // Prompt the operator for the URL, then either wrap the existing
    // selection or insert "link" and wrap it -- both branches end up
    // with a real Link mark so the result is clickable + editable via
    // the bubble menu.
    apply: (e) => applyLink(e) },

  // ── Headings ─────────────────────────────────────────────
  // Heading toggles convert the current line/block to a heading at
  // the chosen level (or back to paragraph if already that level).
  { icon: Heading1, name: "Heading 1", syntax: "# Title", shortcut: "Cmd+Alt+1", description: "Large section title", section: "Headings", keywords: ["h1"],
    apply: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { icon: Heading2, name: "Heading 2", syntax: "## Subtitle", shortcut: "Cmd+Alt+2", description: "Medium heading", section: "Headings", keywords: ["h2"],
    apply: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { icon: Heading3, name: "Heading 3", syntax: "### Section", shortcut: "Cmd+Alt+3", description: "Small subsection", section: "Headings", keywords: ["h3"],
    apply: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { icon: Heading4, name: "Heading 4", syntax: "#### Detail", shortcut: "Cmd+Alt+4", description: "Tiny subheading", section: "Headings", keywords: ["h4"],
    apply: (e) => e.chain().focus().toggleHeading({ level: 4 }).run() },

  // ── Lists ────────────────────────────────────────────────
  { icon: ListOrdered, name: "Numbered list", syntax: "1. item", shortcut: "Cmd+Shift+7", description: "Ordered list", section: "Lists", keywords: ["ol", "ordered", "number"],
    apply: (e) => e.chain().focus().toggleOrderedList().run() },
  { icon: ListChecks, name: "Task list", syntax: "- [ ] task", shortcut: "Cmd+Shift+9", description: "Checkbox to-do", section: "Lists", keywords: ["todo", "checkbox"],
    apply: (e) => {
      const chain = e.chain().focus() as ReturnType<Editor["chain"]> & {
        toggleTaskList?: () => ReturnType<Editor["chain"]>;
      };
      if (chain.toggleTaskList) chain.toggleTaskList().run();
      else insertRaw(e, "- [ ] task");
    } },

  // ── Blocks ───────────────────────────────────────────────
  { icon: Quote, name: "Blockquote", syntax: "> text", shortcut: "Cmd+Shift+B", description: "Pull quote", section: "Blocks", keywords: ["quote"],
    apply: (e) => e.chain().focus().toggleBlockquote().run() },
  { icon: Code2, name: "Code block", syntax: "```lang\ncode\n```", shortcut: "Cmd+Alt+C", description: "Fenced multi-line code", section: "Blocks", keywords: ["pre", "fence"],
    apply: (e) => e.chain().focus().toggleCodeBlock().run() },
  { icon: Minus, name: "Divider", syntax: "---", description: "Horizontal rule", section: "Blocks", keywords: ["hr", "rule", "separator"],
    apply: (e) => e.chain().focus().setHorizontalRule().run() },

  // ── Callouts (Obsidian-style) ────────────────────────────
  // The Callout node has typed commands (setCallout / toggleCallout)
  // registered in markdownExtensions.ts. Using those directly is the
  // only way the palette can drop a real callout block -- insertContent
  // bypasses the markdown input rule that would otherwise convert
  // "> [!info] " into the styled block.
  { icon: Info, name: "Info callout", syntax: "> [!info] body", description: "Tinted info note (blue)", section: "Callouts", keywords: ["admonition", "obsidian"],
    apply: (e) => applyCallout(e, "info") },
  { icon: NoteIcon, name: "Note callout", syntax: "> [!note] body", description: "Tinted note (purple)", section: "Callouts", keywords: ["pencil"],
    apply: (e) => applyCallout(e, "note") },
  { icon: AlertTriangle, name: "Warning callout", syntax: "> [!warning] body", description: "Tinted caution (amber)", section: "Callouts", keywords: ["caution", "danger"],
    apply: (e) => applyCallout(e, "warning") },
  { icon: CheckCircle2, name: "Success callout", syntax: "> [!success] body", description: "Tinted success (green)", section: "Callouts", keywords: ["check", "done"],
    apply: (e) => applyCallout(e, "success") },
  { icon: XCircle, name: "Danger callout", syntax: "> [!danger] body", description: "Tinted danger (red)", section: "Callouts", keywords: ["error", "stop"],
    apply: (e) => applyCallout(e, "danger") },
  { icon: Sparkles, name: "Axon callout", syntax: "> [!axon] body", shortcut: "Cmd+Shift+C", description: "Brand-accent callout from Axon", section: "Callouts", keywords: ["ai", "insight", "brand"],
    apply: (e) => applyCallout(e, "axon") },

  // ── Media ────────────────────────────────────────────────
  { icon: ImageIcon, name: "Image", syntax: "![alt](url)", description: "Prompt for URL, or paste / drop a file in the doc", section: "Media", keywords: ["picture", "photo", "img"],
    // Image extension exposes setImage. We prompt for the URL so the
    // node lands rendered, not as literal "![alt](url)" text. For real
    // uploads operators should drag-and-drop or paste -- DocEditor has
    // a paste-drop plugin wired to the workspace storage bucket.
    apply: (e) => applyImage(e) },
  { icon: TableIcon, name: "Table", syntax: "| col | col |\n| --- | --- |", description: "3×3 to start, resizable", section: "Media", keywords: ["grid"],
    apply: (e) => {
      const chain = e.chain().focus() as ReturnType<Editor["chain"]> & {
        insertTable?: (opts: { rows: number; cols: number; withHeaderRow: boolean }) => ReturnType<Editor["chain"]>;
      };
      if (chain.insertTable) chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      else insertRaw(e, "| col1 | col2 | col3 |\n| --- | --- | --- |\n|  |  |  |\n");
    } },

  // ── Embeds ───────────────────────────────────────────────
  // Page link insertion drops the [[ ]] form -- the PageLinkSuggestion
  // extension picks up the brackets and shows the autocomplete dropdown.
  { icon: FileSymlink, name: "Page link", syntax: "[[Page name]]", description: "Embed link to another workspace doc or sheet", section: "Embeds", keywords: ["wikilink", "ref", "internal", "doc", "sheet"],
    apply: (e) => insertRaw(e, "[[") },
];

const SECTION_ORDER: Section[] = [
  "Inline",
  "Headings",
  "Lists",
  "Blocks",
  "Callouts",
  "Media",
  "Embeds",
];

function matches(c: Cheat, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (c.name.toLowerCase().includes(needle)) return true;
  if (c.syntax.toLowerCase().includes(needle)) return true;
  if (c.description.toLowerCase().includes(needle)) return true;
  if (c.keywords?.some((k) => k.toLowerCase().includes(needle))) return true;
  if (c.section.toLowerCase().includes(needle)) return true;
  return false;
}

export function MarkdownHelpPalette() {
  const { open, closePalette, editor } = useMarkdownHelp();

  // Apply a cheat to the active editor and close the palette. If no
  // editor is registered (rare -- means the palette was opened outside
  // a doc context), fall back to inserting raw syntax... well, there's
  // nothing to insert into, so we just close.
  const applyCheat = (cheat: Cheat) => {
    if (editor) {
      if (cheat.apply) cheat.apply(editor);
      else insertRaw(editor, cheat.syntax);
    }
    closePalette();
  };
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => CHEATS.filter((c) => matches(c, query)), [query]);

  // Group filtered into sections preserving section order.
  const grouped = useMemo(() => {
    const buckets = new Map<Section, Cheat[]>();
    for (const c of filtered) {
      const arr = buckets.get(c.section) ?? [];
      arr.push(c);
      buckets.set(c.section, arr);
    }
    return SECTION_ORDER.filter((s) => buckets.has(s)).map((s) => ({
      section: s,
      items: buckets.get(s)!,
    }));
  }, [filtered]);

  // Flat order corresponding to render order — for arrow navigation.
  const flatOrder = useMemo(
    () => grouped.flatMap((g) => g.items),
    [grouped],
  );

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Keyboard nav + close on Esc.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(flatOrder.length - 1, 0)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cheat = flatOrder[activeIdx];
        if (cheat) applyCheat(cheat);
        else closePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // applyCheat captures editor + closePalette via closure; we include
    // editor in deps so a re-registered editor takes effect mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flatOrder.length, closePalette, activeIdx, editor]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[220] flex items-start justify-center pt-[12vh] px-4 bg-background/65 backdrop-blur-sm"
          onClick={closePalette}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[640px] rounded-xl border-xs border-border-soft bg-card shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Markdown cheatsheet"
          >
            {/* Header / search */}
            <div className="flex items-center justify-between border-b border-xs border-border-soft px-4 py-2.5 bg-popover/60">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-3.5 w-3.5 text-text-tertiary" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search markdown… (bold, callout, page link)"
                  className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-text-tertiary outline-none"
                />
                <span className="text-[10px] text-text-tertiary">
                  {flatOrder.length} of {CHEATS.length}
                </span>
              </div>
              <button
                type="button"
                onClick={closePalette}
                aria-label="Close"
                className="ml-3 h-6 w-6 flex items-center justify-center rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {grouped.length === 0 ? (
                <div className="px-5 py-8 text-center text-[12px] text-text-tertiary italic">
                  Nothing matches &ldquo;{query}&rdquo;.
                </div>
              ) : (
                grouped.map(({ section, items }) => (
                  <div key={section} className="py-1">
                    <div className="px-4 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                      {section}
                    </div>
                    <ul className="list-none p-0 m-0">
                      {items.map((c) => {
                        const flatIdx = flatOrder.indexOf(c);
                        const isActive = flatIdx === activeIdx;
                        const Icon = c.icon;
                        return (
                          <li key={c.name} className="list-none">
                            <button
                              type="button"
                              onMouseEnter={() => setActiveIdx(flatIdx)}
                              onClick={() => applyCheat(c)}
                              className={
                                "w-full flex items-center gap-3 px-4 py-1.5 text-left transition-colors " +
                                (isActive
                                  ? "bg-foreground/[0.06]"
                                  : "hover:bg-foreground/[0.03]")
                              }
                            >
                              <span
                                className={
                                  "h-6 w-6 rounded-md flex items-center justify-center shrink-0 border-xs " +
                                  (isActive
                                    ? "bg-primary/15 border-primary/30 text-primary"
                                    : "bg-foreground/[0.04] border-border-soft text-foreground/70")
                                }
                              >
                                <Icon className="h-3 w-3" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[12.5px] font-semibold text-foreground">
                                    {c.name}
                                  </span>
                                  <code className="text-[10.5px] font-mono text-text-tertiary bg-foreground/[0.04] rounded px-1.5 py-[1px] truncate max-w-[220px]">
                                    {c.syntax}
                                  </code>
                                </div>
                                <div className="text-[10.5px] text-text-tertiary truncate">
                                  {c.description}
                                </div>
                              </div>
                              {c.shortcut && (
                                <kbd className="text-[10px] font-mono text-text-tertiary bg-foreground/[0.04] border-xs border-border-soft rounded px-1.5 py-[1px] shrink-0">
                                  {c.shortcut}
                                </kbd>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between border-t border-xs border-border-soft bg-popover/40 px-4 py-2 text-[10px] text-text-tertiary">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="font-mono bg-foreground/[0.06] rounded px-1">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="font-mono bg-foreground/[0.06] rounded px-1">↵</kbd> insert
                </span>
                <span>
                  <kbd className="font-mono bg-foreground/[0.06] rounded px-1">Esc</kbd> close
                </span>
              </div>
              <span className="italic">
                {editor
                  ? "Click any row to insert it into the doc"
                  : "Open a doc to insert from this palette"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
