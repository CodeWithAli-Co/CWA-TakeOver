/**
 * SlashCommand.tsx — Notion-style "/" command palette for the doc editor.
 *
 * Architecture (standard TipTap pattern):
 *   1. SlashCommand — a thin Extension that wraps @tiptap/suggestion.
 *      It listens for "/" at the start of a line and triggers a
 *      tippy.js-positioned popup whose content is rendered by React.
 *   2. SlashCommandList — the React popup itself. Receives `items`
 *      filtered by the user's query, supports ↑/↓ navigation + Enter
 *      to commit. Exposed via a ref so SlashCommand can forward
 *      keyboard events from ProseMirror.
 *   3. SLASH_ITEMS — the menu's content (block types). Each item
 *      knows its label, keywords (for search), icon, and a `command`
 *      callback that actually mutates the editor state.
 */

import {
  forwardRef, useEffect, useImperativeHandle, useState,
  type ReactNode,
} from "react";
import { Extension, type Range, type Editor } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";

// Distinct plugin key per suggestion extension so we don't collide
// with PageLinkSuggestion (both wrap the suggestion plugin and would
// otherwise both register under the default key "suggestion$").
const slashCommandPluginKey = new PluginKey("slashCommandSuggestion");
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import {
  Heading1, Heading2, Heading3, Heading4,
  ListOrdered, ListChecks, Quote, Code2,
  Minus, Image as ImageIcon, Table as TableIcon,
  EyeOff, Info, AlertTriangle, CheckCircle2, Sparkles,
  FileSymlink,
  type LucideIcon,
} from "lucide-react";
import { uploadWorkspaceImage } from "./imageUpload";

// ──────────────────────────────────────────────────────────────────
// Items definition
// ──────────────────────────────────────────────────────────────────
interface SlashItem {
  title: string;
  description: string;
  icon: LucideIcon;
  keywords?: string[];
  /** Group label — drives the section divider above the first item
   *  in each group. Items with the same `section` cluster together. */
  section: "Headings" | "Lists" | "Block" | "Media" | "Embeds";
  /** Mutates editor state to insert the chosen block. */
  command: (ctx: { editor: Editor; range: Range }) => void;
}

const SLASH_ITEMS: SlashItem[] = [
  // ── Headings ──────────────────────────────────────────────
  {
    title: "Heading 1", description: "Large section title", icon: Heading1, section: "Headings",
    keywords: ["h1", "title"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2", description: "Medium section heading", icon: Heading2, section: "Headings",
    keywords: ["h2"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3", description: "Small subsection heading", icon: Heading3, section: "Headings",
    keywords: ["h3"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "Heading 4", description: "Tiny subsection heading", icon: Heading4, section: "Headings",
    keywords: ["h4"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 4 }).run();
    },
  },
  // ── Lists ─────────────────────────────────────────────────
  {
    title: "Numbered list", description: "List with sequential numbers", icon: ListOrdered, section: "Lists",
    keywords: ["ol", "ordered", "number"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Task list", description: "Checkbox to-do list", icon: ListChecks, section: "Lists",
    keywords: ["todo", "task", "checkbox"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  // ── Block ─────────────────────────────────────────────────
  {
    title: "Quote", description: "Pull quote / blockquote", icon: Quote, section: "Block",
    keywords: ["blockquote"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code block", description: "Fenced multi-line code", icon: Code2, section: "Block",
    keywords: ["pre", "snippet"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    title: "Divider", description: "Horizontal rule between sections", icon: Minus, section: "Block",
    keywords: ["hr", "horizontal", "rule", "separator"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  // ── Callouts (Obsidian-style) ─────────────────────────────
  {
    title: "Info callout", description: "Tinted note for context", icon: Info, section: "Block",
    keywords: ["callout", "admonition", "note"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout("info").run();
    },
  },
  {
    title: "Warning callout", description: "Tinted caution box", icon: AlertTriangle, section: "Block",
    keywords: ["callout", "caution", "warning"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout("warning").run();
    },
  },
  {
    title: "Success callout", description: "Tinted success note", icon: CheckCircle2, section: "Block",
    keywords: ["callout", "success", "tip"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout("success").run();
    },
  },
  {
    title: "Axon callout", description: "Brand-accent note from Axon", icon: Sparkles, section: "Block",
    keywords: ["callout", "axon", "ai", "insight"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCallout("axon").run();
    },
  },
  // ── Special inline ────────────────────────────────────────
  {
    title: "Spoiler", description: "Hidden text — click to reveal", icon: EyeOff, section: "Block",
    keywords: ["hide", "blur", "discord"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: "text",
        text: "spoiler",
        marks: [{ type: "spoiler" }],
      }).run();
    },
  },
  // ── Media ─────────────────────────────────────────────────
  {
    title: "Table", description: "3×3 table to start", icon: TableIcon, section: "Media",
    keywords: ["grid"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    title: "Image", description: "Upload + insert an image", icon: ImageIcon, section: "Media",
    keywords: ["picture", "photo", "img"],
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const { publicUrl } = await uploadWorkspaceImage(file);
          editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
        } catch (e) {
          console.error("[SlashCommand] image upload failed:", e);
          window.alert("Upload failed. See console for details.");
        }
      };
      input.click();
    },
  },
  // ── Embeds ────────────────────────────────────────────────
  {
    title: "Page link", description: "Embed a link to another workspace page", icon: FileSymlink, section: "Embeds",
    keywords: ["wikilink", "ref", "page", "doc", "sheet", "internal"],
    command: ({ editor, range }) => {
      // Delete the slash trigger and insert "[[" so the page-link
      // suggestion picks up from there — the user just keeps typing.
      editor.chain().focus().deleteRange(range).insertContent("[[").run();
    },
  },
];

// ──────────────────────────────────────────────────────────────────
// The popup component
// ──────────────────────────────────────────────────────────────────
interface ListProps {
  items: SlashItem[];
  command: (item: SlashItem) => void;
}

interface ListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const SlashCommandList = forwardRef<ListRef, ListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection whenever the filtered item set changes.
  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((idx) => (idx + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((idx) => (idx + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-popover shadow-xl px-3 py-2 text-[11.5px] text-foreground/55">
        No matches
      </div>
    );
  }

  // Show section dividers when not actively filtering — the
  // sections are about block category, which is less useful when
  // the user has already narrowed by keyword. So if items <= full
  // list we trust the section grouping; otherwise show flat.
  const showSections = items === SLASH_ITEMS;

  return (
    <div
      className="rounded-md border-xs border-border-soft bg-popover shadow-xl overflow-hidden w-[300px] max-h-[360px] overflow-y-auto"
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul className="py-1">
        {items.map((item, idx) => {
          const Icon = item.icon;
          const selected = idx === selectedIndex;
          const prevSection = idx > 0 ? items[idx - 1]?.section : null;
          const showHeader = showSections && item.section !== prevSection;
          return (
            <li key={item.title}>
              {showHeader && (
                <div className="px-3 pt-2 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                  {item.section}
                </div>
              )}
              <button
                type="button"
                onClick={() => selectItem(idx)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={
                  "w-full text-left px-3 py-1.5 flex items-center gap-3 transition-colors " +
                  (selected ? "bg-primary/[0.08]" : "hover:bg-muted/40")
                }
              >
                <span
                  className={
                    "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 border " +
                    (selected
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-muted/30 border-border/60 text-foreground/65")
                  }
                >
                  <Icon size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-foreground truncate">
                    {item.title}
                  </div>
                  <div className="text-[10.5px] text-foreground/45 truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}) as unknown as React.ForwardRefExoticComponent<ListProps & React.RefAttributes<ListRef>> & {
  displayName: string;
};
(SlashCommandList as any).displayName = "SlashCommandList";

// ──────────────────────────────────────────────────────────────────
// The extension
// ──────────────────────────────────────────────────────────────────
function filterItems(query: string): SlashItem[] {
  if (!query) return SLASH_ITEMS;
  const q = query.toLowerCase();
  return SLASH_ITEMS.filter((item) => {
    if (item.title.toLowerCase().includes(q)) return true;
    if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return true;
    return false;
  });
}

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        // Start matching after a space or at the start of a node, so
        // typing "/" in the middle of a URL doesn't open the menu.
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashItem;
        }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: slashCommandPluginKey,
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => filterItems(query),
        render: () => {
          let component: ReactRenderer<ListRef, ListProps> | null = null;
          let popup: TippyInstance[] = [];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandList as any, {
                props,
                editor: props.editor,
              });
              if (!props.clientRect) return;
              popup = tippy("body", {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                animation: "fade",
                duration: [120, 80],
                offset: [0, 6],
              });
            },
            onUpdate(props: any) {
              component?.updateProps(props);
              if (popup[0] && props.clientRect) {
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              }
            },
            onKeyDown(props: any) {
              if (props.event.key === "Escape") {
                popup[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit() {
              popup[0]?.destroy();
              component?.destroy();
              component = null;
              popup = [];
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommand;
