import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Clock, Map as MapIcon } from "lucide-react";
import { YC_DEADLINE_ISO } from "./lib/constants";

interface Props {
  activeCount: number;
  totalCount: number;
}

function useCountdown(targetIso: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = new Date(targetIso).getTime();
  const delta = now == null ? 0 : Math.max(0, target - now);
  const d = Math.floor(delta / 86_400_000);
  const h = Math.floor((delta / 3_600_000) % 24);
  const m = Math.floor((delta / 60_000) % 60);
  const s = Math.floor((delta / 1000) % 60);
  return { d, h, m, s, mounted: now != null };
}

/**
 * Roadmap header. Cleaner / lighter than the previous version:
 *   · brand mark + title on the left, all in a single row
 *   · stats inline as small chip-style pills under the title
 *   · YC countdown collapsed to a tighter accent capsule on the right
 *
 * No dual-row stack, no fighting widgets. Reads as a calm command
 * surface, not a dashboard control bar.
 */
export function RoadmapTopBar({ activeCount, totalCount }: Props) {
  const { d, h, m, s, mounted } = useCountdown(YC_DEADLINE_ISO);

  return (
    <header className="flex shrink-0 items-center justify-between gap-6 border-b border-border bg-background/40 px-6 py-4 backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-3">
        {/* Brand glyph — soft circle with a map icon. Identifies the page
            without screaming for attention. */}
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in srgb, hsl(var(--primary)) 12%, transparent)",
            color: "hsl(var(--primary))",
          }}
        >
          <MapIcon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <motion.h1
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[19px] font-bold leading-tight tracking-tight text-foreground"
          >
            Sovereign Roadmap
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.06 }}
            className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]"
          >
            <Stat
              icon={<Activity className="size-3" />}
              value={activeCount}
              label="active"
              tone="primary"
            />
            <Stat
              icon={<Clock className="size-3" />}
              value={totalCount}
              label="total"
              tone="muted"
            />
            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              CWA · Simplicity · Takeover
            </span>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        role="status"
        aria-live="polite"
        aria-label="Y Combinator countdown"
        className="flex shrink-0 items-center gap-2.5 rounded-full border bg-card/80 px-3 py-1.5 backdrop-blur"
        style={{
          borderColor: "hsl(42 95% 58% / 0.32)",
          boxShadow: "0 0 24px -10px hsl(42 95% 58% / 0.42)",
        }}
      >
        <div
          className="flex size-5 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "hsl(42 95% 58% / 0.16)",
            color: "hsl(42 95% 58%)",
          }}
        >
          <Clock className="size-2.5" />
        </div>
        <span className="font-mono text-[8.5px] uppercase tracking-[0.20em] text-muted-foreground">
          YC
        </span>
        {mounted ? (
          <span
            className="font-mono text-[12px] font-semibold tabular-nums"
            style={{ color: "hsl(42 95% 58%)" }}
          >
            {d}d {h.toString().padStart(2, "0")}h {m.toString().padStart(2, "0")}m
          </span>
        ) : (
          <span className="font-mono text-[12px] opacity-50">— d — h — m</span>
        )}
        <motion.span
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="font-mono text-[10px] tabular-nums opacity-70"
          style={{ color: "hsl(42 95% 58%)" }}
        >
          {mounted ? `${s.toString().padStart(2, "0")}s` : "--s"}
        </motion.span>
      </motion.div>
    </header>
  );
}

// Small inline stat chip — same shape regardless of tone.
function Stat({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "primary" | "muted";
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium"
      style={
        tone === "primary"
          ? {
              background: "color-mix(in srgb, hsl(var(--primary)) 14%, transparent)",
              color: "hsl(var(--primary))",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, hsl(var(--primary)) 28%, transparent)",
            }
          : {
              background: "hsl(var(--muted) / 0.4)",
              color: "hsl(var(--muted-foreground))",
              boxShadow: "inset 0 0 0 1px hsl(var(--border))",
            }
      }
    >
      {icon}
      <span className="font-mono tabular-nums text-[11px] font-semibold">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.12em] opacity-80">{label}</span>
    </span>
  );
}
