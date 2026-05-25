/**
 * WeekNavigator.tsx — Prev / Today / Next week control + range label.
 *
 * Sits just under the page-title row in the timesheet top bar.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  weekStart: Date;
  weekEnd: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtFull(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WeekNavigator({ weekStart, weekEnd, onPrev, onNext, onToday }: Props) {
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  // "Aug 12 – 18, 2024" if same month, else "Aug 28 – Sep 3, 2024"
  const rangeLabel = sameMonth
    ? `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : `${fmt(weekStart)} – ${fmtFull(weekEnd)}`;

  // Highlight current week --
  const today = new Date();
  const isCurrentWeek = today >= weekStart && today <= weekEnd;

  return (
    <div className="flex items-center gap-2 mt-3">
      <div className="inline-flex items-center rounded-md border border-border bg-card">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous week"
          className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-l-md transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onToday}
          className="px-3 h-7 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors border-x border-border"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next week"
          className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary rounded-r-md transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <span
        className={[
          "text-[12.5px] font-semibold",
          isCurrentWeek ? "text-primary" : "text-muted-foreground",
        ].join(" ")}
      >
        Week of {rangeLabel}
        {isCurrentWeek && (
          <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
        )}
      </span>
    </div>
  );
}
