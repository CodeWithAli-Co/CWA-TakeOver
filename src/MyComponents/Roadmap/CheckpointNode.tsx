import { motion } from "framer-motion";
import { useState } from "react";
import { NODE_H, NODE_W } from "./lib/constants";
import { LANE_ACCENT } from "./lib/colors";
import type { Checkpoint, RoadmapProfile } from "./lib/types";
import type { NodePosition } from "./lib/layout";
import { HoverCard } from "./HoverCard";
import { daysRemaining } from "./lib/status";

interface Props {
  cp: Checkpoint;
  pos: NodePosition;
  author: RoadmapProfile;
  owner?: RoadmapProfile;
  selected?: boolean;
  dimmed?: boolean;
  onSelect?: (cp: Checkpoint) => void;
}

/**
 * Modern DAG node card — 264×104. Visual language mirrors the app's
 * existing BentoCard: `bg-card border-border rounded-lg`, subtle hover
 * lift, lane accent used as a decorative tint not a blunt stripe.
 *
 * Layout inside the card:
 *
 *   ┌──────────────────────────────────────────┐
 *   │  ● FUNDRAISING            ◉ (owner AL)   │   ← lane badge + avatar
 *   │                                           │
 *   │  Y Combinator application                 │   ← title 13px
 *   │  Learn investor talk, cut 60s script…     │   ← desc 11px muted
 *   │                                           │
 *   │  ● in progress · 16d left   ███▁▁▁ 0/1   │   ← status + metric
 *   └──────────────────────────────────────────┘
 */
export function CheckpointNode({
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
  const pending = cp.approvalStatus === "pending";
  const completed = cp.status === "completed";
  const atRisk = cp.status === "at_risk";
  const inProgress = cp.status === "in_progress";

  const statusTone = completed
    ? "hsl(220 6% 55%)"
    : atRisk
      ? "hsl(14 85% 62%)"
      : inProgress
        ? accent
        : "hsl(220 8% 50%)";

  const statusText = completed
    ? "Shipped"
    : atRisk
      ? "At risk"
      : inProgress
        ? `${Math.max(0, daysRemaining(cp))}d left`
        : "Upcoming";

  // Card background gradient: card surface with a whisper of lane accent
  // from the top-left corner. Keeps the card firmly in "card" territory but
  // adds a modern tint so every node feels alive.
  const cardBg = completed
    ? "hsl(var(--card))"
    : `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, hsl(var(--card))) 0%, hsl(var(--card)) 55%)`;

  const borderColor = selected
    ? accent
    : pending
      ? author.authorColor
      : hover
        ? "hsl(var(--foreground) / 0.25)"
        : "hsl(var(--border))";

  const metricPct =
    cp.metricTarget != null && cp.metricTarget > 0 && cp.metricCurrent != null
      ? Math.min(100, (cp.metricCurrent / cp.metricTarget) * 100)
      : null;

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
        y: hover || selected ? -2 : 0,
        opacity: dimmed ? 0.22 : 1,
      }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{ cursor: "pointer" }}
    >
      <foreignObject
        x={pos.x}
        y={pos.y}
        width={NODE_W}
        height={NODE_H}
        style={{ overflow: "visible" }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-xl"
          style={{
            background: cardBg,
            boxShadow: selected
              ? `0 0 0 1px ${accent}, 0 10px 28px -8px rgba(0,0,0,0.6)`
              : hover
                ? `0 0 0 1px ${borderColor}, 0 10px 24px -10px rgba(0,0,0,0.55)`
                : `0 0 0 1px ${borderColor}`,
            opacity: completed ? 0.82 : 1,
          }}
        >
          {/* Pending dashed halo */}
          {pending && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-xl"
              style={{
                background:
                  "repeating-linear-gradient(45deg, transparent 0 6px, color-mix(in srgb, currentColor 6%, transparent) 6px 8px)",
                color: author.authorColor,
              }}
            />
          )}

          <div className="flex h-full flex-col gap-1.5 p-3">
            {/* Top row — lane chip + owner avatar */}
            <div className="flex items-center justify-between gap-2">
              <div
                className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.12em]"
                style={{
                  background: `color-mix(in srgb, ${accent} 18%, transparent)`,
                  color: accent,
                }}
              >
                <span
                  aria-hidden
                  className="inline-block size-[5px] rounded-full"
                  style={{ background: accent }}
                />
                {laneLabel(cp.laneId)}
              </div>
              <OwnerAvatar person={owner ?? author} />
            </div>

            {/* Title + description */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <div
                className="truncate text-[12.5px] font-semibold leading-snug"
                style={{
                  color: completed
                    ? "hsl(var(--muted-foreground))"
                    : "hsl(var(--foreground))",
                }}
                title={cp.title}
              >
                {cp.title}
              </div>
              {cp.description && (
                <div
                  className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground"
                  title={cp.description}
                >
                  {cp.description}
                </div>
              )}
            </div>

            {/* Bottom row — status + metric */}
            <div className="flex items-center gap-2 text-[9.5px] font-mono uppercase tracking-[0.1em]">
              <span
                aria-hidden
                className="inline-block size-[6px] rounded-full"
                style={{ background: statusTone }}
              />
              <span style={{ color: "hsl(var(--muted-foreground))" }}>
                {statusText}
              </span>
              {metricPct != null && (
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="h-[3px] w-10 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full"
                      style={{ width: `${metricPct}%`, background: accent }}
                    />
                  </div>
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    {cp.metricCurrent}/{cp.metricTarget}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </foreignObject>

      {/* Hover card — floats above */}
      {hover && !selected && (
        <foreignObject
          x={pos.x - 10}
          y={pos.y - 178}
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

// ---------- helpers -------------------------------------------------------

function OwnerAvatar({ person }: { person: RoadmapProfile }) {
  const initials = person.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]!)
    .join("")
    .toUpperCase();
  return (
    <div
      className="flex size-5 items-center justify-center rounded-full text-[9px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${person.authorColor} 22%, hsl(var(--background)))`,
        color: person.authorColor,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${person.authorColor} 45%, transparent)`,
      }}
      title={person.displayName}
    >
      {initials}
    </div>
  );
}

function laneLabel(id: Checkpoint["laneId"]): string {
  switch (id) {
    case "fundraising":
      return "Fundraising";
    case "codewithali":
      return "CWA";
    case "simplicity":
      return "Simplicity";
    case "takeover":
      return "Takeover";
    case "brand":
      return "Brand";
    case "ops":
      return "Ops";
    default:
      return "";
  }
}
