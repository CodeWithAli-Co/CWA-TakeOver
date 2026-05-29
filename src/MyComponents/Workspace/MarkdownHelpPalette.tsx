/**
 * MarkdownHelpPalette.tsx — Cheatsheet palette listing every
 * markdown syntax the doc editor supports.
 *
 * Opens via Cmd+/ (or "/" with Cmd, configurable) and the
 * "Markdown" button in the doc detail header. Searchable across
 * names, syntax, and keywords. Sectioned by category. Each row
 * shows the icon, name, monospace syntax sample, optional
 * keyboard shortcut, and a one-line description.
 *
 * This is documentation, not action — clicking a row closes the
 * palette so the user can apply what they learned in the editor.
 * (We deliberately don't try to apply formatting from the palette
 * because there's no active selection while it's open.)
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
}

const CHEATS: Cheat[] = [
  // ── Inline ───────────────────────────────────────────────
  { icon: Bold, name: "Bold", syntax: "**text**", shortcut: "Cmd+B", description: "Strong emphasis", section: "Inline", keywords: ["strong", "weight"] },
  { icon: Italic, name: "Italic", syntax: "*text* or _text_", shortcut: "Cmd+I", description: "Emphasis", section: "Inline", keywords: ["em", "emphasize"] },
  { icon: Strikethrough, name: "Strikethrough", syntax: "~~text~~", shortcut: "Cmd+Shift+S", description: "Cross out", section: "Inline", keywords: ["strike", "delete"] },
  { icon: Underline, name: "Underline", syntax: "—", shortcut: "Cmd+U", description: "Underline (no markdown shorthand)", section: "Inline", keywords: ["underscore"] },
  { icon: Code, name: "Inline code", syntax: "`text`", shortcut: "Cmd+E", description: "Monospace text", section: "Inline", keywords: ["monospace", "snippet"] },
  { icon: Highlighter, name: "Highlight", syntax: "==text==", description: "Highlighted background", section: "Inline", keywords: ["mark", "yellow"] },
  { icon: EyeOff, name: "Spoiler", syntax: "||text||", shortcut: "Cmd+Shift+X", description: "Hidden until clicked", section: "Inline", keywords: ["hide", "blur", "discord"] },
  { icon: SubIcon, name: "Subscript", syntax: "~text~", shortcut: "Cmd+,", description: "Lowered baseline (H₂O)", section: "Inline", keywords: ["below", "chemistry"] },
  { icon: SupIcon, name: "Superscript", syntax: "^text^", shortcut: "Cmd+.", description: "Raised baseline (x²)", section: "Inline", keywords: ["above", "exponent"] },
  { icon: Link2, name: "Link", syntax: "[text](url)", shortcut: "Cmd+K", description: "External hyperlink", section: "Inline", keywords: ["url", "href", "hyperlink"] },

  // ── Headings ─────────────────────────────────────────────
  { icon: Heading1, name: "Heading 1", syntax: "# Title", shortcut: "Cmd+Alt+1", description: "Large section title", section: "Headings", keywords: ["h1"] },
  { icon: Heading2, name: "Heading 2", syntax: "## Subtitle", shortcut: "Cmd+Alt+2", description: "Medium heading", section: "Headings", keywords: ["h2"] },
  { icon: Heading3, name: "Heading 3", syntax: "### Section", shortcut: "Cmd+Alt+3", description: "Small subsection", section: "Headings", keywords: ["h3"] },
  { icon: Heading4, name: "Heading 4", syntax: "#### Detail", shortcut: "Cmd+Alt+4", description: "Tiny subheading", section: "Headings", keywords: ["h4"] },

  // ── Lists ────────────────────────────────────────────────
  { icon: ListOrdered, name: "Numbered list", syntax: "1. item", shortcut: "Cmd+Shift+7", description: "Ordered list", section: "Lists", keywords: ["ol", "ordered", "number"] },
  { icon: ListChecks, name: "Task list", syntax: "- [ ] task", shortcut: "Cmd+Shift+9", description: "Checkbox to-do", section: "Lists", keywords: ["todo", "checkbox"] },

  // ── Blocks ───────────────────────────────────────────────
  { icon: Quote, name: "Blockquote", syntax: "> text", shortcut: "Cmd+Shift+B", description: "Pull quote", section: "Blocks", keywords: ["quote"] },
  { icon: Code2, name: "Code block", syntax: "```lang\ncode\n```", shortcut: "Cmd+Alt+C", description: "Fenced multi-line code", section: "Blocks", keywords: ["pre", "fence"] },
  { icon: Minus, name: "Divider", syntax: "---", description: "Horizontal rule", section: "Blocks", keywords: ["hr", "rule", "separator"] },

  // ── Callouts (Obsidian-style) ────────────────────────────
  { icon: Info, name: "Info callout", syntax: "> [!info] body", description: "Tinted info note (blue)", section: "Callouts", keywords: ["admonition", "obsidian"] },
  { icon: NoteIcon, name: "Note callout", syntax: "> [!note] body", description: "Tinted note (purple)", section: "Callouts", keywords: ["pencil"] },
  { icon: AlertTriangle, name: "Warning callout", syntax: "> [!warning] body", description: "Tinted caution (amber)", section: "Callouts", keywords: ["caution", "danger"] },
  { icon: CheckCircle2, name: "Success callout", syntax: "> [!success] body", description: "Tinted success (green)", section: "Callouts", keywords: ["check", "done"] },
  { icon: XCircle, name: "Danger callout", syntax: "> [!danger] body", description: "Tinted danger (red)", section: "Callouts", keywords: ["error", "stop"] },
  { icon: Sparkles, name: "Axon callout", syntax: "> [!axon] body", shortcut: "Cmd+Shift+C", description: "Brand-accent callout from Axon", section: "Callouts", keywords: ["ai", "insight", "brand"] },

  // ── Media ────────────────────────────────────────────────
  { icon: ImageIcon, name: "Image", syntax: "![alt](url)", description: "Upload via slash menu / paste from clipboard", section: "Media", keywords: ["picture", "photo", "img"] },
  { icon: TableIcon, name: "Table", syntax: "| col | col |\n| --- | --- |", description: "3×3 to start, resizable", section: "Media", keywords: ["grid"] },

  // ── Embeds ───────────────────────────────────────────────
  { icon: FileSymlink, name: "Page link", syntax: "[[Page name]]", description: "Embed link to another workspace doc or sheet", section: "Embeds", keywords: ["wikilink", "ref", "internal", "doc", "sheet"] },
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
  const { open, closePalette } = useMarkdownHelp();
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
        closePalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flatOrder.length, closePalette]);

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
                              onClick={closePalette}
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
                  <kbd className="font-mono bg-foreground/[0.06] rounded px-1">Esc</kbd> close
                </span>
              </div>
              <span className="italic">Cheatsheet only — apply syntax in the editor</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
