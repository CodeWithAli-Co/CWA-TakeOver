/**
 * DayView.tsx — Single day, all employees as rows, horizontal hour axis.
 *
 *     ┌──────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐
 *     │          │ 6 AM │ 8 AM │ 10AM │ 12PM │ 2 PM │ 4 PM │ 6 PM │
 *     ├──────────┼──────┴──────┴──────┴──────┴──────┴──────┴──────┤
 *     │ MASON    │     ░░░░░░░░░░░                                │
 *     │ SEM      │              ▓▓▓▓▓▓▓▓▓▓▓                       │
 *     │ BLAZEHP  │                          ░░░░░░░░              │
 *     └──────────┴────────────────────────────────────────────────┘
 *
 * The "live ops" view. Best when you've got people actively working and
 * you want to see at-a-glance who's on, who's coming up, who finished.
 * Now-line is a vertical rule sliding right across the row strip.
 *
 * Empty-cell click creates a 1-hour shift starting at the clicked spot.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, AlertCircle, Lock } from "lucide-react";
import {
  SHIFT_TYPE_META,
  isSameDay,
  isVirtualInstance,
  shiftHours,
  type Shift,
} from "@/stores/shiftTypes";

interface Employee {
  supa_id: string;
  username: string;
  role: string;
  avatar_url?: string | null;
}

interface Props {
  day: Date;
  shifts: Shift[];
  employees: Employee[];
  currentUserId: string | null;
  onShiftClick: (s: Shift) => void;
  onEmptyCellClick: (start: Date, userSupaId: string) => void;
}

const VISIBLE_START_HOUR = 6;
const VISIBLE_END_HOUR   = 23;
const VISIBLE_HOURS      = VISIBLE_END_HOUR - VISIBLE_START_HOUR; // 17
const ROW_HEIGHT_PX      = 56;
const PX_PER_HOUR        = 56;
const TIMELINE_WIDTH_PX  = VISIBLE_HOURS * PX_PER_HOUR;          // 952

export function DayView({
  day,
  shifts,
  employees,
  currentUserId,
  onShiftClick,
  onEmptyCellClick,
}: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Pin me to the top, then alphabetical.
  const orderedEmployees = useMemo(() => {
    const me = employees.find((e) => e.supa_id === currentUserId);
    const others = employees
      .filter((e) => e.supa_id !== currentUserId)
      .sort((a, b) => a.username.localeCompare(b.username));
    return me ? [me, ...others] : others;
  }, [employees, currentUserId]);

  const todayIsThisDay = isSameDay(now.toISOString(), day);
  const hourLabels = Array.from(
    { length: VISIBLE_HOURS },
    (_, i) => VISIBLE_START_HOUR + i,
  );

  // Px position from visible start for a given ISO timestamp on `day`.
  const xPxFor = (iso: string): number => {
    const t = new Date(iso);
    const mins = (t.getHours() - VISIBLE_START_HOUR) * 60 + t.getMinutes();
    return Math.max(0, Math.min(TIMELINE_WIDTH_PX, (mins / 60) * PX_PER_HOUR));
  };

  const nowX = useMemo(() => {
    if (!todayIsThisDay) return null;
    const mins = (now.getHours() - VISIBLE_START_HOUR) * 60 + now.getMinutes();
    if (mins < 0 || mins > VISIBLE_HOURS * 60) return null;
    return (mins / 60) * PX_PER_HOUR;
  }, [now, todayIsThisDay]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 340px)" }}>
        {/* Hour header */}
        <div
          className="grid sticky top-0 z-20 bg-secondary/40 backdrop-blur border-b border-border"
          style={{ gridTemplateColumns: `200px ${TIMELINE_WIDTH_PX}px` }}
        >
          <div className="px-3 py-2.5 text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground border-r border-border">
            Employee
          </div>
          <div className="relative h-9">
            {hourLabels.map((h, i) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 flex items-center text-[10px] font-mono tabular-nums text-muted-foreground border-l border-border/50 px-1"
                style={{ left: i * PX_PER_HOUR, width: PX_PER_HOUR }}
              >
                {formatHourLabel(h)}
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {orderedEmployees.length === 0 ? (
          <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">
            No employees in this company.
          </div>
        ) : (
          <div
            className="grid"
            style={{ gridTemplateColumns: `200px ${TIMELINE_WIDTH_PX}px` }}
          >
            {orderedEmployees.map((e) => {
              const isMe = e.supa_id === currentUserId;
              const accent = accentForId(e.supa_id);
              const dayShifts = shifts.filter(
                (s) => s.user_supa_id === e.supa_id && isSameDay(s.starts_at, day),
              );
              const dayHours = dayShifts.reduce((sum, s) => sum + shiftHours(s), 0);

              return (
                <div
                  key={e.supa_id}
                  className="contents"
                >
                  {/* Employee cell */}
                  <div
                    className="px-3 py-2.5 flex items-center gap-2.5 border-r border-border border-b border-border/60 min-w-0"
                    style={{ height: ROW_HEIGHT_PX }}
                  >
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
                        {dayHours > 0 ? `${dayHours.toFixed(1)}h today` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Timeline row */}
                  <div
                    className="relative border-b border-border/60 hover:bg-secondary/10 transition-colors"
                    style={{ height: ROW_HEIGHT_PX }}
                    onClick={(evt) => {
                      const rect = (evt.currentTarget as HTMLElement).getBoundingClientRect();
                      const px = evt.clientX - rect.left;
                      const mins = Math.max(0, Math.round((px / PX_PER_HOUR) * 60 / 15) * 15);
                      const start = new Date(day);
                      start.setHours(VISIBLE_START_HOUR, 0, 0, 0);
                      start.setMinutes(mins);
                      onEmptyCellClick(start, e.supa_id);
                    }}
                  >
                    {/* Hour grid lines */}
                    {hourLabels.map((h, i) => (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 border-l border-border/30"
                        style={{ left: i * PX_PER_HOUR }}
                      />
                    ))}

                    {/* Shift pills */}
                    {dayShifts.map((s) => {
                      const left = xPxFor(s.starts_at);
                      const right = xPxFor(s.ends_at);
                      const width = Math.max(20, right - left);
                      const typeMeta = SHIFT_TYPE_META[s.type];
                      const color = s.color || typeMeta.accent;
                      const isInProgress = s.status === "in_progress";
                      const isCancelled  = s.status === "cancelled";
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            onShiftClick(s);
                          }}
                          className={[
                            "absolute top-1.5 bottom-1.5 rounded-md text-left overflow-hidden px-1.5 py-1",
                            "hover:z-30 transition-all",
                            isInProgress ? "ring-2 ring-emerald-400/60" : "",
                            isCancelled ? "opacity-50 line-through" : "",
                          ].join(" ")}
                          style={{
                            left,
                            width,
                            background: `${color}1f`,
                            borderLeft: `3px solid ${color}`,
                          }}
                          title={`${s.title || typeMeta.label} (${new Date(s.starts_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${new Date(s.ends_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[10.5px] font-bold text-foreground truncate leading-tight flex-1 min-w-0">
                              {s.title || typeMeta.label}
                            </span>
                            {isVirtualInstance(s) && (
                              <Lock className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                            )}
                            {s.coverage_requested_at && (
                              <AlertCircle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                            )}
                            {isInProgress && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            )}
                          </div>
                          {width >= 80 && (
                            <p className="text-[9.5px] text-muted-foreground font-mono tabular-nums truncate">
                              {shiftHours(s).toFixed(1)}h
                            </p>
                          )}
                        </button>
                      );
                    })}

                    {/* Empty-state plus on hover */}
                    {dayShifts.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                        <Plus className="w-3.5 h-3.5 text-muted-foreground/60" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Now-line (full-height vertical rule overlaying the body) */}
        {nowX !== null && (
          <div
            className="absolute z-30 pointer-events-none"
            style={{
              left: `calc(200px + ${nowX}px)`,
              top: 36,
              bottom: 0,
            }}
          >
            <div className="relative h-full">
              <div className="absolute -left-1 top-0 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              <div className="w-px h-full bg-primary/70 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────

function formatHourLabel(h: number): string {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12)   return `${h} AM`;
  return `${h - 12} PM`;
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
