/**
 * PageLinkSuggestion.tsx — Wikilink autocomplete for the doc editor.
 *
 * Trigger: type `[[` anywhere. A floating popup appears with
 * matching docs + sheets from the workspace. Arrow keys navigate,
 * Enter inserts. The inserted node is a PageLink atom that lives
 * inline with text — clicking it (handled in DocEditor) navigates
 * to that resource without a page reload.
 *
 * Search source: supabase workspace_documents + workspace_spreadsheets
 * combined, with the result cached for the duration of an editor
 * session. Fuzzy substring match on title.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";

// Distinct plugin key — SlashCommand uses its own. Without this,
// both extensions register under the default key "suggestion$" and
// ProseMirror throws "Adding different instances of a keyed plugin".
const pageLinkPluginKey = new PluginKey("pageLinkSuggestion");
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { FileText, Table as TableIcon } from "lucide-react";
import { companySupabase } from "@/routes/index.lazy";

interface PageRef {
  id: string;
  kind: "document" | "spreadsheet";
  title: string;
}

// Tiny module-level cache so the suggestion doesn't re-query on
// every keystroke. Refreshed once per editor mount via refresh().
let __pageRefsCache: PageRef[] | null = null;
let __pageRefsPromise: Promise<PageRef[]> | null = null;

async function fetchAllPageRefs(): Promise<PageRef[]> {
  if (__pageRefsCache) return __pageRefsCache;
  if (__pageRefsPromise) return __pageRefsPromise;
  __pageRefsPromise = (async () => {
    const [docsRes, sheetsRes] = await Promise.all([
      companySupabase
        .from("workspace_documents")
        .select("id, title, archived")
        .order("updated_at", { ascending: false }),
      companySupabase
        .from("workspace_spreadsheets")
        .select("id, title, archived")
        .order("updated_at", { ascending: false }),
    ]);
    const docs: PageRef[] = (docsRes.data ?? [])
      .filter((r: any) => !r.archived)
      .map((r: any) => ({ id: r.id, kind: "document" as const, title: r.title || "Untitled" }));
    const sheets: PageRef[] = (sheetsRes.data ?? [])
      .filter((r: any) => !r.archived)
      .map((r: any) => ({ id: r.id, kind: "spreadsheet" as const, title: r.title || "Untitled" }));
    __pageRefsCache = [...docs, ...sheets];
    __pageRefsPromise = null;
    return __pageRefsCache;
  })();
  return __pageRefsPromise;
}

/** Public helper so other callers (e.g. doc-save) can bust the cache
 *  when a doc is renamed or created. */
export function refreshPageRefCache() {
  __pageRefsCache = null;
  __pageRefsPromise = null;
}

function scoreMatch(title: string, query: string): number {
  if (!query) return 1;
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 50;
  if (t.includes(q)) return 20;
  return 0;
}

// ── List component (the dropdown) ───────────────────────────────

interface ListProps {
  items: PageRef[];
  command: (item: PageRef) => void;
}
interface ListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

const PageLinkList = forwardRef<ListRef, ListProps>((props, ref) => {
  const [active, setActive] = useState(0);

  useEffect(() => setActive(0), [props.items]);

  const select = (i: number) => {
    const item = props.items[i];
    if (item) props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === "ArrowDown") {
        setActive((i) => (i + 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        setActive(
          (i) =>
            (i - 1 + Math.max(props.items.length, 1)) %
            Math.max(props.items.length, 1),
        );
        return true;
      }
      if (event.key === "Enter") {
        select(active);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="ws-pagelink-suggest text-text-tertiary text-[11px] italic px-3 py-2">
        No matching pages.
      </div>
    );
  }
  return (
    <div className="ws-pagelink-suggest rounded-md border-xs border-border-soft bg-popover shadow-xl py-1 min-w-[240px] max-w-[320px] max-h-[280px] overflow-y-auto">
      {props.items.map((item, i) => {
        const Icon = item.kind === "spreadsheet" ? TableIcon : FileText;
        return (
          <button
            key={`${item.kind}:${item.id}`}
            type="button"
            onMouseEnter={() => setActive(i)}
            onClick={() => select(i)}
            className={
              "w-full text-left flex items-center gap-2 px-2.5 py-1.5 text-[12px] transition-colors " +
              (i === active
                ? "bg-foreground/[0.08] text-foreground"
                : "text-foreground/80 hover:bg-foreground/[0.04]")
            }
          >
            <Icon className="h-3 w-3 text-text-tertiary shrink-0" />
            <span className="truncate flex-1">{item.title}</span>
            <span className="text-[9.5px] uppercase tracking-wider text-text-tertiary shrink-0">
              {item.kind === "spreadsheet" ? "Sheet" : "Doc"}
            </span>
          </button>
        );
      })}
    </div>
  );
});
PageLinkList.displayName = "PageLinkList";

// ── Extension ───────────────────────────────────────────────────

export const PageLinkSuggestion = Extension.create({
  name: "pageLinkSuggestion",

  addOptions() {
    return {
      suggestion: {
        char: "[[",
        allowSpaces: true,
        startOfLine: false,
        // After the user picks an item, run insertPageLink with the
        // selected ref's attrs. The Suggestion plugin handles the
        // range deletion (the `[[query` text) before we run.
        command: ({ editor, range, props }: any) => {
          const item = props as PageRef;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertPageLink({
              id: item.id,
              kind: item.kind,
              title: item.title,
            })
            .run();
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: pageLinkPluginKey,
        editor: this.editor,
        ...this.options.suggestion,
        items: async ({ query }: { query: string }) => {
          const refs = await fetchAllPageRefs();
          if (!query) return refs.slice(0, 10);
          return refs
            .map((r) => ({ r, s: scoreMatch(r.title, query) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, 10)
            .map((x) => x.r);
        },
        render: () => {
          let component: ReactRenderer<ListRef, ListProps> | null = null;
          let popup: TippyInstance[] = [];

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(PageLinkList as any, {
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
