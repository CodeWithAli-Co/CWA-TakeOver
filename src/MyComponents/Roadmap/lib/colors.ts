import type { CheckpointStatus, LaneId } from "./types";

/** Lane accents as "H S% L%" — plug into hsl() / hsla(). */
export const LANE_ACCENT: Record<LaneId, string> = {
  fundraising: "152 60% 42%",
  codewithali: "236 68% 62%",
  simplicity: "205 90% 58%",
  takeover: "42 95% 58%",
  brand: "320 75% 60%",
  ops: "220 16% 58%",
};

export const RESERVED_COLORS = {
  ceo: "hsl(42 95% 58%)", // sovereign gold — Ali
  user: "hsl(188 92% 56%)", // electric cyan — founding hire
} as const;

/**
 * Golden-ratio author-color walker. Produces visually distinct hues for
 * sequential signups. Skips a ±12° band around each reserved hue.
 */
export function nextAuthorColor(prevHue?: number, seed?: number): string {
  const PHI = 0.61803398875;
  const base = prevHue != null ? prevHue / 360 : (seed ?? Math.random());
  let hue = ((base + PHI) % 1) * 360;

  const RESERVED = [42, 188];
  for (const r of RESERVED) {
    const circDist = Math.abs(((hue - r + 540) % 360) - 180);
    if (circDist < 12) {
      hue = (hue + 24) % 360;
    }
  }
  return `hsl(${Math.round(hue)} 72% 58%)`;
}

/** Fill color for a checkpoint pill given its lane + status. */
export function checkpointFill(
  laneId: LaneId,
  status: CheckpointStatus,
): string {
  const accent = LANE_ACCENT[laneId];
  const hue = accent.split(" ")[0] ?? "220";
  switch (status) {
    case "completed":
      return "hsl(220 6% 28%)";
    case "upcoming":
      return `hsla(${hue} 14% 26% / 0.9)`;
    case "at_risk":
      return "hsl(14 85% 56%)";
    case "in_progress":
    default:
      return `hsl(${accent})`;
  }
}

/** Stroke color for dependency arrows. */
export function dependencyStroke(active: boolean, laneId: LaneId): string {
  return active ? `hsl(${LANE_ACCENT[laneId]})` : "hsl(220 10% 30%)";
}
