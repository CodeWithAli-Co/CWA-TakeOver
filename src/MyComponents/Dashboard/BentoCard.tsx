import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  /** Optional label. Renders as a quiet uppercase tag at the top-left
   *  of the card body by default. Pass `withHeaderBar` to lift it into
   *  a full elevated header strip (good for big multi-control panels;
   *  cramped on small stat tiles). */
  label?: string;
  withHeaderBar?: boolean;
  /** Right-side actions slot for the header strip. Only renders when
   *  `withHeaderBar` is true. Used for icon buttons like "Send kudos",
   *  "Settings", etc. — anything that should live next to the title. */
  headerActions?: ReactNode;
  /** col-span and row-span classes */
  span?: string;
  delay?: number;
  noPadding?: boolean;
}

/**
 * Single, consistent card chrome — wired through semantic tokens so
 * theme switching + future palette tunes happen at the token layer:
 *
 *   · bg-card        — the "surface" elevation tier (sits ON canvas)
 *   · border-border-soft — near-invisible hairline (white at ~6% alpha)
 *   · rounded-xl     — the unified card radius (~14px), softer + warmer
 *                       than the previous rounded-lg/rounded-md mix
 *   · no hover state — cards are containers, not interactive controls
 *
 * Header bar (opt-in) uses bg-popover (the "elevated" tier) so it
 * reads as a distinct strip without dragging in arbitrary zinc shades.
 */
export function BentoCard({
  children,
  className = "",
  label,
  withHeaderBar = false,
  headerActions,
  span = "",
  delay = 0,
  noPadding = false,
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.3, ease: "easeOut" }}
      className={`bento-card rounded-xl border-xs border-border-soft bg-card overflow-hidden ${span} ${className}`}
    >
      {label && withHeaderBar && (
        <header className="bg-popover/70 border-b border-xs border-border-soft px-4 py-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            {label}
          </span>
          {headerActions && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {headerActions}
            </div>
          )}
        </header>
      )}
      {/* `noPadding` cards (chart panels) still need the inline label to
          breathe — give it its own padding wrapper so it doesn't sit
          flush against the card edge. */}
      {label && !withHeaderBar && noPadding && (
        <div className="px-4 pt-4 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            {label}
          </span>
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>
        {label && !withHeaderBar && !noPadding && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary block mb-2">
            {label}
          </span>
        )}
        {children}
      </div>
    </motion.div>
  );
}

/** Legacy inline label. Prefer BentoCard's `label` prop for new code. */
export function BentoLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
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
    <span className={`text-3xl font-bold text-foreground tabular-nums leading-none ${className}`}>
      {children}
    </span>
  );
}
