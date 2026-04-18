import type { Lane } from "./lib/types";

interface Props {
  lanes: Lane[];
}

/**
 * Small overlay that maps lane accent → company. Sits top-left of the canvas
 * and doesn't move with pan/scroll.
 */
export function LaneLegend({ lanes }: Props) {
  return (
    <aside
      aria-label="Lane legend"
      className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-border bg-card/85 p-2.5 backdrop-blur-md"
    >
      <header className="mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        Lanes
      </header>
      <ul className="flex flex-col gap-1">
        {lanes.map((lane) => (
          <li key={lane.id} className="flex items-center gap-2 text-[11px]">
            <span
              aria-hidden
              className="inline-block size-2 shrink-0 rounded-sm"
              style={{ background: `hsl(${lane.accentHsl})` }}
            />
            <span className="truncate text-foreground">{lane.title}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
