import { cn } from "@/lib/utils";

/**
 * SectionHead — the §NN + title editorial divider.
 *
 * Three variants:
 *   - "rule"   — full-bleed divider with section number, title,
 *                and a gradient hairline between them.
 *   - "inline" — compact label-only ("§01  Fact sheet"), used as
 *                a section heading within a card or column.
 *   - "hero"   — large display heading with a small §NN above.
 *
 * Direct port of takeover-B2B/components/SectionLabel.tsx with
 * additional variants the app needs.
 */
export function SectionHead({
  num,
  title,
  variant = "inline",
  className = "",
}: {
  num: string;
  title: string;
  variant?: "rule" | "inline" | "hero";
  className?: string;
}) {
  if (variant === "rule") {
    return (
      <div
        className={cn(
          "flex items-center gap-6 py-4 border-y border-ed",
          className,
        )}
      >
        <span className="ed-mono ed-tracker text-ed-fg-muted">§{num}</span>
        <div
          className="h-px flex-1"
          style={{
            background:
              "linear-gradient(90deg, rgb(var(--ed-border-strong)), transparent)",
          }}
        />
        <span className="ed-tracker text-ed-fg">{title}</span>
      </div>
    );
  }

  if (variant === "hero") {
    return (
      <div className={cn("space-y-3", className)}>
        <span className="ed-mono ed-tracker text-ed-fg-muted">§{num}</span>
        <h2 className="ed-display text-3xl lg:text-4xl text-ed-fg leading-[0.95]">
          {title}
        </h2>
      </div>
    );
  }

  // inline
  return (
    <div className={cn("flex items-baseline gap-4 mb-6", className)}>
      <span className="ed-mono text-[11px] ed-tracker text-ed-fg-muted">
        §{num}
      </span>
      <h2 className="ed-display text-2xl lg:text-3xl text-ed-fg tracking-tight">
        {title}
      </h2>
    </div>
  );
}
