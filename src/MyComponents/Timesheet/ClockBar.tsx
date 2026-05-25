/**
 * ClockBar.tsx — Live clock-in/out card. Only rendered in Me view.
 *
 * Three states the bar can be in:
 *
 *   1. ON THE CLOCK — there's an `in_progress` shift. Big "Clock out"
 *      button with a live timer showing elapsed minutes.
 *
 *   2. ABOUT TO START — there's a scheduled shift starting within the
 *      next 30 minutes, or one that's already overdue. "Clock in" is
 *      pre-pointed at that shift; we show its title + window.
 *
 *   3. IDLE — no in-progress, no imminent shift. Show next upcoming
 *      shift if any, plus a small "Clock in anyway" button that creates
 *      a fresh ad-hoc shift.
 *
 * The minute timer ticks via a 1s setInterval. It's cheap and the bar
 * is only mounted while Me view is active.
 */

import { useEffect, useState } from "react";
import { Play, Square, Loader2, CalendarClock, AlertTriangle } from "lucide-react";
import { useActiveShift, useNextShift, useClockIn, useClockOut } from "@/stores/shifts";
import { formatClock, shiftTimeRange, type Shift } from "@/stores/shiftTypes";

interface Props {
  userSupaId: string;
  username: string;
}

export function ClockBar({ userSupaId, username }: Props) {
  const { data: active, isLoading: loadingActive } = useActiveShift(userSupaId);
  const { data: next, isLoading: loadingNext } = useNextShift(userSupaId);
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const loading = loadingActive || loadingNext;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="text-[12px] font-mono uppercase tracking-wider">loading clock...</span>
      </div>
    );
  }

  if (active) {
    return (
      <OnTheClockCard
        shift={active}
        onClockOut={() => clockOut.mutate(active.id)}
        loading={clockOut.isPending}
      />
    );
  }

  // No in-progress shift. Is the next one imminent (<30 min away)?
  const now = Date.now();
  const startsAt = next ? new Date(next.starts_at).getTime() : null;
  const minutesUntil = startsAt != null ? Math.round((startsAt - now) / 60000) : null;
  const imminent = minutesUntil != null && minutesUntil <= 30;       // starts soon
  const overdue  = next && new Date(next.starts_at).getTime() < now; // already started without a clock-in

  if (next && (imminent || overdue)) {
    return (
      <AboutToStartCard
        shift={next}
        overdue={!!overdue}
        onClockIn={() =>
          clockIn.mutate({ shiftId: next.id, userSupaId, username })
        }
        loading={clockIn.isPending}
      />
    );
  }

  return (
    <IdleCard
      next={next ?? null}
      onClockIn={() =>
        clockIn.mutate({
          shiftId: next?.id,                 // bind to next scheduled shift if one exists
          userSupaId,
          username,
        })
      }
      loading={clockIn.isPending}
    />
  );
}

// ============================================================
// Variant 1 — On the clock
// ============================================================

function OnTheClockCard({
  shift,
  onClockOut,
  loading,
}: {
  shift: Shift;
  onClockOut: () => void;
  loading: boolean;
}) {
  const elapsed = useLiveElapsed(shift.clock_in ?? shift.starts_at);
  return (
    <div
      className="rounded-xl border-2 border-emerald-400/50 bg-emerald-500/[0.04] px-5 py-3.5 flex items-center gap-4"
      style={{ boxShadow: "0 0 24px -8px rgba(34,197,94,0.35)" }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">
          On the clock
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-foreground truncate">
          {shift.title || "Shift in progress"}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
          Clocked in at {formatClock(shift.clock_in ?? shift.starts_at)} ·{" "}
          <span className="text-emerald-400 font-semibold">{elapsed}</span>
        </p>
      </div>

      <button
        type="button"
        onClick={onClockOut}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-foreground text-background px-4 h-9 text-[11.5px] font-bold uppercase tracking-wider hover:bg-foreground/90 transition-colors disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Square className="w-3 h-3 fill-current" />
        )}
        Clock out
      </button>
    </div>
  );
}

// ============================================================
// Variant 2 — About to start (or overdue)
// ============================================================

function AboutToStartCard({
  shift,
  overdue,
  onClockIn,
  loading,
}: {
  shift: Shift;
  overdue: boolean;
  onClockIn: () => void;
  loading: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border-2 px-5 py-3.5 flex items-center gap-4",
        overdue
          ? "border-amber-400/50 bg-amber-500/[0.04]"
          : "border-primary/40 bg-primary/[0.04]",
      ].join(" ")}
      style={{
        boxShadow: overdue
          ? "0 0 24px -8px rgba(251,191,36,0.35)"
          : "0 0 24px -8px rgba(239,68,68,0.3)",
      }}
    >
      <div className="shrink-0">
        {overdue ? (
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        ) : (
          <CalendarClock className="w-5 h-5 text-primary" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={[
          "text-[10px] font-bold uppercase tracking-[0.16em]",
          overdue ? "text-amber-400" : "text-primary",
        ].join(" ")}>
          {overdue ? "Shift started without clock-in" : "Shift starts soon"}
        </p>
        <p className="text-[14px] font-semibold text-foreground truncate">
          {shift.title || "Scheduled shift"}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
          {shiftTimeRange(shift)}
        </p>
      </div>

      <button
        type="button"
        onClick={onClockIn}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 h-9 text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
        style={{ boxShadow: "0 4px 12px -2px rgba(239,68,68,0.45)" }}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
        Clock in
      </button>
    </div>
  );
}

// ============================================================
// Variant 3 — Idle
// ============================================================

function IdleCard({
  next,
  onClockIn,
  loading,
}: {
  next: Shift | null;
  onClockIn: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-3 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        {next ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Next up
            </p>
            <p className="text-[13.5px] font-semibold text-foreground truncate">
              {next.title || "Scheduled shift"}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
              {formatRelativeStart(next.starts_at)} · {shiftTimeRange(next)}
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Off the clock
            </p>
            <p className="text-[13.5px] text-muted-foreground">
              No shifts scheduled. You can still clock in for ad-hoc work.
            </p>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onClockIn}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-secondary px-3.5 h-8 text-[11px] font-bold uppercase tracking-wider text-foreground hover:bg-secondary/70 transition-colors disabled:opacity-40"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3 h-3 fill-current" />
        )}
        {next ? "Clock in early" : "Clock in"}
      </button>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function useLiveElapsed(startIso: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const start = new Date(startIso).getTime();
  const ms = Math.max(0, now - start);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function formatRelativeStart(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60 && diffMin > -60) {
    if (diffMin > 0)  return `in ${diffMin} min`;
    if (diffMin < 0)  return `${Math.abs(diffMin)} min ago`;
    return "now";
  }
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();
  if (sameDay) return `today at ${formatClock(iso)}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sameAsTomorrow =
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate();
  if (sameAsTomorrow) return `tomorrow at ${formatClock(iso)}`;
  return `${target.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at ${formatClock(iso)}`;
}
