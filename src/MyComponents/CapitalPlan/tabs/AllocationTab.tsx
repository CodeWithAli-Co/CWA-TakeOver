/**
 * AllocationTab.tsx — Editable budget per round + drilldown + donut.
 *
 * Surfaces:
 *   - Round picker chips (single-select, or "all rounds" overview).
 *   - Header card: target, planned, variance (over/under), reserve %.
 *   - Bucket list with inline editable amounts. Click a bucket to drill
 *     into its line items.
 *   - SVG donut chart synced to the bucket list.
 *   - Side-by-side compare strip when 2+ rounds exist (mini stacked
 *     bars per round).
 *
 * Conscious scope cuts:
 *   - No drag-to-reallocate sliders. Numbers edit inline — clearer and
 *     easier to verify against the round target.
 *   - No CSV import — manual entry is the v1 contract.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit3, Trash2, ChevronDown, ChevronRight, Layers, X,
  AlertTriangle, Vault, Megaphone, Server, Scale, Users, Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  useUpsertAllocation, useDeleteAllocation,
  useUpsertLineItem, useDeleteLineItem,
  totalPlannedForRound,
  type CapitalPlanData, type CapitalAllocation, type CapitalLineItem,
  type CapitalCategory, type CapitalRound,
} from "../CapitalPlan.queries";

// ─── Category metadata ──────────────────────────────────────────

const CATEGORY_META: Record<CapitalCategory, { label: string; icon: LucideIcon; color: string }> = {
  people:    { label: "People",    icon: Users,      color: "#10b981" },
  infra:     { label: "Infra",     icon: Server,     color: "#3b82f6" },
  marketing: { label: "Marketing", icon: Megaphone,  color: "#f59e0b" },
  legal:     { label: "Legal",     icon: Scale,      color: "#a78bfa" },
  ops:       { label: "Ops",       icon: Sparkles,   color: "#06b6d4" },
  reserve:   { label: "Reserve",   icon: Vault,      color: "#71717a" },
  tooling:   { label: "Tooling",   icon: Layers,     color: "#ec4899" },
  research:  { label: "Research",  icon: Sparkles,   color: "#8b5cf6" },
  other:     { label: "Other",     icon: Layers,     color: "#64748b" },
};

// ─── Top-level ──────────────────────────────────────────────────

export function AllocationTab({
  plan, selectedRoundId,
}: {
  plan: CapitalPlanData;
  selectedRoundId: string | null;
}) {
  const [activeRoundId, setActiveRoundId] = useState<string | null>(
    selectedRoundId ?? plan.rounds[0]?.id ?? null,
  );

  // Keep activeRoundId valid when rounds list changes
  const round = activeRoundId
    ? plan.rounds.find((r) => r.id === activeRoundId) ?? null
    : null;

  const allocations = useMemo(
    () => round ? plan.allocations.filter((a) => a.round_id === round.id).sort((a, b) => a.position - b.position) : [],
    [plan.allocations, round],
  );

  const totalPlanned = useMemo(
    () => allocations.reduce((s, a) => s + a.planned_amount, 0),
    [allocations],
  );

  return (
    <div className="space-y-5">
      {/* Round picker */}
      <RoundPicker
        rounds={plan.rounds}
        activeId={activeRoundId}
        onChange={setActiveRoundId}
      />

      {!round && (
        <div className="border border-dashed border-border rounded-sm p-10 text-center">
          <p className="text-[13px] text-muted-foreground">
            No rounds yet. Create one in the Rounds tab to start allocating budget.
          </p>
        </div>
      )}

      {round && (
        <>
          <RoundHeaderCard round={round} totalPlanned={totalPlanned} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            <BucketList
              round={round}
              allocations={allocations}
              lineItems={plan.lineItems}
              totalPlanned={totalPlanned}
            />
            <div className="space-y-4">
              <AllocationDonut allocations={allocations} totalPlanned={totalPlanned} />
              {plan.rounds.length > 1 && (
                <CompareStrip
                  rounds={plan.rounds}
                  allocations={plan.allocations}
                  activeId={round.id}
                  onSelect={setActiveRoundId}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Round picker chips ────────────────────────────────────────

function RoundPicker({
  rounds, activeId, onChange,
}: {
  rounds: CapitalRound[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}) {
  if (rounds.length === 0) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold mr-1">
        Round:
      </span>
      {rounds.map((r) => {
        const isActive = r.id === activeId;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className={`px-3 h-7 rounded-sm border text-[11.5px] font-semibold transition-colors ${
              isActive
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            {r.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── Round header card ─────────────────────────────────────────

function RoundHeaderCard({
  round, totalPlanned,
}: {
  round: CapitalRound;
  totalPlanned: number;
}) {
  const variance = totalPlanned - round.target_amount;
  const variancePct = round.target_amount > 0 ? variance / round.target_amount : 0;
  const isOver = variance > 0;
  const isUnder = variance < 0;
  const matches = Math.abs(variance) < 1; // float tolerance

  return (
    <div className="border border-border rounded-sm bg-card/30 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-1">
            {round.name}
          </div>
          <h2 className="text-[18px] font-bold text-foreground tracking-tight">
            Budget allocation
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <Stat label="Target raise"  value={formatDollars(round.target_amount)} tone="text-foreground" />
          <Stat label="Planned spend" value={formatDollars(totalPlanned)}        tone="text-amber-200" />
          <Stat
            label={isOver ? "Over budget" : isUnder ? "Unallocated" : "Reconciled"}
            value={matches ? "✓" : formatDollars(Math.abs(variance))}
            subtle={matches ? "exact match" : `${(variancePct * 100).toFixed(1)}%`}
            tone={isOver ? "text-red-300" : isUnder ? "text-amber-200" : "text-emerald-300"}
          />
        </div>
      </div>

      {/* Mini reconciliation bar */}
      {round.target_amount > 0 && (
        <div className="mt-4">
          <div className="w-full h-1.5 bg-muted/30 rounded-sm overflow-hidden flex">
            <div
              className={isOver ? "bg-red-500" : "bg-emerald-500"}
              style={{ width: `${Math.min(100, (totalPlanned / round.target_amount) * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>$0</span>
            <span>{formatDollars(round.target_amount)} target</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, subtle, tone }: { label: string; value: string; subtle?: string; tone?: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">{label}</div>
      <div className={`text-[18px] font-bold tabular-nums tracking-tight ${tone ?? "text-foreground"}`}>{value}</div>
      {subtle && <div className="text-[9.5px] text-muted-foreground/60 mt-0.5">{subtle}</div>}
    </div>
  );
}

// ─── Bucket list ───────────────────────────────────────────────

function BucketList({
  round, allocations, lineItems, totalPlanned,
}: {
  round: CapitalRound;
  allocations: CapitalAllocation[];
  lineItems: CapitalLineItem[];
  totalPlanned: number;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const upsert = useUpsertAllocation();
  const remove = useDeleteAllocation();

  async function saveBucket(patch: Partial<CapitalAllocation>) {
    await upsert.mutateAsync(patch as any);
    setEditingId(null);
  }

  async function removeBucket(id: string) {
    if (expandedId === id) setExpandedId(null);
    await remove.mutateAsync(id);
  }

  const editing = editingId && editingId !== "new"
    ? allocations.find((a) => a.id === editingId) ?? null
    : null;

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Buckets ({allocations.length})
        </span>
        <button
          type="button"
          onClick={() => setEditingId("new")}
          className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm border border-primary/40 bg-primary/10 text-[11px] uppercase tracking-[0.16em] font-bold text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3 w-3" />
          New bucket
        </button>
      </div>

      {allocations.length === 0 && editingId !== "new" && (
        <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          No buckets yet. Click "New bucket" to add one.
        </div>
      )}

      <div className="divide-y divide-border/40">
        {allocations.map((alloc) => (
          <BucketRow
            key={alloc.id}
            allocation={alloc}
            lineItems={lineItems.filter((l) => l.allocation_id === alloc.id)}
            totalPlanned={totalPlanned}
            expanded={expandedId === alloc.id}
            onToggleExpand={() => setExpandedId(expandedId === alloc.id ? null : alloc.id)}
            onEdit={() => setEditingId(alloc.id)}
            onDelete={() => removeBucket(alloc.id)}
          />
        ))}
      </div>

      <AnimatePresence>
        {editingId !== null && (
          <BucketEditDrawer
            allocation={editing}
            isNew={editingId === "new"}
            roundId={round.id}
            nextPosition={Math.max(0, ...allocations.map((a) => a.position)) + 1}
            onSave={saveBucket}
            onCancel={() => setEditingId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Single bucket row + inline expand ─────────────────────────

function BucketRow({
  allocation, lineItems, totalPlanned, expanded,
  onToggleExpand, onEdit, onDelete,
}: {
  allocation: CapitalAllocation;
  lineItems: CapitalLineItem[];
  totalPlanned: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = CATEGORY_META[allocation.category];
  const Icon = meta.icon;
  const pctOfTotal = totalPlanned > 0 ? (allocation.planned_amount / totalPlanned) * 100 : 0;
  const lineItemsTotal = lineItems.reduce((s, l) => s + l.planned_amount, 0);
  const lineItemsCoverage = allocation.planned_amount > 0
    ? Math.min(1, lineItemsTotal / allocation.planned_amount) : 0;

  return (
    <div className="group">
      <div
        className="px-4 py-3 grid grid-cols-[auto_1fr_auto] gap-3 items-center hover:bg-muted/20 cursor-pointer"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-2">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          }
          <div
            className="w-2 h-2 rounded-sm"
            style={{ backgroundColor: allocation.color || meta.color }}
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-3 w-3 text-muted-foreground/70 shrink-0" />
            <span className="text-[13px] font-bold text-foreground truncate">
              {allocation.bucket_name}
            </span>
            <span className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">
              {meta.label}
            </span>
            {allocation.period_months !== 12 && (
              <span className="text-[10px] text-muted-foreground/70 tabular-nums">
                · {allocation.period_months}mo
              </span>
            )}
          </div>
          {lineItems.length > 0 && (
            <div className="text-[10.5px] text-muted-foreground/70 mt-0.5 pl-5">
              {lineItems.length} line item{lineItems.length === 1 ? "" : "s"} · {formatDollars(lineItemsTotal)}{" "}
              {lineItemsCoverage < 1 && (
                <span className="text-amber-300/80 italic">
                  ({((1 - lineItemsCoverage) * 100).toFixed(0)}% unaccounted)
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[14px] font-bold text-emerald-200 tabular-nums">
              {formatDollars(allocation.planned_amount)}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {pctOfTotal.toFixed(1)}%
            </div>
          </div>
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              title="Edit bucket"
            >
              <Edit3 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete bucket "${allocation.bucket_name}"? Line items inside it will also be removed.`)) onDelete();
              }}
              className="p-1.5 rounded-sm text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors"
              title="Delete bucket"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Line items drilldown */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="overflow-hidden bg-background/40"
        >
          <LineItemList allocation={allocation} lineItems={lineItems} />
        </motion.div>
      )}
    </div>
  );
}

// ─── Line items list ───────────────────────────────────────────

function LineItemList({
  allocation, lineItems,
}: {
  allocation: CapitalAllocation;
  lineItems: CapitalLineItem[];
}) {
  const upsert = useUpsertLineItem();
  const remove = useDeleteLineItem();
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Partial<CapitalLineItem>>({
    allocation_id: allocation.id,
    label: "",
    planned_amount: 0,
    monthly_amount: null,
    vendor: null,
    notes: null,
    position: lineItems.length,
  });

  async function commitNew() {
    if (!newRow.label?.trim()) return;
    await upsert.mutateAsync(newRow as any);
    setNewRow({
      allocation_id: allocation.id,
      label: "", planned_amount: 0, monthly_amount: null, vendor: null, notes: null,
      position: lineItems.length + 1,
    });
    setAdding(false);
  }

  return (
    <div className="px-6 py-4 border-t border-border/40">
      {lineItems.length === 0 && !adding && (
        <p className="text-[11.5px] text-muted-foreground/60 italic mb-3">
          No line items yet. Add specific spend allocations for "{allocation.bucket_name}".
        </p>
      )}

      <div className="space-y-1.5">
        {lineItems.map((item) => (
          <LineItemRow
            key={item.id}
            item={item}
            onSave={(patch) => upsert.mutateAsync({ ...item, ...patch })}
            onDelete={() => remove.mutateAsync(item.id)}
          />
        ))}

        {adding && (
          <div className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-center bg-card/40 border border-primary/30 rounded-sm px-3 py-2">
            <input
              type="text"
              value={newRow.label ?? ""}
              onChange={(e) => setNewRow((r) => ({ ...r, label: e.target.value }))}
              placeholder="e.g. Founding AE base + commission"
              autoFocus
              className="bg-background border border-border rounded-sm px-2 py-1 text-[12px] text-foreground focus:outline-none focus:border-primary/60"
            />
            <input
              type="number"
              value={newRow.planned_amount ?? 0}
              onChange={(e) => setNewRow((r) => ({ ...r, planned_amount: Number(e.target.value) }))}
              step="1000"
              placeholder="Planned $"
              className="bg-background border border-border rounded-sm px-2 py-1 text-[12px] text-foreground tabular-nums text-right focus:outline-none focus:border-primary/60"
            />
            <input
              type="text"
              value={newRow.vendor ?? ""}
              onChange={(e) => setNewRow((r) => ({ ...r, vendor: e.target.value || null }))}
              placeholder="Vendor (optional)"
              className="bg-background border border-border rounded-sm px-2 py-1 text-[12px] text-foreground focus:outline-none focus:border-primary/60"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={commitNew}
                disabled={!newRow.label?.trim()}
                className="px-2 h-7 rounded-sm bg-primary text-primary-foreground text-[10.5px] uppercase tracking-[0.14em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAdding(false); setNewRow((r) => ({ ...r, label: "", planned_amount: 0, vendor: null })); }}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cancel"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 px-2.5 h-7 rounded-sm border border-border text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add line item
        </button>
      )}
    </div>
  );
}

// ─── Single line item row ──────────────────────────────────────

function LineItemRow({
  item, onSave, onDelete,
}: {
  item: CapitalLineItem;
  onSave: (patch: Partial<CapitalLineItem>) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const [label, setLabel] = useState(item.label);
  const [amount, setAmount] = useState(item.planned_amount);
  const [vendor, setVendor] = useState(item.vendor ?? "");
  const dirty = label !== item.label || amount !== item.planned_amount || (vendor || null) !== (item.vendor ?? null);

  async function commit() {
    if (!dirty) return;
    await onSave({ label, planned_amount: amount, vendor: vendor || null });
  }

  return (
    <div className="grid grid-cols-[1fr_120px_120px_auto] gap-2 items-center group">
      <input
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commit}
        className="bg-transparent border border-transparent hover:border-border focus:border-primary/60 rounded-sm px-2 py-1 text-[12px] text-foreground focus:outline-none transition-colors"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        onBlur={commit}
        step="500"
        className="bg-transparent border border-transparent hover:border-border focus:border-primary/60 rounded-sm px-2 py-1 text-[12px] text-emerald-200 font-semibold tabular-nums text-right focus:outline-none transition-colors"
      />
      <input
        type="text"
        value={vendor}
        onChange={(e) => setVendor(e.target.value)}
        onBlur={commit}
        placeholder="—"
        className="bg-transparent border border-transparent hover:border-border focus:border-primary/60 rounded-sm px-2 py-1 text-[12px] text-muted-foreground focus:outline-none transition-colors"
      />
      <button
        type="button"
        onClick={() => { if (confirm(`Delete "${item.label}"?`)) onDelete(); }}
        className="p-1 text-muted-foreground/40 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
        title="Delete line item"
        aria-label="Delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Bucket edit drawer (new + edit) ───────────────────────────

function BucketEditDrawer({
  allocation, isNew, roundId, nextPosition, onSave, onCancel,
}: {
  allocation: CapitalAllocation | null;
  isNew: boolean;
  roundId: string;
  nextPosition: number;
  onSave: (patch: Partial<CapitalAllocation>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<CapitalAllocation>>(() => allocation ?? {
    round_id: roundId,
    bucket_name: "",
    category: "people",
    planned_amount: 0,
    period_months: 12,
    color: CATEGORY_META.people.color,
    icon: null,
    notes: null,
    position: nextPosition,
  });

  function patch<K extends keyof CapitalAllocation>(key: K, value: CapitalAllocation[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function patchCategory(cat: CapitalCategory) {
    // Auto-update color to match category default unless user customized
    const wasDefault = !form.color || form.color === CATEGORY_META[(form.category ?? "people") as CapitalCategory].color;
    setForm((f) => ({
      ...f,
      category: cat,
      color: wasDefault ? CATEGORY_META[cat].color : f.color,
    }));
  }

  async function commit() {
    if (!form.bucket_name?.trim()) return;
    await onSave(form);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-background border-l border-border overflow-y-auto"
      >
        <div className="sticky top-0 bg-background border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-[14px] font-bold tracking-tight text-foreground">
            {isNew ? "New bucket" : `Edit "${allocation?.bucket_name}"`}
          </h3>
          <button type="button" onClick={onCancel} className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <DrawerField label="Bucket name">
            <input
              type="text"
              value={form.bucket_name ?? ""}
              onChange={(e) => patch("bucket_name", e.target.value)}
              placeholder='e.g. "GTM Hires (Founding AE + DPL)"'
              autoFocus
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </DrawerField>

          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Category">
              <select
                value={form.category ?? "people"}
                onChange={(e) => patchCategory(e.target.value as CapitalCategory)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              >
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </DrawerField>
            <DrawerField label="Months">
              <input
                type="number"
                value={form.period_months ?? 12}
                onChange={(e) => patch("period_months", Number(e.target.value))}
                min="1" max="60"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </DrawerField>
          </div>

          <DrawerField label="Planned amount ($)">
            <input
              type="number"
              value={form.planned_amount ?? 0}
              onChange={(e) => patch("planned_amount", Number(e.target.value))}
              step="1000"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[14px] text-emerald-200 font-bold tabular-nums focus:outline-none focus:border-primary/60"
            />
          </DrawerField>

          <DrawerField label="Color">
            <input
              type="color"
              value={form.color ?? "#10b981"}
              onChange={(e) => patch("color", e.target.value)}
              className="w-16 h-9 rounded-sm border border-border bg-background cursor-pointer"
            />
          </DrawerField>

          <DrawerField label="Notes (optional)">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => patch("notes", e.target.value || null)}
              rows={3}
              placeholder="What's covered in this bucket?"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60 resize-y"
            />
          </DrawerField>
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border px-5 py-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            disabled={!form.bucket_name?.trim()}
            className="px-4 h-8 rounded-sm bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.16em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isNew ? "Create bucket" : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DrawerField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Donut chart (pure SVG, no chart lib) ──────────────────────

function AllocationDonut({
  allocations, totalPlanned,
}: {
  allocations: CapitalAllocation[];
  totalPlanned: number;
}) {
  if (allocations.length === 0 || totalPlanned <= 0) {
    return (
      <div className="border border-border rounded-sm bg-card/30 p-5 text-center text-[12px] text-muted-foreground">
        Add a bucket to see the breakdown.
      </div>
    );
  }

  const segments = allocations
    .filter((a) => a.planned_amount > 0)
    .map((a) => ({
      ...a,
      fraction: a.planned_amount / totalPlanned,
    }));

  // Build SVG arc paths
  const cx = 80;
  const cy = 80;
  const rOuter = 70;
  const rInner = 45;
  let cumFrac = 0;
  const paths = segments.map((seg) => {
    const startAngle = cumFrac * 2 * Math.PI - Math.PI / 2;
    cumFrac += seg.fraction;
    const endAngle = cumFrac * 2 * Math.PI - Math.PI / 2;
    return { d: donutArcPath(cx, cy, rOuter, rInner, startAngle, endAngle), color: seg.color, key: seg.id };
  });

  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Distribution
        </span>
      </div>
      <div className="p-5 flex items-center gap-5">
        <svg width={160} height={160} viewBox="0 0 160 160" className="shrink-0">
          {paths.map((p) => (
            <path key={p.key} d={p.d} fill={p.color} stroke="hsl(var(--background))" strokeWidth="1" />
          ))}
          <text x={80} y={80} textAnchor="middle" dy="-0.1em" className="fill-foreground text-[18px] font-bold tabular-nums">
            {formatCompact(totalPlanned)}
          </text>
          <text x={80} y={80} textAnchor="middle" dy="1.2em" className="fill-muted-foreground text-[9px] uppercase tracking-[0.18em] font-semibold">
            Total
          </text>
        </svg>
        <div className="flex-1 min-w-0 space-y-1.5 max-h-[180px] overflow-y-auto">
          {segments.map((seg) => (
            <div key={seg.id} className="flex items-center gap-2 text-[11.5px]">
              <div className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="truncate flex-1 text-foreground/80">{seg.bucket_name}</span>
              <span className="text-muted-foreground tabular-nums">
                {(seg.fraction * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** SVG path string for an annular sector (donut slice). */
function donutArcPath(
  cx: number, cy: number, rOuter: number, rInner: number,
  startAngle: number, endAngle: number,
): string {
  const x1o = cx + rOuter * Math.cos(startAngle);
  const y1o = cy + rOuter * Math.sin(startAngle);
  const x2o = cx + rOuter * Math.cos(endAngle);
  const y2o = cy + rOuter * Math.sin(endAngle);
  const x1i = cx + rInner * Math.cos(endAngle);
  const y1i = cy + rInner * Math.sin(endAngle);
  const x2i = cx + rInner * Math.cos(startAngle);
  const y2i = cy + rInner * Math.sin(startAngle);
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return [
    `M ${x1o} ${y1o}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    "Z",
  ].join(" ");
}

// ─── Side-by-side compare strip ────────────────────────────────

function CompareStrip({
  rounds, allocations, activeId, onSelect,
}: {
  rounds: CapitalRound[];
  allocations: CapitalAllocation[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
          Compare across rounds
        </span>
      </div>
      <div className="p-3 space-y-2">
        {rounds.map((r) => {
          const total = totalPlannedForRound(r.id, allocations);
          const buckets = allocations.filter((a) => a.round_id === r.id).sort((a, b) => b.planned_amount - a.planned_amount);
          const variance = total - r.target_amount;
          const isActive = r.id === activeId;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelect(r.id)}
              className={`block w-full text-left p-2.5 rounded-sm border transition-colors ${
                isActive
                  ? "border-primary/40 bg-primary/[0.06]"
                  : "border-border hover:bg-muted/20"
              }`}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[11.5px] font-bold text-foreground truncate">{r.name}</span>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  {formatCompact(total)} / {formatCompact(r.target_amount)}
                  {Math.abs(variance) > 1 && (
                    <span className={variance > 0 ? "text-red-300 ml-1" : "text-amber-200 ml-1"}>
                      {variance > 0 ? "+" : ""}{formatCompact(variance)}
                    </span>
                  )}
                </span>
              </div>
              {/* Mini stacked bar */}
              {total > 0 ? (
                <div className="w-full h-1.5 bg-muted/30 rounded-sm overflow-hidden flex">
                  {buckets.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        width: `${(b.planned_amount / total) * 100}%`,
                        backgroundColor: b.color || CATEGORY_META[b.category].color,
                      }}
                      title={`${b.bucket_name} — ${formatCompact(b.planned_amount)}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-1.5 bg-muted/20 rounded-sm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Format helpers ────────────────────────────────────────────

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

// Suppress unused-import warnings on icons referenced via CATEGORY_META
export { AlertTriangle };
