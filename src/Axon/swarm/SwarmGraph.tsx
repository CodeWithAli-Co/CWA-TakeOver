/**
 * SwarmGraph — the spatial view of all eight Axons.
 *
 * Lays the orbs out in a 4×2 grid and renders an SVG overlay drawing
 * pulsing dashed edges whenever two agents exchange a bridge message.
 * Edges are computed from the live store and disappear on their own
 * after the bridge TTL expires.
 *
 * The svg layer is `pointer-events-none` so it never intercepts orb
 * clicks. Positions are computed from grid cell centres after the
 * orbs mount (via a ref map) so the lines remain accurate at any
 * layout width.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AGENTS, AGENTS_BY_ID, type AgentId } from "./agents";
import { AxonOrb } from "./AxonOrb";
import { useSwarmStore } from "./swarmStore";

interface Props {
  selectedId: AgentId | null;
  onSelect: (id: AgentId) => void;
}

interface OrbCenter {
  x: number;
  y: number;
}

export function SwarmGraph({ selectedId, onSelect }: Props) {
  const bridges = useSwarmStore((s) => s.bridges);

  // Container ref so we can measure once on resize.
  const containerRef = useRef<HTMLDivElement>(null);
  const orbRefs = useRef(
    new Map<AgentId, HTMLDivElement | null>(),
  );
  const [centers, setCenters] = useState<Record<AgentId, OrbCenter>>(
    () => ({}) as Record<AgentId, OrbCenter>,
  );

  // Recompute orb centers on mount and on container resize.
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const recompute = () => {
      const containerBox = container.getBoundingClientRect();
      const next: Record<AgentId, OrbCenter> = {} as Record<AgentId, OrbCenter>;
      orbRefs.current.forEach((el, id) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        next[id] = {
          x: r.left + r.width / 2 - containerBox.left,
          y: r.top + r.height / 2 - containerBox.top,
        };
      });
      setCenters(next);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(container);
    window.addEventListener("scroll", recompute, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", recompute, true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative grid grid-cols-2 gap-y-10 gap-x-6 px-6 py-10 sm:grid-cols-4 sm:gap-x-12 sm:gap-y-14"
    >
      {/* SVG overlay — sized to fill the container exactly. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <AnimatePresence>
          {bridges.map((b) => {
            const a = centers[b.from];
            const c = centers[b.to];
            if (!a || !c) return null;
            const fromAgent = AGENTS_BY_ID[b.from];
            const toAgent = AGENTS_BY_ID[b.to];
            // Pick a gradient blending the two agents' colours.
            const gradId = `bridge-${b.id}`;
            const midX = (a.x + c.x) / 2;
            const midY = (a.y + c.y) / 2;
            return (
              <motion.g
                key={b.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <defs>
                  <linearGradient id={gradId} gradientUnits="userSpaceOnUse"
                    x1={a.x} y1={a.y} x2={c.x} y2={c.y}>
                    <stop offset="0%"
                      stopColor={`rgba(${fromAgent.color.rgb}, 0.9)`} />
                    <stop offset="100%"
                      stopColor={`rgba(${toAgent.color.rgb}, 0.9)`} />
                  </linearGradient>
                </defs>
                <motion.line
                  x1={a.x} y1={a.y} x2={c.x} y2={c.y}
                  stroke={`url(#${gradId})`}
                  strokeWidth={1.5}
                  strokeDasharray="4 6"
                  initial={{ strokeDashoffset: 60 }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 1.6, ease: "linear", repeat: Infinity }}
                  style={{ opacity: 0.85 }}
                />
                {b.label && (
                  <motion.text
                    x={midX}
                    y={midY - 6}
                    textAnchor="middle"
                    initial={{ opacity: 0, y: midY }}
                    animate={{ opacity: 1, y: midY - 6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="fill-foreground font-mono"
                    style={{ fontSize: 9.5, letterSpacing: 0.5 }}
                  >
                    {b.label}
                  </motion.text>
                )}
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>

      {AGENTS.map((agent) => (
        <div
          key={agent.id}
          ref={(el) => {
            orbRefs.current.set(agent.id, el);
          }}
          className="relative flex justify-center"
        >
          <AxonOrb
            agent={agent}
            selected={selectedId === agent.id}
            onSelect={() => onSelect(agent.id)}
          />
        </div>
      ))}
    </div>
  );
}
