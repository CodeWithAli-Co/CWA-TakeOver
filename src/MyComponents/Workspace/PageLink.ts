/**
 * PageLink.ts — Inline atomic node for embedded page references.
 *
 * Renders as a clickable badge inline with text, like Notion's
 * @PageName or Obsidian's [[Page Name]]. Stores the target doc's
 * id + a snapshot of its title at link time. When rendered, the
 * id is what links navigate by — so a renamed doc still resolves
 * correctly even though the snapshot title may go stale.
 *
 * Pairs with PageLinkSuggestion (separate extension) which wires
 * the `[[` trigger + autocomplete dropdown that searches over
 * workspace_documents + workspace_spreadsheets.
 */

import { mergeAttributes, Node } from "@tiptap/core";

export interface PageLinkAttrs {
  /** workspace_documents.id OR workspace_spreadsheets.id */
  id: string;
  /** "document" | "spreadsheet" — drives the icon + which route to open */
  kind: "document" | "spreadsheet";
  /** Snapshot of the title at insert time. Used as fallback if the
   *  live resolver fails. The live renderer prefers the current
   *  title from cache. */
  title: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (attrs: PageLinkAttrs) => ReturnType;
    };
  }
}

export const PageLink = Node.create({
  name: "pageLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-id") ?? "",
        renderHTML: (attrs) => ({ "data-id": attrs.id }),
      },
      kind: {
        default: "document" as "document" | "spreadsheet",
        parseHTML: (el) =>
          (el.getAttribute("data-kind") ?? "document") as
            | "document"
            | "spreadsheet",
        renderHTML: (attrs) => ({ "data-kind": attrs.kind }),
      },
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? "",
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-page-link]" }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { id, kind, title } = node.attrs as PageLinkAttrs;
    const route =
      kind === "spreadsheet"
        ? `/workspace/sheets/${id}`
        : `/workspace/docs/${id}`;
    const iconChar = kind === "spreadsheet" ? "▦" : "▤";
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-page-link": "true",
        "data-id": id,
        "data-kind": kind,
        "data-title": title,
        href: route,
        class: "ws-page-link",
        // Click handler is wired globally in DocEditor via event
        // delegation so the editor router can intercept and use
        // tanstack-router navigate() instead of a hard page load.
      }),
      [
        "span",
        { class: "ws-page-link__icon", "aria-hidden": "true" },
        iconChar,
      ],
      ["span", { class: "ws-page-link__title" }, title || "Untitled"],
    ];
  },

  addCommands() {
    return {
      insertPageLink:
        (attrs: PageLinkAttrs) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent([
              { type: this.name, attrs },
              { type: "text", text: " " },
            ])
            .run(),
    };
  },
});
