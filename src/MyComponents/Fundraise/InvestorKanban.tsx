/**
 * InvestorKanban.tsx — 9-column board view of investors by stage.
 *
 * Toggle target for the Grid/Kanban view switch in FundraisePage.
 * Renders a horizontally-scrollable strip of stage columns, each
 * with a compact KanbanInvestorCard for every investor at that
 * stage. Drag a card between columns to update pipeline_stage —
 * uses native HTML5 drag-drop (no new dep) so it works the same
 * way the CRM PipelineView does.
 *
 * Stage order matches the funnel left-to-right:
 *   prospected → researched → reaching_out → replied →
 *   meeting_scheduled → met → considering → closed
 * with `passed` dropped at the end (visually distinct dead-state).
 *
 * Why native DnD + not dnd-kit:
 *   · No new dependency
 *   · Matches the rest of the Takeover stack (CRM, Tasks)
 *   · Threshold is handled by the browser — a quick click on the
 *     card opens the drawer without firing a drag
 *
 * Drop semantics:
 *   · Drop ON a card → ignored (we don't sort within a column,
 *     since investors are sorted by priority + fit, not manual)
 *   · Drop ON a column body → moves investor to that stage if it
 *     wasn't already there; no-op otherwise
 *
 * Optimistic update: useMoveInvestorStage runs through TanStack
 * Query's invalidation — UI will look snappy because of cached
 * state, and any error rolls back on next refetch.
 */

import { useState, useMemo, useRef } from "react";
import { ChevronRight } from "lucide-react";

import {
  INVESTOR_PIPELINE_STAGES,
  PIPELINE_STAGE_LABEL,
  useMoveInvestorStage,
  type InvestorListEntry,
  type InvestorPipelineStage,
} from "@/stores/investors";

import { KanbanInvestorCard } from "./KanbanInvestorCard";

// MIME-typed dataTransfer key keeps us from picking up unrelated
// drags (e.g. a drag from the CRM PipelineView in another window).
const DT_KEY = "application/x-fundraise-investor-id";

// Visual column ordering. `passed` goes last and sits dim — it's
// a graveyard, not an active stage.
const COLUMN_ORDER: readonly InvestorPipelineStage[] = [
  "prospected",
  "researched",
  "reaching_out",
  "replied",
  "meeting_scheduled",
  "met",
  "considering",
  "closed",
  "passed",
] as const;

// Column accents matching the card stage tints. Quiet by default;
// the "live" funnel stages (replied → considering) get a touch
// more saturation since those are where you spend your attention.
const COLUMN_ACCENT: Record<
  InvestorPipelineStage,
  { rail: string; total: string }
> = {
  prospected:        { rail: "bg-foreground/15",       total: "text-foreground/70" },
  researched:        { rail: "bg-sky-500/40",          total: "text-foreground" },
  reaching_out:      { rail: "bg-amber-500/55",        total: "text-foreground" },
  replied:           { rail: "bg-primary/70",          total: "text-primary" },
  meeting_scheduled: { rail: "bg-violet-500/60",       total: "text-foreground" },
  met:               { rail: "bg-violet-400/55",       total: "text-foreground" },
  considering:       { rail: "bg-blue-400/55",         total: "text-foreground" },
  closed:            { rail: "bg-emerald-500/70",      total: "text-emerald-400" },
  passed:            { rail: "bg-foreground/8",        total: "text-foreground/40" },
};

interface Props {
  investors: InvestorListEntry[];
  onOpen: (id: string) => void;
}

export function InvestorKanban({ investors, onOpen }: Props) {
  const moveMut = useMoveInvestorStage();
  // The stage we're hovering over while dragging — drives the
  // dashed-border highlight on the drop target column.
  const [dragOverStage, setDragOverStage] = useState<InvestorPipelineStage | null>(null);

  // Cache the id of the currently-dragged investor so the column
  // highlight skips when we hover over the column the card already
  // lives in (avoids "drop here" cue on a no-op target).
  const dragSourceId = useRef<string | null>(null);

  // Group investors by stage in one pass. Cards inside a column
  // are already sorted by (priority asc, fit desc) from the list
  // query, so we just preserve insertion order.
  const byStage = useMemo(() => {
    const map = new Map<InvestorPipelineStage, InvestorListEntry[]>();
    for (const s of COLUMN_ORDER) map.set(s, []);
    for (const inv of investors) {
      const list = map.get(inv.pipeline_stage);
      if (list) list.push(inv);
    }
    return map;
  }, [investors]);

  function handleDrop(stage: InvestorPipelineStage, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStage(null);
    const id = e.dataTransfer.getData(DT_KEY);
    dragSourceId.current = null;
    if (!id) return;
    const inv = investors.find((i) => i.id === id);
    if (!inv) return;
    if (inv.pipeline_stage === stage) return; // no-op
    moveMut.mutate({ id, stage });
  }

  return (
    // Horizontal scroll on overflow — columns keep a min-width so
    // they don't crush on narrow viewports.
    <div
      className="overflow-x-auto -mx-2 px-2 pb-3"
      // Custom scrollbar styling: thin, brand-colored, only shows
      // when needed — same pattern as Tasks kanban.
      style={{ scrollbarWidth: "thin" }}
    >
      <div className="flex items-start gap-3 min-w-fit">
        {COLUMN_ORDER.map((stage) => {
          const cards = byStage.get(stage) ?? [];
          const accent = COLUMN_ACCENT[stage];
          const isDropTarget = dragOverStage === stage;
          return (
            <section
              key={stage}
              // 280px is the same as a grid card minWidth — keeps
              // the visual rhythm consistent between the two views.
              className="w-[280px] flex-shrink-0 flex flex-col"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Don't highlight the source column.
                if (
                  dragSourceId.current &&
                  investors.find((i) => i.id === dragSourceId.current)
                    ?.pipeline_stage === stage
                ) {
                  return;
                }
                setDragOverStage(stage);
              }}
              onDragLeave={(e) => {
                // dragleave fires when entering child elements;
                // we want to clear only when leaving the column
                // bounds entirely. relatedTarget check handles it.
                const related = e.relatedTarget as Node | null;
                if (related && (e.currentTarget as Node).contains(related)) {
                  return;
                }
                setDragOverStage((cur) => (cur === stage ? null : cur));
              }}
              onDrop={(e) => handleDrop(stage, e)}
            >
              {/* Column head */}
              <header className="flex items-center justify-between gap-2 px-2.5 h-9 mb-2 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={"inline-block h-2 w-2 rounded-full " + accent.rail}
                    aria-hidden
                  />
                  <h3 className="text-[10.5px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/80 truncate m-0">
                    {PIPELINE_STAGE_LABEL[stage]}
                  </h3>
                </div>
                <span
                  className={
                    "text-[10.5px] font-mono tabular-nums font-semibold " +
                    accent.total
                  }
                >
                  {cards.length}
                </span>
              </header>

              {/* Column body */}
              <div
                className={
                  "flex-1 min-h-[120px] rounded-sm space-y-2 p-1 transition-colors " +
                  (isDropTarget
                    ? "bg-primary/[0.04] outline outline-1 outline-dashed outline-primary/40"
                    : stage === "passed"
                      ? "opacity-70"
                      : "")
                }
              >
                {cards.length === 0 ? (
                  <EmptyColumn stage={stage} />
                ) : (
                  cards.map((inv) => (
                    <KanbanInvestorCard
                      key={inv.id}
                      investor={inv}
                      onOpen={() => onOpen(inv.id)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DT_KEY, inv.id);
                        e.dataTransfer.effectAllowed = "move";
                        dragSourceId.current = inv.id;
                      }}
                      onDragEnd={() => {
                        dragSourceId.current = null;
                        setDragOverStage(null);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Empty per-column hint. Each stage has a different hint text so
// the operator knows what "should" be here — turns empty space
// into guidance.
// ─────────────────────────────────────────────────────────────────
function EmptyColumn({ stage }: { stage: InvestorPipelineStage }) {
  const hints: Record<InvestorPipelineStage, string> = {
    prospected: "New leads land here — drag from any other stage to reset.",
    researched: "After you've read their thesis + portfolio.",
    reaching_out: "Cold email or DM sent.",
    replied: "Auto-bumps when an inbound email is detected.",
    meeting_scheduled: "Demo or chat is on the calendar.",
    met: "First meeting done — waiting on next step.",
    considering: "Diligence in progress.",
    closed: "Term sheet signed.",
    passed: "Not a fit. Keeps the funnel honest.",
  };
  return (
    <div className="px-2 py-3 text-[10.5px] italic text-foreground/35 leading-snug">
      {hints[stage]}
    </div>
  );
}

// Exported for the Cmd+K verb wiring later — gives the dispatcher
// the canonical stage list without duplicating the order.
export { COLUMN_ORDER as KANBAN_COLUMN_ORDER };
