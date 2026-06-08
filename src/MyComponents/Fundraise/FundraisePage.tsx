/**
 * FundraisePage.tsx — entry point for the standalone /fundraise route.
 *
 * Was briefly a tab under /sales; promoted to its own route because
 * the motion is sufficiently distinct from regular customer sales,
 * and because Phase 4's daily follow-up dashboard wants a dedicated
 * home. The underlying investor_profiles table still references
 * crm_companies + crm_contacts, so the data is shared even though
 * the UI surfaces are separate.
 *
 * Layout follows the Workspace + Sales editorial pattern:
 *   · Newsreader serif eyebrow + title + sub-copy
 *   · Stats strip (4 cells): total investors, P0 count, replied count,
 *     follow-ups due today
 *   · Primary CTAs: Add investor (manual modal) + Find investors
 *     (Axon stub — wired in Phase 2)
 *   · Card grid (auto-fill, ~280px min) of investor cards
 *   · Right-slide drawer opens on card click
 *
 * Phase 1 ships:
 *   - Manual entry only (Axon "Find investors" CTA is a placeholder
 *     that nudges the operator to type their search into the Axon
 *     panel today; the bound action lands in Phase 2)
 *   - Card grid with priority + fit + stage chips
 *   - Detail drawer with Overview / Partners / Activity / Notes
 *
 * Phase 2 layers email drafting on the drawer's Partners tab.
 * Phase 3 swaps the grid for a kanban view (toggle in header).
 * Phase 4 turns the "Follow-ups due" stat into a real strip.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Sparkles, Loader2, PiggyBank } from "lucide-react";

import {
  useInvestors,
  useInvestorsRealtime,
  type InvestorListEntry,
  type InvestorPipelineStage,
} from "@/stores/investors";

import { AddInvestorModal } from "./AddInvestorModal";
import { InvestorCard } from "./InvestorCard";
import { InvestorDrawer } from "./InvestorDrawer";

export function FundraisePage() {
  useInvestorsRealtime();

  const { data: investors = [], isLoading } = useInvestors();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Stats strip computed client-side from the loaded list. Cheap at
  // the volumes we expect (~150-1000 investors total).
  const stats = useMemo(() => {
    const total = investors.length;
    const p0 = investors.filter((i) => i.priority === 0).length;
    const replied = investors.filter(
      (i) =>
        (
          [
            "replied",
            "meeting_scheduled",
            "met",
            "considering",
            "closed",
          ] as InvestorPipelineStage[]
        ).includes(i.pipeline_stage),
    ).length;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const followupsDue = investors.filter(
      (i) =>
        i.next_followup_at != null &&
        new Date(i.next_followup_at) <= today,
    ).length;
    return { total, p0, replied, followupsDue };
  }, [investors]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      // Standalone route container -- matches the chrome other
      // top-level pages use (Workspace, Operations). Responsive
      // horizontal padding so content breathes on ultrawide
      // monitors but doesn't get a dead-center column.
      className="min-h-[100dvh] w-full bg-background text-foreground px-6 lg:px-8 xl:px-10 py-10"
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&display=swap');.ed-serif{font-family:'Newsreader',Georgia,serif}`}</style>

      {/* ── Editorial header ────────────────────────────────── */}
      <header className="mb-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-2 min-w-0 max-w-[60%]">
            <p className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-foreground/45">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-primary/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary,#dc2626)]" />
              </span>
              CodeWithAli · Fundraise · Pre-seed
            </p>
            <h1 className="ed-serif text-[36px] leading-[1.05] text-foreground tracking-tight m-0">
              Investor{" "}
              <span className="italic font-normal text-foreground/75">
                outreach
              </span>
            </h1>
            <p className="text-[12.5px] text-foreground/55 leading-snug pt-1">
              Every VC, angel, and warm intro in one funnel. Add manually
              or let Axon pull a researched list. Email, follow-ups, and
              reply tracking land here automatically.
            </p>
          </div>

          {/* Primary CTAs */}
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 h-9 rounded-sm bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              <Plus size={13} />
              Add investor
            </button>
            <button
              type="button"
              disabled
              title="Axon-powered investor research lands in Phase 2"
              className="inline-flex items-center gap-2 px-3.5 h-9 rounded-sm border border-border bg-secondary text-foreground/85 text-[12px] font-bold uppercase tracking-wider opacity-60 cursor-not-allowed"
            >
              <Sparkles size={13} />
              Find with Axon
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3 py-3 border-y border-border/50">
          <Stat label="Investors" value={stats.total} />
          <Stat label="P0 dream list" value={stats.p0} accent={stats.p0 > 0} />
          <Stat label="Replied or further" value={stats.replied} />
          <Stat
            label="Follow-ups due"
            value={stats.followupsDue}
            accent={stats.followupsDue > 0}
          />
        </div>
      </header>

      {/* ── Card grid ────────────────────────────────────────── */}
      {isLoading ? (
        <div className="py-16 flex items-center justify-center text-foreground/40 text-[13px]">
          <Loader2 size={14} className="animate-spin mr-2" /> Loading
          investors…
        </div>
      ) : investors.length === 0 ? (
        <EmptyState onAdd={() => setAddOpen(true)} />
      ) : (
        <ul
          className="grid gap-3 list-none p-0 m-0"
          style={{
            gridTemplateColumns:
              "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {investors.map((inv) => (
            <InvestorCard
              key={inv.id}
              investor={inv}
              onOpen={() => setSelectedId(inv.id)}
            />
          ))}
        </ul>
      )}

      {/* ── Modals + drawer ─────────────────────────────────── */}
      <AddInvestorModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
      <InvestorDrawer
        investorId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0">
      <span
        className={
          "text-[16px] font-semibold tabular-nums leading-tight " +
          (accent ? "text-primary" : "text-foreground")
        }
      >
        {value}
      </span>
      <span className="text-[9.5px] tracking-[0.12em] uppercase text-foreground/40 mt-0.5">
        {label}
      </span>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card/40 px-8 py-12 text-center max-w-md mx-auto mt-12">
      <PiggyBank
        size={20}
        className="mx-auto mb-3 text-foreground/35"
      />
      <p className="text-[13px] font-semibold text-foreground/75 mb-1">
        No investors tracked yet.
      </p>
      <p className="text-[11.5px] text-foreground/45 mb-4">
        Start by adding one manually. Phase 2 wires Axon to pull a
        researched list of VCs + angels matching your stage and sector.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
      >
        <Plus size={11} />
        Add your first investor
      </button>
    </div>
  );
}
