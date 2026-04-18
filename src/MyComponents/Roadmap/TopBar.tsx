import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Zap } from "lucide-react";
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
 * Page header. Matches the app's home-dashboard voice:
 *   · big title
 *   · small context line underneath
 *   · right-side action widget (YC countdown) that looks card-shaped.
 */
export function RoadmapTopBar({ activeCount, totalCount }: Props) {
  const { d, h, m, s, mounted } = useCountdown(YC_DEADLINE_ISO);

  return (
    <header className="flex shrink-0 items-end justify-between gap-6 border-b border-border bg-background/70 px-6 pt-5 pb-4 backdrop-blur">
      <div className="min-w-0">
        <motion.h1
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[22px] font-bold tracking-tight text-foreground"
        >
          Sovereign Roadmap
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="mt-1 flex items-center gap-3 text-[11.5px] text-muted-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <Zap className="size-3" />
            {activeCount} active
          </span>
          <span className="opacity-40">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3" />
            {totalCount} total
          </span>
          <span className="opacity-40">·</span>
          <span>CodeWithAli + SimplicityFunds + Takeover</span>
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 6 }}
        animate={{ opacity: 1, x: 0 }}
        role="status"
        aria-live="polite"
        aria-label="Y Combinator countdown"
        className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-2 text-card-foreground"
        style={{
          borderColor: "hsl(42 95% 58% / 0.35)",
          boxShadow: "0 0 30px -12px hsl(42 95% 58% / 0.45)",
        }}
      >
        <div
          className="flex size-7 items-center justify-center rounded-md"
          style={{
            background: "hsl(42 95% 58% / 0.12)",
            color: "hsl(42 95% 58%)",
          }}
        >
          <Clock className="size-3.5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
            YC deadline
          </span>
          {mounted ? (
            <span
              className="font-mono text-[13px] font-semibold tabular-nums"
              style={{ color: "hsl(42 95% 58%)" }}
            >
              {d}d · {h.toString().padStart(2, "0")}h ·{" "}
              {m.toString().padStart(2, "0")}m
            </span>
          ) : (
            <span className="font-mono text-[13px] opacity-60">— d · — h · — m</span>
          )}
        </div>
        <motion.span
          animate={{ opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="font-mono text-[10.5px] tabular-nums"
          style={{ color: "hsl(42 95% 58%)" }}
        >
          {mounted ? `${s.toString().padStart(2, "0")}s` : "--s"}
        </motion.span>
      </motion.div>
    </header>
  );
}
