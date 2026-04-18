import type { CheckpointStatus, LaneId } from "./types";

// Y Combinator deadline — still shown in the top-nav countdown even though
// the canvas itself is now dependency-driven, not time-driven.
export const YC_DEADLINE_ISO = "2026-05-04T20:00:00-07:00";

// --- DAG layout dimensions ------------------------------------------------

/** Node card size. Generous on purpose — modern dashboards breathe. */
export const NODE_W = 264;
export const NODE_H = 104;

/** Horizontal gap between adjacent layers. Nodes hop layer → layer + 1. */
export const LAYER_GAP = 92;

/** Vertical gap between nodes within the same layer. */
export const NODE_V_GAP = 20;

/** Horizontal gap between sub-columns inside a densely-populated layer. */
export const SUBCOL_GAP = 20;

/** Max nodes per sub-column. Kept modest so the left-edge stack isn't tall. */
export const MAX_PER_COL = 5;

/** Outer canvas padding. */
export const CANVAS_PADDING = 48;

// --- Derived ---------------------------------------------------------------

/** Column width = node + the gap to the next layer. */
export const COLUMN_STRIDE = NODE_W + LAYER_GAP;

/** Row stride within a layer. */
export const ROW_STRIDE = NODE_H + NODE_V_GAP;

/** Sub-column stride inside a dense layer. */
export const SUBCOL_STRIDE = NODE_W + SUBCOL_GAP;

// --- Misc -----------------------------------------------------------------

export const STATUS_LABEL: Record<CheckpointStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  at_risk: "At risk",
  completed: "Completed",
};

/** Lane order is now only used for grouping nodes within a DAG layer so the
 *  same company's work clusters vertically. */
export const LANE_ORDER: LaneId[] = [
  "fundraising",
  "codewithali",
  "simplicity",
  "takeover",
  "brand",
  "ops",
];
