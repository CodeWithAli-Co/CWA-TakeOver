/**
 * CareerGrowthCard.tsx — Row 4 top-right (40% width, half row height).
 *
 * Reads the current user's manager-approved growth track via
 * `useMyGrowthTrack()`. RLS at the DB layer scopes by auth.uid().
 *
 * Distinct from the Goal card in Row 3 (which is short-term sprint
 * focus) — this is the longer-arc career track Axon proposes and a
 * manager approves.
 *
 * Empty state ("preparing your track") renders when the user has no
 * approved track yet. The Axon-proposal pathway that writes new rows
 * to growth_tracks is out of scope for this pass.
 */

import { ArrowRight, Plus, Sparkles, TrendingUp } from "lucide-react";
import { BentoCard } from "./BentoCard";
import { ActiveUser, useMyGrowthTrack } from "@/stores/query";
import { isCLevel } from "./row4ViewStore";
import { useCreateGrowthTrackDialog } from "./createGrowthTrackStore";

function pacingChip(status: "on_track" | "attention_needed" | "ahead") {
  switch (status) {
    case "ahead":
      return { text: "AHEAD", tone: "text-success", bg: "bg-success/15" };
    case "attention_needed":
      return {
        text: "ATTENTION",
        tone: "text-warning",
        bg: "bg-warning/15",
      };
    default:
      return {
        text: "ON TRACK",
        tone: "text-foreground/80",
        bg: "bg-foreground/10",
      };
  }
}

/** Empty state — no approved track yet. C-level users see a CTA
 *  to create one (acting as managers until manager_id wires up);
 *  everyone else sees the "preparing" copy. */
function PreparingCard({ canManage }: { canManage: boolean }) {
  const openDialog = useCreateGrowthTrackDialog((s) => s.openDialog);
  return (
    <div className="flex flex-col h-full items-center justify-center text-center px-4 gap-2">
      <div className="h-7 w-7 rounded-full bg-primary/10 border-xs border-primary/20 flex items-center justify-center">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <p className="text-[12px] font-semibold text-foreground">
        {canManage ? "No growth track yet" : "Your growth track is being prepared"}
      </p>
      <p className="text-[11px] text-text-tertiary leading-snug max-w-[240px]">
        {canManage
          ? "Author a track for anyone on the team — role, milestone, steps. The employee sees it on their dashboard immediately."
          : "Axon drafts the milestones from your work patterns. Once your manager approves, the arc shows up here."}
      </p>
      {canManage && (
        <button
          type="button"
          onClick={() => openDialog()}
          className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Create a track
        </button>
      )}
    </div>
  );
}

export function CareerGrowthCard() {
  const { data: track, isLoading } = useMyGrowthTrack();
  const { data: meRows } = ActiveUser();
  const role: string | undefined = (meRows?.[0] as any)?.role ?? undefined;
  const canManage = isCLevel(role);

  return (
    <BentoCard label="GROWTH" withHeaderBar className="h-full">
      {isLoading ? (
        <div className="flex items-center justify-center h-full text-[11px] text-text-tertiary italic">
          Loading your track…
        </div>
      ) : !track ? (
        <PreparingCard canManage={canManage} />
      ) : (
        <TrackBody track={track} canManage={canManage} />
      )}
    </BentoCard>
  );
}

function TrackBody({
  track,
  canManage,
}: {
  track: NonNullable<ReturnType<typeof useMyGrowthTrack>["data"]>;
  canManage: boolean;
}) {
  const openDialog = useCreateGrowthTrackDialog((s) => s.openDialog);
  const steps = Array.isArray(track.milestone_steps)
    ? track.milestone_steps
    : [];
  const completed = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const pacing = pacingChip(track.pacing_status);

  const nextDue = steps.find((s) => !s.completed && s.due_date)?.due_date;
  const daysRemaining = nextDue
    ? Math.max(
        0,
        Math.round(
          (new Date(nextDue).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      )
    : null;

  return (
    <div className="flex flex-col h-full gap-2.5">
      {/* Role + pacing chip */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-0.5">
            Current role
          </div>
          <div className="text-[13px] font-semibold text-foreground truncate">
            {track.role_title}
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center gap-1 ${pacing.bg} ${pacing.tone} text-[9.5px] font-semibold uppercase tracking-[0.12em] rounded-md px-1.5 py-0.5`}
        >
          <TrendingUp className="h-2.5 w-2.5" />
          {pacing.text}
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

      {/* Footer — manager-edit button on the left, disabled detail
          link on the right (route lands later). */}
      <div className="mt-auto pt-1 flex items-center justify-between">
        {canManage ? (
          <button
            type="button"
            onClick={() => openDialog({ employeeId: track.user_id })}
            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/75 hover:text-foreground transition-colors"
          >
            Edit track
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled
          title="Track detail view comes online with the breakdown route"
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary/60 cursor-not-allowed"
        >
          View breakdown
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}
