import type { Checkpoint, CheckpointStatus } from "./types";

export const STATUS_ORDER: CheckpointStatus[] = [
  "upcoming",
  "in_progress",
  "at_risk",
  "completed",
];

export function canTransition(
  current: CheckpointStatus,
  next: CheckpointStatus,
): boolean {
  if (current === next) return false;
  if (current === "completed") return false;
  return true;
}

export function isActiveWindow(cp: Checkpoint, today = new Date()): boolean {
  const start = new Date(`${cp.startDate}T00:00:00Z`).getTime();
  const end = new Date(`${cp.targetDate}T23:59:59Z`).getTime();
  const now = today.getTime();
  return now >= start && now <= end;
}

export function daysRemaining(cp: Checkpoint, today = new Date()): number {
  const end = new Date(`${cp.targetDate}T23:59:59Z`).getTime();
  return Math.ceil((end - today.getTime()) / 86_400_000);
}
