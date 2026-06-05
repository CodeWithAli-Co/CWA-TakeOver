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
      // Editorial surface: zinc gradient tile, hairline emerald-leaning
      // border that warms on hover, soft inset highlight on top. Matches
      // the Sales / Inbox cards so the whole app reads as one family.
      className={`bento-card rounded-xl border border-white/[0.06] bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 overflow-hidden transition-colors hover:border-emerald-500/20 ${span} ${className}`}
    >
      {label && withHeaderBar && (
        <header className="bg-zinc-950/40 border-b border-white/[0.05] px-4 py-2.5 flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
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
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">
            {label}
          </span>
        </div>
      )}
      <div className={noPadding ? "" : "p-4"}>
        {label && !withHeaderBar && !noPadding && (
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 block mb-2">
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
  // Editorial value treatment — Newsreader serif at 30px, medium
  // weight so the number reads as a confident editorial figure
  // (like the deal-card hero totals on Sales) rather than the old
  // generic Tailwind bold-sans. Tabular nums keep grids aligning.
  return (
    <span
      className={`text-[30px] font-medium text-zinc-100 tabular-nums leading-none ${className}`}
      style={{ fontFamily: "Newsreader, Georgia, serif" }}
    >
      {children}
    </span>
  );
}
