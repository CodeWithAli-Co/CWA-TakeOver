/**
 * ScheduleStatsModal.tsx — Globally-mounted schedule stats modal.
 *
 * Reads `open` from useScheduleStats, fetches the current week's
 * shifts itself (so it works from any route), and renders the same
 * four numbers + utilization bar that used to live inline on the
 * Schedule page. Opened via Cmd+Shift+S or by clicking the Stats
 * button on the Schedule page.
 */

import { useEffect, useMemo } from "react";
import { BarChart3, X as XIcon } from "lucide-react";
import {
  endOfWeekSunday,
  shiftHours,
  startOfWeekMonday,
} from "@/stores/shiftTypes";
import { useShiftsInRange } from "@/stores/shifts";
import { useScheduleStats } from "./scheduleStatsStore";

export function ScheduleStatsModal() {
  const { open, closeStats } = useScheduleStats();

  // ESC closes — only attached when the modal is actually open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStats();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeStats]);

  if (!open) return null;
  return <ModalBody onClose={closeStats} />;
}

function ModalBody({ onClose }: { onClose: () => void }) {
  // Current week — the modal always reports on "this week" regardless
  // of what page the user opened it from.
  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeekMonday(now), [now]);
  const weekEnd = useMemo(() => endOfWeekSunday(now), [now]);

  const { data: shifts = [], isLoading } = useShiftsInRange(weekStart, weekEnd);

  const stats = useMemo(() => {
    const total = shifts.length;
    const scheduledHours = shifts.reduce((sum, s) => sum + shiftHours(s), 0);
    const loggedHours = shifts
      .filter((s) => s.clock_in && s.clock_out)
      .reduce((sum, s) => sum + shiftHours(s), 0);
    const inProgress = shifts.filter((s) => s.status === "in_progress").length;
    return { total, scheduledHours, loggedHours, inProgress };
  }, [shifts]);

  const utilization =
    stats.scheduledHours > 0
      ? Math.round((stats.loggedHours / stats.scheduledHours) * 100)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[520px] max-w-[92vw] bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border bg-popover/40">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
              Schedule stats · this week
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-text-tertiary border border-border rounded px-1.5 py-0.5">
              ⌘⇧S
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4">
          {/* Big numbers — 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <Chip label="Scheduled" value={`${stats.scheduledHours.toFixed(1)}h`} tone="default" />
            <Chip label="Logged" value={`${stats.loggedHours.toFixed(1)}h`} tone="brand" />
            <Chip label="Entries" value={String(stats.total)} tone="default" />
            <Chip
              label="On the clock"
              value={String(stats.inProgress)}
              tone={stats.inProgress > 0 ? "emerald" : "default"}
            />
          </div>

          {/* Utilization */}
          <div className="rounded-lg border border-border bg-card/40 p-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                Utilization
              </span>
              <span className="text-[16px] font-bold tabular-nums text-foreground">
                {isLoading ? "—" : `${utilization}%`}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-foreground/[0.06] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/70 to-primary rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, utilization)}%` }}
              />
            </div>
            <p className="text-[10.5px] text-text-tertiary mt-1.5">
              {stats.loggedHours.toFixed(1)}h logged of {stats.scheduledHours.toFixed(1)}h scheduled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "brand" | "emerald";
}) {
  const colors = {
    default: "border-border bg-card",
    brand: "border-primary/30 bg-primary/5",
    emerald: "border-emerald-500/40 bg-emerald-500/5",
  }[tone];
  const valColors = {
    default: "text-foreground",
    brand: "text-primary",
    emerald: "text-emerald-400",
  }[tone];
  return (
    <div className={`rounded-md border px-3 py-2 ${colors}`}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className={`text-[18px] font-black leading-none ${valColors}`}>
        {value}
      </p>
    </div>
  );
}
