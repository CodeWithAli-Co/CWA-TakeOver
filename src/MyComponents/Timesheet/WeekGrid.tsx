/**
 * WeekGrid.tsx — The centerpiece of the timesheet.
 *
 * Two layouts share one source of truth (the same `shifts` array):
 *
 *   1. Hourly grid (mode = "me" | "person")
 *      ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
 *      │      │ MON  │ TUE  │ WED  │ THU  │ FRI  │ SAT  │ SUN  │ Day headers
 *      ├──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┤
 *      │ 7 AM │      │      │      │      │      │      │      │
 *      │ 8 AM │ ████ │      │      │      │      │      │      │ Shift block
 *      │ 9 AM │ ████ │ ████ │      │      │      │      │      │
 *      │  …   │      │      │      │      │      │      │      │
 *      └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
 *
 *   2. Swimlane (mode = "team")
 *      ┌──────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
 *      │ MASON    │ ░░░░ │      │ ▓▓▓▓ │      │      │      │      │
 *      │ SEM      │      │ ░░░░ │ ░░░░ │ ░░░░ │      │      │      │
 *      │ BLAZEHP  │      │      │      │ ▓▓▓▓ │ ░░░░ │      │      │
 *      └──────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
 *
 * The "now line" (a horizontal red rule) only appears in hourly mode when
 * the displayed week contains today.
 *
 * Clicking an empty hour-row opens a new shift dialog with that slot
 * pre-filled. Clicking a shift opens it for editing.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  SHIFT_TYPE_META,
  SHIFT_STATUS_META,
  isSameDay,
  shiftHours,
  weekdayAbbr,
  splitAcrossMidnight,
  isVirtualInstance,
  type Shift,
  type ShiftSegment,
} from "@/stores/shiftTypes";
import { ShiftBlock, ShiftSwimlanePill } from "./ShiftBlock";

interface Employee {
  supa_id: string;
  username: string;
  role: string;
  avatar_url?: string | null;
}

interface Props {
  days: Date[];                              // 7 days, Mon → Sun
  shifts: Shift[];
  mode: "me" | "team" | "person";
  employees: Employee[] | null;              // only used in team mode
  currentUserId: string | null;
  onShiftClick: (s: Shift) => void;
  onEmptyCellClick: (start: Date, userSupaId?: string) => void;
  /** Optional — wire to useUpdateShift to enable drag-to-move/resize. */
  onShiftTimeChange?: (shiftId: string, newStartIso: string, newEndIso: string) => void;
}

const HOUR_HEIGHT_PX = 44;
const VISIBLE_START_HOUR = 6;   // 6 AM
const VISIBLE_END_HOUR   = 23;  // 11 PM (exclusive — last row is 22:00–23:00)
const HOURS = Array.from(
  { length: VISIBLE_END_HOUR - VISIBLE_START_HOUR },
  (_, i) => VISIBLE_START_HOUR + i,
);

export function WeekGrid({
  days,
  shifts,
  mode,
  employees,
  currentUserId,
  onShiftClick,
  onEmptyCellClick,
  onShiftTimeChange,
}: Props) {
  if (mode === "team" && employees) {
    return (
      <TeamSwimlaneGrid
        days={days}
        shifts={shifts}
        employees={employees}
        currentUserId={currentUserId}
        onShiftClick={onShiftClick}
        onEmptyCellClick={onEmptyCellClick}
      />
    );
  }

  return (
    <HourlyGrid
      days={days}
      shifts={shifts}
      onShiftClick={onShiftClick}
      onEmptyCellClick={onEmptyCellClick}
      onShiftTimeChange={onShiftTimeChange}
    />
  );
}

// ============================================================
// Hourly grid — Me + Person modes
// ============================================================

function HourlyGrid({
  days,
  shifts,
  onShiftClick,
  onEmptyCellClick,
  onShiftTimeChange,
}: {
  days: Date[];
  shifts: Shift[];
  onShiftClick: (s: Shift) => void;
  onEmptyCellClick: (start: Date) => void;
  onShiftTimeChange?: (shiftId: string, newStartIso: string, newEndIso: string) => void;
}) {
  // Expand overnight shifts into per-day segments.
  const segments: ShiftSegment[] = useMemo(
    () => shifts.flatMap((s) => splitAcrossMidnight(s)),
    [shifts],
  );
  // Live "now line" — tick once a minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll once on mount so the work-day is centered.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scrollRef.current) return;
    const target = (9 - VISIBLE_START_HOUR) * HOUR_HEIGHT_PX - 40;
    scrollRef.current.scrollTo({ top: Math.max(0, target) });
  }, []);

  // Per-day totals for the header row — computed from segments so an
  // overnight shift contributes to both calendar days proportionally.
  const dayTotals = useMemo(() => {
    return days.map((d) => {
      const total = segments
        .filter((seg) => isSameDay(seg._segmentStart, d))
        .reduce((sum, seg) => {
          const ms = new Date(seg._segmentEnd).getTime() - new Date(seg._segmentStart).getTime();
          return sum + ms / 3_600_000;
        }, 0);
      return total;
    });
  }, [days, segments]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Day header row */}
      <div className="grid border-b border-border bg-secondary/30" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div />
        {days.map((d, i) => {
          const today = isSameDay(new Date().toISOString(), d);
          return (
            <div
              key={i}
              className={[
                "px-3 py-2.5 border-l border-border first:border-l-0",
                today ? "bg-primary/10" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className={[
                  "text-[10px] font-bold tracking-[0.14em] uppercase",
                  today ? "text-primary" : "text-muted-foreground",
                ].join(" ")}>
                  {weekdayAbbr(d)}
                </span>
                <span className={[
                  "text-[10px] font-mono tabular-nums",
                  today ? "text-primary font-bold" : "text-muted-foreground",
                ].join(" ")}>
                  {d.getDate().toString().padStart(2, "0")}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono tabular-nums">
                {dayTotals[i]! > 0 ? `${dayTotals[i]!.toFixed(1)}h` : "—"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Scrollable hourly body */}
      <div
        ref={scrollRef}
        className="relative overflow-auto"
        style={{ maxHeight: "calc(100vh - 340px)", minHeight: 420 }}
      >
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: "64px repeat(7, 1fr)",
            height: HOURS.length * HOUR_HEIGHT_PX,
          }}
        >
          {/* Time column */}
          <div className="border-r border-border bg-secondary/20">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-2 pt-1 text-[10px] font-mono tabular-nums text-muted-foreground"
                style={{ height: HOUR_HEIGHT_PX }}
              >
                {formatHourLabel(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const today = isSameDay(new Date().toISOString(), day);
            const daySegments = segments.filter((seg) => isSameDay(seg._segmentStart, day));
            return (
              <div
                key={dayIdx}
                className={[
                  "relative border-l border-border first:border-l-0",
                  today ? "bg-primary/[0.025]" : "",
                ].join(" ")}
              >
                {/* Hour grid lines + click-to-create */}
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(h, 0, 0, 0);
                      onEmptyCellClick(d);
                    }}
                    aria-label={`Create shift at ${formatHourLabel(h)}`}
                    className="group/cell absolute inset-x-0 border-b border-border/40 hover:bg-primary/[0.06] transition-colors"
                    style={{
                      top: (h - VISIBLE_START_HOUR) * HOUR_HEIGHT_PX,
                      height: HOUR_HEIGHT_PX,
                    }}
                  >
                    <Plus className="opacity-0 group-hover/cell:opacity-100 absolute right-1.5 top-1.5 w-3 h-3 text-primary transition-opacity" />
                  </button>
                ))}

                {/* Now line */}
                {today && (
                  <NowLine now={now} />
                )}

                {/* Shift segments (1 per single-day shift, 2+ for overnight) */}
                {daySegments.map((seg) => (
                  <ShiftBlock
                    key={`${seg.id}::${seg._segmentIndex}`}
                    shift={seg}
                    hourHeightPx={HOUR_HEIGHT_PX}
                    visibleStartHour={VISIBLE_START_HOUR}
                    onClick={() => onShiftClick(seg)}
                    onUpdateTime={
                      onShiftTimeChange && !isVirtualInstance(seg) && seg._segmentCount === 1
                        ? (s, e) => onShiftTimeChange(seg.id, s, e)
                        : undefined
                    }
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <Legend />
    </div>
  );
}

function NowLine({ now }: { now: Date }) {
  const minutesFromStart =
    (now.getHours() - VISIBLE_START_HOUR) * 60 + now.getMinutes();
  if (minutesFromStart < 0 || minutesFromStart > (VISIBLE_END_HOUR - VISIBLE_START_HOUR) * 60) {
    return null;
  }
  const top = (minutesFromStart / 60) * HOUR_HEIGHT_PX;
  return (
    <div
      className="absolute inset-x-0 z-20 pointer-events-none"
      style={{ top }}
    >
      <div className="relative">
        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
        <div className="h-px bg-primary/80 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
      </div>
    </div>
  );
}

function formatHourLabel(h: number): string {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12)   return `${h} AM`;
  return `${h - 12} PM`;
}

// ============================================================
// Team swimlane grid
// ============================================================

function TeamSwimlaneGrid({
  days,
  shifts,
  employees,
  currentUserId,
  onShiftClick,
  onEmptyCellClick,
}: {
  days: Date[];
  shifts: Shift[];
  employees: Employee[];
  currentUserId: string | null;
  onShiftClick: (s: Shift) => void;
  onEmptyCellClick: (start: Date, userSupaId?: string) => void;
}) {
  // Pin "me" to the top, then alphabetical.
  const orderedEmployees = useMemo(() => {
    const me = employees.find((e) => e.supa_id === currentUserId);
    const others = employees
      .filter((e) => e.supa_id !== currentUserId)
      .sort((a, b) => a.username.localeCompare(b.username));
    return me ? [me, ...others] : others;
  }, [employees, currentUserId]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Day header row */}
      <div
        className="grid border-b border-border bg-secondary/30 sticky top-0 z-10"
        style={{ gridTemplateColumns: "200px repeat(7, 1fr)" }}
      >
        <div className="px-3 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground border-r border-border">
          Employee
        </div>
        {days.map((d, i) => {
          const today = isSameDay(new Date().toISOString(), d);
          return (
            <div
              key={i}
              className={[
                "px-3 py-2.5 border-l border-border first:border-l-0",
                today ? "bg-primary/10" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span className={[
                  "text-[10px] font-bold tracking-[0.14em] uppercase",
                  today ? "text-primary" : "text-muted-foreground",
                ].join(" ")}>
                  {weekdayAbbr(d)}
                </span>
                <span className={[
                  "text-[10px] font-mono tabular-nums",
                  today ? "text-primary font-bold" : "text-muted-foreground",
                ].join(" ")}>
                  {d.getDate().toString().padStart(2, "0")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)", minHeight: 420 }}>
        {orderedEmployees.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            No employees in this company.
          </div>
        ) : (
          orderedEmployees.map((e) => {
            const isMe = e.supa_id === currentUserId;
            const accent = accentForId(e.supa_id);
            const weekHours = shifts
              .filter((s) => s.user_supa_id === e.supa_id)
              .reduce((sum, s) => sum + shiftHours(s), 0);

            return (
              <div
                key={e.supa_id}
                className="grid border-b border-border/60 last:border-b-0 hover:bg-secondary/10 transition-colors"
                style={{ gridTemplateColumns: "200px repeat(7, 1fr)" }}
              >
                {/* Employee cell */}
                <div className="px-3 py-3 flex items-center gap-2.5 border-r border-border min-w-0">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black text-white"
                    style={{
                      background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
                    }}
                  >
                    {initialsFor(e.username)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-foreground truncate leading-tight">
                      {e.username}
                      {isMe && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                          you
                        </span>
                      )}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground truncate mt-0.5 font-mono tabular-nums">
                      {weekHours > 0 ? `${weekHours.toFixed(1)}h this week` : "—"}
                    </p>
                  </div>
                </div>

                {/* Day cells */}
                {days.map((day, dayIdx) => {
                  const cellShifts = shifts
                    .filter((s) => s.user_supa_id === e.supa_id && isSameDay(s.starts_at, day))
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

                  return (
                    <button
                      key={dayIdx}
                      type="button"
                      onClick={() => {
                        const d = new Date(day);
                        d.setHours(9, 0, 0, 0);
                        onEmptyCellClick(d, e.supa_id);
                      }}
                      className="group/swim relative min-h-[68px] border-l border-border first:border-l-0 hover:bg-primary/[0.06] transition-colors p-1.5 text-left flex flex-col gap-1"
                    >
                      {cellShifts.length === 0 ? (
                        <Plus className="opacity-0 group-hover/swim:opacity-100 w-3.5 h-3.5 text-primary/70 transition-opacity m-auto" />
                      ) : (
                        cellShifts.map((s) => (
                          <ShiftSwimlanePill
                            key={s.id}
                            shift={s}
                            onClick={(e) => {
                              e.stopPropagation();
                              onShiftClick(s);
                            }}
                          />
                        ))
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <Legend />
    </div>
  );
}

// ============================================================
// Shared bits
// ============================================================

function Legend() {
  return (
    <div className="border-t border-border bg-secondary/20 px-4 py-2 flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
      <span className="font-bold uppercase tracking-[0.14em]">Legend</span>
      {Object.entries(SHIFT_TYPE_META).map(
        ([k, m]) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: m.accent }} />
            {m.label}
          </span>
        ),
      )}
      <span className="inline-flex items-center gap-1.5 ml-auto">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
        {SHIFT_STATUS_META.in_progress.label}
      </span>
    </div>
  );
}

function initialsFor(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function accentForId(id: string): string {
  const palette = [
    "rgb(239,68,68)",  "rgb(245,158,11)", "rgb(16,185,129)",
    "rgb(14,165,233)", "rgb(168,85,247)", "rgb(236,72,153)",
    "rgb(34,211,238)", "rgb(251,191,36)",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}
