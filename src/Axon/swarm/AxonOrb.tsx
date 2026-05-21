/**
 * AxonOrb — one agent's floating orb in the swarm view.
 *
 * Each orb is its own visual organism:
 *   · Color-tinted radial glow keyed off `agent.color`
 *   · Breathing animation at `agent.pulseSeconds` cadence — every
 *     agent has its own rhythm so the swarm reads as 8 individuals
 *     not 8 copies
 *   · Status-driven overlays: extra ring when alerting, dimmed when
 *     dormant, red shake when error, opacity-only when muted
 *   · Click to open the agent detail panel
 *
 * The orb is intentionally heavy on motion — that's the whole point
 * of this page. Each orb costs ~3 motion targets which the framer
 * compositor handles fine at 8 simultaneous orbs.
 */

import { motion } from "framer-motion";
import { useSwarmStore } from "./swarmStore";
import type { AxonAgent } from "./agents";

interface Props {
  agent: AxonAgent;
  selected: boolean;
  onSelect: () => void;
}

export function AxonOrb({ agent, selected, onSelect }: Props) {
  const status = useSwarmStore((s) => s.agentStates[agent.id].status);
  const eventCount = useSwarmStore((s) => s.agentStates[agent.id].eventCount);

  // Status → motion profile. Same agent, different vibe per state.
  const profile = STATUS_PROFILE[status];
  const Icon = agent.Icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group relative flex flex-col items-center gap-2 outline-none"
      aria-label={`${agent.name} agent · ${status}`}
    >
      {/* Selection ring — drawn outside the orb so it's never clipped */}
      {selected && (
        <motion.span
          className="absolute -inset-2 rounded-2xl"
          style={{
            border: `1.5px solid rgba(${agent.color.rgb}, 0.65)`,
            boxShadow: `0 0 0 4px rgba(${agent.color.rgb}, 0.10)`,
          }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.18 }}
        />
      )}

      {/* The orb body — breathing scale + color glow */}
      <motion.div
        className="relative flex h-24 w-24 items-center justify-center rounded-2xl border"
        style={{
          background: `radial-gradient(circle at 30% 25%, rgba(${agent.color.rgb}, ${profile.coreA}) 0%, rgba(${agent.color.rgb}, ${profile.coreB}) 45%, rgba(${agent.color.rgb}, 0.04) 100%)`,
          borderColor: `rgba(${agent.color.rgb}, ${profile.borderAlpha})`,
          boxShadow: `0 0 ${profile.glowPx}px rgba(${agent.color.rgb}, ${profile.glowAlpha}), inset 0 0 12px rgba(${agent.color.rgb}, 0.08)`,
          opacity: profile.opacity,
        }}
        animate={{
          scale: profile.scale,
          ...(profile.shake ? { x: [0, -2, 2, -2, 2, 0] } : {}),
        }}
        transition={{
          scale: {
            duration: agent.pulseSeconds * profile.speedMul,
            repeat: Infinity,
            ease: "easeInOut",
          },
          ...(profile.shake
            ? { x: { duration: 0.4, repeat: Infinity, repeatDelay: 1.6 } }
            : {}),
        }}
      >
        {/* Inner glyph */}
        <Icon
          className="h-9 w-9"
          style={{ color: `rgba(${agent.color.rgb}, ${profile.iconAlpha})` }}
          strokeWidth={1.5}
        />

        {/* Status dot — top-right */}
        <span
          className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5 items-center justify-center"
          aria-hidden
        >
          <span
            className="absolute inset-0 rounded-full"
            style={{ background: profile.dot }}
          />
          {(status === "thinking" ||
            status === "alerting" ||
            status === "acting") && (
            <span
              className="absolute inset-0 animate-ping rounded-full"
              style={{ background: profile.dot, opacity: 0.55 }}
            />
          )}
        </span>

        {/* Event count badge — bottom-left, only when > 0 */}
        {eventCount > 0 && (
          <span
            className="absolute bottom-1.5 left-1.5 rounded-md px-1 py-0.5 font-mono text-[8.5px] font-semibold tabular-nums"
            style={{
              background: `rgba(${agent.color.rgb}, 0.18)`,
              color: `rgba(${agent.color.rgb}, 0.95)`,
            }}
          >
            {eventCount > 999 ? "999+" : eventCount}
          </span>
        )}
      </motion.div>

      {/* Label */}
      <div className="flex flex-col items-center">
        <div className="text-[12px] font-semibold tracking-tight text-foreground">
          {agent.name}
        </div>
        <div
          className="font-mono text-[8.5px] uppercase tracking-widest"
          style={{ color: `rgba(${agent.color.rgb}, 0.85)` }}
        >
          {status}
        </div>
      </div>
    </button>
  );
}

interface StatusProfile {
  /** Centre-of-orb alpha. */
  coreA: number;
  /** Mid-orb alpha. */
  coreB: number;
  /** Border-stroke alpha. */
  borderAlpha: number;
  /** Outer-glow radius in px. */
  glowPx: number;
  /** Outer-glow alpha. */
  glowAlpha: number;
  /** Icon alpha. */
  iconAlpha: number;
  /** Overall orb opacity (mute / dormant pull this down). */
  opacity: number;
  /** Status-dot color (CSS). */
  dot: string;
  /** Scale animation keyframes. */
  scale: [number, number, number];
  /** Speed multiplier on the breathing cycle (lower = faster). */
  speedMul: number;
  /** Whether the orb visibly shakes (used by `error`). */
  shake: boolean;
}

const STATUS_PROFILE: Record<string, StatusProfile> = {
  dormant: {
    coreA: 0.10, coreB: 0.05, borderAlpha: 0.20,
    glowPx: 4, glowAlpha: 0.05,
    iconAlpha: 0.55, opacity: 0.55,
    dot: "rgba(150,150,160,0.5)",
    scale: [1, 1.005, 1], speedMul: 1.6, shake: false,
  },
  watching: {
    coreA: 0.22, coreB: 0.10, borderAlpha: 0.40,
    glowPx: 18, glowAlpha: 0.18,
    iconAlpha: 0.85, opacity: 1,
    dot: "rgba(34,197,94,0.8)",
    scale: [1, 1.02, 1], speedMul: 1, shake: false,
  },
  thinking: {
    coreA: 0.30, coreB: 0.14, borderAlpha: 0.55,
    glowPx: 28, glowAlpha: 0.30,
    iconAlpha: 0.95, opacity: 1,
    dot: "rgba(245,158,11,0.85)",
    scale: [1, 1.04, 1], speedMul: 0.55, shake: false,
  },
  acting: {
    coreA: 0.38, coreB: 0.18, borderAlpha: 0.70,
    glowPx: 36, glowAlpha: 0.40,
    iconAlpha: 1, opacity: 1,
    dot: "rgba(14,165,233,0.95)",
    scale: [1, 1.06, 1], speedMul: 0.35, shake: false,
  },
  alerting: {
    coreA: 0.45, coreB: 0.22, borderAlpha: 0.80,
    glowPx: 48, glowAlpha: 0.55,
    iconAlpha: 1, opacity: 1,
    dot: "rgba(239,68,68,0.95)",
    scale: [1, 1.08, 1], speedMul: 0.30, shake: false,
  },
  error: {
    coreA: 0.20, coreB: 0.08, borderAlpha: 0.55,
    glowPx: 12, glowAlpha: 0.12,
    iconAlpha: 0.75, opacity: 0.9,
    dot: "rgba(239,68,68,0.95)",
    scale: [1, 1.01, 1], speedMul: 1.2, shake: true,
  },
  muted: {
    coreA: 0.10, coreB: 0.04, borderAlpha: 0.25,
    glowPx: 0, glowAlpha: 0,
    iconAlpha: 0.45, opacity: 0.40,
    dot: "rgba(120,120,130,0.5)",
    scale: [1, 1.005, 1], speedMul: 1.8, shake: false,
  },
};
