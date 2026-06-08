/**
 * KanbanInvestorCard.tsx — compact card for the InvestorKanban
 * columns. Trimmed-down sibling of InvestorCard (the grid card):
 *
 *   · Same priority rail (left edge) for visual continuity
 *   · Firm name + partner count
 *   · Tiny fit bar + last-outreach age
 *   · No thesis snippet (column width too narrow to be readable)
 *   · No stage chip (it's implicit from which column you're in)
 *
 * Native-draggable so the parent InvestorKanban can listen for
 * onDragStart / onDragEnd. A short-click still bubbles cleanly to
 * onOpen since the browser's drag threshold (~3-5px) means a
 * normal click never fires a drag.
 */

import { Users } from "lucide-react";
import type { InvestorListEntry } from "@/stores/investors";

interface Props {
  investor: InvestorListEntry;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

// Same priority rail palette as InvestorCard so a card looks
// identical whether it's in the grid or the kanban.
const PRIORITY_RAIL: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-primary",
  1: "bg-amber-500/80",
  2: "bg-foreground/15",
  3: "bg-foreground/5",
};

const PRIORITY_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "P0",
  1: "P1",
  2: "P2",
  3: "P3",
};

export function KanbanInvestorCard({
  investor,
  onOpen,
  onDragStart,
  onDragEnd,
}: Props) {
  const rail = PRIORITY_RAIL[investor.priority];
  const ageDays =
    investor.last_outreach_at != null
      ? Math.floor(
          (Date.now() - new Date(investor.last_outreach_at).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;
  return (
    <article
      role="button"
      tabIndex={0}
      draggable
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="relative cursor-grab active:cursor-grabbing rounded-sm border border-border bg-card hover:border-foreground/25 hover:bg-card/80 transition-colors p-2.5 pl-3"
    >
      {/* Priority rail */}
      <span
        className={"absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-sm " + rail}
        aria-hidden
      />

      {/* Firm name + priority pip */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[12.5px] font-semibold text-foreground leading-tight m-0 truncate flex-1">
          {investor.company_name}
        </h4>
        <span className="text-[9.5px] font-mono uppercase tracking-[0.1em] text-foreground/45 flex-shrink-0">
          {PRIORITY_LABEL[investor.priority]}
        </span>
      </div>

      {/* Partner count + last-outreach age */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono text-foreground/45">
        <span className="inline-flex items-center gap-1">
          <Users size={9} />
          {investor.partner_count}
        </span>
        <span className="tabular-nums">
          {ageDays == null
            ? "—"
            : ageDays === 0
              ? "today"
              : `${ageDays}d ago`}
        </span>
      </div>

      {/* Fit bar — tiny single-line gauge */}
      <FitBar value={investor.fit_score} />
    </article>
  );
}

function FitBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 75
      ? "bg-emerald-500/70"
      : pct >= 50
        ? "bg-primary/70"
        : pct >= 25
          ? "bg-amber-500/70"
          : "bg-foreground/20";
  return (
    <div className="mt-2 h-[2px] rounded-full bg-foreground/8 overflow-hidden">
      <div
        className={"h-full transition-all " + tone}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
