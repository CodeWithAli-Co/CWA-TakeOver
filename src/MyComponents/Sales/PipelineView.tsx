/**
 * PipelineView — kanban view of deals grouped by stage.
 *
 * Day 5 shipped the static skeleton (columns + cards + filters).
 * Day 6 adds:
 *   · Native HTML5 drag-drop between columns (no new dependencies —
 *     same approach as the Tasks kanban; works in every browser)
 *   · useMoveDeal optimistic mutation (instant card movement,
 *     server-side stage + position update behind it)
 *   · companies map lookup so the card subtitle shows the company
 *     name instead of the source slug placeholder
 *
 * Drop targets — two kinds, the handlers stopPropagation to keep
 * them from racing:
 *   · Column (empty area or below all cards) → newPosition = last + 1024
 *   · Card (insert above) → newPosition = average of prev + over
 *
 * Position model (fractional indexing):
 *   · empty column drop → max(positions) + 1024 (or 1024 if empty)
 *   · drop above target → (prevCard.position + targetCard.position) / 2
 *                         (or target.position − 1024 when first)
 *   · server stores numeric, never reindexes — cheap on writes
 *
 * Day 7 wires click → deal detail drawer. Drag activation distance
 * is governed by the native draggable threshold (~3–5px), so a
 * normal click doesn't fire a drag.
 */

import React, { useMemo, useState } from "react";
import { Plus, AlertCircle, GripVertical } from "lucide-react";
import {
  useDealsByStage,
  useMoveDeal,
  useCreateDeal,
  useCrmCompanies,
  DEAL_STAGES,
  formatCrmAmount,
  daysInStage,
  type CrmDeal,
  type DealStage,
} from "@/stores/crm";
import { DealDetailDrawer } from "./DealDetailDrawer";

// ────────────────────────────────────────────────
// Shared editorial chrome — kept in sync with the rest of /sales.
// ────────────────────────────────────────────────
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

// MIME-typed dataTransfer key so we won't catch random "text/plain"
// drags from other parts of the app.
const DT_KEY = "application/x-crm-deal-id";

const STAGE_LABEL: Record<DealStage, string> = {
  interested:  "Interested",
  demo:        "Demo",
  proposal:    "Proposal",
  negotiation: "Negotiation",
  won:         "Won",
  lost:        "Lost",
};

const STAGE_ACCENT: Record<DealStage, { rail: string; total: string }> = {
  interested:  { rail: "bg-zinc-700/60",    total: "text-zinc-200" },
  demo:        { rail: "bg-blue-500/50",    total: "text-zinc-200" },
  proposal:    { rail: "bg-blue-400/60",    total: "text-zinc-200" },
  negotiation: { rail: "bg-amber-500/60",   total: "text-zinc-200" },
  won:         { rail: "bg-emerald-500/70", total: "text-emerald-400" },
  lost:        { rail: "bg-zinc-700/40",    total: "text-zinc-500" },
};

// ════════════════════════════════════════════
// Main view
// ════════════════════════════════════════════
export const PipelineView: React.FC = () => {
  const [ownerFilter, setOwnerFilter] = useState<"all" | "me">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "inbound" | "outbound">("all");

  const { data: byStage, isLoading } = useDealsByStage();
  const { data: companies = [] } = useCrmCompanies({});
  const moveDeal = useMoveDeal();
  const createDeal = useCreateDeal();

  // Drag UI state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<DealStage | null>(null);
  const [overCardId, setOverCardId] = useState<string | null>(null);

  // Detail drawer state. Clicking a card opens the deal in a
  // right-slide drawer where you can edit fields + see the activity
  // timeline. Backdrop click or Escape closes it.
  const [activeDealId, setActiveDealId] = useState<string | null>(null);

  // Companies map so cards show company name in their subtitle.
  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);

  // Source filter applied client-side.
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
          return ["inbound", "waitlist", "website", "referral"].includes(src);
        }
        return ["outbound", "cold", "outreach"].includes(src);
      });
    }
    return next;
  }, [byStage, sourceFilter]);

  // Flat lookup for the drop handler.
  const dealLookup = useMemo(() => {
    const m = new Map<string, CrmDeal>();
    if (!byStage) return m;
    for (const stage of DEAL_STAGES) {
      for (const d of byStage[stage] ?? []) m.set(d.id, d);
    }
    return m;
  }, [byStage]);

  // ── Drop handler ────────────────────────────────────
  // dropAboveCardId === null → empty column / bottom-of-column drop.
  // Otherwise insert above the specified card.
  const handleDrop = (
    dealId: string,
    newStage: DealStage,
    dropAboveCardId: string | null,
  ) => {
    const fromDeal = dealLookup.get(dealId);
    if (!fromDeal) return;

    const colDeals = (filteredByStage?.[newStage] ?? [])
      .filter((d) => d.id !== dealId);

    let newPosition: number;
    if (dropAboveCardId === null) {
      // Drop at the bottom.
      const lastPos = colDeals.length > 0
        ? (colDeals[colDeals.length - 1].position ?? 0)
        : 0;
      newPosition = lastPos + 1024;
    } else {
      const overIdx = colDeals.findIndex((d) => d.id === dropAboveCardId);
      if (overIdx <= 0) {
        const overDeal = colDeals[overIdx] ?? null;
        newPosition = (overDeal?.position ?? 0) - 1024;
      } else {
        const prev = colDeals[overIdx - 1];
        const over = colDeals[overIdx];
        newPosition = ((prev.position ?? 0) + (over.position ?? 0)) / 2;
      }
    }

    if (
      fromDeal.stage === newStage &&
      fromDeal.position === newPosition
    ) {
      return;
    }

    moveDeal.mutate({
      id: fromDeal.id,
      stage: newStage,
      position: newPosition,
    });
  };

  // Coordinated drag-end cleanup — fires regardless of whether the
  // drop succeeded, so we always clear the hover state.
  const clearDragState = () => {
    setDraggingId(null);
    setOverStage(null);
    setOverCardId(null);
  };

  // ── Create deal ─────────────────────────────────────
  // Inserts a stub deal in the requested stage, then immediately
  // opens the detail drawer so the user can fill in real values.
  // The new row lands at the bottom of its column (highest position)
  // so it doesn't shove existing cards around mid-add.
  const handleAddDeal = (stage: DealStage) => {
    const colDeals = byStage?.[stage] ?? [];
    const lastPos = colDeals.length > 0
      ? (colDeals[colDeals.length - 1].position ?? 0)
      : 0;
    createDeal.mutate(
      {
        name: "Untitled deal",
        stage,
        amount_cents: 0,
        probability: 50,
        position: lastPos + 1024,
      },
      {
        onSuccess: (row) => {
          // Pop the new deal open in the drawer so the user starts
          // typing into the title field immediately.
          setActiveDealId(row.id);
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {/* ── Filter strip ──────────────────────────────────── */}
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

        {/* Primary CTA — pushed right with ml-auto. Creates a stub
            deal in 'interested' and opens the drawer for editing. */}
        <button
          onClick={() => handleAddDeal("interested")}
          disabled={createDeal.isPending}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10.5px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="h-3 w-3" />
          {createDeal.isPending ? "Adding…" : "New deal"}
        </button>
      </div>

      {/* ── Kanban grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        {DEAL_STAGES.map((stage) => (
          <PipelineColumn
            key={stage}
            stage={stage}
            deals={filteredByStage?.[stage] ?? []}
            loading={isLoading}
            companyMap={companyMap}
            draggingId={draggingId}
            isOverColumn={overStage === stage && overCardId === null}
            overCardId={overCardId}
            onCardDragStart={(id) => setDraggingId(id)}
            onCardDragEnd={clearDragState}
            onColumnDragOver={(e) => {
              e.preventDefault();
              if (draggingId) {
                e.dataTransfer.dropEffect = "move";
                setOverStage(stage);
                setOverCardId(null);
              }
            }}
            onColumnDragLeave={() => {
              if (overStage === stage && overCardId === null) {
                setOverStage(null);
              }
            }}
            onColumnDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData(DT_KEY);
              if (id) handleDrop(id, stage, null);
              clearDragState();
            }}
            onCardDragOver={(e, cardId) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggingId && draggingId !== cardId) {
                e.dataTransfer.dropEffect = "move";
                setOverStage(stage);
                setOverCardId(cardId);
              }
            }}
            onCardDrop={(e, cardId) => {
              e.preventDefault();
              e.stopPropagation();
              const id = e.dataTransfer.getData(DT_KEY);
              if (id && id !== cardId) handleDrop(id, stage, cardId);
              clearDragState();
            }}
            onOpenDeal={setActiveDealId}
            onAddDeal={handleAddDeal}
            isAdding={createDeal.isPending}
          />
        ))}
      </div>

      {/* Detail drawer — controlled by activeDealId. Mounted at the
          root of the view so its fixed-positioned panel escapes the
          kanban scroll container. */}
      <DealDetailDrawer
        dealId={activeDealId}
        onClose={() => setActiveDealId(null)}
      />
    </div>
  );
};

// ────────────────────────────────────────────────
// FilterChipGroup
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
// PipelineColumn
// ────────────────────────────────────────────────
interface PipelineColumnProps {
  stage: DealStage;
  deals: CrmDeal[];
  loading: boolean;
  companyMap: Map<string, string>;
  draggingId: string | null;
  isOverColumn: boolean;
  overCardId: string | null;
  onCardDragStart: (id: string) => void;
  onCardDragEnd: () => void;
  onColumnDragOver: (e: React.DragEvent) => void;
  onColumnDragLeave: () => void;
  onColumnDrop: (e: React.DragEvent) => void;
  onCardDragOver: (e: React.DragEvent, cardId: string) => void;
  onCardDrop: (e: React.DragEvent, cardId: string) => void;
  onOpenDeal: (id: string) => void;
  onAddDeal: (stage: DealStage) => void;
  isAdding: boolean;
}

const PipelineColumn: React.FC<PipelineColumnProps> = ({
  stage,
  deals,
  loading,
  companyMap,
  draggingId,
  isOverColumn,
  overCardId,
  onCardDragStart,
  onCardDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onColumnDrop,
  onCardDragOver,
  onCardDrop,
  onOpenDeal,
  onAddDeal,
  isAdding,
}) => {
  const totalCents = deals.reduce((s, d) => s + d.amount_cents, 0);
  const accent = STAGE_ACCENT[stage];

  return (
    <div
      className={`${tile} flex flex-col min-h-[480px] transition-colors ${
        isOverColumn ? "border-emerald-500/40 bg-emerald-500/[0.02]" : ""
      }`}
      onDragOver={onColumnDragOver}
      onDragLeave={onColumnDragLeave}
      onDrop={onColumnDrop}
    >
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
        {/* Per-column add button — adds a deal directly into this
            stage. Sits at the very right of the header so it doesn't
            steal attention from the count + total. */}
        <button
          onClick={() => onAddDeal(stage)}
          disabled={isAdding}
          className="p-1 -mr-1 rounded text-zinc-600 hover:text-emerald-400 hover:bg-emerald-500/[0.08] transition-colors disabled:opacity-40"
          title={`Add deal to ${STAGE_LABEL[stage]}`}
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      <div className="border-b border-white/[0.05] mx-3" />

      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[640px]">
        {loading ? (
          <ColumnLoadingState />
        ) : deals.length === 0 ? (
          <ColumnEmptyState
            stage={stage}
            isDropTarget={isOverColumn}
            onAdd={() => onAddDeal(stage)}
            isAdding={isAdding}
          />
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              companyMap={companyMap}
              isDragging={draggingId === deal.id}
              isDropAbove={overCardId === deal.id && draggingId !== deal.id}
              onDragStart={(e) => {
                e.dataTransfer.setData(DT_KEY, deal.id);
                e.dataTransfer.effectAllowed = "move";
                onCardDragStart(deal.id);
              }}
              onDragEnd={onCardDragEnd}
              onDragOver={(e) => onCardDragOver(e, deal.id)}
              onDrop={(e) => onCardDrop(e, deal.id)}
              onOpen={() => onOpenDeal(deal.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// DealCard — visual card with native draggable + drop affordances.
// ────────────────────────────────────────────────
interface DealCardProps {
  deal: CrmDeal;
  companyMap: Map<string, string>;
  isDragging: boolean;
  isDropAbove: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onOpen: () => void;
}

const DealCard: React.FC<DealCardProps> = ({
  deal,
  companyMap,
  isDragging,
  isDropAbove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onOpen,
}) => {
  const days = daysInStage(deal);
  const isStale = days >= 14 && deal.stage !== "won" && deal.stage !== "lost";

  const companyName = deal.company_id ? companyMap.get(deal.company_id) : null;
  const subtitle = companyName ?? deal.source ?? "no source";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => {
        // Suppress click when a drag is in flight so a dropped card
        // doesn't immediately open the drawer underneath the cursor.
        if (isDragging) return;
        onOpen();
      }}
      className={`group relative w-full text-left bg-gradient-to-b from-zinc-900/80 to-zinc-900/40 border rounded-lg p-3 transition-all cursor-grab active:cursor-grabbing ${
        isDragging
          ? "opacity-30 border-white/[0.05]"
          : "border-white/[0.05] hover:border-white/[0.12]"
      }`}
    >
      {/* Drop-above indicator — thin emerald bar at the top edge of
          the card we're about to land above. */}
      {isDropAbove && (
        <span className="absolute -top-1 left-2 right-2 h-0.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
      )}

      <div className="flex items-start gap-1.5">
        <GripVertical className="h-3 w-3 text-zinc-700 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        <h4 className="ed-serif text-[14px] leading-tight text-zinc-100 flex-1">
          {deal.name}
        </h4>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-1 truncate">
        {subtitle}
      </p>

      <div className="flex items-baseline justify-between mt-2.5">
        <span className={`text-[14px] font-medium text-zinc-100 ${monoNum}`}>
          {formatCrmAmount(deal.amount_cents, deal.currency)}
        </span>
        <span
          className={`text-[10px] font-mono ${
            isStale ? "text-amber-400/80" : "text-zinc-500"
          }`}
          title={
            isStale
              ? "Sitting in stage for 14+ days — consider following up"
              : undefined
          }
        >
          {isStale && <AlertCircle className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />}
          {days}d
        </span>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// Loading + empty states
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

const ColumnEmptyState: React.FC<{
  stage: DealStage;
  isDropTarget: boolean;
  onAdd: () => void;
  isAdding: boolean;
}> = ({ stage, isDropTarget, onAdd, isAdding }) => (
  <button
    type="button"
    onClick={onAdd}
    disabled={isAdding}
    className={`w-full border border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-1 text-center mt-2 transition-colors disabled:opacity-50 ${
      isDropTarget
        ? "border-emerald-500/40 bg-emerald-500/[0.04]"
        : "border-white/[0.06] hover:border-emerald-500/30 hover:bg-emerald-500/[0.03] cursor-pointer"
    }`}
  >
    <Plus className="h-3.5 w-3.5 text-zinc-700" />
    <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-600">
      {isDropTarget
        ? "Drop here"
        : isAdding
          ? "Adding…"
          : stage === "won"
            ? "Log a closed win"
            : stage === "lost"
              ? "Log a lost deal"
              : "Add a deal"}
    </p>
  </button>
);

export default PipelineView;
