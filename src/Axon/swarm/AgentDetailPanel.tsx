/**
 * AgentDetailPanel — slides in from the right when an agent is selected.
 *
 * Surfaces everything we know about that agent:
 *   · Status + event count + last-seen timestamp
 *   · Plain-language description (so you never forget what an agent does)
 *   · Capability list — each one is what the agent CAN do
 *   · Signal sources — live/stub/planned with status pip
 *   · OS hooks — the forward-looking pieces that wire the agent into
 *     the operator's OS (Q3 2026 milestone)
 *   · Recent events from this agent only (last 30 from the bus)
 *   · Mute toggle so the operator can silence interrupts per agent
 */

import { motion } from "framer-motion";
import {
  X,
  VolumeX,
  Volume2,
  Sparkles,
  Plug,
  Cpu,
  Activity,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useSwarmStore } from "./swarmStore";
import { AGENTS_BY_ID, type AgentId } from "./agents";

interface Props {
  agentId: AgentId;
  onClose: () => void;
}

function timeAgo(ms: number | null): string {
  if (ms == null) return "—";
  const delta = Date.now() - ms;
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return `${Math.floor(delta / 3_600_000)}h ago`;
}

const STATUS_BADGE: Record<string, string> = {
  dormant:   "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
  watching:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  thinking:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
  acting:    "bg-sky-500/15 text-sky-400 border-sky-500/30",
  alerting:  "bg-red-500/15 text-red-400 border-red-500/30",
  error:     "bg-red-500/15 text-red-400 border-red-500/30",
  muted:     "bg-zinc-500/10 text-muted-foreground border-zinc-500/20",
};

const SOURCE_STATUS_DOT: Record<string, string> = {
  live:    "bg-emerald-500",
  stub:    "bg-amber-500",
  planned: "bg-zinc-500/60",
};

export function AgentDetailPanel({ agentId, onClose }: Props) {
  const agent = AGENTS_BY_ID[agentId];
  const state = useSwarmStore((s) => s.agentStates[agentId]);
  // Wrap the derived selector in `useShallow` so equal contents return
  // the cached reference. Without this, `.filter().slice()` produces a
  // new array on every render, which React 19's `useSyncExternalStore`
  // treats as a snapshot mismatch — infinite render loop, page crash.
  const recentEvents = useSwarmStore(
    useShallow((s) =>
      s.events.filter((e) => e.agentId === agentId).slice(0, 30),
    ),
  );
  const toggleMute = useSwarmStore((s) => s.toggleMute);

  const Icon = agent.Icon;
  const isMuted = state.status === "muted";

  return (
    <motion.aside
      key={agentId}
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full w-full flex-col border-l border-border bg-card/40 backdrop-blur"
      style={{
        boxShadow: `inset 5px 0 0 -3px rgba(${agent.color.rgb}, 0.6)`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-border p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
            style={{
              background: `radial-gradient(circle at 30% 25%, rgba(${agent.color.rgb}, 0.30) 0%, rgba(${agent.color.rgb}, 0.10) 100%)`,
              borderColor: `rgba(${agent.color.rgb}, 0.5)`,
              boxShadow: `0 0 22px rgba(${agent.color.rgb}, 0.25)`,
            }}
          >
            <Icon
              className="h-5 w-5"
              strokeWidth={1.5}
              style={{ color: `rgba(${agent.color.rgb}, 1)` }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">
                {agent.name} Axon
              </h2>
              <span
                className={`rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${STATUS_BADGE[state.status] ?? STATUS_BADGE.watching}`}
              >
                {state.status}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">{agent.role}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => toggleMute(agentId)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            title={isMuted ? "Unmute alerts" : "Mute alerts"}
            aria-label="Toggle mute"
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrolling body */}
      <div className="flex-1 overflow-y-auto">
        {/* Status strip — three quick stats */}
        <div className="grid grid-cols-3 gap-px border-b border-border bg-border/40">
          <Stat label="events" value={state.eventCount.toString()} />
          <Stat label="last" value={timeAgo(state.lastEventAt)} />
          <Stat
            label="signal sources"
            value={`${agent.signalSources.filter((s) => s.status === "live").length} / ${agent.signalSources.length}`}
          />
        </div>

        {/* Description */}
        <Section icon={<Sparkles className="h-3 w-3" />} title="What this agent does">
          <p className="text-[12px] leading-relaxed text-foreground/85">
            {agent.description}
          </p>
        </Section>

        {/* Capabilities */}
        <Section
          icon={<Activity className="h-3 w-3" />}
          title={`Capabilities · ${agent.capabilities.length}`}
        >
          <ul className="divide-y divide-border">
            {agent.capabilities.map((cap) => (
              <li key={cap.id} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-foreground">
                    {cap.label}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {cap.id}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                  {cap.description}
                </p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Signal sources */}
        <Section
          icon={<Plug className="h-3 w-3" />}
          title={`Signal sources · ${agent.signalSources.length}`}
        >
          <ul className="space-y-1.5">
            {agent.signalSources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_STATUS_DOT[s.status]}`} />
                  <span className="text-[11.5px] text-foreground">{s.label}</span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {/* OS hooks — forward-looking */}
        {agent.osHooks.length > 0 && (
          <Section
            icon={<Cpu className="h-3 w-3" />}
            title={`OS hooks · ${agent.osHooks.length}`}
          >
            <p className="mb-2 text-[10.5px] text-muted-foreground italic">
              When Takeover ships as an OS layer, this is how this agent
              reaches into Windows / macOS.
            </p>
            <ul className="space-y-1.5">
              {agent.osHooks.map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-2 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_STATUS_DOT[h.status]}`} />
                    <span className="text-[11.5px] text-foreground">{h.label}</span>
                  </div>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    {h.status}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Recent events */}
        <Section
          icon={<Activity className="h-3 w-3" />}
          title={`Recent events · ${recentEvents.length}`}
        >
          {recentEvents.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">
              No events from this agent yet.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {recentEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/30"
                >
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <div className="min-w-0">
                    <div className="truncate text-[11.5px] text-foreground" title={e.message}>
                      {e.message}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                      {timeAgo(e.at)} · {e.capability} · {e.severity}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </motion.aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/60 px-3 py-2">
      <div className="text-[14px] font-semibold tabular-nums text-foreground">
        {value}
      </div>
      <div className="font-mono text-[8.5px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border px-4 py-3.5">
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}
