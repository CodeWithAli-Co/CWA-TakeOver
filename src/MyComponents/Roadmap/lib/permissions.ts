import type { Checkpoint, RoadmapProfile } from "./types";

/**
 * Client-side role guards. These mirror the RLS policies in
 * migrations/roadmap_init.sql — the server remains source of truth; these
 * exist so the UI can disable/hide controls instantly.
 */

export function canApprove(user: RoadmapProfile): boolean {
  return user.role === "ceo" || user.role === "co_approver";
}

export function canCreateCheckpoint(_user: RoadmapProfile): boolean {
  return true; // everyone may propose — server forces pending for contributors
}

export function canEditCheckpoint(
  user: RoadmapProfile,
  cp: Checkpoint,
): boolean {
  if (user.role === "ceo" || user.role === "co_approver") return true;
  return cp.authorId === user.id && cp.approvalStatus === "pending";
}

export function canDeleteCheckpoint(
  user: RoadmapProfile,
  cp: Checkpoint,
): boolean {
  if (user.role === "ceo") return true;
  return cp.authorId === user.id && cp.approvalStatus === "pending";
}

export function requiresTypedConfirm(
  user: RoadmapProfile,
  cp: Checkpoint,
): boolean {
  return (
    user.role === "ceo" &&
    (cp.authorId !== user.id || cp.approvalStatus === "approved")
  );
}
