/**
 * RoundsTab.tsx — Cards for each funding round with editable terms.
 *
 * Each card shows:
 *   - Round name + type pill (angel / pre-seed / seed / Series A …)
 *   - Status badge (planning / raising / closed)
 *   - Target raise + committed-to-date progress bar
 *   - Valuation cap + instrument
 *   - Days until target close (or days-since-closed)
 *   - Quick-edit drawer (cap, target, dates, notes)
 *
 * Clicking a round selects it as the "active round" for the other
 * tabs (Checks / Allocation / Runway / Scenarios will filter to it).
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Edit3, Trash2, X, CalendarDays, Target, TrendingUp,
  CircleDot, Hourglass, CheckCircle2, PauseCircle, XCircle,
} from "lucide-react";
import {
  useUpsertRound,
  useDeleteRound,
  summarizeRoundProgress,
  type CapitalPlanData,
  type CapitalRound,
  type CapitalRoundType,
  type CapitalRoundStatus,
  type CapitalInstrument,
} from "../CapitalPlan.queries";

const ROUND_TYPE_OPTIONS: { value: CapitalRoundType; label: string }[] = [
  { value: "angel",      label: "Angel"      },
  { value: "pre-seed",   label: "Pre-Seed"   },
  { value: "seed",       label: "Seed"       },
  { value: "series-a",   label: "Series A"   },
  { value: "series-b",   label: "Series B"   },
  { value: "series-c",   label: "Series C"   },
  { value: "bridge",     label: "Bridge"     },
  { value: "extension",  label: "Extension"  },
];

const STATUS_META: Record<CapitalRoundStatus, { label: string; tone: string; icon: typeof CircleDot }> = {
  planning: { label: "Planning", tone: "text-muted-foreground border-border bg-muted/30",        icon: CircleDot     },
  raising:  { label: "Raising",  tone: "text-amber-200 border-amber-500/40 bg-amber-500/10",     icon: Hourglass     },
  closed:   { label: "Closed",   tone: "text-emerald-200 border-emerald-500/40 bg-emerald-500/10", icon: CheckCircle2 },
  "on-hold":{ label: "On hold",  tone: "text-zinc-300 border-zinc-500/40 bg-zinc-500/10",        icon: PauseCircle   },
  skipped:  { label: "Skipped",  tone: "text-red-200 border-red-500/40 bg-red-500/10",           icon: XCircle       },
};

export function RoundsTab({
  plan, selectedRoundId, onSelectRound,
}: {
  plan: CapitalPlanData;
  selectedRoundId: string | null;
  onSelectRound: (id: string | null) => void;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const upsert = useUpsertRound();
  const remove = useDeleteRound();

  function startNew() { setEditingId("new"); }
  function cancel() { setEditingId(null); }

  async function handleSave(patch: Partial<CapitalRound>) {
    await upsert.mutateAsync(patch as any);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (selectedRoundId === id) onSelectRound(null);
    await remove.mutateAsync(id);
  }

  const editingRound = editingId && editingId !== "new"
    ? plan.rounds.find((r) => r.id === editingId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold tracking-tight text-foreground">
          Funding rounds
          <span className="ml-2 text-[11px] text-muted-foreground font-medium">
            click a card to filter the other tabs to it
          </span>
        </h2>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-primary/40 bg-primary/10 text-[11px] uppercase tracking-[0.16em] font-semibold text-primary hover:bg-primary/20 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New round
        </button>
      </div>

      {plan.rounds.length === 0 && editingId !== "new" && (
        <div className="border border-dashed border-border rounded-sm p-10 text-center">
          <p className="text-[13px] text-muted-foreground">
            No rounds yet. Add one to start planning.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {plan.rounds.map((round) => {
          const progress = summarizeRoundProgress(round, plan.checks);
          const isSelected = round.id === selectedRoundId;
          return (
            <RoundCard
              key={round.id}
              round={round}
              progress={progress}
              isSelected={isSelected}
              onClick={() => onSelectRound(isSelected ? null : round.id)}
              onEdit={() => setEditingId(round.id)}
              onDelete={() => handleDelete(round.id)}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {editingId !== null && (
          <RoundEditDrawer
            round={editingRound}
            isNew={editingId === "new"}
            nextPosition={Math.max(0, ...plan.rounds.map((r) => r.position)) + 1}
            onSave={handleSave}
            onCancel={cancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Round card ────────────────────────────────────────────────

function RoundCard({
  round, progress, isSelected, onClick, onEdit, onDelete,
}: {
  round: CapitalRound;
  progress: ReturnType<typeof summarizeRoundProgress>;
  isSelected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_META[round.status];
  const StatusIcon = status.icon;
  const typeLabel = ROUND_TYPE_OPTIONS.find((o) => o.value === round.round_type)?.label ?? round.round_type;

  // Left-border accent by status so cards aren't all identical.
  const statusAccent =
    round.status === "raising" ? "border-l-amber-500"
    : round.status === "closed" ? "border-l-emerald-500"
    : round.status === "on-hold" ? "border-l-zinc-500"
    : round.status === "skipped" ? "border-l-red-500"
    : "border-l-muted-foreground/40";

  return (
    <div
      onClick={onClick}
      className={`group border border-border border-l-[3px] ${statusAccent} rounded-md p-5 cursor-pointer transition-all bg-card shadow-[0_4px_12px_rgba(0,0,0,0.35)] ${
        isSelected
          ? "ring-2 ring-primary/40 border-primary/40 shadow-[0_8px_24px_rgba(132,204,22,0.15)]"
          : "hover:bg-muted/30 hover:border-foreground/20 hover:shadow-[0_6px_16px_rgba(0,0,0,0.45)]"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-bold">
              {typeLabel}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[9.5px] uppercase tracking-[0.14em] font-bold ${status.tone}`}>
              <StatusIcon className="h-2.5 w-2.5" />
              {status.label}
            </span>
            {round.instrument === "safe" && (
              <span className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">
                SAFE · {round.post_money_safe ? "post" : "pre"}-money
              </span>
            )}
            {round.instrument === "priced" && (
              <span className="text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/70 font-semibold">
                Priced
              </span>
            )}
          </div>
          <h3 className="text-[16px] font-bold text-foreground tracking-tight truncate">
            {round.name}
          </h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            title="Edit round"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (confirm(`Delete round "${round.name}"? This will cascade-delete all checks and allocations linked to it.`)) onDelete(); }}
            className="p-1.5 rounded-sm text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title="Delete round"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Key terms */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Cell label="Target" value={formatDollars(round.target_amount)} tone="text-emerald-200" />
        <Cell label="Cap" value={round.valuation_cap ? formatDollars(round.valuation_cap) : "—"} tone="text-amber-200" />
        <Cell label="Discount" value={round.discount > 0 ? `${(round.discount * 100).toFixed(0)}%` : "—"} />
        <Cell label="MFN" value={round.mfn ? "Yes" : "No"} />
      </div>

      {/* Progress bar */}
      <div className="mb-2.5">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
            Committed
          </span>
          <span className="text-[12px] font-bold tabular-nums text-foreground">
            {formatDollars(progress.committed)}
            <span className="text-[10px] font-normal text-muted-foreground ml-1">
              / {formatDollars(round.target_amount)}
            </span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-muted/40 rounded-sm overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.pctOfTarget * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full ${progress.pctOfTarget >= 1 ? "bg-emerald-500" : "bg-primary"}`}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground">
          <span>{progress.count} investor{progress.count === 1 ? "" : "s"} · {progress.closedCount} closed</span>
          <span className="tabular-nums">{(progress.pctOfTarget * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Dates */}
      <div className="flex items-center gap-3 text-[10.5px] text-muted-foreground border-t border-border/60 pt-2.5">
        {round.target_close_date && (
          <span className="inline-flex items-center gap-1">
            <Target className="h-3 w-3" />
            Close {new Date(round.target_close_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {progress.daysUntilTargetClose !== null && (
              <span className={`ml-1 tabular-nums ${
                progress.daysUntilTargetClose < 0 ? "text-red-300" :
                progress.daysUntilTargetClose < 14 ? "text-amber-300" : "text-muted-foreground"
              }`}>
                ({progress.daysUntilTargetClose < 0 ? `${Math.abs(progress.daysUntilTargetClose)}d past` : `${progress.daysUntilTargetClose}d`})
              </span>
            )}
          </span>
        )}
        {round.closed_date && (
          <span className="inline-flex items-center gap-1 text-emerald-300/80">
            <CalendarDays className="h-3 w-3" />
            Closed {new Date(round.closed_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}
          </span>
        )}
        {round.lead_investor && (
          <span className="inline-flex items-center gap-1 truncate">
            <TrendingUp className="h-3 w-3" />
            Lead: {round.lead_investor}
          </span>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">{label}</div>
      <div className={`text-[14px] font-bold tabular-nums ${tone ?? "text-foreground/85"}`}>{value}</div>
    </div>
  );
}

// ─── Edit drawer ───────────────────────────────────────────────

function RoundEditDrawer({
  round, isNew, nextPosition, onSave, onCancel,
}: {
  round: CapitalRound | null;
  isNew: boolean;
  nextPosition: number;
  onSave: (patch: Partial<CapitalRound>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<CapitalRound>>(() => round ?? {
    name: "",
    round_type: "angel",
    instrument: "safe",
    status: "planning",
    target_amount: 1_000_000,
    valuation_cap: 10_000_000,
    post_money_safe: true,
    discount: 0,
    mfn: false,
    position: nextPosition,
  });

  function patch<K extends keyof CapitalRound>(key: K, value: CapitalRound[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function commit() {
    if (!form.name?.trim()) return;
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
            {isNew ? "New round" : `Edit "${round?.name}"`}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Name">
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => patch("name", e.target.value)}
              placeholder="e.g. Angel 2026"
              autoFocus
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={form.round_type ?? "angel"}
                onChange={(e) => patch("round_type", e.target.value as CapitalRoundType)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              >
                {ROUND_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Instrument">
              <select
                value={form.instrument ?? "safe"}
                onChange={(e) => patch("instrument", e.target.value as CapitalInstrument)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              >
                <option value="safe">SAFE</option>
                <option value="priced">Priced Round</option>
                <option value="note">Convertible Note</option>
                <option value="equity-grant">Equity Grant</option>
              </select>
            </Field>
          </div>

          <Field label="Status">
            <select
              value={form.status ?? "planning"}
              onChange={(e) => patch("status", e.target.value as CapitalRoundStatus)}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Target raise ($)">
              <input
                type="number"
                value={form.target_amount ?? 0}
                onChange={(e) => patch("target_amount", Number(e.target.value))}
                step="50000"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label={form.instrument === "priced" ? "Pre-money ($)" : "Cap ($)"}>
              <input
                type="number"
                value={form.valuation_cap ?? 0}
                onChange={(e) => patch("valuation_cap", Number(e.target.value))}
                step="500000"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
          </div>

          {form.instrument === "safe" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount (%)">
                  <input
                    type="number"
                    value={(form.discount ?? 0) * 100}
                    onChange={(e) => patch("discount", Number(e.target.value) / 100)}
                    step="1" min="0" max="50"
                    className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
                  />
                </Field>
                <Field label="Post-money cap?">
                  <select
                    value={form.post_money_safe ? "post" : "pre"}
                    onChange={(e) => patch("post_money_safe", e.target.value === "post")}
                    className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
                  >
                    <option value="post">Post-money (YC standard)</option>
                    <option value="pre">Pre-money</option>
                  </select>
                </Field>
              </div>
              <label className="inline-flex items-center gap-2 text-[12px] text-foreground/85 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.mfn ?? false}
                  onChange={(e) => patch("mfn", e.target.checked)}
                  className="accent-primary"
                />
                MFN clause (re-prices to better future terms)
              </label>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Open date">
              <input
                type="date"
                value={form.open_date ?? ""}
                onChange={(e) => patch("open_date", e.target.value || null)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label="Target close">
              <input
                type="date"
                value={form.target_close_date ?? ""}
                onChange={(e) => patch("target_close_date", e.target.value || null)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </Field>
          </div>

          <Field label="Lead investor (optional)">
            <input
              type="text"
              value={form.lead_investor ?? ""}
              onChange={(e) => patch("lead_investor", e.target.value || null)}
              placeholder="e.g. Gokul Rajaram"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => patch("notes", e.target.value || null)}
              rows={3}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60 resize-y"
              placeholder="Strategic context, thesis, anything worth remembering…"
            />
          </Field>
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
            disabled={!form.name?.trim()}
            className="px-4 h-8 rounded-sm bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.16em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isNew ? "Create round" : "Save changes"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}
