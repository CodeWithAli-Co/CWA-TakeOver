/**
 * ShiftBlock.tsx — Two visual representations of a single shift:
 *
 *   1. <ShiftBlock> — Absolutely-positioned vertical rectangle for the
 *      hourly grid (Me + Person modes). Position derived from
 *      starts_at / ends_at relative to the visible-start-hour. Block is
 *      colored by type; in-progress shifts get a pulsing emerald ring;
 *      completed shifts get a slight desaturation; no-show gets a
 *      diagonal-stripe warning overlay.
 *
 *   2. <ShiftSwimlanePill> — Compact horizontal pill for the Team
 *      swimlane mode. Same color logic but the layout is short and wide
 *      because team rows don't have hour resolution.
 */

import { Clock } from "lucide-react";
import {
  SHIFT_TYPE_META,
  SHIFT_STATUS_META,
  formatClock,
  shiftHours,
  type Shift,
} from "@/stores/shiftTypes";

// ============================================================
// Vertical block (hourly grid)
// ============================================================

interface BlockProps {
  shift: Shift;
  hourHeightPx: number;
  visibleStartHour: number;
  onClick: () => void;
}

export function ShiftBlock({ shift, hourHeightPx, visibleStartHour, onClick }: BlockProps) {
  const start = new Date(shift.starts_at);
  const end = new Date(shift.ends_at);

  // Minutes from visible-start at 0:00 of the same calendar day.
  const startMins = (start.getHours() - visibleStartHour) * 60 + start.getMinutes();
  const endMins   = (end.getHours()   - visibleStartHour) * 60 + end.getMinutes();
  const top = Math.max(0, (startMins / 60) * hourHeightPx);
  const height = Math.max(20, ((endMins - startMins) / 60) * hourHeightPx - 2);

  const typeMeta = SHIFT_TYPE_META[shift.type];
  const statusMeta = SHIFT_STATUS_META[shift.status];
  const accent = shift.color || typeMeta.accent;

  // Status modifiers
  const isInProgress = shift.status === "in_progress";
  const isCompleted  = shift.status === "completed";
  const isNoShow     = shift.status === "no_show";
  const isCancelled  = shift.status === "cancelled";

  const bgTint = isCancelled
    ? "rgba(110,110,116,0.06)"
    : isCompleted
      ? `${accent}10`
      : `${accent}1f`;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={[
        "group/blk absolute left-1 right-1 z-10 rounded-md text-left overflow-hidden",
        "transition-all hover:z-30",
        isInProgress
          ? "shadow-[0_0_0_2px_rgba(34,197,94,0.6),0_4px_14px_-4px_rgba(34,197,94,0.4)]"
          : "hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)]",
        isCancelled ? "opacity-50 line-through" : "",
      ].join(" ")}
      style={{
        top,
        height,
        background: bgTint,
        borderLeft: `3px solid ${accent}`,
        ...(isInProgress
          ? { boxShadow: `0 0 0 2px rgba(34,197,94,0.6) inset, 0 4px 14px -4px ${accent}66` }
          : {}),
      }}
    >
      {/* No-show diagonal stripes */}
      {isNoShow && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "repeating-linear-gradient(135deg, rgba(239,68,68,0.18) 0 6px, transparent 6px 12px)",
          }}
        />
      )}

      <div className="relative px-1.5 py-1 h-full flex flex-col">
        <div className="flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: accent }}
          />
          <span className="text-[10.5px] font-bold text-foreground truncate leading-tight">
            {shift.title || typeMeta.label}
          </span>
          {isInProgress && (
            <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {height >= 36 && (
          <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground font-mono tabular-nums">
            <Clock className="w-2.5 h-2.5" />
            {formatClock(shift.starts_at)}–{formatClock(shift.ends_at)}
          </div>
        )}

        {height >= 56 && shift.username && (
          <p className="mt-0.5 text-[9.5px] text-muted-foreground/90 truncate font-medium">
            {shift.username}
          </p>
        )}

        {height >= 76 && (
          <p className="mt-auto text-[9px] uppercase tracking-[0.1em] text-muted-foreground/70 font-bold">
            {statusMeta.label}
          </p>
        )}
      </div>
    </button>
  );
}

// ============================================================
// Horizontal pill (team swimlane)
// ============================================================

interface PillProps {
  shift: Shift;
  onClick: (e: React.MouseEvent) => void;
}

export function ShiftSwimlanePill({ shift, onClick }: PillProps) {
  const typeMeta = SHIFT_TYPE_META[shift.type];
  const accent = shift.color || typeMeta.accent;
  const isInProgress = shift.status === "in_progress";
  const isCancelled  = shift.status === "cancelled";
  const isNoShow     = shift.status === "no_show";

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e as any);
        }
      }}
      className={[
        "block rounded px-1.5 py-1 text-[10px] cursor-pointer transition-all min-w-0",
        isCancelled ? "opacity-50 line-through" : "",
        isInProgress ? "ring-1 ring-emerald-400/60" : "",
      ].join(" ")}
      style={{
        background: `${accent}1a`,
        borderLeft: `2px solid ${accent}`,
        ...(isNoShow
          ? {
              background:
                `${accent}10, repeating-linear-gradient(135deg, ${accent}22 0 4px, transparent 4px 8px)`,
            }
          : {}),
      }}
    >
      <span className="flex items-center gap-1">
        <span className="font-semibold text-foreground truncate flex-1 min-w-0">
          {shift.title || typeMeta.label}
        </span>
        {isInProgress && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
        )}
      </span>
      <span className="block text-muted-foreground truncate font-mono tabular-nums" style={{ fontSize: "9px" }}>
        {formatClock(shift.starts_at)}–{formatClock(shift.ends_at)} · {shiftHours(shift).toFixed(1)}h
      </span>
    </span>
  );
}
