/**
 * LifecyclePill — status pill for crm_contacts.lifecycle_stage.
 *
 * Same visual grammar as the financial dashboard's StatusPill
 * (mono uppercase + colored dot + soft tinted background), but
 * scoped to the six CRM lifecycle stages.
 *
 * Used by:
 *   · /sales/contacts list rows
 *   · /sales contact-detail drawer
 *   · /sales deal kanban cards (when showing the linked contact)
 *
 * Color logic:
 *   lead          zinc       — quiet, neutral, "not yet engaged"
 *   mql           blue       — engaged with content
 *   sql           blue/300   — real conversation happened
 *   opportunity   amber      — open deal in flight (warm signal)
 *   customer      emerald    — pulsing dot, the headline state
 *   churned       zinc/dim   — was a customer, no longer
 *
 * Sizes:
 *   sm — default; list rows + drawer subheaders
 *   md — kanban card meta line
 *
 * The component is intentionally self-contained — no shared design
 * tokens import — so it can be dropped anywhere /sales touches.
 */

import React from "react";
import type { LifecycleStage } from "@/stores/crm";

type Size = "sm" | "md";

interface PillSpec {
  wrap:  string;
  dot:   string;
  label: string;
  /** Pulse the dot when this state is "active" / live. */
  pulse?: boolean;
}

const SPECS: Record<LifecycleStage, PillSpec> = {
  lead: {
    wrap:  "bg-zinc-500/[0.06] text-zinc-400 border-zinc-500/15",
    dot:   "bg-zinc-500",
    label: "Lead",
  },
  mql: {
    wrap:  "bg-blue-500/[0.08] text-blue-300 border-blue-500/20",
    dot:   "bg-blue-400",
    label: "MQL",
  },
  sql: {
    wrap:  "bg-blue-500/[0.1] text-blue-200 border-blue-500/25",
    dot:   "bg-blue-300",
    label: "SQL",
  },
  opportunity: {
    wrap:  "bg-amber-500/[0.07] text-amber-400/85 border-amber-500/20",
    dot:   "bg-amber-400/80",
    label: "Opportunity",
  },
  customer: {
    wrap:  "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/20",
    dot:   "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]",
    label: "Customer",
    pulse: true,
  },
  churned: {
    wrap:  "bg-zinc-500/[0.04] text-zinc-500 border-zinc-500/15",
    dot:   "bg-zinc-600",
    label: "Churned",
  },
};

const SIZES: Record<Size, { box: string; dotSize: string }> = {
  sm: {
    box:     "px-1.5 py-0.5 text-[9.5px] gap-1.5",
    dotSize: "h-1 w-1",
  },
  md: {
    box:     "px-2 py-0.5 text-[10px] gap-1.5",
    dotSize: "h-1.5 w-1.5",
  },
};

export const LifecyclePill: React.FC<{
  stage: LifecycleStage;
  size?: Size;
  /** Render compact 1–3 letter code instead of full label. Used in
   *  tight grids like the kanban deal card meta line. */
  compact?: boolean;
}> = ({ stage, size = "sm", compact = false }) => {
  const spec = SPECS[stage];
  const sz = SIZES[size];

  const label = compact
    ? stage === "mql" || stage === "sql"
      ? stage.toUpperCase()
      : stage === "opportunity"
        ? "OPP"
        : spec.label.charAt(0).toUpperCase() + spec.label.slice(1, 4)
    : spec.label;

  return (
    <span
      className={`inline-flex items-center font-mono uppercase tracking-wider rounded border ${sz.box} ${spec.wrap}`}
    >
      <span className="relative flex">
        {spec.pulse && (
          <span
            className={`absolute inline-flex rounded-full opacity-75 animate-ping bg-emerald-400/70 ${sz.dotSize}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${sz.dotSize} ${spec.dot}`} />
      </span>
      {label}
    </span>
  );
};
