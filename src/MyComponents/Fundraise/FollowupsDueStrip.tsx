/**
 * FollowupsDueStrip.tsx — the actionable surface that turns
 * "follow-up reliability" from a discipline problem into a list.
 *
 * Renders above the kanban/grid in FundraisePage when there's at
 * least one investor whose next_followup_at has come due. Each row
 * shows:
 *
 *   · Firm name + the nudge number we're on (1st / 2nd / 3rd)
 *   · Days since last outreach
 *   · "Open" button → opens the investor drawer with Partners tab
 *     pre-selected so the operator can hit Draft email immediately
 *
 * Why not a "Draft follow-up directly from the strip" button: the
 * Draft modal needs a specific partner_id, and an investor may
 * have multiple partners. Forcing the operator through the drawer
 * lets them pick which partner to nudge.
 *
 * Visual language matches the rest of the editorial chrome --
 * mono eyebrow, soft border, no chrome on the rows themselves.
 */

import { Sparkles, ChevronRight, AlertCircle } from "lucide-react";
import {
  useFollowupsDue,
  type InvestorListEntry,
} from "@/stores/investors";

interface Props {
  /** Called when the operator wants to act on a follow-up. Opens
   *  the investor drawer (FundraisePage owns the drawer state). */
  onOpenInvestor: (id: string) => void;
}

export function FollowupsDueStrip({ onOpenInvestor }: Props) {
  const { data: due = [], isLoading } = useFollowupsDue();

  // Render nothing while loading + nothing when empty -- the strip
  // is meant to disappear when there's no work to do, so absence
  // is itself information. (If the operator wants to see "no
  // follow-ups due", the stats strip already says 0.)
  if (isLoading || due.length === 0) return null;

  return (
    <section
      aria-label="Follow-ups due today"
      className="mb-5 rounded-sm border border-primary/30 bg-primary/[0.04] overflow-hidden"
    >
      {/* Strip header */}
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <AlertCircle size={12} className="text-primary" />
          <h3 className="text-[10.5px] font-mono uppercase tracking-[0.14em] font-semibold text-foreground/85 m-0">
            Follow-ups due
          </h3>
          <span className="text-[10.5px] font-mono tabular-nums font-semibold text-primary">
            {due.length}
          </span>
        </div>
        <span className="text-[10px] text-foreground/45 italic hidden sm:inline">
          {due.length === 1
            ? "one nudge ready to go"
            : `${due.length} nudges ready to go`}
        </span>
      </header>

      {/* Rows */}
      <ul className="list-none p-0 m-0 divide-y divide-primary/15">
        {due.map((inv) => (
          <FollowupRow
            key={inv.id}
            investor={inv}
            onOpen={() => onOpenInvestor(inv.id)}
          />
        ))}
      </ul>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// One row per overdue investor.
// ─────────────────────────────────────────────────────────────────

function FollowupRow({
  investor,
  onOpen,
}: {
  investor: InvestorListEntry;
  onOpen: () => void;
}) {
  // The displayed nudge number is "the one ABOUT to be sent" --
  // followup_count holds how many were sent ALREADY, so the next
  // one is count + 1. We cap at 3 because Phase 4.2 stops
  // scheduling after the 3rd nudge.
  const nudgeNumber = Math.min((investor.followup_count ?? 0) + 1, 3);
  const nudgeLabel =
    nudgeNumber === 1 ? "1st" : nudgeNumber === 2 ? "2nd" : "3rd";

  const lastOutreachDays =
    investor.last_outreach_at != null
      ? Math.floor(
          (Date.now() - new Date(investor.last_outreach_at).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

  // How overdue is this nudge? Positive number = days late.
  const overdueDays =
    investor.next_followup_at != null
      ? Math.floor(
          (Date.now() - new Date(investor.next_followup_at).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : 0;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-primary/[0.06] transition-colors group"
      >
        {/* Nudge number pip */}
        <span
          className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary/15 border border-primary/30 text-[10px] font-mono font-bold uppercase tracking-[0.08em] text-primary"
          title={`${nudgeLabel} follow-up`}
        >
          #{nudgeNumber}
        </span>

        {/* Identity */}
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-foreground truncate">
            {investor.company_name}
          </div>
          <div className="text-[10.5px] text-foreground/55 truncate">
            {nudgeLabel} follow-up
            {lastOutreachDays != null && ` · last touched ${lastOutreachDays}d ago`}
          </div>
        </div>

        {/* Overdue badge */}
        {overdueDays > 0 && (
          <span className="flex-shrink-0 text-[9.5px] font-mono tabular-nums uppercase tracking-[0.12em] text-primary/80">
            {overdueDays}d late
          </span>
        )}

        {/* Open affordance */}
        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.12em] text-foreground/55 group-hover:text-foreground transition-colors">
          <Sparkles size={11} className="text-primary" />
          Open
          <ChevronRight size={11} />
        </span>
      </button>
    </li>
  );
}
