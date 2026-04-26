import { motion } from "framer-motion";
import { useState } from "react";
import { Check, AlertTriangle, Loader2, Hourglass } from "lucide-react";
import { LANE_ACCENT } from "./lib/colors";
import type { Checkpoint, RoadmapProfile } from "./lib/types";
import type { RadialPosition } from "./lib/radialLayout";
import { HoverCard } from "./HoverCard";
import { daysRemaining } from "./lib/status";

interface Props {
  cp: Checkpoint;
  pos: RadialPosition;
  author: RoadmapProfile;
  owner?: RoadmapProfile;
  selected?: boolean;
  dimmed?: boolean;
  onSelect?: (cp: Checkpoint) => void;
}

/**
 * Compact orbital node — 168×52.
 *
 * Used in the radial / orbit roadmap view. Rectangular pill with a
 * leading status orb and a single-line title. Sized small so dozens
 * can orbit without overlapping. The detailed code-window aesthetic
 * lives in HoverCard for when the operator wants more depth.
 *
 *   ┌──────────────────────────────────────────┐
 *   │  ◉   Y Combinator application    16d  AL │
 *   └──────────────────────────────────────────┘
 */
export function RadialNode({
  cp,
  pos,
  author,
  owner,
  selected,
  dimmed,
  onSelect,
}: Props) {
  const [hover, setHover] = useState(false);
  const accent = `hsl(${LANE_ACCENT[cp.laneId]})`;
  const completed = cp.status === "completed";
  const atRisk = cp.status === "at_risk";
  const inProgress = cp.status === "in_progress";
  const pending = cp.approvalStatus === "pending";

  const statusColor = completed
    ? "hsl(150 60% 55%)"
    : atRisk
      ? "hsl(14 85% 62%)"
      : inProgress
        ? accent
        : "hsl(220 8% 55%)";

  const StatusIcon = completed
    ? Check
    : atRisk
      ? AlertTriangle
      : inProgress
        ? Loader2
        : Hourglass;

  const days =
    inProgress || atRisk ? `${Math.max(0, daysRemaining(cp))}d` : null;

  const NW = 168;
  const NH = 52;

  const cardBg = completed
    ? "color-mix(in srgb, hsl(var(--card)) 92%, hsl(var(--foreground)) 6%)"
    : `linear-gradient(135deg,
         color-mix(in srgb, ${accent} 14%, hsl(var(--card))) 0%,
         hsl(var(--card)) 75%)`;

  const borderColor = selected
    ? accent
    : pending
      ? author.authorColor
      : hover
        ? "hsl(var(--foreground) / 0.22)"
        : "hsl(var(--border) / 0.85)";

  const shadow = selected
    ? `0 0 0 1.5px ${accent}, 0 0 32px -6px ${accent}, 0 12px 28px -10px rgba(0,0,0,0.55)`
    : hover
      ? `0 0 0 1px ${borderColor}, 0 10px 24px -10px rgba(0,0,0,0.5)`
      : `0 0 0 1px ${borderColor}, 0 1px 2px rgba(0,0,0,0.18)`;

  return (
    <motion.g
      role="button"
      tabIndex={0}
      aria-label={`${cp.title} — ${cp.status}`}
      aria-pressed={selected}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(cp);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(cp);
        }
      }}
      initial={false}
      animate={{
        opacity: dimmed ? 0.18 : 1,
      }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ cursor: "pointer" }}
    >
      <foreignObject
        x={pos.x - NW / 2}
        y={pos.y - NH / 2}
        width={NW}
        height={NH}
        style={{ overflow: "visible" }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-full"
          style={{
            background: cardBg,
            boxShadow: shadow,
            opacity: completed ? 0.86 : 1,
          }}
        >
          <div className="flex h-full items-center gap-2 px-2.5">
            {/* Status orb */}
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${statusColor} 16%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${statusColor} 40%, transparent)`,
              }}
            >
              <StatusIcon
                className={`size-3.5 ${inProgress ? "animate-spin-slow" : ""}`}
                style={{ color: statusColor }}
                strokeWidth={2.5}
              />
            </div>

            {/* Title — single line, mono-ish weight */}
            <span
              className="min-w-0 flex-1 truncate text-[11.5px] font-semibold leading-tight"
              style={{
                color: completed
                  ? "hsl(var(--muted-foreground))"
                  : "hsl(var(--foreground))",
                letterSpacing: "-0.005em",
                textDecoration: completed ? "line-through" : undefined,
                textDecorationColor: completed
                  ? "hsl(var(--muted-foreground) / 0.4)"
                  : undefined,
              }}
              title={cp.title}
            >
              {cp.title}
            </span>

            {/* Days pill (active / at-risk only) */}
            {days && (
              <span
                className="shrink-0 font-mono text-[9.5px] font-semibold tabular-nums"
                style={{
                  color: atRisk ? "hsl(14 85% 62%)" : "hsl(var(--muted-foreground))",
                }}
              >
                {days}
              </span>
            )}

            {/* Owner avatar */}
            <OwnerAvatar person={owner ?? author} />
          </div>

          {/* Pending dashed halo */}
          {pending && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background:
                  "repeating-linear-gradient(45deg, transparent 0 6px, color-mix(in srgb, currentColor 6%, transparent) 6px 8px)",
                color: author.authorColor,
              }}
            />
          )}
        </div>
      </foreignObject>

      {hover && !selected && (
        <foreignObject
          x={pos.x - 180}
          y={pos.y - 188}
          width={360}
          height={172}
          style={{ overflow: "visible" }}
        >
          <HoverCard cp={cp} author={author} owner={owner} />
        </foreignObject>
      )}
    </motion.g>
  );
}

function OwnerAvatar({ person }: { person: RoadmapProfile }) {
  const initials = person.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!)
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${person.authorColor} 22%, hsl(var(--background)))`,
        color: person.authorColor,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${person.authorColor} 50%, transparent)`,
      }}
      title={person.displayName}
    >
      {initials}
    </div>
  );
}
