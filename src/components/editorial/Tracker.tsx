import { cn } from "@/lib/utils";

/**
 * Tracker — small uppercase letterspaced label, the workhorse of the
 * editorial vocabulary. Shows up above section headers ("AXON v1 ·
 * LIVE"), inside cards as eyebrow text ("PRESS CONTACT"), and in
 * tabular columns ("DIMENSION").
 *
 * Pair with <TrackerDot /> for the AXON-vocab dot prefix:
 *   <Tracker><TrackerDot color="emerald" />ACTIVE · 12</Tracker>
 */
export function Tracker({
  children,
  className = "",
  size = "md",
  tone = "muted",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md";
  tone?: "muted" | "fg" | "brand";
}) {
  const cls = size === "sm" ? "ed-tracker-sm" : "ed-tracker";
  const toneCls =
    tone === "brand"
      ? "text-ed-brand"
      : tone === "fg"
      ? "text-ed-fg"
      : "text-ed-fg-muted";
  return (
    <span className={cn(cls, toneCls, "inline-flex items-center", className)}>
      {children}
    </span>
  );
}

/**
 * TrackerDot — the glowing 5px dot prefix that signals "live" or
 * "active" state. Inherits color from currentColor or accepts an
 * explicit color prop.
 */
export function TrackerDot({
  color,
  className = "",
}: {
  /** any valid CSS color string; defaults to currentColor */
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block w-[5px] h-[5px] rounded-full mr-2 align-middle", className)}
      style={{
        background: color ?? "currentColor",
        boxShadow: `0 0 8px ${color ?? "currentColor"}`,
      }}
    />
  );
}
