/**
 * AllocationTab.tsx — Editable budget table (Phase 3 stub).
 *
 * Will show: per-round budget table, drag-to-reallocate sliders,
 * line-item drilldown for each bucket, and side-by-side compare
 * across rounds. Seed data already populated for the Angel 2026
 * round so you'll see real numbers once Phase 3 wires it up.
 */

import { PieChart, GripVertical, Eye, Layers } from "lucide-react";
import type { CapitalPlanData } from "../CapitalPlan.queries";
import { ComingSoon } from "./ChecksTab";

export function AllocationTab({
  plan, selectedRoundId,
}: {
  plan: CapitalPlanData;
  selectedRoundId: string | null;
}) {
  // Preview: show the seeded allocation counts as proof RLS + seed worked.
  const allocsForRound = selectedRoundId
    ? plan.allocations.filter((a) => a.round_id === selectedRoundId)
    : plan.allocations;

  return (
    <div className="space-y-5">
      <ComingSoon
        icon={<PieChart className="h-5 w-5" />}
        title="Allocation"
        subtitle="Phase 3"
        bullets={[
          { icon: GripVertical, text: "Editable budget table per round with drag-to-reallocate sliders" },
          { icon: Layers,       text: "Line-item drilldown inside each bucket (e.g. Marketing → conferences / ads / content)" },
          { icon: Eye,          text: "Side-by-side compare across rounds — see how spending shifts pre-seed → seed → Series A" },
          { icon: PieChart,     text: "Live pie chart synced with the table; total reconciliation against round target" },
        ]}
      />

      {/* Read-only preview of seeded allocations, just to verify Phase 1 wiring */}
      {allocsForRound.length > 0 && (
        <div className="border border-border rounded-sm bg-card/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-bold">
              {selectedRoundId ? "Allocations (selected round)" : "All allocations · preview"}
            </span>
            <span className="text-[10.5px] text-muted-foreground/70 tabular-nums">
              {allocsForRound.length} buckets · ${(allocsForRound.reduce((s, a) => s + a.planned_amount, 0) / 1000).toFixed(0)}K total
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border/60 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
                <th className="text-left px-5 py-2.5 font-semibold">Bucket</th>
                <th className="text-left px-2 py-2.5 font-semibold">Category</th>
                <th className="text-right px-2 py-2.5 font-semibold">Planned</th>
                <th className="text-right px-5 py-2.5 font-semibold">Months</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {allocsForRound.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-2.5 text-foreground font-medium">{a.bucket_name}</td>
                  <td className="px-2 py-2.5 text-muted-foreground uppercase text-[10.5px] tracking-wide">{a.category}</td>
                  <td className="px-2 py-2.5 text-right text-emerald-200 font-semibold tabular-nums">
                    ${(a.planned_amount / 1000).toFixed(0)}K
                  </td>
                  <td className="px-5 py-2.5 text-right text-muted-foreground tabular-nums">{a.period_months}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
