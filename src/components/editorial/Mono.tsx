import { cn } from "@/lib/utils";

/**
 * Mono — JetBrains Mono inline span/block.
 *
 * Use for IDs, timestamps, status codes, hashes, version numbers,
 * row counts, anything that reads as "machine output." Helps the
 * eye distinguish computed values from natural language.
 *
 *   <Mono>{instance.id.slice(0, 8)}</Mono>
 *   <Mono size="xs" tone="muted">2026-05-21 14:32 UTC</Mono>
 */
export function Mono({
  children,
  className = "",
  size = "sm",
  tone = "fg-2",
  uppercase = false,
}: {
  children: React.ReactNode;
  className?: string;
  size?: "xs" | "sm" | "md";
  tone?: "fg" | "fg-2" | "muted" | "brand";
  uppercase?: boolean;
}) {
  const sizeCls =
    size === "xs" ? "text-[10px]" : size === "md" ? "text-[13px]" : "text-[11.5px]";
  const toneCls =
    tone === "brand"
      ? "text-ed-brand"
      : tone === "fg"
      ? "text-ed-fg"
      : tone === "muted"
      ? "text-ed-fg-muted"
      : "text-ed-fg-2";
  return (
    <span
      className={cn(
        "ed-mono",
        sizeCls,
        toneCls,
        uppercase && "uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </span>
  );
}
