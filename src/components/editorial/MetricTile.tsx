import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { BrandRailCard } from "./BrandRailCard";
import { Mono } from "./Mono";
import { Tracker } from "./Tracker";

/**
 * MetricTile — a single KPI in the editorial language.
 *
 * Big number on top (ed-display), tracker label below, optional
 * icon top-right, optional delta/change indicator, optional
 * brand-rail highlight to mark the focused metric in a row.
 *
 *   <MetricTile label="Active hires" value={12} icon={Users} />
 *   <MetricTile label="MRR" value="$1.84M" delta="+12%" tone="good" />
 */
export function MetricTile({
  label,
  value,
  delta,
  icon: Icon,
  tone = "neutral",
  highlight = false,
  className = "",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  /** color hint for the delta */
  tone?: "neutral" | "good" | "warn" | "bad";
  highlight?: boolean;
  className?: string;
}) {
  const deltaTone =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
      ? "text-amber-400"
      : tone === "bad"
      ? "text-rose-400"
      : "text-ed-fg-muted";

  return (
    <BrandRailCard highlight={highlight} padding="md" className={className}>
      <div className="flex items-start justify-between mb-3">
        <Tracker size="sm">{label}</Tracker>
        {Icon && (
          <div className="w-8 h-8 rounded-md ed-surface-2 border border-ed flex items-center justify-center">
            <Icon size={14} className="text-ed-brand" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-3">
        <span
          className={cn(
            "ed-display text-3xl lg:text-4xl text-ed-fg leading-none",
          )}
        >
          {value}
        </span>
        {delta && (
          <Mono size="xs" className={cn(deltaTone, "font-bold")}>
            {delta}
          </Mono>
        )}
      </div>
    </BrandRailCard>
  );
}
