import { cn } from "@/lib/utils";
import { forwardRef } from "react";

/**
 * BrandRailCard — the editorial card primitive.
 *
 * Standard variant: rounded surface, single border. Used for any
 * grouped content (metric tile, list item, info panel).
 *
 * Highlight variant: adds a brand-colored left-edge rail and a soft
 * brand-tinted background. Use to call attention to one card in a
 * group (active item, recommended choice, "today" milestone).
 *
 * Interactive variant: adds hover/active states for clickable cards
 * (list-item style).
 */
export const BrandRailCard = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    highlight?: boolean;
    interactive?: boolean;
    padding?: "sm" | "md" | "lg";
    railColor?: string;
  }
>(function BrandRailCard(
  {
    children,
    className = "",
    highlight = false,
    interactive = false,
    padding = "md",
    railColor,
    ...rest
  },
  ref,
) {
  const pad =
    padding === "lg" ? "p-7" : padding === "sm" ? "p-4" : "p-5 sm:p-6";

  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "relative rounded-xl border ed-surface transition-colors",
        pad,
        highlight ? "border-ed-strong" : "border-ed",
        interactive &&
          "cursor-pointer hover:border-ed-strong hover:ed-surface-2",
        highlight && "ed-brand-rail",
        className,
      )}
      style={
        highlight && railColor
          ? ({ ["--rail-color" as never]: railColor } as React.CSSProperties)
          : undefined
      }
    >
      {/* Override the rail color when railColor is passed */}
      {highlight && railColor && (
        <style>{`
          .ed-brand-rail::before { background: ${railColor} !important; }
        `}</style>
      )}
      {children}
    </div>
  );
});
