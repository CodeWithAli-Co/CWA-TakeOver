// ───────────────────────────────────────────────────────────────────
// decisionEngine — the decision-intelligence output behind the Today
// feed. Assembles the 2-3 things that actually need the operator from
// REAL data sources, each with a stake traced to a real column. Where
// a stake needs data that isn't linked yet (the unified org/person
// spine), it is marked `pending` and rendered as "to build" — never
// faked with an invented number.
//
// Grounded in:
//   · src/stores/crm.ts        — useDealsByStage, daysInStage, DEAL_OPEN_STAGES
//   · cwa_todos (per-tenant)    — overdue tasks (status != done, deadline < now)
// ───────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";
import { useCompanyFilter } from "@/stores/store";
import {
  useDealsByStage,
  DEAL_OPEN_STAGES,
  daysInStage,
  type CrmDeal,
} from "@/stores/crm";

export type Severity = "critical" | "warning" | "info" | "pending";

export interface DecisionAction {
  label: string;
  kind: "navigate" | "axon" | "noop";
  to?: string;       // route for navigate
  prompt?: string;   // prompt for axon
}

export interface Decision {
  id: string;
  severity: Severity;
  title: string;
  /** Always traced to real data, or omitted. e.g. "$59K at risk". */
  stake?: string;
  stakeValue?: number;
  context: string;
  actions: DecisionAction[];
  /** Real data source, surfaced as a quiet footnote so nothing is opaque. */
  source: string;
  /** true = needs the unified data spine; rendered as "to build". */
  pending?: boolean;
}

const STALL_DAYS = 10;

const fmtUsd = (cents: number) => {
  const d = cents / 100;
  if (d >= 1000) return `$${(d / 1000).toFixed(d >= 10000 ? 0 : 1)}K`;
  return `$${Math.round(d)}`;
};

/** Overdue tasks straight from cwa_todos — the same table the app uses. */
function useOverdueTasks() {
  const { activeCompany } = useCompanyFilter();
  return useQuery({
    queryKey: ["today:overdue-todos", activeCompany],
    queryFn: async () => {
      const label =
        activeCompany === "simplicityFunds" ? "simplicity" : "CodeWithAli";
      let q = companySupabase.from("cwa_todos").select("*");
      if (activeCompany !== "all") q = q.eq("company", label);
      const { data, error } = await q;
      if (error) throw error;
      const now = Date.now();
      return ((data ?? []) as any[]).filter(
        (t) =>
          t.status !== "done" &&
          t.deadline &&
          new Date(t.deadline).getTime() < now,
      );
    },
    staleTime: 60_000,
  });
}

export function useDecisions(): { decisions: Decision[]; isLoading: boolean } {
  const dealsQ = useDealsByStage();
  const overdueQ = useOverdueTasks();

  const decisions = useMemo<Decision[]>(() => {
    const out: Decision[] = [];

    // 1) Stalled deals — REAL. Open-stage deals untouched > STALL_DAYS,
    //    ranked by dollar exposure. Stake = crm_deals.amount_cents.
    const allDeals: CrmDeal[] = dealsQ.data
      ? Object.values(dealsQ.data).flat()
      : [];
    const stalled = allDeals
      .filter(
        (d) =>
          DEAL_OPEN_STAGES.includes(d.stage) &&
          daysInStage(d) >= STALL_DAYS &&
          d.amount_cents > 0,
      )
      .sort((a, b) => b.amount_cents - a.amount_cents);

    for (const d of stalled.slice(0, 3)) {
      const days = daysInStage(d);
      out.push({
        id: `deal-${d.id}`,
        severity: d.amount_cents >= 5_000_000 ? "critical" : "warning",
        title: `${d.name} has gone quiet`,
        stake: `${fmtUsd(d.amount_cents)} at risk`,
        stakeValue: d.amount_cents,
        context: `Sitting in ${d.stage} for ${days} days with no movement — ${d.probability}% probability.`,
        actions: [
          { label: "Open deal", kind: "navigate", to: "/sales" },
          {
            label: "Axon: draft a nudge",
            kind: "axon",
            prompt: `Draft a short, warm follow-up to revive the stalled deal "${d.name}".`,
          },
        ],
        source: "crm_deals · stage age + amount_cents",
      });
    }

    // 2) Overdue tasks — REAL.
    const overdue = overdueQ.data ?? [];
    if (overdue.length > 0) {
      const titles = overdue
        .slice(0, 2)
        .map((t: any) => t.title)
        .filter(Boolean)
        .join(" · ");
      out.push({
        id: "overdue-tasks",
        severity: overdue.length >= 5 ? "warning" : "info",
        title: `${overdue.length} task${overdue.length === 1 ? "" : "s"} past deadline`,
        stake: `${overdue.length} blocking`,
        stakeValue: overdue.length,
        context: titles || "Past their deadline and not marked done.",
        actions: [
          { label: "Review in Operations", kind: "navigate", to: "/operations" },
          {
            label: "Axon: reschedule",
            kind: "axon",
            prompt: "Show my overdue tasks and propose realistic new deadlines.",
          },
        ],
        source: "cwa_todos · status != done, deadline < now",
      });
    }

    // 3) At-risk customer — TO BUILD. Needs the unified org/person spine.
    //    A churn signal (Stripe failed payment + no recent activity + open
    //    issue) can't be computed until customers are linked across
    //    billing, CRM, and support. Shown honestly, not faked.
    out.push({
      id: "pending-churn",
      severity: "pending",
      title: "At-risk customer detection",
      context:
        "Blocked on the unified org spine: linking a Stripe customer to its CRM activity and open issues is what turns this into a real \"$X about to churn\" signal. Marked to-build rather than invented.",
      actions: [{ label: "Why it's pending", kind: "noop" }],
      source: "needs org/person spine (see system spec)",
      pending: true,
    });

    // 4) Runway — TO BUILD wiring. Axon can already compute it
    //    (finance_runway), but surfacing it live in this feed needs the
    //    finance hooks wired in. Pending, not faked.
    out.push({
      id: "pending-runway",
      severity: "pending",
      title: "Runway watch",
      context:
        "Axon can compute runway today via finance_runway — wiring it into this feed as a live tile is the remaining step. Ask Axon directly meanwhile.",
      actions: [
        {
          label: "Ask Axon for runway",
          kind: "axon",
          prompt: "What's our current runway and monthly burn rate?",
        },
      ],
      source: "unified_finance.* (action exists; feed wiring pending)",
      pending: true,
    });

    const rank: Record<Severity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
      pending: 3,
    };
    out.sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        (b.stakeValue ?? 0) - (a.stakeValue ?? 0),
    );
    return out;
  }, [dealsQ.data, overdueQ.data]);

  return {
    decisions,
    isLoading: dealsQ.isLoading || overdueQ.isLoading,
  };
}
