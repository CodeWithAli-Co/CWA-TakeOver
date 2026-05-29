/**
 * docSchema.ts — Source-of-truth extension list for the workspace doc
 * editor.
 *
 * Why this file exists:
 *   To bootstrap a Y.Doc from saved TipTap JSON (via
 *   prosemirrorJSONToYDoc), we need a ProseMirror schema *identical*
 *   to the one the running editor uses. The simplest way to keep them
 *   in lockstep is to export the extension list from a single place
 *   that both the editor (DocEditor.tsx) and the bootstrap path
 *   (DocDetailPage.tsx) import.
 *
 * History note:
 *   StarterKit ships its own History extension. The Collaboration
 *   extension is incompatible with it (both manage undo/redo). When
 *   running in collab mode we therefore disable the bundled history
 *   and Collaboration brings its own. The schema-only path here does
 *   include history because it doesn't matter — we throw the schema
 *   away after one use.
 */

import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import { CommentMark } from "./CommentMark";
import {
  Callout,
  Spoiler,
  Subscript,
  Superscript,
} from "./markdownExtensions";
import { PageLink } from "./PageLink";

export interface BaseExtensionOpts {
  /** Whether to include History (false when Collaboration owns undo/redo). */
  withHistory?: boolean;
  /** Placeholder copy shown when the editor is empty. */
  placeholder?: string;
}

/**
 * Returns the static extension list that's identical across schema
 * computation, the editor mount, and any other code that needs to
 * understand the doc shape. The Collaboration + CollaborationCursor +
 * SlashCommand extensions are added separately in DocEditor since they
 * depend on per-mount instances (Y.Doc, provider, etc.).
 */
export function getBaseDocExtensions(opts: BaseExtensionOpts = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      history: opts.withHistory !== false,
    }),
    Placeholder.configure({
      placeholder: opts.placeholder ?? "Type \"/\" for commands, or start writing…",
      showOnlyWhenEditable: true,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class:
          "text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary",
      },
    }),
    Image.configure({
      HTMLAttributes: { class: "rounded-sm my-3 max-w-full" },
    }),
    Underline,
    Highlight.configure({ multicolor: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Typography,
    TaskList,
    TaskItem.configure({ nested: true }),
    CharacterCount,
    Table.configure({
      resizable: true,
      HTMLAttributes: { class: "workspace-table" },
    }),
    TableRow,
    TableHeader,
    TableCell,
    CommentMark,
    // ── Markdown polish — Discord/Obsidian/.md parity ─────
    Spoiler,
    Subscript,
    Superscript,
    Callout,
    PageLink,
  ];
}
