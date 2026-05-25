/**
 * quickComposeStore.ts — Global "send a message from anywhere"
 * state. Tiny zustand store that the Cmd+Shift+M modal subscribes
 * to and the Cmd+K palette publishes into.
 *
 * Why a store instead of React Context: keyboard handlers in
 * different parts of the tree (root for Cmd+Shift+M, palette for
 * /msg verb) need to flip `open` without prop-drilling. The
 * modal component reads via `useQuickCompose()`.
 *
 * Transient state only — never persisted. Closing the modal
 * clears the prefill so the next open starts clean.
 */

import { create } from "zustand";

export interface QuickComposeState {
  /** Modal visible? */
  open: boolean;
  /** Optional target pre-fill from the Cmd+K /msg #channel route.
   *  Channel: "#general", "#engineering". DM: "@username". */
  prefilledTarget: string | null;
  /** Optional message body pre-fill — for the "/msg #x already
   *  typed everything" power-user path. When present, modal can
   *  send-on-open if the operator hit Enter. */
  prefilledBody: string | null;

  openCompose: (opts?: { target?: string; body?: string }) => void;
  closeCompose: () => void;
}

export const useQuickCompose = create<QuickComposeState>((set) => ({
  open: false,
  prefilledTarget: null,
  prefilledBody: null,

  openCompose: (opts) =>
    set({
      open: true,
      prefilledTarget: opts?.target ?? null,
      prefilledBody: opts?.body ?? null,
    }),

  closeCompose: () =>
    set({ open: false, prefilledTarget: null, prefilledBody: null }),
}));

// ── Recent-targets persistence (last 5 channel/DM picks) ──────
// Survives reloads so the typeahead's "Recent" section is
// actually useful turn-to-turn. Stored as a JSON array of
// target strings; truncated to 5 entries on every write.

const RECENT_KEY = "axon:quickCompose:recent";
const RECENT_MAX = 5;

export function readRecentTargets(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === "string").slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function pushRecentTarget(target: string): void {
  try {
    const current = readRecentTargets();
    const next = [target, ...current.filter((t) => t !== target)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — drop silently */
  }
}
