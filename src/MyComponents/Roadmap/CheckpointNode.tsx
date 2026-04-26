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
 * Code-window / terminal node — 296×112.
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ ●●●  ~/fundraising/yc.md            FUND-04    │  ← titlebar
 *   ├────────────────────────────────────────────────┤
 *   │  $ Y Combinator application                     │  ← title with prompt
 *   │  ● active · 16d · 0/1                           │  ← meta line
 *   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 0%           │  ← progress
 *   └────────────────────────────────────────────────┘
 *
 * Each ticket reads as a tiny editor / terminal window — matches the
 * CWA Manager brand language (CLI-tech-red), and feels radically
 * different from the bento-tile / Linear-card patterns. The titlebar
 * has macOS-style traffic light dots, a faux file path, and the
 * shortcode (FUND-04 etc) flush right. The body is full mono with a
 * `$` prompt before the title.
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

  // ── Status visuals ───────────────────────────────────────────────
  const statusColor = completed
    ? "hsl(150 60% 55%)"           // emerald — shipped
    : atRisk
      ? "hsl(14 85% 62%)"           // rose — at risk
      : inProgress
        ? accent                     // lane color — active
        : "hsl(220 8% 55%)";         // muted — upcoming

  const statusLabel = completed
    ? "shipped"
    : atRisk
      ? "at-risk"
      : inProgress
        ? "active"
        : "upcoming";

  const daysLabel =
    inProgress || atRisk ? `${Math.max(0, daysRemaining(cp))}d` : null;

  const metricPct =
    cp.metricTarget != null && cp.metricTarget > 0 && cp.metricCurrent != null
      ? Math.min(100, (cp.metricCurrent / cp.metricTarget) * 100)
      : null;

  // ── Faux file path for the titlebar ──────────────────────────────
  // Slug the title to a kebab filename. Uses the lane id as the
  // folder so the path reads "fundraising/yc-application.md".
  const filename = (() => {
    const slug = (cp.title || "untitled")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .split("-")
      .slice(0, 4)
      .join("-")
      .slice(0, 28);
    return `~/${cp.laneId}/${slug || "untitled"}.md`;
  })();

  // ── Window chrome colors ─────────────────────────────────────────
  const windowBg = completed
    ? "color-mix(in srgb, hsl(var(--card)) 92%, hsl(var(--foreground)) 6%)"
    : "hsl(var(--card))";

  const titlebarBg = `linear-gradient(
    180deg,
    color-mix(in srgb, ${accent} 14%, hsl(var(--card))) 0%,
    color-mix(in srgb, ${accent} 6%, hsl(var(--card))) 100%
  )`;

  const borderColor = selected
    ? accent
    : pending
      ? author.authorColor
      : hover
        ? "hsl(var(--foreground) / 0.22)"
        : "hsl(var(--border) / 0.85)";

  const shadow = selected
    ? `0 0 0 1.5px ${accent}, 0 0 32px -8px ${accent}, 0 14px 32px -10px rgba(0,0,0,0.55)`
    : hover
      ? `0 0 0 1px ${borderColor}, 0 12px 28px -12px rgba(0,0,0,0.5)`
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
          className="relative h-full w-full overflow-hidden rounded-lg"
          style={{
            background: windowBg,
            boxShadow: shadow,
            opacity: completed ? 0.88 : 1,
          }}
        >
          {/* ── Titlebar ─────────────────────────────────────────── */}
          <div
            className="flex h-[26px] items-center gap-2 border-b px-2.5"
            style={{
              background: titlebarBg,
              borderColor: "hsl(var(--border) / 0.5)",
            }}
          >
            {/* Traffic lights — pure decoration, signals "this is a
                window". Pending approval flips one to a softer dot
                (like an unsaved-changes indicator) instead of the
                green close button. */}
            <div className="flex shrink-0 items-center gap-1">
              <span
                className="block size-[8px] rounded-full"
                style={{
                  background: "hsl(354 70% 60%)",
                  boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)",
                }}
              />
              <span
                className="block size-[8px] rounded-full"
                style={{
                  background: pending ? author.authorColor : "hsl(42 95% 60%)",
                  boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)",
                }}
                title={pending ? "Awaiting approval" : undefined}
              />
              <span
                className="block size-[8px] rounded-full"
                style={{
                  background: completed
                    ? "hsl(150 60% 55%)"
                    : "hsl(150 30% 35%)",
                  boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)",
                }}
              />
            </div>

            {/* Filename — mono, muted, truncates */}
            <span
              className="min-w-0 flex-1 truncate text-center font-mono text-[10.5px] text-muted-foreground"
              title={filename}
            >
              {filename}
            </span>

            {/* Shortcode flush right */}
            <span
              className="shrink-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: accent }}
            >
              {cp.shortCode || cp.laneId.slice(0, 4).toUpperCase()}
            </span>
          </div>

          {/* ── Body ─────────────────────────────────────────────── */}
          <div className="flex h-[calc(100%-26px)] flex-col justify-center gap-1 px-3 py-2">
            {/* Line 1 — title with prompt sigil */}
            <div className="flex min-w-0 items-baseline gap-1.5 font-mono">
              <span
                className="shrink-0 text-[12px] font-semibold"
                style={{ color: accent }}
                aria-hidden
              >
                $
              </span>
              <span
                className="min-w-0 truncate text-[12.5px] font-semibold"
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
            </div>

            {/* Line 2 — status · days · metric */}
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span
                aria-hidden
                className="inline-block size-[6px] rounded-full"
                style={{
                  background: statusColor,
                  boxShadow:
                    inProgress || atRisk
                      ? `0 0 6px ${statusColor}`
                      : undefined,
                }}
              />
              <span style={{ color: statusColor }}>{statusLabel}</span>
              {daysLabel && (
                <>
                  <span className="opacity-30">·</span>
                  <span
                    className="tabular-nums"
                    style={{
                      color: atRisk ? "hsl(14 85% 62%)" : undefined,
                    }}
                  >
                    {daysLabel}
                  </span>
                </>
              )}
              {cp.metricTarget != null && cp.metricCurrent != null && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="tabular-nums">
                    {cp.metricCurrent}/{cp.metricTarget}
                  </span>
                </>
              )}
              <div className="ml-auto">
                <OwnerAvatar person={owner ?? author} />
              </div>
            </div>

            {/* Line 3 — progress bar */}
            <div className="flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-border/50">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width:
                      metricPct != null
                        ? `${metricPct}%`
                        : completed
                          ? "100%"
                          : inProgress
                            ? "50%"
                            : atRisk
                              ? "30%"
                              : "0%",
                    background: completed ? "hsl(150 60% 55%)" : statusColor,
                    boxShadow:
                      inProgress || atRisk
                        ? `0 0 8px ${statusColor}`
                        : undefined,
                  }}
                />
              </div>
              <span className="font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
                {metricPct != null
                  ? `${Math.round(metricPct)}%`
                  : completed
                    ? "100%"
                    : inProgress
                      ? "~50%"
                      : "—"}
              </span>
            </div>
          </div>

          {/* Pending dashed halo — overlay on top of everything */}
          {pending && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                background:
                  "repeating-linear-gradient(45deg, transparent 0 6px, color-mix(in srgb, currentColor 6%, transparent) 6px 8px)",
                color: author.authorColor,
              }}
            />
          )}

          {/* Selected glow ring */}
          {selected && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-lg"
              style={{
                boxShadow: `inset 0 0 0 1px ${accent}, inset 0 0 20px -8px ${accent}`,
              }}
            />
          )}
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
      className="flex size-4 items-center justify-center rounded-full text-[8.5px] font-semibold"
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
