/**
 * AxonSwarmPage — the admin / control room for the multi-agent Axon stack.
 *
 *   ┌─────────────────────────────────────────────┬─────────────┐
 *   │  Header  ·  Swarm-wide status               │             │
 *   ├─────────────────────────────────────────────┤  Detail     │
 *   │                                             │  panel for  │
 *   │           SwarmGraph (8 orbs + bridges)     │  selected   │
 *   │                                             │  agent      │
 *   ├─────────────────────────────────────────────┤             │
 *   │           EventBus (live log)               │             │
 *   └─────────────────────────────────────────────┴─────────────┘
 *
 * Started in dev mode by the simulator so the page looks alive
 * before the real signal bus is wired up. When the real backend
 * arrives, swap `startSwarmSimulator()` for the live event ingestor
 * and nothing else on this page needs to change.
 */

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, Network, Zap } from "lucide-react";
import {
  selectCriticalCount,
  selectTotalEvents24h,
  useSwarmStore,
} from "./swarmStore";
import { AGENTS, type AgentId } from "./agents";
import { SwarmGraph } from "./SwarmGraph";
import { EventBus } from "./EventBus";
import { AgentDetailPanel } from "./AgentDetailPanel";
import { startSwarmSimulator } from "./swarmSimulator";

export function AxonSwarmPage() {
  const [selected, setSelected] = useState<AgentId | null>(null);
  const total24h = useSwarmStore(selectTotalEvents24h);
  const critical = useSwarmStore(selectCriticalCount);
  // Subscribe to bridge count so the header re-renders as new bridges
  // fire and expire. Previously this used `getState()`, which doesn't
  // subscribe — the number was always frozen at 0 after first render.
  const bridgeCount = useSwarmStore((s) => s.bridges.length);

  // Kick off the demo simulator on mount. In production, swap this
  // out for the real backend signal subscription.
  useEffect(() => {
    const stop = startSwarmSimulator();
    return () => stop();
  }, []);

  const liveAgents = AGENTS.filter((a) => a.id !== "os").length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="border-b border-border bg-card/40 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/40 bg-primary/15"
              style={{ boxShadow: "0 0 24px rgba(220, 38, 38, 0.25)" }}
            >
              <Network className="h-[18px] w-[18px] text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-foreground">
                Axon Swarm
              </h1>
              <p className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Mixture of Operators · {liveAgents} active · 1 dormant (OS · Q3 2026)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HeaderStat
              icon={<Activity className="h-3 w-3" />}
              label="events 24h"
              value={total24h.toString()}
              tint="text-emerald-400"
            />
            <HeaderStat
              icon={<AlertTriangle className="h-3 w-3" />}
              label="critical"
              value={critical.toString()}
              tint={critical > 0 ? "text-red-400" : "text-muted-foreground"}
            />
            <HeaderStat
              icon={<Zap className="h-3 w-3" />}
              label="bridges"
              value={bridgeCount.toString()}
              tint="text-amber-400"
            />
          </div>
        </div>
      </header>

      {/* ── Body — graph + detail side-by-side ─────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — swarm graph + event bus */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 overflow-auto">
            <SwarmGraph selectedId={selected} onSelect={setSelected} />

            {/* Helper strip — visible until the user has selected something */}
            {!selected && (
              <div className="mx-6 mb-6 mt-2 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <p className="text-[11.5px] text-foreground">
                  Click any agent to see its capabilities, signal
                  sources, and what it's doing right now. Lines pulse
                  whenever two agents exchange a message.
                </p>
              </div>
            )}
          </div>
          <div className="h-[42%] min-h-[260px] shrink-0">
            <EventBus />
          </div>
        </div>

        {/* Right — agent detail panel (slides in only when selected) */}
        <div
          className={`shrink-0 overflow-hidden transition-[width] duration-200 ${
            selected ? "w-[380px]" : "w-0"
          }`}
        >
          <AnimatePresence mode="wait">
            {selected && (
              <AgentDetailPanel
                key={selected}
                agentId={selected}
                onClose={() => setSelected(null)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function HeaderStat({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1">
      <span className={tint}>{icon}</span>
      <div className="leading-none">
        <div className={`text-[13px] font-semibold tabular-nums ${tint}`}>
          {value}
        </div>
        <div className="font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
