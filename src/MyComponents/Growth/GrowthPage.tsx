/**
 * GrowthPage.tsx — /growth detail view.
 *
 * Role-adaptive:
 *   · Every signed-in user sees their own approved track at the
 *     top with a vertical step timeline, progress, and Axon note.
 *   · CEO / COO / CFO additionally see a Team Tracks section
 *     showing every other employee's track with progress + an
 *     Edit button that opens the existing CreateGrowthTrackDialog
 *     prefilled with that employee's id.
 *
 * Linked from CareerGrowthCard's "View breakdown" footer button.
 * No timeline-edit affordance for non-managers in v1 — managers
 * own the milestones; employees view progress and ask their
 * manager to update steps. (Lifting that constraint is RLS work.)
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Pencil,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  ActiveUser,
  useAllVisibleGrowthTracks,
  useMyGrowthTrack,
  useToggleGrowthStep,
  type GrowthMilestoneStep,
  type GrowthTrackRow,
  type GrowthTrackWithOwner,
} from "@/stores/query";
import { isCLevel } from "@/MyComponents/Dashboard/row4ViewStore";
import { useCreateGrowthTrackDialog } from "@/MyComponents/Dashboard/createGrowthTrackStore";

// ── Helpers ────────────────────────────────────────────────────

function pacingChip(status: GrowthTrackRow["pacing_status"]) {
  switch (status) {
    case "ahead":
      return { text: "AHEAD", tone: "text-success", bg: "bg-success/15" };
    case "attention_needed":
      return { text: "ATTENTION", tone: "text-warning", bg: "bg-warning/15" };
    default:
      return { text: "ON TRACK", tone: "text-foreground/80", bg: "bg-foreground/10" };
  }
}

function progressOf(track: GrowthTrackRow) {
  const steps = Array.isArray(track.milestone_steps) ? track.milestone_steps : [];
  const completed = steps.filter((s) => s.completed).length;
  const total = steps.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { completed, total, pct, steps };
}

function fmtDueDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysFromNow(d: string | null): number | null {
  if (!d) return null;
  const dt = new Date(d).getTime();
  if (Number.isNaN(dt)) return null;
  return Math.round((dt - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── Step timeline (vertical) ───────────────────────────────────

function StepTimeline({
  steps,
  trackId,
  canEdit,
}: {
  steps: GrowthMilestoneStep[];
  trackId: string;
  canEdit: boolean;
}) {
  // Identify the "current" step (first non-completed) so it gets
  // a ring treatment to read as the present moment in the arc.
  const currentIndex = useMemo(
    () => steps.findIndex((s) => !s.completed),
    [steps],
  );
  const toggleStep = useToggleGrowthStep();

  if (steps.length === 0) {
    return (
      <p className="text-[12px] text-text-tertiary italic py-3">
        No steps yet. A manager can add the concrete checklist that
        gets you to this milestone.
      </p>
    );
  }

  function onToggle(step: GrowthMilestoneStep) {
    if (!canEdit || !step.id) return;
    toggleStep.mutate({
      trackId,
      stepId: step.id,
      completed: !step.completed,
    });
  }

  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isDone = s.completed;
        const dueDays = daysFromNow(s.due_date);
        const overdue =
          !isDone && dueDays !== null && dueDays < 0 && s.due_date != null;
        // Bullet renders as a button when editable, as a div otherwise.
        const bulletClass = `absolute left-0 top-0 h-[22px] w-[22px] rounded-full flex items-center justify-center transition-all ${
          isDone
            ? "bg-success/15 text-success hover:bg-success/25"
            : isCurrent
              ? "bg-primary/15 text-primary ring-2 ring-primary/40 hover:bg-primary/25"
              : "bg-foreground/[0.04] text-text-tertiary hover:bg-foreground/10"
        } ${canEdit ? "cursor-pointer" : ""}`;
        return (
          <li
            key={s.id ?? `${i}-${s.label}`}
            className="relative pl-8 pb-5 last:pb-0"
          >
            {/* Connecting line */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`absolute left-[10px] top-5 bottom-0 w-[2px] ${
                  isDone ? "bg-success/40" : "bg-border-soft"
                }`}
              />
            )}
            {/* Bullet */}
            {canEdit ? (
              <button
                type="button"
                onClick={() => onToggle(s)}
                disabled={toggleStep.isPending}
                title={isDone ? "Mark not done" : "Mark done"}
                className={bulletClass}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </button>
            ) : (
              <div className={bulletClass}>
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
            )}
            {/* Content */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[13px] ${
                    isDone
                      ? "text-foreground/60 line-through"
                      : isCurrent
                        ? "text-foreground font-semibold"
                        : "text-foreground/85"
                  }`}
                >
                  {s.label}
                </span>
                {isCurrent && !isDone && (
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-primary bg-primary/10 rounded-md px-1.5 py-0.5">
                    Current
                  </span>
                )}
                {overdue && (
                  <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-warning bg-warning/10 rounded-md px-1.5 py-0.5">
                    Overdue
                  </span>
                )}
              </div>
              {s.due_date && (
                <div className="text-[10.5px] text-text-tertiary mt-0.5">
                  Due {fmtDueDate(s.due_date)}
                  {dueDays !== null && !isDone && (
                    <>
                      {" "}
                      · {dueDays >= 0 ? `${dueDays}d left` : `${-dueDays}d ago`}
                    </>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── One full track card (used for self + each team member) ─────

function TrackDetailCard({
  track,
  ownerLabel,
  ownerRole,
  canEdit,
}: {
  track: GrowthTrackRow;
  ownerLabel: string;
  ownerRole?: string | null;
  canEdit: boolean;
}) {
  const openDialog = useCreateGrowthTrackDialog((s) => s.openDialog);
  const { steps, completed, total, pct } = progressOf(track);
  const pacing = pacingChip(track.pacing_status);

  const nextDue = steps.find((s) => !s.completed && s.due_date)?.due_date;
  const daysToNext = daysFromNow(nextDue ?? null);

  return (
    <div className="rounded-xl border-xs border-border-soft bg-card overflow-hidden">
      {/* Header strip */}
      <header className="flex items-center justify-between gap-3 px-5 py-3 bg-popover/60 border-b border-xs border-border-soft">
        <div className="min-w-0 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-primary/15 text-primary flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground truncate">
              {ownerLabel}
            </div>
            <div className="text-[10.5px] text-text-tertiary truncate">
              {track.role_title}
              {ownerRole && ownerRole !== track.role_title ? ` · ${ownerRole}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 ${pacing.bg} ${pacing.tone} text-[9.5px] font-semibold uppercase tracking-[0.12em] rounded-md px-1.5 py-0.5`}
          >
            <TrendingUp className="h-2.5 w-2.5" />
            {pacing.text}
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => openDialog({ employeeId: track.user_id })}
              className="flex items-center gap-1 text-[11px] font-semibold text-foreground/80 hover:text-foreground border-xs border-border-soft rounded-md px-2 py-1 hover:bg-foreground/[0.04] transition-colors"
              title="Edit track"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Milestone + progress */}
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-0.5">
            Next milestone
          </div>
          <div className="text-[15px] font-semibold text-foreground mb-2">
            {track.next_milestone}
          </div>
          <div className="h-2 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-success rounded-full"
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-text-tertiary">
            <span>
              {completed} of {total} steps · {pct}%
            </span>
            {daysToNext !== null && (
              <span>
                {daysToNext >= 0
                  ? `${daysToNext}d to next step`
                  : `${-daysToNext}d past next step`}
              </span>
            )}
          </div>
        </div>

        {/* Axon note */}
        {track.axon_note && (
          <div className="rounded-md bg-foreground/[0.025] border-xs border-border-soft p-3">
            <div className="flex items-center gap-1.5 mb-1 text-primary">
              <Sparkles className="h-3 w-3" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
                Axon
              </span>
            </div>
            <p className="text-[12px] text-foreground/85 leading-snug italic">
              &ldquo;{track.axon_note}&rdquo;
            </p>
          </div>
        )}

        {/* Step timeline — owner (their own track) and managers
            (any track they can see) can toggle each step. RPC
            validates authorization server-side. */}
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-2.5">
            Steps
            <span className="ml-2 text-text-tertiary/60 normal-case tracking-normal italic font-normal">
              · tap a bullet to mark complete
            </span>
          </div>
          <StepTimeline
            steps={steps}
            trackId={track.id}
            canEdit
          />
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export function GrowthPage() {
  const navigate = useNavigate();
  const openDialog = useCreateGrowthTrackDialog((s) => s.openDialog);
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const myId: string | undefined = me?.supa_id ?? undefined;
  const myName: string = me?.username ?? "You";
  const myRole: string | undefined = me?.role ?? undefined;
  const canManage = isCLevel(myRole);

  const { data: myTrack, isLoading: loadingMine } = useMyGrowthTrack();
  const { data: allTracks = [], isLoading: loadingAll } =
    useAllVisibleGrowthTracks();

  // Team tracks = everyone-else's tracks the manager can see.
  const teamTracks: GrowthTrackWithOwner[] = useMemo(() => {
    if (!canManage) return [];
    return allTracks.filter((t) => t.user_id !== myId);
  }, [allTracks, canManage, myId]);

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Page header */}
      <div className="px-8 py-7 bg-popover border-b border-xs border-border-soft relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent"
        />
        <div className="flex items-end justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate({ to: "/" })}
              className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-foreground mb-2 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to home
            </button>
            <motion.h1
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[26px] font-bold text-foreground tracking-tight"
            >
              <span className="text-primary">Growth</span>
            </motion.h1>
            <p className="text-[12.5px] text-text-tertiary mt-0.5">
              {canManage
                ? "Your arc, and every track you're responsible for."
                : "Your career arc — milestones, progress, and what's next."}
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => openDialog()}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New track
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-8 py-6 max-w-[1200px] mx-auto space-y-6">
        {/* My track */}
        <section>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary mb-2">
            Your track
          </h2>
          {loadingMine ? (
            <div className="rounded-xl border-xs border-border-soft bg-card p-6 text-[12px] text-text-tertiary italic">
              Loading…
            </div>
          ) : !myTrack ? (
            <div className="rounded-xl border-xs border-border-soft bg-card p-8 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-primary/10 border-xs border-primary/20 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="text-[13px] font-semibold text-foreground mb-1">
                {canManage
                  ? "You don't have a track yet"
                  : "Your growth track is being prepared"}
              </p>
              <p className="text-[12px] text-text-tertiary leading-snug max-w-[400px] mx-auto">
                {canManage
                  ? "Author your own arc to model the format for the team."
                  : "Axon drafts the milestones from your work patterns. Once your manager approves, the arc shows up here."}
              </p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => openDialog({ employeeId: myId })}
                  className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-white bg-primary hover:bg-primary/90 rounded-md px-3 py-1.5 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Create your track
                </button>
              )}
            </div>
          ) : (
            <TrackDetailCard
              track={myTrack}
              ownerLabel={myName}
              ownerRole={myRole}
              canEdit={canManage}
            />
          )}
        </section>

        {/* Team tracks — managers only */}
        {canManage && (
          <section>
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              Team tracks
              {teamTracks.length > 0 && (
                <span className="text-text-tertiary/60">· {teamTracks.length}</span>
              )}
            </h2>
            {loadingAll ? (
              <div className="rounded-xl border-xs border-border-soft bg-card p-6 text-[12px] text-text-tertiary italic">
                Loading team tracks…
              </div>
            ) : teamTracks.length === 0 ? (
              <div className="rounded-xl border-xs border-border-soft bg-card p-6 text-[12px] text-text-tertiary italic text-center">
                No team tracks yet. Use New track above to author one for
                each direct report.
              </div>
            ) : (
              <div className="space-y-3">
                {teamTracks.map((t) => (
                  <TrackDetailCard
                    key={t.id}
                    track={t}
                    ownerLabel={t.owner_username ?? "Unknown user"}
                    ownerRole={t.owner_role}
                    canEdit
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
