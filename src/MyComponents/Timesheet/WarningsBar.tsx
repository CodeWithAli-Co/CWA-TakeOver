/**
 * WarningsBar.tsx — Rolls up the visible week's shifts into a row of
 * actionable warning chips:
 *
 *   ⚠ Overtime — any employee scheduled > 40h this week
 *   ⚠ Coverage — any "needs cover" open shifts inside the window
 *   ⚠ Conflicts — any same-user overlapping shifts
 *
 * Pure presentation — computes on the in-memory array, no extra queries.
 * Click a chip → highlights matching rows in the parent grid via the
 * onFocus callback (deferred: parent can ignore for v1).
 */

import { useMemo } from "react";
import { AlertTriangle, Hourglass, HandHelping, Layers } from "lucide-react";
import {
  shiftHours,
  weekHoursByUser,
  rangesOverlap,
  isVirtualInstance,
  type Shift,
} from "@/stores/shiftTypes";

const OVERTIME_THRESHOLD_HOURS = 40;

interface Props {
  shifts: Shift[];
  onFocusUser?: (userId: string) => void;
  onFocusOpen?: () => void;
  onFocusConflict?: (shiftIds: [string, string]) => void;
}

export function WarningsBar({ shifts, onFocusUser, onFocusOpen, onFocusConflict }: Props) {
  const findings = useMemo(() => {
    // Overtime — per-user weekly hours.
    const hoursByUser = weekHoursByUser(shifts);
    const overtimes: { userId: string; username: string; hours: number }[] = [];
    for (const [userId, hours] of hoursByUser.entries()) {
      if (hours > OVERTIME_THRESHOLD_HOURS) {
        const usernameSample = shifts.find((s) => s.user_supa_id === userId)?.username ?? "Unknown";
        overtimes.push({ userId, username: usernameSample, hours });
      }
    }

    // Coverage — open shifts that fall inside the visible window.
    const openShifts = shifts.filter((s) => s.coverage_requested_at);

    // Conflicts — same user, overlapping windows. O(n²) but bounded by
    // the visible week (small N) so it's fine.
    const conflicts: { a: Shift; b: Shift }[] = [];
    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        const a = shifts[i]!;
        const b = shifts[j]!;
        if (a.user_supa_id !== b.user_supa_id) continue;
        if (a.status === "cancelled" || b.status === "cancelled") continue;
        if (isVirtualInstance(a) && isVirtualInstance(b)) continue;
        if (rangesOverlap(a.starts_at, a.ends_at, b.starts_at, b.ends_at)) {
          conflicts.push({ a, b });
        }
      }
    }

    return { overtimes, openShifts, conflicts };
  }, [shifts]);

  const total = findings.overtimes.length + findings.openShifts.length + findings.conflicts.length;
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] px-4 py-2.5 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-amber-300 shrink-0">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]">
          {total} thing{total === 1 ? "" : "s"} to check
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {findings.overtimes.map((o) => (
          <button
            key={o.userId}
            type="button"
            onClick={() => onFocusUser?.(o.userId)}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-500/20 transition-colors"
            title={`${o.username} is scheduled for ${o.hours.toFixed(1)}h this week`}
          >
            <Hourglass className="w-3 h-3" />
            {o.username}
            <span className="font-mono tabular-nums text-amber-300">
              {o.hours.toFixed(1)}h
            </span>
          </button>
        ))}

        {findings.openShifts.length > 0 && (
          <button
            type="button"
            onClick={() => onFocusOpen?.()}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-100 hover:bg-sky-500/20 transition-colors"
            title="Shifts marked as needs-cover"
          >
            <HandHelping className="w-3 h-3" />
            Open shifts
            <span className="font-mono tabular-nums text-sky-300">
              {findings.openShifts.length}
            </span>
          </button>
        )}

        {findings.conflicts.slice(0, 3).map((c) => (
          <button
            key={`${c.a.id}-${c.b.id}`}
            type="button"
            onClick={() => onFocusConflict?.([c.a.id, c.b.id])}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/20 transition-colors"
            title={`${c.a.username}: ${c.a.title || c.a.type} overlaps ${c.b.title || c.b.type}`}
          >
            <Layers className="w-3 h-3" />
            {c.a.username} double-booked
          </button>
        ))}
        {findings.conflicts.length > 3 && (
          <span className="text-[11px] text-amber-200/60">
            +{findings.conflicts.length - 3} more conflicts
          </span>
        )}
      </div>
    </div>
  );
}
