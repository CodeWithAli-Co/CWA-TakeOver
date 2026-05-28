/**
 * TeamPulseCard.tsx — Row 4 bottom-right (40% width, half row height).
 *
 * v1 SHELL: layout skeleton populated with demo activity. Day 2 swaps
 * to a Supabase-backed read of `team_activity` with demo fallback when
 * useDemoMode is on.
 *
 * Three activity types only: wins, status changes, kudos. Not a
 * social feed — no comments, no likes, no doc-edit noise. Just
 * connective tissue across the company.
 */

import { Trophy, ArrowUpRight, HandHeart, ArrowRight } from "lucide-react";
import { BentoCard } from "./BentoCard";
import { DEMO_TEAM_ACTIVITY } from "@/stores/demoMode";

function relativeTime(hoursAgo: number): string {
  if (hoursAgo < 1) return "just now";
  if (hoursAgo < 24) return `${Math.round(hoursAgo)}h`;
  if (hoursAgo < 48) return "yesterday";
  return `${Math.round(hoursAgo / 24)}d ago`;
}

function iconForType(type: "win" | "status_change" | "kudos") {
  switch (type) {
    case "win":
      return { Icon: Trophy, tone: "text-success" };
    case "status_change":
      return { Icon: ArrowUpRight, tone: "text-foreground/60" };
    case "kudos":
      return { Icon: HandHeart, tone: "text-primary" };
  }
}

export function TeamPulseCard() {
  // SHELL: demo data unconditionally. Day 2 wires real query +
  // useDemoMode fallback.
  const items = DEMO_TEAM_ACTIVITY;

  return (
    <BentoCard
      label="TEAM PULSE"
      withHeaderBar
      className="h-full"
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
          <ul className="space-y-0.5">
            {items.map((item) => {
              const { Icon, tone } = iconForType(item.activity_type);
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-2 py-1.5 border-b border-border-soft/40 last:border-b-0"
                >
                  <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${tone}`} />
                  <p className="flex-1 text-[11.5px] text-foreground/80 leading-snug">
                    {item.description}
                  </p>
                  <span className="text-[10px] text-text-tertiary shrink-0 tabular-nums">
                    {relativeTime(item.hours_ago)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="pt-2 mt-1 border-t border-border-soft/40">
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </BentoCard>
  );
}
