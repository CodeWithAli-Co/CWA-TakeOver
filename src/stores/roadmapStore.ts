import { create } from "zustand";

/**
 * Roadmap canvas viewport. Lives in its own store so pan/zoom changes don't
 * re-render anything outside the roadmap page.
 */

export interface RoadmapViewportState {
  panX: number;
  panY: number;
  zoom: number;
  width: number;
  height: number;
  setPan: (x: number, y: number) => void;
  translate: (dx: number, dy: number) => void;
  setZoom: (zoom: number, originX?: number, originY?: number) => void;
  setSize: (w: number, h: number) => void;
  jumpTo: (x: number, y: number) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.2;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export const useRoadmapViewport = create<RoadmapViewportState>((set, get) => ({
  panX: 0,
  panY: 0,
  zoom: 1,
  width: 0,
  height: 0,
  setPan: (x, y) => set({ panX: x, panY: y }),
  translate: (dx, dy) =>
    set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),
  setZoom: (zoom, originX, originY) =>
    set((s) => {
      const next = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
      if (originX == null || originY == null) return { zoom: next };
      // Zoom toward cursor: keep world point under cursor fixed.
      const worldX = (originX - s.panX) / s.zoom;
      const worldY = (originY - s.panY) / s.zoom;
      const panX = originX - worldX * next;
      const panY = originY - worldY * next;
      return { zoom: next, panX, panY };
    }),
  setSize: (w, h) => set({ width: w, height: h }),
  jumpTo: (x, y) => {
    const { width, height, zoom } = get();
    set({
      panX: width / 2 - x * zoom,
      panY: height / 2 - y * zoom,
    });
  },
}));
