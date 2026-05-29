/**
 * markdownHelpStore.ts — Zustand state for the Markdown cheatsheet
 * palette. Mounted at the root of /workspace/docs/$id; opens on
 * Cmd+/ or via the "Markdown" button in the doc header.
 */

import { create } from "zustand";

interface MarkdownHelpState {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

export const useMarkdownHelp = create<MarkdownHelpState>((set) => ({
  open: false,
  openPalette: () => set({ open: true }),
  closePalette: () => set({ open: false }),
  togglePalette: () => set((s) => ({ open: !s.open })),
}));
