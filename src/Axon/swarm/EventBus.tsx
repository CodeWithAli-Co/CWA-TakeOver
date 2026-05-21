/**
 * EventBus — the live log of every signal flowing through the swarm.
 *
 * Renders newest-first, color-codes each row by the source agent's
 * palette, and offers a one-click filter to show events from a
 * single agent. The whole strip is scroll-locked to the bottom of
 * the page; the actual list scrolls within its own container so the
 * user can pause-and-read without losing the rest of the layout.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, ListFilter, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useSwarmStore, type SwarmEvent } from "./swarmStore";
import { AGENTS_BY_ID, type AgentId } from "./agents";

const SEVERITY_ICON = {
  info: Info,
  warn: AlertTriangle,
  critical: AlertCircle,
} as const;

function timeAgo(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
}

export function EventBus() {
  const events = useSwarmStore((s) => s.events);
  const clearEvents = useSwarmStore((s) => s.clearEvents);
  const [filter, setFilter] = useState<AgentId | null>(null);

  const filtered: SwarmEvent[] = useMemo(
    () => (filter ? events.filter((e) => e.agentId === filter) : events),
    [events, filter],
  );

  return (
    <div className="flex h-full flex-col border-t border-border bg-card/40 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
            Live Event Bus
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
            · {events.length} buffered
            {filter && ` · filter: ${AGENTS_BY_ID[filter].name}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilter(null)}
            disabled={!filter}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
            title="Clear filter"
          >
            <ListFilter className="h-3 w-3" />
            All
          </button>
          <button
            type="button"
            onClick={clearEvents}
            disabled={events.length === 0}
            className="flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
            title="Clear event buffer"
          >
            <Trash2 className="h-3 w-3" />
            Clear
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
            no events {filter ? `from ${AGENTS_BY_ID[filter].name}` : "yet"}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((e) => (
              <EventRow key={e.id} event={e} onClickAgent={setFilter} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  event: SwarmEvent;
  onClickAgent: (id: AgentId) => void;
}

function EventRow({ event, onClickAgent }: RowProps) {
  const agent = AGENTS_BY_ID[event.agentId];
  const Icon = SEVERITY_ICON[event.severity];
  const sevTint =
    event.severity === "critical"
      ? "text-red-500"
      : event.severity === "warn"
      ? "text-amber-500"
      : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="grid items-center gap-3 border-b border-border/40 px-4 py-1.5"
      style={{ gridTemplateColumns: "64px 16px 110px 1fr 90px" }}
    >
      <span className="font-mono text-[9.5px] text-muted-foreground tabular-nums">
        {timeAgo(event.at)}
      </span>
      <Icon className={`h-3 w-3 ${sevTint}`} />
      <button
        type="button"
        onClick={() => onClickAgent(event.agentId)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-widest hover:bg-muted/40"
        style={{ color: `rgba(${agent.color.rgb}, 1)` }}
        title={`Filter to ${agent.name} only`}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: `rgba(${agent.color.rgb}, 0.95)` }}
        />
        {agent.name}
      </button>
      <div className="truncate text-[11.5px] text-foreground" title={event.message}>
        {event.message}
      </div>
      <div className="text-right font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {event.capability}
      </div>
    </motion.div>
  );
}
