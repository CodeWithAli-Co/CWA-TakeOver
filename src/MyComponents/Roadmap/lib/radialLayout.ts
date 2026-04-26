// ───────────────────────────────────────────────────────────────────
// Radial layout for the Sovereign Roadmap.
//
// Each lane gets an angular sector (e.g. 6 lanes → 60° each). Within
// the sector, checkpoints are placed at a radius proportional to
// their "days remaining until due." Closer to the center = more
// urgent. The TODAY disc sits at the center; the deadline ring
// (YC May 4) lives at a fixed radius. Shipped items park just
// outside the deadline ring to indicate "behind us."
//
// Pure function — no React, no DOM. Returns polar+cartesian per id.
// ───────────────────────────────────────────────────────────────────

import type { Checkpoint, Lane, LaneId } from "./types";
import { daysRemaining } from "./status";

export interface RadialPosition {
  /** Center of the node in canvas coordinates. */
  x: number;
  y: number;
  /** Polar coords from center (radians + pixels). */
  angle: number;
  radius: number;
  /** Lane the node belongs to — handy for renderers. */
  laneId: LaneId;
}

export interface RadialLaneSector {
  laneId: LaneId;
  title: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  /** HSL string for tinting the sector arc. */
  accentHsl: string;
}

export interface RadialLayout {
  /** Total canvas dimensions (square — width === height). */
  width: number;
  height: number;
  /** Center point. */
  cx: number;
  cy: number;
  /** Inner ring (just outside the TODAY disc) — minimum node radius. */
  innerRadius: number;
  /** Outer ring (max node radius — the "horizon"). */
  outerRadius: number;
  /** Today disc radius. */
  todayRadius: number;
  /** Radius at which the deadline (YC) ring is drawn — visual only. */
  deadlineRadius: number;
  positions: Map<string, RadialPosition>;
  sectors: RadialLaneSector[];
}

const TWO_PI = Math.PI * 2;
const DAYS_TO_HORIZON = 240; // any due > 240 days out clamps here

/** Build the radial layout from checkpoints + lane order.
 *
 * @param checkpoints  All visible checkpoints (post-filter).
 * @param lanes        Ordered list of lanes — defines the angular
 *                     order around the wheel (12 o'clock = first
 *                     lane, then clockwise).
 * @param size         Square canvas side length in pixels. */
export function computeRadialLayout(
  checkpoints: Checkpoint[],
  lanes: Lane[],
  size = 1200,
): RadialLayout {
  const cx = size / 2;
  const cy = size / 2;
  const todayRadius = 64;
  const innerRadius = todayRadius + 28;
  const outerRadius = size / 2 - 80;
  const deadlineRadius = innerRadius + (outerRadius - innerRadius) * 0.46;

  // Lane angular slices. Start at -π/2 (12 o'clock) and go clockwise.
  const sectorSpan = TWO_PI / Math.max(1, lanes.length);
  const sectors: RadialLaneSector[] = lanes.map((lane, i) => {
    const startAngle = -Math.PI / 2 + i * sectorSpan;
    const endAngle = startAngle + sectorSpan;
    return {
      laneId: lane.id,
      title: lane.title,
      startAngle,
      endAngle,
      midAngle: startAngle + sectorSpan / 2,
      accentHsl: lane.accentHsl,
    };
  });
  const sectorById = new Map(sectors.map((s) => [s.laneId, s]));

  // Bucket checkpoints by lane so we can spread them across each
  // sector's angular span — avoids stacking when many cards share
  // the same days-remaining.
  const byLane = new Map<LaneId, Checkpoint[]>();
  for (const cp of checkpoints) {
    const arr = byLane.get(cp.laneId) ?? [];
    arr.push(cp);
    byLane.set(cp.laneId, arr);
  }

  // Sort each lane's bucket by days-remaining ascending (most urgent
  // first) so they sweep cleanly inward → outward across the sector.
  for (const arr of byLane.values()) {
    arr.sort((a, b) => {
      const ra = radiusForCheckpoint(a, innerRadius, outerRadius, deadlineRadius);
      const rb = radiusForCheckpoint(b, innerRadius, outerRadius, deadlineRadius);
      return ra - rb;
    });
  }

  const positions = new Map<string, RadialPosition>();
  for (const [laneId, cps] of byLane) {
    const sec = sectorById.get(laneId);
    if (!sec) continue;
    const pad = sectorSpan * 0.12; // keep nodes off the sector edges
    const usable = sectorSpan - pad * 2;
    const start = sec.startAngle + pad;
    cps.forEach((cp, i) => {
      // Distribute across the angular span. With 1 node we put it
      // at the sector midpoint; with N we space them evenly.
      const t = cps.length === 1 ? 0.5 : i / (cps.length - 1);
      const angle = start + usable * t;
      const radius = radiusForCheckpoint(
        cp,
        innerRadius,
        outerRadius,
        deadlineRadius,
      );
      positions.set(cp.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        angle,
        radius,
        laneId,
      });
    });
  }

  return {
    width: size,
    height: size,
    cx,
    cy,
    innerRadius,
    outerRadius,
    todayRadius,
    deadlineRadius,
    positions,
    sectors,
  };
}

/** Map a checkpoint's lifecycle + days-until-due to a polar radius. */
function radiusForCheckpoint(
  cp: Checkpoint,
  innerR: number,
  outerR: number,
  deadlineR: number,
): number {
  // Shipped items park OUTSIDE the deadline ring — visually "in the past."
  if (cp.status === "completed") {
    return Math.min(outerR - 18, deadlineR + 56);
  }
  // Items with no due date land at the horizon.
  const days = daysRemaining(cp);
  if (!Number.isFinite(days) || days <= 0) {
    // Past-due or due today — pin near the inner ring so they
    // visually scream "urgent now."
    return innerR + 8;
  }
  // Linear interpolation from inner (most urgent) to outer (far out).
  const clamped = Math.min(DAYS_TO_HORIZON, days) / DAYS_TO_HORIZON;
  return innerR + (outerR - innerR) * clamped;
}
