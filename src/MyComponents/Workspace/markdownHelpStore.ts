/**
 * markdownHelpStore.ts — Zustand state for the Markdown palette.
 *
 * Originally a pure cheatsheet (open / close). Now also tracks the
 * currently-active TipTap editor so the palette can DISPATCH markdown
 * formatting on click instead of just showing the syntax for the user
 * to type. DocEditor calls `setEditor(editor)` on mount and
 * `setEditor(null)` on unmount. The palette reads `editor` when a
 * cheat is clicked.
 *
 * Why a global store instead of props: the palette is mounted once
 * at the route root, but multiple editors can exist in the doc
 * surface lifetime (tab switches, doc switches). The store decouples
 * the palette from any specific editor instance and lets the most
 * recently-focused editor win.
 *
 * Mounted at the root of /workspace/docs/$id; opens on Cmd+/ or via
 * the "Markdown" button in the doc header.
 */

import { create } from "zustand";
import type { Editor } from "@tiptap/react";

interface MarkdownHelpState {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  /** The currently-focused TipTap editor, or null when no editor is
   *  mounted (e.g. before doc load, between tab switches). */
  editor: Editor | null;
  setEditor: (e: Editor | null) => void;
}

export const useMarkdownHelp = create<MarkdownHelpState>((set) => ({
  open: false,
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
  togglePalette: () => set((s) => ({ open: !s.open })),
  editor: null,
  setEditor: (e) => set({ editor: e }),
}));
