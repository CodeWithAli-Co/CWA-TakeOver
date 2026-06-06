/**
 * InsightsCard.tsx — Top-of-page AI-noticed observations.
 *
 * Renders a vertical list of Insight objects (produced by
 * insights.ts heuristics). Each row has a tone-coded badge, a
 * headline, and an optional detail line. Auto-hides when there's
 * nothing notable to surface, so the card doesn't become noise on
 * quiet days.
 *
 * Visual treatment: subtle AXON-branded eyebrow ("AXON noticed")
 * so it's clear these are agent observations rather than raw
 * metrics. The eyebrow doubles as the demo cue — investors
 * watching see AXON's name on the page and connect it to the
 * narrative.
 */

import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Award,
  ShieldCheck,
} from "lucide-react";
import type { Insight, InsightSeverity } from "./insights";

interface Props {
  insights: Insight[];
}

export function InsightsCard({ insights }: Props) {
  // Auto-hide when AXON has nothing to say. Avoids surfacing an
  // empty/loading card on freshly connected accounts.
  if (insights.length === 0) return null;

  return (
    <section className="mb-6 rounded-2xl border-xs border-primary/25 bg-gradient-to-br from-primary/[0.05] via-foreground/[0.02] to-foreground/[0.02] px-4 py-3">
      <header className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          AXON noticed
        </span>
        <span className="text-[10px] font-semibold text-text-tertiary">
          · {insights.length} observation{insights.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="space-y-1.5">
        {insights.slice(0, 5).map((i) => (
          <InsightRow key={i.id} insight={i} />
        ))}
      </ul>
    </section>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const Icon = iconFor(insight);
  const tone = toneClass(insight.severity);
  return (
    <li className="flex items-start gap-2.5 px-1 py-1">
      <span
        className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-md ${tone.bg} ${tone.border} border`}
      >
        <Icon size={11} className={tone.text} />
      </span>
      <div className="min-w-0">
        <p className={`text-[12.5px] font-semibold ${tone.text}`}>
          {insight.line}
        </p>
        {insight.detail && (
          <p className="text-[11px] text-text-tertiary mt-0.5 leading-snug">
            {insight.detail}
          </p>
        )}
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────
// Tone + icon mapping
// ────────────────────────────────────────────────

function toneClass(severity: InsightSeverity): {
  bg: string;
  border: string;
  text: string;
} {
  switch (severity) {
    case "alert":
      return {
        bg: "bg-destructive/12",
        border: "border-destructive/30",
        text: "text-destructive",
      };
    case "watch":
      return {
        bg: "bg-warning/12",
        border: "border-warning/30",
        text: "text-warning",
      };
    case "good":
      return {
        bg: "bg-success/12",
        border: "border-success/30",
        text: "text-success",
      };
    default:
      return {
        bg: "bg-foreground/[0.06]",
        border: "border-border-soft",
        text: "text-foreground/90",
      };
  }
}

function iconFor(insight: Insight) {
  switch (insight.category) {
    case "velocity":
      return insight.severity === "good" ? TrendingUp : TrendingDown;
    case "build-time":
      return Clock;
    case "regression":
      return AlertTriangle;
    case "quality":
      return ShieldCheck;
    case "champion":
      return Award;
    default:
      return Sparkles;
  }
}

export default InsightsCard;
