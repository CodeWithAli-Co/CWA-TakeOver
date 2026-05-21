import { cn } from "@/lib/utils";

/**
 * Hairline — gradient fade-out divider used as a subtle section
 * break inside cards or columns. Matches the takeover-B2B pattern.
 */
export function Hairline({ className = "" }: { className?: string }) {
  return <div className={cn("ed-hairline my-4", className)} />;
}
