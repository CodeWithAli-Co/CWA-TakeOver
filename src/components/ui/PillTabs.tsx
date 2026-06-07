/**
 * PillTabs.tsx — Reusable segmented control with sliding-pill active state.
 *
 * Extracted from the original TierChip in the Connectors settings page
 * (the ALL 17 / EASY 7 / MEDIUM 5 / HARD 5 strip). Settled on as the
 * standard tab style across the app — workspace, reports, operations,
 * stripe revamp tabs, etc.
 *
 * Visual contract:
 *   ┌─────────────────────────────────────────┐
 *   │ ALL 17 (⬤ EASY 7) MEDIUM 5 HARD 5       │
 *   └─────────────────────────────────────────┘
 *   Outer container: rounded-full pill, foreground/[0.05] bg, soft border.
 *   Active chip: a `motion.span` layoutId animation slides between options
 *   on click. Text inverts to bg color while active.
 *
 * The `layoutId` is namespaced via the `groupId` prop so two PillTabs
 * in the same view don't share a moving indicator. If unset, each
 * instance gets a stable random id so it never collides with a sibling.
 *
 * Usage:
 *   const [tab, setTab] = useState<"all" | "docs" | "sheets">("all");
 *   <PillTabs
 *     groupId="workspaceTabs"
 *     value={tab}
 *     onChange={setTab}
 *     options={[
 *       { value: "all", label: "All", count: 29 },
 *       { value: "docs", label: "Documents", count: 23 },
 *       { value: "sheets", label: "Spreadsheets", count: 6 },
 *     ]}
 *   />
 */

import { motion } from "framer-motion";
import { useId } from "react";

export interface PillTabOption<V extends string> {
  value: V;
  label: string;
  /** Optional count rendered after the label in muted text. */
  count?: number;
  /** Optional disabled flag — chip dims and doesn't fire onChange. */
  disabled?: boolean;
}

export interface PillTabsProps<V extends string> {
  value: V;
  onChange: (next: V) => void;
  options: ReadonlyArray<PillTabOption<V>>;
  /** Namespace for the active-pill motion layoutId. Two PillTabs in
   *  the same view need different groupIds. If unset, useId provides
   *  one per mount. */
  groupId?: string;
  /** Optional extra classes on the outer container. */
  className?: string;
  /** Compact mode: smaller chip height and tighter padding. Default
   *  is the standard 24px row used by the Connectors strip. */
  size?: "sm" | "md";
}

export function PillTabs<V extends string>({
  value,
  onChange,
  options,
  groupId,
  className,
  size = "md",
}: PillTabsProps<V>) {
  const autoId = useId();
  const layoutId = `pillTabs:${groupId ?? autoId}`;

  const heightCls = size === "sm" ? "h-5" : "h-6";
  const padCls = size === "sm" ? "px-2" : "px-2.5";
  const textCls = size === "sm" ? "text-[10px]" : "text-[10.5px]";

  return (
    <div
      className={
        "inline-flex items-center bg-foreground/[0.05] border border-border-soft rounded-full p-0.5 " +
        (className ?? "")
      }
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => {
              if (!opt.disabled && !active) onChange(opt.value);
            }}
            className={`relative inline-flex items-center gap-1.5 ${padCls} ${heightCls} rounded-full ${textCls} font-bold uppercase tracking-[0.14em] transition-colors ${
              active
                ? "text-background"
                : opt.disabled
                  ? "text-foreground/25 cursor-not-allowed"
                  : "text-text-tertiary hover:text-foreground"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 bg-foreground rounded-full"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative">{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`relative tabular-nums ${
                  active ? "text-background/70" : "text-text-tertiary/70"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
