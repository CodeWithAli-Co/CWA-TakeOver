/**
 * CareerGrowthCard.tsx — Row 4 top-right (40% width, half row height).
 *
 * v1 SHELL: layout skeleton populated with demo growth-track content
 * so we can review proportions and visual structure. Day 2 swaps to a
 * Supabase-backed read of `growth_tracks` with demo fallback when
 * useDemoMode is on, plus the manager-approved gating.
 *
 * Distinct from the Goal card in Row 3 — that's short-term sprint
 * focus; this is the longer-arc career track.
 */

import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { BentoCard } from "./BentoCard";
import { DEMO_GROWTH_TRACK } from "@/stores/demoMode";

export function CareerGrowthCard() {
  // SHELL: demo data unconditionally. Day 2 wires the real query.
  const track = DEMO_GROWTH_TRACK;

  const completed = track.milestone_steps.filter((s) => s.completed).length;
  const total = track.milestone_steps.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const pacingLabel = (() => {
    switch (track.pacing_status) {
      case "ahead":
        return { text: "AHEAD", tone: "text-success", bg: "bg-success/15" };
      case "attention_needed":
        return { text: "ATTENTION", tone: "text-warning", bg: "bg-warning/15" };
      default:
        return { text: "ON TRACK", tone: "text-foreground/80", bg: "bg-foreground/10" };
    }
  })();

  // Days remaining = soonest non-completed step's due_date
  const nextDue = track.milestone_steps.find(
    (s) => !s.completed && s.due_date,
  )?.due_date;
  const daysRemaining = nextDue
    ? Math.max(
        0,
        Math.round(
          (new Date(nextDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <BentoCard
      label="GROWTH"
      withHeaderBar
      className="h-full"
    >
      <div className="flex flex-col h-full gap-2.5">
        {/* Role + pacing chip */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-0.5">
              Current role
            </div>
            <div className="text-[13px] font-semibold text-foreground truncate">
              {track.current_role}
            </div>
          </div>
          <span
            className={`shrink-0 inline-flex items-center gap-1 ${pacingLabel.bg} ${pacingLabel.tone} text-[9.5px] font-semibold uppercase tracking-[0.12em] rounded-md px-1.5 py-0.5`}
          >
            <TrendingUp className="h-2.5 w-2.5" />
            {pacingLabel.text}
          </span>
        </div>

        {/* Milestone + progress */}
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-0.5">
            Next milestone
          </div>
          <div className="text-[12.5px] text-foreground/90 mb-1.5">
            {track.next_milestone}
          </div>
          <div className="h-1.5 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10.5px] text-text-tertiary">
            <span>
              {completed} of {total} steps
            </span>
            {daysRemaining !== null && <span>{daysRemaining}d to next</span>}
          </div>
        </div>

        {/* Axon note */}
        {track.axon_note && (
          <div className="rounded-md bg-foreground/[0.025] border-xs border-border-soft p-2">
            <div className="flex items-center gap-1.5 mb-0.5 text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              <span className="text-[9px] font-semibold uppercase tracking-[0.14em]">
                Axon
              </span>
            </div>
            <p className="text-[11px] text-foreground/85 leading-snug italic">
              &ldquo;{track.axon_note}&rdquo;
            </p>
          </div>
        )}

        {/* Footer link */}
        <div className="mt-auto pt-1">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary hover:text-foreground transition-colors"
          >
            View breakdown
            <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </BentoCard>
  );
}
