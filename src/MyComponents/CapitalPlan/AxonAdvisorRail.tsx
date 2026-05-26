/**
 * AxonAdvisorRail.tsx — Persistent AXON advisor column (Phase 4 stub).
 *
 * Will host: chat input wired to a new `capital_advise` AXON action,
 * inline suggestion stream tied to the active tab, and auto-apply
 * recommendations with one-click undo (consistent with the global
 * AXON action log / undo stack).
 *
 * Phase 1 ships this collapsible placeholder with a contextual
 * teaser so the layout shape is final.
 */

import { Sparkles, X, MessageSquare, Wand2, Bell, ShieldCheck } from "lucide-react";
import type { CapitalPlanData } from "./CapitalPlan.queries";

export function AxonAdvisorRail({
  plan, activeTab, onClose,
}: {
  plan: CapitalPlanData;
  activeTab: string;
  onClose: () => void;
}) {
  const totalRounds = plan.rounds.length;
  const inFlight = plan.rounds.filter((r) => r.status === "raising" || r.status === "planning").length;
  const checksTracked = plan.checks.length;

  return (
    <aside className="border-l border-border bg-card/20 min-h-[calc(100vh-64px)] overflow-y-auto">
      <div className="sticky top-0 bg-card/30 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-300" />
          <span className="text-[12px] font-bold tracking-tight text-foreground">AXON Advisor</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          aria-label="Close advisor"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-4 space-y-4 text-[12px] text-foreground/85 leading-relaxed">
        <div className="border border-violet-500/20 bg-violet-500/[0.04] rounded-sm p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-violet-300 font-bold mb-1.5">
            Current state
          </div>
          <ul className="space-y-1 text-[11.5px]">
            <li>{totalRounds} round{totalRounds === 1 ? "" : "s"} on file · {inFlight} in flight</li>
            <li>{checksTracked} investor{checksTracked === 1 ? "" : "s"} tracked</li>
            <li>Viewing: <span className="text-violet-200 font-semibold capitalize">{activeTab}</span></li>
          </ul>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-bold mb-2">
            What AXON will do
          </div>
          <ul className="space-y-2">
            <Capability icon={MessageSquare} text="Answer ad-hoc questions about your capital state — burn, runway, dilution tradeoffs." />
            <Capability icon={Wand2}         text="Inline suggestions next to budget rows with one-click apply / undo." />
            <Capability icon={Bell}          text="Alerts at 9mo / 6mo / 3mo runway thresholds + round-progress slippage." />
            <Capability icon={ShieldCheck}   text="Every action goes through the global AXON audit log — nothing happens silently." />
          </ul>
        </div>

        <div className="border border-dashed border-border rounded-sm p-3 text-[11px] text-muted-foreground italic">
          Wired in Phase 4. Schema, plumbing, and the rail layout are live now.
        </div>
      </div>
    </aside>
  );
}

function Capability({ icon: Icon, text }: { icon: typeof Sparkles; text: string }) {
  return (
    <li className="flex items-start gap-2 text-[11.5px] text-muted-foreground leading-snug">
      <Icon className="h-3 w-3 mt-0.5 text-muted-foreground/60 shrink-0" />
      <span>{text}</span>
    </li>
  );
}
