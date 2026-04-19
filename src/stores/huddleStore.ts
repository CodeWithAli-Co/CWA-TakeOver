/**
 * huddleStore.ts — Global huddle state so the voice/video call persists
 * across route changes. Mounted via <HuddleHost/> in __root.tsx.
 *
 * The actual WebRTC connection lives inside useHuddle, driven by this
 * store's `group` + `joined` flags. Leaving the huddle (set group=null)
 * triggers useHuddle cleanup; staying on another route keeps it alive.
 */

import { create } from "zustand";

interface HuddleStore {
  /** Channel name the user is currently huddled in, or null when idle. */
  group: string | null;
  muted: boolean;
  camera: boolean;
  /** Push-to-talk state — while true, mic is forced hot regardless of muted. */
  pttActive: boolean;

  startHuddle: (group: string) => void;
  leaveHuddle: () => void;
  toggleMute: () => void;
  setMuted: (m: boolean) => void;
  toggleCamera: () => void;
  setCamera: (c: boolean) => void;
  setPttActive: (v: boolean) => void;
}

export const useHuddleStore = create<HuddleStore>((set) => ({
  group: null,
  muted: false,
  camera: false,
  pttActive: false,

  startHuddle: (group) => set({ group, muted: false, camera: false }),
  leaveHuddle: () => set({ group: null, muted: false, camera: false, pttActive: false }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setMuted: (m) => set({ muted: m }),
  toggleCamera: () => set((s) => ({ camera: !s.camera })),
  setCamera: (c) => set({ camera: c }),
  setPttActive: (v) => set({ pttActive: v }),
}));
