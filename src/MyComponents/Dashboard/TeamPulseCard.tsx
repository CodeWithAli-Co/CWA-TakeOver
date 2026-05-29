/**
 * TeamPulseCard.tsx — Row 4 bottom-right (40% width, half row height).
 *
 * Reads `team_activity` (whole-company, RLS-allowed to any
 * authenticated user) via useTeamActivity(). Renders 5–7 visible
 * rows of wins / status changes / kudos. Empty state for genuinely
 * quiet days.
 *
 * Three activity types:
 *   · status_change — emitted automatically by the DB trigger when
 *                     a cwa_todos row transitions to done
 *   · kudos         — written by the Send-Kudos composer (Cmd+K)
 *   · win           — celebrated wins (no UI for this yet — table
 *                     ready for when celebrate-this surfaces land)
 *
 * Not a social feed. No comments, no likes, no doc-edit noise.
 */

import { Activity, ArrowRight, ArrowUpRight, HandHeart, Trophy } from "lucide-react";
import { BentoCard } from "./BentoCard";
import { useTeamActivity, type TeamActivityRow } from "@/stores/query";
import { useSendKudosDialog } from "./sendKudosStore";

function relativeTime(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const mins = Math.round(ageMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  if (hours < 48) return "yesterday";
  return `${Math.round(hours / 24)}d ago`;
}

function iconForType(type: TeamActivityRow["activity_type"]) {
  switch (type) {
    case "win":
      return { Icon: Trophy, tone: "text-success" };
    case "status_change":
      return { Icon: ArrowUpRight, tone: "text-foreground/60" };
    case "kudos":
      return { Icon: HandHeart, tone: "text-primary" };
  }
}

function EmptyState() {
  const openKudos = useSendKudosDialog((s) => s.openDialog);
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center">
      <div className="text-center px-4">
        <div className="mx-auto h-7 w-7 rounded-full bg-foreground/[0.04] border-xs border-border-soft flex items-center justify-center mb-2">
          <Activity className="h-3.5 w-3.5 text-text-tertiary" />
        </div>
        <p className="text-[11.5px] text-text-tertiary leading-snug max-w-[200px] mx-auto mb-2">
          Quiet so far. Mark a task as done or send someone kudos to
          start the feed.
        </p>
        <button
          type="button"
          onClick={() => openKudos()}
          className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <HandHeart className="h-3 w-3" />
          Send the first kudos
        </button>
      </div>
    </div>
  );
}

export function TeamPulseCard() {
  const { data: items = [], isLoading } = useTeamActivity(20);
  const openKudos = useSendKudosDialog((s) => s.openDialog);

  // Pull up to 20 so a scroll position has somewhere to go, but
  // cap the visible scroll viewport height (see max-h on the
  // overflow div below) so the card doesn't stretch the row.
  const visible = items.slice(0, 20);
  const hasItems = visible.length > 0;

  return (
    <BentoCard
      label="TEAM PULSE"
      withHeaderBar
      className="h-full"
      headerActions={
        <button
          type="button"
          onClick={() => openKudos()}
          aria-label="Send kudos"
          title="Send kudos"
          className="
            inline-flex items-center gap-1 h-6 px-2 rounded-md
            text-[10.5px] font-semibold
            text-primary/85 hover:text-primary
            bg-primary/[0.06] hover:bg-primary/[0.12]
            border border-primary/20 hover:border-primary/35
            transition-colors
          "
        >
          <HandHeart className="h-3 w-3" />
          Kudos
        </button>
      }
    >
      <div className="flex flex-col h-full">
        {isLoading ? (
          <div className="min-h-[120px] flex items-center justify-center text-[11px] text-text-tertiary italic">
            Loading…
          </div>
        ) : !hasItems ? (
          <EmptyState />
        ) : (
          // Cap the scroll viewport so the card stays compact even
          // when the feed has many rows — 240px ≈ 7 rows visible.
          <div className="max-h-[240px] overflow-y-auto -mx-1 px-1">
            <ul className="list-none p-0 m-0 space-y-0.5">
              {visible.map((item) => {
                const { Icon, tone } = iconForType(item.activity_type);
                return (
                  <li
                    key={item.id}
                    className="list-none flex items-start gap-2 py-1.5 border-b border-border-soft/40 last:border-b-0"
                  >
                    <Icon
                      className={`h-3 w-3 mt-0.5 shrink-0 ${tone}`}
                    />
                    <p className="flex-1 text-[11.5px] text-foreground/80 leading-snug">
                      {item.description}
                    </p>
                    <span className="text-[10px] text-text-tertiary shrink-0 tabular-nums">
                      {relativeTime(item.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="pt-2 mt-1 border-t border-border-soft/40">
          <button
            type="button"
            disabled
            title="Full feed view comes online with the breakdown route"
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary/60 cursor-not-allowed"
          >
            View all
            <ArrowRight className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
    </BentoCard>
  );
}
