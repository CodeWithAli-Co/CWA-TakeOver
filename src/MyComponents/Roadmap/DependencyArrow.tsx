import type { Checkpoint } from "./lib/types";
import type { NodePosition } from "./lib/layout";
import { nodeAnchors } from "./lib/layout";
import { LANE_ACCENT } from "./lib/colors";

interface Props {
  from: Checkpoint;
  fromPos: NodePosition;
  toPos: NodePosition;
  /** true = lineage-focus mode has another node selected and this edge is
   *  not in the lineage → fade almost entirely. */
  dimmed?: boolean;
  /** true = edge is highlighted as part of the selected-node lineage. */
  highlighted?: boolean;
}

/**
 * Curved edge from upstream's right anchor to downstream's left anchor.
 * Bezier control points bend horizontally for clean flow, even when the
 * endpoints are far apart vertically.
 */
export function DependencyArrow({
  from,
  fromPos,
  toPos,
  dimmed,
  highlighted,
}: Props) {
  const a = nodeAnchors(fromPos).right;
  const b = nodeAnchors(toPos).left;
  const bend = Math.max(32, (b.x - a.x) * 0.5);
  const d = `M ${a.x},${a.y} C ${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`;

  const accent = `hsl(${LANE_ACCENT[from.laneId]})`;
  const completed = from.status === "completed";
  const active = from.status === "in_progress";

  const stroke = completed || active ? accent : "hsl(var(--muted-foreground))";

  const baseOpacity = completed ? 0.5 : active ? 0.7 : 0.2;
  const opacity = highlighted
    ? Math.min(1, baseOpacity + 0.35)
    : dimmed
      ? 0.08
      : baseOpacity;
  const strokeWidth = highlighted ? 1.5 : 1;

  return (
    <g aria-hidden>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
      />
      <path
        d={`M ${b.x - 5},${b.y - 3.5} L ${b.x},${b.y} L ${b.x - 5},${b.y + 3.5}`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={Math.min(1, opacity + 0.15)}
      />
    </g>
  );
}
