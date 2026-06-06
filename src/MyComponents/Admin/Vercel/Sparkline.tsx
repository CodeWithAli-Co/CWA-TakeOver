/**
 * Sparkline.tsx — Tiny inline trend chart.
 *
 * Pure SVG, no chart library. Designed to live inside KPI cards
 * without dominating them. Accepts a numeric series and renders a
 * line + filled area; optional dot on the last point.
 *
 * Sizing is fixed via props (default 80x24) so the parent layout
 * doesn't reflow when values change. Color is `currentColor` so it
 * inherits the parent tone class (lets a "warning" KPI render its
 * sparkline in warning yellow without extra wiring).
 */

import { useMemo } from "react";

interface SparklineProps {
  /** Series of numbers, oldest first. */
  values: number[];
  width?: number;
  height?: number;
  /** Show a dot on the latest point. Default true. */
  showLastDot?: boolean;
  /** Stroke width in px. Default 1.25. */
  strokeWidth?: number;
  /** Optional aria label for screen readers. */
  ariaLabel?: string;
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  showLastDot = true,
  strokeWidth = 1.25,
  ariaLabel,
}: SparklineProps) {
  // Memoize the path math — re-computes only when values change.
  const { linePath, areaPath, lastPoint } = useMemo(() => {
    if (values.length === 0) {
      return { linePath: "", areaPath: "", lastPoint: null };
    }
    if (values.length === 1) {
      // Single point — render a flat line at midline.
      return {
        linePath: `M0 ${height / 2} L${width} ${height / 2}`,
        areaPath: `M0 ${height / 2} L${width} ${height / 2} L${width} ${height} L0 ${height} Z`,
        lastPoint: { x: width, y: height / 2 },
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    // Avoid divide-by-zero on flat series; render flat at midline.
    const range = max - min || 1;
    // Inset by stroke-width so the line doesn't clip top/bottom.
    const pad = strokeWidth;
    const innerH = height - pad * 2;
    const stepX = width / (values.length - 1);

    const points = values.map((v, i) => ({
      x: i * stepX,
      y: pad + innerH - ((v - min) / range) * innerH,
    }));

    const linePath = points
      .map((p, i) => (i === 0 ? `M${p.x} ${p.y}` : `L${p.x} ${p.y}`))
      .join(" ");
    const areaPath =
      linePath +
      ` L${points[points.length - 1]!.x} ${height} L0 ${height} Z`;

    return { linePath, areaPath, lastPoint: points[points.length - 1] };
  }, [values, width, height, strokeWidth]);

  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-hidden="true">
        {/* Empty placeholder — keeps layout stable while data loads */}
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      style={{ overflow: "visible" }}
    >
      {/* Filled area underneath the line — low-alpha currentColor */}
      <path d={areaPath} fill="currentColor" opacity={0.12} />
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest-point indicator */}
      {showLastDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={1.75}
          fill="currentColor"
        />
      )}
    </svg>
  );
}

export default Sparkline;
