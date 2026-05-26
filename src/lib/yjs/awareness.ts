/**
 * awareness.ts — Helpers for the Y.Awareness layer.
 *
 * Two concerns:
 *   1. Deterministic per-user color so the same teammate always shows
 *      up with the same cursor hue across sessions / devices.
 *   2. A typed `RemoteUser` shape that matches what the
 *      CollaborationCursor extension expects, so reading awareness
 *      states elsewhere (e.g. the PresenceBar) is type-safe.
 */

export interface RemoteUser {
  /** Display name shown next to the cursor. */
  name: string;
  /** Hex color used for the cursor caret + name label background. */
  color: string;
}

/**
 * Curated palette — saturated enough to be visible against the
 * editorial dark background but not too neon. Picked across the hue
 * wheel so two adjacent users land on visually distinct colors.
 */
const PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#84cc16", // lime
  "#14b8a6", // teal
];

/**
 * Stable hash → palette index. The same `key` will always map to the
 * same color (assuming the palette doesn't change). Using
 * Array.from(key) to handle multi-byte unicode codepoints correctly.
 */
export function colorForUser(key: string): string {
  if (!key) return PALETTE[0]!;
  let h = 5381;
  for (const ch of Array.from(key)) {
    h = ((h << 5) + h + ch.codePointAt(0)!) | 0;
  }
  const idx = Math.abs(h) % PALETTE.length;
  return PALETTE[idx]!;
}

export function makeRemoteUser(name: string): RemoteUser {
  return { name, color: colorForUser(name) };
}
