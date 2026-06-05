/**
 * PipelineView — kanban view of deals grouped by stage.
 *
 * Day 5 scope: column shells + deal cards + a filter strip. No
 * drag-drop yet — clicking a card stubs to a console log; Day 6
 * wires dnd-kit + useMoveDeal optimistic mutation, Day 7 opens
 * the deal detail drawer on click.
 *
 * Layout:
 *   · Filter chip row (Owner: All / Me, Source: All / Inbound / Outbound)
 *   · 6 columns side-by-side on lg+, 2-up on md, single column on mobile
 *   · Each column: stage header (eyebrow + count + total $) over a
 *     vertical stack of deal cards
 *   · Each card: serif title + company/contact subtitle, amount + days
 *     in stage, owner-avatar slot (placeholder until Day 6)
 *
 * Color logic for column accents matches the dashboard chart:
 *   · interested / demo / proposal / negotiation → neutral zinc
 *   · won → soft emerald (booked revenue)
 *   · lost → muted zinc with strikethrough column title
 */

import React, { useMemo, useState } from "react";
import { Plus, AlertCircle, GripVertical } from "lucide-react";
import {
  useDealsByStage,
  DEAL_STAGES,
  formatCrmAmount,
  daysInStage,
  type CrmDeal,
  type DealStage,
} from "@/stores/crm";

// ────────────────────────────────────────────────
// Shared editorial chrome — kept in sync with the rest of /sales
// so dropping the kanban into SalesPage doesn't introduce a new
// design vocabulary.
// ────────────────────────────────────────────────
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

const STAGE_LABEL: Record<DealStage, string> = {
  interested:  "Interested",
  demo:        "Demo",
  proposal:    "Proposal",
  negotiation: "Negotiation",
  won:         "Won",
  lost:        "Lost",
};

// Per-stage column accent. Won gets emerald to read as "booked",
// lost gets a quiet zinc so the eye doesn't dwell on it.
const STAGE_ACCENT: Record<DealStage, { rail: string; total: string }> = {
  interested:  { rail: "bg-zinc-700/60",       total: "text-zinc-200" },
  demo:        { rail: "bg-blue-500/50",       total: "text-zinc-200" },
  proposal:    { rail: "bg-blue-400/60",       total: "text-zinc-200" },
  negotiation: { rail: "bg-amber-500/60",      total: "text-zinc-200" },
  won:         { rail: "bg-emerald-500/70",    total: "text-emerald-400" },
  lost:        { rail: "bg-zinc-700/40",       total: "text-zinc-500" },
};

// ════════════════════════════════════════════
// Main view
// ════════════════════════════════════════════
export const PipelineView: React.FC = () => {
  const [ownerFilter, setOwnerFilter] = useState<"all" | "me">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "inbound" | "outbound">("all");

  // For "me" filter we'd need the current user's supa_id; Day 5
  // wires the chip but defers the lookup until Day 8 when we add
  // the auth context to the kanban. Until then the chip is visible
  // but the filter is a no-op when "me" is selected.
  const { data: byStage, isLoading } = useDealsByStage({
    // ownerId: ownerFilter === "me" ? currentUserSupaId : undefined,
  });

  // Source filter happens client-side since there's no per-source
  // query; the dataset stays small enough that this is fine.
  const filteredByStage = useMemo(() => {
    if (!byStage) return null;
    if (sourceFilter === "all") return byStage;
    const next: Record<DealStage, CrmDeal[]> = {
      interested: [], demo: [], proposal: [],
      negotiation: [], won: [], lost: [],
    };
    for (const stage of DEAL_STAGES) {
      next[stage] = (byStage[stage] ?? []).filter((d) => {
        const src = (d.source ?? "").toLowerCase();
        if (sourceFilter === "inbound") {
          return src === "inbound" || src === "waitlist" || src === "website" || src === "referral";
        }
        return src === "outbound" || src === "cold" || src === "outreach";
      });
    }
    return next;
  }, [byStage, sourceFilter]);

  return (
    <div className="space-y-4">
      {/* ── Filter strip ────────────────────────────────────
          Same chip pattern as the financial dashboard's tab strips.
          Subtle enough to recede when not in use. */}
      <div className="flex items-center gap-6 flex-wrap">
        <FilterChipGroup
          label="Owner"
          value={ownerFilter}
          options={[
            { value: "all", label: "All" },
            { value: "me",  label: "Me"  },
          ]}
          onChange={(v) => setOwnerFilter(v as typeof ownerFilter)}
        />
        <FilterChipGroup
          label="Source"
          value={sourceFilter}
          options={[
            { value: "all",      label: "All"      },
            { value: "inbound",  label: "Inbound"  },
            { value: "outbound", label: "Outbound" },
          ]}
          onChange={(v) => setSourceFilter(v as typeof sourceFilter)}
        />
      </div>

      {/* ── Kanban grid ────────────────────────────────────
          6 equal columns on lg+, 2-up on md, full-width on mobile.
          min-h prevents the row from collapsing when stages are empty
          (otherwise the columns squash to nothing on a fresh install). */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {DEAL_STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            deals={filteredByStage?.[stage] ?? []}
            loading={isLoading}
          />
        ))}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// FilterChipGroup — small reusable group with a leading mono label
// and a hairline-bordered chip cluster. Used for both Owner + Source.
// ────────────────────────────────────────────────
const FilterChipGroup: React.FC<{
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center gap-2">
    <span className={`${eyebrow}`}>{label}</span>
    <div className="flex items-center gap-0.5 border border-white/[0.07] rounded-md p-0.5 bg-black/20">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-[10.5px] font-mono uppercase tracking-wider rounded transition-colors ${
            value === opt.value
              ? "bg-white/[0.06] text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

// ────────────────────────────────────────────────
// PipelineColumn — one stage's column. Header carries the stage
// name + count + total $. Body is a vertical stack of DealCards
// with a max-height + scroll past the fold.
// ────────────────────────────────────────────────
const PipelineColumn: React.FC<{
  stage: DealStage;
  deals: CrmDeal[];
  loading: boolean;
}> = ({ stage, deals, loading }) => {
  const totalCents = deals.reduce((s, d) => s + d.amount_cents, 0);
  const accent = STAGE_ACCENT[stage];

  return (
    <div className={`${tile} flex flex-col min-h-[480px]`}>
      {/* Header — left accent rail tells you which column you're in
          when scanning horizontally. */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={`h-3 w-0.5 rounded-sm ${accent.rail}`} />
        <p className={`${eyebrow} flex-1`}>
          {STAGE_LABEL[stage]}
          <span className="text-zinc-700 ml-1.5">{deals.length}</span>
        </p>
        <span className={`text-[11px] ${accent.total} ${monoNum}`}>
          {totalCents > 0
            ? formatCrmAmount(totalCents, deals[0]?.currency ?? "usd", { compact: true })
            : "—"}
        </span>
      </div>

      {/* Hairline below the header so the cards underneath read as
          a separate, focused list. */}
      <div className="border-b border-white/[0.05] mx-3" />

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[640px]">
        {loading ? (
          <ColumnLoadingState />
        ) : deals.length === 0 ? (
          <ColumnEmptyState stage={stage} />
        ) : (
          deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// DealCard — a single deal. Day 5 ships visual only — click stubs
// to console.log; Day 7 opens the detail drawer.
//
// Visual hierarchy:
//   1. Title (serif, the focal piece — the deal name is the headline)
//   2. Subtitle (mono caps, quiet — company or contact context)
//   3. Bottom row: amount left, days-in-stage right (both mono)
//
// The drag handle icon hints at Day 6's behavior without actually
// being draggable yet.
// ────────────────────────────────────────────────
const DealCard: React.FC<{ deal: CrmDeal }> = ({ deal }) => {
  const days = daysInStage(deal);
  const isStale = days >= 14 && (deal.stage !== "won" && deal.stage !== "lost");

  // Subtitle prefers company_id name (would need a join — Day 6
  // adds a companies map lookup). For Day 5 we show the source as
  // a stand-in so the card has something below the title.
  const subtitle = deal.source ?? "no source";

  return (
    <button
      type="button"
      onClick={() => {
        // Day 7 will route this to the deal drawer.
        // eslint-disable-next-line no-console
        console.log("[sales] open deal", deal.id, deal.name);
      }}
      className="group w-full text-left bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border border-white/[0.05] hover:border-white/[0.12] rounded-lg p-3 transition-colors"
    >
      {/* Header row: drag-grip placeholder + title.
          The grip is purely a visual affordance for Day 5; it becomes
          the actual dnd-kit drag handle in Day 6. */}
      <div className="flex items-start gap-1.5">
        <GripVertical className="h-3 w-3 text-zinc-700 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <h4 className="ed-serif text-[14px] leading-tight text-zinc-100 flex-1">
          {deal.name}
        </h4>
      </div>

      {/* Subtitle — quiet mono caps */}
      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-1 truncate">
        {subtitle}
      </p>

      {/* Bottom row: amount + days-in-stage indicator */}
      <div className="flex items-baseline justify-between mt-2.5">
        <span className={`text-[14px] font-medium text-zinc-100 ${monoNum}`}>
          {formatCrmAmount(deal.amount_cents, deal.currency)}
        </span>
        <span
          className={`text-[10px] font-mono ${
            isStale ? "text-amber-400/80" : "text-zinc-500"
          }`}
          title={isStale ? "Sitting in stage for 14+ days — consider following up" : undefined}
        >
          {isStale && <AlertCircle className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />}
          {days}d
        </span>
      </div>
    </button>
  );
};

// ────────────────────────────────────────────────
// Loading skeleton for a column. Three pill placeholders so the
// kanban doesn't pop when data lands.
// ────────────────────────────────────────────────
const ColumnLoadingState: React.FC = () => (
  <div className="space-y-2">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 space-y-2 animate-pulse"
      >
        <div className="h-3 bg-zinc-700/30 rounded w-3/4" />
        <div className="h-2 bg-zinc-700/20 rounded w-1/2" />
        <div className="flex justify-between">
          <div className="h-2.5 bg-zinc-700/30 rounded w-12" />
          <div className="h-2.5 bg-zinc-700/20 rounded w-6" />
        </div>
      </div>
    ))}
  </div>
);

// ────────────────────────────────────────────────
// Empty column — small + call to action so the kanban doesn't look
// abandoned when stages are empty on a fresh install.
// ────────────────────────────────────────────────
const ColumnEmptyState: React.FC<{ stage: DealStage }> = ({ stage }) => (
  <div className="border border-dashed border-white/[0.06] rounded-lg p-4 flex flex-col items-center justify-center gap-1 text-center mt-2">
    <Plus className="h-3.5 w-3.5 text-zinc-700" />
    <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-600">
      {stage === "won"
        ? "No closed wins yet"
        : stage === "lost"
          ? "No losses logged"
          : "Add a deal"}
    </p>
  </div>
);

export default PipelineView;
