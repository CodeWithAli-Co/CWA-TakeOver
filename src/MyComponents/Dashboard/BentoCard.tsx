import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  /** Optional label. By default this renders as an inline tag at the
   *  top-left of the card body (the original BentoLabel behavior).
   *  Pass `withHeaderBar` if you want it lifted into a full zinc
   *  header strip with a border-b — looks good on larger cards
   *  (Active Projects, Quick Stats, Revenue chart) but cramped on
   *  the small StatCard tiles. */
  label?: string;
  withHeaderBar?: boolean;
  /** col-span and row-span classes */
  span?: string;
  delay?: number;
  noPadding?: boolean;
}

/**
 * Common chrome:
 *   · border-zinc-800 + bg-zinc-950/40 — consistent silhouette across
 *     all dashboard cards, with the page background bleeding through
 *     just enough that cards visually recede into the layout.
 *   · No hover state. Cards are containers, not buttons.
 *
 * Label rendering is per-call: inline tag by default, full header
 * strip if `withHeaderBar` is true.
 */
export function BentoCard({
  children,
  className = "",
  label,
  withHeaderBar = false,
  span = "",
  delay = 0,
  noPadding = false,
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className={`bento-card rounded-lg border border-zinc-800 bg-zinc-950/40 overflow-hidden ${span} ${className}`}
    >
      {label && withHeaderBar && (
        <header className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
            {label}
          </span>
        </header>
      )}
      {/* When the body is unpadded (chart cards etc.), the inline label
          needs its own padding wrapper so it doesn't sit flush against
          the card edge. */}
      {label && !withHeaderBar && noPadding && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
            {label}
          </span>
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>
        {label && !withHeaderBar && !noPadding && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400 block mb-2">
            {label}
          </span>
        )}
        {children}
      </div>
    </motion.div>
  );
}

/** Standalone label — still exported for ad-hoc use, but BentoCard's
 *  built-in `label` prop is preferred for consistency. */
export function BentoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
      {children}
    </span>
  );
}

export function BentoValue({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`text-xl font-bold text-foreground tabular-nums ${className}`}>
      {children}
    </span>
  );
}
