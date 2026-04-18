/**
 * PresenceDot.tsx — Tiny corner dot showing online / away / offline
 * for a given username. Subscribes to chatStore.presenceByUser and
 * recomputes status on a 30s tick so users transition into "away" /
 * "offline" without a fresh heartbeat.
 */

import { useEffect, useState } from "react";
import { useChatStore } from "@/stores/chatStore";

interface Props {
  username: string;
  /** Visual size in px. Default 8. */
  size?: number;
  /** Whether to render an outer border ring (for placement on dark
   *  surfaces where edge-against-edge is hard to see). Default true. */
  ring?: boolean;
  className?: string;
}

const COLOR: Record<string, string> = {
  online: "hsl(150 70% 45%)",
  away: "hsl(42 95% 58%)",
  offline: "hsl(220 8% 38%)",
};

export function PresenceDot({
  username, size = 8, ring = true, className = "",
}: Props) {
  const presenceStatus = useChatStore((s) => s.presenceStatus);
  // Recompute once per 30s so the status decays without a heartbeat.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const status = presenceStatus(username);
  if (status === "offline" && !ring) return null;

  return (
    <span
      aria-label={`${username} ${status}`}
      title={`${username} · ${status}`}
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: "9999px",
        background: COLOR[status],
        boxShadow: ring
          ? "0 0 0 2px hsl(var(--background))"
          : undefined,
      }}
    />
  );
}
