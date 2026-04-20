/**
 * huddleStore.ts — Global huddle state so the voice/video call persists
 * across route changes. Mounted via <HuddleHost/> in __root.tsx.
 *
 * The actual WebRTC connection lives inside useHuddle, driven by this
 * store's `group` + `joined` flags. Leaving the huddle (set group=null)
 * triggers useHuddle cleanup; staying on another route keeps it alive.
 */

import { create } from "zustand";

/**
 * Screen-share quality preset. Trades off three axes:
 *   resolution × framerate × what degrades under pressure.
 *
 *   smooth  → 1080p60, motion-priority, ~8 Mbps. Scrolls cleanly, demos
 *             and videos look right. Good default. Text still readable.
 *   crisp   → 4K30,   detail-priority, ~15 Mbps. Static code review,
 *             design mockups, documentation. Stutters on motion.
 *   ultra   → 4K60,   detail-priority, ~22 Mbps. Needs a fast CPU/GPU
 *             and a fat uplink. On anything less it'll drop frames.
 *   balanced→ 1440p60, motion-priority, ~12 Mbps. Middle ground.
 *
 * These settings drive both the capture constraints (getDisplayMedia/
 * getUserMedia) and the sender tuning (bitrate + degradation +
 * contentHint) inside useHuddle.
 */
export type HuddleQuality = "smooth" | "balanced" | "crisp" | "ultra";

export interface QualitySpec {
  label: string;
  blurb: string;
  width: number;
  height: number;
  framerate: number;
  bitrate: number;
  /** "motion" = smooth scrolling, "detail" = sharp text. */
  hint: "motion" | "detail";
  /** Degradation preference when the network/CPU can't keep up. */
  degrade: "maintain-framerate" | "maintain-resolution";
}

export const QUALITY_PRESETS: Record<HuddleQuality, QualitySpec> = {
  smooth: {
    label: "Smooth · 1080p60",
    blurb: "Best for scrolling, demos, and videos. Lower pixels, full framerate.",
    width: 1920,
    height: 1080,
    framerate: 60,
    bitrate: 8_000_000,
    hint: "motion",
    degrade: "maintain-framerate",
  },
  balanced: {
    label: "Balanced · 1440p60",
    blurb: "Middle ground — readable text, still smooth motion.",
    width: 2560,
    height: 1440,
    framerate: 60,
    bitrate: 12_000_000,
    hint: "motion",
    degrade: "maintain-framerate",
  },
  crisp: {
    label: "Crisp · 4K30",
    blurb: "Sharp text for code review, static slides. Stutters on fast motion.",
    width: 3840,
    height: 2160,
    framerate: 30,
    bitrate: 15_000_000,
    hint: "detail",
    degrade: "maintain-resolution",
  },
  ultra: {
    label: "Ultra · 4K60",
    blurb: "Maximum everything. Needs a fast CPU + fat uplink.",
    width: 3840,
    height: 2160,
    framerate: 60,
    bitrate: 22_000_000,
    hint: "detail",
    degrade: "maintain-resolution",
  },
};

const QUALITY_KEY = "cwa-huddle-quality";
function loadQuality(): HuddleQuality {
  try {
    const v = localStorage.getItem(QUALITY_KEY);
    if (v && v in QUALITY_PRESETS) return v as HuddleQuality;
  } catch { /* noop */ }
  return "smooth";
}
function saveQuality(q: HuddleQuality) {
  try { localStorage.setItem(QUALITY_KEY, q); } catch { /* noop */ }
}

interface HuddleStore {
  /** Channel name the user is currently huddled in, or null when idle. */
  group: string | null;
  muted: boolean;
  camera: boolean;
  /** Push-to-talk state — while true, mic is forced hot regardless of muted. */
  pttActive: boolean;
  /** Screen-share + camera quality preset. */
  quality: HuddleQuality;

  startHuddle: (group: string) => void;
  leaveHuddle: () => void;
  toggleMute: () => void;
  setMuted: (m: boolean) => void;
  toggleCamera: () => void;
  setCamera: (c: boolean) => void;
  setPttActive: (v: boolean) => void;
  setQuality: (q: HuddleQuality) => void;
}

export const useHuddleStore = create<HuddleStore>((set) => ({
  group: null,
  muted: false,
  camera: false,
  pttActive: false,
  quality: loadQuality(),

  startHuddle: (group) => set({ group, muted: false, camera: false }),
  leaveHuddle: () => set({ group: null, muted: false, camera: false, pttActive: false }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  setMuted: (m) => set({ muted: m }),
  toggleCamera: () => set((s) => ({ camera: !s.camera })),
  setCamera: (c) => set({ camera: c }),
  setPttActive: (v) => set({ pttActive: v }),
  setQuality: (q) => { saveQuality(q); set({ quality: q }); },
}));
