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

import { useEffect, useRef, useState } from "react";
import { Clock, Lock, AlertCircle } from "lucide-react";
import {
  SHIFT_TYPE_META,
  formatClock,
  shiftHours,
  isVirtualInstance,
  type Shift,
  type ShiftSegment,
} from "@/stores/shiftTypes";
import { isMeetingVirtualShift } from "@/stores/shifts";

// ============================================================
// Vertical block (hourly grid)
// ============================================================

/** Snap a minute count to the nearest 15-minute increment, clamped >= 0. */
function snap15(minutes: number): number {
  return Math.max(0, Math.round(minutes / 15) * 15);
}

interface BlockProps {
  shift: Shift | ShiftSegment;
  hourHeightPx: number;
  visibleStartHour: number;
  onClick: () => void;
  /**
   * Fires when the user finishes dragging/resizing. `newStart` and
   * `newEnd` are local-time ISO strings honoring the original shift's
   * date. Undefined when drag is disabled.
   */
  onUpdateTime?: (newStartIso: string, newEndIso: string) => void;
  /**
   * When true, render with extra horizontal inset and higher z-index
   * so the block visually sits inside its parent shift card. Used for
   * meetings that fall during a shift's [starts_at, ends_at] range.
   */
  nested?: boolean;
}

interface DragState {
  mode: "move" | "resize-top" | "resize-bottom";
  startClientY: number;
  origTop: number;
  origHeight: number;
}

export function ShiftBlock({
  shift,
  hourHeightPx,
  visibleStartHour,
  onClick,
  onUpdateTime,
  nested = false,
}: BlockProps) {
  const seg = shift as ShiftSegment;
  const isSegment = "_segmentIndex" in shift && shift._segmentCount > 1;
  const segStart = isSegment ? new Date(seg._segmentStart) : new Date(shift.starts_at);
  const segEnd   = isSegment ? new Date(seg._segmentEnd)   : new Date(shift.ends_at);

  // Minutes from visible-start at 0:00 of the same calendar day.
  const startMins = (segStart.getHours() - visibleStartHour) * 60 + segStart.getMinutes();
  const endMins   = (segEnd.getHours()   - visibleStartHour) * 60 + segEnd.getMinutes() + (
    // If the segment ends at exactly 23:59 due to splitAcrossMidnight,
    // round up to the visible end so the block fills the column.
    segEnd.getSeconds() === 59 && segEnd.getMinutes() === 59 ? 1 : 0
  );
  const baseTop = Math.max(0, (startMins / 60) * hourHeightPx);
  const baseHeight = Math.max(20, ((endMins - startMins) / 60) * hourHeightPx - 2);

  const typeMeta = SHIFT_TYPE_META[shift.type];
  const accent = shift.color || typeMeta.accent;

  // Status modifiers
  const isInProgress = shift.status === "in_progress";
  const isCompleted  = shift.status === "completed";
  const isNoShow     = shift.status === "no_show";
  const isCancelled  = shift.status === "cancelled";
  const isMeeting    = isMeetingVirtualShift(shift);

  // Filled-card treatment — three tiers of fill strength so the block
  // reads as a solid colored chip rather than a faintly tinted ghost.
  //   cancelled  → quiet neutral (~5%)
  //   completed  → ~10% — desaturated, "in the past"
  //   in_progress→ ~32% — strongest, demands attention
  //   default    → ~22% — clearly visible at rest
  const bgTint = isCancelled
    ? "rgba(110,110,116,0.08)"
    : isCompleted
      ? `${accent}1a`
      : isInProgress
        ? `${accent}52`
        : `${accent}38`;

  // Border at full alpha for the active state, weaker for completed/cancelled.
  const borderTint = isCancelled
    ? "rgba(110,110,116,0.25)"
    : isCompleted
      ? `${accent}30`
      : isInProgress
        ? `${accent}cc`
        : `${accent}66`;

  // ─── Drag / resize state ────────────────────────────────────
  // Disabled for virtual recurrence instances (must edit master),
  // cancelled rows, completed rows, and multi-day segments.
  const isVirtual = isVirtualInstance(shift);
  const dragDisabled =
    !onUpdateTime || isVirtual || isCancelled || isCompleted || isSegment;

  const [drag, setDrag] = useState<DragState | null>(null);
  const [ghost, setGhost] = useState<{ top: number; height: number } | null>(null);
  const blockRef = useRef<HTMLDivElement | null>(null);

  // Live pointer-move listener. We attach to window so the gesture
  // continues even when the cursor leaves the original column.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const dy = e.clientY - drag.startClientY;
      if (drag.mode === "move") {
        setGhost({ top: drag.origTop + dy, height: drag.origHeight });
      } else if (drag.mode === "resize-top") {
        const newTop = drag.origTop + dy;
        const newHeight = drag.origHeight - dy;
        if (newHeight >= 20) setGhost({ top: newTop, height: newHeight });
      } else if (drag.mode === "resize-bottom") {
        const newHeight = drag.origHeight + dy;
        if (newHeight >= 20) setGhost({ top: drag.origTop, height: newHeight });
      }
    };
    const onUp = () => {
      // Commit: convert pixel positions back to time, snap to 15-min.
      if (ghost && onUpdateTime) {
        const startMinFromVisible = snap15((ghost.top / hourHeightPx) * 60);
        const endMinFromVisible   = snap15(((ghost.top + ghost.height) / hourHeightPx) * 60);
        // Build new ISO timestamps off the original starts_at calendar day.
        const dayAnchor = new Date(shift.starts_at);
        dayAnchor.setHours(0, 0, 0, 0);
        const newStart = new Date(dayAnchor);
        newStart.setMinutes(visibleStartHour * 60 + startMinFromVisible);
        const newEnd = new Date(dayAnchor);
        newEnd.setMinutes(visibleStartHour * 60 + endMinFromVisible);
        // Guard: ensure end > start (shouldn't happen post-snap but cheap).
        if (newEnd.getTime() > newStart.getTime()) {
          onUpdateTime(newStart.toISOString(), newEnd.toISOString());
        }
      }
      setDrag(null);
      setGhost(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, ghost, hourHeightPx, visibleStartHour, onUpdateTime, shift.starts_at]);

  const startGesture = (mode: DragState["mode"]) => (e: React.PointerEvent) => {
    if (dragDisabled) return;
    e.stopPropagation();
    e.preventDefault();
    setDrag({
      mode,
      startClientY: e.clientY,
      origTop: baseTop,
      origHeight: baseHeight,
    });
    setGhost({ top: baseTop, height: baseHeight });
  };

  const displayTop    = ghost?.top    ?? baseTop;
  const displayHeight = ghost?.height ?? baseHeight;
  const isDragging = drag !== null;

  return (
    <div
      ref={blockRef}
      onClick={(e) => {
        // Suppress the click that follows a drag gesture.
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      onPointerDown={dragDisabled ? undefined : startGesture("move")}
      role="button"
      tabIndex={0}
      className={[
        "group/blk absolute z-10 rounded-lg text-left overflow-hidden",
        // Nested meetings (those that sit inside a shift's time range)
        // get extra horizontal inset so they visually sit inside the
        // parent shift card. Other blocks get the standard inset.
        nested ? "left-3 right-3" : "left-1.5 right-1.5",
        isDragging ? "z-40 cursor-grabbing select-none" : (dragDisabled ? "cursor-pointer" : "cursor-grab"),
        isDragging ? "" : "transition-all hover:z-30",
        isInProgress
          ? ""
          : "hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)]",
        isCancelled ? "opacity-50 line-through" : "",
        isDragging ? "opacity-90 ring-2 ring-primary/60" : "",
      ].join(" ")}
      style={{
        top: displayTop,
        height: displayHeight,
        background: bgTint,
        // Full border — no more half-shade with a left rail. The
        // background carries the color identity; the border defines
        // the chip edge cleanly on all four sides.
        border: `1px solid ${borderTint}`,
        zIndex: nested ? 20 : 10,
        ...(isInProgress
          ? {
              // Soft green emphasis — inset accent glow + outer halo.
              boxShadow: `0 0 0 1px rgba(34,197,94,0.5) inset, 0 0 0 3px rgba(34,197,94,0.15), 0 6px 18px -6px ${accent}88`,
            }
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

      {/* Resize handles — top + bottom edges, 6px tall. Hidden when
          drag is disabled (virtual / cancelled / completed / segments). */}
      {!dragDisabled && (
        <>
          <div
            onPointerDown={startGesture("resize-top")}
            aria-label="Resize start"
            className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize z-20 hover:bg-primary/30 transition-colors"
          />
          <div
            onPointerDown={startGesture("resize-bottom")}
            aria-label="Resize end"
            className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize z-20 hover:bg-primary/30 transition-colors"
          />
        </>
      )}

      <div className="relative px-2 py-1.5 h-full flex flex-col pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: accent }}
          />
          <span className="text-[11.5px] font-semibold text-foreground truncate leading-tight">
            {shift.title || typeMeta.label}
          </span>
          {/* Lock means "recurring — edit the master to change". Meeting
              virtual shifts also use a "::" id but represent a calendar
              event, not a recurrence — they shouldn't get the lock. */}
          {isVirtual && !isMeeting && (
            <Lock
              className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0"
              aria-label="Recurring — edit master to change"
            />
          )}
          {shift.coverage_requested_at && (
            <AlertCircle
              className="w-2.5 h-2.5 text-amber-400 shrink-0"
              aria-label="Needs cover"
            />
          )}
          {isInProgress && (
            <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>

        {displayHeight >= 32 && (
          <div className="mt-1 flex items-center gap-1 text-[9.5px] text-muted-foreground font-mono tabular-nums">
            <Clock className="w-2.5 h-2.5" />
            {formatClock(isSegment ? seg._segmentStart : shift.starts_at)}–
            {formatClock(isSegment ? seg._segmentEnd : shift.ends_at)}
            {isSegment && (
              <span className="ml-1 text-[8px] uppercase tracking-wider text-muted-foreground/70">
                {seg._segmentIndex === 0 ? "→ next day" : seg._segmentIndex === seg._segmentCount - 1 ? "from prev" : "continued"}
              </span>
            )}
          </div>
        )}

        {/* Location hint — surface the in-person place name or "Virtual"
            for meeting blocks tall enough to fit it. Helps you scan the
            day without opening every block. */}
        {displayHeight >= 56 && isMeeting && shift.location && (
          <p className="mt-1 text-[10px] text-muted-foreground/90 truncate">
            {shift.location}
          </p>
        )}
      </div>
    </div>
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
