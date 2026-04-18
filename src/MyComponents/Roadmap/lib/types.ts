/**
 * Sovereign Roadmap · domain types.
 * Mirrors the Supabase tables in migrations/roadmap_init.sql 1:1 so UI
 * code can swap between the seed fixture and live data without changing.
 */

export type LaneId =
  | "fundraising"
  | "codewithali"
  | "simplicity"
  | "takeover"
  | "brand"
  | "ops";

export type RoadmapRole = "ceo" | "co_approver" | "contributor";

export type CheckpointStatus =
  | "upcoming"
  | "in_progress"
  | "at_risk"
  | "completed";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface RoadmapProfile {
  id: string;
  displayName: string;
  email: string;
  role: RoadmapRole;
  /** CSS color expression — usually hsl(H S% L%). */
  authorColor: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Lane {
  id: LaneId;
  title: string;
  /** "H S% L%" — consumed inside hsl() / hsla(). */
  accentHsl: string;
  sortOrder: number;
}

export interface Checkpoint {
  id: string;
  laneId: LaneId;
  title: string;
  /** 2–3 char station code rendered on the node ring (e.g. "YC", "VC1").
   *  Optional — falls back to the first 2–3 chars of `title` when missing. */
  shortCode?: string;
  description?: string;
  /** ISO yyyy-mm-dd (interpreted as UTC midnight). */
  startDate: string;
  targetDate: string;
  status: CheckpointStatus;
  ownerId?: string;
  authorId: string;
  collaboratorIds?: string[];
  approvalStatus: ApprovalStatus;
  metricLabel?: string;
  metricTarget?: number;
  metricCurrent?: number;
  rejectReason?: string;
  createdAt: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface Dependency {
  id: string;
  fromId: string;
  toId: string;
}
