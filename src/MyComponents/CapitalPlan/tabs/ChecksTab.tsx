/**
 * ChecksTab.tsx — Investor CRM pipeline.
 *
 * 8-column kanban for the active raise: Lead → Intro → Meeting →
 * Diligence → Verbal → Term Sheet → Signed → Wired, plus a
 * collapsible Archive (Passed + Ghosted) below.
 *
 * Each card is draggable across columns to advance status; clicking
 * opens the InvestorDrawer with full edit + touchpoint log + AXON
 * follow-up draft.
 *
 * Header strip shows: total committed, pipeline value, velocity
 * (status advances in last 30d), and a round filter (sourced from
 * the currently-selected round in the parent page, but can be
 * overridden here to view all rounds).
 */

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Plus, ChevronDown, ChevronRight, Filter, Star,
  GripVertical, Mail, Linkedin, Phone, AlertCircle,
} from "lucide-react";
import {
  useMoveCheckStatus,
  type CapitalPlanData, type CapitalCheck, type CapitalCheckStatus,
} from "../CapitalPlan.queries";
import { InvestorDrawer } from "../checks/InvestorDrawer";

const ACTIVE_COLUMNS: { status: CapitalCheckStatus; label: string; tone: string }[] = [
  { status: "lead",       label: "Lead",       tone: "border-zinc-500/30 text-zinc-300"     },
  { status: "intro",      label: "Intro",      tone: "border-blue-500/30 text-blue-300"     },
  { status: "meeting",    label: "Meeting",    tone: "border-indigo-500/30 text-indigo-300" },
  { status: "diligence",  label: "Diligence",  tone: "border-violet-500/30 text-violet-300" },
  { status: "verbal",     label: "Verbal",     tone: "border-amber-500/30 text-amber-300"   },
  { status: "term-sheet", label: "Term Sheet", tone: "border-orange-500/30 text-orange-300" },
  { status: "signed",     label: "Signed",     tone: "border-emerald-500/30 text-emerald-300" },
  { status: "wired",      label: "Wired",      tone: "border-emerald-600/40 text-emerald-200" },
];

const ARCHIVE_STATUSES: CapitalCheckStatus[] = ["passed", "ghosted"];

const ROUND_FILTER_KEY = "cwa-capital-plan-checks-round-filter";

export function ChecksTab({
  plan, selectedRoundId,
}: {
  plan: CapitalPlanData;
  selectedRoundId: string | null;
}) {
  // The page-level selection drives the default filter, but the user
  // can flip "all rounds" here without affecting the page state.
  const [roundFilterOverride, setRoundFilterOverride] = useState<string | "all" | null>(() => {
    try { return window.localStorage.getItem(ROUND_FILTER_KEY) as any; } catch { return null; }
  });
  const effectiveFilter = roundFilterOverride ?? selectedRoundId ?? "all";

  function changeFilter(next: string | "all") {
    setRoundFilterOverride(next);
    try { window.localStorage.setItem(ROUND_FILTER_KEY, next); } catch { /* ignore */ }
  }

  const filteredChecks = useMemo(() => {
    if (effectiveFilter === "all") return plan.checks;
    return plan.checks.filter((c) => c.round_id === effectiveFilter);
  }, [plan.checks, effectiveFilter]);

  // Group by status
  const byStatus = useMemo(() => {
    const map = new Map<CapitalCheckStatus, CapitalCheck[]>();
    for (const c of filteredChecks) {
      const arr = map.get(c.status) ?? [];
      arr.push(c);
      map.set(c.status, arr);
    }
    // Sort each column: priority desc, then last_touch_at desc
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        const ta = a.last_touch_at ? new Date(a.last_touch_at).getTime() : 0;
        const tb = b.last_touch_at ? new Date(b.last_touch_at).getTime() : 0;
        return tb - ta;
      });
    }
    return map;
  }, [filteredChecks]);

  // Drawer state
  const [openCheck, setOpenCheck] = useState<{ check: CapitalCheck | null; isNew: boolean } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<CapitalCheckStatus | null>(null);
  const moveStatus = useMoveCheckStatus();

  function openExisting(c: CapitalCheck) {
    setOpenCheck({ check: c, isNew: false });
  }
  function openNew() {
    if (plan.rounds.length === 0) {
      alert("Add a round first — investors need to belong to a round.");
      return;
    }
    setOpenCheck({ check: null, isNew: true });
  }
  function closeDrawer() { setOpenCheck(null); }

  async function handleDrop(id: string, status: CapitalCheckStatus) {
    setDragOverStatus(null);
    const check = plan.checks.find((c) => c.id === id);
    if (!check || check.status === status) return;
    await moveStatus.mutateAsync({ id, status });
  }

  // Stats
  const stats = useMemo(() => {
    const committed = filteredChecks.reduce((s, c) =>
      s + (c.committed_amount ?? (c.status === "wired" ? c.check_amount : 0)), 0);
    const wired = filteredChecks.reduce((s, c) =>
      s + (c.wired_amount ?? (c.status === "wired" ? c.check_amount : 0)), 0);
    const pipelineValue = filteredChecks
      .filter((c) => !["wired", "passed", "ghosted"].includes(c.status))
      .reduce((s, c) => s + c.check_amount, 0);
    const activeCount = filteredChecks.filter((c) =>
      !["passed", "ghosted"].includes(c.status)).length;
    const closedCount = filteredChecks.filter((c) =>
      c.status === "wired" || c.status === "signed").length;
    return { committed, wired, pipelineValue, activeCount, closedCount };
  }, [filteredChecks]);

  const archiveChecks = filteredChecks.filter((c) => ARCHIVE_STATUSES.includes(c.status));

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          <StatPill label="Committed"      value={formatDollars(stats.committed)}    tone="text-emerald-200" />
          <StatPill label="Wired"          value={formatDollars(stats.wired)}        tone="text-emerald-300" />
          <StatPill label="Pipeline"       value={formatDollars(stats.pipelineValue)} tone="text-amber-200" />
          <StatPill label="Active"         value={String(stats.activeCount)}          subtle={`${stats.closedCount} closed`} />
        </div>
        <div className="flex items-center gap-2">
          {/* Round filter */}
          <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/70 font-semibold">
            <Filter className="h-3 w-3" />
            Round:
          </div>
          <select
            value={effectiveFilter}
            onChange={(e) => changeFilter(e.target.value as any)}
            className="bg-background border border-border rounded-sm px-2.5 py-1.5 text-[11.5px] text-foreground focus:outline-none focus:border-primary/60"
          >
            <option value="all">All rounds</option>
            {plan.rounds.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-primary/40 bg-primary/10 text-[11px] uppercase tracking-[0.16em] font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add investor
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filteredChecks.length === 0 && (
        <div className="border border-dashed border-border rounded-sm p-10 text-center">
          <p className="text-[13px] text-muted-foreground mb-2">
            No investors tracked {effectiveFilter !== "all" ? "for this round " : ""}yet.
          </p>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-primary/40 bg-primary/10 text-[11px] uppercase tracking-[0.16em] font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add your first investor
          </button>
        </div>
      )}

      {/* Kanban — horizontally scrollable */}
      {filteredChecks.length > 0 && (
        <div className="overflow-x-auto -mx-8 px-8 pb-2">
          <div className="inline-flex items-stretch gap-3 min-w-full">
            {ACTIVE_COLUMNS.map((col) => {
              const items = byStatus.get(col.status) ?? [];
              const isDragOver = dragOverStatus === col.status;
              return (
                <KanbanColumn
                  key={col.status}
                  status={col.status}
                  label={col.label}
                  tone={col.tone}
                  count={items.length}
                  isDragOver={isDragOver}
                  onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
                  onDragLeave={() => setDragOverStatus(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) handleDrop(id, col.status);
                  }}
                >
                  {items.map((c) => (
                    <InvestorCard
                      key={c.id}
                      check={c}
                      roundName={plan.rounds.find((r) => r.id === c.round_id)?.name}
                      onClick={() => openExisting(c)}
                    />
                  ))}
                </KanbanColumn>
              );
            })}
          </div>
        </div>
      )}

      {/* Archive */}
      {archiveChecks.length > 0 && (
        <div className="border border-border rounded-sm bg-card/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setArchiveOpen((o) => !o)}
            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
          >
            <span className="inline-flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
              {archiveOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Archive (Passed + Ghosted)
              <span className="text-muted-foreground/60 font-medium normal-case tracking-normal text-[11px]">
                {archiveChecks.length}
              </span>
            </span>
          </button>
          {archiveOpen && (
            <div className="border-t border-border/60 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {archiveChecks.map((c) => (
                <InvestorCard
                  key={c.id}
                  check={c}
                  roundName={plan.rounds.find((r) => r.id === c.round_id)?.name}
                  onClick={() => openExisting(c)}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {openCheck && (
          <InvestorDrawer
            check={openCheck.check}
            isNew={openCheck.isNew}
            round={openCheck.check ? plan.rounds.find((r) => r.id === openCheck.check!.round_id) ?? null : null}
            rounds={plan.rounds}
            touchpoints={plan.touchpoints}
            defaultRoundId={effectiveFilter !== "all" ? effectiveFilter : null}
            onClose={closeDrawer}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Kanban column ─────────────────────────────────────────────

function KanbanColumn({
  status: _status, label, tone, count, children,
  isDragOver, onDragOver, onDragLeave, onDrop,
}: {
  status: CapitalCheckStatus;
  label: string;
  tone: string;
  count: number;
  children: React.ReactNode;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`w-[240px] shrink-0 flex flex-col border rounded-sm bg-card/30 transition-colors ${
        isDragOver ? "border-primary/60 bg-primary/5" : `border-border ${tone}`
      }`}
    >
      <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
        <span className={`text-[10.5px] uppercase tracking-[0.18em] font-bold ${tone.split(" ")[1] ?? ""}`}>
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground/70 font-semibold">
          {count}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 min-h-[120px]">
        {count === 0 && (
          <div className="text-[10.5px] text-muted-foreground/50 italic text-center py-6">
            drop here
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Investor card ─────────────────────────────────────────────

function InvestorCard({
  check, roundName, onClick, muted,
}: {
  check: CapitalCheck;
  roundName?: string;
  onClick: () => void;
  muted?: boolean;
}) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", check.id);
    e.dataTransfer.effectAllowed = "move";
  }

  const overdueNextStep = check.next_step_due
    ? new Date(check.next_step_due).getTime() < Date.now()
    : false;
  const staleDays = check.last_touch_at
    ? Math.floor((Date.now() - new Date(check.last_touch_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = staleDays !== null && staleDays > 14;

  // Framer's motion.div onDragStart conflicts with native HTML5 DnD.
  // Use a plain div so the drag-and-drop events are typed natively;
  // wrap children in the motion span for hover animation if desired.
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`group border border-border rounded-sm bg-background hover:border-foreground/30 hover:bg-card/40 cursor-pointer transition-all hover:-translate-y-px ${
        muted ? "opacity-65" : ""
      }`}
    >
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1 mb-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              <span className="text-[12px] font-bold text-foreground truncate leading-tight">
                {check.investor_name || "(unnamed)"}
              </span>
            </div>
            {check.firm && (
              <div className="text-[10.5px] text-muted-foreground truncate pl-4.5 mt-0.5">
                {check.firm}
              </div>
            )}
          </div>
          {check.priority > 0 && (
            <Star
              className={`h-3 w-3 shrink-0 ${
                check.priority === 2 ? "text-red-300 fill-red-300" : "text-amber-300 fill-amber-300"
              }`}
            />
          )}
        </div>

        <div className="flex items-baseline justify-between mt-2">
          <span className="text-[13px] font-bold text-emerald-200 tabular-nums">
            {formatDollars(check.check_amount)}
          </span>
          {check.committed_amount && check.committed_amount !== check.check_amount && (
            <span className="text-[10px] text-emerald-300/80 tabular-nums">
              ({formatDollars(check.committed_amount)} commit)
            </span>
          )}
        </div>

        {/* Contact icon row */}
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/70">
          {check.contact_email && <Mail className="h-2.5 w-2.5" aria-label="email" />}
          {check.contact_linkedin && <Linkedin className="h-2.5 w-2.5" aria-label="linkedin" />}
          {check.contact_phone && <Phone className="h-2.5 w-2.5" aria-label="phone" />}
          {roundName && (
            <span className="ml-auto text-[10px] text-muted-foreground/60 uppercase tracking-wide truncate">
              {roundName}
            </span>
          )}
        </div>

        {check.next_step && (
          <div className={`mt-2 pt-2 border-t border-border/40 text-[10.5px] ${
            overdueNextStep ? "text-red-300" : "text-foreground/75"
          }`}>
            <span className="font-semibold">Next: </span>
            <span className="truncate">{check.next_step}</span>
            {check.next_step_due && (
              <span className="ml-1 text-[9.5px] tabular-nums opacity-80">
                ({new Date(check.next_step_due).toLocaleDateString(undefined, { month: "short", day: "numeric" })})
              </span>
            )}
          </div>
        )}

        {isStale && !["wired", "passed", "ghosted"].includes(check.status) && (
          <div className="mt-1.5 inline-flex items-center gap-1 text-[9.5px] text-amber-300/85">
            <AlertCircle className="h-2.5 w-2.5" />
            {staleDays}d since last touch
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Small bits ─────────────────────────────────────────────────

function StatPill({
  label, value, subtle, tone,
}: { label: string; value: string; subtle?: string; tone?: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold">
        {label}
      </div>
      <div className={`text-[15px] font-bold tabular-nums tracking-tight ${tone ?? "text-foreground"}`}>
        {value}
      </div>
      {subtle && <div className="text-[9.5px] text-muted-foreground/60 mt-0.5">{subtle}</div>}
    </div>
  );
}

function formatDollars(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

// Re-export the ComingSoon primitive used by other stub tabs.
export function ComingSoon({ icon, title, subtitle, bullets }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: { icon: React.ComponentType<{ className?: string }>; text: string }[];
}) {
  return (
    <div className="border border-dashed border-border rounded-sm p-10 bg-card/20">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-sm bg-primary/10 text-primary">{icon}</span>
          <div>
            <h3 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h3>
            <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold mt-0.5">{subtitle}</p>
          </div>
        </div>
        <ul className="space-y-2.5 mt-5">
          {bullets.map((b, i) => {
            const Icon = b.icon;
            return (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
                <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
                <span>{b.text}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
